# Visual Flow Editor UI Documentation

## Overview

The Visual Flow Editor is a React Flow-based canvas interface that allows users to create, edit, and execute Python scripts through an intuitive node-based workflow system. This document outlines the UI specifications, theming integration, and interaction patterns.

## Core Features

### Canvas Interface
- **Zoomable Canvas**: Infinite pan and zoom capabilities with smooth transitions
- **Node-Based Workflow**: Drag-and-drop blocks representing script inputs/outputs
- **Connection System**: Visual connections between nodes using bezier curves
- **Interactive Blocks**: Left-click interactions with contextual dropdowns
- **No Image Embedding**: Blocks are purely text and icon-based for performance

### Node Types

#### Input Nodes
- **File Input**: Represents file uploads or selections
- **Parameter Input**: Configuration parameters for scripts
- **Data Source**: External data connections

#### Processing Nodes
- **Script Block**: Python script execution units
- **Transform**: Data transformation operations
- **Filter**: Data filtering operations

#### Output Nodes
- **File Output**: Generated files or exports
- **Result Display**: Visual output representation
- **Data Export**: Structured data outputs

## Theme Integration

The Visual Flow Editor respects the application's theme system with three supported themes:

### Dark Theme (Default)
```css
--flow-bg: var(--color-bg)              /* #0f1117 */
--flow-surface: var(--color-surface)    /* #1a1f2d */
--flow-border: var(--color-border)      /* #2a3349 */
--flow-text: var(--color-text)          /* #f3f4f6 */
--flow-primary: var(--color-primary)    /* #3b82f6 */
```

### Light Theme
```css
--flow-bg: var(--color-bg)              /* #f8fafc */
--flow-surface: var(--color-surface)    /* #ffffff */
--flow-border: var(--color-border)      /* #e5e7eb */
--flow-text: var(--color-text)          /* #1f2937 */
--flow-primary: var(--color-primary)    /* #3b82f6 */
```

### Midnight Theme
```css
--flow-bg: var(--color-bg)              /* #000000 */
--flow-surface: var(--color-surface)    /* #111827 */
--flow-border: var(--color-border)      /* #374151 */
--flow-text: var(--color-text)          /* #f9fafb */
--flow-primary: var(--color-primary)    /* #8b5cf6 */
```

## Node Design Specifications

### Base Node Structure
```tsx
interface FlowNode {
  id: string;
  type: 'input' | 'process' | 'output';
  position: { x: number; y: number };
  data: {
    label: string;
    icon?: string;
    status: 'idle' | 'running' | 'success' | 'error';
    config?: Record<string, any>;
  };
}
```

### Visual Design
- **Dimensions**: 200px width, auto height (min 80px)
- **Border Radius**: 12px for modern appearance
- **Border**: 2px solid using `--flow-border`
- **Background**: `--flow-surface` with subtle gradient
- **Shadow**: Soft drop shadow for depth
- **Typography**: 14px font size, medium weight for labels

### Status Indicators
- **Idle**: Default border color
- **Running**: Animated blue border with pulse effect
- **Success**: Green border with checkmark icon
- **Error**: Red border with error icon

## Interaction Patterns

### Left-Click Interactions
When a user left-clicks on a node, a contextual dropdown appears adjacent to the node with relevant actions:

#### Input Node Actions
- Configure Input Source
- Set Parameters
- Preview Data
- Remove Node

#### Processing Node Actions
- Edit Script
- Configure Parameters
- View Logs
- Duplicate Node
- Remove Node

#### Output Node Actions
- Configure Output Format
- Download Result
- Share Output
- Remove Node

### Dropdown Positioning
- **Primary Position**: Right side of the node
- **Fallback**: Left side if insufficient space
- **Vertical Alignment**: Top-aligned with node
- **Animation**: Smooth fade-in with scale transition

## Connection System

