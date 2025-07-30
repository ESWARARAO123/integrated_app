import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { FileInput, Settings, Database, Wrench } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { NodeData } from '../types/flow';

export const InputNode: React.FC<NodeProps> = (props) => {
  const { data } = props;
  const nodeData = data as NodeData;
  
  const getInputIcon = () => {
    switch (nodeData.parameterName) {
      case 'project_name':
      case 'block_name':
        return <Database size={16} />;
      case 'tool_used':
        return <Wrench size={16} />;
      case 'stage_in_flow':
        return <Settings size={16} />;
      default:
        return <FileInput size={16} />;
    }
  };

  const getParameterDescription = () => {
    switch (nodeData.parameterName) {
      case 'project_name':
        return 'Defines the project directory';
      case 'block_name':
        return 'Specifies the block name';
      case 'tool_used':
        return 'Selects EDA tool';
      case 'stage_in_flow':
        return 'Sets flow stage';
      case 'run_name':
        return 'Execution run identifier';
      default:
        return 'Input parameter';
    }
  };

  const getParameterDisplay = () => {
    const parameterName = nodeData.parameterName || 'Parameter';
    const value = nodeData.value || 'Not set';
    
    // If we have a value, show a simplified display
    if (nodeData.value && nodeData.value !== 'Not set') {
      // Truncate long values for display
      const truncateText = (text: string, maxLength: number = 15) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
      };

      const displayValue = truncateText(value);

      return (
        <div style={{ marginTop: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 20px',
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '22px',
              textAlign: 'center',
              lineHeight: '1.1',
              minHeight: '50px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px',
            }}
            title={value} // Show full value on hover
          >
            {displayValue}
          </div>
        </div>
      );
    }
    
    // Default display when no value is set
    return (
      <div style={{ marginTop: '8px' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span
              style={{
                color: 'var(--color-text)',
                fontSize: '15px',
                fontWeight: '700',
                lineHeight: '1.2',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '160px',
              }}
              title={parameterName.replace(/_/g, ' ').toUpperCase()} // Show full parameter name on hover
            >
              {parameterName.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{
              color: 'var(--color-text-secondary)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Value:
            </span>
            <span style={{
              color: 'var(--color-text)',
              fontSize: '12px',
              fontWeight: '500',
              padding: '2px 6px',
              backgroundColor: 'var(--color-surface-dark)',
              borderRadius: '3px',
              border: '1px solid var(--color-border)',
            }}>
              {value}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Set a proper description for the node - use value as label if available
  const getDisplayLabel = () => {
    if (nodeData.value && nodeData.value !== 'Not set') {
      return nodeData.value;
    }
    return nodeData.label || 'Input Node';
  };

  const nodeDataWithDescription = {
    ...nodeData,
    label: getDisplayLabel(),
    description: nodeData.description || getParameterDescription(),
  };

  return (
    <BaseNode
      {...props}
      data={nodeDataWithDescription}
      className="input-node"
      icon={getInputIcon()}
      accentColor="var(--color-primary)"
    >
      {getParameterDisplay()}
      
      <Handle
        type="target"
        position={Position.Left}
        style={{
          backgroundColor: 'var(--color-primary)',
          border: '2px solid var(--color-surface)',
          width: '12px',
          height: '12px',
        }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        style={{
          backgroundColor: 'var(--color-primary)',
          border: '2px solid var(--color-surface)',
          width: '12px',
          height: '12px',
        }}
      />
    </BaseNode>
  );
};
