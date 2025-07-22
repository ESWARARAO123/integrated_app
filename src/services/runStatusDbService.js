const { Pool } = require('pg');

class RunStatusDatabaseService {
  constructor() {
    // Store user-specific connections
    this.userConnections = new Map(); // userId -> { pool, isConnected, tables, config, etc. }
    this.refreshIntervals = new Map(); // userId -> intervalId
    this.maxConnectionAttempts = 5;
  }

  // Get user's database configuration from the main application database
  async getUserConfig(userId) {
    try {
      console.log(`?? Loading RunStatus DB config for user ${userId} (type: ${typeof userId})`);
      
      // Use the main application database to get user's configuration
      const { db } = require('../database');

      const result = await db.query(
        'SELECT host, port, database_name, username, password FROM user_runstatus_db_configurations WHERE user_id = $1 AND is_active = TRUE',
        [userId]
      );

      console.log(`?? Config query result for user ${userId}: ${result.rows.length} rows found`);

      if (result.rows.length === 0) {
        console.log(`? No active RunStatus DB configuration found for user ${userId}`);
        return null; // No configuration found
      }

      const config = result.rows[0];
      console.log(`? Found RunStatus DB config for user ${userId}:`, {
        host: config.host,
        port: config.port,
        database: config.database_name,
        user: config.username
      });
      
      return {
        host: config.host,
        port: config.port,
        database: config.database_name,
        user: config.username,
        password: config.password,
        refreshInterval: 1, // Default values
        max: 10,
        connectionTimeoutMillis: 30000,
        idleTimeoutMillis: 60000,
        ssl: false
      };
    } catch (error) {
      console.error(`? Error loading user database config for user ${userId}:`, error);
      return null;
    }
  }

  // Get user info (username and role) from the main database
  async getUserInfo(userId) {
    try {
      console.log(`?? Loading user info for user ${userId} (type: ${typeof userId})`);
      
      const { db } = require('../database');
      const result = await db.query(
        'SELECT username, role FROM users WHERE id = $1',
        [userId]
      );
      
      console.log(`?? User info query result for user ${userId}: ${result.rows.length} rows found`);
      
      if (result.rows.length === 0) {
        console.log(`? No user found with ID ${userId}`);
        return null;
      }
      
      const userInfo = {
        username: result.rows[0].username,
        role: result.rows[0].role
      };
      
      console.log(`? Found user info for ${userId}:`, userInfo);
      return userInfo;
    } catch (error) {
      console.error(`? Error loading user info for user ${userId}:`, error);
      return null;
    }
  }

  // Resolve host for Docker environment with multiple fallback strategies
  resolveHostForDocker(host) {
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
    
    return host; // Return original host for valid hostnames
  }

  // Get multiple host candidates to try in order of preference
  getHostCandidates(originalHost, primaryHost) {
    const candidates = [];
    
    // 1. Add the primary resolved host
    if (primaryHost && !candidates.includes(primaryHost)) {
      candidates.push(primaryHost);
    }
    
    // 2. If original host is valid, add it too
    if (originalHost && originalHost !== primaryHost && 
        !['admin', 'database', 'db', 'server', 'host'].includes(originalHost.toLowerCase())) {
      candidates.push(originalHost);
    }
    
    // 3. Add localhost variants for development
    if (!candidates.includes('localhost')) {
      candidates.push('localhost');
    }
    if (!candidates.includes('127.0.0.1')) {
      candidates.push('127.0.0.1');
    }
    
    // 4. Add common Docker gateway IPs
    const dockerGateways = [
      '172.17.0.1',    // Default Docker bridge gateway
      '172.18.0.1',    // Common Docker Compose gateway
      '172.19.0.1',    // Another common gateway
      '172.20.0.1',    // Another common gateway
      '192.168.65.1',  // Docker Desktop on Mac
      '192.168.99.1'   // Docker Toolbox
    ];
    
    dockerGateways.forEach(gateway => {
      if (!candidates.includes(gateway)) {
        candidates.push(gateway);
      }
    });
    
    return candidates;
  }

  // Disconnect user connection (moved to end of class to avoid duplication)

