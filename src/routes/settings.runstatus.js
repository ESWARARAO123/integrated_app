const express = require('express');
const { db, pool } = require('../database');
const { Pool } = require('pg');
const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Helper function to get environment-aware database defaults
function getDatabaseDefaults() {
  // Check if running in Docker
  const isInDocker = process.env.NODE_ENV === 'production' ||
                     process.env.DOCKER_CONTAINER === 'true';

  return {
    host: process.env.DATABASE_HOST ||
          (isInDocker ? 'host.docker.internal' : 'localhost'),
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || '',
    user: process.env.DATABASE_USER || '',
    password: process.env.DATABASE_PASSWORD || ''
  };
}

// ===== RUNSTATUS DATABASE ROUTES =====

// Get RunStatus database configuration
router.get('/runstatus-db/config', isAuthenticated, async (req, res) => {
  try {
    console.log('Getting RunStatus database config for user:', req.session.userId);

    const result = await db.query(
      'SELECT host, port, database_name, username FROM user_runstatus_db_configurations WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      const defaults = getDatabaseDefaults();
      return res.json({
        success: true,
        config: {
          host: defaults.host,
          port: defaults.port,
          database: defaults.database,
          user: defaults.user,
          password: '' // Never return password for security
        }
      });
    }

    const config = result.rows[0];
    res.json({
      success: true,
      config: {
        host: config.host,
        port: config.port,
        database: config.database_name,
        user: config.username,
        password: '' // Never return password for security
      }
    });
  } catch (error) {
    console.error('Error getting RunStatus database config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get RunStatus database configuration'
    });
  }
});

// Test RunStatus database connection without saving
router.post('/runstatus-db/test', isAuthenticated, async (req, res) => {
  try {
    const { host, port, database, user, password } = req.body;

    console.log('Testing RunStatus database connection for user:', req.session.userId);

    if (!host || !port || !database || !user || !password) {
      return res.status(400).json({
        success: false,
        error: 'All database connection fields are required'
      });
    }

    const result = await testDatabaseConnection({ host, port, database, user, password });
    res.json(result);
  } catch (error) {
    console.error('Error testing RunStatus database connection:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Save RunStatus database configuration
router.post('/runstatus-db/config', isAuthenticated, async (req, res) => {
  try {
    const { host, port, database, user, password, skipTest } = req.body;

    console.log('Saving RunStatus database config for user:', req.session.userId);
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

    // Get username from users table for logging purposes
    const userResult = await db.query('SELECT username FROM users WHERE id = $1', [req.session.userId]);
    const username = userResult.rows[0]?.username || 'default';
    console.log(`Saving config for username: ${username}`);

    // Start a transaction
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Deactivate any existing configurations for this user
      await client.query(
        'UPDATE user_runstatus_db_configurations SET is_active = FALSE WHERE user_id = $1',
        [req.session.userId]
      );

      // Insert new configuration
      await client.query(`
        INSERT INTO user_runstatus_db_configurations
        (user_id, host, port, database_name, username, password, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE, CURRENT_TIMESTAMP)
      `, [req.session.userId, host, parseInt(port), database, user, password]);

      await client.query('COMMIT');

      console.log('RunStatus database configuration saved successfully');

      // Reload the RunStatus database service
      try {
        const runStatusDbService = require('../services/runStatusDbService');
        await runStatusDbService.reloadUserConfig(req.session.userId);
        console.log('RunStatus database service reloaded successfully');
      } catch (reloadError) {
        console.error('Error reloading RunStatus database service:', reloadError);
        // Don't fail the request if reload fails
      }

      res.json({
        success: true,
        message: skipTest ? 'RunStatus database configuration saved successfully (connection not tested)' : 'RunStatus database configuration saved successfully'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving RunStatus database config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save RunStatus database configuration'
    });
  }
});

// Disconnect RunStatus database
router.post('/runstatus-db/disconnect', isAuthenticated, async (req, res) => {
  try {
    console.log('Disconnecting RunStatus database for user:', req.session.userId);

    // Clear the RunStatus database configuration for this user
    await db.query(
      'UPDATE user_runstatus_db_configurations SET is_active = FALSE WHERE user_id = $1',
      [req.session.userId]
    );

    // Disconnect the RunStatus database service
    try {
      const runStatusDbService = require('../services/runStatusDbService');
      await runStatusDbService.disconnectUser(req.session.userId);
      console.log('RunStatus database service disconnected successfully');
    } catch (serviceError) {
      console.error('Error disconnecting RunStatus database service:', serviceError);
      // Don't fail the request if service disconnect fails
    }

    res.json({
      success: true,
      message: 'RunStatus database disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting RunStatus database:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect RunStatus database'
    });
  }
});

// ===== HELPER FUNCTIONS =====

/**
 * Test database connection with basic validation
 */
async function testDatabaseConnection({ host, port, database, user, password }) {
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
    console.log('Testing RunStatus database connection...');
    const client = await testPool.connect();
    console.log('Database connection established, testing query...');
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection test successful');
    return { success: true, message: 'Connection test successful' };
  } catch (testError) {
    console.error('RunStatus database connection test failed:', testError);
    console.error('Connection details:', { host, port, database, user });

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