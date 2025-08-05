import { FlowNode, FlowEdge } from '../types/flow';

/**
 * Tool Selection Block Spawning Utility
 *
 * This module handles automatic block creation and connection based on
 * Tool Selection block configuration. It follows the pattern:
 *
 * Tool Selection → Stage Block(s) → Run Name → Run Flow Step Block(s) (if applicable)
 */

export interface ToolSelectionConfig {
  toolUsed: string;
  runName: string;
  stageSelection: string;
  runFlowSteps: string;
}

export interface SpawnedBlocks {
  runNameBlock: FlowNode;
  stageBlocks: FlowNode[];
  flowStepBlocks: FlowNode[];
  connections: FlowEdge[];
}

/**
 * Generate unique IDs for spawned blocks
 */
export const generateSpawnedBlockIds = (baseId: string): { [key: string]: string } => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  
  return {
    runName: `${baseId}-run-name-${timestamp}-${random}`,
    synth: `${baseId}-synth-${timestamp}-${random}`,
    pd: `${baseId}-pd-${timestamp}-${random}`,
    lec: `${baseId}-lec-${timestamp}-${random}`,
    sta: `${baseId}-sta-${timestamp}-${random}`,
    floorplan: `${baseId}-floorplan-${timestamp}-${random}`,
    placement: `${baseId}-placement-${timestamp}-${random}`,
    cts: `${baseId}-cts-${timestamp}-${random}`,
    route: `${baseId}-route-${timestamp}-${random}`,
  };
};

/**
 * Calculate positions for spawned blocks based on the Tool Selection block position
 * New order: Tool Selection → Stage → Run Name → Run Flow Steps
 */
export const calculateSpawnPositions = (
  toolSelectionPosition: { x: number; y: number },
  config: ToolSelectionConfig
) => {
  const baseX = toolSelectionPosition.x;
  const baseY = toolSelectionPosition.y;
  const horizontalSpacing = 300;
  const verticalSpacing = 150;

  const positions = {
    // Stage blocks come first (position 1)
    stages: {
      single: { x: baseX + horizontalSpacing, y: baseY },
      multiple: {
        synth: { x: baseX + horizontalSpacing, y: baseY - verticalSpacing },
        pd: { x: baseX + horizontalSpacing, y: baseY },
        lec: { x: baseX + horizontalSpacing, y: baseY + verticalSpacing },
        sta: { x: baseX + horizontalSpacing, y: baseY + verticalSpacing * 2 },
      },
    },
    // Run Name comes second (position 2)
    runName: { x: baseX + horizontalSpacing * 2, y: baseY },
    // Flow Steps come third (position 3)
    flowSteps: {
      single: { x: baseX + horizontalSpacing * 3, y: baseY },
      multiple: {
        floorplan: { x: baseX + horizontalSpacing * 3, y: baseY - verticalSpacing / 2 },
        placement: { x: baseX + horizontalSpacing * 3, y: baseY },
        cts: { x: baseX + horizontalSpacing * 3, y: baseY + verticalSpacing / 2 },
        route: { x: baseX + horizontalSpacing * 3, y: baseY + verticalSpacing },
      },
    },
  };

  return positions;
};

/**
 * Create Run Name block
 */
export const createRunNameBlock = (
  blockId: string,
  position: { x: number; y: number },
  runName: string
): FlowNode => {
  return {
    id: blockId,
    type: 'input',
    position,
    data: {
      label: 'Run Name',
      status: 'idle' as const,
      parameters: {},
      parameterName: 'run_name',
      value: runName,
      inputType: 'text' as const,
      description: 'Execution run identifier',
      options: [],
    },
  };
};

/**
 * Create Stage blocks based on selection
 */
export const createStageBlocks = (
  blockIds: { [key: string]: string },
  positions: any,
  stageSelection: string
): FlowNode[] => {
  const stageBlocks: FlowNode[] = [];

  if (stageSelection === 'all') {
    // Create all 4 stage blocks
    const stages = [
      { key: 'synth', label: 'SYNTH', parameterName: 'stage_synth', value: 'SYNTH' },
      { key: 'pd', label: 'PD', parameterName: 'stage_pd', value: 'PD' },
      { key: 'lec', label: 'LEC', parameterName: 'stage_lec', value: 'LEC' },
      { key: 'sta', label: 'STA', parameterName: 'stage_sta', value: 'STA' },
    ];

    stages.forEach(stage => {
      stageBlocks.push({
        id: blockIds[stage.key],
        type: 'input',
        position: positions.stages.multiple[stage.key],
        data: {
          label: stage.label,
          status: 'idle' as const,
          parameters: {},
          parameterName: stage.parameterName,
          value: stage.value,
          inputType: 'text' as const,
          description: `${stage.label} stage`,
          options: [],
        },
      });
    });
  } else {
    // Create single stage block
    const stageInfo = {
      SYNTH: { parameterName: 'stage_synth', value: 'SYNTH' },
      PD: { parameterName: 'stage_pd', value: 'PD' },
      LEC: { parameterName: 'stage_lec', value: 'LEC' },
      STA: { parameterName: 'stage_sta', value: 'STA' },
    }[stageSelection];

    if (stageInfo) {
      stageBlocks.push({
        id: blockIds[stageSelection.toLowerCase()],
        type: 'input',
        position: positions.stages.single,
        data: {
          label: stageSelection,
          status: 'idle' as const,
          parameters: {},
          parameterName: stageInfo.parameterName,
          value: stageInfo.value,
          inputType: 'text' as const,
          description: `${stageSelection} stage`,
          options: [],
        },
      });
    }
  }

  return stageBlocks;
};

