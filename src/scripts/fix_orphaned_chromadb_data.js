#!/usr/bin/env node
/**
 * Fix Orphaned ChromaDB Data Script
 * 
 * This script fixes ChromaDB data that has sessionId: "no_session"
 * by either assigning it to the correct session or cleaning it up.
 */

const { ChromaClient } = require('chromadb');
const config = require('../utils/config');
const { Pool } = require('pg');
const ini = require('ini');
const fs = require('fs');
const path = require('path');

// Set up database connection
const configPath = './conf/config.ini';
const configData = ini.parse(fs.readFileSync(path.resolve(configPath), 'utf-8'));

const pool = new Pool({
  host: configData.database['database-host'],
  port: configData.database['database-port'],
  user: configData.database['database-user'],
  password: configData.database['database-password'],
  database: configData.database['database-name'],
  max: 5,
  ssl: configData.database.ssl === 'true'
});

class ChromaDBFixer {
  constructor() {
    // Read ChromaDB configuration
    const dockerConfig = config.getSection('Docker');
    const protocol = dockerConfig['docker-chromadb-protocol'] || 'http';
    const host = dockerConfig['docker-chromadb-host'] || 'localhost';
    const port = dockerConfig['docker-chromadb-port'] || '8000';
    const chromaUrl = `${protocol}://${host}:${port}`;

    this.chromaClient = new ChromaClient({ path: chromaUrl });
    console.log(`Connected to ChromaDB at: ${chromaUrl}`);
  }

