#!/usr/bin/env node

/**
 * Development Script: Clear All ChromaDB Collections
 * 
 * This script clears all collections from ChromaDB for development testing.
 * Use this to reset the RAG system to a clean state and test the toggle availability.
 * 
 * Usage: node scripts/clear_chromadb_collections.js
 */

const { ChromaClient } = require('chromadb');
const path = require('path');

// Load configuration
const config = require('../utils/config');

async function clearAllCollections() {
  let chromaClient = null;
  
  try {
    console.log('🧹 ChromaDB Collection Cleaner - Development Tool');
    console.log('================================================');
    
    // Load ChromaDB configuration
    const dockerConfig = config.getSection('docker');
    const protocol = dockerConfig['chromadb_protocol'] || config.get('docker.chromadb_protocol', 'http');
    const host = dockerConfig['chromadb_host'] || config.get('docker.chromadb_host', 'localhost');
    const port = dockerConfig['chromadb_port'] || config.get('docker.chromadb_port', '8001');
    const chromaUrl = `${protocol}://${host}:${port}`;
    
    console.log(`📡 Connecting to ChromaDB at: ${chromaUrl}`);
    
    // Initialize ChromaDB client
    chromaClient = new ChromaClient({
      path: chromaUrl
    });
    
    // Test connection
    await chromaClient.heartbeat();
    console.log('✅ Connected to ChromaDB successfully');
    
    // Get all collections
    console.log('\n🔍 Fetching all collections...');
    const collections = await chromaClient.listCollections();
    
    if (!collections || collections.length === 0) {
      console.log('📭 No collections found in ChromaDB');
      console.log('✨ ChromaDB is already clean!');
      return;
    }
    
    console.log(`📊 Found ${collections.length} collection(s):`);
    
    // List all collections with their stats
    for (const collection of collections) {
      try {
        const collectionName = collection.name || collection.id || collection;
        const collectionObj = await chromaClient.getCollection({ name: collectionName });
        const count = await collectionObj.count();
        console.log(`  📁 ${collectionName} (${count} chunks)`);
      } catch (error) {
        console.log(`  📁 ${collection} (error getting stats: ${error.message})`);
      }
    }
    
    // Confirm deletion
    console.log('\n⚠️  WARNING: This will DELETE ALL collections and their data!');
    console.log('This action cannot be undone.');
    
    // In a real interactive environment, you'd want to prompt for confirmation
    // For now, we'll add a safety check
    const args = process.argv.slice(2);
    if (!args.includes('--force')) {
      console.log('\n❌ Safety check: Add --force flag to confirm deletion');
      console.log('Usage: node scripts/clear_chromadb_collections.js --force');
      process.exit(1);
    }
    
    console.log('\n🗑️  Starting deletion process...');
    
    // Delete all collections
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const collection of collections) {
      try {
        const collectionName = collection.name || collection.id || collection;
        console.log(`  🗑️  Deleting collection: ${collectionName}`);
        
        await chromaClient.deleteCollection({ name: collectionName });
        deletedCount++;
        console.log(`  ✅ Deleted: ${collectionName}`);
        
      } catch (error) {
        errorCount++;
        console.log(`  ❌ Failed to delete ${collection}: ${error.message}`);
      }
    }
    
    console.log('\n📊 Deletion Summary:');
    console.log(`  ✅ Successfully deleted: ${deletedCount} collections`);
    console.log(`  ❌ Failed to delete: ${errorCount} collections`);
    
    if (deletedCount > 0) {
      console.log('\n🎉 ChromaDB collections cleared successfully!');
      console.log('💡 The RAG toggle should now show as unavailable until new documents are uploaded.');
    }
    
    // Verify cleanup
    console.log('\n🔍 Verifying cleanup...');
    const remainingCollections = await chromaClient.listCollections();
    
    if (!remainingCollections || remainingCollections.length === 0) {
      console.log('✅ Verification passed: No collections remaining');
    } else {
      console.log(`⚠️  Warning: ${remainingCollections.length} collections still exist:`);
      remainingCollections.forEach(col => {
        const name = col.name || col.id || col;
        console.log(`  📁 ${name}`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Error clearing ChromaDB collections:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure ChromaDB is running and accessible');
      console.error(`   Check if the service is running on the configured port`);
    }
    
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  clearAllCollections()
    .then(() => {
      console.log('\n🏁 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { clearAllCollections }; 