/**
 * Create Run Flow Steps blocks (only for PD stage)
 */
export const createFlowStepBlocks = (
  blockIds: { [key: string]: string },
  positions: any,
  runFlowSteps: string,
  stageSelection: string
): FlowNode[] => {
  const flowStepBlocks: FlowNode[] = [];

  // Only create flow step blocks if stage is PD or all
  if (stageSelection !== 'PD' && stageSelection !== 'all') {
    return flowStepBlocks;
  }

  if (runFlowSteps === 'all') {
    // Create all 4 flow step blocks
    const steps = [
      { key: 'floorplan', label: 'Floorplan', parameterName: 'pd_step_floorplan', value: 'Floorplan' },
      { key: 'placement', label: 'Placement', parameterName: 'pd_step_placement', value: 'Placement' },
      { key: 'cts', label: 'CTS', parameterName: 'pd_step_cts', value: 'CTS' },
      { key: 'route', label: 'Route', parameterName: 'pd_step_route', value: 'Route' },
    ];

    steps.forEach(step => {
      flowStepBlocks.push({
        id: blockIds[step.key],
        type: 'input',
        position: positions.flowSteps.multiple[step.key],
        data: {
          label: step.label,
          status: 'idle' as const,
          parameters: {},
          parameterName: step.parameterName,
          value: step.value,
          inputType: 'text' as const,
          description: `${step.label} step`,
          options: [],
        },
      });
    });
  } else if (runFlowSteps) {
    // Create single flow step block
    const stepInfo = {
      floorplan: { parameterName: 'pd_step_floorplan', value: 'Floorplan' },
      placement: { parameterName: 'pd_step_placement', value: 'Placement' },
      CTS: { parameterName: 'pd_step_cts', value: 'CTS' },
      ROUTE: { parameterName: 'pd_step_route', value: 'Route' },
    }[runFlowSteps];

    if (stepInfo) {
      flowStepBlocks.push({
        id: blockIds[runFlowSteps.toLowerCase()],
        type: 'input',
        position: positions.flowSteps.single,
        data: {
          label: runFlowSteps,
          status: 'idle' as const,
          parameters: {},
          parameterName: stepInfo.parameterName,
          value: stepInfo.value,
          inputType: 'text' as const,
          description: `${runFlowSteps} step`,
          options: [],
        },
      });
    }
  }

  return flowStepBlocks;
};

/**
 * Create connections between all spawned blocks
 * New order: Tool Selection → Stage → Run Name → Run Flow Steps
 */
export const createSpawnedConnections = (
  toolSelectionId: string,
  runNameBlock: FlowNode,
  stageBlocks: FlowNode[],
  flowStepBlocks: FlowNode[]
): FlowEdge[] => {
  const connections: FlowEdge[] = [];

  // Tool Selection → Stage Blocks (first connection)
  stageBlocks.forEach(stageBlock => {
    connections.push({
      id: `edge-${toolSelectionId}-${stageBlock.id}`,
      source: toolSelectionId,
      target: stageBlock.id,
      animated: true,
    });
  });

  // Stage Blocks → Run Name (second connection)
  stageBlocks.forEach(stageBlock => {
    connections.push({
      id: `edge-${stageBlock.id}-${runNameBlock.id}`,
      source: stageBlock.id,
      target: runNameBlock.id,
      animated: true,
    });
  });

  // Run Name → Flow Step Blocks (third connection, if applicable)
  if (flowStepBlocks.length > 0) {
    flowStepBlocks.forEach(flowStepBlock => {
      connections.push({
        id: `edge-${runNameBlock.id}-${flowStepBlock.id}`,
        source: runNameBlock.id,
        target: flowStepBlock.id,
        animated: true,
      });
    });
  }

  return connections;
};

/**
 * Main function to spawn all blocks and connections
 */
export const spawnToolSelectionBlocks = (
  toolSelectionId: string,
  toolSelectionPosition: { x: number; y: number },
  config: ToolSelectionConfig
): SpawnedBlocks => {
  const blockIds = generateSpawnedBlockIds(toolSelectionId);
  const positions = calculateSpawnPositions(toolSelectionPosition, config);

  // Create blocks
  const runNameBlock = createRunNameBlock(blockIds.runName, positions.runName, config.runName);
  const stageBlocks = createStageBlocks(blockIds, positions, config.stageSelection);
  const flowStepBlocks = createFlowStepBlocks(blockIds, positions, config.runFlowSteps, config.stageSelection);

  // Create connections
  const connections = createSpawnedConnections(toolSelectionId, runNameBlock, stageBlocks, flowStepBlocks);

  return {
    runNameBlock,
    stageBlocks,
    flowStepBlocks,
    connections,
  };
};

/**
 * Utility to log spawning events
 */
export const logSpawning = (action: string, details?: any): void => {
  console.log(`🎯 Tool Selection Spawning: ${action}`, details || '');
};
