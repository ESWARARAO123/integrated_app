#!/usr/bin/env node
/**
 * Debug ChromaDB Metadata Script
 * 
 * This script examines the actual metadata stored in ChromaDB collections
 * to help debug session isolation issues.
 */

const { ChromaClient } = require('chromadb');
const config = require('../utils/config');

class ChromaDBDebugger {
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
   * Examine all collections and their metadata
   */
  async debugCollections() {
    try {
      console.log('\n🔍 Debugging ChromaDB Collections and Metadata...\n');
      
      const collections = await this.chromaClient.listCollections();
      
      if (collections.length === 0) {
        console.log('❌ No collections found');
        return;
      }

      for (const collection of collections) {
        const collectionName = collection.name || collection.id || collection;
        console.log(`\n📁 Collection: ${collectionName}`);
        console.log('=' .repeat(50));
        
        try {
          const collectionObj = await this.chromaClient.getCollection({ name: collectionName });
          const count = await collectionObj.count();
          console.log(`   Total items: ${count}`);
          
          if (count > 0) {
            // Get all data to examine metadata
            const allData = await collectionObj.get({
              limit: count // Get all items
            });
            
            console.log(`   Retrieved ${allData.ids?.length || 0} items for analysis`);
            
            // Analyze metadata
            this.analyzeMetadata(allData, collectionName);
          }
        } catch (error) {
          console.log(`   ❌ Error accessing collection: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Error debugging collections:', error.message);
    }
  }

  /**
   * Analyze metadata from collection data
   */
  analyzeMetadata(data, collectionName) {
    if (!data.metadatas || data.metadatas.length === 0) {
      console.log('   ⚠️ No metadata found');
      return;
    }

    console.log('\n   📊 Metadata Analysis:');
    
    // Collect unique values for each metadata field
    const metadataFields = {};
    
    data.metadatas.forEach((metadata, index) => {
      Object.keys(metadata).forEach(key => {
        if (!metadataFields[key]) {
          metadataFields[key] = new Set();
        }
        metadataFields[key].add(metadata[key]);
      });
    });

    // Display analysis
    Object.keys(metadataFields).forEach(field => {
      const uniqueValues = Array.from(metadataFields[field]);
      console.log(`   • ${field}: ${uniqueValues.length} unique values`);
      
      if (field === 'sessionId') {
        console.log(`     Sessions: ${uniqueValues.join(', ')}`);
      } else if (field === 'userId') {
        console.log(`     Users: ${uniqueValues.slice(0, 3).join(', ')}${uniqueValues.length > 3 ? '...' : ''}`);
      } else if (field === 'documentId') {
        console.log(`     Documents: ${uniqueValues.slice(0, 3).join(', ')}${uniqueValues.length > 3 ? '...' : ''}`);
      } else if (uniqueValues.length <= 5) {
        console.log(`     Values: ${uniqueValues.join(', ')}`);
      } else {
        console.log(`     Sample values: ${uniqueValues.slice(0, 3).join(', ')}...`);
      }
    });

    // Show sample metadata entries
    console.log('\n   📝 Sample Metadata Entries:');
    const samplesToShow = Math.min(3, data.metadatas.length);
    for (let i = 0; i < samplesToShow; i++) {
      console.log(`   Entry ${i + 1}:`, JSON.stringify(data.metadatas[i], null, 2).replace(/\n/g, '\n     '));
    }
  }

  /**
   * Search for specific session data
   */
  async searchForSession(sessionId, userId) {
    try {
      console.log(`\n🔍 Searching for session ${sessionId} (user: ${userId})...\n`);
      
      const collections = await this.chromaClient.listCollections();
      
      for (const collection of collections) {
        const collectionName = collection.name || collection.id || collection;
        
        if (!collectionName.includes(userId.replace(/-/g, '_'))) {
          continue; // Skip collections not for this user
        }
        
        console.log(`📁 Checking collection: ${collectionName}`);
        
        try {
          const collectionObj = await this.chromaClient.getCollection({ name: collectionName });
          
          // Search for this specific session
          const sessionData = await collectionObj.get({
            where: { sessionId: sessionId }
          });
          
          console.log(`   Found ${sessionData.ids?.length || 0} items for session ${sessionId}`);
          
          if (sessionData.ids && sessionData.ids.length > 0) {
            console.log('   Sample IDs:', sessionData.ids.slice(0, 3).join(', '));
            if (sessionData.metadatas && sessionData.metadatas.length > 0) {
              console.log('   Sample metadata:', JSON.stringify(sessionData.metadatas[0], null, 2));
            }
          }
          
          // Also search for any data that might have this session ID as a string
          const allData = await collectionObj.get({});
          let foundMatches = 0;
          
          if (allData.metadatas) {
            allData.metadatas.forEach((metadata, index) => {
              if (metadata.sessionId && metadata.sessionId.includes(sessionId)) {
                foundMatches++;
                if (foundMatches <= 3) {
                  console.log(`   Match ${foundMatches}: ID=${allData.ids[index]}, sessionId=${metadata.sessionId}`);
                }
              }
            });
          }
          
          if (foundMatches > 3) {
            console.log(`   ... and ${foundMatches - 3} more matches`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error searching collection: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Error searching for session:', error.message);
    }
  }

  /**
   * Check for orphaned data (data without proper session IDs)
   */
  async checkForOrphanedData(userId) {
    try {
      console.log(`\n🔍 Checking for orphaned data for user ${userId}...\n`);
      
      const collections = await this.chromaClient.listCollections();
      
      for (const collection of collections) {
        const collectionName = collection.name || collection.id || collection;
        
        if (!collectionName.includes(userId.replace(/-/g, '_'))) {
          continue; // Skip collections not for this user
        }
        
        console.log(`📁 Checking collection: ${collectionName}`);
        
        try {
          const collectionObj = await this.chromaClient.getCollection({ name: collectionName });
          const allData = await collectionObj.get({});
          
          let orphanedCount = 0;
          let noSessionCount = 0;
          
          if (allData.metadatas) {
            allData.metadatas.forEach((metadata, index) => {
              if (!metadata.sessionId || metadata.sessionId === 'no_session' || metadata.sessionId === 'null') {
                orphanedCount++;
                if (metadata.sessionId === 'no_session') noSessionCount++;
                
                if (orphanedCount <= 3) {
                  console.log(`   Orphaned item ${orphanedCount}: ID=${allData.ids[index]}, sessionId=${metadata.sessionId || 'undefined'}`);
                }
              }
            });
          }
          
          console.log(`   Total items: ${allData.ids?.length || 0}`);
          console.log(`   Orphaned items: ${orphanedCount}`);
          console.log(`   "no_session" items: ${noSessionCount}`);
          
          if (orphanedCount > 3) {
            console.log(`   ... and ${orphanedCount - 3} more orphaned items`);
          }
          
        } catch (error) {
          console.log(`   ❌ Error checking collection: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Error checking for orphaned data:', error.message);
    }
  }

  /**
   * Run comprehensive debugging
   */
  async runDebug(sessionId = null, userId = null) {
    console.log('🚀 Starting ChromaDB Metadata Debug\n');

    // General collection analysis
    await this.debugCollections();

    // If specific session/user provided, do targeted search
    if (sessionId && userId) {
      await this.searchForSession(sessionId, userId);
    }

    // Check for orphaned data if user provided
    if (userId) {
      await this.checkForOrphanedData(userId);
    }

    console.log('\n✅ Debug completed!');
    
    if (!sessionId || !userId) {
      console.log('\n💡 To search for specific session data, run:');
      console.log('   node scripts/debug_chromadb_metadata.js <sessionId> <userId>');
    }
  }
}

// Run the debugger
async function main() {
  const sessionId = process.argv[2];
  const userId = process.argv[3];

  const chromaDebugger = new ChromaDBDebugger();
  await chromaDebugger.runDebug(sessionId, userId);
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });
}

module.exports = ChromaDBDebugger;