### Edge Styling
- **Type**: Smooth bezier curves
- **Width**: 2px for normal connections, 3px for active
- **Color**: `--flow-border` for inactive, `--flow-primary` for active
- **Animation**: Data flow animation for active connections
- **Hover**: Highlight on hover with increased opacity

### Connection Rules
- **Input to Output**: Only allow connections from output handles to input handles
- **Type Validation**: Ensure compatible data types between connections
- **Cycle Prevention**: Prevent circular dependencies
- **Multiple Connections**: Allow multiple outputs, single input per handle

## Canvas Controls

### Built-in Controls
- **Zoom In/Out**: Standard zoom controls in bottom-right
- **Fit View**: Center and fit all nodes in viewport
- **Mini Map**: Optional overview of entire flow
- **Background**: Dot pattern background for visual reference

### Keyboard Shortcuts
- **Delete**: Remove selected nodes/edges
- **Ctrl+Z**: Undo last action
- **Ctrl+Y**: Redo last action
- **Ctrl+A**: Select all nodes
- **Ctrl+C/V**: Copy/paste nodes

## Responsive Design

### Desktop (1024px+)
- Full canvas with sidebar
- All controls visible
- Optimal node spacing

### Tablet (768px - 1023px)
- Collapsible sidebar
- Simplified controls
- Touch-optimized interactions

### Mobile (< 768px)
- Hidden sidebar by default
- Essential controls only
- Touch gestures for navigation

## Accessibility

### Keyboard Navigation
- **Tab**: Navigate between nodes
- **Enter/Space**: Activate node interactions
- **Arrow Keys**: Move selected nodes
- **Escape**: Close dropdowns/cancel operations

### Screen Reader Support
- Semantic HTML structure
- ARIA labels for all interactive elements
- Live regions for status updates
- Descriptive alt text for icons

## Performance Considerations

### Optimization Strategies
- **Virtualization**: Render only visible nodes for large flows
- **Memoization**: React.memo for node components
- **Debounced Updates**: Throttle position updates during drag
- **Lazy Loading**: Load node configurations on demand

### Memory Management
- **Cleanup**: Remove event listeners on unmount
- **State Management**: Efficient state updates
- **Image Optimization**: No embedded images to reduce memory usage

## Implementation Notes

### React Flow Configuration
```tsx
const flowConfig = {
  nodeTypes: customNodeTypes,
  edgeTypes: customEdgeTypes,
  defaultViewport: { x: 0, y: 0, zoom: 1 },
  minZoom: 0.1,
  maxZoom: 2,
  snapToGrid: true,
  snapGrid: [15, 15],
  connectionMode: ConnectionMode.Strict,
};
```

### Theme Integration
The editor automatically adapts to theme changes through CSS variables, ensuring consistent appearance across all application themes without requiring component re-renders.

## Functional Workflow Integration

### User Workspace Configuration
The Visual Flow Editor integrates with user-specific workspace settings stored in the database:

#### Workspace Settings (Stored per UUID)
```typescript
interface UserWorkspaceSettings {
  work_area_location: string;        // e.g., '/mnt/projects_107/vasu_backend'
  central_scripts_path: string;      // e.g., '/mnt/projects/vasu_backend/flow/central_scripts'
  default_tool: 'cadence' | 'synopsys';
  default_user_name: string;
}
```

These settings are configurable in the Settings page and persist across sessions, bound to the user's UUID.

### Flow Execution Architecture

#### Phase 1: Visual Flow Design (Frontend)
1. **Canvas Interaction**: User creates workflow using drag-and-drop blocks
2. **Block Configuration**: Each block represents flowdir.py parameters:
   - **Input Blocks**: Project name, block name, tool selection, stage selection
   - **Process Blocks**: Flow stages (SYNTH, PD, LEC, STA)
   - **Output Blocks**: Generated directories and execution scripts
3. **Parameter Mapping**: Visual blocks map to flowdir.py input parameters
4. **Dummy Data Phase**: Initially, blocks contain placeholder/dummy data for UI development

