const express = require('express');
const router = express.Router();
const runStatusDbService = require('../services/runStatusDbService');
const { spawn } = require('child_process');
const path = require('path');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Get connection status and available tables
router.get('/status', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log(`?? /status route called for user ${userId}`);
    
    // Initialize user connection if not already done
    const initResult = await runStatusDbService.initializeUserConnection(userId);
    console.log(`?? Connection initialization result for user ${userId}: ${initResult}`);
    
    const status = runStatusDbService.getConnectionStatusForUser(userId);
    const tablesInfo = runStatusDbService.getTablesForUser(userId, 'simple');
    
    const response = {
      success: true,
      connection: status,
      tables: tablesInfo.tables || [],
      totalTables: tablesInfo.totalTables || 0,
      lastRefresh: tablesInfo.lastRefresh,
      isConnected: status.isConnected || false
    };
    
    console.log(`?? /status route returning for user ${userId}:`, {
      isConnected: response.isConnected,
      totalTables: response.totalTables,
      host: status.host
    });
    
    res.json(response);
  } catch (error) {
    console.error('Error getting Run Status database status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database status',
      details: error.message,
      connection: {
        isConnected: false,
        host: null,
        port: null,
        database: null,
        lastRefresh: null,
        totalTables: 0,
        refreshInterval: 1
      },
      tables: [],
      totalTables: 0,
      lastRefresh: null
    });
  }
});

// Get list of tables (refreshed automatically)
router.get('/tables', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const viewType = req.query.viewType || 'simple'; // Default to simple view
    console.log(`?? /tables route called for user ${userId} with viewType: ${viewType}`);
    
    const tablesInfo = runStatusDbService.getTablesForUser(userId, viewType);
    
    if (!tablesInfo.isConnected) {
      console.log(`?? /tables route: Database not connected for user ${userId}`);
      return res.status(503).json({
        success: false,
        error: 'Database not connected',
        tables: [],
        isConnected: false
      });
    }
    
    const response = {
      success: true,
      tables: tablesInfo.tables,
      totalTables: tablesInfo.totalTables,
      lastRefresh: tablesInfo.lastRefresh,
      isConnected: tablesInfo.isConnected,
      viewType: viewType
    };
    
    console.log(`?? /tables route returning ${response.totalTables} tables for user ${userId} (viewType: ${viewType})`);
    res.json(response);
  } catch (error) {
    console.error('Error getting tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tables',
      details: error.message,
      tables: []
    });
  }
});

// Force refresh tables for current user
router.post('/refresh-tables', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log(`?? Manual table refresh requested for user ${userId}`);
    
    await runStatusDbService.forceRefreshTablesForUser(userId);
    const tablesInfo = runStatusDbService.getTablesForUser(userId, 'simple');
    
    res.json({
      success: true,
      message: 'Tables refreshed successfully',
      tables: tablesInfo.tables,
      totalTables: tablesInfo.totalTables,
      lastRefresh: tablesInfo.lastRefresh
    });
  } catch (error) {
    console.error('Error refreshing tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh tables',
      details: error.message
    });
  }
});

// Alternative refresh endpoint (for compatibility with frontend service)
router.post('/refresh', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log(`?? Manual refresh requested for user ${userId}`);
    
    await runStatusDbService.forceRefreshTablesForUser(userId);
    const tablesInfo = runStatusDbService.getTablesForUser(userId, 'simple');
    
    res.json({
      success: true,
      message: 'Tables refreshed successfully',
      tables: tablesInfo.tables,
      totalTables: tablesInfo.totalTables,
      lastRefresh: tablesInfo.lastRefresh
    });
  } catch (error) {
    console.error('Error refreshing tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh tables',
      details: error.message
    });
  }
});

// Get users who have data in the database
router.get('/users-with-data', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const usersWithData = await runStatusDbService.getUsersWithData(userId);
    
    res.json({
      success: true,
      users: usersWithData
    });
  } catch (error) {
    console.error('Error getting users with data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users with data',
      details: error.message,
      users: []
    });
  }
});

