const express = require('express');
const router = express.Router();
const predictionDbService = require('../services/predictionDbService');
const pythonServiceDiagnostic = require('../utils/pythonServiceDiagnostic');

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
};

// Get prediction database configuration
router.get('/config', isAuthenticated, async (req, res) => {
  try {
    console.log('Getting prediction database config for user:', req.session.userId);
    
    const config = predictionDbService.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error getting prediction database config:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get prediction database configuration' 
    });
  }
});

// Save prediction database configuration - redirected to settings route
// Use POST /settings/prediction-db-config instead

// Get prediction database connection status
router.get('/status', isAuthenticated, async (req, res) => {
  try {
    console.log('Getting prediction database status for user:', req.session.userId);
    
    const status = predictionDbService.getConnectionStatus();
    res.json({ success: true, connection: status });
  } catch (error) {
    console.error('Error getting prediction database status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get prediction database status' 
    });
  }
});

// Get prediction database tables
router.get('/tables', isAuthenticated, async (req, res) => {
  try {
    console.log('Getting prediction database tables for user:', req.session.userId);
    
    const tables = predictionDbService.getTables();
    res.json({ success: true, ...tables });
  } catch (error) {
    console.error('Error getting prediction database tables:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get prediction database tables' 
    });
  }
});

// Get enhanced prediction database tables with training set analysis
router.get('/tables/enhanced', isAuthenticated, async (req, res) => {
  try {
    console.log('Getting enhanced prediction database tables for user:', req.session.userId);
    
    const enhancedTables = predictionDbService.getEnhancedTables();
    res.json(enhancedTables);
  } catch (error) {
    console.error('Error getting enhanced prediction database tables:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to get enhanced prediction database tables',
      error: error.message
    });
  }
});

