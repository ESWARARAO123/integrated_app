const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Redis = require('redis');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const ini = require('ini');
const { logger } = require('../../utils/logger');

const app = express();

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

const config = loadConfig();
const embeddingConfig = config.embedding_service || {};
const redisConfig = config.redis || {};

// Configuration from config.ini with fallbacks
const PORT = embeddingConfig.port || process.env.EMBEDDING_SERVICE_PORT || 3579;
const CACHE_TTL = embeddingConfig.cache_ttl_seconds || 3600;
const RATE_LIMIT_REQUESTS = embeddingConfig.rate_limit_requests || 1000;
const RATE_LIMIT_WINDOW = embeddingConfig.rate_limit_window_minutes || 15;
const BATCH_SIZE = embeddingConfig.batch_size || 50;
const MAX_BATCH_SIZE = embeddingConfig.max_batch_size || 1000;

logger.info('Embedding Service Configuration:', {
  port: PORT,
  cache_ttl: CACHE_TTL,
  rate_limit: `${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW} minutes`,
  batch_size: BATCH_SIZE,
  max_batch_size: MAX_BATCH_SIZE
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rate limiting from config
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW * 60 * 1000, // Convert minutes to milliseconds
  max: RATE_LIMIT_REQUESTS,
  message: `Too many embedding requests from this IP. Limit: ${RATE_LIMIT_REQUESTS} requests per ${RATE_LIMIT_WINDOW} minutes`
});
app.use(limiter);

// Redis client for caching
let redisClient;
const initRedis = async () => {
  try {
    // Use Redis configuration from config.ini
    const redisHost = redisConfig.host || process.env.REDIS_HOST || 'localhost';
    const redisPort = redisConfig.port || process.env.REDIS_PORT || 6379;
    const redisPassword = redisConfig.password || process.env.REDIS_PASSWORD || undefined;

    redisClient = Redis.createClient({
      host: redisHost,
      port: redisPort,
      password: redisPassword || undefined
    });
    
    await redisClient.connect();
    logger.info(`Redis connected for embedding service: ${redisHost}:${redisPort}`);
  } catch (error) {
    logger.warn('Redis connection failed, running without cache:', error.message);
    redisClient = null;
  }
};

// Ollama configuration - Using localhost only as specified
const OLLAMA_HOST = embeddingConfig.ollama_host || 'localhost';
const OLLAMA_PORT = embeddingConfig.ollama_port || 11434;

const OLLAMA_CONFIG = {
  host: OLLAMA_HOST,
  port: OLLAMA_PORT,
  weight: 1
};

logger.info(`Embedding Service will use Ollama at: ${OLLAMA_HOST}:${OLLAMA_PORT}`);

