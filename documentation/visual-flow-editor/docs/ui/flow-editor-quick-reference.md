# Visual Flow Editor - Quick Reference

## Getting Started

### Installation
```bash
npm install @xyflow/react framer-motion lucide-react
```

### Basic Setup
```tsx
import { FlowEditor } from './components/FlowEditor';

function App() {
  return (
    <div className="app">
      <FlowEditor />
    </div>
  );
}
```

## Theme Integration

### Using Theme Context
```tsx
import { useTheme } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { currentTheme, setTheme } = useTheme();
  
  return (
    <div style={{ backgroundColor: 'var(--color-surface)' }}>
      Current theme: {currentTheme}
    </div>
  );
};
```

### CSS Variables Reference
```css
/* Background Colors */
--color-bg              /* Main background */
--color-surface         /* Card/panel background */
--color-surface-light   /* Hover states */
--color-surface-dark    /* Input backgrounds */

/* Text Colors */
--color-text            /* Primary text */
--color-text-secondary  /* Secondary text */
--color-text-muted      /* Disabled/muted text */

/* Brand Colors */
--color-primary         /* Primary actions */
--color-secondary       /* Secondary actions */
--color-success         /* Success states */
--color-warning         /* Warning states */
--color-error           /* Error states */

/* Border Colors */
--color-border          /* Default borders */
--color-border-light    /* Light borders */
```

## Node Creation

### Basic Node
```tsx
const CustomNode = ({ data, selected }) => (
  <div 
    className="custom-node"
    style={{
      backgroundColor: 'var(--color-surface)',
      border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: '12px',
      padding: '16px'
    }}
  >
    <div className="node-header">
      <Icon name={data.icon} />
      <span>{data.label}</span>
    </div>
    <Handle type="target" position={Position.Left} />
    <Handle type="source" position={Position.Right} />
  </div>
);
```

### Node with Status
```tsx
const StatusNode = ({ data }) => {
  const getStatusColor = () => {
    switch (data.status) {
      case 'running': return 'var(--color-warning)';
      case 'success': return 'var(--color-success)';
      case 'error': return 'var(--color-error)';
      default: return 'var(--color-border)';
    }
  };

  return (
    <div className="status-node">
      <div 
        className="status-indicator"
        style={{ backgroundColor: getStatusColor() }}
      />
      {/* Node content */}
    </div>
  );
};
```

## Interactions

### Context Menu
```tsx
const onNodeContextMenu = useCallback((event, node) => {
  event.preventDefault();
  
  setContextMenu({
    nodeId: node.id,
    x: event.clientX,
    y: event.clientY,
    actions: [
      { label: 'Edit', icon: 'edit', handler: editNode },
      { label: 'Delete', icon: 'trash', handler: deleteNode },
      { label: 'Duplicate', icon: 'copy', handler: duplicateNode }
    ]
  });
}, []);
```

### Left-Click Dropdown
```tsx
const onNodeClick = useCallback((event, node) => {
  const rect = event.currentTarget.getBoundingClientRect();
  
  setDropdown({
    nodeId: node.id,
    x: rect.right + 10,
    y: rect.top,
    visible: true
  });
}, []);
```

## Connection Validation

### Basic Validation
```tsx
const isValidConnection = useCallback((connection) => {
  // Prevent self-connections
  if (connection.source === connection.target) {
    return false;
  }
  
  // Check data type compatibility
  const sourceNode = getNode(connection.source);
  const targetNode = getNode(connection.target);
  
  return isCompatibleType(
    sourceNode?.data.outputType,
    targetNode?.data.inputType
  );
}, [getNode]);
```

### Advanced Validation
```tsx
const validateConnection = (connection) => {
  // Cycle detection
  if (wouldCreateCycle(connection)) {
    showError('Connection would create a cycle');
    return false;
  }
  
  // Connection limits
  if (exceedsConnectionLimit(connection)) {
    showError('Maximum connections exceeded');
    return false;
  }
  
  return true;
};
```

