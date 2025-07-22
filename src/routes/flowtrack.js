const express = require('express');
const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const router = express.Router();

// Get runstatus service URL from environment or default
const RUNSTATUS_URL = process.env.RUNSTATUS_URL || 'http://localhost:5003';

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Resolve host for Docker environment with multiple fallback strategies
const resolveHostForDocker = (host) => {
  // Enhanced Docker detection - check multiple indicators
  const isDocker = process.env.NODE_ENV === 'production' || 
                   process.env.DATABASE_HOST || 
                   process.env.DOCKER_ENV ||
                   process.env.CONTAINER_ENV ||
                   (process.env.HOSTNAME && process.env.HOSTNAME.length === 12); // Docker container hostnames are typically 12 chars
  
  // Get the best fallback host with multiple strategies
  const getBestFallbackHost = () => {
    // 1. Use explicitly set DATABASE_HOST
    if (process.env.DATABASE_HOST) {
      return process.env.DATABASE_HOST;
    }
    
    // 2. Try to detect Docker gateway IP
    try {
      const fs = require('fs');
      const os = require('os');
      
      // Check if we're in a Docker container by looking for .dockerenv
      if (fs.existsSync('/.dockerenv')) {
        // Try to get the default gateway (Docker host) IP
        const networkInterfaces = os.networkInterfaces();
        for (const interfaceName in networkInterfaces) {
          const interfaces = networkInterfaces[interfaceName];
          for (const iface of interfaces) {
            if (iface.family === 'IPv4' && !iface.internal) {
              // Calculate gateway IP (usually .1 in the subnet)
              const ipParts = iface.address.split('.');
              const gatewayIP = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1`;
              console.log(`?? Docker: Detected container, using gateway IP: ${gatewayIP}`);
              return gatewayIP;
            }
          }
        }
      }
    } catch (error) {
      console.log(`?? Could not detect Docker gateway IP: ${error.message}`);
    }
    
    // 3. Try common Docker host IPs
    const commonDockerHosts = [
      '172.17.0.1',    // Default Docker bridge gateway
      '172.18.0.1',    // Common Docker Compose gateway
      '172.19.0.1',    // Another common gateway
      '172.20.0.1',    // Another common gateway
      '192.168.65.1',  // Docker Desktop on Mac
      '192.168.99.1'   // Docker Toolbox
    ];
    
    console.log(`?? Docker: Trying common Docker host IPs: ${commonDockerHosts.join(', ')}`);
    return commonDockerHosts[0]; // Return the most common one
  };
  
  // Always handle invalid hostnames, regardless of environment
  const invalidHostnames = ['admin', 'database', 'db', 'server', 'host'];
  if (host && invalidHostnames.includes(host.toLowerCase())) {
    const fallbackHost = getBestFallbackHost();
    console.log(`?? Converting invalid hostname '${host}' to '${fallbackHost}'`);
    return fallbackHost;
  }
  
  // Handle single word hostnames (likely invalid)
  if (host && !host.includes('.') && !host.includes(':') && host.length < 20 && host !== 'localhost') {
    const fallbackHost = getBestFallbackHost();
    console.log(`?? Converting single-word hostname '${host}' to '${fallbackHost}'`);
    return fallbackHost;
  }
  
  if (isDocker) {
    // Convert localhost/127.0.0.1 to appropriate Docker host
    if (host === 'localhost' || host === '127.0.0.1') {
      const fallbackHost = getBestFallbackHost();
      console.log(`?? Docker: Converting '${host}' to '${fallbackHost}'`);
      return fallbackHost;
    }
    
    // For other local network addresses, keep as-is
    if (host && (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.'))) {
      return host; // Keep local network addresses as-is
    }
  }
  
  return host || 'localhost'; // Return original host for valid hostnames
};

// Create simple database pool configuration for localhost connections
const createDatabasePool = (connectionConfig) => {
  const { host, port, database, username, password, max, idleTimeoutMillis, connectionTimeoutMillis } = connectionConfig;
  
  const resolvedHost = resolveHostForDocker(host);
  console.log(`Creating database pool for: ${resolvedHost}:${port}/${database}`);
  
  // Simple pool configuration for localhost
  const poolConfig = {
    host: resolvedHost,
    port: parseInt(port) || 5432,
    database,
    user: username,
    password,
    connectionTimeoutMillis: parseInt(connectionTimeoutMillis) || 30000,
    idleTimeoutMillis: parseInt(idleTimeoutMillis) || 60000,
    max: parseInt(max) || 3,
    min: 0,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 10000,
    reapIntervalMillis: 5000,
    createRetryIntervalMillis: 500,
    propagateCreateError: false,
    // No SSL for localhost
    ssl: false
  };

  const pool = new Pool(poolConfig);

  // Simple error handling for the pool
  pool.on('error', (err, client) => {
    console.error('Database pool error:', err);
    if (client) {
      client.release(true);
    }
  });

  pool.on('connect', (client) => {
    console.log('Database client connected');
  });

  return pool;
};

// Helper function to safely execute database operations with retry logic
const executeWithRetry = async (pool, operation, maxRetries = 2) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client;
    try {
      console.log(`Database operation attempt ${attempt}/${maxRetries}`);
      
      // Get client with extended timeout
      client = await Promise.race([
        pool.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection acquisition timeout after 30s')), 30000)
        )
      ]);

      console.log('Database client acquired successfully');

      // Execute the operation with timeout
      const result = await Promise.race([
        operation(client),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query execution timeout after 30s')), 30000)
        )
      ]);
      
      console.log('Database operation completed successfully');
      
      // Release client back to pool
      client.release();
      
      return result;
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);
      lastError = error;
      
      // Release client if we have one
      if (client) {
        try {
          client.release(true); // Release with error flag
        } catch (releaseError) {
          console.error('Error releasing client:', releaseError);
        }
      }
      
      // Check if this is a connection-related error that might benefit from retry
      const isRetryableError = error.message.includes('timeout') || 
                              error.message.includes('Connection terminated') ||
                              error.message.includes('ECONNREFUSED') ||
                              error.message.includes('ETIMEDOUT');
      
      // If this isn't the last attempt and error is retryable, wait before retrying
      if (attempt < maxRetries && isRetryableError) {
        const delay = Math.min(2000 * attempt, 10000); // Linear backoff with cap
        console.log(`Retrying in ${delay}ms... (retryable error detected)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (attempt < maxRetries) {
        console.log('Non-retryable error detected, skipping remaining attempts');
        break;
      }
    }
  }
  
  throw lastError;
};

// Health check function for database connections
const checkConnectionHealth = async (pool) => {
  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check timeout')), 10000)
      )
    ]);
    
    await Promise.race([
      client.query('SELECT 1 as health_check'),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Health check query timeout')), 5000)
      )
    ]);
    
    client.release();
    return true;
  } catch (error) {
    console.error('Connection health check failed:', error);
    return false;
  }
};

