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

// Helper function to ensure prediction_db_settings table exists (FALLBACK ONLY)
// This should ONLY be used when migrations fail - normal operation should rely on migration 031
async function ensurePredictionDbSettingsTable() {
  try {
    // First, check if table already exists to avoid unnecessary operations
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'prediction_db_settings'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('ℹ️  prediction_db_settings table already exists (created by migration)');
      return true;
    }
    
    // Check if migration 031 was applied but failed
    const migrationCheck = await db.query(`
      SELECT name FROM schema_migrations 
      WHERE name = '031_create_prediction_db_settings_table.js' 
      OR version = '031'
    `);
    
    if (migrationCheck.rows.length > 0) {
      console.log('⚠️  Migration 031 was applied but table is missing - this indicates a migration failure');
    } else {
      console.log('⚠️  Migration 031 has not run yet - table missing, using FALLBACK');
    }
    
    console.log('🔄 Creating prediction_db_settings table as FALLBACK mechanism...');
    
    // Use a transaction for the fallback to ensure atomicity
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // FALLBACK: Create the table if it doesn't exist (this should normally be done by migration)
      await client.query(`
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
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_prediction_db_settings_user_id_username 
        ON prediction_db_settings(user_id, username)
      `);
      
      // Try to record this as if it were a migration
      try {
        await client.query(`
          INSERT INTO schema_migrations (name, version, description, applied_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (version) DO NOTHING
        `, ['031_create_prediction_db_settings_table.js', '031', 'create prediction db settings table']);
        console.log('✅ Recorded fallback as migration 031');
      } catch (migError) {
        console.log('⚠️  Could not record fallback as migration (non-critical):', migError.message);
      }
      
      await client.query('COMMIT');
      console.log('✅ prediction_db_settings table created via FALLBACK mechanism');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error in fallback table creation:', error);
      console.error('📋 Fallback creation failed - this indicates a serious database issue');
      return false;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error checking table existence:', error);
    return false;
  }
}

// Get prediction database configuration
router.get('/prediction-db-config', isAuthenticated, async (req, res) => {
  try {
    console.log('Getting prediction database config for user:', req.session.userId);
    
    // Try the normal database query first (migration should have created the table)
    let result;
    try {
      result = await db.query(
        'SELECT host, port, database, "user", password FROM prediction_db_settings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
        [req.session.userId]
      );
    } catch (queryError) {
      // If table doesn't exist (42P01), try fallback table creation
      if (queryError.code === '42P01') {
        console.log('📊 Table missing, attempting fallback creation...');
        const fallbackSuccess = await ensurePredictionDbSettingsTable();
        
        if (fallbackSuccess) {
          // Retry the query after table creation
          result = await db.query(
            'SELECT host, port, database, "user", password FROM prediction_db_settings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
            [req.session.userId]
          );
        } else {
          throw queryError; // Re-throw original error if fallback failed
        }
      } else {
        throw queryError; // Re-throw non-table-missing errors
      }
    }
    
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
    
    // Get username from users table
    const userResult = await db.query('SELECT username FROM users WHERE id = ?', [req.session.userId]);
    const username = userResult.rows[0]?.username || 'default';
    
    // Try normal database operations first (migration should have created the table)
    try {
      // Delete existing configuration for this user before inserting new one
      await db.query('DELETE FROM prediction_db_settings WHERE user_id = ?', [req.session.userId]);
      
      // Save to database with proper column names and user_id
      await db.query(`
        INSERT INTO prediction_db_settings (user_id, username, host, port, database, "user", password, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [req.session.userId, username, host, parseInt(port), database, user, password]);
      
    } catch (dbError) {
      // If table doesn't exist (42P01), try fallback table creation
      if (dbError.code === '42P01') {
        console.log('📊 Table missing during save, attempting fallback creation...');
        const fallbackSuccess = await ensurePredictionDbSettingsTable();
        
        if (fallbackSuccess) {
          // Retry the operations after table creation
          await db.query('DELETE FROM prediction_db_settings WHERE user_id = ?', [req.session.userId]);
          await db.query(`
            INSERT INTO prediction_db_settings (user_id, username, host, port, database, "user", password, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [req.session.userId, username, host, parseInt(port), database, user, password]);
        } else {
          throw dbError; // Re-throw original error if fallback failed
        }
      } else {
        throw dbError; // Re-throw non-table-missing errors
      }
    }
    
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
    
    // Try normal database operations first (migration should have created the table)
    try {
      // Clear the prediction database configuration for this user
      await db.query(
        'DELETE FROM prediction_db_settings WHERE user_id = ?',
        [req.session.userId]
      );
    } catch (dbError) {
      // If table doesn't exist (42P01), that's actually fine for disconnect
      if (dbError.code === '42P01') {
        console.log('📊 Table missing during disconnect - treating as already disconnected');
        // Don't create table for disconnect operation, just continue
      } else {
        throw dbError; // Re-throw non-table-missing errors
      }
    }
    
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
