# Visual Flow Editor Implementation Guide

## Technology Stack

### Core Dependencies
```json
{
  "@xyflow/react": "^12.8.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "framer-motion": "^10.16.0",
  "lucide-react": "^0.263.1"
}
```

### Integration with Existing Application
The Visual Flow Editor integrates seamlessly with the existing PinnacleAI application:

- **Theme System**: Uses existing Dark/Light/Midnight themes via ThemeContext
- **Database**: Leverages existing PostgreSQL database with new flow tables
- **Authentication**: Uses existing user authentication and UUID-based user binding
- **MCP Integration**: Reuses existing MCP orchestrator pattern from chatbot
- **API Structure**: Follows existing API patterns and middleware

### React Flow Setup
```tsx
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  EdgeTypes
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

## Project Structure

```
src/
├── components/
│   ├── FlowEditor/
│   │   ├── index.tsx                 # Main flow editor component
│   │   ├── nodes/
│   │   │   ├── BaseNode.tsx         # Base node component
│   │   │   ├── InputNode.tsx        # Input node type
│   │   │   ├── ProcessNode.tsx      # Processing node type
│   │   │   ├── OutputNode.tsx       # Output node type
│   │   │   └── index.ts             # Node type exports
│   │   ├── edges/
│   │   │   ├── CustomEdge.tsx       # Custom edge component
│   │   │   └── index.ts             # Edge type exports
│   │   ├── controls/
│   │   │   ├── ContextMenu.tsx      # Right-click context menu
│   │   │   ├── NodeToolbar.tsx      # Node-specific toolbar
│   │   │   └── FlowControls.tsx     # Canvas controls
│   │   ├── hooks/
│   │   │   ├── useFlowState.ts      # Flow state management
│   │   │   ├── useNodeActions.ts    # Node action handlers
│   │   │   └── useThemeIntegration.ts # Theme integration
│   │   └── utils/
│   │       ├── nodeFactory.ts       # Node creation utilities
│   │       ├── validation.ts        # Connection validation
│   │       └── serialization.ts     # Flow save/load
│   └── ui/
│       ├── Icon.tsx                 # Icon component
│       ├── Button.tsx               # Button component
│       └── Dropdown.tsx             # Dropdown component
```

## Core Implementation

### Main Flow Editor Component
```tsx
import React, { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  Panel
} from '@xyflow/react';
import { useTheme } from '../../contexts/ThemeContext';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';
import { ContextMenu } from './controls/ContextMenu';
import { FlowControls } from './controls/FlowControls';

const FlowEditor: React.FC = () => {
  const { currentTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (params: Connection) => {
      if (isValidConnection(params)) {
        setEdges((eds) => addEdge(params, eds));
      }
    },
    [setEdges]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      
      const pane = reactFlowWrapper.current?.getBoundingClientRect();
      if (!pane) return;

      setContextMenu({
        id: node.id,
        x: event.clientX - pane.left,
        y: event.clientY - pane.top,
      });
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <div 
      ref={reactFlowWrapper}
      className="flow-editor"
      style={{ 
        width: '100%', 
        height: '100vh',
        backgroundColor: 'var(--color-bg)'
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
          color={currentTheme === 'light' ? '#e5e7eb' : '#374151'}
          gap={20}
          size={1}
        />
        <Controls 
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px'
          }}
        />
        <MiniMap 
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px'
          }}
          nodeColor={(node) => {
            switch (node.type) {
              case 'input': return 'var(--color-primary)';
              case 'process': return 'var(--color-secondary)';
              case 'output': return 'var(--color-success)';
              default: return 'var(--color-text-muted)';
            }
          }}
        />
        
        <Panel position="top-left">
          <FlowControls 
            onAddNode={(type) => addNode(type, setNodes)}
            onSaveFlow={() => saveFlow(nodes, edges)}
            onLoadFlow={(flow) => loadFlow(flow, setNodes, setEdges)}
          />
        </Panel>

        {contextMenu && (
          <ContextMenu
            nodeId={contextMenu.id}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={() => setContextMenu(null)}
            onAction={(action) => handleNodeAction(action, contextMenu.id)}
          />
        )}
      </ReactFlow>
    </div>
  );
};

export default FlowEditor;
```

### Node Type Definitions
```tsx
// nodes/index.ts
import { NodeTypes } from '@xyflow/react';
import { InputNode } from './InputNode';
import { ProcessNode } from './ProcessNode';
import { OutputNode } from './OutputNode';

