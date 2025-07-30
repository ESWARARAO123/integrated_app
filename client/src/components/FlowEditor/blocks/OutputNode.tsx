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

    // Truncate long text for display
    const truncateText = (text: string, maxLength: number = 12) => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    };

    const displayOutputType = truncateText(outputType);
    const displayOutputPath = truncateText(outputPath, 15);

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
              title={outputType} // Show full output type on hover
            >
              {displayOutputType.toUpperCase()}
            </span>
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
              Path:
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '140px',
              }}
              title={outputPath} // Show full output path on hover
            >
              {displayOutputPath}
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