  // Initialize connection for a specific user
  async initializeUserConnection(userId) {
    console.log(`?? Initializing Run Status Database connection for user ${userId}...`);
    
    // Check if user already has a connection
    if (this.userConnections.has(userId)) {
      const existingConnection = this.userConnections.get(userId);
      if (existingConnection.isConnected) {
        console.log(`? User ${userId} already has an active RunStatus DB connection`);
        return true;
      } else {
        console.log(`?? User ${userId} has inactive connection, attempting to reconnect...`);
      }
    }
    
    const config = await this.getUserConfig(userId);
    if (!config) {
      console.log(`? No RunStatus DB configuration found for user ${userId}`);
      // Store empty connection state to avoid repeated attempts
      this.userConnections.set(userId, {
        pool: null,
        isConnected: false,
        tables: [],
        config: null,
        lastRefresh: null,
        connectionAttempts: 0
      });
      return false;
    }
    
    try {
      console.log(`?? Attempting to connect user ${userId} to RunStatus DB...`);
      await this.connectUser(userId, config);
      
      // Only start auto-refresh if connection was successful
      const userConnection = this.userConnections.get(userId);
      if (userConnection && userConnection.isConnected) {
        this.startAutoRefreshForUser(userId);
        console.log(`? Successfully initialized RunStatus DB connection for user ${userId}`);
        return true;
      } else {
        console.log(`? Failed to establish RunStatus DB connection for user ${userId}`);
        return false;
      }
    } catch (error) {
      console.error(`? Failed to initialize connection for user ${userId}:`, error);
      return false;
    }
  }

  async connectUser(userId, config) {
    // Get multiple host candidates to try
    const primaryHost = this.resolveHostForDocker(config.host);
    const hostCandidates = this.getHostCandidates(config.host, primaryHost);
    
    console.log(`Connecting to Run Status database for user ${userId} - trying hosts: ${hostCandidates.join(', ')}`);
    
    // Close existing connection if any
    if (this.userConnections.has(userId)) {
      const userConn = this.userConnections.get(userId);
      
      // Stop auto-refresh if running
      if (userConn.refreshInterval) {
        clearInterval(userConn.refreshInterval);
        console.log(`Stopped auto-refresh for user ${userId} before reconnecting`);
      }
      
      if (userConn.pool) {
        await userConn.pool.end();
        console.log(`Closed existing database connection for user ${userId}`);
      }
    }
    
    // Try each host candidate until one works
    let lastError = null;
    for (let i = 0; i < hostCandidates.length; i++) {
      const hostToTry = hostCandidates[i];
      console.log(`?? Attempt ${i + 1}/${hostCandidates.length}: Trying host ${hostToTry}:${config.port}/${config.database}`);
      
      try {
        const pool = new Pool({
          host: hostToTry,
          port: config.port,
          database: config.database,
          user: config.user,
          password: config.password,
          max: config.max,
          connectionTimeoutMillis: config.connectionTimeoutMillis,
          idleTimeoutMillis: config.idleTimeoutMillis,
          ssl: config.ssl,
          min: 0,
          acquireTimeoutMillis: 30000,
          createTimeoutMillis: 30000,
          destroyTimeoutMillis: 10000,
          reapIntervalMillis: 5000,
          createRetryIntervalMillis: 500,
          propagateCreateError: false
        });

        // Test the connection
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        
        console.log(`? Successfully connected to ${hostToTry}:${config.port}/${config.database}`);
        
        // Store successful connection
        const userConnection = {
          pool,
          isConnected: true,
          tables: [],
          config: { ...config, host: hostToTry }, // Update config with working host
          lastRefresh: null,
          connectionAttempts: 0
        };
        
        this.userConnections.set(userId, userConnection);
        console.log(`Run Status database connected successfully for user ${userId}`);
        
        // Initial table refresh
        await this.refreshTablesForUser(userId);
        return; // Success - exit the function
        
      } catch (error) {
        lastError = error;
        console.log(`? Failed to connect to ${hostToTry}: ${error.message}`);
        
        // If this was the last attempt, we'll handle the error below
        if (i === hostCandidates.length - 1) {
          break;
        }
      }
    }
    
    // If we get here, all connection attempts failed
    console.error(`Run Status database connection failed for user ${userId} after trying all hosts:`, lastError);
    
    // Provide helpful error messages based on error type
    if (lastError && lastError.code === 'ENOTFOUND') {
      console.log(`?? Hostname Resolution Error: Could not resolve any of the attempted hostnames`);
      console.log(`?? Connection Details:`);
      console.log(`   - Original host: ${config.host}`);
      console.log(`   - Attempted hosts: ${hostCandidates.join(', ')}`);
      console.log(`   - Port: ${config.port}`);
      console.log(`   - Database: ${config.database}`);
      
      console.log(`?? Troubleshooting Tips:`);
      console.log(`   - Verify the database server is running and accessible`);
      console.log(`   - Check network connectivity from this environment`);
      console.log(`   - For Docker: Ensure the database is accessible from the container network`);
      console.log(`   - For local development: Use 'localhost' or '127.0.0.1' as hostname`);
      console.log(`   - Consider setting DATABASE_HOST environment variable with the correct IP`);
    }
    
    const userConnection = this.userConnections.get(userId) || {};
    userConnection.isConnected = false;
    userConnection.config = config; // Preserve config even on failure
    userConnection.tables = userConnection.tables || [];
    userConnection.lastRefresh = null;
    userConnection.connectionAttempts = (userConnection.connectionAttempts || 0) + 1;
    this.userConnections.set(userId, userConnection);
    
    // Retry connection with exponential backoff
    if (userConnection.connectionAttempts < this.maxConnectionAttempts) {
      const delay = Math.min(5000 * Math.pow(2, userConnection.connectionAttempts - 1), 60000);
      console.log(`Retrying connection for user ${userId} in ${delay}ms... (attempt ${userConnection.connectionAttempts}/${this.maxConnectionAttempts})`);
      setTimeout(() => this.connectUser(userId, config), delay);
    } else {
      console.error(`Max connection attempts reached for user ${userId}. Run Status database service disabled.`);
    }
  }

