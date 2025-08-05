import React from 'react';
import { FlowNode, FlowEdge, NodeTemplate } from '../types/flow';
import { Database, Wrench } from 'lucide-react';

/**
 * Auto Flow Creation Utility
 * 
 * This module handles the automatic creation of three pre-connected blocks:
 * 1. Project Input (top)
 * 2. Block Name (middle) 
 * 3. Tool Selection (bottom)
 * 
 * Used when:
 * - User opens canvas for the first time
 * - User clicks "New" button to create a new canvas
 */

export interface AutoFlowConfig {
  enabled: boolean;
  blocks: AutoBlockConfig[];
  positioning: PositioningConfig;
  connections: ConnectionConfig[];
}

export interface AutoBlockConfig {
  template: NodeTemplate;
  position: { x: number; y: number };
  id: string;
}

export interface PositioningConfig {
  startX: number;
  startY: number;
  verticalSpacing: number;
}

export interface ConnectionConfig {
  sourceId: string;
  targetId: string;
}

/**
 * Default configuration for auto-created flow
 */
export const DEFAULT_AUTO_FLOW_CONFIG: AutoFlowConfig = {
  enabled: true,
  positioning: {
    startX: 100,
    startY: 200,
    verticalSpacing: 300, // Horizontal spacing between blocks (side by side)
  },
  blocks: [
    {
      id: 'auto-project-input',
      template: {
        type: 'input',
        label: 'Project Input',
        icon: React.createElement(Database, { size: 20 }),
        description: 'Project configuration',
        category: 'input' as const,
        defaultData: {
          label: 'Project Input',
          parameterName: 'project_name',
          value: '',
          inputType: 'text' as const,
          status: 'idle' as const,
          parameters: {},
        },
      },
      position: { x: 100, y: 200 }, // First block - leftmost
    },
    {
      id: 'auto-block-input',
      template: {
        type: 'input',
        label: 'Block Input',
        icon: React.createElement(Database, { size: 20 }),
        description: 'Block configuration',
        category: 'input' as const,
        defaultData: {
          label: 'Block Input',
          parameterName: 'block_name',
          value: '',
          inputType: 'text' as const,
          status: 'idle' as const,
          parameters: {},
        },
      },
      position: { x: 400, y: 200 }, // Second block - middle
    },
    {
      id: 'auto-tool-selection',
      template: {
        type: 'input',
        label: 'Tool Selection',
        icon: React.createElement(Wrench, { size: 20 }),
        description: 'EDA tool selection',
        category: 'input' as const,
        defaultData: {
          label: 'Tool Selection',
          parameterName: 'tool_used',
          value: 'cadence',
          inputType: 'select' as const,
          options: ['cadence', 'synopsys'],
          status: 'idle' as const,
          parameters: {},
        },
      },
      position: { x: 700, y: 200 }, // Third block - rightmost
    },
  ],
  connections: [
    {
      sourceId: 'auto-project-input',
      targetId: 'auto-block-input',
    },
    {
      sourceId: 'auto-block-input',
      targetId: 'auto-tool-selection',
    },
  ],
};

/**
 * Generate unique IDs for auto-created blocks to avoid conflicts
 */
export const generateAutoBlockIds = (): { [key: string]: string } => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);

  return {
    projectInput: `auto-project-input-${timestamp}-${random}`,
    blockInput: `auto-block-input-${timestamp}-${random}`,
    toolSelection: `auto-tool-selection-${timestamp}-${random}`,
  };
};

/**
 * Create the default flow nodes with unique IDs
 */
