import React, { useState, useEffect } from 'react';
import { FlowNode, NodeData } from '../types/flow';

interface OutputBlockFormProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void;
}

export const OutputBlockForm: React.FC<OutputBlockFormProps> = ({ node, onUpdate }) => {
  const [label, setLabel] = useState(node.data.label || '');
  const [outputType, setOutputType] = useState(node.data.outputType || 'directory');
  const [outputPath, setOutputPath] = useState(node.data.outputPath || '');
  const [expectedFiles, setExpectedFiles] = useState(
    (node.data.expectedFiles || []).join('\n')
  );
  const [description, setDescription] = useState(node.data.description || '');

  useEffect(() => {
    setLabel(node.data.label || '');
    setOutputType(node.data.outputType || 'directory');
    setOutputPath(node.data.outputPath || '');
    setExpectedFiles((node.data.expectedFiles || []).join('\n'));
    setDescription(node.data.description || '');
  }, [node]);

  const handleUpdate = (field: string, newValue: any) => {
    const updates = { [field]: newValue };
    
    // Auto-update label when output type changes
    if (field === 'outputType') {
      const typeLabels: Record<string, string> = {
        'directory': 'Directory Output',
        'file': 'File Output',
        'logs': 'Execution Logs',
      };
      updates.label = typeLabels[newValue] || newValue;
    }
    
    // Convert expectedFiles string to array
    if (field === 'expectedFiles') {
      updates.expectedFiles = newValue.split('\n').filter((file: string) => file.trim());
    }
    
    onUpdate(node.id, updates);
  };

  const outputTypeOptions = [
    { 
      value: 'directory', 
      label: 'Directory Structure', 
      description: 'Generated directory hierarchy',
      defaultPath: 'Generated directories',
      defaultFiles: ['Phase-0/', 'SYNTH/', 'PD/', 'LEC/', 'STA/']
    },
    { 
      value: 'file', 
      label: 'Generated Files', 
      description: 'Specific output files',
      defaultPath: 'Generated files',
      defaultFiles: ['complete_make.csh', 'config.tcl', 'run_script.sh']
    },
    { 
      value: 'logs', 
      label: 'Execution Logs', 
      description: 'Runtime logs and reports',
      defaultPath: 'Execution logs',
      defaultFiles: ['execution.log', 'error.log', 'summary.rpt']
    },
  ];

  const getOutputTypeInfo = () => {
    return outputTypeOptions.find(opt => opt.value === outputType) || outputTypeOptions[0];
  };

  const outputTypeInfo = getOutputTypeInfo();

  const handleOutputTypeChange = (newType: string) => {
    const validType = newType as 'directory' | 'file' | 'logs';
    setOutputType(validType);
    const typeInfo = outputTypeOptions.find(opt => opt.value === newType);
    if (typeInfo) {
      setOutputPath(typeInfo.defaultPath);
      setExpectedFiles(typeInfo.defaultFiles.join('\n'));
      handleUpdate('outputType', validType);
      handleUpdate('outputPath', typeInfo.defaultPath);
      handleUpdate('expectedFiles', typeInfo.defaultFiles);
    }
  };

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
        <label style={labelStyle}>Output Type</label>
        <select
          value={outputType}
          onChange={(e) => handleOutputTypeChange(e.target.value)}
          style={inputStyle}
        >
          {outputTypeOptions.map((option) => (
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
          {outputTypeInfo.description}
        </span>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Output Path/Description</label>
        <input
          type="text"
          value={outputPath}
          onChange={(e) => {
            setOutputPath(e.target.value);
            handleUpdate('outputPath', e.target.value);
          }}
          style={inputStyle}
          placeholder="Enter output path or description"
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Expected Files/Directories</label>
        <textarea
          value={expectedFiles}
          onChange={(e) => {
            setExpectedFiles(e.target.value);
            handleUpdate('expectedFiles', e.target.value);
          }}
          style={textareaStyle}
          placeholder="Enter expected files or directories (one per line)"
        />
        <span style={{
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          List the files or directories that will be generated (one per line)
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
          Output Information
        </h4>
        <p style={{
          margin: '0 0 12px 0',
          color: 'var(--color-text-secondary)',
          fontSize: '11px',
          lineHeight: '1.4',
        }}>
          This output block will capture and display the results from the connected process blocks.
        </p>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div>
            <span style={{
              color: 'var(--color-text)',
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Output Type: {outputTypeInfo.label}
            </span>
          </div>
          
          {expectedFiles.trim() && (
            <div>
              <span style={{
                color: 'var(--color-text)',
                fontSize: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'block',
                marginBottom: '4px',
              }}>
                Expected Items ({expectedFiles.split('\n').filter(f => f.trim()).length})
              </span>
              <div style={{
                maxHeight: '80px',
                overflowY: 'auto',
                padding: '4px 0',
              }}>
                {expectedFiles.split('\n').filter(f => f.trim()).map((file, index) => (
                  <div
                    key={index}
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontSize: '10px',
                      lineHeight: '1.3',
                      padding: '1px 0',
                    }}
                  >
                    • {file.trim()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};