// Function to validate connection parameters before creating pool
const validateConnectionConfig = (config) => {
  const { host, port, database, username, password } = config;
  
  if (!host || typeof host !== 'string' || host.trim() === '') {
    throw new Error('Host is required and must be a non-empty string');
  }
  
  if (!port || isNaN(parseInt(port)) || parseInt(port) < 1 || parseInt(port) > 65535) {
    throw new Error('Port must be a valid number between 1 and 65535');
  }
  
  if (!database || typeof database !== 'string' || database.trim() === '') {
    throw new Error('Database name is required and must be a non-empty string');
  }
  
  if (!username || typeof username !== 'string' || username.trim() === '') {
    throw new Error('Username is required and must be a non-empty string');
  }
  
  if (!password || typeof password !== 'string') {
    throw new Error('Password is required');
  }
  
  return true;
};

// Helper function to call runstatus service
const callRunstatusService = async (endpoint, data, isFileUpload = false) => {
  try {
    let requestConfig = {
      method: 'POST',
      url: `${RUNSTATUS_URL}${endpoint}`,
      timeout: 60000, // 60 seconds timeout
    };

    if (isFileUpload) {
      // For file uploads, use FormData
      const formData = new FormData();
      formData.append('file', data.fileBuffer, {
        filename: data.filename,
        contentType: 'text/csv'
      });
      
      requestConfig.data = formData;
      requestConfig.headers = {
        ...formData.getHeaders(),
        'Content-Length': formData.getLengthSync()
      };
    } else {
      // For regular JSON data
      requestConfig.data = data;
      requestConfig.headers = {
        'Content-Type': 'application/json'
      };
    }

    const response = await axios(requestConfig);
    return response.data;
  } catch (error) {
    console.error(`Error calling runstatus service ${endpoint}:`, error.message);
    if (error.response) {
      throw new Error(`Runstatus service error: ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('Runstatus service is not responding');
    } else {
      throw new Error(`Request setup error: ${error.message}`);
    }
  }
};

// Test database connection
router.post('/test-connection', isAuthenticated, async (req, res) => {
  const connectionConfig = req.body;
  
  let pool;
  try {
    // Validate connection configuration first
    validateConnectionConfig(connectionConfig);
    
    console.log(`Testing connection to ${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);
    
    pool = createDatabasePool(connectionConfig);
    
    // Use retry logic for connection testing
    const result = await executeWithRetry(pool, async (client) => {
      // Test basic connectivity
      await client.query('SELECT 1 as test');
      
      // Get database version and info
      const versionResult = await client.query('SELECT version() as version');
      return {
        version: versionResult.rows[0].version,
        connected_database: connectionConfig.database,
        connected_user: connectionConfig.username,
        server_host: connectionConfig.host
      };
    });
    
    await pool.end();
    
    res.json({ 
      success: true, 
      message: 'Connection successful',
      database_info: result
    });
  } catch (error) {
    console.error('Database connection error:', error);
    if (pool) {
      try { await pool.end(); } catch (e) { /* ignore cleanup errors */ }
    }
    
    // Simple error handling for localhost connections
    let errorMessage = 'Failed to connect to database';
    let suggestions = [];
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused - database server is not running';
      suggestions.push('Check if PostgreSQL server is running');
      suggestions.push('Verify the host and port are correct');
    } else if (error.message.includes('password authentication failed')) {
      errorMessage = 'Authentication failed - invalid username or password';
      suggestions.push('Check username and password');
      suggestions.push('Verify user has access to the database');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      errorMessage = 'Database does not exist';
      suggestions.push('Check if the database name is correct');
      suggestions.push('Create the database if it doesn\'t exist');
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      details: error.message,
      code: error.code,
      suggestions: suggestions
    });
  }
});

