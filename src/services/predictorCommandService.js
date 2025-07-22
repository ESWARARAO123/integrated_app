const { db } = require('../database');
const predictionDbService = require('./predictionDbService');

class PredictorCommandService {
  constructor() {
    this.predictionDbService = predictionDbService;
  }

  /**
   * Generate welcome message for predictor mode
   */
  generateWelcomeMessage() {
    const message = `?? Predictor Mode Activated

I'm ready to help you train models and make predictions with any tables in your database!

**Quick Commands:**
 \`train <place_table> <cts_table> <route_table>\` - Train with specific tables
 \`train\` - Open training form with available tables  
 \`predict <place_table> <cts_table>\` - Generate predictions

**Examples:**
 \`train reg_place_csv reg_cts_csv reg_route_csv\`
 \`train ariane_place_sorted_csv ariane_cts_sorted_csv ariane_route_sorted_csv\`
 \`predict reg_place_csv reg_cts_csv\`

**Features:**
? Fully dynamic - works with any tables in configured database
? Auto-detects available training sets
? Real-time validation and suggestions
? Fast training - optimized for speed
? Detailed performance metrics

What would you like to do?`;

    return {
      success: true,
      message: message,
      showTrainingForm: false
    };
  }

  /**
   * Check if database is connected in frontend settings
   */
  async checkDatabaseConnection(userId) {
    try {
      // Check if prediction database settings exist in the main database
      const result = await db.query(
        'SELECT * FROM prediction_db_settings ORDER BY updated_at DESC LIMIT 1'
      );
      
      if (result.rows.length === 0) {
        return {
          connected: false,
          message: '? Please connect database in frontend settings first.\n\nGo to Settings ? Prediction Database Settings and configure your database connection.'
        };
      }
      
      const dbConfig = result.rows[0];
      
      // Check if all required fields are present
      if (!dbConfig.host || !dbConfig.database || !dbConfig.user || !dbConfig.password || !dbConfig.port) {
        return {
          connected: false,
          message: '? Database configuration is incomplete in frontend settings.\n\nGo to Settings ? Prediction Database Settings and configure your database connection.'
        };
      }
      
      return {
        connected: true,
        message: 'Database connected'
      };
      
    } catch (error) {
      console.error('Error checking database connection:', error);
      return {
        connected: false,
        message: '? Please connect database in frontend settings first.\n\nGo to Settings ? Prediction Database Settings and configure your database connection.'
      };
    }
  }