// Get table data preview
router.get('/table/:tableName/preview', isAuthenticated, async (req, res) => {
  try {
    const { tableName } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.session.userId;
    
    const tableData = await runStatusDbService.getTableDataForUser(userId, tableName, limit);
    
    res.json({
      success: true,
      data: tableData
    });
  } catch (error) {
    console.error(`Error getting preview for table ${req.params.tableName}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get table preview',
      details: error.message
    });
  }
});

// Analyze table with Simple Flow
router.post('/analyze-simple/:tableName', isAuthenticated, async (req, res) => {
  try {
    const { tableName } = req.params;
    const userId = req.session.userId;
    
    // Get table data
    const tableData = await runStatusDbService.getTableDataForUser(userId, tableName, 1000);
    
    if (!tableData.data || tableData.data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No data found in table'
      });
    }
    
    // Create temporary CSV file for analysis
    const fs = require('fs');
    const os = require('os');
    const csvPath = path.join(os.tmpdir(), `${tableName}_${Date.now()}.csv`);
    
    // Convert data to CSV
    const headers = tableData.columns;
    const csvContent = [
      headers.join(','),
      ...tableData.data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    
    // Call Python analyzer - using intelligent analyzer
    const pythonPath = path.join(__dirname, '../../python/RUN_STATUS/intelligent_simple_analyzer.py');
    
    console.log('Starting Simple Flow analysis for table:', tableName);
    console.log('Python script path:', pythonPath);
    console.log('CSV file path:', csvPath);
    
    const analysisResult = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [pythonPath, csvPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(csvPath);
        } catch (e) {
          console.warn('Could not delete temp file:', e.message);
        }
        
        console.log('Simple Flow Python script finished with code:', code);
        console.log('Simple Flow stdout:', stdout);
        console.log('Simple Flow stderr:', stderr);
        
        if (code === 0) {
          try {
            if (!stdout.trim()) {
              reject(new Error('Python script returned empty output'));
              return;
            }
            
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            console.error('Failed to parse Simple Flow Python output:', stdout);
            reject(new Error(`Failed to parse analysis result: ${parseError.message}. Raw output: ${stdout.substring(0, 500)}`));
          }
        } else {
          console.error('Simple Flow Python script failed:', stderr);
          reject(new Error(`Analysis failed with code ${code}: ${stderr || 'No error details'}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        console.error('Failed to start Simple Flow Python process:', error);
        reject(new Error(`Failed to start analysis: ${error.message}`));
      });
    });
    
    // Ensure the response has the correct structure
    const responseData = {
      success: true,
      message: 'Simple flow analysis completed',
      flow_data: analysisResult,
      metadata: {
        analyzed_at: new Date().toISOString(),
        analysis_type: 'simple_flow',
        table_name: tableName,
        total_rows_analyzed: tableData.data.length
      }
    };
    
    console.log('Simple Flow analysis response structure:', JSON.stringify(responseData, null, 2));
    res.json(responseData);
    
  } catch (error) {
    console.error(`Error analyzing table ${req.params.tableName}:`, error);
    
    // Fallback: Create a basic flow structure
    try {
      const fallbackResult = createBasicFlowFallback(tableData);
      res.json({
        success: true,
        message: 'Simple flow analysis completed (fallback mode)',
        flow_data: fallbackResult,
        metadata: {
          analyzed_at: new Date().toISOString(),
          analysis_type: 'simple_flow_fallback',
          table_name: req.params.tableName,
          total_rows_analyzed: tableData ? tableData.data.length : 0,
          fallback_mode: true,
          original_error: error.message
        }
      });
    } catch (fallbackError) {
      console.error('Fallback analysis also failed:', fallbackError);
      res.status(500).json({
        success: false,
        error: 'Simple flow analysis failed',
        details: error.message,
        fallback_error: fallbackError.message
      });
    }
  }
});