// Create Ollama client
const createOllamaClient = () => {
  return axios.create({
    baseURL: `http://${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}`,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

// Generate cache key for embeddings
const generateCacheKey = (text, model) => {
  const hash = crypto.createHash('sha256').update(`${text}:${model}`).digest('hex');
  return `embedding:${hash}`;
};

// Generate single embedding
const generateEmbedding = async (text, model = 'nomic-embed-text') => {
  try {
    // Check cache first if enabled
    if (redisClient && embeddingConfig.cache_enabled !== 'false') {
      const cacheKey = generateCacheKey(text, model);
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit for embedding');
        return {
          success: true,
          embedding: JSON.parse(cached),
          cached: true
        };
      }
    }

    // Generate embedding using localhost Ollama
    const client = createOllamaClient();

    logger.debug(`Generating embedding using ${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port} with model: ${model}`);

    const response = await client.post('/api/embeddings', {
      model,
      prompt: text
    });

    if (response.data && response.data.embedding) {
      const embedding = response.data.embedding;

      // Cache the result if caching is enabled
      if (redisClient && embeddingConfig.cache_enabled !== 'false') {
        const cacheKey = generateCacheKey(text, model);
        await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(embedding));
      }

      return {
        success: true,
        embedding,
        cached: false,
        model,
        dimensions: embedding.length
      };
    } else {
      throw new Error('Invalid response from Ollama embeddings API');
    }
  } catch (error) {
    logger.error('Error generating embedding:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Generate batch embeddings with parallel processing
const generateBatchEmbeddings = async (texts, model = 'nomic-embed-text', batchSize = BATCH_SIZE) => {
  try {
    const results = [];
    const totalTexts = texts.length;
    let cacheHits = 0;

    logger.info(`Generating embeddings for ${totalTexts} texts in batches of ${batchSize} using model: ${model}`);

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      // Process batch in parallel with controlled concurrency
      const batchPromises = batch.map(async (text, index) => {
        const result = await generateEmbedding(text, model);
        if (result.cached) cacheHits++;
        return {
          index: i + index,
          ...result
        };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid overwhelming Ollama
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
    }

    // Extract embeddings and check for failures
    const embeddings = [];
    const failures = [];

    for (const result of results) {
      if (result.success && result.embedding) {
        embeddings.push(result.embedding);
      } else {
        failures.push({
          index: result.index,
          error: result.error
        });
      }
    }

    logger.info(`Batch embedding complete: ${embeddings.length} successful, ${failures.length} failed, ${cacheHits} cache hits`);

    return {
      success: failures.length === 0,
      embeddings,
      total: totalTexts,
      successful: embeddings.length,
      failed: failures.length,
      cacheHits,
      failures: failures.length > 0 ? failures : undefined
    };

  } catch (error) {
    logger.error('Error in batch embedding generation:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'embedding-service',
    port: PORT,
    redis: redisClient ? 'connected' : 'disconnected',
    ollama_host: `${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}`,
    cache_enabled: embeddingConfig.cache_enabled !== 'false',
    config_loaded: true
  });
});

app.post('/api/embeddings/single', async (req, res) => {
  try {
    const { text, model } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid text input'
      });
    }

    const result = await generateEmbedding(text, model);
    res.json(result);
  } catch (error) {
    logger.error('Error in single embedding endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

app.post('/api/embeddings/batch', async (req, res) => {
  try {
    const { texts, model, batchSize } = req.body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid texts array'
      });
    }

    if (texts.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        error: `Too many texts. Maximum ${MAX_BATCH_SIZE} per request.`
      });
    }

    const result = await generateBatchEmbeddings(texts, model, batchSize);
    res.json(result);
  } catch (error) {
    logger.error('Error in batch embedding endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Cache management endpoints
app.delete('/api/cache/clear', async (req, res) => {
  try {
    if (redisClient) {
      // Clear only embedding cache keys
      const keys = await redisClient.keys('embedding:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      res.json({
        success: true,
        message: `Cleared ${keys.length} cached embeddings`
      });
    } else {
      res.json({
        success: true,
        message: 'No cache to clear (Redis not connected)'
      });
    }
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

app.get('/api/cache/stats', async (req, res) => {
  try {
    if (redisClient) {
      const keys = await redisClient.keys('embedding:*');
      const info = await redisClient.info('memory');
      res.json({
        success: true,
        cached_embeddings: keys.length,
        cache_ttl_seconds: CACHE_TTL,
        redis_memory: info
      });
    } else {
      res.json({
        success: true,
        message: 'Redis not connected',
        cached_embeddings: 0
      });
    }
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

// Configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: {
      port: PORT,
      ollama: {
        host: OLLAMA_CONFIG.host,
        port: OLLAMA_CONFIG.port
      },
      cache: {
        enabled: embeddingConfig.cache_enabled !== 'false',
        ttl_seconds: CACHE_TTL
      },
      rate_limit: {
        requests: RATE_LIMIT_REQUESTS,
        window_minutes: RATE_LIMIT_WINDOW
      },
      batch: {
        default_size: BATCH_SIZE,
        max_size: MAX_BATCH_SIZE
      }
    }
  });
});

// Start server
const startServer = async () => {
  try {
    await initRedis();
    
    app.listen(PORT, () => {
      logger.info(`Embedding service running on port ${PORT}`);
      logger.info(`Using Ollama at: ${OLLAMA_CONFIG.host}:${OLLAMA_CONFIG.port}`);
      logger.info(`Redis caching: ${redisClient ? 'enabled' : 'disabled'}`);
      logger.info(`Configuration loaded from: ./conf/config.ini`);
    });
  } catch (error) {
    logger.error('Failed to start embedding service:', error);
    process.exit(1);
  }
};

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

startServer(); 