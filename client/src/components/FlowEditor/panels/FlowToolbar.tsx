import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Save, 
  FolderOpen, 
  Trash2, 
  Settings, 
  Download,
  Upload,
  Loader,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Edit3
} from 'lucide-react';
import { useFlowEditor } from '../FlowEditorProvider';

export const FlowToolbar: React.FC = () => {
  const {
    nodes,
    edges,
    isExecuting,
    executionLogs,
    saveFlow,
    getUserFlows,
    loadFlow,
    deleteFlow,
    executeFlow,
    clearFlow,
  } = useFlowEditor();

  const [showLogs, setShowLogs] = useState(false);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showFlowList, setShowFlowList] = useState(false);
  const [userFlows, setUserFlows] = useState<any[]>([]);

  // Listen for auto-loaded flows
  useEffect(() => {
    const handleFlowLoaded = (event: any) => {
      const { id, name } = event.detail;
      setCurrentFlowId(id);
      setFlowName(name);
      console.log('Auto-loaded flow:', { id, name });
    };

    window.addEventListener('flowLoaded', handleFlowLoaded);
    return () => window.removeEventListener('flowLoaded', handleFlowLoaded);
  }, []);

  const handleSaveFlow = async (saveAs = false) => {
    if (!hasNodes) return;
    
    try {
      setIsSaving(true);
      
      let finalFlowName = flowName;
      let flowIdToUse = currentFlowId;
      
      // If "Save As" or if it's a generic name, create a new flow
      if (saveAs || flowName === 'Untitled Flow' || flowName === 'Auto-saved Flow') {
        // Generate a unique name with timestamp for new flows
        const timestamp = new Date().toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
        finalFlowName = saveAs ? `${flowName} (Copy ${timestamp})` : `Flow ${timestamp}`;
        flowIdToUse = undefined; // Force creation of new flow
        console.log('🆕 Creating new flow with name:', finalFlowName);
      }
      
      console.log('💾 Saving flow:', finalFlowName, 'with ID:', flowIdToUse);
      
      const result = await saveFlow(finalFlowName, flowIdToUse);
      console.log('✅ Save result:', result);
      
      if (result?.id) {
        setCurrentFlowId(result.id);
        setFlowName(finalFlowName); // Update the displayed name
        console.log('🆔 Updated current flow ID to:', result.id);
        console.log('📝 Updated flow name to:', finalFlowName);
        
        // Refresh the flow list to show the newly saved flow
        console.log('🔄 Refreshing flow list after save...');
        const flows = await getUserFlows();
        console.log('📊 Flows after save:', flows);
        console.log('📊 Number of flows after save:', flows.length);
        setUserFlows(flows);
        console.log('✅ Flow list updated in state');
      }
      // Show success feedback
      console.log('✅ Flow saved successfully:', result);
    } catch (error) {
      console.error('❌ Failed to save flow:', error);
      // Show error feedback
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsFlow = () => handleSaveFlow(true);

  const handleLoadFlows = async () => {
    try {
      console.log('🔄 Opening flow dropdown, fetching flows...');
      // Always refresh the flow list when opening the dropdown
      const flows = await getUserFlows();
      console.log('📊 Received flows from API:', flows);
      console.log('📊 Number of flows:', flows.length);
      console.log('📊 Current userFlows state before update:', userFlows);
      
      setUserFlows(flows);
      setShowFlowList(!showFlowList);
      
      console.log('📊 Updated userFlows state:', flows);
      console.log('📊 Dropdown should now show:', flows.length, 'flows');
    } catch (error) {
      console.error('❌ Failed to load flows:', error);
    }
  };

  const handleLoadFlow = async (flowId: string) => {
    try {
      const flowData = await loadFlow(flowId);
      setCurrentFlowId(flowId);
      setFlowName(flowData.name || 'Untitled Flow');
      setShowFlowList(false);
    } catch (error) {
      console.error('Failed to load flow:', error);
    }
  };

  const handleDeleteFlow = async (flowId: string, flowName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the load action
    
    if (window.confirm(`Are you sure you want to delete "${flowName}"? This action cannot be undone.`)) {
      try {
        await deleteFlow(flowId);
        
        // If we deleted the current flow, clear the editor
        if (currentFlowId === flowId) {
          clearFlow();
          setCurrentFlowId(null);
          setFlowName('Untitled Flow');
        }
        
        // Refresh the flow list
        const flows = await getUserFlows();
        setUserFlows(flows);
      } catch (error) {
        console.error('Failed to delete flow:', error);
      }
    }
  };

  const handleExecuteFlow = async () => {
    try {
      await executeFlow();
    } catch (error) {
      console.error('Failed to execute flow:', error);
    }
  };

  const handleClearFlow = () => {
    if (window.confirm('Are you sure you want to clear the entire flow? This action cannot be undone.')) {
      clearFlow();
      setFlowName('Untitled Flow');
      setCurrentFlowId(null);
      return true;
    }
    return false;
  };

  const handleNameEdit = () => {
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    setIsEditingName(false);
  };

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    }
    if (e.key === 'Escape') {
      setIsEditingName(false);
    }
  };

  const getExecutionStatus = () => {
    if (isExecuting) {
      return { icon: <Loader size={14} className="animate-spin" />, text: 'Executing...', color: 'var(--color-warning)' };
    }
    
    if (nodes.some(node => node.data.status === 'success')) {
      return { icon: <CheckCircle size={14} />, text: 'Completed', color: 'var(--color-success)' };
    }
    
    if (nodes.some(node => node.data.status === 'error')) {
      return { icon: <XCircle size={14} />, text: 'Failed', color: 'var(--color-error)' };
    }
    
    return { icon: null, text: 'Ready', color: 'var(--color-text-secondary)' };
  };

  const status = getExecutionStatus();
  const hasNodes = nodes.length > 0;
  const canExecute = hasNodes && !isExecuting;

  return (
    <div className="flow-toolbar">
      <div className="toolbar-section">
        {isEditingName ? (
          <input
            type="text"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleNameKeyPress}
            autoFocus
            style={{
              background: 'var(--color-surface-dark)',
              border: '1px solid var(--color-primary)',
              color: 'var(--color-text)',
              fontSize: '16px',
              fontWeight: '600',
              padding: '4px 8px',
              borderRadius: '4px',
              minWidth: '200px',
            }}
          />
        ) : (
          <div
            onClick={handleNameEdit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-dark)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{
              color: 'var(--color-text)',
              fontSize: '16px',
              fontWeight: '600',
              minWidth: '200px',
            }}>
              {flowName}
            </span>
            <Edit3 size={14} style={{ color: 'var(--color-text-secondary)' }} />
          </div>
        )}
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: status.color,
          fontSize: '12px',
          fontWeight: '500',
        }}>
          {status.icon}
          {status.text}
        </div>
      </div>

      <div className="toolbar-section">
        <button
          className="toolbar-button"
          onClick={() => {
            clearFlow();
            setFlowName('Untitled Flow');
            setCurrentFlowId(null);
          }}
          title="New Flow"
        >
          <FolderOpen size={14} />
          New
        </button>

        <button
          className={`toolbar-button ${isSaving ? 'disabled' : ''}`}
          onClick={() => handleSaveFlow()}
          disabled={!hasNodes || isSaving}
          title="Save Flow"
        >
          {isSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className="toolbar-button"
            onClick={handleLoadFlows}
            title="Load Flow"
          >
            <Upload size={14} />
            Load
          </button>

          {showFlowList && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              minWidth: '280px',
              maxWidth: '400px',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              zIndex: 1000,
              marginTop: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border)',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--color-text)',
                backgroundColor: 'var(--color-surface-dark)',
              }}>
                Your Flows ({userFlows.length})
              </div>
              {userFlows.length === 0 ? (
                <div style={{
                  padding: '20px',
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
                  textAlign: 'center',
                }}>
                  No saved flows yet
                </div>
              ) : (
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'var(--color-border) var(--color-surface)',
                }}>
                  <style>
                    {`
                      .flow-list-container::-webkit-scrollbar {
                        width: 6px;
                      }
                      .flow-list-container::-webkit-scrollbar-track {
                        background: var(--color-surface);
                      }
                      .flow-list-container::-webkit-scrollbar-thumb {
                        background: var(--color-border);
                        border-radius: 3px;
                      }
                      .flow-list-container::-webkit-scrollbar-thumb:hover {
                        background: var(--color-text-secondary);
                      }
                    `}
                  </style>
                  <div className="flow-list-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {userFlows.map((flow, index) => (
                      <div
                        key={flow.id}
                        onClick={() => handleLoadFlow(flow.id)}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          borderBottom: index < userFlows.length - 1 ? '1px solid var(--color-border)' : 'none',
                          fontSize: '12px',
                          color: 'var(--color-text)',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: currentFlowId === flow.id ? 'var(--color-primary-alpha)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (currentFlowId !== flow.id) {
                            e.currentTarget.style.background = 'var(--color-surface-light)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentFlowId !== flow.id) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontWeight: currentFlowId === flow.id ? '600' : '500',
                            color: currentFlowId === flow.id ? 'var(--color-primary)' : 'var(--color-text)',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {flow.name}
                          </div>
                          <div style={{ 
                            fontSize: '10px', 
                            color: 'var(--color-text-secondary)',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                          }}>
                            <span>{new Date(flow.updated_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>{flow.node_count || 0} nodes</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteFlow(flow.id, flow.name, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            marginLeft: '8px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--color-error-alpha)';
                            e.currentTarget.style.color = 'var(--color-error)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.color = 'var(--color-text-secondary)';
                          }}
                          title={`Delete "${flow.name}"`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{
          width: '1px',
          height: '24px',
          backgroundColor: 'var(--color-border)',
          margin: '0 8px',
        }} />

        <button
          className="toolbar-button"
          onClick={() => {/* Handle export */}}
          disabled={!hasNodes}
          title="Export Flow"
        >
          <Download size={14} />
          Export
        </button>

        <button
          className="toolbar-button"
          onClick={() => {/* Handle settings */}}
          title="Flow Settings"
        >
          <Settings size={14} />
          Settings
        </button>
      </div>

      <div className="toolbar-section">
        {executionLogs.length > 0 && (
          <button
            className="toolbar-button"
            onClick={() => setShowLogs(!showLogs)}
            title={showLogs ? 'Hide Logs' : 'Show Logs'}
          >
            {showLogs ? <EyeOff size={14} /> : <Eye size={14} />}
            Logs ({executionLogs.length})
          </button>
        )}

        <button
          className="toolbar-button"
          onClick={() => {
            if (handleClearFlow()) {
              setCurrentFlowId(null);
            }
          }}
          disabled={!hasNodes}
          title="Clear Flow"
        >
          <Trash2 size={14} />
          Clear
        </button>

        <motion.button
          className={`toolbar-button primary ${!canExecute ? 'disabled' : ''}`}
          onClick={handleExecuteFlow}
          disabled={!canExecute}
          title="Execute Flow"
          whileHover={canExecute ? { scale: 1.05 } : {}}
          whileTap={canExecute ? { scale: 0.95 } : {}}
        >
          {isExecuting ? (
            <Loader size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          {isExecuting ? 'Executing...' : 'Run Flow'}
        </motion.button>
      </div>

      {/* Execution Logs Panel */}
      {showLogs && executionLogs.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderTop: 'none',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              color: 'var(--color-text)',
              fontSize: '14px',
              fontWeight: '600',
            }}>
              Execution Logs
            </span>
            <button
              onClick={() => setShowLogs(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              <XCircle size={16} />
            </button>
          </div>
          <div style={{ padding: '12px 20px' }}>
            {executionLogs.map((log, index) => (
              <div
                key={index}
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  marginBottom: '4px',
                  lineHeight: '1.4',
                }}
              >
                {log}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Click outside to close flow list */}
      {showFlowList && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          }}
          onClick={() => setShowFlowList(false)}
        />
      )}
    </div>
  );
};