  async refreshTablesForUser(userId) {
    const userConnection = this.userConnections.get(userId);
    if (!userConnection || !userConnection.isConnected || !userConnection.pool) {
      console.log(`Database not connected for user ${userId}, skipping table refresh`);
      return;
    }

    try {
      console.log(`Refreshing Run Status database tables for user ${userId}...`);
      
      // Get user info to determine filtering
      const userInfo = await this.getUserInfo(userId);
      if (!userInfo) {
        console.error(`Could not get user info for user ${userId}`);
        return;
      }
      
      console.log(`?? User info for ${userId}: username=${userInfo.username}, role=${userInfo.role}`);
      
      const client = await userConnection.pool.connect();
      
      try {
        // First, let's check what schemas are available
        const schemasQuery = `
          SELECT schema_name 
          FROM information_schema.schemata 
          WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
          ORDER BY schema_name;
        `;
        
        const schemasResult = await client.query(schemasQuery);
        console.log(`Available schemas for user ${userId}:`, schemasResult.rows.map(r => r.schema_name));
        
        // Get all tables from the runstatus database with more comprehensive query
        const tablesQuery = `
          SELECT 
            schemaname,
            tablename,
            tableowner,
            hasindexes,
            hasrules,
            hastriggers
          FROM pg_tables 
          WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ORDER BY schemaname, tablename;
        `;
        
        const tablesResult = await client.query(tablesQuery);
        console.log(`Found ${tablesResult.rows.length} total tables in database for user ${userId}`);

        // Filter tables for non-admin users based on run_name column
        let filteredTables = tablesResult.rows;
        const isDockerEnv = process.env.NODE_ENV === 'production' || process.env.DATABASE_HOST;

        if (userInfo.role !== 'admin') {
          console.log(`?? Filtering tables for non-admin user ${userInfo.username} (Docker: ${isDockerEnv})...`);
          const tablesWithUserData = [];

          for (const table of tablesResult.rows) {
            try {
              // Check if table has run_name column
              const hasRunNameQuery = `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = $1 AND table_name = $2 AND column_name = 'run_name'
              `;
              const hasRunNameResult = await client.query(hasRunNameQuery, [table.schemaname, table.tablename]);

              if (hasRunNameResult.rows.length > 0) {
                // Check if table has data for this user - match username prefix in run_name
                // This handles cases like 's_girishR1' where we want to match 's_girish'
                const userDataQuery = `
                  SELECT COUNT(*) as count
                  FROM "${table.schemaname}"."${table.tablename}"
                  WHERE run_name LIKE $1 || '%'
                  LIMIT 1
                `;
                console.log(`?? Checking table ${table.tablename} for user data with query: ${userDataQuery} and username pattern: '${userInfo.username}%'`);
                const userDataResult = await client.query(userDataQuery, [userInfo.username]);
                const count = parseInt(userDataResult.rows[0].count);

                if (count > 0) {
                  tablesWithUserData.push(table);
                  console.log(`? Table ${table.tablename} has ${count} records for user pattern '${userInfo.username}%' - INCLUDED`);
                } else {
                  console.log(`? Table ${table.tablename} has ${count} records for user pattern '${userInfo.username}%' - EXCLUDED`);
                }
              } else {
                console.log(`?? Table ${table.tablename} does not have run_name column - EXCLUDED for user ${userInfo.username}`);
              }
            } catch (error) {
              console.log(`Error checking table ${table.tablename} for user data:`, error.message);
              // Skip this table if there's an error
            }
          }

          filteredTables = tablesWithUserData;
          console.log(`?? Final result: ${filteredTables.length} tables with user data for ${userInfo.username} (Docker: ${isDockerEnv})`);
        } else {
          console.log(`?? Admin user ${userInfo.username} - showing all ${filteredTables.length} tables`);
        }

        if (filteredTables.length === 0) {
          // If no tables found for non-admin users, this is expected behavior
          if (userInfo.role !== 'admin') {
            console.log(`? No tables found for non-admin user ${userInfo.username} - this is expected if they have no data in any tables with run_name column (Docker: ${isDockerEnv})`);
          } else {
            // For admin users, let's check if we have permission issues
            console.log(`?? No tables found for admin user ${userInfo.username} after filtering (Docker: ${isDockerEnv})`);
            console.log(`No tables found for admin user ${userId}. Checking database permissions...`);
            
            try {
              const permissionQuery = `
                SELECT 
                  current_user as current_user,
                  current_database() as current_database,
                  has_database_privilege(current_user, current_database(), 'CONNECT') as can_connect,
                  has_database_privilege(current_user, current_database(), 'CREATE') as can_create
              `;
              const permissionResult = await client.query(permissionQuery);
              console.log(`Database permissions for admin user ${userId}:`, permissionResult.rows[0]);
            } catch (permError) {
              console.log(`Could not check permissions for admin user ${userId}:`, permError.message);
            }
            
            // Also check if there are any tables at all (including system tables)
            try {
              const allTablesQuery = `SELECT COUNT(*) as total_tables FROM pg_tables`;
              const allTablesResult = await client.query(allTablesQuery);
              console.log(`Total tables in database (including system): ${allTablesResult.rows[0].total_tables}`);
            } catch (countError) {
              console.log(`Could not count total tables for admin user ${userId}:`, countError.message);
            }
          }
        }
        const newTables = [];

        console.log(`?? Processing ${filteredTables.length} filtered tables for user ${userInfo.username} (role: ${userInfo.role})`);
        for (let row of filteredTables) {
          console.log(`?? Processing table: ${row.schemaname}.${row.tablename} for user ${userInfo.username} (role: ${userInfo.role})`);
          try {
            // Skip system tables for all users
            if (row.tablename === 'users_db_details') {
              console.log(`?? Excluding table ${row.tablename} - system table`);
              continue;
            }
            
            // Get row count - user-specific for regular users, total for admin
            let rowCount;
            if (userInfo.role === 'admin') {
              // Admin sees total row count
              const countQuery = `SELECT COUNT(*) as row_count FROM "${row.tablename}"`;
              const countResult = await client.query(countQuery);
              rowCount = parseInt(countResult.rows[0].row_count);
            } else {
              // Regular users see only their data count (tables with run_name column only) - pattern match
              const userCountQuery = `SELECT COUNT(*) as row_count FROM "${row.tablename}" WHERE run_name LIKE $1 || '%'`;
              const userCountResult = await client.query(userCountQuery, [userInfo.username]);
              rowCount = parseInt(userCountResult.rows[0].row_count);
            }
            
            // Get column information
            const columnsQuery = `
              SELECT column_name, data_type
              FROM information_schema.columns 
              WHERE table_name = $1 AND table_schema = $2
              ORDER BY ordinal_position;
            `;
            const columnsResult = await client.query(columnsQuery, [row.tablename, row.schemaname]);
            const columns = columnsResult.rows.map(col => col.column_name);
            
            const tableInfo = {
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
              columns: columns,
              last_updated: new Date().toISOString()
            };
            
            newTables.push(tableInfo);
            console.log(`? Added table ${row.tablename} with ${rowCount} rows for user ${userInfo.username}`);
          } catch (error) {
            console.warn(`? Could not process table ${row.tablename} for user ${userId}:`, error.message);
            // For admin users or if we can't determine filtering, still add the table
            if (userInfo.role === 'admin') {
              // Try to get column information for the table
              try {
                const columnsQuery = `
                  SELECT column_name
                  FROM information_schema.columns 
                  WHERE table_name = $1 AND table_schema = $2
                  ORDER BY ordinal_position;
                `;
                const columnsResult = await client.query(columnsQuery, [row.tablename, row.schemaname]);
                const columns = columnsResult.rows.map(col => col.column_name);
                
                newTables.push({
                  id: `table_${row.tablename}`,
                  filename: `${row.tablename}.table`,
                  table_name: row.tablename,
                  schema_name: row.schemaname,
                  upload_date: new Date().toISOString().split('T')[0],
                  file_size: 'Unknown',
                  file_type: 'PostgreSQL Table',
                  owner: row.tableowner,
                  row_count: 0,
                  columns: columns,
                  last_updated: new Date().toISOString()
                });
              } catch (columnError) {
                console.warn(`? Could not get columns for table ${row.tablename}, adding without column info:`, columnError.message);
                // If we can't get columns, add the table anyway (fallback of fallback)
                newTables.push({
                  id: `table_${row.tablename}`,
                  filename: `${row.tablename}.table`,
                  table_name: row.tablename,
                  schema_name: row.schemaname,
                  upload_date: new Date().toISOString().split('T')[0],
                  file_size: 'Unknown',
                  file_type: 'PostgreSQL Table',
                  owner: row.tableowner,
                  row_count: 0,
                  columns: [],
                  last_updated: new Date().toISOString()
                });
              }
            }
          }
        }
        
        // Docker-specific fallback: Only for admin users - if no tables found and we're in Docker, try a less restrictive approach
        // This fallback should NOT apply to regular users as they should only see tables with their data
        if (newTables.length === 0 && isDockerEnv && tablesResult.rows.length > 0 && userInfo.role === 'admin') {
          console.log(`?? Docker fallback for admin user ${userId}: No tables passed filtering. Adding all non-system tables for Docker environment...`);
          console.log(`?? This fallback only applies to admin users. Regular users will see empty tables if they have no data.`);

          try {
            for (let row of tablesResult.rows) {
              if (row.tablename !== 'users_db_details' && !row.tablename.startsWith('pg_') && !row.tablename.startsWith('sql_')) {
                try {
                  // Get basic row count
                  const countQuery = `SELECT COUNT(*) as row_count FROM "${row.tablename}"`;
                  const countResult = await client.query(countQuery);
                const rowCount = parseInt(countResult.rows[0].row_count);
                
                // Get column information
                const columnsQuery = `
                  SELECT column_name 
                  FROM information_schema.columns 
                  WHERE table_name = $1 AND table_schema = $2
                  ORDER BY ordinal_position;
                `;
                const columnsResult = await client.query(columnsQuery, [row.tablename, row.schemaname]);
                const columns = columnsResult.rows.map(col => col.column_name);
                
                newTables.push({
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
                  columns: columns,
                  last_updated: new Date().toISOString()
                });
                
                  console.log(`?? Docker fallback: Added table ${row.tablename} with ${rowCount} rows`);
                } catch (fallbackError) {
                  console.warn(`?? Docker fallback: Could not add table ${row.tablename}:`, fallbackError.message);
                }
              }
            }
          } catch (dockerFallbackError) {
            console.error(`?? Docker fallback failed for user ${userId}:`, dockerFallbackError.message);
          }
        } else if (newTables.length === 0 && userInfo.role !== 'admin') {
          console.log(`? No tables found for non-admin user ${userInfo.username} - this is correct behavior when user has no data in any tables`);
        }
        
        // Check for new tables
        const previousTableNames = userConnection.tables.map(t => t.table_name);
        const currentTableNames = newTables.map(t => t.table_name);
        const newTableNames = currentTableNames.filter(name => !previousTableNames.includes(name));
        
        if (newTableNames.length > 0) {
          console.log(`Found ${newTableNames.length} new tables for user ${userId} (${userInfo.username}):`, newTableNames);
        }
        
        userConnection.tables = newTables;
        userConnection.lastRefresh = new Date();
        
        console.log(`?? FINAL RESULT: Refreshed ${userConnection.tables.length} tables from Run Status database for user ${userId} (${userInfo.username}, role: ${userInfo.role})`);
        console.log(`?? Tables for user ${userInfo.username}:`, newTables.map(t => `${t.table_name} (${t.row_count} rows)`));
        
        if (userInfo.role !== 'admin' && newTables.length === 0) {
          console.log(`? EXPECTED: Non-admin user ${userInfo.username} has no tables - this means they have no data in any tables with run_name column matching their username`);
        } else if (userInfo.role !== 'admin' && newTables.length > 0) {
          console.log(`? EXPECTED: Non-admin user ${userInfo.username} has ${newTables.length} tables with their data`);
        }
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error(`Error refreshing tables for user ${userId}:`, error);
      
      // If connection error, try to reconnect
      if (error.code === 'ECONNREFUSED' || error.message.includes('Connection terminated')) {
        console.log(`Connection lost for user ${userId}, attempting to reconnect...`);
        userConnection.isConnected = false;
        const config = await this.getUserConfig(userId);
        if (config) {
          this.connectUser(userId, config);
        }
      }
    }
  }

  // Force refresh tables for a user (useful for debugging or manual refresh)
  async forceRefreshTablesForUser(userId) {
    console.log(`?? Force refreshing tables for user ${userId}...`);
    await this.refreshTablesForUser(userId);
  }

  // Check if a specific table has data for a user (debugging helper)
  async checkTableDataForUser(userId, tableName) {
    const userConnection = this.userConnections.get(userId);
    if (!userConnection || !userConnection.isConnected || !userConnection.pool) {
      throw new Error('Database not connected');
    }

    const userInfo = await this.getUserInfo(userId);
    if (!userInfo) {
      throw new Error('Could not get user info');
    }

    const client = await userConnection.pool.connect();
    try {
      // Check if table has run_name column
      const hasRunNameQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = 'run_name'
      `;
      const hasRunNameResult = await client.query(hasRunNameQuery, [tableName]);
      
      if (hasRunNameResult.rows.length > 0) {
        // Check data count for this user - pattern match
        const userDataQuery = `SELECT COUNT(*) as count FROM "${tableName}" WHERE run_name LIKE $1 || '%'`;
        const userDataResult = await client.query(userDataQuery, [userInfo.username]);
        
        return {
          tableName,
          hasRunNameColumn: true,
          userDataCount: parseInt(userDataResult.rows[0].count),
          username: userInfo.username,
          shouldShow: parseInt(userDataResult.rows[0].count) > 0
        };
      } else {
        return {
          tableName,
          hasRunNameColumn: false,
          userDataCount: 0,
          username: userInfo.username,
          shouldShow: false
        };
      }
    } finally {
      client.release();
    }
  }

  startAutoRefreshForUser(userId) {
    const userConnection = this.userConnections.get(userId);
    if (!userConnection || !userConnection.config) return;

    // Clear existing interval if any
    if (this.refreshIntervals.has(userId)) {
      clearInterval(this.refreshIntervals.get(userId));
    }
    
    // Set up auto-refresh every minute (or configured interval)
    const refreshInterval = userConnection.config.refreshInterval || 1; // Default to 1 minute
    const intervalMs = refreshInterval * 60 * 1000;
    console.log(`Starting auto-refresh for user ${userId} every ${refreshInterval} minute(s)`);
    
    const intervalId = setInterval(async () => {
      if (userConnection.isConnected) {
        await this.refreshTablesForUser(userId);
      } else {
        console.log(`Database not connected for user ${userId}, attempting to reconnect...`);
        const config = await this.getUserConfig(userId);
        if (config) {
          await this.connectUser(userId, config);
        }
      }
    }, intervalMs);
    
    this.refreshIntervals.set(userId, intervalId);
  }

  stopAutoRefreshForUser(userId) {
    if (this.refreshIntervals.has(userId)) {
      clearInterval(this.refreshIntervals.get(userId));
      this.refreshIntervals.delete(userId);
      console.log(`Auto-refresh stopped for user ${userId}`);
    }
  }

  // Get users who have data in the database
  async getUsersWithData(userId) {
    const userConnection = this.userConnections.get(userId);
    if (!userConnection || !userConnection.isConnected) {
      return [];
    }

    try {
      const systemUsers = await this.getAllSystemUsers();
      const client = await userConnection.pool.connect();
      const usersWithData = [];

      try {
        // Check each system user against each table
        for (const systemUser of systemUsers) {
          let userTotalRuns = 0;
          const userTables = [];

          for (const table of userConnection.tables) {
            // Check if table has run_name column
            const hasRunNameQuery = `
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = $1 AND column_name = 'run_name'
            `;
            const hasRunNameResult = await client.query(hasRunNameQuery, [table.table_name]);
            
            if (hasRunNameResult.rows.length > 0) {
              // Check if this user has data in this table - pattern match
              const userDataQuery = `
                SELECT COUNT(*) as count
                FROM "${table.table_name}" 
                WHERE run_name LIKE $1 || '%'
              `;
              const userDataResult = await client.query(userDataQuery, [systemUser.username]);
              const count = parseInt(userDataResult.rows[0].count);
              
              if (count > 0) {
                userTables.push({
                  ...table,
                  user_specific_count: count
                });
                userTotalRuns += count;
              }
            }
          }

          if (userTotalRuns > 0) {
            usersWithData.push({
              id: systemUser.id,
              username: systemUser.username,
              role: systemUser.role,
              totalRuns: userTotalRuns,
              tables: userTables
            });
          }
        }

        return usersWithData;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error getting users with data for user ${userId}:`, error);
      return [];
    }
  }