  /**
   * Get document information from database
   */
  async getDocumentInfo(documentId) {
    try {
      const result = await pool.query(
        'SELECT id, user_id, session_id, original_name, created_at FROM documents WHERE id = $1',
        [documentId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Error getting document info for ${documentId}:`, error.message);
      return null;
    }
  }

  /**
   * Get the most recent session for a user
   */
  async getMostRecentSession(userId) {
    try {
      const result = await pool.query(
        'SELECT id FROM chat_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      
      return result.rows[0]?.id || null;
    } catch (error) {
      console.error(`Error getting recent session for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Fix orphaned data in a collection
   */
  async fixOrphanedData(collectionName, userId, action = 'assign') {
    try {
      console.log(`\n🔧 Fixing orphaned data in collection: ${collectionName}`);
      
      const collection = await this.chromaClient.getCollection({ name: collectionName });
      
      // Get all data with "no_session"
      const orphanedData = await collection.get({
        where: { sessionId: "no_session" }
      });
      
      if (!orphanedData.ids || orphanedData.ids.length === 0) {
        console.log('   ✅ No orphaned data found');
        return { success: true, fixed: 0 };
      }

      console.log(`   Found ${orphanedData.ids.length} orphaned items`);

      if (action === 'delete') {
        // Delete all orphaned data
        await collection.delete({
          ids: orphanedData.ids
        });
        
        console.log(`   🗑️ Deleted ${orphanedData.ids.length} orphaned items`);
        return { success: true, fixed: orphanedData.ids.length, action: 'deleted' };
      }

      if (action === 'assign') {
        // Try to assign to correct sessions based on document ID
        let fixedCount = 0;
        const batchSize = 50; // Process in batches to avoid overwhelming the system
        
        for (let i = 0; i < orphanedData.ids.length; i += batchSize) {
          const batch = orphanedData.ids.slice(i, i + batchSize);
          const batchMetadata = orphanedData.metadatas.slice(i, i + batchSize);
          const batchDocuments = orphanedData.documents ? orphanedData.documents.slice(i, i + batchSize) : null;
          const batchEmbeddings = orphanedData.embeddings ? orphanedData.embeddings.slice(i, i + batchSize) : null;
          
          console.log(`   Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(orphanedData.ids.length/batchSize)}`);
          
          // Process each item in the batch
          for (let j = 0; j < batch.length; j++) {
            const id = batch[j];
            const metadata = batchMetadata[j];
            const document = batchDocuments ? batchDocuments[j] : null;
            const embedding = batchEmbeddings ? batchEmbeddings[j] : null;
            
            let newSessionId = null;
            
            // Try to determine the correct session ID
            if (metadata.documentId) {
              const docInfo = await this.getDocumentInfo(metadata.documentId);
              if (docInfo && docInfo.session_id) {
                newSessionId = docInfo.session_id;
              }
            }
            
            // If we couldn't find a session from document, use the most recent session for the user
            if (!newSessionId) {
              newSessionId = await this.getMostRecentSession(userId);
            }
            
            // If we still don't have a session, skip this item
            if (!newSessionId) {
              console.log(`   ⚠️ Could not determine session for item ${id}, skipping`);
              continue;
            }
            
            // Update the metadata
            const updatedMetadata = {
              ...metadata,
              sessionId: newSessionId
            };
            
            try {
              // Delete the old item
              await collection.delete({ ids: [id] });
              
              // Add the item back with updated metadata
              await collection.add({
                ids: [id],
                metadatas: [updatedMetadata],
                documents: document ? [document] : undefined,
                embeddings: embedding ? [embedding] : undefined
              });
              
              fixedCount++;
            } catch (updateError) {
              console.error(`   ❌ Error updating item ${id}:`, updateError.message);
            }
          }
        }
        
        console.log(`   ✅ Fixed ${fixedCount} items`);
        return { success: true, fixed: fixedCount, action: 'assigned' };
      }

      return { success: false, error: 'Unknown action' };
    } catch (error) {
      console.error(`❌ Error fixing orphaned data in ${collectionName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fix orphaned data for a specific user
   */
  async fixUserOrphanedData(userId, action = 'assign') {
    try {
      console.log(`\n🔧 Fixing orphaned data for user: ${userId}`);
      console.log(`Action: ${action}`);
      
      const results = {
        textCollection: null,
        imageCollection: null
      };

      // Fix text collection
      const textCollectionName = `user_${userId.replace(/-/g, '_')}_docs`;
      try {
        results.textCollection = await this.fixOrphanedData(textCollectionName, userId, action);
      } catch (error) {
        console.log(`   ⚠️ Text collection not found or error: ${error.message}`);
        results.textCollection = { success: false, error: error.message };
      }

      // Fix image collection
      const imageCollectionName = `user_${userId.replace(/-/g, '_')}_images`;
      try {
        results.imageCollection = await this.fixOrphanedData(imageCollectionName, userId, action);
      } catch (error) {
        console.log(`   ⚠️ Image collection not found or error: ${error.message}`);
        results.imageCollection = { success: false, error: error.message };
      }

      return results;
    } catch (error) {
      console.error(`❌ Error fixing user orphaned data:`, error.message);
      return { error: error.message };
    }
  }

  /**
   * Run the fix process
   */
  async runFix(userId = null, action = 'assign') {
    console.log('🚀 Starting ChromaDB Orphaned Data Fix\n');
    console.log(`Action: ${action} (assign = assign to sessions, delete = remove orphaned data)`);

    if (userId) {
      console.log(`Target user: ${userId}`);
      const results = await this.fixUserOrphanedData(userId, action);
      
      console.log('\n📊 Results:');
      if (results.textCollection) {
        console.log(`   Text collection: ${results.textCollection.success ? '✅' : '❌'} ${results.textCollection.fixed || 0} items ${results.textCollection.action || 'processed'}`);
      }
      if (results.imageCollection) {
        console.log(`   Image collection: ${results.imageCollection.success ? '✅' : '❌'} ${results.imageCollection.fixed || 0} items ${results.imageCollection.action || 'processed'}`);
      }
    } else {
      console.log('❌ Please provide a user ID');
      console.log('Usage: node scripts/fix_orphaned_chromadb_data.js <userId> [action]');
      console.log('Actions: assign (default) | delete');
    }

    console.log('\n✅ Fix process completed!');
  }
}

// Run the fixer
async function main() {
  const userId = process.argv[2];
  const action = process.argv[3] || 'assign';
  
  if (!userId) {
    console.log('❌ Please provide a user ID');
    console.log('Usage: node scripts/fix_orphaned_chromadb_data.js <userId> [action]');
    console.log('Actions: assign (default) | delete');
    console.log('\nExample: node scripts/fix_orphaned_chromadb_data.js 6d378bd8-bb50-48f6-b85e-9cf9e0171dc2 assign');
    process.exit(1);
  }

  if (!['assign', 'delete'].includes(action)) {
    console.log('❌ Invalid action. Use "assign" or "delete"');
    process.exit(1);
  }
  
  const fixer = new ChromaDBFixer();
  await fixer.runFix(userId, action);
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });
}

module.exports = ChromaDBFixer;
