import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { FlowEditorState, FlowEditorActions, FlowNode, FlowEdge, NodeData, WorkspaceSettings } from './types/flow';
import { useAuth } from '../../contexts/AuthContext';

interface FlowEditorContextType extends FlowEditorState, FlowEditorActions {}

const FlowEditorContext = createContext<FlowEditorContextType | null>(null);

export const useFlowEditor = () => {
  const context = useContext(FlowEditorContext);
  if (!context) {
    throw new Error('useFlowEditor must be used within a FlowEditorProvider');
  }
  return context;
};

type FlowEditorAction =
  | { type: 'SET_NODES'; payload: FlowNode[] }
  | { type: 'SET_EDGES'; payload: FlowEdge[] }
  | { type: 'ADD_NODE'; payload: FlowNode }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; data: Partial<NodeData> } }
  | { type: 'UPDATE_NODE_POSITION'; payload: { nodeId: string; position: { x: number; y: number } } }
  | { type: 'DELETE_NODE'; payload: string }
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'ADD_EDGE'; payload: FlowEdge }
  | { type: 'DELETE_EDGE'; payload: string }
  | { type: 'SET_EXECUTING'; payload: boolean }
  | { type: 'ADD_LOG'; payload: string }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_WORKSPACE_SETTINGS'; payload: WorkspaceSettings | null }
  | { type: 'CLEAR_FLOW' };

const initialState: FlowEditorState = {
  nodes: [],
  edges: [],
  selectedNode: null,
  selectedEdge: null,
  isExecuting: false,
  executionLogs: [],
  flowConfiguration: null,
  workspaceSettings: null,
};

const flowEditorReducer = (state: FlowEditorState, action: FlowEditorAction): FlowEditorState => {
  switch (action.type) {
    case 'SET_NODES':
      return { ...state, nodes: action.payload };
    
    case 'SET_EDGES':
      return { ...state, edges: action.payload };
    
    case 'ADD_NODE':
      return { ...state, nodes: [...state.nodes, action.payload] };
    
    case 'UPDATE_NODE':
      return {
        ...state,
        nodes: state.nodes.map(node =>
          node.id === action.payload.nodeId
            ? { ...node, data: { ...node.data, ...action.payload.data } }
            : node
        ),
      };

    case 'UPDATE_NODE_POSITION':
      return {
        ...state,
        nodes: state.nodes.map(node =>
          node.id === action.payload.nodeId
            ? { ...node, position: action.payload.position }
            : node
        ),
      };

    case 'DELETE_NODE':
      return {
        ...state,
        nodes: state.nodes.filter(node => node.id !== action.payload),
        edges: state.edges.filter(edge => 
          edge.source !== action.payload && edge.target !== action.payload
        ),
        selectedNode: state.selectedNode?.id === action.payload ? null : state.selectedNode,
      };
    
    case 'SELECT_NODE':
      return {
        ...state,
        selectedNode: action.payload ? state.nodes.find(n => n.id === action.payload) || null : null,
      };
    
    case 'ADD_EDGE':
      return { ...state, edges: [...state.edges, action.payload] };
    
    case 'DELETE_EDGE':
      return {
        ...state,
        edges: state.edges.filter(edge => edge.id !== action.payload),
      };
    
    case 'SET_EXECUTING':
      return { ...state, isExecuting: action.payload };
    
    case 'ADD_LOG':
      return { ...state, executionLogs: [...state.executionLogs, action.payload] };
    
    case 'CLEAR_LOGS':
      return { ...state, executionLogs: [] };
    
    case 'SET_WORKSPACE_SETTINGS':
      return { ...state, workspaceSettings: action.payload };
    
    case 'CLEAR_FLOW':
      return {
        ...state,
        nodes: [],
        edges: [],
        selectedNode: null,
        selectedEdge: null,
        executionLogs: [],
      };
    
    default:
      return state;
  }
};

interface FlowEditorProviderProps {
  children: React.ReactNode;
}