// Get table data
router.get('/tables/:tableName/data', isAuthenticated, async (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    
    console.log(`Getting data for table ${tableName} for user:`, req.session.userId);
    
    const tableData = await predictionDbService.getTableData(tableName, limit);
    res.json({ success: true, ...tableData });
  } catch (error) {
    console.error(`Error getting table data for ${req.params.tableName}:`, error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to get data for table ${req.params.tableName}` 
    });
  }
});

// Disconnect from prediction database
router.post('/disconnect', isAuthenticated, async (req, res) => {
  try {
    console.log('Disconnecting prediction database for user:', req.session.userId);
    
    const success = await predictionDbService.disconnect();
    
    if (success) {
      res.json({ success: true, message: 'Successfully disconnected from prediction database' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to disconnect from prediction database' });
    }
  } catch (error) {
    console.error('Error disconnecting prediction database:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to disconnect from prediction database' 
    });
  }
});

// Refresh tables
router.post('/refresh', isAuthenticated, async (req, res) => {
  try {
    console.log('Refreshing prediction database tables for user:', req.session.userId);
    
    await predictionDbService.refreshTables();
    const tables = predictionDbService.getTables();
    
    res.json({ success: true, message: 'Tables refreshed successfully', ...tables });
  } catch (error) {
    console.error('Error refreshing prediction database tables:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to refresh prediction database tables' 
    });
  }
});

// Train model
router.post('/train', isAuthenticated, async (req, res) => {
  try {
    const { place_table, cts_table, route_table } = req.body;
    
    console.log('Training model for user:', req.session.userId);
    console.log('Training with tables:', { place_table, cts_table, route_table });
    
    if (!place_table || !cts_table) {
      return res.status(400).json({
        success: false,
        error: 'place_table and cts_table are required'
      });
    }
    
    const result = await predictionDbService.trainModel(place_table, cts_table, route_table);
    res.json(result);
  } catch (error) {
    console.error('Error training model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to train model: ' + error.message
    });
  }
});



// Train model with specified tables
router.post('/train', isAuthenticated, async (req, res) => {
  try {
    const { place_table, cts_table, route_table } = req.body;
    console.log(`Training model for user ${req.session.userId} with tables:`, { place_table, cts_table, route_table });
    
    if (!place_table || !cts_table || !route_table) {
      return res.status(400).json({
        success: false,
        error: 'All three tables (place_table, cts_table, route_table) are required'
      });
    }

    // Forward request to Python prediction service
    const axios = require('axios');
    const pythonResponse = await axios.post('http://127.0.0.1:8088/train', {
      place_table,
      cts_table,
      route_table
    });

    res.json({
      success: true,
      ...pythonResponse.data
    });
  } catch (error) {
    console.error('Error training model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to train model',
      details: error.message
    });
  }
});

// Make predictions with specified tables - now supports single table prediction
router.post('/predict', isAuthenticated, async (req, res) => {
  try {
    const { place_table, cts_table } = req.body;
    console.log(`Making predictions for user ${req.session.userId} with tables:`, { place_table, cts_table });
    
    // At least one table must be provided
    if (!place_table && !cts_table) {
      return res.status(400).json({
        success: false,
        error: 'At least one table (place_table or cts_table) is required for prediction'
      });
    }

    // Forward request to Python prediction service
    const axios = require('axios');
    const requestBody = {};
    if (place_table) requestBody.place_table = place_table;
    if (cts_table) requestBody.cts_table = cts_table;
    
    const pythonResponse = await axios.post('http://127.0.0.1:8088/slack-prediction/predict', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-username': 'default'
      }
    });

    res.json({
      success: true,
      ...pythonResponse.data
    });
  } catch (error) {
    console.error('Error making predictions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to make predictions',
      details: error.message
    });
  }
});

// Get training progress/status
router.get('/training-status', isAuthenticated, async (req, res) => {
  try {
    console.log(`Getting training status for user ${req.session.userId}`);
    
    // Forward request to Python prediction service
    const axios = require('axios');
    const pythonResponse = await axios.get('http://127.0.0.1:8088/training-status');

    res.json({
      success: true,
      ...pythonResponse.data
    });
  } catch (error) {
    console.error('Error getting training status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get training status',
      details: error.message
    });
  }
});

// Receive training status updates from Python service
router.post('/training-status-update', async (req, res) => {
  try {
    const statusUpdate = req.body;
    console.log('Received training status update:', statusUpdate);
    
    // Broadcast to WebSocket clients if available
    if (global.websocketService) {
      global.websocketService.broadcast('training-status', statusUpdate);
    }
    
    res.json({ success: true, message: 'Status update received' });
  } catch (error) {
    console.error('Error handling training status update:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle training status update'
    });
  }
});

// Download prediction results as CSV
router.get('/results/download', isAuthenticated, async (req, res) => {
  try {
    const { beginpoint, endpoint, limit = 1000 } = req.query;
    console.log(`Downloading prediction results for user ${req.session.userId}`);
    
    // Forward request to Python prediction service
    const axios = require('axios');
    let url = `http://127.0.0.1:8088/results/download?limit=${limit}`;
    
    if (beginpoint) url += `&beginpoint=${encodeURIComponent(beginpoint)}`;
    if (endpoint) url += `&endpoint=${encodeURIComponent(endpoint)}`;
    
    const pythonResponse = await axios.get(url, {
      responseType: 'stream'
    });
    
    // Set appropriate headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="prediction_results.csv"');
    
    // Pipe the response
    pythonResponse.data.pipe(res);
  } catch (error) {
    console.error('Error downloading prediction results:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download prediction results',
      details: error.message
    });
  }
});

// Python service diagnostic endpoint
router.get('/diagnostic', isAuthenticated, async (req, res) => {
  try {
    console.log(`Running Python service diagnostic for user ${req.session.userId}`);
    const report = await pythonServiceDiagnostic.generateReport();
    
    res.json({
      success: true,
      diagnostic: report
    });
  } catch (error) {
    console.error('Error running Python service diagnostic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run diagnostic',
      details: error.message
    });
  }
});

module.exports = router;