export const nodeTypes: NodeTypes = {
  input: InputNode,
  process: ProcessNode,
  output: OutputNode,
};

export * from './InputNode';
export * from './ProcessNode';
export * from './OutputNode';
```

### Base Node Implementation
```tsx
// nodes/BaseNode.tsx
import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Icon } from '../../ui/Icon';

export interface BaseNodeData {
  label: string;
  icon?: string;
  status: 'idle' | 'running' | 'success' | 'error';
  description?: string;
}

export const BaseNode: React.FC<NodeProps<BaseNodeData>> = ({
  data,
  selected,
  dragging,
}) => {
  const getStatusColor = () => {
    switch (data.status) {
      case 'running': return 'var(--color-warning)';
      case 'success': return 'var(--color-success)';
      case 'error': return 'var(--color-error)';
      default: return 'var(--color-border)';
    }
  };

  return (
    <motion.div
      className="base-node"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.02 }}
      whileDrag={{ scale: 1.05, rotate: 2 }}
      style={{
        backgroundColor: 'var(--color-surface)',
        border: `2px solid ${selected ? 'var(--color-primary)' : getStatusColor()}`,
        borderRadius: '12px',
        padding: '16px',
        minWidth: '200px',
        boxShadow: dragging 
          ? '0 10px 25px rgba(0,0,0,0.3)' 
          : '0 4px 12px rgba(0,0,0,0.15)',
        position: 'relative'
      }}
    >
      <div className="node-header" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '8px'
      }}>
        {data.icon && (
          <Icon 
            name={data.icon} 
            size={16} 
            color="var(--color-primary)" 
          />
        )}
        <span style={{
          color: 'var(--color-text)',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {data.label}
        </span>
        <div
          className="status-indicator"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            marginLeft: 'auto',
            animation: data.status === 'running' ? 'pulse 2s infinite' : 'none'
          }}
        />
      </div>
      
      {data.description && (
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '12px',
          margin: 0,
          lineHeight: '1.4'
        }}>
          {data.description}
        </p>
      )}
    </motion.div>
  );
};
```

### Theme Integration Hook
```tsx
// hooks/useThemeIntegration.ts
import { useEffect } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';

export const useThemeIntegration = () => {
  const { currentTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    
    // Set flow-specific CSS variables based on current theme
    root.style.setProperty('--flow-bg', 'var(--color-bg)');
    root.style.setProperty('--flow-surface', 'var(--color-surface)');
    root.style.setProperty('--flow-border', 'var(--color-border)');
    root.style.setProperty('--flow-text', 'var(--color-text)');
    root.style.setProperty('--flow-primary', 'var(--color-primary)');
    
    // Update React Flow specific styles
    const reactFlowStyle = document.createElement('style');
    reactFlowStyle.textContent = `
      .react-flow {
        background-color: var(--flow-bg);
      }
      
      .react-flow__node {
        color: var(--flow-text);
      }
      
      .react-flow__edge-path {
        stroke: var(--flow-border);
      }
      
      .react-flow__edge.selected .react-flow__edge-path {
        stroke: var(--flow-primary);
      }
      
      .react-flow__controls {
        background: var(--flow-surface);
        border: 1px solid var(--flow-border);
      }
      
      .react-flow__controls button {
        background: var(--flow-surface);
        border: 1px solid var(--flow-border);
        color: var(--flow-text);
      }
      
      .react-flow__controls button:hover {
        background: var(--color-surface-light);
      }
    `;
    
    document.head.appendChild(reactFlowStyle);
    
    return () => {
      document.head.removeChild(reactFlowStyle);
    };
  }, [currentTheme]);

  return { currentTheme };
};
```

### State Management
```tsx
// hooks/useFlowState.ts
import { useCallback, useState } from 'react';
import { Node, Edge, addEdge, Connection } from '@xyflow/react';

export const useFlowState = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const addNode = useCallback((type: string, position: { x: number; y: number }) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        status: 'idle'
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => 
      edge.source !== nodeId && edge.target !== nodeId
    ));
  }, []);

  const updateNodeData = useCallback((nodeId: string, data: Partial<any>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      )
    );
  }, []);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
  }, []);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    addNode,
    removeNode,
    updateNodeData,
    onConnect
  };
};
```