// Analyze table with Branch Flow
router.post('/analyze-branch/:tableName', isAuthenticated, async (req, res) => {
  try {
    const { tableName } = req.params;
    const userId = req.session.userId;
    
    // Get table data
    const tableData = await runStatusDbService.getTableDataForUser(userId, tableName, 1000);
    
    if (!tableData.data || tableData.data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No data found in table'
      });
    }
    
    // Create temporary CSV file for analysis
    const fs = require('fs');
    const os = require('os');
    const csvPath = path.join(os.tmpdir(), `${tableName}_${Date.now()}.csv`);
    
    // Convert data to CSV
    const headers = tableData.columns;
    const csvContent = [
      headers.join(','),
      ...tableData.data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    
    // Call Python branch analyzer
    const pythonPath = path.join(__dirname, '../../python/RUN_STATUS/branch_analyzer.py');
    
    const analysisResult = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [pythonPath, csvPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(csvPath);
        } catch (e) {
          console.warn('Could not delete temp file:', e.message);
        }
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse analysis result: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Analysis failed with code ${code}: ${stderr}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start analysis: ${error.message}`));
      });
    });
    
    res.json({
      success: true,
      message: 'Branch flow analysis completed',
      branch_data: analysisResult,
      metadata: {
        analyzed_at: new Date().toISOString(),
        analysis_type: 'branch_flow',
        table_name: tableName,
        total_rows_analyzed: tableData.data.length
      }
    });
    
  } catch (error) {
    console.error(`Error analyzing table ${req.params.tableName} with branch flow:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze table with branch flow',
      details: error.message
    });
  }
});

// Analyze table with RTL Flow
router.post('/analyze-rtl/:tableName', isAuthenticated, async (req, res) => {
  try {
    const { tableName } = req.params;
    const userId = req.session.userId;
    
    // Get table data
    const tableData = await runStatusDbService.getTableDataForUser(userId, tableName, 1000);
    
    if (!tableData.data || tableData.data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No data found in table'
      });
    }
    
    // Check if table has RTL_version column
    const hasRtlColumn = tableData.columns.some(col => 
      col.toLowerCase().replace('_', '').replace(' ', '') === 'rtlversion'
    );
    
    if (!hasRtlColumn) {
      return res.status(400).json({
        success: false,
        error: 'Table does not contain RTL_version column required for RTL analysis'
      });
    }
    
    // Create temporary CSV file for analysis
    const fs = require('fs');
    const os = require('os');
    const csvPath = path.join(os.tmpdir(), `${tableName}_${Date.now()}.csv`);
    
    // Convert data to CSV
    const headers = tableData.columns;
    const csvContent = [
      headers.join(','),
      ...tableData.data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent);
    
    // Call Python RTL analyzer
    const pythonPath = path.join(__dirname, '../../python/RUN_STATUS/rtl_analyzer.py');
    
    const analysisResult = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [pythonPath, csvPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          fs.unlinkSync(csvPath);
        } catch (e) {
          console.warn('Could not delete temp file:', e.message);
        }
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse analysis result: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Analysis failed with code ${code}: ${stderr}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start analysis: ${error.message}`));
      });
    });
    
    res.json({
      success: true,
      message: 'RTL flow analysis completed',
      rtl_data: analysisResult,
      metadata: {
        analyzed_at: new Date().toISOString(),
        analysis_type: 'rtl_flow',
        table_name: tableName,
        total_rows_analyzed: tableData.data.length
      }
    });
    
  } catch (error) {
    console.error(`Error analyzing table ${req.params.tableName} with RTL flow:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze table with RTL flow',
      details: error.message
    });
  }
});



