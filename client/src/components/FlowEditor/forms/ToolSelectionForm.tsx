import React, { useState, useEffect } from 'react';
import { FlowNode } from '../types/flow';
import { useFlowEditor } from '../FlowEditorProvider';

interface ToolSelectionFormProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: any) => void;
}

interface ToolSelectionConfig {
  toolUsed: string;
  runName: string;
  stageSelection: string;
  runFlowSteps: string;
}

export const ToolSelectionForm: React.FC<ToolSelectionFormProps> = ({ node, onUpdate }) => {
  const { spawnToolSelectionBlocks } = useFlowEditor();
  
  // Initialize state from node data
  const [config, setConfig] = useState<ToolSelectionConfig>({
    toolUsed: node.data.value || 'cadence',
    runName: node.data.parameters?.runName || '',
    stageSelection: node.data.parameters?.stageSelection || '',
    runFlowSteps: node.data.parameters?.runFlowSteps || '',
  });

  const [hasAppliedConfig, setHasAppliedConfig] = useState(false);

  useEffect(() => {
    setConfig({
      toolUsed: node.data.value || 'cadence',
      runName: node.data.parameters?.runName || '',
      stageSelection: node.data.parameters?.stageSelection || '',
      runFlowSteps: node.data.parameters?.runFlowSteps || '',
    });
  }, [node]);

  const handleConfigChange = (field: keyof ToolSelectionConfig, value: string) => {
    const newConfig = { ...config, [field]: value };
    
    // Reset runFlowSteps if stageSelection is not PD or all
    if (field === 'stageSelection' && value !== 'PD' && value !== 'all') {
      newConfig.runFlowSteps = '';
    }
    
    setConfig(newConfig);
    
    // Update the node data immediately
    const updates = {
      value: field === 'toolUsed' ? value : config.toolUsed,
      parameters: {
        ...node.data.parameters,
        [field]: value,
      },
    };
    
    onUpdate(node.id, updates);
  };

  const handleApplyConfiguration = () => {
    if (!config.runName || !config.stageSelection) {
      alert('Please fill in Run Name and Stage Selection before applying configuration.');
      return;
    }

    // Update node with final configuration
    const updates = {
      value: config.toolUsed,
      parameters: {
        ...node.data.parameters,
        runName: config.runName,
        stageSelection: config.stageSelection,
        runFlowSteps: config.runFlowSteps,
        configurationApplied: true,
      },
    };
    
    onUpdate(node.id, updates);
    
    // Trigger automatic block spawning
    spawnToolSelectionBlocks(node.id, config);
    setHasAppliedConfig(true);
  };

  const isRunFlowStepsEnabled = config.stageSelection === 'PD' || config.stageSelection === 'all';

  const formStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  };

  const fieldStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  };

  const labelStyle = {
    color: 'var(--color-text)',
    fontSize: '13px',
    fontWeight: '500' as const,
  };

  const inputStyle = {
    padding: '8px 12px',
    backgroundColor: 'var(--color-surface-dark)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    color: 'var(--color-text)',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  };

  const disabledInputStyle = {
    ...inputStyle,
    backgroundColor: 'var(--color-surface-darker)',
    color: 'var(--color-text-muted)',
    cursor: 'not-allowed',
  };

  const buttonStyle = {
    padding: '10px 16px',
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'var(--color-border)',
    cursor: 'not-allowed',
  };

  return (
    <form style={formStyle}>
      {/* Tool Selection */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Tool Selection</label>
        <select
          value={config.toolUsed}
          onChange={(e) => handleConfigChange('toolUsed', e.target.value)}
          style={inputStyle}
        >
          <option value="cadence">Cadence</option>
          <option value="synopsys">Synopsys</option>
        </select>
      </div>

      {/* Run Name */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Run Name *</label>
        <input
          type="text"
          value={config.runName}
          onChange={(e) => handleConfigChange('runName', e.target.value)}
          style={inputStyle}
          placeholder="Enter run name (e.g., run_001)"
        />
      </div>

      {/* Stage Selection */}
      <div style={fieldStyle}>
        <label style={labelStyle}>Stage Selection *</label>
        <select
          value={config.stageSelection}
          onChange={(e) => handleConfigChange('stageSelection', e.target.value)}
          style={inputStyle}
        >
          <option value="">Select stage</option>
          <option value="SYNTH">SYNTH</option>
          <option value="PD">PD</option>
          <option value="LEC">LEC</option>
          <option value="STA">STA</option>
          <option value="all">all</option>
        </select>
      </div>

      {/* Run Flow Steps (Conditional) */}
      <div style={fieldStyle}>
        <label style={labelStyle}>
          Run Flow Steps
          {!isRunFlowStepsEnabled && (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', marginLeft: '8px' }}>
              (Only available for PD or all stages)
            </span>
          )}
        </label>
        <select
          value={config.runFlowSteps}
          onChange={(e) => handleConfigChange('runFlowSteps', e.target.value)}
          style={isRunFlowStepsEnabled ? inputStyle : disabledInputStyle}
          disabled={!isRunFlowStepsEnabled}
        >
          <option value="">Select flow steps</option>
          <option value="floorplan">floorplan</option>
          <option value="placement">placement</option>
          <option value="CTS">CTS</option>
          <option value="ROUTE">ROUTE</option>
          <option value="all">all</option>
        </select>
      </div>

      {/* Apply Configuration Button */}
      <div style={{ marginTop: '8px' }}>
        <button
          type="button"
          onClick={handleApplyConfiguration}
          style={config.runName && config.stageSelection ? buttonStyle : disabledButtonStyle}
          disabled={!config.runName || !config.stageSelection || hasAppliedConfig}
        >
          {hasAppliedConfig ? 'Configuration Applied' : 'Apply Configuration & Spawn Blocks'}
        </button>
      </div>

      {/* Configuration Info */}
      <div style={{
        padding: '12px',
        backgroundColor: 'var(--color-surface-light)',
        borderRadius: '6px',
        border: '1px solid var(--color-border)',
        marginTop: '8px',
      }}>
        <h4 style={{
          margin: '0 0 8px 0',
          color: 'var(--color-text)',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          Configuration Preview
        </h4>
        <div style={{
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          <p style={{ margin: '0 0 4px 0' }}>
            <strong>Tool:</strong> {config.toolUsed}
          </p>
          <p style={{ margin: '0 0 4px 0' }}>
            <strong>Run Name:</strong> {config.runName || 'Not set'}
          </p>
          <p style={{ margin: '0 0 4px 0' }}>
            <strong>Stage:</strong> {config.stageSelection || 'Not set'}
          </p>
          {isRunFlowStepsEnabled && (
            <p style={{ margin: '0' }}>
              <strong>Flow Steps:</strong> {config.runFlowSteps || 'Not set'}
            </p>
          )}
        </div>
      </div>

      {/* Help Text */}
      <div style={{
        padding: '12px',
        backgroundColor: 'var(--color-info-bg)',
        borderRadius: '6px',
        border: '1px solid var(--color-info)',
        marginTop: '8px',
      }}>
        <h4 style={{
          margin: '0 0 8px 0',
          color: 'var(--color-info)',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          How it works
        </h4>
        <p style={{
          margin: 0,
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          When you apply the configuration, blocks will be automatically created and connected:
          <br />• Run Name block will be created and connected to this Tool Selection block
          <br />• Stage blocks will be created based on your selection
          <br />• If PD is selected, Run Flow Steps blocks will also be created
        </p>
      </div>
    </form>
  );
};
