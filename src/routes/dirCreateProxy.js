const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const router = express.Router();

// Get configuration
const ini = require('ini');
const fs = require('fs');
const path = require('path');

// Read configuration
const configPath = path.resolve('./conf/config.ini');
const config = ini.parse(fs.readFileSync(configPath, 'utf-8'));

// Determine the target URL for the dir-create service
const dirCreatePort = process.env.DIR_CREATE_PORT || '3582';
let targetUrl;
if (process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true') {
  // In Docker environment, use container name
  targetUrl = `http://dir-create-module:${dirCreatePort}`;
} else {
  // In development, use localhost
  targetUrl = `http://localhost:${dirCreatePort}`;
}

console.log(`Dir-Create proxy configured to forward to: ${targetUrl}`);

// Create proxy middleware
const dirCreateProxy = createProxyMiddleware({
  target: targetUrl,
  changeOrigin: true,
  timeout: 300000, // 5 minutes timeout
  proxyTimeout: 300000, // 5 minutes proxy timeout
  pathRewrite: {
    '^/api/dir-create': '', // Remove /api/dir-create prefix when forwarding
  },
  onError: (err, req, res) => {
    console.error('Dir-Create proxy error:', err.message);
    res.status(503).json({
      success: false,
      error: 'Dir-Create service unavailable',
      message: 'The directory creation service is currently unavailable. Please try again later.'
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${req.method} ${req.path} to dir-create service`);
    
    // Handle body for POST, PUT, and PATCH requests
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`Dir-Create service responded with status: ${proxyRes.statusCode}`);
  }
});

// Apply proxy middleware to all routes
router.use('/', dirCreateProxy);

module.exports = router; 