## Styling Patterns

### Theme-Aware Components
```tsx
const ThemedButton = ({ children, variant = 'primary' }) => (
  <button
    style={{
      backgroundColor: `var(--color-${variant})`,
      color: variant === 'primary' ? 'white' : 'var(--color-text)',
      border: `1px solid var(--color-${variant})`,
      borderRadius: '6px',
      padding: '8px 16px'
    }}
  >
    {children}
  </button>
);
```

### Responsive Nodes
```css
.responsive-node {
  min-width: 200px;
  padding: 16px;
}

@media (max-width: 768px) {
  .responsive-node {
    min-width: 160px;
    padding: 12px;
  }
}
```

## Common Patterns

### Node Factory
```tsx
const createNode = (type, position, data = {}) => ({
  id: `${type}-${Date.now()}`,
  type,
  position,
  data: {
    label: `${type} Node`,
    status: 'idle',
    ...data
  }
});
```

### State Updates
```tsx
const updateNodeStatus = useCallback((nodeId, status) => {
  setNodes(nodes => 
    nodes.map(node => 
      node.id === nodeId 
        ? { ...node, data: { ...node.data, status } }
        : node
    )
  );
}, [setNodes]);
```

### Event Handlers
```tsx
const useNodeActions = () => {
  const editNode = useCallback((nodeId) => {
    // Open edit dialog
  }, []);
  
  const deleteNode = useCallback((nodeId) => {
    setNodes(nodes => nodes.filter(n => n.id !== nodeId));
    setEdges(edges => edges.filter(e => 
      e.source !== nodeId && e.target !== nodeId
    ));
  }, [setNodes, setEdges]);
  
  return { editNode, deleteNode };
};
```

## Keyboard Shortcuts

### Implementation
```tsx
useEffect(() => {
  const handleKeyDown = (event) => {
    if (event.key === 'Delete' && selectedNodes.length > 0) {
      deleteSelectedNodes();
    }
    
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'z':
          event.preventDefault();
          undo();
          break;
        case 'y':
          event.preventDefault();
          redo();
          break;
        case 'a':
          event.preventDefault();
          selectAllNodes();
          break;
      }
    }
  };
  
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [selectedNodes, deleteSelectedNodes, undo, redo, selectAllNodes]);
```

## Performance Tips

### Memoization
```tsx
const MemoizedNode = React.memo(({ data, selected }) => (
  <div className={`node ${selected ? 'selected' : ''}`}>
    {data.label}
  </div>
));

const nodeTypes = useMemo(() => ({
  custom: MemoizedNode
}), []);
```

### Debounced Updates
```tsx
const debouncedSave = useMemo(
  () => debounce((nodes, edges) => {
    saveFlow({ nodes, edges });
  }, 1000),
  []
);

useEffect(() => {
  debouncedSave(nodes, edges);
}, [nodes, edges, debouncedSave]);
```

## Debugging

### React Flow DevTools
```tsx
import { ReactFlowProvider } from '@xyflow/react';

<ReactFlowProvider>
  <FlowEditor />
  {process.env.NODE_ENV === 'development' && <DevTools />}
</ReactFlowProvider>
```

### Console Logging
```tsx
const onNodesChange = useCallback((changes) => {
  console.log('Node changes:', changes);
  applyNodeChanges(changes, nodes);
}, [nodes]);
```

## Common Issues

### Theme Not Updating
- Ensure CSS variables are properly set
- Check if components are wrapped in ThemeProvider
- Verify CSS variable names match theme context

### Connections Not Working
- Check handle positioning
- Verify connection validation logic
- Ensure proper event handlers are set

### Performance Issues
- Use React.memo for node components
- Implement virtualization for large flows
- Debounce expensive operations

### Mobile Responsiveness
- Test touch interactions
- Adjust node sizes for mobile
- Hide non-essential controls on small screens
