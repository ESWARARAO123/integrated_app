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

    // Truncate long stage names for display
    const truncateText = (text: string, maxLength: number = 12) => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    };

    const displayStageName = truncateText(stageName);
    const displayToolName = truncateText(toolName, 10);

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
                fontSize: '20px',
                fontWeight: '800',
                lineHeight: '1.1',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '150px',
              }}
              title={stageName} // Show full stage name on hover
            >
              {displayStageName}
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
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: '600',
            }}>
              Tool:
            </span>
            <span
              style={{
                color: 'var(--color-text)',
                fontSize: '16px',
                fontWeight: '700',
                padding: '6px 12px',
                backgroundColor: 'var(--color-surface-dark)',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '120px',
              }}
              title={toolName} // Show full tool name on hover
            >
              {displayToolName}
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
