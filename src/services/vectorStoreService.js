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
   * Get or create user-specific collection
   */
  async getUserCollection(userId) {
    try {
      const collectionName = `user_${userId.replace(/-/g, '_')}_docs`;
      
      try {
        const collection = await this.chromaClient.getCollection({
          name: collectionName
        });
        console.log(`Retrieved existing ChromaDB collection: ${collectionName}`);
        return collection;
      } catch (error) {
        console.log(`Creating new ChromaDB collection: ${collectionName}`);
        const collection = await this.chromaClient.createCollection({
          name: collectionName,
          metadata: {
            userId: userId,
            createdAt: new Date().toISOString()
          }
        });
        console.log(`Created new ChromaDB collection: ${collectionName}`);
        return collection;
      }
    } catch (error) {
      console.error(`Error managing user collection for ${userId}:`, error);
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
   * Search for similar documents - USER ISOLATED
   */
  async search(queryEmbedding, options = {}) {
    const { limit = 10, sessionId, userId } = options;
    
    if (!userId) {
      throw new Error('userId is required for user-isolated search');
    }

    try {
      const collection = await this.getUserCollection(userId);
      
      console.log(`🔍 Searching ChromaDB for user ${userId} with limit ${limit}`);
      
      // Simple where clause - just filter by userId, ignore sessionId for now
      let whereClause = { userId: userId };
      
      console.log('Where clause:', JSON.stringify(whereClause));

      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: whereClause
      });

      if (results.documents && results.documents[0] && results.documents[0].length > 0) {
        const searchResults = results.documents[0].map((doc, index) => ({
          content: doc,
          metadata: results.metadatas[0][index],
          score: 1 - results.distances[0][index] // Convert distance to similarity
        }));

        console.log(`✅ Found ${searchResults.length} relevant chunks for user ${userId}`);
        return searchResults;
      } else {
        console.log(`No relevant chunks found for user ${userId}`);
        return [];
      }

    } catch (error) {
      console.error('Error searching ChromaDB:', error);
      throw error;
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

      // User-specific stats
      try {
        const collection = await this.getUserCollection(userId);
        const count = await collection.count();
        
        // Get unique documents for this user
        const results = await collection.get({
          where: { userId: userId }
        });
        
        const uniqueDocuments = new Set();
        if (results.metadatas) {
          results.metadatas.forEach(meta => {
            if (meta.documentId) {
              uniqueDocuments.add(meta.documentId);
            }
          });
        }

        console.log(`User ${userId} stats: ${count} chunks, ${uniqueDocuments.size} documents`);
        return {
          totalChunks: count,
          totalDocuments: uniqueDocuments.size,
          userId: userId
        };
      } catch (error) {
        console.error(`Error getting stats for user ${userId}:`, error);
        return {
          totalChunks: 0,
          totalDocuments: 0,
          userId: userId
        };
      }

    } catch (error) {
      console.error('Error getting vector store stats:', error);
      return {
        totalChunks: 0,
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