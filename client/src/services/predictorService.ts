import { api } from './api';
// import { getUsername } from '../utils/chat2sqlApi'; // Commented out as it's not exported

export interface TableInfo {
  table_name: string;
  row_count: number;
  has_endpoint: boolean;
  has_slack: boolean;
  has_required_features: boolean;
  missing_features: string[];
  suitable_for_training: boolean;
  all_columns: string[];
}

export interface TrainingSet {
  group_name: string;
  place_table: string;
  cts_table: string;
  route_table: string;
  total_rows: {
    place: number;
    cts: number;
    route: number;
  };
}

export interface AvailableTablesResponse {
  status: string;
  total_tables: number;
  suitable_for_training: number;
  all_tables: TableInfo[];
  detected_table_groups: Record<string, any>;
  complete_training_sets: TrainingSet[];
  required_columns: {
    mandatory: string[];
    features: string[];
  };
  message: string;
  example_usage: Record<string, any>;
  instructions: {
    training: string;
    adding_new_tables: string;
    feature_columns_required: string[];
  };
}

export interface TrainRequest {
  place_table: string;
  cts_table: string;
  route_table: string;
}

export interface PredictRequest {
  place_table?: string;
  cts_table?: string;
}

// Helper functions for table processing
const detectTableType = (tableName: string): 'place' | 'cts' | 'route' | 'unknown' => {
  const name = tableName.toLowerCase();
  
  // Check for place table patterns
  if (name.includes('place') || name.includes('location') || name.includes('station')) {
    return 'place';
  }
  
  // Check for CTS table patterns
  if (name.includes('cts') || name.includes('schedule') || name.includes('time')) {
    return 'cts';
  }
  
  // Check for route table patterns
  if (name.includes('route') || name.includes('path') || name.includes('journey')) {
    return 'route';
  }
  
  return 'unknown';
};

