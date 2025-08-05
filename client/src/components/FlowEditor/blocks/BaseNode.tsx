import React, { useState } from 'react';
import { NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { NodeData } from '../types/flow';
import { ContextMenu } from '../components/ContextMenu';
import { FileEditorModal } from '../components/FileEditorModal';
import { constructConfigFilePath, findRecentExecution } from '../services/filePathResolver';
import { createPortal } from 'react-dom';

interface BaseNodeProps extends NodeProps {
  data: NodeData;
  className?: string;
  icon?: React.ReactNode;
  accentColor?: string;
  children?: React.ReactNode;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  data,
  selected,
  dragging,
  className = '',
  icon,
  accentColor,
  children,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
  }>({
    isVisible: false,
    position: { x: 0, y: 0 }
  });

  const [fileEditor, setFileEditor] = useState<{
    isOpen: boolean;
    filePath: string;
    mode: 'view' | 'edit';
  }>({
    isOpen: false,
    filePath: '',
    mode: 'view'
  });

  // Check if this block is a Run Flow Step (not a Stage block)
  const isRunFlowStepBlock = () => {
    // Run Flow Steps have parameterName starting with 'pd_step_'
    return data.parameterName?.startsWith('pd_step_');
  };

  // Handle right-click context menu
  const handleContextMenu = (event: React.MouseEvent) => {
    console.log(`🖱️ Right-click on block: "${data.label}"`);
    console.log(`📋 Block data:`, data);
    console.log(`🔍 Parameter name:`, data.parameterName);
    console.log(`🎯 Is Run Flow Step:`, isRunFlowStepBlock());
    console.log(`✅ Supports config editing:`, isRunFlowStepBlock());

    if (!isRunFlowStepBlock()) {
      console.log(`❌ Block "${data.label}" is not a Run Flow Step - no config editing`);
      return;
    }

    // Prevent the event from propagating to React Flow
    event.preventDefault();
    event.stopPropagation();

    // Get the node element's position relative to the viewport
    const nodeElement = event.currentTarget as HTMLElement;
    const nodeRect = nodeElement.getBoundingClientRect();
    
    // Position menu at the bottom-right corner of the node with small offset
    // Try right side first, but if too close to edge, try left side
    const viewportWidth = window.innerWidth;
    const estimatedMenuWidth = 220;
    
    let menuX = nodeRect.right + 8; // Right side with small gap
    let menuY = nodeRect.top;
    
    // If menu would go off-screen on right, position on left side
    if (menuX + estimatedMenuWidth > viewportWidth - 20) {
      menuX = nodeRect.left - estimatedMenuWidth - 8; // Left side with gap
    }
    
    // Ensure menu doesn't go off left edge either
    if (menuX < 10) {
      menuX = nodeRect.right + 8; // Fallback to right side
    }

    console.log(`🎯 Node position:`, { 
      left: nodeRect.left, 
      top: nodeRect.top, 
      right: nodeRect.right, 
      bottom: nodeRect.bottom 
    });
    console.log(`🎯 Menu will open at:`, { x: menuX, y: menuY });

    setContextMenu({
      isVisible: true,
      position: { x: menuX, y: menuY }
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isVisible: false }));
  };

  // Handle view config
  const handleViewConfig = async () => {
    console.log(`🔍 View config for ${data.label} block (${data.parameterName})`);

    try {
      const execution = await findRecentExecution();
      if (!execution) {
        alert('❌ No recent FlowDir execution found.\n\nPlease run FlowDir execution first to generate config files.');
        return;
      }
      
      const configPath = await constructConfigFilePath(execution, data.label);
      if (configPath) {
        console.log(`📁 Config file path: ${configPath}`);

        // Open file editor modal in view mode
        setFileEditor({
          isOpen: true,
          filePath: configPath,
          mode: 'view'
        });
      } else {
        alert('❌ Could not resolve config file path.\n\nMake sure you have run FlowDir execution first.');
      }
    } catch (error) {
      console.error('Error resolving config path:', error);
      alert('❌ Error resolving config file path. Check console for details.');
    }
  };

  // Handle edit config
  const handleEditConfig = async () => {
    console.log(`✏️ Edit config for ${data.label} block (${data.parameterName})`);

    try {
      const execution = await findRecentExecution();
      if (!execution) {
        alert('❌ No recent FlowDir execution found.\n\nPlease run FlowDir execution first to generate config files.');
        return;
      }
      
      const configPath = await constructConfigFilePath(execution, data.label);
      if (configPath) {
        console.log(`📁 Config file path: ${configPath}`);

        // Open file editor modal in edit mode
        setFileEditor({
          isOpen: true,
          filePath: configPath,
          mode: 'edit'
        });
      } else {
        alert('❌ Could not resolve config file path.\n\nMake sure you have run FlowDir execution first.');
      }
    } catch (error) {
      console.error('Error resolving config path:', error);
      alert('❌ Error resolving config file path. Check console for details.');
    }
  };

  // Close file editor modal
  const closeFileEditor = () => {
    setFileEditor({
      isOpen: false,
      filePath: '',
      mode: 'view'
    });
  };

  const getStatusColor = () => {
    switch (data.status) {
      case 'running':
        return 'var(--color-warning)';
      case 'success':
        return 'var(--color-success)';
      case 'error':
        return 'var(--color-error)';
      default:
        return 'var(--color-border)';
    }
  };

  const nodeClasses = [
    'flow-node',
    className,
    selected ? 'selected' : '',
    dragging ? 'dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <motion.div
        className={nodeClasses}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: selected ? 1.02 : 1.01 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onContextMenu={handleContextMenu}
      style={{
        backgroundColor: 'var(--color-surface)',
        border: `2px solid ${selected ? 'var(--color-primary)' : getStatusColor()}`,
        borderRadius: '12px',
        padding: '20px',
        minWidth: '240px',
        boxShadow: dragging
          ? '0 10px 25px rgba(0,0,0,0.3)'
          : selected
          ? '0 0 0 2px var(--color-primary-translucent)'
          : '0 4px 12px rgba(0,0,0,0.1)',
        position: 'relative',
        borderLeftColor: accentColor || 'var(--color-border)',
        borderLeftWidth: '4px',
        cursor: isRunFlowStepBlock() ? 'context-menu' : 'default',
      }}
    >
      <div className="node-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        {icon && (
          <div 
            className="node-icon"
            style={{ color: accentColor || 'var(--color-primary)' }}
          >
            {icon}
          </div>
        )}
        <span
          className="node-title"
          style={{
            color: 'var(--color-text)',
            fontSize: '20px',
            fontWeight: '700',
            flex: 1,
            lineHeight: '1.1',
            letterSpacing: '0.3px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '180px',
          }}
          title={data.label} // Show full text on hover
        >
          {data.label}
        </span>
        <div
          className={`status-indicator ${data.status}`}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            animation: data.status === 'running' ? 'pulse 2s infinite' : 'none',
          }}
        />
      </div>
      
      {data.description && (
        <div 
          className="node-content"
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: '12px',
            lineHeight: '1.4',
            margin: 0,
          }}
        >
          {data.description}
        </div>
      )}
      
      {children}
    </motion.div>

    {/* Context Menu - Rendered outside node using portal to prevent event propagation */}
    {contextMenu.isVisible && createPortal(
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        onClose={closeContextMenu}
        onViewConfig={handleViewConfig}
        onEditConfig={handleEditConfig}
        blockLabel={data.label}
      />,
      document.body
    )}

    {/* File Editor Modal */}
    <FileEditorModal
      isOpen={fileEditor.isOpen}
      onClose={closeFileEditor}
      filePath={fileEditor.filePath}
      blockLabel={data.label}
      mode={fileEditor.mode}
    />
  </>
  );
};
