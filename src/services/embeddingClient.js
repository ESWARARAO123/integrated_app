/**
 * Embedding Service Client
 * Handles communication with the dedicated embedding microservice
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const ini = require('ini');
const { logger } = require('../utils/logger');

// Load configuration from config.ini
function loadConfig() {
  try {
    const configPath = path.resolve(process.cwd(), './conf/config.ini');
    if (fs.existsSync(configPath)) {
      const config = ini.parse(fs.readFileSync(configPath, 'utf-8'));
      return config;
    }
    console.warn('Config file not found, using defaults');
    return {};
  } catch (error) {
    console.warn('Error reading config file:', error);
    return {};
  }
}

class EmbeddingClient {
  constructor(config = {}) {
    // Load configuration from config.ini
    const appConfig = loadConfig();
    const embeddingConfig = appConfig.embedding_service || {};

    // Build service URL from config
    const protocol = embeddingConfig.protocol || 'http';
    const host = embeddingConfig.host || 'localhost';
    const port = embeddingConfig.port || 3579;
    
    this.serviceUrl = config.embeddingServiceUrl || 
                     process.env.EMBEDDING_SERVICE_URL || 
                     `${protocol}://${host}:${port}`;

    this.timeout = config.timeout || embeddingConfig.connection_timeout || 120000; // 2 minutes default
    this.retries = config.retries || 3;
    this.retryDelay = config.retryDelay || 1000; // 1 second

    logger.info(`Embedding Client initialized with service URL: ${this.serviceUrl}`);
    logger.info(`Timeout: ${this.timeout}ms, Retries: ${this.retries}`);
    
    // Create axios client
    this.client = axios.create({
      baseURL: this.serviceUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Embedding service request failed:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if the embedding service is healthy
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await this.client.get('/health');
      return {
        success: true,
        ...response.data
      };
    } catch (error) {
      logger.error('Embedding service health check failed:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'embedding-service'
      };
    }
  }

  /**
   * Get configuration from the embedding service
   * @returns {Promise<Object>} Configuration
   */
  async getConfig() {
    try {
      const response = await this.client.get('/api/config');
      return response.data;
    } catch (error) {
      logger.error('Error getting embedding service config:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate embedding for a single text
   * @param {string} text - Text to embed
   * @param {string} model - Model to use (optional)
   * @returns {Promise<Object>} Embedding result
   */
  async generateEmbedding(text, model = 'nomic-embed-text') {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Invalid text input for embedding generation');
      }

      const response = await this.client.post('/api/embeddings/single', {
        text,
        model
      });

      if (response.data.success) {
        return {
          success: true,
          embedding: response.data.embedding,
          model: response.data.model,
          dimensions: response.data.dimensions,
          cached: response.data.cached || false
        };
      } else {
        throw new Error(response.data.error || 'Unknown error from embedding service');
      }
    } catch (error) {
      logger.error('Error generating single embedding:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param {Array<string>} texts - Array of texts to embed
   * @param {string} model - Model to use (optional)
   * @param {number} batchSize - Batch size for processing (optional)
   * @returns {Promise<Object>} Batch embedding result
   */
  async generateBatchEmbeddings(texts, model = 'nomic-embed-text', batchSize = 50) {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Invalid texts input for batch embedding generation');
      }

      logger.info(`Requesting embeddings for ${texts.length} texts using embedding service at ${this.serviceUrl}`);

      const response = await this.client.post('/api/embeddings/batch', {
        texts,
        model,
        batchSize
      });

      if (response.data.success) {
        logger.info(`Successfully generated ${response.data.successful} embeddings, ${response.data.cacheHits || 0} cache hits`);
        return {
          success: true,
          embeddings: response.data.embeddings,
          total: response.data.total,
          successful: response.data.successful,
          failed: response.data.failed,
          cacheHits: response.data.cacheHits,
          failures: response.data.failures
        };
      } else {
        throw new Error(response.data.error || 'Unknown error from embedding service');
      }
    } catch (error) {
      logger.error('Error generating batch embeddings:', error.message);
      
      // If the service is completely unavailable, try fallback
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.warn('Embedding service unavailable, attempting fallback...');
        return await this.fallbackToDirectOllama(texts, model);
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fallback to direct Ollama communication if service is unavailable
   * @param {Array<string>} texts - Texts to embed
   * @param {string} model - Model to use
   * @returns {Promise<Object>} Fallback embedding result
   */
  async fallbackToDirectOllama(texts, model = 'nomic-embed-text') {
    try {
      logger.warn('Using direct Ollama fallback for embedding generation');
      
      // Import OllamaService dynamically to avoid circular dependencies
      const OllamaService = require('./ollamaService');
      const ollamaService = new OllamaService();
      
      // Use the existing generateBatchEmbeddings method
      const result = await ollamaService.generateBatchEmbeddings(texts, model);
      
      if (result.success) {
        logger.info(`Fallback successful: generated ${result.embeddings.length} embeddings`);
        return {
          success: true,
          embeddings: result.embeddings,
          total: texts.length,
          successful: result.embeddings.length,
          failed: texts.length - result.embeddings.length,
          fallback: true
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error('Fallback to direct Ollama failed:', error.message);
      return {
        success: false,
        error: `Embedding service unavailable and fallback failed: ${error.message}`,
        fallback: true
      };
    }
  }

  /**
   * Get cache statistics from the embedding service
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      const response = await this.client.get('/api/cache/stats');
      return response.data;
    } catch (error) {
      logger.error('Error getting cache stats:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear the embedding cache
   * @returns {Promise<Object>} Clear cache result
   */
  async clearCache() {
    try {
      const response = await this.client.delete('/api/cache/clear');
      return response.data;
    } catch (error) {
      logger.error('Error clearing cache:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retry mechanism for failed requests
   * @param {Function} operation - Operation to retry
   * @param {number} retries - Number of retries remaining
   * @returns {Promise<any>} Operation result
   */
  async withRetry(operation, retries = this.retries) {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0 && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
        logger.warn(`Retrying operation, ${retries} attempts remaining`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.withRetry(operation, retries - 1);
      }
      throw error;
    }
  }
}

module.exports = EmbeddingClient; 