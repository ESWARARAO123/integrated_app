const express = require('express');
const router = express.Router();
const axios = require('axios');

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
};

/**
 * CSV Download Routes
 * Centralized handling of CSV downloads from various sources
 */

// Download prediction results as CSV
router.get('/prediction-results', isAuthenticated, async (req, res) => {
  try {
    const { beginpoint, endpoint, limit = 1000, format = 'csv' } = req.query;
    const userId = req.session.userId;
    
    console.log(`Downloading prediction results as CSV for user ${userId}`);
    
    // Forward request to Python prediction service
    const PYTHON_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://127.0.0.1:8088';
    let url = `${PYTHON_SERVICE_URL}/results/download?limit=${limit}&format=${format}`;
    
    if (beginpoint) url += `&beginpoint=${encodeURIComponent(beginpoint)}`;
    if (endpoint) url += `&endpoint=${encodeURIComponent(endpoint)}`;
    
    const pythonResponse = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'x-username': req.session.username || 'default'
      }
    });
    
    // Set appropriate headers for CSV download
    const filename = `prediction_results_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe the response
    pythonResponse.data.pipe(res);
    
  } catch (error) {
    console.error('Error downloading prediction results CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download prediction results CSV',
      details: error.message
    });
  }
});

// Download table data as CSV (generic table export)
router.get('/table-data/:tableName', isAuthenticated, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 1000, source = 'prediction' } = req.query;
    const userId = req.session.userId;
    
    console.log(`Downloading table data as CSV for user ${userId}, table: ${tableName}, source: ${source}`);
    
    let tableData;
    
    // Get table data based on source
    if (source === 'prediction') {
      const predictionDbService = require('../services/predictionDbService');
      tableData = await predictionDbService.getTableData(tableName, parseInt(limit));
    } else if (source === 'runstatus') {
      const runStatusDbService = require('../services/runStatusDbService');
      tableData = await runStatusDbService.getTableDataForUser(userId, tableName, parseInt(limit));
    } else {
      throw new Error(`Unsupported data source: ${source}`);
    }
    
    if (!tableData || !tableData.data || tableData.data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No data found for the specified table'
      });
    }
    
    // Convert to CSV
    const csvContent = convertToCSV(tableData);
    
    // Set appropriate headers
    const filename = `${tableName}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send CSV content
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error downloading table data CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download table data CSV',
      details: error.message
    });
  }
});

// Download chat predictions as CSV
router.post('/chat-predictions', isAuthenticated, async (req, res) => {
  try {
    const { predictions, filename } = req.body;
    
    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No prediction data provided'
      });
    }
    
    console.log(`Generating CSV for chat predictions, count: ${predictions.length}`);
    
    // Define headers based on prediction structure
    const headers = ['Startpoint', 'Endpoint', 'Place Slack', 'CTS Slack', 'Predicted Route Slack'];
    
    // Create CSV content
    const csvRows = [headers.join(',')];
    
    predictions.forEach(prediction => {
      const row = [
        `"${prediction.startpoint || prediction.beginpoint || ''}"`,
        `"${prediction.endpoint || ''}"`,
        prediction.place_slack || '',
        prediction.cts_slack || '',
        prediction.predicted_route_slack || ''
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    
    // Set appropriate headers
    const downloadFilename = filename || `chat_predictions_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    
    // Send CSV content
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error generating chat predictions CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate chat predictions CSV',
      details: error.message
    });
  }
});

// Generic CSV generator endpoint
router.post('/generate', isAuthenticated, async (req, res) => {
  try {
    const { data, filename, headers } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No data provided'
      });
    }
    
    console.log(`Generating generic CSV, rows: ${data.length}`);
    
    // Convert to CSV
    const csvContent = convertArrayToCSV(data, headers);
    
    // Set appropriate headers
    const downloadFilename = filename || `export_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    
    // Send CSV content
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate CSV',
      details: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'CSV Download Service',
    timestamp: new Date().toISOString()
  });
});

// Helper function to convert table data to CSV
function convertToCSV(tableData) {
  if (!tableData || !tableData.data || tableData.data.length === 0) {
    return '';
  }
  
  const headers = tableData.columns || Object.keys(tableData.data[0]);
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  tableData.data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      
      // Handle null/undefined values
      if (value === null || value === undefined) {
        return '';
      }
      
      // Convert to string and escape if necessary
      const stringValue = String(value);
      
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    });
    
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

// Helper function to convert array to CSV
function convertArrayToCSV(data, customHeaders = null) {
  if (!data || data.length === 0) {
    return '';
  }
  
  const headers = customHeaders || Object.keys(data[0]);
  const csvRows = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      
      // Handle null/undefined values
      if (value === null || value === undefined) {
        return '';
      }
      
      // Convert to string and escape if necessary
      const stringValue = String(value);
      
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    });
    
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}

module.exports = router; 