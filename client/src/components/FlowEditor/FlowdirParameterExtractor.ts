import { FlowNode } from './types/flow';
import { FlowdirParameters } from './FlowdirApprovalModal';

export interface FlowNodeData {
  label?: string;
  value?: string;
  nodeType?: string;
  parameters?: Record<string, any>;
}

/**
 * Extracts FlowDir parameters from flow nodes
 * Looks for specific node types and their configured values
 */
export const extractFlowdirParameters = (nodes: FlowNode[]): Partial<FlowdirParameters> | null => {
  const parameters: Partial<FlowdirParameters> = {};
  
  // Look for project name node
  const projectNode = nodes.find(node => 
    node.data?.nodeType === 'project' || 
    node.data?.label?.toLowerCase().includes('project') ||
    node.data?.parameterName === 'projectName'
  );
  if (projectNode?.data?.value) {
    parameters.projectName = projectNode.data.value;
  }

  // Look for block name node
  const blockNode = nodes.find(node => 
    node.data?.nodeType === 'block' || 
    node.data?.label?.toLowerCase().includes('block') ||
    node.data?.parameterName === 'blockName'
  );
  if (blockNode?.data?.value) {
    parameters.blockName = blockNode.data.value;
  }

  // Look for tool selection node
  const toolNode = nodes.find(node => 
    node.data?.nodeType === 'tool' || 
    node.data?.label?.toLowerCase().includes('tool') ||
    node.data?.parameterName === 'toolName'
  );
  if (toolNode?.data?.value) {
    parameters.toolName = toolNode.data.value as 'cadence' | 'synopsys';
  }

  // Look for stage/flow selection node
  const stageNode = nodes.find(node => 
    node.data?.nodeType === 'stage' || 
    node.data?.label?.toLowerCase().includes('stage') ||
    node.data?.label?.toLowerCase().includes('flow') ||
    node.data?.parameterName === 'stage'
  );
  if (stageNode?.data?.value) {
    parameters.stage = stageNode.data.value as any;
  }

  // Look for PD steps node (when stage is PD)
  const pdStepsNode = nodes.find(node => 
    node.data?.nodeType === 'pdSteps' || 
    node.data?.label?.toLowerCase().includes('pd steps') ||
    node.data?.parameterName === 'pdSteps'
  );
  if (pdStepsNode?.data?.value) {
    parameters.pdSteps = pdStepsNode.data.value;
  }

  // Look for run name node
  const runNode = nodes.find(node => 
    node.data?.nodeType === 'run' || 
    node.data?.label?.toLowerCase().includes('run') ||
    node.data?.parameterName === 'runName'
  );
  if (runNode?.data?.value) {
    parameters.runName = runNode.data.value;
  } else {
    // Generate default run name with timestamp
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
    parameters.runName = `run-${timestamp}`;
  }

  // Look for reference run node (optional)
  const refRunNode = nodes.find(node => 
    node.data?.nodeType === 'referenceRun' || 
    node.data?.label?.toLowerCase().includes('reference') ||
    node.data?.parameterName === 'referenceRun'
  );
  if (refRunNode?.data?.value) {
    parameters.referenceRun = refRunNode.data.value;
  }

  // Check if we have minimum required parameters
  const hasRequiredParams = parameters.projectName && parameters.blockName && parameters.toolName;
  
  if (!hasRequiredParams) {
    return null;
  }

  // Set defaults for missing optional parameters
  if (!parameters.stage) {
    parameters.stage = 'all';
  }
  
  if (!parameters.pdSteps && parameters.stage === 'PD') {
    parameters.pdSteps = 'all';
  }

  return parameters;
};

/**
 * Validates extracted parameters and returns validation errors
 */
export const validateFlowdirParameters = (parameters: Partial<FlowdirParameters>): string[] => {
  const errors: string[] = [];

  if (!parameters.projectName?.trim()) {
    errors.push('Project name is required');
  }

  if (!parameters.blockName?.trim()) {
    errors.push('Block name is required');
  }

  if (!parameters.toolName) {
    errors.push('Tool selection is required');
  }

  if (!parameters.stage) {
    errors.push('Stage selection is required');
  }

  if (!parameters.runName?.trim()) {
    errors.push('Run name is required');
  }

  // Validate project name format (no spaces, special chars)
  if (parameters.projectName && !/^[a-zA-Z0-9_-]+$/.test(parameters.projectName)) {
    errors.push('Project name should only contain letters, numbers, underscores, and hyphens');
  }

  // Validate block name format
  if (parameters.blockName && !/^[a-zA-Z0-9_-]+$/.test(parameters.blockName)) {
    errors.push('Block name should only contain letters, numbers, underscores, and hyphens');
  }

  // Validate run name format
  if (parameters.runName && !/^[a-zA-Z0-9_-]+$/.test(parameters.runName)) {
    errors.push('Run name should only contain letters, numbers, underscores, and hyphens');
  }

  return errors;
};

/**
 * Gets a user-friendly description of the FlowDir execution
 */
export const getFlowdirDescription = (parameters: Partial<FlowdirParameters>): string => {
  const { projectName, blockName, toolName, stage, pdSteps } = parameters;
  
  let description = `Create VLSI directory structure for project "${projectName || 'Unknown'}"`;
  
  if (blockName) {
    description += `, block "${blockName}"`;
  }
  
  if (toolName) {
    description += ` using ${toolName}`;
  }
  
  if (stage) {
    if (stage === 'all') {
      description += ' for all flow stages (SYNTH + PD + LEC + STA)';
    } else if (stage === 'PD' && pdSteps && pdSteps !== 'all') {
      description += ` for Physical Design (${pdSteps})`;
    } else {
      description += ` for ${stage} stage`;
    }
  }
  
  return description;
};

/**
 * Estimates the number of directories that will be created
 */
export const estimateDirectoryCount = (parameters: Partial<FlowdirParameters>): number => {
  const { stage, pdSteps } = parameters;
  let estimate = 20; // Base directories (RTL, config, etc.)
  
  if (stage === 'all') {
    estimate += 120; // All stages with full structure
  } else if (stage === 'PD') {
    const steps = pdSteps === 'all' ? 4 : (pdSteps?.split(',').length || 1);
    estimate += steps * 15; // ~15 directories per PD step
  } else if (stage === 'Synthesis') {
    estimate += 15;
  } else if (stage === 'LEC' || stage === 'STA') {
    estimate += 25;
  }
  
  return estimate;
}; 