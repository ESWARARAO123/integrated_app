import { api } from './api';

export interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean | string | object;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

export interface DatabaseFile {
  id: string;
  filename: string;
  table_name: string;
  upload_date: string;
  file_size: number | string;
  file_type: string;
  schema_name?: string;
  owner?: string;
  has_indexes?: boolean;
  has_rules?: boolean;
  has_triggers?: boolean;
  row_count?: number;
  columns?: string[];
}

export interface FlowChartNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: string;
  stage?: string;
  user?: string;
  run?: string;
  sheet?: string;
  style: {
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    cornerRadius: number;
    fontSize: number;
    textColor: string;
    fontWeight?: string;
  };
}

export interface FlowChartConnection {
  from: string;
  to: string;
  type: string;
  connection_category: string;
  style: {
    stroke: string;
    strokeWidth: number;
    arrowSize: number;
    strokeDasharray?: string;
  };
}

export interface FlowChartLayout {
  nodes: FlowChartNode[];
  connections: FlowChartConnection[];
  layout: {
    width: number;
    height: number;
    background: {
      color: string;
      gridSize: number;
      gridColor: string;
      gridOpacity: number;
    };
    stage_colors: Record<string, string>;
  };
  config: {
    node_width: number;
    node_height: number;
    font_size: number;
    grid_size: number;
    spacing_x: number;
    spacing_y: number;
    dynamic_sizing: boolean;
    enhanced_connections: boolean;
  };
}

const flowtrackService = {
  // Test database connection
  testConnection: async (connection: DatabaseConnection): Promise<{ success: boolean; error?: string; suggestions?: string[]; database_info?: any }> => {
    try {
      const response = await api.post('/flowtrack/test-connection', connection);
      return response.data;
    } catch (error: any) {
      console.error('Error testing database connection:', error);
      // Return error details from the server response
      if (error.response?.data) {
        return {
          success: false,
          error: error.response.data.error || 'Connection failed',
          suggestions: error.response.data.suggestions || []
        };
      }
      throw error;
    }
  },

  // Get list of files from database
  getFiles: async (connection: DatabaseConnection): Promise<DatabaseFile[]> => {
    try {
      const response = await api.post('/flowtrack/files', connection);
      return response.data;
    } catch (error) {
      console.error('Error fetching files from database:', error);
      throw error;
    }
  },

  // Analyze file and generate flow chart
  analyzeFile: async (connection: DatabaseConnection, fileId: string): Promise<FlowChartLayout> => {
    try {
      const response = await api.post('/flowtrack/analyze', {
        connection,
        fileId
      });
      return response.data;
    } catch (error) {
      console.error('Error analyzing file:', error);
      throw error;
    }
  },

  // Get file data preview
  getFilePreview: async (connection: DatabaseConnection, fileId: string): Promise<any[]> => {
    try {
      const response = await api.post('/flowtrack/preview', {
        connection,
        fileId
      });
      return response.data;
    } catch (error) {
      console.error('Error getting file preview:', error);
      throw error;
    }
  },

  // Simple analyze - get first row flow
  analyzeSimple: async (connection: DatabaseConnection, fileId: string): Promise<SimpleFlowAnalysisResult> => {
    try {
      const response = await api.post('/flowtrack/analyze-simple', {
        connection,
        fileId
      });
      return response.data;
    } catch (error) {
      console.error('Error analyzing data (simple):', error);
      throw error;
    }
  },

  // Branch analyze - intelligent branching visualization
  analyzeBranch: async (connection: DatabaseConnection, fileId: string): Promise<BranchFlowAnalysisResult> => {
    try {
      const response = await api.post('/flowtrack/analyze-branch', {
        connection,
        fileId
      });
      return response.data;
    } catch (error) {
      console.error('Error analyzing data (branch):', error);
      throw error;
    }
  },

  // RTL analyze - RTL version-based branching visualization
  analyzeRTL: async (connection: DatabaseConnection, fileId: string): Promise<RTLFlowAnalysisResult> => {
    try {
      const response = await api.post('/flowtrack/analyze-rtl', {
        connection,
        fileId
      });
      return response.data;
    } catch (error) {
      console.error('Error analyzing data (RTL):', error);
      throw error;
    }
  }
};