// Get list of files from database
router.post('/files', isAuthenticated, async (req, res) => {
  const connectionConfig = req.body;
  const { host, database, username, password } = connectionConfig;
  
  if (!host || !database || !username || !password) {
    return res.status(400).json({ error: 'Missing required connection parameters: host, database, username, password' });
  }

  let pool;
  try {
    pool = createDatabasePool(connectionConfig);
    
    // Use retry logic for fetching files
    const files = await executeWithRetry(pool, async (client) => {
      // Get all tables from the database (generic approach)
      const tablesQuery = `
        SELECT 
          schemaname,
          tablename,
          tableowner,
          hasindexes,
          hasrules,
          hastriggers
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        ORDER BY tablename;
      `;
      
      const tablesResult = await client.query(tablesQuery);
      
      // Transform table data into file-like structure for frontend compatibility
      const filesList = [];
      
      for (let row of tablesResult.rows) {
        try {
          // Get row count for each table
          const countQuery = `SELECT COUNT(*) as row_count FROM "${row.tablename}"`;
          const countResult = await client.query(countQuery);
          const rowCount = parseInt(countResult.rows[0].row_count);
          
          // Get sample data to determine data type
          const sampleQuery = `SELECT * FROM "${row.tablename}" LIMIT 1`;
          const sampleResult = await client.query(sampleQuery);
          
          filesList.push({
            id: `table_${row.tablename}`,
            filename: `${row.tablename}.table`,
            table_name: row.tablename,
            schema_name: row.schemaname,
            upload_date: new Date().toISOString().split('T')[0],
            file_size: `${rowCount} rows`,
            file_type: 'PostgreSQL Table',
            owner: row.tableowner,
            has_indexes: row.hasindexes,
            has_rules: row.hasrules,
            has_triggers: row.hastriggers,
            row_count: rowCount,
            columns: sampleResult.fields ? sampleResult.fields.map(f => f.name) : []
          });
        } catch (error) {
          console.warn(`Could not process table ${row.tablename}:`, error.message);
          // Still add the table even if we can't get details
          filesList.push({
            id: `table_${row.tablename}`,
            filename: `${row.tablename}.table`,
            table_name: row.tablename,
            schema_name: row.schemaname,
            upload_date: new Date().toISOString().split('T')[0],
            file_size: 'Unknown',
            file_type: 'PostgreSQL Table',
            owner: row.tableowner,
            row_count: 0,
            columns: []
          });
        }
      }
      
      return filesList;
    });
    
    await pool.end();
    
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    if (pool) {
      try { await pool.end(); } catch (e) { /* ignore cleanup errors */ }
    }
    res.status(500).json({ 
      error: 'Failed to fetch files from database',
      details: error.message,
      code: error.code
    });
  }
});

