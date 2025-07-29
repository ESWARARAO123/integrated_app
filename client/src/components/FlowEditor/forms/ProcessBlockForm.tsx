import React, { useState, useEffect } from 'react';
import { FlowNode, NodeData } from '../types/flow';

interface ProcessBlockFormProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void;
}

export const ProcessBlockForm: React.FC<ProcessBlockFormProps> = ({ node, onUpdate }) => {
  const [label, setLabel] = useState(node.data.label || '');
  const [stage, setStage] = useState(node.data.stage || 'SYNTH');
  const [tool, setTool] = useState(node.data.tool || 'cadence');
  const [description, setDescription] = useState(node.data.description || '');

  useEffect(() => {
    setLabel(node.data.label || '');
    setStage(node.data.stage || 'SYNTH');
    setTool(node.data.tool || 'cadence');
    setDescription(node.data.description || '');
  }, [node]);

  const handleUpdate = (field: string, newValue: any) => {
    const updates = { [field]: newValue };
    
    // Auto-update label when stage changes
    if (field === 'stage') {
      const stageLabels: Record<string, string> = {
        'SYNTH': 'Synthesis',
        'PD': 'Physical Design',
        'LEC': 'LEC Verification',
        'STA': 'STA Analysis',
      };
      updates.label = stageLabels[newValue] || newValue;
    }
    
    onUpdate(node.id, updates);
  };

  const stageOptions = [
    { value: 'SYNTH', label: 'Synthesis (SYNTH)', description: 'RTL to gate-level synthesis' },
    { value: 'PD', label: 'Physical Design (PD)', description: 'Place and route implementation' },
    { value: 'LEC', label: 'Logic Equivalence Check (LEC)', description: 'Verify logical equivalence' },
    { value: 'STA', label: 'Static Timing Analysis (STA)', description: 'Timing verification and analysis' },
  ];

  const toolOptions = [
    { value: 'cadence', label: 'Cadence', description: 'Cadence EDA tools' },
    { value: 'synopsys', label: 'Synopsys', description: 'Synopsys EDA tools' },
  ];

  const getStageInfo = () => {
    const stageInfo: Record<string, { description: string; inputs: string[]; outputs: string[] }> = {
      'SYNTH': {
        description: 'Converts RTL code to gate-level netlist using synthesis tools.',
        inputs: ['RTL files', 'Constraints', 'Technology library'],
        outputs: ['Gate-level netlist', 'Synthesis reports', 'Timing constraints'],
      },
      'PD': {
        description: 'Performs physical implementation including floorplan, placement, and routing.',
        inputs: ['Gate-level netlist', 'Floorplan', 'Timing constraints'],
        outputs: ['Physical layout', 'DEF files', 'Timing reports'],
      },
      'LEC': {
        description: 'Verifies logical equivalence between different representations.',
        inputs: ['Reference netlist', 'Implementation netlist'],
        outputs: ['Equivalence report', 'Verification logs'],
      },
      'STA': {
        description: 'Analyzes timing paths and verifies timing constraints.',
        inputs: ['Netlist', 'Timing constraints', 'Parasitic data'],
        outputs: ['Timing reports', 'Violation reports'],
      },
    };
    return stageInfo[stage] || stageInfo['SYNTH'];
  };

  const stageInfo = getStageInfo();

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

  const textareaStyle = {
    ...inputStyle,
    minHeight: '60px',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
  };

  return (
    <form style={formStyle}>
      <div style={fieldStyle}>
        <label style={labelStyle}>Block Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            handleUpdate('label', e.target.value);
          }}
          style={inputStyle}
          placeholder="Enter block label"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Flow Stage</label>
        <select
          value={stage}
          onChange={(e) => {
            setStage(e.target.value);
            handleUpdate('stage', e.target.value);
          }}
          style={inputStyle}
        >
          {stageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span style={{
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          {stageOptions.find(opt => opt.value === stage)?.description}
        </span>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>EDA Tool</label>
        <select
          value={tool}
          onChange={(e) => {
            const validTool = e.target.value as 'cadence' | 'synopsys';
            setTool(validTool);
            handleUpdate('tool', validTool);
          }}
          style={inputStyle}
        >
          {toolOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span style={{
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          {toolOptions.find(opt => opt.value === tool)?.description}
        </span>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Description (Optional)</label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            handleUpdate('description', e.target.value);
          }}
          style={textareaStyle}
          placeholder="Enter block description"
        />
      </div>

      <div style={{
        padding: '12px',
        backgroundColor: 'var(--color-surface-light)',
        borderRadius: '6px',
        border: '1px solid var(--color-border)',
      }}>
        <h4 style={{
          margin: '0 0 8px 0',
          color: 'var(--color-text)',
          fontSize: '12px',
          fontWeight: '600',
        }}>
          Stage Information
        </h4>
        <p style={{
          margin: '0 0 12px 0',
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          {stageInfo.description}
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <h5 style={{
              margin: '0 0 4px 0',
              color: 'var(--color-text)',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Inputs
            </h5>
            <ul style={{
              margin: 0,
              padding: '0 0 0 12px',
              color: 'var(--color-text-secondary)',
              fontSize: '10px',
              lineHeight: '1.3',
            }}>
              {stageInfo.inputs.map((input, index) => (
                <li key={index}>{input}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h5 style={{
              margin: '0 0 4px 0',
              color: 'var(--color-text)',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Outputs
            </h5>
            <ul style={{
              margin: 0,
              padding: '0 0 0 12px',
              color: 'var(--color-text-secondary)',
              fontSize: '10px',
              lineHeight: '1.3',
            }}>
              {stageInfo.outputs.map((output, index) => (
                <li key={index}>{output}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </form>
  );
};
