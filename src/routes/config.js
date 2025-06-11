const express = require('express');
const router = express.Router();
const ConfigValidationService = require('../services/configValidationService');

/**
 * Configuration API routes
 * Provides frontend configuration for the client application
 */
module.exports = function(config) {
  // Simple test endpoint
  router.get('/test', (req, res) => {
    res.json({ message: 'Config routes are working!', timestamp: new Date().toISOString() });
  });

  // Return frontend configuration to the client
  router.get('/frontend-config', (req, res) => {
    try {
      console.log('=== Frontend Config Debug ===');
      console.log('Full config object keys:', Object.keys(config));
      console.log('Config type:', typeof config);
      console.log('Chat2SQL section exists:', !!config.chat2sql);
      console.log('Chat2SQL config:', config.chat2sql);
      console.log('Frontend section:', config.frontend);

      // Get Chat2SQL configuration - config is the parsed INI object
      const chat2sqlConfig = config.chat2sql || {};
      const chat2sqlUrl = `${chat2sqlConfig.protocol || 'http'}://${chat2sqlConfig.host || 'localhost'}:${chat2sqlConfig.port || '5000'}`;

      // Send only configuration that should be available to the frontend
      const frontendConfig = {
        title: config.frontend?.app_title || 'Product Demo',
        appName: config.frontend?.app_name || 'Product Demo',
        apiUrl: config.frontend?.api_url || '/api',
        defaultTheme: config.frontend?.default_theme || 'light',
        chat2sqlUrl: chat2sqlUrl
      };

      console.log('Constructed Chat2SQL URL:', chat2sqlUrl);
      console.log('Sending frontend config:', frontendConfig);
      console.log('=== End Debug ===');

      res.setHeader('Content-Type', 'application/json');
      res.json(frontendConfig);
    } catch (error) {
      console.error('Error in frontend-config route:', error);
      res.status(500).json({ error: 'Configuration error', details: error.message });
    }
  });

  // Return port mappings and service URLs (for development/debugging)
  router.get('/ports', async (req, res) => {
    try {
      const configService = new ConfigValidationService();
      await configService.validateConfiguration();
      const portMappings = configService.getPortMappings();

      res.json({
        success: true,
        ports: portMappings,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get port configuration',
        details: error.message
      });
    }
  });

  // Return validated configuration (admin only - sensitive data)
  router.get('/validated', async (req, res) => {
    try {
      // Basic auth check - in production you'd want proper admin authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer admin-')) {
        return res.status(401).json({
          success: false,
          error: 'Admin authentication required'
        });
      }

      const configService = new ConfigValidationService();
      const validatedConfig = await configService.validateConfiguration();

      // Remove sensitive information before sending
      const safeConfig = {
        ...validatedConfig,
        database: {
          ...validatedConfig.database,
          password: '***REDACTED***'
        }
      };

      res.json({
        success: true,
        config: safeConfig,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to validate configuration',
        details: error.message
      });
    }
  });

  // Health check endpoint that includes service connectivity
  router.get('/health', async (req, res) => {
    try {
      const configService = new ConfigValidationService();
      const validatedConfig = await configService.validateConfiguration();

      // Basic connectivity checks
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          server: {
            status: 'running',
            port: validatedConfig.server.port,
            url: validatedConfig.server.baseUrl
          },
          chromadb: {
            status: 'configured',
            port: validatedConfig.docker.chromadb.port,
            url: validatedConfig.docker.chromadb.url
          },
          redis: {
            status: 'configured',
            port: validatedConfig.redis.port,
            host: validatedConfig.redis.host
          },
          ollama: {
            status: 'configured',
            port: validatedConfig.ollama.port,
            url: validatedConfig.ollama.baseUrl
          }
        }
      };

      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
};