import { api } from './api';

export interface PredictionTable {
  id: string;
  filename: string;
  table_name: string;
  schema_name?: string;
  upload_date: string;
  file_size: number | string;
  file_type: string;
  owner?: string;
  has_indexes?: boolean;
  has_rules?: boolean;
  has_triggers?: boolean;
  row_count?: number;
  columns?: string[];
  last_updated?: string;
}

export interface PredictionConnectionStatus {
  isConnected: boolean;
  host: string;
  port: number;
  database: string;
  lastRefresh: string | null;
  totalTables: number;
  refreshInterval: number;
}

export interface PredictionDbStatus {
  success: boolean;
  connection: PredictionConnectionStatus;
  tables: PredictionTable[];
  totalTables: number;
  lastRefresh: string | null;
}

export interface PredictionDbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface TrainingResult {
  success: boolean;
  message: string;
  model_id?: string;
  training_metrics?: any;
  error?: string;
}

export interface PredictionResult {
  success: boolean;
  message: string;
  predictions?: any[];
  error?: string;
}

const predictionDbService = {
  // Get connection status and available tables
  getStatus: async (): Promise<PredictionDbStatus> => {
    try {
      const response = await api.get('/prediction-db/status');
      return response.data;
    } catch (error: any) {
      console.error('Error getting Prediction database status:', error);
      throw error;
    }
  },

  // Get list of tables (refreshed automatically)
  getTables: async (): Promise<{ success: boolean; tables: PredictionTable[]; totalTables: number; lastRefresh: string | null; isConnected: boolean }> => {
    try {
      const response = await api.get('/prediction-db/tables');
      return response.data;
    } catch (error: any) {
      console.error('Error getting prediction tables:', error);
      throw error;
    }
  },

  // Get current database configuration
  getConfig: async (): Promise<{ config: PredictionDbConfig }> => {
    try {
      const response = await api.get('/settings/prediction-db-config');
      return response.data;
    } catch (error: any) {
      console.error('Error getting prediction database config:', error);
      throw error;
    }
  },

  // Save database configuration
  saveConfig: async (config: PredictionDbConfig): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post('/settings/prediction-db-config', config);
      return response.data;
    } catch (error: any) {
      console.error('Error saving prediction database config:', error);
      throw error;
    }
  },

  // Test database connection
  testConnection: async (config: PredictionDbConfig): Promise<{ success: boolean; message?: string; error?: string; potential_prediction_tables?: string[] }> => {
    try {
      const response = await api.post('/settings/test-prediction-db-connection', config);
      return response.data;
    } catch (error: any) {
      console.error('Error testing prediction database connection:', error);
      throw error;
    }
  },

  // Disconnect database
  disconnect: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post('/settings/prediction-db-disconnect');
      return response.data;
    } catch (error: any) {
      console.error('Error disconnecting prediction database:', error);
      throw error;
    }
  },

  // Train model with tables
  trainModel: async (placeTable: string, ctsTable: string, routeTable?: string): Promise<TrainingResult> => {
    try {
      const response = await api.post('/prediction-db/train', {
        place_table: placeTable,
        cts_table: ctsTable,
        route_table: routeTable
      });
      return response.data;
    } catch (error: any) {
      console.error('Error training model:', error);
      throw error;
    }
  },

  // Generate predictions - now supports single table prediction
  predict: async (placeTable?: string, ctsTable?: string): Promise<PredictionResult> => {
    try {
      const requestBody: any = {};
      if (placeTable) requestBody.place_table = placeTable;
      if (ctsTable) requestBody.cts_table = ctsTable;
      
      const response = await api.post('/prediction-db/predict', requestBody);
      return response.data;
    } catch (error: any) {
      console.error('Error generating predictions:', error);
      throw error;
    }
  },

  // Force refresh tables
  refreshTables: async (): Promise<{ success: boolean; message: string; tables: PredictionTable[]; totalTables: number; lastRefresh: string }> => {
    try {
      const response = await api.post('/prediction-db/refresh');
      return response.data;
    } catch (error: any) {
      console.error('Error refreshing prediction tables:', error);
      throw error;
    }
  }
};

export default predictionDbService;