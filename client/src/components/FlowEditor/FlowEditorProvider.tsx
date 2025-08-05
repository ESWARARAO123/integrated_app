import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { FlowEditorState, FlowEditorActions, FlowNode, FlowEdge, NodeData, WorkspaceSettings } from './types/flow';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '@chakra-ui/react';
import FlowdirApprovalModal, { FlowdirParameters } from './FlowdirApprovalModal';
import { extractFlowdirParameters, validateFlowdirParameters, getFlowdirDescription } from './FlowdirParameterExtractor';
import { getFlowEditorSettings } from '../../services/flowEditorSettingsService';
import { createDefaultFlow, shouldAutoCreateBlocks, logAutoCreation } from './utils/autoFlowCreation';
import { spawnToolSelectionBlocks, logSpawning, ToolSelectionConfig } from './utils/toolSelectionSpawning';

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
  const toast = useToast();
  
  // FlowDir execution state
  const [flowdirModalOpen, setFlowdirModalOpen] = useState(false);
  const [flowdirParameters, setFlowdirParameters] = useState<Partial<FlowdirParameters> | null>(null);
  const [flowdirSettings, setFlowdirSettings] = useState<any>(null);

  // Load workspace settings on mount
  useEffect(() => {
    loadWorkspaceSettings();
    loadFlowdirSettings();
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

  const loadFlowdirSettings = useCallback(async () => {
    try {
      const [settings, mcpResponse] = await Promise.all([
        getFlowEditorSettings(),
        fetch('/api/mcp/server/config', { credentials: 'include' })
      ]);
      
      let mcpServerUrl = settings?.mcp_server_url;
      
      // If no MCP server URL in settings, get the default from MCP config
      if (!mcpServerUrl && mcpResponse.ok) {
        const mcpData = await mcpResponse.json();
        const servers = mcpData.configurations || [];
        const defaultServer = servers.find((server: any) => server.is_default);
        
        if (defaultServer) {
          mcpServerUrl = `http://${defaultServer.mcp_host}:${defaultServer.mcp_port}`;
        } else if (servers.length > 0) {
          mcpServerUrl = `http://${servers[0].mcp_host}:${servers[0].mcp_port}`;
        }
      }
      
      setFlowdirSettings({
        ...settings,
        mcp_server_url: mcpServerUrl
      });
    } catch (error) {
      console.error('Failed to load FlowDir settings:', error);
      setFlowdirSettings(null);
    }
  }, []);

  const addNode = useCallback((template: any, position: { x: number; y: number }) => {
    const newNode: FlowNode = {
      id: `${template.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'input',
      position,
      data: {
        label: template.defaultData?.label || template.label,
        status: 'idle',
        parameters: {},
        parameterName: template.defaultData?.parameterName || '',
        value: template.defaultData?.value || '',
        inputType: template.defaultData?.inputType || 'text' as const,
        description: template.description || '',
        options: template.defaultData?.options || [],
      },
    };
    
    dispatch({ type: 'ADD_NODE', payload: newNode });
  }, []);

  const createFlowChain = useCallback((triggerNodeId: string, startPosition: { x: number; y: number }) => {
    console.log('🔗 Creating flow chain from "all" trigger node:', triggerNodeId);
    
    const timestamp = Date.now();
    const baseY = startPosition.y;
    const spacing = 250; // Horizontal spacing between blocks
    const verticalSpacing = 120; // Vertical spacing for better layout
    
    // Create only the 4 stage blocks (no tool block needed)
    // Position them in a 2x2 grid to the right of the "all" block
    const flowBlocks = [
      {
        id: `synth-${timestamp}`,
        label: 'SYNTH',
        parameterName: 'stage_synth',
        value: 'SYNTH',
        description: 'Synthesis stage',
        position: { x: startPosition.x + spacing, y: baseY - verticalSpacing },
      },
      {
        id: `pd-${timestamp}`,
        label: 'PD',
        parameterName: 'stage_pd',
        value: 'PD',
        description: 'Physical Design stage',
        position: { x: startPosition.x + spacing * 2, y: baseY - verticalSpacing },
      },
      {
        id: `lec-${timestamp}`,
        label: 'LEC',
        parameterName: 'stage_lec',
        value: 'LEC',
        description: 'Logic Equivalence Check',
        position: { x: startPosition.x + spacing, y: baseY + verticalSpacing },
      },
      {
        id: `sta-${timestamp}`,
        label: 'STA',
        parameterName: 'stage_sta',
        value: 'STA',
        description: 'Static Timing Analysis',
        position: { x: startPosition.x + spacing * 2, y: baseY + verticalSpacing },
      },
    ];
    
    // Create all the stage blocks
    flowBlocks.forEach(block => {
      const newNode: FlowNode = {
        id: block.id,
        type: 'input',
        position: block.position,
        data: {
          label: block.label,
          status: 'idle',
          parameters: {},
          parameterName: block.parameterName,
          value: block.value,
          inputType: 'text' as const,
          description: block.description,
        },
      };
      dispatch({ type: 'ADD_NODE', payload: newNode });
    });
    
    // Create connections: "all" block connects to ALL 4 stage blocks
    const connections = [
      // ALL → SYNTH
      { sourceId: triggerNodeId, targetId: `synth-${timestamp}` },
      // ALL → PD
      { sourceId: triggerNodeId, targetId: `pd-${timestamp}` },
      // ALL → LEC
      { sourceId: triggerNodeId, targetId: `lec-${timestamp}` },
      // ALL → STA
      { sourceId: triggerNodeId, targetId: `sta-${timestamp}` },
    ];
    
    // Add edges after a small delay to ensure nodes are created
    setTimeout(() => {
      connections.forEach(conn => {
        const edge: FlowEdge = {
          id: `edge-${conn.sourceId}-${conn.targetId}`,
          source: conn.sourceId,
          target: conn.targetId,
          animated: true,
        };
        dispatch({ type: 'ADD_EDGE', payload: edge });
      });
      
      dispatch({ type: 'ADD_LOG', payload: 'Auto-created all VLSI stages (SYNTH, PD, LEC, STA) connected to "all" block' });
    }, 100);
    
  }, [state.nodes]);

  const createPDStepsChain = useCallback((triggerNodeId: string, startPosition: { x: number; y: number }) => {
    console.log('🔗 Creating PD steps chain from "all" trigger node:', triggerNodeId);
    
    const timestamp = Date.now();
    const baseY = startPosition.y;
    const spacing = 250; // Horizontal spacing between blocks
    const verticalSpacing = 120; // Vertical spacing for better layout
    
    // Create the 4 PD step blocks (Floorplan, Place, CTS, Route)
    // Position them in a 2x2 grid to the right of the "all" block
    const pdStepBlocks = [
      {
        id: `floorplan-${timestamp}`,
        label: 'Floorplan',
        parameterName: 'pd_step_floorplan',
        value: 'Floorplan',
        description: 'Floorplan step',
        position: { x: startPosition.x + spacing, y: baseY - verticalSpacing },
      },
      {
        id: `place-${timestamp}`,
        label: 'Place',
        parameterName: 'pd_step_place',
        value: 'Place',
        description: 'Placement step',
        position: { x: startPosition.x + spacing * 2, y: baseY - verticalSpacing },
      },
      {
        id: `cts-${timestamp}`,
        label: 'CTS',
        parameterName: 'pd_step_cts',
        value: 'CTS',
        description: 'Clock Tree Synthesis step',
        position: { x: startPosition.x + spacing, y: baseY + verticalSpacing },
      },
      {
        id: `route-${timestamp}`,
        label: 'Route',
        parameterName: 'pd_step_route',
        value: 'Route',
        description: 'Routing step',
        position: { x: startPosition.x + spacing * 2, y: baseY + verticalSpacing },
      },
    ];
    
    // Create all the PD step blocks
    pdStepBlocks.forEach(block => {
      const newNode: FlowNode = {
        id: block.id,
        type: 'input',
        position: block.position,
        data: {
          label: block.label,
          status: 'idle',
          parameters: {},
          parameterName: block.parameterName,
          value: block.value,
          inputType: 'text' as const,
          description: block.description,
        },
      };
      dispatch({ type: 'ADD_NODE', payload: newNode });
    });
    
    // Create connections: "all" block connects to ALL 4 PD step blocks
    const connections = [
      // ALL → Floorplan
      { sourceId: triggerNodeId, targetId: `floorplan-${timestamp}` },
      // ALL → Place
      { sourceId: triggerNodeId, targetId: `place-${timestamp}` },
      // ALL → CTS
      { sourceId: triggerNodeId, targetId: `cts-${timestamp}` },
      // ALL → Route
      { sourceId: triggerNodeId, targetId: `route-${timestamp}` },
    ];
    
    // Add edges after a small delay to ensure nodes are created
    setTimeout(() => {
      connections.forEach(conn => {
        const edge: FlowEdge = {
          id: `edge-${conn.sourceId}-${conn.targetId}`,
          source: conn.sourceId,
          target: conn.targetId,
          animated: true,
        };
        dispatch({ type: 'ADD_EDGE', payload: edge });
      });
      
      dispatch({ type: 'ADD_LOG', payload: 'Auto-created all PD steps (Floorplan, Place, CTS, Route) connected to "all" block' });
    }, 100);
    
  }, [state.nodes]);

  const updateNode = useCallback((nodeId: string, data: Partial<NodeData>) => {
    // Check if this is a stage selection update to "all"
    const node = state.nodes.find(n => n.id === nodeId);
    const isStageSelectionAll = node?.data.parameterName === 'stage_in_flow' && data.value === 'all';
    const isPDStepsAll = node?.data.parameterName === 'pd_steps' && data.value === 'all';
    
    dispatch({ type: 'UPDATE_NODE', payload: { nodeId, data } });
    
    // Auto-create flow chain when "all" is selected for stages
    if (isStageSelectionAll && node) {
      console.log('🎯 Stage selection changed to "all", creating flow chain...');
      // Position the flow chain to the right of the trigger node
      const startPosition = {
        x: node.position.x,
        y: node.position.y - 50, // Slightly above the trigger node
      };
      
      // Small delay to ensure the update is processed first
      setTimeout(() => {
        createFlowChain(nodeId, startPosition);
      }, 50);
    }
    
    // Auto-create PD steps chain when "all" is selected for PD steps
    if (isPDStepsAll && node) {
      console.log('🎯 PD steps changed to "all", creating PD steps chain...');
      // Position the PD steps chain to the right of the trigger node
      const startPosition = {
        x: node.position.x,
        y: node.position.y - 50, // Slightly above the trigger node
      };
      
      // Small delay to ensure the update is processed first
      setTimeout(() => {
        createPDStepsChain(nodeId, startPosition);
      }, 50);
    }
  }, [state.nodes, createFlowChain, createPDStepsChain]);

  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    dispatch({ type: 'UPDATE_NODE_POSITION', payload: { nodeId, position } });
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    console.log('🗑️ Deleting node:', nodeId);
    console.log('🗑️ Current state before delete:', { nodeCount: state.nodes.length, edgeCount: state.edges.length });
    dispatch({ type: 'DELETE_NODE', payload: nodeId });
    
    // Add a small delay to log the state after deletion
    setTimeout(() => {
      console.log('🗑️ State after delete:', { nodeCount: state.nodes.length, edgeCount: state.edges.length });
    }, 10);
  }, [state.nodes.length, state.edges.length]);

  const selectNode = useCallback((nodeId: string | null) => {
    dispatch({ type: 'SELECT_NODE', payload: nodeId });
  }, []);

  const addEdge = useCallback((edge: FlowEdge) => {
    dispatch({ type: 'ADD_EDGE', payload: edge });
  }, []);

  const deleteEdge = useCallback((edgeId: string) => {
    dispatch({ type: 'DELETE_EDGE', payload: edgeId });
  }, []);

  // Clear session data when flow is explicitly saved
  const clearSessionData = useCallback(() => {
    localStorage.removeItem('pinnacle-flow-session');
    console.log('🗑️ Session data cleared (flow was saved)');
  }, []);

  const saveFlow = useCallback(async (flowName?: string, flowId?: string) => {
    try {
      // Get current viewport from React Flow instance if available
      const reactFlowInstance = (window as any).reactFlowInstance;
      const currentViewport = reactFlowInstance ? reactFlowInstance.getViewport() : { x: 0, y: 0, zoom: 1 };
      
      console.log('💾 Capturing viewport for save:', currentViewport);
      console.log('💾 React Flow instance available:', !!reactFlowInstance);
      
      // Get current nodes and edges from React Flow instance as backup
      let currentNodes = state.nodes;
      let currentEdges = state.edges;
      
      if (reactFlowInstance) {
        const reactFlowNodes = reactFlowInstance.getNodes();
        const reactFlowEdges = reactFlowInstance.getEdges();
        
        console.log('💾 React Flow state:', { nodeCount: reactFlowNodes.length, edgeCount: reactFlowEdges.length });
        console.log('💾 Global state:', { nodeCount: state.nodes.length, edgeCount: state.edges.length });
        
        // Use React Flow state if it differs from global state (indicating sync issue)
        if (reactFlowNodes.length !== state.nodes.length) {
          console.log('⚠️ State mismatch detected! Using React Flow state for save');
          currentNodes = reactFlowNodes.map(node => ({
            id: node.id,
            type: 'input' as const,
            position: node.position,
            data: node.data,
          }));
          currentEdges = reactFlowEdges.map(edge => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            animated: edge.animated || true,
          }));
        }
      }
      
      const flowData = {
        id: flowId,
        name: flowName || `Flow ${new Date().toISOString().split('T')[0]}`,
        nodes: currentNodes,
        edges: currentEdges,
        viewport: currentViewport,
        workspaceSettings: state.workspaceSettings,
      };

      console.log('💾 Final data being saved:', { nodeCount: currentNodes.length, edgeCount: currentEdges.length });
      console.log('💾 Node IDs being saved:', currentNodes.map(n => ({ id: n.id, label: n.data.label })));
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
      
      // Clear session data since the flow is now saved
      clearSessionData();
      
      return savedFlow;
    } catch (error) {
      console.error('Failed to save flow:', error);
      dispatch({ type: 'ADD_LOG', payload: `Error saving flow: ${error}` });
      throw error;
    }
  }, [state.nodes, state.edges, state.workspaceSettings, clearSessionData]);

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
      
      // Clear session data since we're loading a saved flow
      clearSessionData();
      
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
  }, [clearSessionData]);

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
      // Check if this is a FlowDir execution
      const extractedParams = extractFlowdirParameters(state.nodes);
      
      if (extractedParams) {
        // This is a FlowDir flow - show approval modal
        dispatch({ type: 'ADD_LOG', payload: 'Detected FlowDir execution - opening parameter approval...' });
        setFlowdirParameters(extractedParams);
        setFlowdirModalOpen(true);
        return;
      }

      // Regular flow execution
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

  // FlowDir execution function
  const executeFlowdir = useCallback(async (parameters: FlowdirParameters) => {
    dispatch({ type: 'SET_EXECUTING', payload: true });
    dispatch({ type: 'ADD_LOG', payload: `Starting FlowDir execution: Create VLSI directory structure for project "${parameters.projectName}", block "${parameters.blockName}" using ${parameters.toolName} for ${parameters.stage === 'all' ? 'all flow stages (SYNTH + PD + LEC + STA)' : parameters.stage + ' stage'}` });
    dispatch({ type: 'ADD_LOG', payload: `🔧 Parameters: ${JSON.stringify({ ...parameters, centralScripts: parameters.centralScripts, mcpServerUrl: parameters.mcpServerUrl })}` });

    // Create execution record in database
    let executionRecord = null;
    try {
      const createResponse = await fetch('/api/flowdir-executions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          flowId: state.flowConfiguration?.id || null,
          projectName: parameters.projectName,
          blockName: parameters.blockName,
          toolName: parameters.toolName,
          stage: parameters.stage,
          runName: parameters.runName,
          pdSteps: parameters.pdSteps,
          referenceRun: parameters.referenceRun,
          workingDirectory: parameters.workingDirectory,
          centralScriptsDirectory: parameters.centralScripts,
          mcpServerUrl: parameters.mcpServerUrl
        }),
      });

      if (createResponse.ok) {
        executionRecord = await createResponse.json();
        dispatch({ type: 'ADD_LOG', payload: `📝 Execution record created: ${executionRecord.data.execution_id}` });
      }
    } catch (error) {
      console.warn('Failed to create execution record:', error);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    try {
      // Update nodes to executing status
      state.nodes.forEach(node => {
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { status: 'running' } } });
      });
      
      const startTime = Date.now();
      
      const response = await fetch('/api/dir-create/execute-flowdir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          mcpServerUrl: parameters.mcpServerUrl,
          projectName: parameters.projectName,
          blockName: parameters.blockName,
          toolName: parameters.toolName,
          stage: parameters.stage,
          runName: parameters.runName,
          pdSteps: parameters.pdSteps,
          referenceRun: parameters.referenceRun,
          workingDirectory: parameters.workingDirectory,
          centralScriptsDirectory: parameters.centralScripts,
        }),
      });
      
      clearTimeout(timeoutId);
      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`FlowDir execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update execution record with results
      if (executionRecord?.data?.execution_id) {
        try {
          await fetch(`/api/flowdir-executions/${executionRecord.data.execution_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              success: result.success,
              executionTimeMs: executionTime,
              totalDirectoriesCreated: result.summary?.total_dirs ? parseInt(result.summary.total_dirs) : (result.createdPaths?.length || 0),
              totalFilesCreated: result.summary?.total_files ? parseInt(result.summary.total_files) : 0,
              totalSymlinksCreated: result.summary?.total_symlinks ? parseInt(result.summary.total_symlinks) : 0,
              summary: result.summary,
              createdPaths: result.createdPaths,
              logs: result.logs,
              errorMessage: null
            }),
          });
          dispatch({ type: 'ADD_LOG', payload: `💾 Execution results saved to database` });
        } catch (error) {
          console.warn('Failed to update execution record:', error);
        }
      }
      
      if (result.success) {
        // Success! Update logs and UI
        dispatch({ type: 'ADD_LOG', payload: `✅ FlowDir execution completed successfully!` });
        
        // Use summary data for accurate counts, fallback to createdPaths length
        const totalDirs = result.summary?.total_dirs ? parseInt(result.summary.total_dirs) : (result.createdPaths?.length || 0);
        const totalFiles = result.summary?.total_files ? parseInt(result.summary.total_files) : 0;
        const totalSymlinks = result.summary?.total_symlinks ? parseInt(result.summary.total_symlinks) : 0;
        
        dispatch({ type: 'ADD_LOG', payload: `📁 Created ${totalDirs} directories` });
        if (totalFiles > 0) {
          dispatch({ type: 'ADD_LOG', payload: `📄 Created ${totalFiles} files` });
        }
        if (totalSymlinks > 0) {
          dispatch({ type: 'ADD_LOG', payload: `🔗 Created ${totalSymlinks} symlinks` });
        }
        dispatch({ type: 'ADD_LOG', payload: `⏱️ Execution time: ${result.executionTime}ms` });

        // Show first 10 created paths if available
        if (result.createdPaths && result.createdPaths.length > 0) {
          const pathsToShow = result.createdPaths.slice(0, 10);
          pathsToShow.forEach(path => {
            dispatch({ type: 'ADD_LOG', payload: `  📂 ${path}` });
          });
          
          if (result.createdPaths.length > 10) {
            dispatch({ type: 'ADD_LOG', payload: `... and ${result.createdPaths.length - 10} more directories` });
          }
        }

        // Show summary info if available
        if (result.summary?.project) {
          dispatch({ type: 'ADD_LOG', payload: `🎯 Project: ${result.summary.project}` });
        }
        if (result.summary?.block) {
          dispatch({ type: 'ADD_LOG', payload: `🔧 Block: ${result.summary.block}` });
        }
        if (result.summary?.run) {
          dispatch({ type: 'ADD_LOG', payload: `🏃 Run: ${result.summary.run}` });
        }

        // Update nodes to success status
        state.nodes.forEach(node => {
          dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { status: 'success' } } });
        });

        toast({
          title: 'FlowDir Execution Successful',
          description: `Created ${totalDirs} directories for ${parameters.projectName}`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error(result.error || 'FlowDir execution failed');
      }

    } catch (error) {
      console.error('FlowDir execution failed:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timed out (2 minutes) - FlowDir execution may still be running on the server';
        } else {
          errorMessage = error.message;
        }
      }
      
      dispatch({ type: 'ADD_LOG', payload: `❌ FlowDir execution failed: ${errorMessage}` });
      
      // Update execution record with error
      if (executionRecord?.data?.execution_id) {
        try {
          await fetch(`/api/flowdir-executions/${executionRecord.data.execution_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              success: false,
              executionTimeMs: Date.now() - (executionRecord.startTime || Date.now()),
              totalDirectoriesCreated: 0,
              totalFilesCreated: 0,
              totalSymlinksCreated: 0,
              summary: null,
              createdPaths: null,
              logs: null,
              errorMessage: errorMessage
            }),
          });
          dispatch({ type: 'ADD_LOG', payload: `💾 Error details saved to database` });
        } catch (dbError) {
          console.warn('Failed to update execution record with error:', dbError);
        }
      }
      
      // Update nodes to error status
      state.nodes.forEach(node => {
        dispatch({ type: 'UPDATE_NODE', payload: { nodeId: node.id, data: { status: 'error' } } });
      });

      toast({
        title: 'FlowDir Execution Failed',
        description: errorMessage,
        status: 'error',
        duration: 8000,
        isClosable: true,
      });
    } finally {
      dispatch({ type: 'SET_EXECUTING', payload: false });
      setFlowdirModalOpen(false);
    }
  }, [state.nodes, toast]);

  // FlowDir modal handlers
  const handleFlowdirApprove = useCallback((parameters: FlowdirParameters) => {
    executeFlowdir(parameters);
  }, [executeFlowdir]);

  const handleFlowdirCancel = useCallback(() => {
    setFlowdirModalOpen(false);
    setFlowdirParameters(null);
    dispatch({ type: 'ADD_LOG', payload: 'FlowDir execution cancelled by user' });
  }, []);

  const clearFlow = useCallback(() => {
    dispatch({ type: 'CLEAR_FLOW' });
    clearSessionData();

    // Auto-create default flow after clearing
    setTimeout(() => {
      createDefaultFlowBlocks();
    }, 100);
  }, [clearSessionData]);

  const createDefaultFlowBlocks = useCallback(() => {
    if (shouldAutoCreateBlocks(state.nodes)) {
      logAutoCreation('Creating default flow blocks');

      const { nodes, edges } = createDefaultFlow();

      // Add nodes first
      nodes.forEach(node => {
        dispatch({ type: 'ADD_NODE', payload: node });
      });

      // Add edges after a small delay to ensure nodes are created
      setTimeout(() => {
        edges.forEach(edge => {
          dispatch({ type: 'ADD_EDGE', payload: edge });
        });

        logAutoCreation('Default flow blocks created successfully', {
          nodesCount: nodes.length,
          edgesCount: edges.length
        });
      }, 150);
    }
  }, [state.nodes]);

  const spawnToolSelectionBlocksHandler = useCallback((toolSelectionId: string, config: ToolSelectionConfig) => {
    const toolSelectionNode = state.nodes.find(node => node.id === toolSelectionId);
    if (!toolSelectionNode) {
      console.error('Tool Selection node not found:', toolSelectionId);
      return;
    }

    logSpawning('Starting block spawning for Tool Selection', { toolSelectionId, config });

    const spawnedBlocks = spawnToolSelectionBlocks(
      toolSelectionId,
      toolSelectionNode.position,
      config
    );

    // Add Run Name block
    dispatch({ type: 'ADD_NODE', payload: spawnedBlocks.runNameBlock });

    // Add Stage blocks
    spawnedBlocks.stageBlocks.forEach(stageBlock => {
      dispatch({ type: 'ADD_NODE', payload: stageBlock });
    });

    // Add Flow Step blocks
    spawnedBlocks.flowStepBlocks.forEach(flowStepBlock => {
      dispatch({ type: 'ADD_NODE', payload: flowStepBlock });
    });

    // Add connections after a small delay to ensure nodes are created
    setTimeout(() => {
      spawnedBlocks.connections.forEach(connection => {
        dispatch({ type: 'ADD_EDGE', payload: connection });
      });

      logSpawning('Tool Selection blocks spawned successfully', {
        runNameBlock: 1,
        stageBlocks: spawnedBlocks.stageBlocks.length,
        flowStepBlocks: spawnedBlocks.flowStepBlocks.length,
        connections: spawnedBlocks.connections.length
      });

      dispatch({ type: 'ADD_LOG', payload: `Auto-spawned blocks from Tool Selection: ${spawnedBlocks.stageBlocks.length} stage(s), ${spawnedBlocks.flowStepBlocks.length} flow step(s)` });
    }, 150);
  }, [state.nodes]);

  const updateWorkspaceSettings = useCallback((settings: Partial<WorkspaceSettings>) => {
    if (state.workspaceSettings) {
      const updatedSettings = { ...state.workspaceSettings, ...settings };
      dispatch({ type: 'SET_WORKSPACE_SETTINGS', payload: updatedSettings });
    }
  }, [state.workspaceSettings]);

  // Session persistence to preserve unsaved changes across page refreshes
  useEffect(() => {
    const loadSessionOrLastFlow = async () => {
      try {
        // First, try to load session data (unsaved changes)
        const sessionData = localStorage.getItem('pinnacle-flow-session');
        
        if (sessionData) {
          console.log('🔄 Restoring session data (unsaved changes)...');
          const parsedSession = JSON.parse(sessionData);
          
          // Restore the session state
          dispatch({ type: 'SET_NODES', payload: parsedSession.nodes || [] });
          dispatch({ type: 'SET_EDGES', payload: parsedSession.edges || [] });
          
          // Restore viewport if available
          if (parsedSession.viewport) {
            setTimeout(() => {
              const reactFlowInstance = (window as any).reactFlowInstance;
              if (reactFlowInstance) {
                reactFlowInstance.setViewport(parsedSession.viewport);
                console.log('✅ Session viewport restored');
              }
            }, 200);
          }
          
          dispatch({ type: 'ADD_LOG', payload: 'Restored unsaved session data' });
          return; // Don't load saved flow if we have session data
        }
        
        // If no session data, load the most recent saved flow
        console.log('🔄 No session data found, loading last saved flow...');
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
        } else {
          // No saved flows found, create default flow for first-time users
          console.log('🎯 No saved flows found, creating default flow for first-time user');
          setTimeout(() => {
            createDefaultFlowBlocks();
          }, 200);
        }
      } catch (error) {
        console.error('Failed to load session or last flow:', error);
        // If there's an error, just continue with empty flow
      }
    };

    // Only load on initial mount if there are no nodes yet
    // Add a small delay to ensure the component is fully mounted
    if (state.nodes.length === 0) {
      const timer = setTimeout(() => {
        loadSessionOrLastFlow();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []); // Empty dependency array - only run on mount

  // Save session data whenever canvas state changes
  useEffect(() => {
    if (state.nodes.length > 0 || state.edges.length > 0) {
      const reactFlowInstance = (window as any).reactFlowInstance;
      const currentViewport = reactFlowInstance ? reactFlowInstance.getViewport() : { x: 0, y: 0, zoom: 1 };
      
      const sessionData = {
        nodes: state.nodes,
        edges: state.edges,
        viewport: currentViewport,
        timestamp: Date.now(),
      };
      
      localStorage.setItem('pinnacle-flow-session', JSON.stringify(sessionData));
      console.log('💾 Session data saved to localStorage');
    }
     }, [state.nodes, state.edges]);

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
    createFlowChain,
    createPDStepsChain,
    createDefaultFlowBlocks,
    spawnToolSelectionBlocks: spawnToolSelectionBlocksHandler,
  };

  return (
    <FlowEditorContext.Provider value={contextValue}>
      {children}
      
      {/* FlowDir Approval Modal */}
      <FlowdirApprovalModal
        isOpen={flowdirModalOpen}
        onClose={handleFlowdirCancel}
        onApprove={handleFlowdirApprove}
        initialParameters={flowdirParameters || {}}
        userSettings={{
          workingDirectory: flowdirSettings?.working_directory,
          centralScriptsDirectory: flowdirSettings?.central_scripts_directory,
          mcpServerUrl: flowdirSettings?.mcp_server_url,
        }}
      />
    </FlowEditorContext.Provider>
  );
};
