export interface FlowNode {
  id: string;
  type: 'input' | 'process' | 'output';
  position: { x: number; y: number };
  data: NodeData;
  selected?: boolean;
  dragging?: boolean;
}

export interface NodeData {
  label: string;
  icon?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  parameters: Record<string, any>;
  validation?: ValidationRule[];
  description?: string;
  // Input-specific data
  parameterName?: string;
  value?: string;
  inputType?: 'text' | 'select' | 'number' | 'file';
  options?: string[];
  // Process-specific data
  stage?: string;
  tool?: 'cadence' | 'synopsys';
  dependencies?: string[];
  executionOrder?: number;
  // Output-specific data
  outputPath?: string;
  expectedFiles?: string[];
  outputType?: 'directory' | 'file' | 'logs';
  // Index signature for React Flow compatibility
  [key: string]: any;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
  style?: React.CSSProperties;
}

export interface FlowConfiguration {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: {
    created_at: string;
    updated_at: string;
    version: string;
    user_id: string;
  };
}

export interface ValidationRule {
  type: 'required' | 'pattern' | 'custom';
  message: string;
  pattern?: string;
  validator?: (value: any) => boolean;
}

export interface WorkspaceSettings {
  work_area_location: string;
  central_scripts_path: string;
  default_tool: 'cadence' | 'synopsys';
  default_user_name: string;
  mcp_server_preference?: string;
}

export interface FlowExecution {
  id: string;
  flow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  parameters: Record<string, any>;
  logs: string[];
  error_message?: string;
  execution_time_ms?: number;
  started_at: string;
  completed_at?: string;
  mcp_server_used?: string;
}

export interface NodeTemplate {
  type: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  defaultData: Partial<NodeData>;
  category: 'input' | 'process' | 'output';
}

export interface FlowEditorState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedNode: FlowNode | null;
  selectedEdge: FlowEdge | null;
  isExecuting: boolean;
  executionLogs: string[];
  flowConfiguration: FlowConfiguration | null;
  workspaceSettings: WorkspaceSettings | null;
}

export interface FlowEditorActions {
  // Node operations
  addNode: (type: string, position: { x: number; y: number }) => void;
  updateNode: (nodeId: string, data: Partial<NodeData>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  selectNode: (nodeId: string | null) => void;
  
  // Edge operations
  addEdge: (edge: FlowEdge) => void;
  deleteEdge: (edgeId: string) => void;
  
  // Flow operations
  saveFlow: (flowName?: string, flowId?: string) => Promise<any>;
  loadFlow: (flowId: string) => Promise<any>;
  getUserFlows: () => Promise<any[]>;
  deleteFlow: (flowId: string) => Promise<boolean>;
  executeFlow: () => Promise<void>;
  clearFlow: () => void;
  
  // Settings
  updateWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => void;
}