#### Phase 2: Flow Execution (Backend Integration)
1. **Save Flow**: User saves the visual flow configuration to database
2. **Parameter Extraction**: Extract block values and convert to flowdir.py parameters
3. **MCP Execution**: Send flowdir.py execution request to MCP orchestrator
4. **Remote Execution**: Execute flowdir.py in user's workspace via MCP client
5. **Status Tracking**: Real-time status updates and execution logs
6. **Database Updates**: Store execution results and status per user UUID

### MCP Integration Strategy

#### Existing MCP Architecture Reuse
The Visual Flow Editor leverages the same MCP integration pattern used by the chatbot:

```typescript
// Similar to existing chatbot MCP integration
const executionRequest = {
  tool: 'runShellCommand',
  parameters: {
    command: `python3 flowdir.py`,
    workingDirectory: userSettings.work_area_location,
    environment: {
      PROJECT_NAME: flowData.project_name,
      BLOCK_NAME: flowData.block_name,
      TOOL_USED: flowData.tool_used,
      // ... other parameters
    }
  }
};
```

#### MCP Client Integration
- **Reuse Existing**: Copy MCP client from `python/terminal-mcp-orchestrator/` to `python/DIR_CREATE_MODULE/`
- **Dedicated Execution**: Create flow-specific MCP execution wrapper
- **Same Pattern**: Follow existing chatbot → MCP orchestrator → remote execution pattern

### Database Schema Integration

#### Flow Storage Tables
```sql
-- Visual flows designed by users
CREATE TABLE user_visual_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flow_name VARCHAR(255) NOT NULL,
    flow_description TEXT,
    canvas_data JSONB NOT NULL,           -- React Flow nodes and edges
    parameter_mapping JSONB NOT NULL,     -- Block parameters → flowdir.py mapping
    workspace_settings JSONB NOT NULL,    -- User workspace configuration
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, flow_name)
);

-- Flow execution history and status
CREATE TABLE flow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES user_visual_flows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    execution_status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
    execution_parameters JSONB NOT NULL,             -- Actual parameters sent to flowdir.py
    execution_logs TEXT,                              -- MCP execution logs
    error_message TEXT,                               -- Error details if failed
    execution_time_ms INTEGER,                        -- Execution duration
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    mcp_server_used VARCHAR(255)                      -- Which MCP server executed the flow
);

-- User workspace settings (per UUID)
CREATE TABLE user_workspace_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_area_location TEXT NOT NULL,
    central_scripts_path TEXT NOT NULL,
    default_tool VARCHAR(50) DEFAULT 'cadence',
    default_user_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);
```

## Detailed Component Specifications

### Node Component Structure

#### Base Node Component
```tsx
interface NodeComponentProps {
  id: string;
  data: NodeData;
  selected: boolean;
  dragging: boolean;
}

const BaseNode: React.FC<NodeComponentProps> = ({ id, data, selected, dragging }) => {
  const { currentTheme } = useTheme();

  return (
    <div
      className={`flow-node ${data.type} ${selected ? 'selected' : ''}`}
      style={{
        backgroundColor: 'var(--flow-surface)',
        border: `2px solid ${selected ? 'var(--flow-primary)' : 'var(--flow-border)'}`,
        borderRadius: '12px',
        padding: '16px',
        minWidth: '200px',
        boxShadow: dragging
          ? '0 10px 25px rgba(0,0,0,0.3)'
          : '0 4px 12px rgba(0,0,0,0.15)'
      }}
    >
      <NodeHeader icon={data.icon} label={data.label} status={data.status} />
      <NodeContent config={data.config} />
      <NodeHandles type={data.type} />
    </div>
  );
};
```

#### Node Header
```tsx
const NodeHeader: React.FC<{
  icon?: string;
  label: string;
  status: NodeStatus;
}> = ({ icon, label, status }) => (
  <div className="flex items-center gap-2 mb-2">
    {icon && <Icon name={icon} size={16} />}
    <span className="font-medium text-sm" style={{ color: 'var(--flow-text)' }}>
      {label}
    </span>
    <StatusIndicator status={status} />
  </div>
);
```

