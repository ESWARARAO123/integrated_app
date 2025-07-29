import React, { useState, useEffect } from 'react';
import { FlowNode, NodeData } from '../types/flow';

interface InputBlockFormProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void;
}

export const InputBlockForm: React.FC<InputBlockFormProps> = ({ node, onUpdate }) => {
  const [label, setLabel] = useState(node.data.label || '');
  const [parameterName, setParameterName] = useState(node.data.parameterName || '');
  const [value, setValue] = useState(node.data.value || '');
  const [inputType, setInputType] = useState(node.data.inputType || 'text');
  const [description, setDescription] = useState(node.data.description || '');

  useEffect(() => {
    setLabel(node.data.label || '');
    setParameterName(node.data.parameterName || '');
    setValue(node.data.value || '');
    setInputType(node.data.inputType || 'text');
    setDescription(node.data.description || '');
  }, [node]);

  const handleUpdate = (field: string, newValue: any) => {
    const updates = { [field]: newValue };
    
    // Auto-update label when parameter name changes
    if (field === 'parameterName') {
      updates.label = newValue.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    
    onUpdate(node.id, updates);
  };

  const parameterOptions = [
    { value: 'project_name', label: 'Project Name' },
    { value: 'block_name', label: 'Block Name' },
    { value: 'tool_used', label: 'Tool Selection' },
    { value: 'stage_in_flow', label: 'Stage Selection' },
    { value: 'run_name', label: 'Run Name' },
    { value: 'steps', label: 'PD Steps' },
    { value: 'ref_run_path', label: 'Reference Run Path' },
    { value: 'user_name', label: 'User Name' },
  ];

  const getInputOptions = () => {
    switch (parameterName) {
      case 'tool_used':
        return ['cadence', 'synopsys'];
      case 'stage_in_flow':
        return ['SYNTH', 'PD', 'LEC', 'STA', 'all'];
      case 'steps':
        return ['Floorplan', 'Place', 'CTS', 'Route'];
      default:
        return [];
    }
  };

  const inputOptions = getInputOptions();
  const shouldShowSelect = inputOptions.length > 0;

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
        <label style={labelStyle}>Parameter Type</label>
        <select
          value={parameterName}
          onChange={(e) => {
            setParameterName(e.target.value);
            handleUpdate('parameterName', e.target.value);
            // Reset value when parameter type changes
            setValue('');
            handleUpdate('value', '');
          }}
          style={inputStyle}
        >
          <option value="">Select parameter type</option>
          {parameterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {parameterName && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Value</label>
          {shouldShowSelect ? (
            <select
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                handleUpdate('value', e.target.value);
              }}
              style={inputStyle}
            >
              <option value="">Select value</option>
              {inputOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                handleUpdate('value', e.target.value);
              }}
              style={inputStyle}
              placeholder={`Enter ${parameterName.replace(/_/g, ' ')}`}
            />
          )}
        </div>
      )}

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
          Parameter Info
        </h4>
        <p style={{
          margin: 0,
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          {parameterName ? (
            <>
              This input will provide the <strong>{parameterName}</strong> parameter to the flow execution.
              {parameterName === 'project_name' && ' This defines the main project directory.'}
              {parameterName === 'block_name' && ' This defines the block subdirectory.'}
              {parameterName === 'tool_used' && ' This selects the EDA tool for execution.'}
              {parameterName === 'stage_in_flow' && ' This determines which flow stages to execute.'}
            </>
          ) : (
            'Select a parameter type to see more information.'
          )}
        </p>
      </div>
    </form>
  );
};
