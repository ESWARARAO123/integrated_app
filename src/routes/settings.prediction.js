const express = require('express');
const { db } = require('../database');
const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ===== PREDICTION DATABASE ROUTES =====

// Helper function to ensure prediction_db_settings table exists
async function ensurePredictionDbSettingsTable() {
  try {
    // Try to create the table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS prediction_db_settings (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT 'default',
        host TEXT NOT NULL,
        database TEXT NOT NULL,
        "user" TEXT NOT NULL,
        password TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 5432,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_prediction_db_settings_user_id_username 
      ON prediction_db_settings(user_id, username)
    `);
    
    console.log('✅ prediction_db_settings table ensured');
    return true;
  } catch (error) {
    console.error('❌ Error ensuring prediction_db_settings table:', error);
    return false;
  }
}

// Get prediction database configuration
router.get('/prediction-db-config', isAuthenticated, async (req, res) => {
  try {
    console.log('Getting prediction database config for user:', req.session.userId);
    
    // Ensure table exists before querying
    await ensurePredictionDbSettingsTable();
    
    const result = await db.query(
      'SELECT host, port, database, "user", password FROM prediction_db_settings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      [req.session.userId]
    );
    
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        config: {
          host: '',
          port: 5432,
          database: '',
          user: '',
          password: ''
        }
      });
    }
    
    const config = result.rows[0];
    res.json({
      success: true,
      config: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: '' // Never return password for security
      }
    });
  } catch (error) {
    console.error('Error getting prediction database config:', error);
    
    // If it's a table doesn't exist error, return empty config
    if (error.code === '42P01') {
      console.log('prediction_db_settings table does not exist, returning empty config');
      return res.json({
        success: true,
        config: {
          host: '',
          port: 5432,
          database: '',
          user: '',
          password: ''
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to get prediction database configuration'
    });
  }
});

// Save prediction database configuration
router.post('/prediction-db-config', isAuthenticated, async (req, res) => {
  try {
    const { host, port, database, user, password, skipTest } = req.body;
    
    console.log('Saving prediction database config for user:', req.session.userId);
    console.log('Request body:', { host, port, database, user, password: '***', skipTest });
    
    if (!host || !port || !database || !user || !password) {
      console.log('Missing required fields:', { host: !!host, port: !!port, database: !!database, user: !!user, password: !!password });
      return res.status(400).json({
        success: false,
        message: 'All database connection fields are required'
      });
    }
    
    // Test the connection first (unless skipTest is true)
    if (!skipTest) {
      const connectionTestResult = await testDatabaseConnection({ host, port, database, user, password });
      if (!connectionTestResult.success) {
        return res.status(400).json(connectionTestResult);
      }
    }
    
    // Ensure table exists before saving
    await ensurePredictionDbSettingsTable();
    
    // Get username from users table
    const userResult = await db.query('SELECT username FROM users WHERE id = ?', [req.session.userId]);
    const username = userResult.rows[0]?.username || 'default';
    
    // Delete existing configuration for this user before inserting new one
    await db.query('DELETE FROM prediction_db_settings WHERE user_id = ?', [req.session.userId]);
    
    // Save to database with proper column names and user_id
    await db.query(`
      INSERT INTO prediction_db_settings (user_id, username, host, port, database, "user", password, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [req.session.userId, username, host, parseInt(port), database, user, password]);
    
    console.log('Prediction database configuration saved successfully');
    
    // Reload the prediction database service
    try {
      const predictionDbService = require('../services/predictionDbService');
      await predictionDbService.reloadConfiguration();
      console.log('Prediction database service reloaded successfully');
    } catch (reloadError) {
      console.error('Error reloading prediction database service:', reloadError);
      // Don't fail the request if reload fails
    }
    
    res.json({
      success: true,
      message: skipTest ? 'Prediction database configuration saved successfully (connection not tested)' : 'Prediction database configuration saved successfully'
    });
  } catch (error) {
    console.error('Error saving prediction database config:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to save prediction database configuration';
    if (error.code === '42P01') {
      errorMessage = 'Database table missing. Please restart the server to initialize tables.';
    } else if (error.code === '23503') {
      errorMessage = 'User reference error. Please try logging out and back in.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// Test prediction database connection without saving
router.post('/test-prediction-db-connection', isAuthenticated, async (req, res) => {
  try {
    const { host, port, database, user, password } = req.body;
    
    console.log('Testing prediction database connection for user:', req.session.userId);
    
    if (!host || !port || !database || !user || !password) {
      return res.status(400).json({
        success: false,
        error: 'All database connection fields are required'
      });
    }
    
    const result = await testDatabaseConnectionWithAnalysis({ host, port, database, user, password });
    res.json(result);
  } catch (error) {
    console.error('Error testing prediction database connection:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Disconnect prediction database
router.post('/prediction-db-disconnect', isAuthenticated, async (req, res) => {
  try {
    console.log('Disconnecting prediction database for user:', req.session.userId);
    
    // Ensure table exists before deleting
    await ensurePredictionDbSettingsTable();
    
    // Clear the prediction database configuration for this user
    await db.query(
      'DELETE FROM prediction_db_settings WHERE user_id = ?',
      [req.session.userId]
    );
    
    // Disconnect the prediction database service
    try {
      const predictionDbService = require('../services/predictionDbService');
      await predictionDbService.disconnect();
      console.log('Prediction database service disconnected successfully');
    } catch (serviceError) {
      console.error('Error disconnecting prediction database service:', serviceError);
      // Don't fail the request if service disconnect fails
    }
    
    res.json({
      success: true,
      message: 'Prediction database disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting prediction database:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect prediction database'
    });
  }
});

// ===== HELPER FUNCTIONS =====

/**
 * Test database connection with basic validation
 */
async function testDatabaseConnection({ host, port, database, user, password }) {
  const { Pool } = require('pg');
  const testPool = new Pool({
    host,
    port: parseInt(port),
    database,
    user,
    password,
    max: 1,
    ssl: false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 1000,
    query_timeout: 3000
  });
  
  try {
    console.log('Testing database connection...');
    const client = await testPool.connect();
    console.log('Database connection established, testing query...');
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection test successful');
    return { success: true };
  } catch (testError) {
    console.error('Prediction database connection test failed:', testError);
    console.error('Connection details:', { host, port, database, user });
    
    return {
      success: false,
      message: formatConnectionError(testError, { host, port, database, user })
    };
  } finally {
    try {
      await testPool.end();
    } catch (endError) {
      console.error('Error closing test pool:', endError);
    }
  }
}

/**
 * Test database connection with detailed analysis
 */
async function testDatabaseConnectionWithAnalysis({ host, port, database, user, password }) {
  const { Pool } = require('pg');
  const testPool = new Pool({
    host,
    port: parseInt(port),
    database,
    user,
    password,
    max: 1,
    ssl: false,
    connectionTimeoutMillis: 10000
  });
  
  try {
    const client = await testPool.connect();
    
    // Test basic connectivity
    await client.query('SELECT 1');
    
    // Get table count
    const tablesResult = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // Look for potential prediction tables
    const predictionTablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND (
        LOWER(table_name) LIKE '%place%' OR
        LOWER(table_name) LIKE '%cts%' OR
        LOWER(table_name) LIKE '%route%' OR
        LOWER(table_name) LIKE '%location%' OR
        LOWER(table_name) LIKE '%station%' OR
        LOWER(table_name) LIKE '%schedule%' OR
        LOWER(table_name) LIKE '%time%' OR
        LOWER(table_name) LIKE '%path%' OR
        LOWER(table_name) LIKE '%journey%'
      )
      ORDER BY table_name
    `);
    
    client.release();
    
    const tableCount = tablesResult.rows[0].table_count;
    const potentialTables = predictionTablesResult.rows.map(row => row.table_name);
    
    return {
      success: true,
      message: `Connection successful! Found ${tableCount} tables in database.`,
      potential_prediction_tables: potentialTables
    };
  } catch (testError) {
    console.error('Prediction database connection test failed:', testError);
    
    return {
      success: false,
      error: formatConnectionError(testError, { host, port, database, user })
    };
  } finally {
    try {
      await testPool.end();
    } catch (endError) {
      console.error('Error closing test pool:', endError);
    }
  }
}

/**
 * Format connection error messages for better user experience
 */
function formatConnectionError(testError, { host, port, database, user }) {
  let errorMessage = 'Database connection failed';
  
  if (testError.code === 'ECONNREFUSED') {
    errorMessage = `Cannot connect to database server at ${host}:${port}. Please check if PostgreSQL is running and accessible.`;
  } else if (testError.code === 'ENOTFOUND') {
    errorMessage = `Database host '${host}' not found. Please check the hostname.`;
  } else if (testError.code === 'ETIMEDOUT') {
    errorMessage = `Connection timeout to ${host}:${port}. Please check network connectivity.`;
  } else if (testError.message.includes('password authentication failed')) {
    errorMessage = `Authentication failed for user '${user}'. Please check your username and password.`;
  } else if (testError.message.includes('database') && testError.message.includes('does not exist')) {
    errorMessage = `Database '${database}' does not exist. Please check the database name.`;
  } else if (testError.message.includes('role') && testError.message.includes('does not exist')) {
    errorMessage = `User '${user}' does not exist. Please check the username.`;
  } else {
    errorMessage = `Database connection failed: ${testError.message}`;
  }
  
  return errorMessage;
}

module.exports = router;
