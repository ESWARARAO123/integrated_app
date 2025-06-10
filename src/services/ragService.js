/**
 * RAG (Retrieval-Augmented Generation) Service
 * Handles retrieval of relevant document chunks and augmentation of prompts
 */

const vectorStoreService = require('./vectorStoreService');
const OllamaService = require('./ollamaService');
const { formatRagResponse } = require('./ragResponseFormatter');
const { logger } = require('../utils/logger');
const config = require('../utils/config');

class RAGService {
  constructor() {
    this.vectorStoreService = vectorStoreService;
    // Create a new instance of OllamaService
    this.ollamaService = new OllamaService();

    // Initialize immediately
    this.initialized = false;
    this.initializeServices();

    this.embeddingModel = 'nomic-embed-text';
  }

  /**
   * Initialize services
   */
  async initializeServices() {
    try {
      // Initialize OllamaService
      await this.ollamaService.initialize();
      logger.info('RAG: OllamaService initialized successfully');
      console.log('RAG: OllamaService initialized successfully');
      this.initialized = true;
    } catch (err) {
      logger.error(`RAG: Failed to initialize OllamaService: ${err.message}`);
      console.error(`RAG: Failed to initialize OllamaService: ${err.message}`);
      this.initialized = false;
    }
  }

  /**
   * Generate a query embedding and retrieve relevant context
   * @param {string} query - User query
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Object>} - Result with context and sources
   */
  async retrieveContext(query, options = {}) {
    const {
      topK = 10,
      model = this.embeddingModel,
      sessionId = null,
      userId = null
    } = options;

    try {
      // Make sure OllamaService is initialized
      if (!this.initialized) {
        console.log('RAG: OllamaService not initialized, initializing now...');
        await this.initializeServices();

        if (!this.initialized) {
          console.error('RAG: Failed to initialize OllamaService');
          return {
            success: false,
            error: 'Failed to initialize OllamaService'
          };
        }
      }

      console.log(`RAG: Generating embedding for query: "${query.substring(0, 50)}..."`);
      if (sessionId) {
        console.log(`RAG: Using session context: ${sessionId}`);
      }

      // Generate embedding for the query - using the existing generateEmbedding method
      const embedResult = await this.ollamaService.generateEmbedding(query, model);
      if (!embedResult.success) {
        console.error(`RAG: Failed to generate query embedding: ${embedResult.error}`);
        return {
          success: false,
          error: 'Failed to generate query embedding'
        };
      }

      console.log(`RAG: Successfully generated query embedding, searching for relevant chunks...`);
      
      // Table-specific query expansion
      let isTableQuery = false;
      let tableReference = null;
      
      // Check if this is a query about tables
      if (query.toLowerCase().includes('table')) {
        isTableQuery = true;
        // Extract table references like "Table 2-2" or "table 2.2"
        const tableRefMatch = query.match(/table\s+(\d+[-\.]\d+)/i);
        if (tableRefMatch) {
          tableReference = tableRefMatch[0];
          console.log(`RAG: Detected table reference: ${tableReference}`);
        }
      }

      // Search options with increased limit for table queries
      const searchOptions = {
        sessionId,
        userId: options.userId, // Add userId for user isolation
        limit: isTableQuery ? 10 : topK, // Increase limit for table queries
        isTableQuery,
        tableReference
      };

      // Get image processing configuration
      const imageConfig = config.getSection('image_processing') || {};
      const includeImages = imageConfig.enabled === 'true' || imageConfig.enabled === true;
      const maxImages = parseInt(imageConfig.max_images_in_response) || 3;

      // Search for relevant documents with image support
      const searchResults = await this.vectorStoreService.search(
        embedResult.embedding,
        {
          ...searchOptions,
          includeImages: includeImages,
          imageLimit: maxImages,
          query: query // Add the original query for image keyword matching
        }
      );

      // Handle the enhanced return format with text and image results
      const textResults = searchResults.textResults || searchResults.allResults || searchResults || [];
      const imageResults = searchResults.imageResults || [];

      if (!textResults || textResults.length === 0) {
        console.log(`RAG: No relevant documents found for query`);
        return {
          success: true,
          context: '',
          sources: [],
          images: imageResults || []
        };
      }

      // Handle both old and new search result formats
      const actualTextResults = textResults.length > 0 ? textResults : searchResults;

      console.log(`RAG: Found ${actualTextResults.length} text chunks and ${imageResults.length} images`);

      // Temporary debug: Log summaries of retrieved chunks to understand content
      actualTextResults.forEach((result, index) => {
        console.log(`RAG: Chunk ${index + 1} (Score: ${result.score.toFixed(3)}): ${result.content.substring(0, 100).replace(/\n/g, ' ')}...`);
      });

      // For table queries, prioritize chunks that contain table markers
      let results = actualTextResults;
      if (isTableQuery) {
        // Boost scores for chunks that contain table markers
        results = results.map(result => {
          // Check if the chunk contains table markers
          const hasTableMarker = result.content.match(/###\s+(?:Table|Extracted Table)/i);
          
          // If it has a table reference and matches the one in query, boost the score significantly
          if (tableReference && result.content.toLowerCase().includes(tableReference.toLowerCase())) {
            return {
              ...result,
              score: result.score * 1.5, // 50% boost
              containsRequestedTable: true
            };
          } 
          // If it has any table, boost the score slightly
          else if (hasTableMarker) {
            return {
              ...result,
              score: result.score * 1.2, // 20% boost
              containsTable: true
            };
          }
          
          return result;
        });
        
        // Re-sort by the adjusted scores
        results.sort((a, b) => b.score - a.score);
      }

      // Prepare context from retrieved documents
      const context = results
        .map(result => result.content)
        .join('\n\n---\n\n');

      // Format sources for citation
      const sources = results.map(result => ({
        text: result.content.substring(0, 150) + (result.content.length > 150 ? '...' : ''),
        metadata: result.metadata,
        score: result.score,
        containsTable: result.containsTable || false,
        containsRequestedTable: result.containsRequestedTable || false
      }));

      // Process image results for response
      const images = imageResults.map(result => ({
        imageId: result.metadata.imageId,
        base64: result.metadata.base64,
        keywords: result.metadata.keywords,
        page: result.metadata.page,
        filename: result.metadata.filename,
        dimensions: result.metadata.dimensions,
        score: result.score,
        documentId: result.metadata.documentId,
        fileName: result.metadata.fileName
      }));

      return {
        success: true,
        context,
        sources,
        images,
        isTableQuery,
        tableReference
      };
    } catch (error) {
      console.error(`RAG: Error retrieving context:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error retrieving context'
      };
    }
  }

  /**
   * Process a chat message with RAG
   * @param {string} message - User message
   * @param {string} model - LLM model to use
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Chat response with sources
   */
  async processRagChat(message, modelId, options = {}) {
    try {
      const { sessionId, userId } = options;
      
      console.log(`RAG: Processing chat message with RAG: "${message.substring(0, 50)}..." using model ${modelId}`);
      if (sessionId) {
        console.log(`RAG: Using session ID for context filtering: ${sessionId}`);
      }

      // Make sure OllamaService is initialized
      if (!this.initialized) {
        console.log('RAG: OllamaService not initialized, initializing now...');
        await this.initializeServices();

        if (!this.initialized) {
          console.error('RAG: Failed to initialize OllamaService');
          return {
            success: false,
            error: 'Failed to initialize OllamaService'
          };
        }
      }

      // Get context for the query
      const ragResult = await this.retrieveContext(message, {
        ...options,
        model: this.embeddingModel, // Always use embedding model for retrieval
        sessionId  // Explicitly pass sessionId for context filtering
      });

      // If retrieval failed, use regular chat
      if (!ragResult.success) {
        console.log(`RAG: Retrieval failed, falling back to regular chat`);
        // Use a fallback response instead of chat
        return {
          success: true,
          response: {
            choices: [{
              message: {
                role: 'assistant',
                content: `I don't have enough context to answer your question about "${message}". Please try a different question or provide more details.`
              }
            }]
          }
        };
      }

      // If no context found, use regular chat
      if (!ragResult.context) {
        console.log(`RAG: No relevant context found, using regular chat`);
        // Use a fallback response instead of chat
        return {
          success: true,
          response: {
            choices: [{
              message: {
                role: 'assistant',
                content: `I couldn't find relevant information about "${message}" in the available documents. Please try a different question or provide more details.`
              }
            }]
          }
        };
      }

      console.log(`RAG: Using context from ${ragResult.sources.length} sources`);

      // Optimize context length for better LLM processing
      let optimizedContext = ragResult.context;
      const maxContextLength = 8000; // Reasonable limit for most models
      if (optimizedContext.length > maxContextLength) {
        console.log(`RAG: Context too long (${optimizedContext.length} chars), truncating to ${maxContextLength} chars`);
        optimizedContext = optimizedContext.substring(0, maxContextLength) + "\n\n[Context truncated for optimal processing]";
      }

      // Create the prompt with context
      const ragMessages = [
        {
          role: 'system',
          content: `You are an expert Question-Answering assistant. Strictly answer the user's question using ONLY the provided context.
Quote directly from the context when possible.
If the context does not contain the exact answer, but contains related information, use that to provide a relevant response and explain how it connects to the query.
If the context does not contain the answer or relevant information, state clearly that the information is not found in the provided documents.
Do not use general knowledge or infer information beyond the provided text.
Organize your answer clearly. If the question asks about a specific section (e.g., 'section 2.1'), focus your answer on information from chunks related to that section title or content.
Respond with "I couldn't find relevant information about '[user's query]' in the available documents." if the context is empty or not relevant.`
        },
        {
          role: 'user',
          content: `Based on the following context, please answer the question.
Context:
${optimizedContext || "No context provided."}

Question: ${message}`
        }
      ];

      // Use the ollamaService.chat method to generate a response based on the context
      try {
        console.log(`RAG: Calling ollamaService.chat with model: ${modelId}`);
        const chatResult = await this.ollamaService.chat(modelId, ragMessages);

        if (chatResult.success) {
          console.log(`RAG: Successfully generated response using ollamaService.chat`);
          // Add sources and images to the response
          return {
            success: true,
            response: chatResult.response,
            sources: ragResult.sources,
            images: ragResult.images || [],
            context: optimizedContext
          };
        } else {
          console.warn(`RAG: Failed to generate chat response: ${chatResult.error}`);
          // Fall back to the formatter
        }
      } catch (chatError) {
        console.error(`RAG: Error calling ollamaService.chat: ${chatError.message}`);
        // Fall back to the formatter
      }

      // Fallback: Use the formatter to create a response if chat fails
      console.log(`RAG: Using formatter fallback for response`);
      const formattedResponse = formatRagResponse(message, ragResult.sources);

      // Create the response object with the formatted answer
      const chatResponse = {
        success: true,
        response: {
          choices: [{
            message: {
              role: 'assistant',
              content: formattedResponse
            }
          }]
        },
        sources: ragResult.sources,
        images: ragResult.images || [],
        context: optimizedContext
      };

      return chatResponse;
    } catch (error) {
      console.error(`RAG: Error in RAG chat processing:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error in RAG processing'
      };
    }
  }

  /**
   * Check if RAG is available (has documents in vector store)
   * @param {string} userId - Optional user ID for user-specific check
   * @returns {Promise<boolean>} Whether RAG is available
   */
  async isRagAvailable(userId = null) {
    try {
      await this.initializeServices();

      if (!this.vectorStoreService) {
        console.log('RAG: Vector store service not available');
        return false;
      }

      const stats = await this.vectorStoreService.getStats(userId);
      console.log(`RAG: Availability check - Vector store has ${stats.totalChunks} chunks in ${stats.totalDocuments} documents${userId ? ` for user ${userId}` : ''}`);

      const isAvailable = stats.totalChunks > 0;
      
      if (isAvailable) {
        console.log('RAG: All checks passed, RAG is available');
        
        // Notify all users about RAG availability if this is a global check
        if (!userId) {
          this.notifyRagAvailability(true);
        }
      } else {
        console.log('RAG: No documents found in vector store');
        
        // Notify all users if RAG becomes unavailable globally
        if (!userId) {
          this.notifyRagAvailability(false);
        }
      }

      return isAvailable;
    } catch (error) {
      console.error('RAG: Error checking availability:', error);
      return false;
    }
  }

  /**
   * Notify all users about RAG availability change via WebSocket
   * @param {boolean} isAvailable - Whether RAG is available
   */
  notifyRagAvailability(isAvailable) {
    try {
      // Get the WebSocket server from the global app object
      const app = global.app;
      if (app && app.get('wsServer')) {
        const wsServer = app.get('wsServer');
        
        // Broadcast to all connected users
        if (wsServer.broadcast) {
          wsServer.broadcast({
            type: 'rag-availability-changed',
            data: {
              available: isAvailable,
              timestamp: new Date().toISOString()
            }
          });
          
          console.log(`RAG: Notified all users about availability change: ${isAvailable}`);
        }
      }
    } catch (error) {
      console.error('RAG: Error notifying availability change:', error);
    }
  }
}

module.exports = new RAGService();