  /**
   * Process predictor commands
   */
  async processCommand(command, userId) {
    try {
      console.log(`Processing predictor command: "${command}" for user: ${userId}`);
      
      // FIRST: Check if database is connected in frontend settings
      const dbCheckResult = await this.checkDatabaseConnection(userId);
      if (!dbCheckResult.connected) {
        return {
          success: false,
          message: dbCheckResult.message
        };
      }
      
      const trimmedCommand = command.trim().toLowerCase();
      
      // Handle different command types
      if (trimmedCommand === 'train') {
        return await this.handleTrainCommand(userId);
      } else if (trimmedCommand.startsWith('train ')) {
        return await this.handleTrainWithTablesCommand(command, userId);
      } else if (trimmedCommand === 'predict') {
        return await this.handlePredictCommand(userId);
      } else if (trimmedCommand.startsWith('predict ')) {
        return await this.handlePredictWithTablesCommand(command, userId);
      } else {
        return {
          success: false,
          message: `Unknown command: "${command}". Use \`train\`, \`train <tables>\`, \`predict\`, or \`predict <tables>\`.`
        };
      }
    } catch (error) {
      console.error('Error processing predictor command:', error);
      return {
        success: false,
        message: 'Error processing command. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Handle basic train command
   */
  async handleTrainCommand(userId) {
    try {
      // Get available tables from prediction database (wait for them to load)
      const tablesResult = await this.predictionDbService.waitForTables();
      const tables = tablesResult.tables || [];
      
      if (!tables || tables.length === 0) {
        const message = tablesResult.timedOut 
          ? '? Database connection timeout. Tables are still loading, please try again in a moment.'
          : '? No tables available for training. Please check your database connection.';
        return {
          success: false,
          message: message,
          showTrainingForm: false
        };
      }

      // Filter tables that might be suitable for training
      const placeTables = tables.filter(t => t.name.toLowerCase().includes('place'));
      const ctsTables = tables.filter(t => t.name.toLowerCase().includes('cts'));
      const routeTables = tables.filter(t => t.name.toLowerCase().includes('route'));

      let message = '?? **Training Form**\n\n';
      message += '**Available Tables:**\n';
      
      if (placeTables.length > 0) {
        message += `**Place Tables:** ${placeTables.map(t => t.name).join(', ')}\n`;
      }
      if (ctsTables.length > 0) {
        message += `**CTS Tables:** ${ctsTables.map(t => t.name).join(', ')}\n`;
      }
      if (routeTables.length > 0) {
        message += `**Route Tables:** ${routeTables.map(t => t.name).join(', ')}\n`;
      }
      
      message += '\n**Usage:** `train <place_table> <cts_table> <route_table>`\n';
      message += '**Example:** `train reg_place_csv reg_cts_csv reg_route_csv`';

      return {
        success: true,
        message: message,
        showTrainingForm: true,
        availableTables: tables
      };
    } catch (error) {
      console.error('Error handling train command:', error);
      return {
        success: false,
        message: '? Error retrieving available tables. Please check your database connection.',
        error: error.message
      };
    }
  }

  /**
   * Handle train command with specific tables
   */
  async handleTrainWithTablesCommand(command, userId) {
    try {
      // Parse the command to extract table names
      const parts = command.trim().split(/\s+/);
      if (parts.length !== 4) {
        return {
          success: false,
          message: '? Invalid train command format. Use: `train <place_table> <cts_table> <route_table>`'
        };
      }

      const [, placeTable, ctsTable, routeTable] = parts;
      
      console.log(`Training with tables: ${placeTable}, ${ctsTable}, ${routeTable}`);
      
      // Skip table validation for now - directly call training service
      // In production, you would validate tables exist in PostgreSQL
      
      // Start training process
      console.log(`Starting training process for user ${userId} with tables: ${placeTable}, ${ctsTable}, ${routeTable}`);
      const trainingResult = await this.startTraining(placeTable, ctsTable, routeTable, userId);
      
      console.log('Training result received:', {
        success: trainingResult.success,
        hasMessage: !!trainingResult.message,
        hasModelId: !!trainingResult.model_id,
        hasMetrics: !!trainingResult.training_metrics
      });
      
      if (trainingResult.success) {
        // Show training in progress message first
        const progressMessage = `?? **Training in Progress**

**Tables:**
 Place: ${placeTable}
 CTS: ${ctsTable}  
 Route: ${routeTable}

Training is now in progress... This may take a few minutes.`;

        console.log('Final training response message:', progressMessage);

        return {
          success: true,
          message: progressMessage,
          model_id: trainingResult.model_id,
          training_metrics: trainingResult.training_metrics,
          followupMessage: {
            message: `? **Training Complete!**

**Tables Used:**
 Place: ${placeTable}
 CTS: ${ctsTable}  
 Route: ${routeTable}

${trainingResult.message || 'Model has been trained successfully.'}

?? **You can now use prediction commands!**
Example: \`predict ${placeTable} ${ctsTable}\``,
            isTrainingComplete: true,
            showDownloadButton: false
          }
        };
      } else {
        console.log('Training failed:', trainingResult.message);
        return {
          success: false,
          message: `? **Training Failed**\n\n${trainingResult.message || 'Unknown error occurred'}`
        };
      }
    } catch (error) {
      console.error('Error handling train with tables command:', error);
      return {
        success: false,
        message: '? Error starting training process. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Handle basic predict command
   */
  async handlePredictCommand(userId) {
    return {
      success: true,
      message: '?? **Prediction Mode**\n\n**Usage:**\n`predict <place_table> <cts_table>`\n\n**Examples:**\n `predict reg_place_csv reg_cts_csv`\n `predict ariane_place_sorted_csv ariane_cts_sorted_csv`\n\n**Note:** Both place and cts tables are required for predictions.'
    };
  }

  /**
   * Handle predict command with specific tables
   */
  async handlePredictWithTablesCommand(command, userId) {
    try {
      // Parse the command to extract table names
      const parts = command.trim().split(/\s+/);
      if (parts.length < 2 || parts.length > 3) {
        return {
          success: false,
          message: '? Invalid predict command format. Use:\n `predict <table>` - for single table prediction\n `predict <place_table> <cts_table>` - for dual table prediction'
        };
      }

      let placeTable, ctsTable;
      
      if (parts.length === 2) {
        // ALWAYS USE DUAL TABLE LOGIC - Find appropriate place and CTS tables
        const [, tableName] = parts;
        
        if (tableName.toLowerCase().includes('place')) {
          // Place table provided - use place table for place_slack, find CTS table for cts_slack
          placeTable = tableName;
          ctsTable = tableName.replace(/place/gi, 'cts'); // Try to find corresponding CTS table
          console.log(`Auto dual table prediction: place=${placeTable}, cts=${ctsTable}`);
        } else if (tableName.toLowerCase().includes('cts')) {
          // CTS table provided - find place table for place_slack, use CTS table for cts_slack
          placeTable = tableName.replace(/cts/gi, 'place'); // Try to find corresponding place table
          ctsTable = tableName;
          console.log(`Auto dual table prediction: place=${placeTable}, cts=${ctsTable}`);
        } else {
          // Generic table name - assume it's a place table and find CTS equivalent
          placeTable = tableName;
          ctsTable = tableName.replace(/place/gi, 'cts'); // Try to find CTS equivalent
          console.log(`Auto dual table prediction (generic): place=${placeTable}, cts=${ctsTable}`);
        }
      } else {
        // Explicit dual table prediction
        const [, place, cts] = parts;
        placeTable = place;
        ctsTable = cts;
        console.log(`Explicit dual table prediction: place=${placeTable}, cts=${ctsTable}`);
      }
      
      console.log(`Generating predictions with tables: ${placeTable}, ${ctsTable}`);
      
      // Skip table validation for now - directly call prediction service
      // In production, you would validate tables exist in PostgreSQL
      
      // Start prediction process
      console.log(`Starting prediction process for user ${userId} with tables: ${placeTable}, ${ctsTable}`);
      const predictionResult = await this.startPrediction(placeTable, ctsTable, userId);
      
      console.log('Prediction result received:', {
        success: predictionResult.success,
        hasMessage: !!predictionResult.message,
        hasData: !!predictionResult.data,
        hasMetrics: !!predictionResult.metrics,
        totalPredictions: predictionResult.total_predictions
      });
      
      if (predictionResult.success) {
        // Use the actual message from the Python API
        let message = predictionResult.message || `?? **Prediction Started**

**Tables:**
 Place: ${placeTable}
 CTS: ${ctsTable}

Generating predictions... This may take a moment.`;

        // Add metrics information if available
        if (predictionResult.metrics) {
          message += `\n\n?? **Prediction Metrics:**`;
          if (predictionResult.metrics.route_r2 !== null && predictionResult.metrics.route_r2 !== undefined) {
            message += `\n R² Score: ${predictionResult.metrics.route_r2.toFixed(3)}`;
          }
          if (predictionResult.metrics.route_mae !== null && predictionResult.metrics.route_mae !== undefined) {
            message += `\n Mean Absolute Error: ${predictionResult.metrics.route_mae.toFixed(3)}`;
          }
        }

        // Add prediction count if available
        if (predictionResult.total_predictions) {
          message += `\n\n?? **Generated ${predictionResult.total_predictions} predictions**`;
        }

        // Add output table information if available
        if (predictionResult.output_table_name) {
          message += `\n\n?? **Results stored in table:** ${predictionResult.output_table_name}`;
        }

        console.log('Final prediction response message:', message);

        // Generate CSV data directly from prediction results
        let csvData = null;
        if (predictionResult.data && predictionResult.data.length > 0) {
          csvData = this.convertToCsv(predictionResult.data);
        }

        return {
          success: true,
          message: message,
          predictions: predictionResult.data || predictionResult.predictions, // Use data field which contains the actual predictions
          data: predictionResult.data,
          metrics: predictionResult.metrics,
          total_predictions: predictionResult.total_predictions,
          output_table_name: predictionResult.output_table_name,
          csvData: csvData, // Include CSV data directly
          // Remove followupMessage to prevent extra "results generated" message
        };
      } else {
        console.log('Prediction failed:', predictionResult.message);
        return {
          success: false,
          message: `? **Prediction Failed**\n\n${predictionResult.message || 'Unknown error occurred'}`
        };
      }
    } catch (error) {
      console.error('Error handling predict with tables command:', error);
      return {
        success: false,
        message: '? Error generating predictions. Please try again.',
        error: error.message
      };
    }
  }

  /**
   * Start training process using actual prediction service
   */
  async startTraining(placeTable, ctsTable, routeTable, userId) {
    try {
      console.log(`Starting training for user ${userId} with tables: ${placeTable}, ${ctsTable}, ${routeTable}`);
      
      // Call the actual prediction service
      const trainingResult = await this.predictionDbService.trainModel(placeTable, ctsTable, routeTable);
      
      if (trainingResult.success) {
        return {
          success: true,
          message: trainingResult.message || 'Training completed successfully',
          model_id: trainingResult.model_id,
          training_metrics: trainingResult.training_metrics
        };
      } else {
        return {
          success: false,
          message: trainingResult.message || 'Training failed'
        };
      }
    } catch (error) {
      console.error('Error in training process:', error);
      return {
        success: false,
        message: error.message || 'Training failed due to an error'
      };
    }
  }

  /**
   * Start prediction process using actual prediction service
   */
  async startPrediction(placeTable, ctsTable, userId) {
    try {
      console.log(`Starting prediction for user ${userId} with tables: ${placeTable}, ${ctsTable}`);
      
      // Call the actual prediction service
      const predictionResult = await this.predictionDbService.generatePredictions(placeTable, ctsTable);
      
      console.log('Raw prediction result from predictionDbService:', {
        success: predictionResult.success,
        messageLength: predictionResult.message ? predictionResult.message.length : 0,
        hasData: !!predictionResult.data,
        dataLength: predictionResult.data ? predictionResult.data.length : 0,
        hasMetrics: !!predictionResult.metrics,
        totalPredictions: predictionResult.total_predictions,
        outputTableName: predictionResult.output_table_name
      });
      
      if (predictionResult.success) {
        return {
          success: true,
          message: predictionResult.message || 'Predictions generated successfully',
          predictions: predictionResult.predictions,
          data: predictionResult.data,
          metrics: predictionResult.metrics,
          total_predictions: predictionResult.total_predictions,
          output_table_name: predictionResult.output_table_name,
          endpoint_info: predictionResult.endpoint_info
        };
      } else {
        return {
          success: false,
          message: predictionResult.message || 'Prediction failed'
        };
      }
    } catch (error) {
      console.error('Error in prediction process:', error);
      return {
        success: false,
        message: error.message || 'Prediction failed due to an error'
      };
    }
  }

  /**
   * Convert prediction data to CSV format
   */
  convertToCsv(data) {
    if (!data || data.length === 0) {
      return '';
    }

    // Get headers from the first row
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvRows = [];
    
    // Add header row
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
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
    }
    
    return csvRows.join('\n');
  }
}

module.exports = new PredictorCommandService();