import { api } from './api';

export interface RunStatusTable {
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
  user_specific_count?: number; // For user-specific row counts
}

export interface RunStatusConnectionStatus {
  isConnected: boolean;
  host: string;
  port: number;
  database: string;
  lastRefresh: string | null;
  totalTables: number;
  refreshInterval: number;
}

export interface RunStatusDbStatus {
  success: boolean;
  connection: RunStatusConnectionStatus;
  tables: RunStatusTable[];
  totalTables: number;
  lastRefresh: string | null;
}

export interface TablePreviewData {
  table_name: string;
  data: any[];
  total_returned: number;
  columns: string[];
}

export interface SimpleFlowAnalysisResult {
  success: boolean;
  message: string;
  flow_data: any;
  metadata: {
    analyzed_at: string;
    analysis_type: string;
    table_name: string;
    total_rows_analyzed: number;
  };
}

export interface BranchFlowAnalysisResult {
  success: boolean;
  message: string;
  branch_data: any;
  metadata: {
    analyzed_at: string;
    analysis_type: string;
    table_name: string;
    total_rows_analyzed: number;
  };
}

export interface RTLFlowAnalysisResult {
  success: boolean;
  message: string;
  rtl_data: any;
  metadata: {
    analyzed_at: string;
    analysis_type: string;
    table_name: string;
    total_rows_analyzed: number;
  };
}

const runStatusDbService = {
  // Get connection status and available tables
  getStatus: async (): Promise<RunStatusDbStatus> => {
    try {
      console.log('Requesting RunStatus DB status...');
      const response = await api.get('/runstatus-db/status');
      console.log('RunStatus DB status response:', {
        success: response.data.success,
        isConnected: response.data.connection?.isConnected,
        tablesCount: response.data.tables?.length || 0,
        totalTables: response.data.totalTables
      });
      return response.data;
    } catch (error: any) {
      console.error('Error getting Run Status database status:', error);
      throw error;
    }
  },

  // Get list of tables (refreshed automatically)
  getTables: async (): Promise<{ success: boolean; tables: RunStatusTable[]; totalTables: number; lastRefresh: string | null; isConnected: boolean }> => {
    try {
      const response = await api.get('/runstatus-db/tables');
      return response.data;
    } catch (error: any) {
      console.error('Error getting tables:', error);
      throw error;
    }
  },

  // Get users who have data in the database
  getUsersWithData: async (): Promise<{ success: boolean; users: any[] }> => {
    try {
      const response = await api.get('/runstatus-db/users-with-data');
      return response.data;
    } catch (error: any) {
      console.error('Error getting users with data:', error);
      throw error;
    }
  },

  // Get table data preview
  getTablePreview: async (tableName: string, limit: number = 10): Promise<{ success: boolean; data: TablePreviewData }> => {
    try {
      const response = await api.get(`/runstatus-db/table/${tableName}/preview?limit=${limit}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error getting preview for table ${tableName}:`, error);
      throw error;
    }
  },

  // Analyze table with Simple Flow
  analyzeSimple: async (tableName: string): Promise<SimpleFlowAnalysisResult> => {
    try {
      const response = await api.post(`/runstatus-db/analyze-simple/${tableName}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error analyzing table ${tableName} with simple flow:`, error);
      throw error;
    }
  },

  // Analyze table with Branch Flow
  analyzeBranch: async (tableName: string): Promise<BranchFlowAnalysisResult> => {
    try {
      const response = await api.post(`/runstatus-db/analyze-branch/${tableName}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error analyzing table ${tableName} with branch flow:`, error);
      throw error;
    }
  },

  // Analyze table with RTL Flow
  analyzeRTL: async (tableName: string): Promise<RTLFlowAnalysisResult> => {
    try {
      const response = await api.post(`/runstatus-db/analyze-rtl/${tableName}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error analyzing table ${tableName} with RTL flow:`, error);
      throw error;
    }
  },

  // Force refresh tables
  refreshTables: async (): Promise<{ success: boolean; message: string; tables: RunStatusTable[]; totalTables: number; lastRefresh: string }> => {
    try {
      const response = await api.post('/runstatus-db/refresh');
      return response.data;
    } catch (error: any) {
      console.error('Error refreshing tables:', error);
      throw error;
    }
  }
};

export default runStatusDbService;