// Extract base pattern from table name - works with any naming convention
const extractBasePattern = (tableName: string): string => {
  let pattern = tableName.toLowerCase();
  
  // Remove common table type indicators
  pattern = pattern
    .replace(/place|location|station/gi, '')
    .replace(/cts|schedule|time/gi, '')
    .replace(/route|path|journey/gi, '')
    .replace(/\.csv$/gi, '')
    .replace(/_csv$/gi, '')
    .replace(/^(reg|ariane|test|dev|prod)_/gi, '$1')
    .replace(/_(reg|ariane|test|dev|prod)$/gi, '$1')
    .replace(/[_\-\.]+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  return pattern;
};

// Check if two patterns match - flexible matching
const patternsMatch = (pattern1: string, pattern2: string): boolean => {
  if (!pattern1 || !pattern2) return false;
  
  // Exact match
  if (pattern1 === pattern2) return true;
  
  // One contains the other
  if (pattern1.includes(pattern2) || pattern2.includes(pattern1)) return true;
  
  // Similar patterns (at least 70% similarity)
  const similarity = calculateSimilarity(pattern1, pattern2);
  return similarity >= 0.7;
};

// Calculate similarity between two strings
const calculateSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

// Calculate Levenshtein distance
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

// Find related tables using intelligent pattern matching - completely dynamic
const findRelatedTablesByPattern = (inputTable: string, availableTables: AvailableTablesResponse): { place?: string; cts?: string; route?: string } => {
  const inputName = inputTable.toLowerCase();
  
  // Extract base pattern from input table name
  const basePattern = extractBasePattern(inputName);
  const inputTableType = detectTableType(inputTable);
  
  let placeTable, ctsTable, routeTable;
  
  // Find tables with similar base patterns
  for (const table of availableTables.all_tables) {
    const tableName = table.table_name.toLowerCase();
    const tableBasePattern = extractBasePattern(tableName);
    const tableType = detectTableType(table.table_name);
    
    // Check if tables share the same base pattern
    if (patternsMatch(basePattern, tableBasePattern)) {
      if (tableType === 'place' && !placeTable) {
        placeTable = table.table_name;
      } else if (tableType === 'cts' && !ctsTable) {
        ctsTable = table.table_name;
      } else if (tableType === 'route' && !routeTable) {
        routeTable = table.table_name;
      }
    }
  }
  
  // If input table is one of the types, include it in the result
  if (inputTableType === 'place') placeTable = inputTable;
  else if (inputTableType === 'cts') ctsTable = inputTable;
  else if (inputTableType === 'route') routeTable = inputTable;
  
  return { place: placeTable, cts: ctsTable, route: routeTable };
};

// Training session storage
const TRAINING_SESSION_KEY = 'predictor_last_training_session';

export const predictorService = {
  // Get all available tables from the database
  getAvailableTables: async (): Promise<AvailableTablesResponse> => {
    try {
      console.log('?? Fetching available tables from backend API...');
      const response = await api.get('/prediction-db/tables/enhanced');
      const result = response.data;
      
      console.log('? Available tables fetched successfully:', {
        total_tables: result.total_tables,
        suitable_for_training: result.suitable_for_training,
        complete_training_sets: result.complete_training_sets?.length || 0
      });
      return result;
    } catch (error) {
      console.error('? Error fetching available tables from backend:', error);
      
      // Fallback to Python API if backend fails
      try {
        console.log('?? Trying fallback to Python API...');
        const response = await fetch('http://127.0.0.1:8088/available-tables');
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        console.log('? Available tables fetched from Python API fallback');
        return result;
      } catch (fallbackError) {
        console.error('? Both backend and Python API failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  },

  // Check database status
  getDatabaseStatus: async (): Promise<any> => {
    try {
      console.log('?? Checking database status from backend...');
      const response = await api.get('/prediction-db/status');
      const result = response.data;
      
      // Transform backend response to match expected format
      const status = {
        configured: result.success && result.connection?.isConnected,
        connected: result.connection?.isConnected || false,
        message: result.connection?.isConnected ? 'Database connected successfully' : 'Database not connected',
        host: result.connection?.host,
        port: result.connection?.port,
        database: result.connection?.database,
        total_tables: result.connection?.totalTables || 0
      };
      
      console.log('?? Database status:', status);
      return status;
    } catch (error) {
      console.error('? Error checking database status from backend:', error);
    
      // Fallback to Python API
        try {
        console.log('?? Trying fallback to Python API for database status...');
        const response = await fetch('http://127.0.0.1:8088/database-status');
        const result = await response.json();
        console.log('?? Database status from Python API fallback:', result);
        return result;
      } catch (fallbackError) {
        console.error('? Both backend and Python API failed for database status:', fallbackError);
        return {
          configured: false,
          connected: false,
          message: 'Unable to check database status'
        };
      }
    }
  },

  // Train model with specified tables
  trainModel: async (request: TrainRequest): Promise<any> => {
    try {
      console.log('?? Training model via backend API with request:', request);
      const response = await api.post('/prediction-db/train', request);
      console.log('? Training response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error training model:', error);
      throw error;
    }
  },

  // Make predictions with specified tables
  predict: async (request: PredictRequest): Promise<any> => {
    try {
      // Add debugging to see what's being sent to the backend
      console.log('?? Making prediction request via backend API with tables:', {
        place_table: request.place_table,
        cts_table: request.cts_table
      });

      // Validate request - if tables exist but either one is undefined, log warning
      if ((request.place_table && !request.cts_table) || (!request.place_table && request.cts_table)) {
        console.warn('?? Making prediction with only one table specified:', request);
      }

      const response = await api.post('/prediction-db/predict', request);
      const result = response.data;

      // Log received prediction data
      console.log('?? Received prediction response:', {
        status: result.status,
        metrics: result.metrics,
        predictions_count: result.data?.length || 0
      });

      return result;
    } catch (error) {
      console.error('Error making prediction:', error);
      throw error;
    }
  },

  // Parse table names from user command - completely dynamic
  parseTableNamesFromCommand: (command: string): { place?: string; cts?: string; route?: string } | null => {
    const parts = command.trim().split(/\s+/).filter(part => part.length > 0);
    
    console.log('?? PARSING DEBUG:', {
      originalCommand: command,
      parts: parts,
      partsLength: parts.length
    });

    if (parts.length < 2) {
      console.log('? Command too short');
      return null;
    }

    const commandType = parts[0].toLowerCase();

    // Handle train command: train <place> <cts> <route>
    if (commandType === 'train' && parts.length >= 4) {
      console.log('? Matched TRAIN command');
      return {
        place: parts[1],
        cts: parts[2],
        route: parts[3]
      };
    }

    // Handle predict command with multiple tables: predict <place> <cts> [...]
    if (commandType === 'predict' && parts.length >= 3) {
      // Detect table types instead of assuming positions
      const table1 = parts[1];
      const table2 = parts[2];
      const type1 = detectTableType(table1);
      const type2 = detectTableType(table2);

      console.log('? Matched PREDICT with two tables:', {
        table1: { name: table1, detectedType: type1 },
        table2: { name: table2, detectedType: type2 }
      });

      // Create result object based on detected types
      const result: { place?: string; cts?: string } = {};

      // If we can clearly identify the table types
      if (type1 === 'place' && type2 === 'cts') {
        result.place = table1;
        result.cts = table2;
      } else if (type1 === 'cts' && type2 === 'place') {
        result.place = table2;
        result.cts = table1;
      } else {
        // If type detection is uncertain, use name heuristics as backup
        if (table1.toLowerCase().includes('place') || table2.toLowerCase().includes('cts')) {
          result.place = table1;
          result.cts = table2;
        } else if (table1.toLowerCase().includes('cts') || table2.toLowerCase().includes('place')) {
          result.place = table2;
          result.cts = table1;
        } else {
          // Last resort: use position-based assignment as before
          result.place = table1;
          result.cts = table2;
        }
      }

      console.log('? Returned result after type detection:', result);
      return result;
    }

    // Handle single table prediction: predict <table>
    if (commandType === 'predict' && parts.length === 2) {
      const tableName = parts[1];
      
      // Try to determine table type based on name patterns
      const tableType = detectTableType(tableName);
      
      console.log('? Matched SINGLE table predict:', {
        tableName: tableName,
        detectedType: tableType
      });

      // Return only the provided table - let the frontend handle the logic
      // This ensures fully dynamic behavior without hardcoded table names
      if (tableType === 'place') {
        return {
          place: tableName,
        };
      } else if (tableType === 'cts') {
        return {
          cts: tableName,
        };
      } else if (tableType === 'route') {
        // Route tables are not used for prediction, only for training
        // Return null to indicate this is not a valid prediction table
        return null;
      } else {
        // For unknown types, return as place table (common case)
        return {
          place: tableName,
        };
      }
    }

    console.log('? No parsing match found');
    return null;
  },

  // Detect table type based on naming patterns - completely dynamic
  detectTableType: detectTableType,

  // Derive related table names dynamically - works with any table naming patterns
  deriveTableNames: (inputTable: string, availableTables?: AvailableTablesResponse): { place?: string; cts?: string; route?: string } => {
    if (!availableTables) {
      return {};
    }

    // First, try to find exact matches in training sets
    const matchingSet = availableTables.complete_training_sets.find(set =>
      set.route_table === inputTable ||
      set.place_table === inputTable ||
      set.cts_table === inputTable
    );

    if (matchingSet) {
      return {
        place: matchingSet.place_table,
        cts: matchingSet.cts_table,
        route: matchingSet.route_table
      };
    }

    // If no exact match, try intelligent pattern matching
    return findRelatedTablesByPattern(inputTable, availableTables);
  },

  // Find related tables using intelligent pattern matching - completely dynamic
  findRelatedTablesByPattern: findRelatedTablesByPattern,

  // Helper function references
  extractBasePattern: extractBasePattern,
  patternsMatch: patternsMatch,
  calculateSimilarity: calculateSimilarity,
  levenshteinDistance: levenshteinDistance,





  // Find suitable training sets based on partial table names or patterns
  findTrainingSets: (availableTables: AvailableTablesResponse, pattern?: string): TrainingSet[] => {
    if (!pattern) {
      return availableTables.complete_training_sets;
    }

    const lowerPattern = pattern.toLowerCase();
    return availableTables.complete_training_sets.filter(set =>
      set.group_name.toLowerCase().includes(lowerPattern) ||
      set.place_table.toLowerCase().includes(lowerPattern) ||
      set.cts_table.toLowerCase().includes(lowerPattern) ||
      set.route_table.toLowerCase().includes(lowerPattern)
    );
  },

  // Validate if tables exist and are suitable for training
  validateTables: (availableTables: AvailableTablesResponse, place: string, cts: string, route: string): { valid: boolean; errors: string[]; suggestions?: TrainingSet[]; } => {
    const errors: string[] = [];
    const allTables = availableTables.all_tables;

    const placeTable = allTables.find(t => t.table_name === place);
    const ctsTable = allTables.find(t => t.table_name === cts);
    const routeTable = allTables.find(t => t.table_name === route);

    if (!placeTable) {
      errors.push(`Place table '${place}' not found in database`);
    } else if (!placeTable.suitable_for_training) {
      errors.push(`Place table '${place}' is missing required columns: ${placeTable.missing_features.join(', ')}`);
    }

    if (!ctsTable) {
      errors.push(`CTS table '${cts}' not found in database`);
    } else if (!ctsTable.suitable_for_training) {
      errors.push(`CTS table '${cts}' is missing required columns: ${ctsTable.missing_features.join(', ')}`);
    }

    if (!routeTable) {
      errors.push(`Route table '${route}' not found in database`);
    } else if (!routeTable.suitable_for_training) {
      errors.push(`Route table '${route}' is missing required columns: ${routeTable.missing_features.join(', ')}`);
    }

    const suggestions = errors.length > 0 ? availableTables.complete_training_sets : undefined;

    return {
      valid: errors.length === 0,
      errors,
      suggestions
    };
  },

  // Training session management
  setLastTrainingSession: (placeTable: string, ctsTable: string, routeTable: string) => {
    const session = {
      place_table: placeTable,
      cts_table: ctsTable,
      route_table: routeTable,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(TRAINING_SESSION_KEY, JSON.stringify(session));
    console.log('?? Saved training session:', session);
  },

  getLastTrainingSession: () => {
    try {
      const stored = localStorage.getItem(TRAINING_SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        console.log('?? Retrieved training session:', session);
        return {
          place_table: session.place_table,
          cts_table: session.cts_table,
          route_table: session.route_table
        };
      }
    } catch (error) {
      console.error('Error retrieving training session:', error);
    }
    return null;
  },

  clearLastTrainingSession: () => {
    localStorage.removeItem(TRAINING_SESSION_KEY);
    console.log('??? Cleared training session');
  },

  // Validate tables for prediction
  validateTablesForPrediction: (tables: TableInfo[]) => {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (tables.length < 2) {
      errors.push('At least 2 tables (place and CTS) are required for prediction');
      return { valid: false, errors, suggestions };
    }

    // Check if tables have required columns for prediction
    const requiredColumns = ['endpoint', 'slack'];
    
    tables.forEach((table, index) => {
      const tableType = index === 0 ? 'Place' : 'CTS';
      
      if (!table.suitable_for_training) {
        errors.push(`${tableType} table "${table.table_name}" may not be suitable for prediction`);
        suggestions.push(`Consider using a different ${tableType.toLowerCase()} table with endpoint and slack columns`);
      }

      if (table.row_count === 0) {
        errors.push(`${tableType} table "${table.table_name}" is empty`);
      }

      // Check for required columns (if column info is available)
      if (table.all_columns) {
        const missingColumns = requiredColumns.filter(col => 
          !table.all_columns!.some(tableCol => tableCol.toLowerCase().includes(col.toLowerCase()))
        );
        
        if (missingColumns.length > 0) {
          errors.push(`${tableType} table "${table.table_name}" missing columns: ${missingColumns.join(', ')}`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      suggestions
    };
  }
};

export default predictorService;