### Dropdown Menu System

#### Context Menu Component
```tsx
interface ContextMenuProps {
  nodeId: string;
  nodeType: string;
  position: { x: number; y: number };
  onClose: () => void;
  actions: MenuAction[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  nodeId,
  nodeType,
  position,
  onClose,
  actions
}) => {
  return (
    <div
      className="context-menu"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        backgroundColor: 'var(--flow-surface)',
        border: '1px solid var(--flow-border)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        zIndex: 1000,
        minWidth: '180px'
      }}
    >
      {actions.map((action, index) => (
        <MenuItem
          key={index}
          icon={action.icon}
          label={action.label}
          onClick={() => {
            action.handler(nodeId);
            onClose();
          }}
          disabled={action.disabled}
        />
      ))}
    </div>
  );
};
```

#### Menu Item Component
```tsx
const MenuItem: React.FC<{
  icon?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, onClick, disabled }) => (
  <button
    className="menu-item"
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      padding: '12px 16px',
      border: 'none',
      background: 'transparent',
      color: disabled ? 'var(--color-text-muted)' : 'var(--flow-text)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '14px',
      textAlign: 'left'
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.currentTarget.style.backgroundColor = 'var(--color-surface-light)';
      }
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
    }}
  >
    {icon && <Icon name={icon} size={14} />}
    {label}
  </button>
);
```

### Connection Handle System

#### Handle Component
```tsx
const Handle: React.FC<{
  type: 'source' | 'target';
  position: Position;
  id?: string;
  dataType?: string;
}> = ({ type, position, id, dataType }) => (
  <div
    className={`handle handle-${type}`}
    style={{
      position: 'absolute',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      border: '2px solid var(--flow-primary)',
      backgroundColor: 'var(--flow-surface)',
      [position]: '-6px',
      top: '50%',
      transform: 'translateY(-50%)',
      cursor: 'crosshair'
    }}
    data-handleid={id}
    data-datatype={dataType}
  />
);
```

### Animation Specifications

#### Node Animations
```css
.flow-node {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.flow-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.2);
}

.flow-node.selected {
  transform: scale(1.02);
}

.flow-node.dragging {
  transform: rotate(2deg) scale(1.05);
  z-index: 1000;
}
```

#### Connection Animations
```css
.react-flow__edge-path {
  transition: stroke 0.2s ease;
}

.react-flow__edge:hover .react-flow__edge-path {
  stroke: var(--flow-primary);
  stroke-width: 3px;
}

.react-flow__edge.animated .react-flow__edge-path {
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
}

@keyframes dashdraw {
  to {
    stroke-dashoffset: -10;
  }
}
```

#### Status Indicator Animations
```css
.status-indicator.running {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

### Error Handling and Validation

#### Connection Validation
```tsx
const isValidConnection = (connection: Connection): boolean => {
  const sourceNode = getNode(connection.source);
  const targetNode = getNode(connection.target);

  // Prevent self-connections
  if (connection.source === connection.target) {
    return false;
  }

  // Check data type compatibility
  const sourceType = sourceNode?.data.outputType;
  const targetType = targetNode?.data.inputType;

  if (sourceType && targetType && !isCompatibleType(sourceType, targetType)) {
    showError('Incompatible data types');
    return false;
  }

  // Prevent cycles
  if (wouldCreateCycle(connection)) {
    showError('Connection would create a cycle');
    return false;
  }

  return true;
};
```

#### Error Display
```tsx
const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flow-error-boundary">
      {children}
      <div className="error-overlay" style={{ display: 'none' }}>
        <div className="error-message">
          <Icon name="alert-circle" />
          <span>An error occurred in the flow editor</span>
          <button onClick={() => window.location.reload()}>
            Reload Editor
          </button>
        </div>
      </div>
    </div>
  );
};
```
