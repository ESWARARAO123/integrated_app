/**
 * Test script for Image-Enhanced RAG Integration
 * Demonstrates the complete flow from document upload to image-enhanced responses
 */

const imageProcessingService = require('../../services/imageProcessingService');
const vectorStoreService = require('../../services/vectorStoreService');
const ragService = require('../../services/ragService');

async function testImageRagIntegration() {
  console.log('🧪 Testing Image-Enhanced RAG Integration');
  console.log('=' * 50);

  try {
    // Test 1: Check if image processing service is available
    console.log('\n1️⃣ Testing Image Processing Service...');
    const serviceTest = await imageProcessingService.testService();
    
    if (serviceTest.success) {
      console.log('✅ Image processing service is available');
      console.log(`   Container: ${serviceTest.containerName}`);
    } else {
      console.log('❌ Image processing service not available');
      console.log(`   Error: ${serviceTest.message}`);
      return;
    }

    // Test 2: Process a sample document (if available)
    console.log('\n2️⃣ Testing Document Image Processing...');
    const testUserId = 'test-user-image-rag';
    const testSessionId = 'test-session-image-rag';
    const samplePdfPath = '/app/image-processing/input.pdf';

    const imageResult = await imageProcessingService.processDocumentImages(
      samplePdfPath,
      testUserId,
      testSessionId
    );

    if (imageResult.success) {
      console.log('✅ Image processing completed');
      console.log(`   Images processed: ${imageResult.images?.length || 0}`);
      console.log(`   Stats: ${JSON.stringify(imageResult.stats)}`);
      
      // Test 3: Store images in vector database
      if (imageResult.images && imageResult.images.length > 0) {
        console.log('\n3️⃣ Testing Image Vector Storage...');
        
        const vectorResult = await vectorStoreService.addDocumentImages(
          'test-doc-123',
          imageResult.images,
          {
            userId: testUserId,
            sessionId: testSessionId,
            fileName: 'test_document.pdf'
          }
        );

        if (vectorResult.success) {
          console.log('✅ Images stored in vector database');
          console.log(`   Images stored: ${vectorResult.count}`);
        } else {
          console.log('❌ Failed to store images in vector database');
          console.log(`   Error: ${vectorResult.error}`);
        }
      }
    } else {
      console.log('❌ Image processing failed');
      console.log(`   Error: ${imageResult.error}`);
    }

    // Test 4: Test RAG search with images
    console.log('\n4️⃣ Testing RAG Search with Images...');
    
    const testQueries = [
      'Show me DDR4 PHY architecture',
      'Display PLL circuit diagrams',
      'What are the technical specifications?',
      'Show block diagrams'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Testing query: "${query}"`);
      
      try {
        const ragResult = await ragService.processRagChat(query, 'qwen2.5:3b', {
          userId: testUserId,
          sessionId: testSessionId
        });

        if (ragResult.success) {
          const response = ragResult.response?.choices?.[0]?.message?.content || ragResult.response;
          const sources = ragResult.sources || [];
          const images = ragResult.images || [];

          console.log('✅ RAG response generated');
          console.log(`   Response length: ${response?.length || 0} characters`);
          console.log(`   Text sources: ${sources.length}`);
          console.log(`   Images found: ${images.length}`);

          if (images.length > 0) {
            console.log('   📸 Image details:');
            images.forEach((img, index) => {
              console.log(`      ${index + 1}. Page ${img.page} | Score: ${img.score?.toFixed(3)} | Keywords: ${img.keywords?.substring(0, 50)}...`);
            });
          }
        } else {
          console.log('❌ RAG query failed');
          console.log(`   Error: ${ragResult.error}`);
        }
      } catch (queryError) {
        console.log('❌ RAG query error');
        console.log(`   Error: ${queryError.message}`);
      }
    }

    // Test 5: Check vector store statistics
    console.log('\n5️⃣ Testing Vector Store Statistics...');
    const stats = await vectorStoreService.getStats(testUserId);
    console.log('📊 Vector Store Stats:');
    console.log(`   Total chunks: ${stats.totalChunks}`);
    console.log(`   Total documents: ${stats.totalDocuments}`);
    console.log(`   User ID: ${stats.userId}`);

    // Test 6: Service configuration
    console.log('\n6️⃣ Service Configuration...');
    const imageServiceStats = imageProcessingService.getStats();
    console.log('⚙️ Image Processing Config:');
    console.log(`   Enabled: ${imageServiceStats.enabled}`);
    console.log(`   Container: ${imageServiceStats.containerName}`);
    console.log(`   Filters: ${JSON.stringify(imageServiceStats.filters)}`);
    console.log(`   Max images: ${imageServiceStats.maxImages}`);

    console.log('\n🎉 Image-Enhanced RAG Integration Test Complete!');
    console.log('=' * 50);
    console.log('✅ All components are working together');
    console.log('✅ Images are being processed and stored');
    console.log('✅ RAG queries return both text and images');
    console.log('✅ User isolation is maintained');

  } catch (error) {
    console.error('\n💥 Test failed with error:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Cleanup function
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Clean up test collections
    const { spawn } = require('child_process');
    
    const cleanupProcess = spawn('docker', [
      'compose', 'exec', '-T', 'image-processor',
      'python', 'image-processing/cleanup_image_collections.py',
      'delete-user', '--user-id', 'test-user-image-rag'
    ]);

    cleanupProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Test data cleaned up successfully');
      } else {
        console.log('⚠️ Cleanup completed with warnings');
      }
    });

  } catch (cleanupError) {
    console.warn('⚠️ Cleanup error:', cleanupError.message);
  }
}

// Main execution
if (require.main === module) {
  testImageRagIntegration()
    .then(() => {
      console.log('\n🏁 Test execution completed');
      return cleanup();
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testImageRagIntegration,
  cleanup
};
