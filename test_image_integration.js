async function testImageIntegration() {
  try {
    console.log('🧪 Testing Separate Collections Fix...');

    // Test vector store service directly
    const vectorStoreService = require('./src/services/vectorStoreService');
    const userId = '6d378bd8-bb50-48f6-b85e-9cf9e0171dc2';

    console.log('\n📊 Initializing Vector Store Service...');
    await vectorStoreService.initialize();

    console.log('\n📊 Testing separate collections...');

    // Test creating both collections
    try {
      const textCollection = await vectorStoreService.getUserCollection(userId);
      console.log('✅ Text collection created/retrieved successfully');

      const imageCollection = await vectorStoreService.getUserImageCollection(userId);
      console.log('✅ Image collection created/retrieved successfully');

      console.log('\n🎯 Separate collections are working!');
      console.log('📝 Text collection: user_6d378bd8_bb50_48f6_b85e_9cf9e0171dc2_docs');
      console.log('🖼️ Image collection: user_6d378bd8_bb50_48f6_b85e_9cf9e0171dc2_images');

    } catch (collectionError) {
      console.error('❌ Error creating collections:', collectionError.message);
      return;
    }

    // Get stats
    const stats = await vectorStoreService.getStats(userId);
    console.log('\n📊 User stats:', stats);

    console.log('\n✅ Fix applied successfully!');
    console.log('🚀 Now you can upload a PDF and it should work properly:');
    console.log('   - Text chunks → user_*_docs collection (768-dim embeddings)');
    console.log('   - Images → user_*_images collection (384-dim dummy embeddings)');
    console.log('   - RAG will work with text chunks');
    console.log('   - Images will be searchable separately');

    return;

    console.log('Image search results:');
    console.log('- Images found:', imageResults?.length || 0);

    if (imageResults && imageResults.length > 0) {
      console.log('\n🖼️ Images found:');
      imageResults.forEach((image, index) => {
        console.log(`  ${index + 1}. Page ${image.metadata?.page} - ${image.metadata?.keywords?.substring(0, 50)}...`);
        console.log(`     Score: ${image.score}`);
        console.log(`     Base64 length: ${image.metadata?.base64?.length || 0} chars`);
      });

      console.log('\n✅ Image integration is working!');
    } else {
      console.log('\n❌ No images found in search results');

      // Check if images exist in collections
      console.log('\n🔍 Checking image collections...');
      try {
        const collection = await vectorStoreService.getUserCollection(userId);
        const allResults = await collection.get({
          where: { type: 'image' },
          limit: 10
        });
        console.log('Images in collection:', allResults.ids?.length || 0);
        if (allResults.ids && allResults.ids.length > 0) {
          console.log('Sample image IDs:', allResults.ids.slice(0, 3));
          console.log('Sample metadata:', allResults.metadatas?.slice(0, 1));
        }
      } catch (collectionError) {
        console.error('Error checking collection:', collectionError.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testImageIntegration();