// Helper function to create basic flow fallback
function createBasicFlowFallback(tableData) {
  if (!tableData || !tableData.data || tableData.data.length === 0) {
    return {
      nodes: [],
      connections: [],
      layout: { width: 800, height: 600, background: { color: '#ffffff' } },
      config: { node_width: 160, node_height: 70, font_size: 12 },
      metadata: { total_steps: 0, analysis_type: 'empty_fallback' }
    };
  }
  
  const { data, columns } = tableData;
  
  // Create simple nodes from first few rows
  const nodes = data.slice(0, 10).map((row, index) => {
    const label = row[columns[0]] || `Step ${index + 1}`;
    const status = row[columns[columns.length - 1]] || 'unknown';
    
    return {
      id: `node_${index}`,
      label: String(label).substring(0, 20),
      type: 'process',
      status: String(status).toLowerCase(),
      x: 100 + (index % 3) * 200,
      y: 100 + Math.floor(index / 3) * 100,
      style: {
        width: 160,
        height: 70,
        backgroundColor: status.toLowerCase() === 'completed' ? '#28a745' : 
                        status.toLowerCase() === 'failed' ? '#dc3545' : '#6c757d',
        color: '#ffffff',
        borderRadius: 8,
        fontSize: 12,
        border: '2px solid #dee2e6'
      }
    };
  });
  
  // Create simple sequential connections
  const connections = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    connections.push({
      from: `node_${i}`,
      to: `node_${i + 1}`,
      type: 'straight',
      style: {
        stroke: '#495057',
        strokeWidth: 2,
        arrowSize: 8,
        opacity: 0.8
      }
    });
  }
  
  return {
    nodes,
    connections,
    layout: {
      width: 800,
      height: Math.max(400, Math.ceil(nodes.length / 3) * 100 + 200),
      background: { 
        color: '#ffffff',
        gridSize: 20,
        gridColor: '#f0f0f0',
        gridOpacity: 0.5
      }
    },
    config: {
      node_width: 160,
      node_height: 70,
      font_size: 12,
      grid_size: 20,
      fallback_mode: true
    },
    metadata: {
      total_steps: nodes.length,
      analysis_type: 'basic_fallback',
      completed_steps: nodes.filter(n => n.status === 'completed').length,
      failed_steps: nodes.filter(n => n.status === 'failed').length,
      running_steps: nodes.filter(n => n.status === 'running').length,
      pending_steps: nodes.filter(n => !['completed', 'failed', 'running'].includes(n.status)).length
    }
  };
}

// Force refresh tables for user
router.post('/refresh', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Refresh tables for the user
    await runStatusDbService.refreshTablesForUser(userId);
    
    const tablesInfo = runStatusDbService.getTablesForUser(userId, 'simple');
    
    res.json({
      success: true,
      message: 'Tables refreshed successfully',
      tables: tablesInfo.tables,
      totalTables: tablesInfo.totalTables,
      lastRefresh: tablesInfo.lastRefresh
    });
  } catch (error) {
    console.error('Error refreshing tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh tables',
      details: error.message
    });
  }
});

// Check specific table data for current user (debugging)
router.get('/check-table/:tableName', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    const tableName = req.params.tableName;
    
    console.log(`?? Checking table ${tableName} for user ${userId}`);
    const result = await runStatusDbService.checkTableDataForUser(userId, tableName);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error checking table data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check table data',
      details: error.message
    });
  }
});

// Debug endpoint to show connection and filtering details
router.get('/debug', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    // Get user info
    const userInfo = await runStatusDbService.getUserInfo(userId);
    const tablesInfo = runStatusDbService.getTablesForUser(userId, 'simple');
    const connectionStatus = runStatusDbService.getConnectionStatusForUser(userId);
    
    res.json({
      success: true,
      debug: {
        userId,
        userInfo,
        connectionStatus,
        tablesInfo: {
          totalTables: tablesInfo.totalTables,
          isConnected: tablesInfo.isConnected,
          lastRefresh: tablesInfo.lastRefresh,
          tables: tablesInfo.tables.map(t => ({
            table_name: t.table_name,
            row_count: t.row_count,
            schema_name: t.schema_name
          }))
        },
        dockerEnvironment: process.env.NODE_ENV === 'production' || process.env.DATABASE_HOST,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting debug info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get debug info',
      details: error.message
    });
  }
});

module.exports = router;