export const FlowEditorProvider: React.FC<FlowEditorProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(flowEditorReducer, initialState);
  const { user } = useAuth();

  // Load workspace settings on mount
  useEffect(() => {
    loadWorkspaceSettings();
  }, [user]);

  const loadWorkspaceSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/workspace/settings', {
        credentials: 'include', // Include session cookies
      });

      if (response.ok) {
        const settings = await response.json();
        dispatch({ type: 'SET_WORKSPACE_SETTINGS', payload: settings });
      }
    } catch (error) {
      console.error('Failed to load workspace settings:', error);
    }
  }, [user]);

  const addNode = useCallback((type: string, position: { x: number; y: number }) => {
    const newNode: FlowNode = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: type as 'input' | 'process' | 'output',
      position,
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        status: 'idle',
        parameters: {},
        ...(type === 'input' && {
          parameterName: '',
          value: '',
          inputType: 'text' as const,
        }),
        ...(type === 'process' && {
          stage: 'SYNTH',
          tool: 'cadence' as const,
        }),
        ...(type === 'output' && {
          outputType: 'directory' as const,
        }),
      },
    };
    
    dispatch({ type: 'ADD_NODE', payload: newNode });
  }, []);

  const updateNode = useCallback((nodeId: string, data: Partial<NodeData>) => {
    dispatch({ type: 'UPDATE_NODE', payload: { nodeId, data } });
  }, []);

  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    dispatch({ type: 'UPDATE_NODE_POSITION', payload: { nodeId, position } });
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    dispatch({ type: 'DELETE_NODE', payload: nodeId });
  }, []);

  const selectNode = useCallback((nodeId: string | null) => {
    dispatch({ type: 'SELECT_NODE', payload: nodeId });
  }, []);

  const addEdge = useCallback((edge: FlowEdge) => {
    dispatch({ type: 'ADD_EDGE', payload: edge });
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    dispatch({ type: 'DELETE_EDGE', payload: edgeId });
  }, []);

  const saveFlow = useCallback(async (flowName?: string, flowId?: string) => {
    try {
      // Get current viewport from React Flow instance if available
      const reactFlowInstance = (window as any).reactFlowInstance;
      const currentViewport = reactFlowInstance ? reactFlowInstance.getViewport() : { x: 0, y: 0, zoom: 1 };
      
      console.log('💾 Capturing viewport for save:', currentViewport);
      console.log('💾 React Flow instance available:', !!reactFlowInstance);
      
      const flowData = {
        id: flowId,
        name: flowName || `Flow ${new Date().toISOString().split('T')[0]}`,
        nodes: state.nodes,
        edges: state.edges,
        viewport: currentViewport,
        workspaceSettings: state.workspaceSettings,
      };

      console.log('Saving flow data:', flowData);
      
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify(flowData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Save flow error:', errorData);
        throw new Error(errorData.message || 'Failed to save flow');
      }

      const savedFlow = await response.json();
      console.log('Flow saved successfully:', savedFlow);
      dispatch({ type: 'ADD_LOG', payload: `Flow "${flowData.name}" saved successfully` });
      
      return savedFlow;
    } catch (error) {
      console.error('Failed to save flow:', error);
      dispatch({ type: 'ADD_LOG', payload: `Error saving flow: ${error}` });
      throw error;
    }
  }, [state.nodes, state.edges, state.workspaceSettings]);

  const loadFlow = useCallback(async (flowId: string) => {
    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        credentials: 'include', // Include session cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load flow');
      }

      const flowData = await response.json();
      
      // Clear existing flow first
      dispatch({ type: 'CLEAR_FLOW' });
      
      // Load the saved flow data
      dispatch({ type: 'SET_NODES', payload: flowData.nodes || [] });
      dispatch({ type: 'SET_EDGES', payload: flowData.edges || [] });
      
      if (flowData.workspaceSettings) {
        dispatch({ type: 'SET_WORKSPACE_SETTINGS', payload: flowData.workspaceSettings });
      }
      
      // Restore canvas viewport if available
      if (flowData.canvas_state?.viewport) {
        console.log('🔄 Attempting to restore viewport:', flowData.canvas_state.viewport);
        
        // Try multiple times with increasing delays to ensure React Flow is ready
        const restoreViewport = (attempt = 1) => {
          const reactFlowInstance = (window as any).reactFlowInstance;
          console.log(`🔄 Viewport restore attempt ${attempt}, instance available:`, !!reactFlowInstance);
          
          if (reactFlowInstance) {
            console.log('✅ Setting viewport to:', flowData.canvas_state.viewport);
            reactFlowInstance.setViewport(flowData.canvas_state.viewport);
            console.log('✅ Viewport set successfully');
          } else if (attempt < 5) {
            // Try again with longer delay
            setTimeout(() => restoreViewport(attempt + 1), attempt * 200);
          } else {
            console.error('❌ Failed to restore viewport after 5 attempts');
          }
        };
        
        setTimeout(() => restoreViewport(1), 200);
      }
      
      dispatch({ type: 'ADD_LOG', payload: `Flow "${flowData.name}" loaded successfully` });
      
      return flowData;
    } catch (error) {
      console.error('Failed to load flow:', error);
      dispatch({ type: 'ADD_LOG', payload: `Error loading flow: ${error}` });
      throw error;
    }
  }, []);

  const getUserFlows = useCallback(async () => {
    try {
      console.log('Fetching user flows...');
      const response = await fetch('/api/flows', {
        credentials: 'include', // Include session cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Get flows error:', errorData);
        throw new Error(errorData.message || 'Failed to fetch flows');
      }

      const flows = await response.json();
      console.log('Fetched flows:', flows);
      return flows;
    } catch (error) {
      console.error('Failed to fetch user flows:', error);
      dispatch({ type: 'ADD_LOG', payload: `Error fetching flows: ${error}` });
      throw error;
    }
  }, []);

  const deleteFlow = useCallback(async (flowId: string) => {
    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: 'DELETE',
        credentials: 'include', // Include session cookies
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete flow');
      }

      dispatch({ type: 'ADD_LOG', payload: 'Flow deleted successfully' });
      return true;
    } catch (error) {
      console.error('Failed to delete flow:', error);
      dispatch({ type: 'ADD_LOG', payload: `Error deleting flow: ${error}` });
      throw error;
    }
  }, []);

  const autoSaveFlow = useCallback(async () => {
    if (state.nodes.length === 0) return; // Don't auto-save empty flows
    
    try {
          // Get current viewport for auto-save
    const reactFlowInstance = (window as any).reactFlowInstance;
    const currentViewport = reactFlowInstance ? reactFlowInstance.getViewport() : { x: 0, y: 0, zoom: 1 };
    
    const autoSaveData = {
      name: 'Auto-saved Flow',
      nodes: state.nodes,
      edges: state.edges,
      viewport: currentViewport,
      workspaceSettings: state.workspaceSettings,
      isAutoSave: true,
    };

      await fetch('/api/flows/autosave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(autoSaveData),
      });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [state.nodes, state.edges, state.workspaceSettings]);

  // Remove auto-save - only save when user clicks Save button
  // useEffect(() => {
  //   if (state.nodes.length > 0) {
  //     const autoSaveInterval = setInterval(autoSaveFlow, 30000); // 30 seconds
  //     return () => clearInterval(autoSaveInterval);
  //   }
  // }, [state.nodes, state.edges, autoSaveFlow]);

  const executeFlow = useCallback(async () => {
    try {
      dispatch({ type: 'SET_EXECUTING', payload: true });
      dispatch({ type: 'CLEAR_LOGS' });
      dispatch({ type: 'ADD_LOG', payload: 'Starting flow execution...' });

      // Update all nodes to running status
      state.nodes.forEach(node => {
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { status: 'running' } } });
      });

      const response = await fetch('/api/flows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify({
          nodes: state.nodes,
          edges: state.edges,
          workspaceSettings: state.workspaceSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('Flow execution failed');
      }

      const result = await response.json();
      dispatch({ type: 'ADD_LOG', payload: 'Flow execution completed successfully' });
      
      // Update nodes to success status
      state.nodes.forEach(node => {
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { status: 'success' } } });
      });

    } catch (error) {
      console.error('Flow execution failed:', error);
      dispatch({ type: 'ADD_LOG', payload: `Flow execution failed: ${error}` });
      
      // Update nodes to error status
      state.nodes.forEach(node => {
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { status: 'error' } } });
      });
    } finally {
      dispatch({ type: 'SET_EXECUTING', payload: false });
    }
  }, [state.nodes, state.edges, state.workspaceSettings, user]);

  const clearFlow = useCallback(() => {
    dispatch({ type: 'CLEAR_FLOW' });
  }, []);

  const updateWorkspaceSettings = useCallback((settings: Partial<WorkspaceSettings>) => {
    if (state.workspaceSettings) {
      const updatedSettings = { ...state.workspaceSettings, ...settings };
      dispatch({ type: 'SET_WORKSPACE_SETTINGS', payload: updatedSettings });
    }
  }, [state.workspaceSettings]);

  // Load last saved flow on component mount
  useEffect(() => {
    const loadLastFlow = async () => {
      try {
        const flows = await getUserFlows();
        if (flows.length > 0) {
          // Load the most recently updated flow
          const lastFlow = flows[0]; // Already sorted by updated_at DESC
          const flowData = await loadFlow(lastFlow.id);
          
          // Dispatch an event to notify the toolbar about the loaded flow
          window.dispatchEvent(new CustomEvent('flowLoaded', { 
            detail: { 
              id: lastFlow.id, 
              name: flowData.name || lastFlow.name 
            } 
          }));
        }
      } catch (error) {
        console.error('Failed to load last flow:', error);
        // If there's an authentication error, just continue with empty flow
      }
    };

    // Only load on initial mount if there are no nodes yet
    // Add a small delay to ensure the component is fully mounted
    if (state.nodes.length === 0) {
      const timer = setTimeout(() => {
        loadLastFlow();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // Empty dependency array - only run on mount

  const contextValue: FlowEditorContextType = {
    ...state,
    addNode,
    updateNode,
    updateNodePosition,
    deleteNode,
    selectNode,
    addEdge,
    deleteEdge,
    saveFlow,
    loadFlow,
    getUserFlows,
    deleteFlow,
    executeFlow,
    clearFlow,
    updateWorkspaceSettings,
  };

  return (
    <FlowEditorContext.Provider value={contextValue}>
      {children}
    </FlowEditorContext.Provider>
  );
};
