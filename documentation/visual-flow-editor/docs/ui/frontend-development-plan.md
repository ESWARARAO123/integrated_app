# Visual Flow Editor - Frontend Development Plan

## Development Strategy

### High-End Frontend Implementation
Create a professional-grade visual flow editor that matches modern workflow tools like n8n, while seamlessly integrating with the existing PinnacleAI application architecture.

## Phase 1: Foundation Setup

### 1.1 Project Structure Setup
```
client/src/components/FlowEditor/
├── index.tsx                     # Main entry point
├── FlowEditorProvider.tsx        # Context provider for flow state
├── canvas/                       # Canvas-related components
├── blocks/                       # Block/node components
├── panels/                       # Side panels and toolbars
├── forms/                        # Configuration forms
├── hooks/                        # Custom hooks
├── utils/                        # Utility functions
├── types/                        # TypeScript type definitions
└── styles/                       # Component-specific styles
```

### 1.2 Core Dependencies Installation
```bash
# React Flow for node-based UI
npm install @xyflow/react

# Additional UI libraries (if not already installed)
npm install framer-motion lucide-react

# Form handling
npm install react-hook-form @hookform/resolvers zod

# State management (if needed beyond existing)
npm install zustand
```

### 1.3 Type Definitions
```typescript
// types/flow.ts
export interface FlowNode {
  id: string;
  type: 'input' | 'process' | 'output';
  position: { x: number; y: number };
  data: NodeData;
}

export interface NodeData {
  label: string;
  icon?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  parameters: Record<string, any>;
  validation?: ValidationRule[];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
}

export interface FlowConfiguration {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  metadata: {
    created_at: string;
    updated_at: string;
    version: string;
  };
}
```

## Phase 2: Core Components Development

### 2.1 Main Flow Editor Component
```typescript
// FlowEditor/index.tsx
import React from 'react';
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import { FlowEditorProvider } from './FlowEditorProvider';
import { FlowCanvas } from './canvas/FlowCanvas';
import { NodePalette } from './panels/NodePalette';
import { PropertiesPanel } from './panels/PropertiesPanel';
import { FlowToolbar } from './panels/FlowToolbar';
import { useTheme } from '../../contexts/ThemeContext';

export const FlowEditor: React.FC = () => {
  const { currentTheme } = useTheme();

  return (
    <FlowEditorProvider>
      <div className="flow-editor-container" data-theme={currentTheme}>
        <FlowToolbar />
        <div className="flow-editor-main">
          <NodePalette />
          <FlowCanvas />
          <PropertiesPanel />
        </div>
      </div>
    </FlowEditorProvider>
  );
};
```

### 2.2 Flow Canvas Implementation
```typescript
// canvas/FlowCanvas.tsx
import React, { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode
} from '@xyflow/react';
import { useFlowEditor } from '../hooks/useFlowEditor';
import { nodeTypes } from '../blocks';
import { edgeTypes } from '../edges';

export const FlowCanvas: React.FC = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onNodeContextMenu,
    onPaneClick
  } = useFlowEditor();

  return (
    <div className="flow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Strict}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background 
          gap={20}
          size={1}
          style={{ backgroundColor: 'var(--color-bg)' }}
        />
        <Controls 
          className="flow-controls"
          showZoom={true}
          showFitView={true}
          showInteractive={true}
        />
        <MiniMap 
          className="flow-minimap"
          nodeColor={(node) => getNodeColor(node.type)}
          maskColor="var(--color-primary-translucent)"
        />
      </ReactFlow>
    </div>
  );
};
```

### 2.3 Block Components

#### Input Block
```typescript
// blocks/InputBlock.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { FileInput, Settings } from 'lucide-react';
import { BaseBlock } from './BaseBlock';

export const InputBlock: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <BaseBlock
      data={data}
      selected={selected}
      className="input-block"
      icon={<FileInput size={16} />}
      accentColor="var(--color-primary)"
    >
      <div className="block-content">
        <div className="parameter-display">
          <span className="parameter-label">{data.parameterName}</span>
          <span className="parameter-value">{data.value || 'Not set'}</span>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="block-handle"
        style={{ backgroundColor: 'var(--color-primary)' }}
      />
    </BaseBlock>
  );
};
```

#### Process Block
```typescript
// blocks/ProcessBlock.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Cpu, Play, CheckCircle, XCircle } from 'lucide-react';
import { BaseBlock } from './BaseBlock';

export const ProcessBlock: React.FC<NodeProps> = ({ data, selected }) => {
  const getStatusIcon = () => {
    switch (data.status) {
      case 'running': return <Play size={12} className="animate-pulse" />;
      case 'success': return <CheckCircle size={12} />;
      case 'error': return <XCircle size={12} />;
      default: return null;
    }
  };

  return (
    <BaseBlock
      data={data}
      selected={selected}
      className="process-block"
      icon={<Cpu size={16} />}
      accentColor="var(--color-secondary)"
    >
      <div className="block-content">
        <div className="process-info">
          <span className="process-stage">{data.stage}</span>
          <div className="status-indicator">
            {getStatusIcon()}
          </div>
        </div>
      </div>
      
      <Handle
        type="target"
        position={Position.Left}
        className="block-handle"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="block-handle"
      />
    </BaseBlock>
  );
};
```