// New interfaces for horizontal flow analysis
export interface FlowStep {
  id: string;
  position: number;
  column_name: string;
  value: string;
  display_value: string;
  is_first: boolean;
  is_last: boolean;
}

export interface HeaderFlow {
  id: string;
  type: 'header';
  initial_value: string;
  initial_display: string;
  complete_flow: FlowStep[];
}

export interface DataRow {
  id: string;
  row_number: number;
  type: 'data';
  initial_value: string;
  initial_display: string;
  complete_flow: FlowStep[];
}

export interface SimpleFlowData {
  table_name: string;
  total_columns: number;
  total_rows: number;
  header_flow: HeaderFlow;
  data_rows: DataRow[];
  metadata: {
    analyzed_at: string;
    total_rows_analyzed: number;
    analysis_type: string;
    description: string;
  };
}

export interface SimpleFlowAnalysisResult {
  success: boolean;
  message: string;
  flow_data: SimpleFlowData;
}

// Branch Flow Analysis interfaces
export interface BranchNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: string;
  run: string;
  stage: string;
  stage_index: number;
  value: string;
  is_branch: boolean;
  style: {
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    cornerRadius: number;
    fontSize: number;
    textColor: string;
    fontWeight: string;
  };
}

export interface BranchConnection {
  from: string;
  to: string;
  type: string;
  connection_category: string;
  style: {
    stroke: string;
    strokeWidth: number;
    arrowSize: number;
    strokeDasharray?: string;
  };
}

export interface BranchAnalysis {
  [runName: string]: {
    copied_from?: {
      [stageName: string]: {
        source_run: string;
        source_stage: string;
        source_stage_index: number;
        current_stage_index: number;
        value: string;
      };
    };
    branch_point?: {
      stage: string;
      stage_index: number;
      source_run: string;
    };
    skipped_stages?: Array<{
      stage: string;
      stage_index: number;
    }>;
    new_stages?: Array<{
      stage: string;
      stage_index: number;
      value: string;
    }>;
  };
}

export interface BranchFlowData {
  nodes: BranchNode[];
  connections: BranchConnection[];
  layout: {
    width: number;
    height: number;
    scrollable?: boolean;
    zoomable?: boolean;
    minZoom?: number;
    maxZoom?: number;
    background: {
      color: string;
      gridSize: number;
      gridColor: string;
      gridOpacity: number;
    };
  };
  branch_analysis: BranchAnalysis;
  debug_info: {
    runs_processed: number;
    branch_runs: string[];
    linear_runs: string[];
    total_stages: number;
  };
  metadata?: {
    username: string;
    stage_names: string[];
    stage_mapping: { [key: string]: string };
    total_runs: number;
    total_stages: number;
  };
}

export interface BranchFlowAnalysisResult {
  success: boolean;
  message: string;
  branch_data: BranchFlowData;
  metadata: {
    analyzed_at: string;
    analysis_type: string;
    table_name: string;
    total_rows_analyzed: number;
  };
}

// RTL Flow Analysis interfaces
export interface RTLVersionAnalysis {
  data: Array<{
    [key: string]: string;
  }>;
  copy_patterns: BranchAnalysis;
  branch_layout: BranchFlowData;
}

export interface RTLFlowData {
  type: string;
  username: string;
  rtl_versions: string[];
  version_analyses: {
    [version: string]: RTLVersionAnalysis;
  };
  data_analysis: {
    rtl_column: string;
    run_column: string;
    stage_columns: string[];
    username: string;
    total_columns: number;
    column_order: { [key: string]: number };
  };
  total_versions: number;
  status: string;
}

export interface RTLFlowAnalysisResult {
  success: boolean;
  message: string;
  rtl_data: RTLFlowData;
  metadata: {
    analyzed_at: string;
    analysis_type: string;
    table_name: string;
    total_rows_analyzed: number;
  };
}

export default flowtrackService;