// Get file data preview
router.post('/preview', isAuthenticated, async (req, res) => {
  const { connection, fileId } = req.body;
  const { host, database, username, password } = connection;
  
  if (!host || !database || !username || !password || !fileId) {
    return res.status(400).json({ error: 'Missing required parameters: host, database, username, password, fileId' });
  }

  let pool;
  try {
    pool = createDatabasePool(connection);
    
    // Extract table name from fileId (format: table_tablename)
    const tableName = fileId.replace('table_', '');
    
    // Use retry logic for preview
    const previewData = await executeWithRetry(pool, async (client) => {
      // Dynamic preview - get sample data from any table
      const previewQuery = `SELECT * FROM "${tableName}" LIMIT 10`;
      const result = await client.query(previewQuery);
      
      // Get table metadata
      const metadataQuery = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position;
      `;
      const metadataResult = await client.query(metadataQuery, [tableName]);
      
      // Get row count
      const countQuery = `SELECT COUNT(*) as total_rows FROM "${tableName}"`;
      const countResult = await client.query(countQuery);
      
      return {
        table_name: tableName,
        total_rows: parseInt(countResult.rows[0].total_rows),
        columns: metadataResult.rows,
        sample_data: result.rows,
        preview_rows: result.rows.length
      };
    });
    
    await pool.end();
    
    // Return flexible preview data
    res.json(previewData);
  } catch (error) {
    console.error('Error getting file preview:', error);
    if (pool) {
      try { await pool.end(); } catch (e) { /* ignore cleanup errors */ }
    }
    res.status(500).json({ 
      error: 'Failed to get file preview',
      details: error.message,
      code: error.code
    });
  }
});

// Analyze file and generate flow chart
router.post('/analyze', isAuthenticated, async (req, res) => {
  const { connection, fileId } = req.body;
  const { host, database, username, password } = connection;
  
  if (!host || !database || !username || !password || !fileId) {
    return res.status(400).json({ error: 'Missing required parameters: host, database, username, password, fileId' });
  }

  let pool;
  try {
    pool = createDatabasePool(connection);
    
    // Extract table name from fileId (format: table_tablename)
    const tableName = fileId.replace('table_', '');
    
    // Use retry logic for data fetching
    const result = await executeWithRetry(pool, async (client) => {
      // Get all data from the selected table for AI analysis
      const dataQuery = `SELECT * FROM "${tableName}" LIMIT 1000`; // Limit for performance
      return await client.query(dataQuery);
    });
    
    await pool.end();
    
    // Use AI model to analyze data and generate flow chart
    if (result.rows.length === 0) {
      throw new Error('No data found in the selected table');
    }
    
    // Create temporary CSV file for AI analysis
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `${tableName}_${Date.now()}.csv`);
    
    // Convert query result to CSV for AI analysis
    const headers = Object.keys(result.rows[0]);
    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => 
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
    
    // Call AI analysis using the runstatus service
    const flowChartData = await callRunstatusService('/upload', {
      fileBuffer: Buffer.from(csvContent, 'utf8'),
      filename: `${tableName}_analysis.csv`
    }, true);
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      console.error('Error cleaning up temp file:', e);
    }
    
    res.json(flowChartData);
    
  } catch (error) {
    console.error('Error analyzing file:', error);
    if (pool) {
      try { await pool.end(); } catch (e) { /* ignore cleanup errors */ }
    }
    res.status(500).json({ 
      error: 'Failed to analyze file',
      details: error.message,
      code: error.code
    });
  }
});

// New simplified analyze endpoint for first-row flow generation
router.post('/analyze-simple', isAuthenticated, async (req, res) => {
  const { connection, fileId } = req.body;
  const { host, database, username, password } = connection;
  
  if (!host || !database || !username || !password || !fileId) {
    return res.status(400).json({ error: 'Missing required parameters: host, database, username, password, fileId' });
  }

  let pool;
  try {
    pool = createDatabasePool(connection);
    
    // Extract table name from fileId (format: table_tablename)
    const tableName = fileId.replace('table_', '');
    
    console.log(`Analyzing data from table: ${tableName}`);
    
    // Get ALL rows for expandable data (limit for performance) - including header row
    const allRowsResult = await executeWithRetry(pool, async (client) => {
      const query = `SELECT * FROM "${tableName}" LIMIT 100`;
      return await client.query(query);
    });
    
    if (!allRowsResult.rows || allRowsResult.rows.length === 0) {
      throw new Error('No data found in the selected table');
    }
    
    // Get the first row data (this will be our header + first data row)
    const firstRow = allRowsResult.rows[0];
    const columns = Object.keys(firstRow);
    const values = Object.values(firstRow);
    
    console.log(`Found ${columns.length} columns with ${allRowsResult.rows.length} total rows`);

    // Create vertical header + data structure
    // Use actual column names as headers, all rows as data
    const dataRows = allRowsResult.rows.slice(0, 10); // Take first 10 rows as data
    
    const flowData = {
      table_name: tableName,
      total_columns: columns.length,
      total_rows: allRowsResult.rows.length,
      // Header flow (actual column names as headers)
      header_flow: {
        id: 'header_row',
        type: 'header',
        initial_value: columns[0] ? String(columns[0]) : 'Header',
        initial_display: columns[0] ? String(columns[0]).substring(0, 25) : 'Header',
        complete_flow: columns.map((column, colIndex) => ({
          id: `header_col_${colIndex}`,
          position: colIndex,
          column_name: column,
          value: String(column), // Use column name as value
          display_value: String(column).substring(0, 30),
          is_first: colIndex === 0,
          is_last: colIndex === columns.length - 1
        }))
      },
      // Data rows (each row's first column value + complete flow)
      data_rows: dataRows.map((row, rowIndex) => ({
        id: `data_row_${rowIndex}`,
        row_number: rowIndex + 1,
        type: 'data',
        // First column value for initial display
        initial_value: row[columns[0]] ? String(row[columns[0]]) : 'No data',
        initial_display: row[columns[0]] ? String(row[columns[0]]).substring(0, 25) : 'No data',
        // Complete flow for expansion (all columns in this row)
        complete_flow: columns.map((column, colIndex) => ({
          id: `data_row_${rowIndex}_col_${colIndex}`,
          position: colIndex,
          column_name: column,
          value: row[column] ? String(row[column]) : 'No data',
          display_value: row[column] ? String(row[column]).substring(0, 30) : 'No data',
          is_first: colIndex === 0,
          is_last: colIndex === columns.length - 1
        }))
      })),
      metadata: {
        analyzed_at: new Date().toISOString(),
        total_rows_analyzed: allRowsResult.rows.length,
        analysis_type: 'vertical_header_data_flow',
        description: 'Shows header + data rows vertically, expandable to horizontal flows'
      }
    };
    
    console.log(`Generated flow with header + ${flowData.data_rows.length} data rows`);
    
    // Close the pool connection
    await pool.end();
    
    res.json({
      success: true,
      message: 'Data analyzed successfully',
      flow_data: flowData
    });
    
  } catch (error) {
    console.error('Error analyzing data:', error);
    if (pool) {
      try { await pool.end(); } catch (e) { /* ignore cleanup errors */ }
    }
    res.status(500).json({ 
      error: 'Failed to analyze data',
      details: error.message,
      code: error.code
    });
  }
});

// New branch view analyze endpoint
router.post('/analyze-branch', isAuthenticated, async (req, res) => {
  const { connection, fileId } = req.body;
  const { host, database, username, password } = connection;
  
  if (!host || !database || !username || !password || !fileId) {
    return res.status(400).json({ error: 'Missing required parameters: host, database, username, password, fileId' });
  }

  let pool;
  try {
    pool = createDatabasePool(connection);
    
    // Extract table name from fileId (format: table_tablename)
    const tableName = fileId.replace('table_', '');
    
    console.log(`Analyzing data for branch view from table: ${tableName}`);
    
    // Get all data for branch analysis
    const result = await executeWithRetry(pool, async (client) => {
      const dataQuery = `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT 1000`; // Order by first column, limit for performance
      return await client.query(dataQuery);
    });
    
    await pool.end();
    
    // Use AI model to analyze data and generate branch view
    if (result.rows.length === 0) {
      throw new Error('No data found in the selected table');
    }
    
    // Create temporary CSV file for branch analysis
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `${tableName}_branch_${Date.now()}.csv`);
    
    // Convert query result to CSV for branch analysis
    const headers = Object.keys(result.rows[0]);
    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => 
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
    
    // Call branch analysis using the runstatus service
    const branchData = await callRunstatusService('/upload-branch', {
      fileBuffer: Buffer.from(csvContent, 'utf8'),
      filename: `${tableName}_branch_analysis.csv`
    }, true);
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      console.error('Error cleaning up temp file:', e);
    }
    
    // Add metadata about the analysis
    const responseData = {
      success: true,
      message: 'Branch analysis completed successfully',
      branch_data: branchData,
      metadata: {
        table_name: tableName,
        total_rows_analyzed: result.rows.length,
        analysis_type: 'branch_view',
        analyzed_at: new Date().toISOString()
      }
    };
    
    console.log(`Generated branch view with ${branchData.nodes ? branchData.nodes.length : 0} nodes`);
    res.json(responseData);
    
  } catch (error) {
    console.error('Error analyzing data for branch view:', error);
    if (pool) {
      try { await pool.end(); } catch (e) { /* ignore cleanup errors */ }
    }
    res.status(500).json({ 
      error: 'Failed to analyze data for branch view',
      details: error.message,
      code: error.code
    });
  }
});

// New RTL view analyze endpoint
router.post('/analyze-rtl', isAuthenticated, async (req, res) => {
  const { connection, fileId } = req.body;
  const { host, database, username, password } = connection;
  
  if (!host || !database || !username || !password || !fileId) {
    return res.status(400).json({ error: 'Missing required parameters: host, database, username, password, fileId' });
  }

  let pool;
  try {
    pool = createDatabasePool(connection);
    
    // Extract table name from fileId (format: table_tablename)
    const tableName = fileId.replace('table_', '');
    
    console.log(`Analyzing data for RTL view from table: ${tableName}`);
    
    // Get all data for RTL analysis
    const result = await executeWithRetry(pool, async (client) => {
      const dataQuery = `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT 1000`; // Order by first column, limit for performance
      return await client.query(dataQuery);
    });
    
    await pool.end();
    
    // Use AI model to analyze data and generate RTL view
    if (result.rows.length === 0) {
      throw new Error('No data found in the selected table');
    }
    
    // Create temporary CSV file for RTL analysis
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFile = path.join(tempDir, `${tableName}_rtl_${Date.now()}.csv`);
    
    // Convert query result to CSV for RTL analysis
    const headers = Object.keys(result.rows[0]);
    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => 
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
    
    // Call RTL analysis using the runstatus service
    const rtlData = await callRunstatusService('/upload-rtl', {
      fileBuffer: Buffer.from(csvContent, 'utf8'),
      filename: `${tableName}_rtl_analysis.csv`
    }, true);
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      console.error('Error cleaning up temp file:', e);
    }
    
    // Add metadata about the analysis
    const responseData = {
      success: true,
      message: 'RTL analysis completed successfully',
      rtl_data: rtlData,
      metadata: {
        table_name: tableName,
        total_rows_analyzed: result.rows.length,
        analysis_type: 'rtl_view',
        analyzed_at: new Date().toISOString()
      }
    };
    
    console.log(`Generated RTL view with ${rtlData.rtl_versions ? rtlData.rtl_versions.length : 0} versions`);
    res.json(responseData);
    
  } catch (error) {
    console.error('Error analyzing data for RTL view:', error);
    if (pool) {
      try { await pool.end(); } catch (e) { /* ignore cleanup errors */ }
    }
    res.status(500).json({ 
      error: 'Failed to analyze data for RTL view',
      details: error.message,
      code: error.code
    });
  }
});

module.exports = router;