export const createDefaultFlowNodes = (config: AutoFlowConfig = DEFAULT_AUTO_FLOW_CONFIG): FlowNode[] => {
  if (!config.enabled) {
    return [];
  }

  const blockIds = generateAutoBlockIds();
  const nodes: FlowNode[] = [];

  // Create Project Input node
  const projectInputTemplate = config.blocks[0].template;
  const projectInputNode: FlowNode = {
    id: blockIds.projectInput,
    type: 'input',
    position: config.blocks[0].position,
    data: {
      label: projectInputTemplate.label,
      status: 'idle' as const,
      parameters: {},
      parameterName: projectInputTemplate.defaultData.parameterName || '',
      value: projectInputTemplate.defaultData.value || '',
      inputType: projectInputTemplate.defaultData.inputType || 'text' as const,
      description: projectInputTemplate.description,
      options: projectInputTemplate.defaultData.options || [],
    },
  };
  nodes.push(projectInputNode);

  // Create Block Input node
  const blockInputTemplate = config.blocks[1].template;
  const blockInputNode: FlowNode = {
    id: blockIds.blockInput,
    type: 'input',
    position: config.blocks[1].position,
    data: {
      label: blockInputTemplate.label,
      status: 'idle' as const,
      parameters: {},
      parameterName: blockInputTemplate.defaultData.parameterName || '',
      value: blockInputTemplate.defaultData.value || '',
      inputType: blockInputTemplate.defaultData.inputType || 'text' as const,
      description: blockInputTemplate.description,
      options: blockInputTemplate.defaultData.options || [],
    },
  };
  nodes.push(blockInputNode);

  // Create Tool Selection node
  const toolSelectionTemplate = config.blocks[2].template;
  const toolSelectionNode: FlowNode = {
    id: blockIds.toolSelection,
    type: 'input',
    position: config.blocks[2].position,
    data: {
      label: toolSelectionTemplate.label,
      status: 'idle' as const,
      parameters: {},
      parameterName: toolSelectionTemplate.defaultData.parameterName || '',
      value: toolSelectionTemplate.defaultData.value || '',
      inputType: toolSelectionTemplate.defaultData.inputType || 'text' as const,
      description: toolSelectionTemplate.description,
      options: toolSelectionTemplate.defaultData.options || [],
    },
  };
  nodes.push(toolSelectionNode);

  return nodes;
};

/**
 * Create the default flow edges connecting the nodes
 */
export const createDefaultFlowEdges = (nodes: FlowNode[]): FlowEdge[] => {
  if (nodes.length < 3) {
    return [];
  }

  const edges: FlowEdge[] = [];

  // Connect Project Input → Block Input
  edges.push({
    id: `edge-${nodes[0].id}-${nodes[1].id}`,
    source: nodes[0].id,
    target: nodes[1].id,
    animated: true,
  });

  // Connect Block Input → Tool Selection
  edges.push({
    id: `edge-${nodes[1].id}-${nodes[2].id}`,
    source: nodes[1].id,
    target: nodes[2].id,
    animated: true,
  });

  return edges;
};

/**
 * Main function to create the complete default flow
 */
export const createDefaultFlow = (config: AutoFlowConfig = DEFAULT_AUTO_FLOW_CONFIG): { nodes: FlowNode[]; edges: FlowEdge[] } => {
  const nodes = createDefaultFlowNodes(config);
  const edges = createDefaultFlowEdges(nodes);

  return { nodes, edges };
};

/**
 * Check if the canvas should auto-create blocks
 * Returns true if canvas is empty or only has auto-created blocks
 */
export const shouldAutoCreateBlocks = (existingNodes: FlowNode[]): boolean => {
  // If no nodes exist, auto-create
  if (existingNodes.length === 0) {
    return true;
  }

  // If only auto-created nodes exist (user hasn't added custom blocks), don't auto-create again
  const hasNonAutoNodes = existingNodes.some(node => 
    !node.id.startsWith('auto-project-input') && 
    !node.id.startsWith('auto-block-input') && 
    !node.id.startsWith('auto-tool-selection')
  );

  // Only auto-create if there are no custom nodes
  return !hasNonAutoNodes && existingNodes.length === 0;
};

/**
 * Utility to log auto-creation events
 */
export const logAutoCreation = (action: string, details?: any): void => {
  console.log(`🎯 Auto Flow Creation: ${action}`, details || '');
};