## Phase 3: Advanced Features

### 3.1 Node Palette with Drag & Drop
```typescript
// panels/NodePalette.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { FileInput, Cpu, Download, Plus } from 'lucide-react';

const nodeTemplates = [
  {
    type: 'input',
    label: 'Input Parameter',
    icon: <FileInput size={20} />,
    description: 'Project, block, or configuration input'
  },
  {
    type: 'process',
    label: 'Process Stage',
    icon: <Cpu size={20} />,
    description: 'Synthesis, PD, LEC, or STA execution'
  },
  {
    type: 'output',
    label: 'Output Result',
    icon: <Download size={20} />,
    description: 'Generated files or execution results'
  }
];

export const NodePalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <motion.div 
      className="node-palette"
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="palette-header">
        <h3>Flow Blocks</h3>
      </div>
      
      <div className="palette-content">
        {nodeTemplates.map((template) => (
          <motion.div
            key={template.type}
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, template.type)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="palette-item-icon">
              {template.icon}
            </div>
            <div className="palette-item-content">
              <span className="palette-item-label">{template.label}</span>
              <span className="palette-item-description">{template.description}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
```

### 3.2 Properties Panel
```typescript
// panels/PropertiesPanel.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings } from 'lucide-react';
import { useFlowEditor } from '../hooks/useFlowEditor';
import { InputBlockForm } from '../forms/InputBlockForm';
import { ProcessBlockForm } from '../forms/ProcessBlockForm';

export const PropertiesPanel: React.FC = () => {
  const { selectedNode, updateNodeData, clearSelection } = useFlowEditor();

  const renderForm = () => {
    if (!selectedNode) return null;

    switch (selectedNode.type) {
      case 'input':
        return <InputBlockForm node={selectedNode} onUpdate={updateNodeData} />;
      case 'process':
        return <ProcessBlockForm node={selectedNode} onUpdate={updateNodeData} />;
      default:
        return <div>No configuration available</div>;
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
              <Settings size={16} />
              <span>Block Properties</span>
            </div>
            <button 
              className="panel-close"
              onClick={clearSelection}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="panel-content">
            {renderForm()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
```

## Phase 4: Integration Features

### 4.1 Flow Execution Integration
```typescript
// hooks/useFlowExecution.ts
import { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const useFlowExecution = () => {
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const { user } = useAuth();

  const executeFlow = useCallback(async (flowConfig: FlowConfiguration) => {
    try {
      setExecutionStatus('running');
      
      const response = await fetch(`/api/flows/${flowConfig.id}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          flowConfig,
          workspaceSettings: await getUserWorkspaceSettings()
        })
      });

      if (!response.ok) {
        throw new Error('Execution failed');
      }

      const result = await response.json();
      setExecutionStatus('completed');
      
      return result;
    } catch (error) {
      setExecutionStatus('failed');
      throw error;
    }
  }, [user]);

  return {
    executionStatus,
    executionLogs,
    executeFlow
  };
};
```

### 4.2 Workspace Settings Integration
```typescript
// hooks/useWorkspaceSettings.ts
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export const useWorkspaceSettings = () => {
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadWorkspaceSettings();
  }, [user]);

  const loadWorkspaceSettings = async () => {
    try {
      const response = await fetch('/api/workspace/settings', {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to load workspace settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<WorkspaceSettings>) => {
    try {
      const response = await fetch('/api/workspace/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(newSettings)
      });

      if (response.ok) {
        const updated = await response.json();
        setSettings(updated);
        return updated;
      }
    } catch (error) {
      console.error('Failed to update workspace settings:', error);
      throw error;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    reload: loadWorkspaceSettings
  };
};
```

## Development Timeline

### Week 1-2: Foundation
- [ ] Project structure setup
- [ ] Core component scaffolding
- [ ] Theme integration
- [ ] Basic canvas functionality

### Week 3-4: Block System
- [ ] Input/Process/Output block components
- [ ] Drag & drop functionality
- [ ] Block configuration forms
- [ ] Connection validation

### Week 5-6: Advanced UI
- [ ] Node palette with animations
- [ ] Properties panel
- [ ] Flow toolbar and controls
- [ ] Responsive design

### Week 7-8: Integration
- [ ] Backend API integration
- [ ] Workspace settings
- [ ] Flow persistence
- [ ] Execution status tracking

This plan provides a comprehensive roadmap for creating a high-end Visual Flow Editor that seamlessly integrates with the existing PinnacleAI application architecture.
