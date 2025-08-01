import React, { useCallback, useRef, DragEvent } from 'react';
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
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  ReactFlowInstance,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useFlowEditor } from '../FlowEditorProvider';
import { useTheme } from '../../../contexts/ThemeContext';
import { nodeTypes } from '../blocks/index';
import { FlowNode, FlowEdge } from '../types/flow';

export const FlowCanvas: React.FC = () => {
  const {
    nodes,
    edges,
    selectNode,
    addNode,
    addEdge: addFlowEdge,
    updateNodePosition,
  } = useFlowEditor();

  const { currentTheme } = useTheme();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Store React Flow instance globally for viewport access
  const onInit = useCallback((reactFlowInstance: ReactFlowInstance) => {
    (window as any).reactFlowInstance = reactFlowInstance;
  }, []);

  // Custom nodes change handler to sync changes back to global state
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    // Apply changes to local React Flow state
    onNodesChange(changes as any);

    // Sync changes back to global flow editor state
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        // Only update when dragging is complete (not during drag)
        console.log(`🔄 Node position changed: ${change.id} to (${change.position.x}, ${change.position.y})`);
        updateNodePosition(change.id, change.position);
      } else if (change.type === 'remove') {
        // Handle node deletion from React Flow (e.g., Delete key press)
        console.log(`🗑️ Node removed via React Flow: ${change.id}`);
        // Don't call deleteNode here as it would cause a loop
        // The deletion is already applied to React Flow state by onNodesChange
      }
    });
  }, [onNodesChange, updateNodePosition]);

  // Custom edges change handler to sync changes back to global state
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    // Apply changes to local React Flow state
    onEdgesChange(changes as any);

    // Sync edge deletions back to global flow editor state
    changes.forEach((change) => {
      if (change.type === 'remove') {
        console.log(`🗑️ Edge removed via React Flow: ${change.id}`);
        // Don't call deleteEdge here as it would cause a loop
        // The deletion is already applied to React Flow state by onEdgesChange
      }
    });
  }, [onEdgesChange]);

  // Sync with flow editor state
  React.useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

  React.useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        const newEdge: FlowEdge = {
          id: `edge-${params.source}-${params.target}`,
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle || undefined,
          targetHandle: params.targetHandle || undefined,
          animated: true,
        };
        addFlowEdge(newEdge);
      }
    },
    [addFlowEdge]
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const templateData = event.dataTransfer.getData('application/reactflow');

      if (typeof templateData === 'undefined' || !templateData || !reactFlowBounds) {
        return;
      }

      try {
        const template = JSON.parse(templateData);
        const position = {
          x: event.clientX - reactFlowBounds.left - 100, // Center the node
          y: event.clientY - reactFlowBounds.top - 40,
        };

        addNode(template, position);
      } catch (error) {
        console.error('Failed to parse template data:', error);
      }
    },
    [addNode]
  );

  const getNodeColor = (node: Node) => {
    switch (node.type) {
      case 'input':
        return 'var(--color-primary)';
      default:
        return 'var(--color-text-muted)';
    }
  };

  const getBackgroundColor = () => {
    switch (currentTheme) {
      case 'light':
        return '#e5e7eb';
      case 'midnight':
        return '#252552';
      default:
        return '#2f374f';
    }
  };

  return (
    <div className="flow-canvas" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={onInit}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Strict}
        snapToGrid
        snapGrid={[15, 15]}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode="Delete"
        attributionPosition="bottom-left"
      >
        <Background
          color={getBackgroundColor()}
          gap={20}
          size={1}
          style={{ backgroundColor: 'var(--color-bg)' }}
        />
        
        <Controls
          className="flow-controls"
          showZoom={true}
          showFitView={true}
          showInteractive={true}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
          }}
        />
        
        <MiniMap
          className="flow-minimap"
          nodeColor={getNodeColor}
          maskColor="var(--color-primary-translucent)"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>
    </div>
  );
};