  // Get all system users to match with run_name data
  async getAllSystemUsers() {
    try {
      const { db } = require('../database');
      const result = await db.query('SELECT id, username, role FROM users ORDER BY username');
      return result.rows;
    } catch (error) {
      console.error('Error loading system users:', error);
      return [];
    }
  }

  getTablesForUser(userId, viewType = 'simple') {
    const userConnection = this.userConnections.get(userId);
    if (!userConnection) {
      console.log(`?? getTablesForUser: No connection found for user ${userId}`);
      return {
        tables: [],
        isConnected: false,
        lastRefresh: null,
        totalTables: 0
      };
    }

    let filteredTables = userConnection.tables || [];
    
    // Apply view-specific filtering
    if (viewType === 'branchflow') {
      // BranchFlow: Exclude tables with BOTH RTL_version AND Block_name columns
      filteredTables = filteredTables.filter(table => {
        const columns = table.columns || [];
        const hasRTLVersion = columns.some(col => col.toLowerCase() === 'rtl_version');
        const hasBlockName = columns.some(col => col.toLowerCase() === 'block_name');
        const shouldExclude = hasRTLVersion && hasBlockName;
        
        if (shouldExclude) {
          console.log(`?? BranchFlow: Excluding table ${table.table_name} - contains both RTL_version and Block_name columns`);
        }
        
        return !shouldExclude;
      });
    } else if (viewType === 'rtl') {
      // RTL: Include tables that have Block_name column (RTL-related tables)
      filteredTables = filteredTables.filter(table => {
        const columns = table.columns || [];
        const hasBlockName = columns.some(col => col.toLowerCase() === 'block_name');
        
        if (!hasBlockName) {
          console.log(`?? RTL: Excluding table ${table.table_name} - does not contain Block_name column`);
        }
        
        return hasBlockName;
      });
    }
    // For 'simple' view, show all tables (no filtering)

    const result = {
      tables: filteredTables,
      isConnected: userConnection.isConnected,
      lastRefresh: userConnection.lastRefresh,
      totalTables: filteredTables.length,
      viewType: viewType
    };
    
    console.log(`?? getTablesForUser: Returning ${result.totalTables} tables for user ${userId} (viewType: ${viewType})`);
    console.log(`?? Tables being returned:`, result.tables.map(t => `${t.table_name} (${t.row_count} rows)`));
    
    return result;
  }

