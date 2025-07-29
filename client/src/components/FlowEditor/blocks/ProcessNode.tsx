import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Cpu, Play, CheckCircle, XCircle, Loader, Zap, Layers, TestTube } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { NodeData } from '../types/flow';

export const ProcessNode: React.FC<NodeProps> = (props) => {
  const { data } = props;
  const nodeData = data as NodeData;
  
  const getStatusIcon = () => {
    switch (nodeData.status) {
      case 'running':
        return <Loader size={12} className="animate-spin" style={{ color: 'var(--color-warning)' }} />;
      case 'success':
        return <CheckCircle size={12} style={{ color: 'var(--color-success)' }} />;
      case 'error':
        return <XCircle size={12} style={{ color: 'var(--color-error)' }} />;
      default:
        return <Play size={12} style={{ color: 'var(--color-text-muted)' }} />;
    }
  };

  const getStageIcon = () => {
    switch (nodeData.stage) {
      case 'SYNTH':
      case 'Synthesis':
        return <Zap size={16} />;
      case 'PD':
        return <Layers size={16} />;
      case 'LEC':
      case 'STA':
        return <TestTube size={16} />;
      default:
        return <Cpu size={16} />;
    }
  };

  const getStageDisplay = () => {
    const stageName = nodeData.stage || 'Unknown';
    const toolName = nodeData.tool || 'cadence';
    
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
            <span style={{
              color: 'var(--color-text)',
              fontSize: '13px',
              fontWeight: '600',
            }}>
              {stageName}
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {getStatusIcon()}
            </div>
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
              Tool:
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
              {toolName}
            </span>
          </div>
          
          {nodeData.status === 'running' && (
            <div style={{
              width: '100%',
              height: '2px',
              backgroundColor: 'var(--color-surface-dark)',
              borderRadius: '1px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: '30%',
                height: '100%',
                backgroundColor: 'var(--color-warning)',
                borderRadius: '1px',
                animation: 'progress 2s ease-in-out infinite',
              }} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <BaseNode
      {...props}
      data={nodeData}
      className="process-node"
      icon={getStageIcon()}
      accentColor="var(--color-secondary)"
    >
      {getStageDisplay()}
      
      <Handle
        type="target"
        position={Position.Left}
        style={{
          backgroundColor: 'var(--color-secondary)',
          border: '2px solid var(--color-surface)',
          width: '12px',
          height: '12px',
        }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        style={{
          backgroundColor: 'var(--color-secondary)',
          border: '2px solid var(--color-surface)',
          width: '12px',
          height: '12px',
        }}
      />
    </BaseNode>
  );
};
