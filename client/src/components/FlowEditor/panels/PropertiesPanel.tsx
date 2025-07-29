import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings, FileInput, Cpu, Download } from 'lucide-react';
import { useFlowEditor } from '../FlowEditorProvider';
import { InputBlockForm } from '../forms/InputBlockForm';
import { ProcessBlockForm } from '../forms/ProcessBlockForm';
import { OutputBlockForm } from '../forms/OutputBlockForm';

export const PropertiesPanel: React.FC = () => {
  const { selectedNode, selectNode, updateNode, deleteNode } = useFlowEditor();

  const getNodeIcon = () => {
    if (!selectedNode) return <Settings size={16} />;
    
    switch (selectedNode.type) {
      case 'input':
        return <FileInput size={16} />;
      case 'process':
        return <Cpu size={16} />;
      case 'output':
        return <Download size={16} />;
      default:
        return <Settings size={16} />;
    }
  };

  const getNodeTypeLabel = () => {
    if (!selectedNode) return 'Properties';
    
    switch (selectedNode.type) {
      case 'input':
        return 'Input Block';
      case 'process':
        return 'Process Block';
      case 'output':
        return 'Output Block';
      default:
        return 'Block Properties';
    }
  };

  const renderForm = () => {
    if (!selectedNode) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}>
          <Settings size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>No Block Selected</h3>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4' }}>
            Select a block on the canvas to view and edit its properties
          </p>
        </div>
      );
    }

    switch (selectedNode.type) {
      case 'input':
        return <InputBlockForm node={selectedNode} onUpdate={updateNode} />;
      case 'process':
        return <ProcessBlockForm node={selectedNode} onUpdate={updateNode} />;
      case 'output':
        return <OutputBlockForm node={selectedNode} onUpdate={updateNode} />;
      default:
        return (
          <div style={{
            color: 'var(--color-text-secondary)',
            textAlign: 'center',
            padding: '20px',
          }}>
            No configuration available for this block type
          </div>
        );
    }
  };

  const handleDeleteNode = () => {
    if (selectedNode && window.confirm('Are you sure you want to delete this block?')) {
      deleteNode(selectedNode.id);
      selectNode(null);
    }
  };

  return (
    <AnimatePresence>
      {selectedNode && (
        <motion.div
          className="properties-panel"
          initial={{ x: 400 }}
          animate={{ x: 0 }}
          exit={{ x: 400 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="panel-header">
            <div className="panel-title">
              {getNodeIcon()}
              <span>{getNodeTypeLabel()}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDeleteNode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-error)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-error)20';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Delete Block"
              >
                <X size={16} />
              </button>
              <button 
                className="panel-close"
                onClick={() => selectNode(null)}
                title="Close Panel"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          
          <div className="panel-content">
            {selectedNode && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: 'var(--color-surface-dark)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                  }}>
                    <span style={{
                      color: 'var(--color-text-secondary)',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Block ID
                    </span>
                  </div>
                  <span style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}>
                    {selectedNode.id}
                  </span>
                </div>
              </div>
            )}
            
            {renderForm()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
