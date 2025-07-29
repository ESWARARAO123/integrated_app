import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Download, FolderOpen, FileText, Terminal, CheckCircle2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import { NodeData } from '../types/flow';

export const OutputNode: React.FC<NodeProps> = (props) => {
  const { data } = props;
  const nodeData = data as NodeData;
  
  const getOutputIcon = () => {
    switch (nodeData.outputType) {
      case 'directory':
        return <FolderOpen size={16} />;
      case 'file':
        return <FileText size={16} />;
      case 'logs':
        return <Terminal size={16} />;
      default:
        return <Download size={16} />;
    }
  };

  const getOutputDisplay = () => {
    const outputType = nodeData.outputType || 'directory';
    const outputPath = nodeData.outputPath || 'Generated output';
    const expectedFiles = nodeData.expectedFiles || [];
    
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
              {outputType.toUpperCase()}
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
              Path:
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
              {outputPath}
            </span>
          </div>
          
          {expectedFiles.length > 0 && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              marginTop: '4px',
            }}>
              <span style={{
                color: 'var(--color-text-secondary)',
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Expected Files:
              </span>
              {expectedFiles.slice(0, 2).map((file, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--color-text-muted)',
                    fontSize: '10px',
                  }}
                >
                  <CheckCircle2 size={8} style={{ color: 'var(--color-success)' }} />
                  {file}
                </div>
              ))}
              {expectedFiles.length > 2 && (
                <span style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '9px',
                  fontStyle: 'italic',
                  marginLeft: '12px',
                }}>
                  +{expectedFiles.length - 2} more
                </span>
              )}
            </div>
          )}
          
          {nodeData.status === 'success' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 6px',
              backgroundColor: 'var(--color-success)',
              color: 'white',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: '500',
              marginTop: '4px',
            }}>
              <CheckCircle2 size={10} />
              Generated
            </div>
          )}
        </div>
      </div>
    );
  };

  // Set a proper description for the node
  const getOutputDescription = () => {
    switch (nodeData.outputType) {
      case 'directory':
        return 'Generated directory structure';
      case 'file':
        return 'Generated files and scripts';
      case 'logs':
        return 'Execution logs and reports';
      default:
        return 'Generated output';
    }
  };

  const nodeDataWithDescription = {
    ...nodeData,
    description: nodeData.description || getOutputDescription(),
  };

  return (
    <BaseNode
      {...props}
      data={nodeDataWithDescription}
      className="output-node"
      icon={getOutputIcon()}
      accentColor="var(--color-success)"
    >
      {getOutputDisplay()}
      
      <Handle
        type="target"
        position={Position.Left}
        style={{
          backgroundColor: 'var(--color-success)',
          border: '2px solid var(--color-surface)',
          width: '12px',
          height: '12px',
        }}
      />
      
      <Handle
        type="source"
        position={Position.Right}
        style={{
          backgroundColor: 'var(--color-success)',
          border: '2px solid var(--color-surface)',
          width: '12px',
          height: '12px',
        }}
      />
    </BaseNode>
  );
};
