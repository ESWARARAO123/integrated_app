#!/usr/bin/env node
/**
 * Test Script for Session Deletion with ChromaDB Cleanup
 * 
 * This script tests the enhanced session deletion functionality that:
 * 1. Deletes session-specific ChromaDB data (both text and images)
 * 2. Checks if user has remaining sessions
 * 3. Wipes all user collections if no sessions remain
 */

const { ChromaClient } = require('chromadb');
const config = require('../utils/config');

class SessionDeletionTester {
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
   * List all collections and their contents
   */
  async listCollections() {
    try {
      console.log('\n📋 Listing all ChromaDB collections...');
      const collections = await this.chromaClient.listCollections();
      
      if (collections.length === 0) {
        console.log('   No collections found');
        return;
      }

      for (const collection of collections) {
        const collectionName = collection.name || collection.id || collection;
        try {
          const collectionObj = await this.chromaClient.getCollection({ name: collectionName });
          const count = await collectionObj.count();
          
          // Get sample data to understand structure
          const sampleData = await collectionObj.get({ limit: 3 });
          const userIds = new Set();
          const sessionIds = new Set();
          
          if (sampleData.metadatas) {
            sampleData.metadatas.forEach(meta => {
              if (meta.userId) userIds.add(meta.userId);
              if (meta.sessionId) sessionIds.add(meta.sessionId);
            });
          }

          console.log(`   📁 ${collectionName}: ${count} items`);
          if (userIds.size > 0) {
            console.log(`      Users: ${Array.from(userIds).slice(0, 3).join(', ')}${userIds.size > 3 ? '...' : ''}`);
          }
          if (sessionIds.size > 0) {
            console.log(`      Sessions: ${Array.from(sessionIds).slice(0, 3).join(', ')}${sessionIds.size > 3 ? '...' : ''}`);
          }
        } catch (error) {
          console.log(`   📁 ${collectionName}: Error accessing (${error.message})`);
        }
      }
    } catch (error) {
      console.error('❌ Error listing collections:', error.message);
    }
  }

  /**
   * Test session deletion for a specific user and session
   */
  async testSessionDeletion(userId, sessionId) {
    try {
      console.log(`\n🧪 Testing session deletion for user ${userId}, session ${sessionId}`);
      
      // Import the vector store service
      const vectorStoreService = require('../services/vectorStoreService');
      
      // Check initial state
      console.log('📊 Checking initial state...');
      const initialData = await vectorStoreService.userHasData(userId);
      console.log(`   Text data: ${initialData.hasTextData}, Image data: ${initialData.hasImageData}`);

      // Test session data deletion
      console.log('🗑️ Testing session data deletion...');
      const textResult = await vectorStoreService.deleteSessionData(sessionId, userId);
      const imageResult = await vectorStoreService.deleteSessionImageData(sessionId, userId);
      
      console.log(`   Text deletion: ${textResult.success ? '✅' : '❌'} (${textResult.deletedCount || 0} chunks)`);
      console.log(`   Image deletion: ${imageResult.success ? '✅' : '❌'} (${imageResult.deletedCount || 0} chunks)`);

      // Check final state
      console.log('📊 Checking final state...');
      const finalData = await vectorStoreService.userHasData(userId);
      console.log(`   Text data: ${finalData.hasTextData}, Image data: ${finalData.hasImageData}`);

      return {
        textResult,
        imageResult,
        initialData,
        finalData
      };
    } catch (error) {
      console.error('❌ Error testing session deletion:', error.message);
      return null;
    }
  }

  /**
   * Test complete user collection wipe
   */
  async testUserCollectionWipe(userId) {
    try {
      console.log(`\n🧹 Testing complete collection wipe for user ${userId}`);
      
      const vectorStoreService = require('../services/vectorStoreService');
      
      // Check initial state
      const initialData = await vectorStoreService.userHasData(userId);
      console.log(`   Initial state - Text: ${initialData.hasTextData}, Images: ${initialData.hasImageData}`);

      // Perform collection wipe
      const wipeResult = await vectorStoreService.deleteUserCollections(userId);
      console.log(`   Wipe result: ${wipeResult.success ? '✅' : '❌'} - ${wipeResult.message}`);
      
      if (wipeResult.results) {
        console.log(`   Text collection: ${wipeResult.results.textCollection.success ? '✅' : '❌'}`);
        console.log(`   Image collection: ${wipeResult.results.imageCollection.success ? '✅' : '❌'}`);
      }

      // Check final state
      const finalData = await vectorStoreService.userHasData(userId);
      console.log(`   Final state - Text: ${finalData.hasTextData}, Images: ${finalData.hasImageData}`);

      return wipeResult;
    } catch (error) {
      console.error('❌ Error testing collection wipe:', error.message);
      return null;
    }
  }

  /**
   * Run comprehensive tests
   */
  async runTests() {
    console.log('🚀 Starting ChromaDB Session Deletion Tests\n');

    // List initial state
    await this.listCollections();

    // You can customize these test parameters
    const testUserId = 'test-user-123';
    const testSessionId = 'test-session-456';

    console.log(`\n📝 Test Parameters:`);
    console.log(`   User ID: ${testUserId}`);
    console.log(`   Session ID: ${testSessionId}`);

    // Test 1: Session deletion
    const sessionDeletionResult = await this.testSessionDeletion(testUserId, testSessionId);

    // Test 2: Collection wipe (only if you want to test this)
    // Uncomment the line below to test complete collection wipe
    // const wipeResult = await this.testUserCollectionWipe(testUserId);

    // List final state
    await this.listCollections();

    console.log('\n✅ Tests completed!');
    console.log('\n💡 To test with real data:');
    console.log('   1. Upload some documents to create ChromaDB collections');
    console.log('   2. Note the user ID and session ID from the logs');
    console.log('   3. Update the testUserId and testSessionId variables above');
    console.log('   4. Run this script again');
  }
}

// Run the tests
async function main() {
  const tester = new SessionDeletionTester();
  await tester.runTests();
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

module.exports = SessionDeletionTester;
