const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { db } = require('../database');
const axios = require('axios');

class PredictionDatabaseService {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.tables = [];
    this.refreshInterval = null;
    this.lastRefresh = null;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.config = null;
    
    // Initialize the service
    this.initialize();
  }

  async initialize() {
    console.log('Initializing Prediction Database Service...');
    
    try {
      // Load configuration from database
      await this.loadConfigFromDatabase();
      
      if (this.config) {
        await this.connect();
        this.startAutoRefresh();
      } else {
        console.log('No prediction database configuration found');
      }
    } catch (error) {
      console.error('Error initializing Prediction Database Service:', error);
    }
  }

  async loadConfigFromDatabase(userId = null) {
    try {
      let result;
      
      if (userId) {
        // Get configuration for specific user
        result = await db.prepare(
          'SELECT host, port, database, "user", password FROM prediction_db_settings WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1'
        ).get(userId);
      } else {
        // Get the most recent configuration from prediction_db_settings table
        result = await db.prepare(
          'SELECT host, port, database, "user", password FROM prediction_db_settings ORDER BY updated_at DESC LIMIT 1'
        ).get();
      }
      
      if (result) {
        this.config = {
          host: result.host,
          port: parseInt(result.port) || 5432,
          database: result.database,
          user: result.user,
          password: result.password,
          refreshInterval: 60, // 60 seconds
          max: 10,
          connectionTimeoutMillis: 10000,
          idleTimeoutMillis: 30000,
          ssl: false
        };
        console.log('Loaded prediction database config:', {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user
        });
      }
    } catch (error) {
      console.error('Error loading prediction database config:', error);
      this.config = null;
    }
  }

  async connect() {
    if (!this.config) {
      console.log('No prediction database configuration available');
      return false;
    }

    try {
      console.log(`Connecting to prediction database: ${this.config.host}:${this.config.port}/${this.config.database}`);
      
      if (this.pool) {
        await this.pool.end();
      }

      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: this.config.max,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        ssl: this.config.ssl
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isConnected = true;
      this.connectionAttempts = 0;
      console.log('Successfully connected to prediction database');

      // Initial table refresh
      await this.refreshTables();
      
      return true;
    } catch (error) {
      console.error('Error connecting to prediction database:', error);
      this.isConnected = false;
      this.connectionAttempts++;
      
      if (this.pool) {
        try {
          await this.pool.end();
        } catch (endError) {
          console.error('Error closing pool:', endError);
        }
        this.pool = null;
      }
      
      return false;
    }
  }

  async disconnect() {
    try {
      this.stopAutoRefresh();
      
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      
      this.isConnected = false;
      this.tables = [];
      this.config = null;
      this.lastRefresh = null;
      
      console.log('Disconnected from prediction database');
      return true;
    } catch (error) {
      console.error('Error disconnecting from prediction database:', error);
      return false;
    }
  }

  async refreshTables() {
    if (!this.isConnected || !this.pool) {
      console.log('Cannot refresh tables: not connected to prediction database');
      return;
    }

    try {
      console.log('Refreshing prediction database tables...');
      const client = await this.pool.connect();
      
      try {
        // Get all tables with detailed information
        const query = `
          SELECT 
            t.table_name,
            t.table_schema,
            pg_size_pretty(pg_total_relation_size(c.oid)) as table_size,
            pg_stat_get_tuples_inserted(c.oid) + pg_stat_get_tuples_updated(c.oid) + pg_stat_get_tuples_deleted(c.oid) as total_operations,
            pg_stat_get_tuples_inserted(c.oid) as inserts,
            pg_stat_get_tuples_updated(c.oid) as updates,
            pg_stat_get_tuples_deleted(c.oid) as deletes,
            pg_stat_get_live_tuples(c.oid) as row_count,
            obj_description(c.oid) as table_comment,
            pg_get_userbyid(c.relowner) as owner,
            c.relhasindex as has_indexes,
            c.relhasrules as has_rules,
            c.relhastriggers as has_triggers,
            COALESCE(pg_stat_get_last_analyze_time(c.oid), pg_stat_get_last_autoanalyze_time(c.oid)) as last_analyzed
          FROM information_schema.tables t
          LEFT JOIN pg_class c ON c.relname = t.table_name
          WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
          ORDER BY t.table_name;
        `;
        
        const result = await client.query(query);
        
        // Get column information for each table and analyze suitability
        const tablesWithAnalysis = await Promise.all(
          result.rows.map(async (row) => {
            try {
              // Get column information
              const columnsResult = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = $1 AND table_schema = 'public'
                ORDER BY ordinal_position
              `, [row.table_name]);

              const columns = columnsResult.rows.map(col => ({
                name: col.column_name,
                type: col.data_type,
                nullable: col.is_nullable === 'YES'
              }));

              // Analyze table suitability for prediction
              const suitability = this.analyzeTableSuitability(row.table_name, columns);

              return {
                id: `${row.table_schema}.${row.table_name}`,
                filename: row.table_name,
                table_name: row.table_name,
                schema_name: row.table_schema,
                upload_date: row.last_analyzed || new Date().toISOString(),
                file_size: row.table_size || '0 bytes',
                file_type: 'table',
                owner: row.owner,
                has_indexes: row.has_indexes,
                has_rules: row.has_rules,
                has_triggers: row.has_triggers,
                row_count: parseInt(row.row_count) || 0,
                last_updated: row.last_analyzed || new Date().toISOString(),
                columns: columns,
                all_columns: columns.map(c => c.name),
                ...suitability
              };
            } catch (error) {
              console.error(`Error analyzing table ${row.table_name}:`, error);
              return {
                id: `${row.table_schema}.${row.table_name}`,
                filename: row.table_name,
                table_name: row.table_name,
                schema_name: row.table_schema,
                upload_date: row.last_analyzed || new Date().toISOString(),
                file_size: row.table_size || '0 bytes',
                file_type: 'table',
                owner: row.owner,
                has_indexes: row.has_indexes,
                has_rules: row.has_rules,
                has_triggers: row.has_triggers,
                row_count: parseInt(row.row_count) || 0,
                last_updated: row.last_analyzed || new Date().toISOString(),
                columns: [],
                all_columns: [],
                table_type: 'unknown',
                suitable_for_training: false,
                missing_features: ['Unable to analyze columns'],
                has_required_features: false
              };
            }
          })
        );

        this.tables = tablesWithAnalysis;
        
        // Detect training sets
        this.detectTrainingSets();

        this.lastRefresh = new Date().toISOString();
        console.log(`Refreshed ${this.tables.length} prediction database tables with analysis`);
        
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error refreshing prediction database tables:', error);
      // Don't throw error, just log it
    }
  }

  analyzeTableSuitability(tableName, columns) {
    const columnNames = columns.map(c => c.name.toLowerCase());
    const name = tableName.toLowerCase();
    
    // Detect table type based on name patterns
    let tableType = 'unknown';
    if (name.includes('place') || name.includes('location') || name.includes('station')) {
      tableType = 'place';
    } else if (name.includes('cts') || name.includes('schedule') || name.includes('time')) {
      tableType = 'cts';
    } else if (name.includes('route') || name.includes('path') || name.includes('journey')) {
      tableType = 'route';
    }

    // Check for required features for prediction
    const hasEndpoint = columnNames.includes('endpoint');
    const hasSlack = columnNames.includes('slack');
    const hasRequiredFeatures = hasEndpoint && hasSlack;

    const missingFeatures = [];
    if (!hasEndpoint) missingFeatures.push('endpoint');
    if (!hasSlack) missingFeatures.push('slack');

    return {
      table_type: tableType,
      has_endpoint: hasEndpoint,
      has_slack: hasSlack,
      has_required_features: hasRequiredFeatures,
      missing_features: missingFeatures,
      suitable_for_training: hasRequiredFeatures && tableType !== 'unknown'
    };
  }

  detectTrainingSets() {
    if (!this.tables || this.tables.length === 0) {
      this.trainingSets = [];
      return;
    }

    // Group tables by potential training sets
    const placeTables = this.tables.filter(t => t.table_type === 'place' && t.suitable_for_training);
    const ctsTables = this.tables.filter(t => t.table_type === 'cts' && t.suitable_for_training);
    const routeTables = this.tables.filter(t => t.table_type === 'route' && t.suitable_for_training);

    this.trainingSets = [];

    // Try to match tables by common prefixes/patterns
    const patterns = new Set();
    
    [...placeTables, ...ctsTables, ...routeTables].forEach(table => {
      const pattern = this.extractTablePattern(table.table_name);
      if (pattern) patterns.add(pattern);
    });

    patterns.forEach(pattern => {
      const placeTable = placeTables.find(t => this.extractTablePattern(t.table_name) === pattern);
      const ctsTable = ctsTables.find(t => this.extractTablePattern(t.table_name) === pattern);
      const routeTable = routeTables.find(t => this.extractTablePattern(t.table_name) === pattern);

      if (placeTable && ctsTable && routeTable) {
        this.trainingSets.push({
          group_name: pattern || 'default',
          place_table: placeTable.table_name,
          cts_table: ctsTable.table_name,
          route_table: routeTable.table_name,
          total_rows: {
            place: placeTable.row_count,
            cts: ctsTable.row_count,
            route: routeTable.row_count
          }
        });
      }
    });

    console.log(`Detected ${this.trainingSets.length} complete training sets`);
  }

  extractTablePattern(tableName) {
    let pattern = tableName.toLowerCase();
    
    // Remove common suffixes and prefixes to find the base pattern
    pattern = pattern
      .replace(/_(place|cts|route)(_csv)?$/gi, '')
      .replace(/^(place|cts|route)_/gi, '')
      .replace(/_csv$/gi, '')
      .replace(/[_\-\.]+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    return pattern || null;
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    if (this.config && this.config.refreshInterval > 0) {
      console.log(`Starting auto-refresh every ${this.config.refreshInterval} seconds`);
      this.refreshInterval = setInterval(() => {
        this.refreshTables();
      }, this.config.refreshInterval * 1000);
    }
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('Auto-refresh stopped');
    }
  }

  getTables() {
    return {
      tables: this.tables,
      isConnected: this.isConnected,
      lastRefresh: this.lastRefresh,
      totalTables: this.tables.length
    };
  }

  getEnhancedTables() {
    const suitableForTraining = this.tables.filter(t => t.suitable_for_training).length;
    
    return {
      status: 'success',
      total_tables: this.tables.length,
      suitable_for_training: suitableForTraining,
      all_tables: this.tables,
      detected_table_groups: this.groupTablesByPattern(),
      complete_training_sets: this.trainingSets || [],
      required_columns: {
        mandatory: ['endpoint', 'slack'],
        features: ['endpoint', 'slack']
      },
      message: `Found ${this.tables.length} tables, ${suitableForTraining} suitable for training, ${this.trainingSets?.length || 0} complete training sets detected`,
      example_usage: this.generateExampleUsage(),
      instructions: {
        training: 'Select a complete training set or choose individual tables with required columns (endpoint, slack)',
        adding_new_tables: 'Ensure your tables have the required columns: endpoint, slack',
        feature_columns_required: ['endpoint', 'slack']
      },
      isConnected: this.isConnected,
      lastRefresh: this.lastRefresh
    };
  }

  groupTablesByPattern() {
    const groups = {};
    
    this.tables.forEach(table => {
      const pattern = this.extractTablePattern(table.table_name);
      if (pattern) {
        if (!groups[pattern]) {
          groups[pattern] = {
            place: [],
            cts: [],
            route: [],
            other: []
          };
        }
        
        if (table.table_type && groups[pattern][table.table_type]) {
          groups[pattern][table.table_type].push(table);
        } else {
          groups[pattern].other.push(table);
        }
      }
    });
    
    return groups;
  }

  generateExampleUsage() {
    if (this.trainingSets && this.trainingSets.length > 0) {
      const firstSet = this.trainingSets[0];
      return {
        train_command: `train ${firstSet.place_table} ${firstSet.cts_table} ${firstSet.route_table}`,
        predict_command: `predict ${firstSet.place_table} ${firstSet.cts_table}`,
        available_sets: this.trainingSets.map(set => ({
          name: set.group_name,
          tables: {
            place: set.place_table,
            cts: set.cts_table,
            route: set.route_table
          }
        }))
      };
    }
    
    return {
      message: 'No complete training sets found. Please ensure your database has tables with required columns.',
      required_pattern: 'Tables should follow naming pattern like: prefix_place_csv, prefix_cts_csv, prefix_route_csv'
    };
  }

  async waitForTables(maxWaitTime = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      if (this.isConnected && this.tables.length > 0) {
        return {
          tables: this.tables,
          isConnected: this.isConnected,
          lastRefresh: this.lastRefresh,
          totalTables: this.tables.length
        };
      }
      
      // Wait 500ms before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Return current state even if not fully ready
    return {
      tables: this.tables,
      isConnected: this.isConnected,
      lastRefresh: this.lastRefresh,
      totalTables: this.tables.length,
      timedOut: true
    };
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      host: this.config?.host || '',
      port: this.config?.port || 5432,
      database: this.config?.database || '',
      lastRefresh: this.lastRefresh,
      totalTables: this.tables.length,
      refreshInterval: this.config?.refreshInterval || 60
    };
  }

  async reloadConfiguration() {
    console.log('Reloading prediction database configuration...');
    
    // Disconnect current connection if exists
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
        this.isConnected = false;
        console.log('Disconnected from previous database');
      } catch (error) {
        console.error('Error disconnecting from previous database:', error);
      }
    }

    // Stop auto refresh
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // Load new configuration
    await this.loadConfigFromDatabase();
    
    // Connect with new configuration
    if (this.config) {
      await this.connect();
      this.startAutoRefresh();
      console.log('Successfully reloaded and reconnected with new configuration');
    } else {
      console.log('No configuration found after reload');
    }
  }

  async getTableData(tableName, limit = 100) {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const client = await this.pool.connect();
      
      try {
        // Get table structure
        const structureQuery = `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position;
        `;
        
        const structureResult = await client.query(structureQuery, [tableName]);
        
        // Get sample data
        const dataQuery = `SELECT * FROM "${tableName}" LIMIT $1`;
        const dataResult = await client.query(dataQuery, [limit]);
        
        return {
          structure: structureResult.rows,
          data: dataResult.rows,
          totalRows: dataResult.rowCount
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error getting table data for ${tableName}:`, error);
      throw error;
    }
  }

  async updateConfig(newConfig) {
    try {
      // Disconnect from current database
      await this.disconnect();
      
      // Update configuration
      this.config = {
        ...newConfig,
        refreshInterval: 60,
        max: 10,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        ssl: false
      };
      
      // Try to connect with new configuration
      const connected = await this.connect();
      
      if (connected) {
        this.startAutoRefresh();
        return { success: true, message: 'Database configuration updated successfully' };
      } else {
        return { success: false, message: 'Failed to connect with new configuration' };
      }
    } catch (error) {
      console.error('Error updating prediction database config:', error);
      return { success: false, message: error.message };
    }
  }

  getConfig() {
    return this.config || {
      host: '',
      port: 5432,
      database: '',
      user: '',
      password: '',
      refreshInterval: 60,
      max: 10,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      ssl: false
    };
  }

  // Training and prediction methods
  async trainModel(placeTable, ctsTable, routeTable) {
    try {
      console.log(`Training model with tables: ${placeTable}, ${ctsTable}, ${routeTable}`);
      
      // For now, skip database connection check and directly call Python service
      // In production, you would verify tables exist in the PostgreSQL database
      
      // Call the actual prediction.py service
      console.log('Calling prediction.py service for training...');
      const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://127.0.0.1:8088';
      
      let response;
      try {
        response = await axios.post(`${PREDICTION_SERVICE_URL}/slack-prediction/train`, {
          place_table: placeTable,
          cts_table: ctsTable,
          route_table: routeTable
        }, {
          timeout: 300000, // 5 minutes timeout for training
          headers: {
            'Content-Type': 'application/json',
            'x-username': 'default' // Add username header for Python API
          }
        });
      } catch (axiosError) {
        console.error('Error calling Python prediction service:', axiosError.message);
        
        if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
          throw new Error(`? **Training Service Unavailable**

The Python prediction service is not running or not accessible at ${PREDICTION_SERVICE_URL}.

**To fix this:**
1. Start the Python prediction service
2. Check if the service is running on port 8088
3. Verify database connectivity

**Service Status:** Connection refused`);
        } else if (axiosError.code === 'ECONNRESET' || axiosError.message.includes('timeout')) {
          throw new Error(`? **Training Timeout**

The training process took too long to complete or the connection was reset.

**This might be due to:**
- Large dataset size
- Database connectivity issues
- Service overload

Please try again with a smaller dataset or check the service logs.`);
        } else {
          throw new Error(`? **Training Service Error**

Failed to communicate with the prediction service.

**Error:** ${axiosError.message}

Please check the service logs and try again.`);
        }
      }

      console.log('Python API training response status:', response.data.status);
      console.log('Python API training response keys:', Object.keys(response.data));
      console.log('Python API training response sample:', {
        status: response.data.status,
        messageLength: response.data.message ? response.data.message.length : 0,
        hasMetrics: !!(response.data.training_metrics || response.data.place_to_cts),
        trainingTime: response.data.training_time
      });

      if (response.data.status === 'success') {
        console.log('Training completed successfully:', response.data.message);
        return {
          success: true,
          message: response.data.message,
          model_id: response.data.model_id,
          training_metrics: response.data.training_metrics || {
            place_to_cts: response.data.place_to_cts,
            combined_to_route: response.data.combined_to_route,
            training_time: response.data.training_time
          }
        };
      } else {
        throw new Error(response.data.error || response.data.message || 'Training failed');
      }
    } catch (error) {
      console.error('Error training model:', error);
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Prediction service is not running. Please start the prediction service first.');
      }
      throw error;
    }
  }

  async predict(placeTable, ctsTable) {
    return this.generatePredictions(placeTable, ctsTable);
  }

  async generatePredictions(placeTable, ctsTable) {
    try {
      console.log(`Generating predictions with tables: ${placeTable}, ${ctsTable}`);
      
      // For now, skip database connection check and directly call Python service
      // In production, you would verify tables exist in the PostgreSQL database
      
      // Call the actual prediction.py service
      console.log('Calling prediction.py service for predictions...');
      const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://127.0.0.1:8088';
      
      let response;
      try {
        response = await axios.post(`${PREDICTION_SERVICE_URL}/slack-prediction/predict`, {
          place_table: placeTable,
          cts_table: ctsTable
        }, {
          timeout: 60000, // 1 minute timeout for predictions
          headers: {
            'Content-Type': 'application/json',
            'x-username': 'default' // Add username header for Python API
          }
        });
      } catch (axiosError) {
        console.error('Error calling Python prediction service:', axiosError.message);
        
        if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
          throw new Error(`? **Prediction Service Unavailable**

The Python prediction service is not running or not accessible at ${PREDICTION_SERVICE_URL}.

**To fix this:**
1. Start the Python prediction service
2. Check if the service is running on port 8088
3. Verify database connectivity

**Service Status:** Connection refused`);
        } else if (axiosError.code === 'ECONNRESET' || axiosError.message.includes('timeout')) {
          throw new Error(`? **Prediction Timeout**

The prediction process took too long to complete or the connection was reset.

**This might be due to:**
- Large dataset size
- Database connectivity issues
- Service overload

Please try again with a smaller dataset or check the service logs.`);
        } else {
          throw new Error(`? **Prediction Service Error**

Failed to communicate with the prediction service.

**Error:** ${axiosError.message}

Please check the service logs and try again.`);
        }
      }

      console.log('Python API response status:', response.data.status);
      console.log('Python API response keys:', Object.keys(response.data));
      console.log('Python API response data sample:', {
        status: response.data.status,
        messageLength: response.data.message ? response.data.message.length : 0,
        hasData: !!response.data.data,
        dataLength: response.data.data ? response.data.data.length : 0,
        totalPredictions: response.data.total_predictions,
        outputTableName: response.data.output_table_name
      });

      if (response.data.status === 'success') {
        console.log('Predictions generated successfully');
        return {
          success: true,
          message: response.data.message,
          predictions: response.data.predictions,
          data: response.data.data,
          metrics: response.data.metrics,
          endpoint_info: response.data.endpoint_info,
          total_predictions: response.data.total_predictions,
          output_table_name: response.data.output_table_name
        };
      } else {
        throw new Error(response.data.error || response.data.message || 'Prediction failed');
      }
    } catch (error) {
      console.error('Error generating predictions:', error);
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Prediction service is not running. Please start the prediction service first.');
      }
      throw error;
    }
  }
}

// Create singleton instance
const predictionDbService = new PredictionDatabaseService();

module.exports = predictionDbService;