  getConnectionStatusForUser(userId) {
    const userConnection = this.userConnections.get(userId);
    if (!userConnection) {
      console.log(`?? No connection found for user ${userId}, returning default status`);
      return {
        isConnected: false,
        host: null,
        port: null,
        database: null,
        lastRefresh: null,
        totalTables: 0,
        refreshInterval: 1
      };
    }

    // Make sure refreshInterval has a default value if undefined
    const refreshInterval = userConnection.config &&
      userConnection.config.refreshInterval !== undefined ?
      userConnection.config.refreshInterval : 1;

    const status = {
      isConnected: userConnection.isConnected || false,
      host: userConnection.config ? userConnection.config.host : null,
      port: userConnection.config ? userConnection.config.port : null,
      database: userConnection.config ? userConnection.config.database : null,
      lastRefresh: userConnection.lastRefresh,
      totalTables: userConnection.tables ? userConnection.tables.length : 0,
      refreshInterval: refreshInterval
    };

    console.log(`?? Connection status for user ${userId}:`, {
      isConnected: status.isConnected,
      host: status.host,
      totalTables: status.totalTables,
      lastRefresh: status.lastRefresh ? new Date(status.lastRefresh).toISOString() : null
    });

    return status;
  }

  async getTableDataForUser(userId, tableName, limit = 100) {
    const userConnection = this.userConnections.get(userId);
    if (!userConnection || !userConnection.isConnected || !userConnection.pool) {
      throw new Error('Database not connected');
    }

    try {
      // Get user info to determine filtering
      const userInfo = await this.getUserInfo(userId);
      if (!userInfo) {
        throw new Error('Could not get user info');
      }

      console.log(`?? Getting table data for ${tableName} - User: ${userInfo.username} (role: ${userInfo.role})`);
      const client = await userConnection.pool.connect();
      
      try {
        let dataQuery = `SELECT * FROM "${tableName}"`;
        let queryParams = [];
        
        // For non-admin users, filter by run_name if the column exists
        if (userInfo.role !== 'admin') {
          // Check if table has run_name column
          const hasRunNameQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = 'run_name'
          `;
          const hasRunNameResult = await client.query(hasRunNameQuery, [tableName]);
          
          if (hasRunNameResult.rows.length > 0) {
            dataQuery += ` WHERE run_name LIKE $1 || '%'`;
            queryParams.push(userInfo.username);
            console.log(`?? Table ${tableName} has run_name column - filtering for user pattern: ${userInfo.username}%`);
          } else {
            console.log(`?? Table ${tableName} does not have run_name column - no filtering applied`);
          }
        }
        
        dataQuery += ` LIMIT $${queryParams.length + 1}`;
        queryParams.push(limit);
        
        console.log(`?? Executing query: ${dataQuery} with params:`, queryParams);
        const result = await client.query(dataQuery, queryParams);
        console.log(`?? Query returned ${result.rows.length} rows for table ${tableName}`);
        
        return {
          table_name: tableName,
          data: result.rows,
          total_returned: result.rows.length,
          columns: result.fields ? result.fields.map(f => f.name) : []
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error getting data for table ${tableName} for user ${userId}:`, error);
      throw error;
    }
  }

  async executeQueryForUser(userId, query, params = []) {
    const userConnection = this.userConnections.get(userId);
    if (!userConnection || !userConnection.isConnected || !userConnection.pool) {
      throw new Error('Database not connected');
    }

    try {
      const client = await userConnection.pool.connect();
      
      try {
        const result = await client.query(query, params);
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error executing query for user ${userId}:`, error);
      throw error;
    }
  }

  async disconnectUser(userId) {
    console.log(`?? Disconnecting RunStatus DB for user ${userId}...`);
    
    // Stop auto-refresh first
    this.stopAutoRefreshForUser(userId);
    
    const userConnection = this.userConnections.get(userId);
    if (userConnection) {
      // Close database pool if it exists
      if (userConnection.pool) {
        try {
          await userConnection.pool.end();
          console.log(`? RunStatus database pool closed for user ${userId}`);
        } catch (error) {
          console.error(`? Error closing database pool for user ${userId}:`, error);
        }
      }
      
      // Clear the connection data
      this.userConnections.delete(userId);
      console.log(`??? Cleared connection data for user ${userId}`);
    } else {
      console.log(`?? No active connection found for user ${userId}`);
    }
    
    console.log(`? RunStatus DB disconnection completed for user ${userId}`);
  }

  // Method to reload configuration and reconnect for a user
  async reloadUserConfig(userId) {
    console.log(`Reloading Run Status Database configuration for user ${userId}...`);
    await this.disconnectUser(userId);
    await this.initializeUserConnection(userId);
  }
}

// Create singleton instance
const runStatusDbService = new RunStatusDatabaseService();

module.exports = runStatusDbService;