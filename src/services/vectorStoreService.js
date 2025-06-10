/**
 * Vector Store Service
 * Handles interactions with ChromaDB for document embeddings storage and retrieval
 * USER-ISOLATED: Each user gets their own ChromaDB collection
 */

const { ChromaClient } = require('chromadb');
const config = require('../utils/config');

class VectorStoreService {
  constructor(overrides = {}) {
    // Read ChromaDB configuration from config.ini
    const dockerConfig = config.getSection('Docker');
    const protocol = dockerConfig['docker-chromadb-protocol'] || 'http';
    const host = dockerConfig['docker-chromadb-host'] || 'localhost';
    const port = dockerConfig['docker-chromadb-port'] || '8000';
    const chromaUrl = `${protocol}://${host}:${port}`;

    this.config = {
      protocol: protocol,
      host: host,
      port: port,
      chromaUrl: chromaUrl,
      ...overrides
    };
    this.chromaClient = null;
    this.isInitialized = false;
    this.ollamaService = null; // Will be initialized when needed for image embeddings

    console.log(`ChromaDB configuration loaded: ${chromaUrl}`);
  }

  /**
   * Initialize the vector store
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      console.log('Connecting to ChromaDB server at:', `${this.config.protocol}://${this.config.host}:${this.config.port}`);
      
      this.chromaClient = new ChromaClient({
        path: `${this.config.protocol}://${this.config.host}:${this.config.port}`
      });

      // Test connection
      await this.chromaClient.heartbeat();
      console.log('ChromaDB connection successful');

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to ChromaDB:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Get or create user-specific collection for TEXT CHUNKS
   */
  async getUserCollection(userId) {
    try {
      const collectionName = `user_${userId.replace(/-/g, '_')}_docs`;

      try {
        const collection = await this.chromaClient.getCollection({
          name: collectionName
        });
        console.log(`Retrieved existing ChromaDB text collection: ${collectionName}`);
        return collection;
      } catch (error) {
        console.log(`Creating new ChromaDB text collection: ${collectionName}`);
        const collection = await this.chromaClient.createCollection({
          name: collectionName,
          metadata: {
            userId: userId,
            type: 'text',
            createdAt: new Date().toISOString()
          }
        });
        console.log(`Created new ChromaDB text collection: ${collectionName}`);
        return collection;
      }
    } catch (error) {
      console.error(`Error managing user text collection for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get or create user-specific collection for IMAGES
   */
  async getUserImageCollection(userId) {
    try {
      const collectionName = `user_${userId.replace(/-/g, '_')}_images`;

      try {
        const collection = await this.chromaClient.getCollection({
          name: collectionName
        });
        console.log(`Retrieved existing ChromaDB image collection: ${collectionName}`);
        return collection;
      } catch (error) {
        console.log(`Creating new ChromaDB image collection: ${collectionName}`);
        const collection = await this.chromaClient.createCollection({
          name: collectionName,
          metadata: {
            userId: userId,
            type: 'images',
            createdAt: new Date().toISOString()
          }
        });
        console.log(`Created new ChromaDB image collection: ${collectionName}`);
        return collection;
      }
    } catch (error) {
      console.error(`Error managing user image collection for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Add document chunks to ChromaDB - USER ISOLATED
   */
  async addDocumentChunks(documentId, chunks, embeddings, metadata = {}) {
    try {
      console.log(`Storing ${embeddings.length} embeddings in ChromaDB for document ${documentId}`);
      
      const userId = metadata.userId;
      if (!userId) {
        throw new Error('userId is required in metadata for user isolation');
      }

      // Get user-specific collection
      const collection = await this.getUserCollection(userId);
      
      // Delete existing document chunks first
      try {
        await collection.delete({
          where: { documentId: documentId.toString() }
        });
        console.log(`Deleted any existing chunks for document ${documentId}`);
      } catch (deleteError) {
        console.log('No existing chunks to delete or delete failed:', deleteError.message);
      }

      // Prepare data - ChromaDB requires all metadata values to be strings
      const ids = chunks.map((_, index) => `${documentId}_chunk_${index}`);
      const documents = chunks;
      const metadatas = chunks.map((chunk, index) => ({
        documentId: documentId.toString(),
        chunkIndex: index.toString(),
        sessionId: metadata.sessionId ? metadata.sessionId.toString() : "no_session",
        userId: userId.toString(),
        timestamp: new Date().toISOString(),
        fileName: metadata.fileName || "unknown",
        fileType: metadata.fileType || "unknown"
      }));

      console.log(`Adding to ChromaDB - Document ${documentId}:`);
      console.log(`  - ${ids.length} chunks`);
      console.log(`  - Sample ID: ${ids[0]}`);
      console.log(`  - Sample text length: ${documents[0]?.length || 0}`);
      console.log(`  - Embedding dimensions: ${embeddings[0]?.length || 0}`);
      console.log(`  - Sample metadata:`, metadatas[0]);

      // Add to ChromaDB
      await collection.add({
        ids: ids,
        embeddings: embeddings,
        documents: documents,
        metadatas: metadatas
      });

      console.log(`✅ Successfully stored ${embeddings.length} vectors for document ${documentId} in ChromaDB`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to store document ${documentId} in ChromaDB:`, error);
      throw error;
    }
  }

  /**
   * Search for similar documents - USER ISOLATED with IMAGE SUPPORT
   */
  async search(queryEmbedding, options = {}) {
    const { limit = 10, sessionId, userId, includeImages = true, imageLimit = 3 } = options;

    if (!userId) {
      throw new Error('userId is required for user-isolated search');
    }

    try {
      const collection = await this.getUserCollection(userId);

      console.log(`🔍 Searching ChromaDB for user ${userId} with limit ${limit}, includeImages: ${includeImages}`);

      // Simple where clause - just filter by userId, ignore sessionId for now
      let whereClause = { userId: userId };

      console.log('Where clause:', JSON.stringify(whereClause));

      // Increase search limit to get both text and images
      const searchLimit = includeImages ? limit + imageLimit + 5 : limit;

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: searchLimit,
        where: whereClause
      });

      if (results.documents && results.documents[0] && results.documents[0].length > 0) {
        const allResults = results.documents[0].map((doc, index) => ({
          content: doc,
          metadata: results.metadatas[0][index],
          score: 1 - results.distances[0][index] // Convert distance to similarity
        }));

        // All results are text chunks (images are in separate collection)
        const textResults = allResults.slice(0, limit);

        // Use keyword-based search for images if requested
        let imageResults = [];
        if (includeImages && options.query) {
          imageResults = await this.searchImages(options.query, {
            userId: userId,
            limit: imageLimit
          });
        }

        console.log(`✅ Found ${textResults.length} text chunks and ${imageResults.length} images for user ${userId}`);

        // Return combined results with type indicators
        return {
          textResults,
          imageResults,
          allResults: [...textResults, ...imageResults]
        };
      } else {
        console.log(`No relevant chunks found for user ${userId}`);

        // Still search for images even if no text results
        let imageResults = [];
        if (includeImages && options.query) {
          imageResults = await this.searchImages(options.query, {
            userId: userId,
            limit: imageLimit
          });
        }

        return {
          textResults: [],
          imageResults,
          allResults: imageResults
        };
      }

    } catch (error) {
      console.error('Error searching ChromaDB:', error);
      throw error;
    }
  }

  /**
   * Add document images to user-specific IMAGE collection (WITHOUT AI embeddings)
   * Uses keyword-based storage for simple retrieval
   */
  async addDocumentImages(documentId, images, metadata = {}) {
    try {
      const userId = metadata.userId;
      if (!userId) {
        throw new Error('userId is required in metadata for user isolation');
      }

      // Get user-specific IMAGE collection (separate from text)
      const collection = await this.getUserImageCollection(userId);

      console.log(`📸 Adding ${images.length} images for document ${documentId} to user IMAGE collection`);

      // Filter out images that don't have valid data
      const validImages = images.filter(image => {
        if (!image || !image.base64) {
          console.warn(`Skipping image without base64 data:`, image?.filename || 'unknown');
          return false;
        }
        return true;
      });

      if (validImages.length === 0) {
        console.warn(`No valid images to store for document ${documentId}`);
        return { success: true, count: 0 };
      }

      // Prepare image data for storage WITHOUT AI embeddings
      const imageIds = [];
      const imageEmbeddings = [];
      const imageDocuments = [];
      const imageMetadatas = [];

      for (let i = 0; i < validImages.length; i++) {
        const image = validImages[i];

        // Use keywords as searchable text (no AI embedding needed)
        const keywordText = image.keywords || '';

        // Create a simple dummy embedding (all zeros) since ChromaDB requires embeddings
        // We'll use keyword matching instead of vector similarity
        const dummyEmbedding = new Array(384).fill(0); // Standard embedding size

        imageIds.push(`${documentId}_image_${image.page || 0}_${image.index || i}_${Date.now()}_${i}`);
        imageEmbeddings.push(dummyEmbedding);
        imageDocuments.push(keywordText); // Store keywords as searchable text
        imageMetadatas.push({
          documentId: documentId.toString(),
          userId: userId.toString(),
          sessionId: metadata.sessionId ? metadata.sessionId.toString() : "no_session",
          type: 'image', // Mark as image type
          imageId: image.image_id || `img_${i}`,
          page: image.page || 0,
          imageIndex: image.index || i,
          filename: image.filename || `image_${i}`,
          base64: image.base64 || '',
          keywords: image.keywords || '',
          dimensions: image.dimensions || 'unknown',
          sizeKb: image.size_kb || 0,
          format: image.format || 'unknown',
          fileName: metadata.fileName || "unknown",
          timestamp: new Date().toISOString()
        });
      }

      // Store in same collection as text chunks
      await collection.add({
        ids: imageIds,
        embeddings: imageEmbeddings,
        documents: imageDocuments,
        metadatas: imageMetadatas
      });

      console.log(`✅ Successfully stored ${imageIds.length} image records for document ${documentId} in user collection`);
      return { success: true, count: imageIds.length };

    } catch (error) {
      console.error(`❌ Failed to store images for document ${documentId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for images using keyword matching (not AI embeddings)
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of matching images
   */
  async searchImages(query, options = {}) {
    const { userId, limit = 3 } = options;

    if (!userId) {
      throw new Error('userId is required for user-isolated image search');
    }

    try {
      const collection = await this.getUserImageCollection(userId);

      // Get all images for this user (all items in image collection are images)
      const results = await collection.get({
        where: {
          userId: userId
        }
      });

      if (!results.metadatas || results.metadatas.length === 0) {
        console.log(`No images found for user ${userId}`);
        return [];
      }

      // Simple keyword matching - score based on keyword overlap
      const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      const scoredImages = [];

      for (let i = 0; i < results.metadatas.length; i++) {
        const metadata = results.metadatas[i];
        const keywords = (metadata.keywords || '').toLowerCase();

        // Calculate simple keyword match score
        let score = 0;
        for (const word of queryWords) {
          if (keywords.includes(word)) {
            score += 1;
          }
        }

        if (score > 0) {
          scoredImages.push({
            score: score,
            metadata: metadata,
            document: results.documents[i] || '',
            id: results.ids[i]
          });
        }
      }

      // Sort by score (highest first) and limit results
      const sortedImages = scoredImages
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      console.log(`🔍 Found ${sortedImages.length} matching images for query: "${query}"`);
      return sortedImages;

    } catch (error) {
      console.error('Error searching images:', error);
      return [];
    }
  }

  /**
   * Get vector store statistics - USER ISOLATED
   */
  async getStats(userId = null) {
    try {
      if (!userId) {
        return await this.getAggregateStats();
      }

      // User-specific stats (text collection only for RAG)
      try {
        const textCollection = await this.getUserCollection(userId);
        const textCount = await textCollection.count();

        // Get unique documents for this user from text collection
        const textResults = await textCollection.get({
          where: { userId: userId }
        });

        const uniqueDocuments = new Set();
        if (textResults.metadatas) {
          textResults.metadatas.forEach(meta => {
            if (meta.documentId) {
              uniqueDocuments.add(meta.documentId);
            }
          });
        }

        // Also get image stats
        let imageCount = 0;
        try {
          const imageCollection = await this.getUserImageCollection(userId);
          imageCount = await imageCollection.count();
        } catch (imageError) {
          console.log(`No image collection for user ${userId}`);
        }

        console.log(`User ${userId} stats: ${textCount} text chunks, ${imageCount} images, ${uniqueDocuments.size} documents`);
        return {
          totalChunks: textCount,
          totalImages: imageCount,
          totalDocuments: uniqueDocuments.size,
          userId: userId
        };
      } catch (error) {
        console.error(`Error getting stats for user ${userId}:`, error);
        return {
          totalChunks: 0,
          totalImages: 0,
          totalDocuments: 0,
          userId: userId
        };
      }

    } catch (error) {
      console.error('Error getting vector store stats:', error);
      return {
        totalChunks: 0,
        totalImages: 0,
        totalDocuments: 0,
        userId: userId
      };
    }
  }

  /**
   * Get aggregate stats across all users
   */
  async getAggregateStats() {
    try {
      let totalChunks = 0;
      let totalDocuments = 0;
      
      try {
        const collections = await this.chromaClient.listCollections();
        console.log(`Found ${collections.length} collections in ChromaDB`);
        
        for (const collection of collections) {
          try {
            // Access collection name correctly
            const collectionName = collection.name || collection.id || collection;
            if (!collectionName) {
              console.warn('Collection missing name:', collection);
              continue;
            }
            
            const collectionObj = await this.chromaClient.getCollection({ name: collectionName });
            const count = await collectionObj.count();
            totalChunks += count;
            
            // Get unique documents
            const results = await collectionObj.get();
            const uniqueDocuments = new Set();
            if (results.metadatas) {
              results.metadatas.forEach(meta => {
                if (meta.documentId) {
                  uniqueDocuments.add(meta.documentId);
                }
              });
            }
            totalDocuments += uniqueDocuments.size;
            
            console.log(`Collection ${collectionName}: ${count} chunks, ${uniqueDocuments.size} documents`);
          } catch (collectionError) {
            console.error(`Error getting stats for collection:`, collectionError);
          }
        }
        
      } catch (error) {
        console.error('Error getting collections:', error);
      }

      console.log(`📊 Total ChromaDB stats: ${totalChunks} chunks, ${totalDocuments} documents`);
      return {
        totalChunks,
        totalDocuments,
        userId: null
      };

    } catch (error) {
      console.error('Error getting aggregate stats:', error);
      return {
        totalChunks: 0,
        totalDocuments: 0,
        userId: null
      };
    }
  }

  /**
   * Delete document chunks - USER ISOLATED
   */
  async deleteDocumentChunks(documentId, userId) {
    try {
      if (!userId) {
        throw new Error('userId is required for user isolation');
      }

      const collection = await this.getUserCollection(userId);
      
      await collection.delete({
        where: { 
          documentId: documentId.toString(),
          userId: userId
        }
      });
      
      console.log(`✅ Deleted document ${documentId} chunks for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error deleting document ${documentId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete session data - USER ISOLATED
   */
  async deleteSessionData(sessionId, userId) {
    try {
      if (!userId) {
        throw new Error('userId is required for user isolation');
      }

      const collection = await this.getUserCollection(userId);
      
      console.log(`🗑️ Deleting session data for sessionId: ${sessionId}, userId: ${userId}`);
      
      // First, let's see what data exists for this user
      const allResults = await collection.get({
        where: { userId: userId }
      });
      
      console.log(`Found ${allResults.ids?.length || 0} total chunks for user ${userId}`);
      
      // Filter by sessionId (handle both actual sessionId and "no_session")
      let idsToDelete = [];
      if (allResults.ids && allResults.metadatas) {
        for (let i = 0; i < allResults.ids.length; i++) {
          const metadata = allResults.metadatas[i];
          if (metadata.sessionId === sessionId || metadata.sessionId === sessionId.toString()) {
            idsToDelete.push(allResults.ids[i]);
          }
        }
      }
      
      console.log(`Found ${idsToDelete.length} chunks to delete for session ${sessionId}`);
      
      if (idsToDelete.length > 0) {
        // Delete by IDs instead of using complex where clause
        await collection.delete({
          ids: idsToDelete
        });
        
        console.log(`✅ Deleted ${idsToDelete.length} chunks for session ${sessionId} (user ${userId})`);
      } else {
        console.log(`No chunks found for session ${sessionId} (user ${userId})`);
      }
      
      return { success: true, deletedCount: idsToDelete.length };
    } catch (error) {
      console.error(`❌ Error deleting session data:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new VectorStoreService();