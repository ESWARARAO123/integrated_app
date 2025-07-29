# Visual Flow Editor - Project Documentation

## 🎯 **Project Overview**

The Visual Flow Editor is a revolutionary GUI-based tool that transforms complex Python script execution into an intuitive, visual workflow experience. Users can create, configure, and execute Python scripts through a drag-and-drop canvas interface similar to n8n, but specifically designed for technical workflows.

## 📋 **Table of Contents**

1. [Project Overview](#project-overview)
2. [Core Concept](#core-concept)
3. [Technical Architecture](#technical-architecture)
4. [User Experience Flow](#user-experience-flow)
5. [Implementation Plan](#implementation-plan)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [MCP Integration](#mcp-integration)
10. [Development Phases](#development-phases)

## 📚 **Latest Documentation**

- **[Development Summary & Fixes](./DEVELOPMENT_SUMMARY_AND_FIXES.md)** - Complete chronicle of development, debugging, and fixes applied
- **[MCP Integration Analysis](./MCP_INTEGRATION_ANALYSIS.md)** - Comprehensive analysis of MCP integration opportunities for flow execution
- **[Database Implementation](./FLOW_EDITOR_DATABASE_IMPLEMENTATION.md)** - Detailed database schema and API documentation
- **[Development Tracker](./development-tracker.md)** - Project progress and milestone tracking

## 🎨 **Core Concept**

### **Visual Script Execution**
Transform the `flowdir.py` script (and future Python scripts) into visual, interactive workflows where:

- **Blocks** = Script input parameters/steps
- **Connections** = Data flow between parameters
- **Canvas** = Visual workspace for arranging workflow
- **Execution** = Remote script execution via MCP or other methods

### **Key Features**
- ✅ **Drag & Drop Interface**: Visual block-based editor
- ✅ **Zoomable Canvas**: Infinite workspace with pan/zoom
- ✅ **Block Configuration**: Edit parameters within blocks
- ✅ **Connection System**: Visual data flow representation
- ✅ **Remote Execution**: Execute via MCP or SSH
- ✅ **User Isolation**: Per-user workflows and configurations
- ✅ **Real-time Feedback**: Live execution status and logs

## 🏗️ **Technical Architecture**

### **Frontend Stack**
- **React + TypeScript**: Core UI framework
- **React Flow**: Canvas and node-based editor
- **Zustand**: State management for canvas
- **Tailwind CSS**: Styling and responsive design
- **React Hook Form**: Form handling for block configuration

### **Backend Stack**
- **Node.js + Express**: API server
- **PostgreSQL**: Database for workflows and configurations
- **WebSocket**: Real-time execution updates
- **MCP Integration**: Remote script execution
- **UUID-based User Binding**: Consistent with existing architecture

### **Execution Methods**
1. **MCP (Primary)**: Execute via existing MCP infrastructure
2. **SSH (Secondary)**: Direct SSH execution for remote servers
3. **Local (Development)**: Local execution for testing

## 🔄 **User Experience Flow**

### **1. Access Visual Editor**
```
Sidebar → "Flow Editor" → Canvas Interface
```

### **2. Create New Workflow**
```
New Workflow → Select Script Template → Configure Canvas
```

### **3. Design Workflow**
```
Drag Blocks → Configure Parameters → Connect Blocks → Validate Flow
```

### **4. Execute Workflow**
```
Execute Button → Select Execution Method → Monitor Progress → View Results
```

### **5. Save & Share**
```
Save Workflow → Export Configuration → Share with Team
```

## 📊 **Database Schema**

### **Core Tables**

#### **user_workflows**
```sql
CREATE TABLE user_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    script_template VARCHAR(100) NOT NULL, -- 'flowdir', 'custom', etc.
    canvas_data JSONB NOT NULL, -- Canvas layout, blocks, connections
    configuration JSONB NOT NULL, -- Block parameters and settings
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);
```

#### **workflow_executions**
```sql
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES user_workflows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    execution_method VARCHAR(50) NOT NULL, -- 'mcp', 'ssh', 'local'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    input_parameters JSONB NOT NULL,
    output_logs TEXT,
    error_message TEXT,
    execution_time_ms INTEGER,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    mcp_server_id UUID, -- Reference to MCP server used
    ssh_config_id UUID -- Reference to SSH config used
);
```

#### **script_templates**
```sql
CREATE TABLE script_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    script_path VARCHAR(500) NOT NULL,
    input_schema JSONB NOT NULL, -- JSON schema for input validation
    block_definitions JSONB NOT NULL, -- Visual block configurations
    default_canvas JSONB, -- Default canvas layout
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔌 **API Endpoints**

### **Workflow Management**
```typescript
// Get user workflows
GET /api/flow-editor/workflows
Response: { workflows: UserWorkflow[] }

// Create new workflow
POST /api/flow-editor/workflows
Body: { name, description, script_template, canvas_data, configuration }
Response: { workflow: UserWorkflow }

// Update workflow
PUT /api/flow-editor/workflows/:id
Body: { name?, description?, canvas_data?, configuration? }
Response: { workflow: UserWorkflow }

// Delete workflow
DELETE /api/flow-editor/workflows/:id
Response: { success: boolean }
```

### **Script Templates**
```typescript
// Get available templates
GET /api/flow-editor/templates
Response: { templates: ScriptTemplate[] }

// Get template details
GET /api/flow-editor/templates/:name
Response: { template: ScriptTemplate }
```

### **Workflow Execution**
```typescript
// Execute workflow
POST /api/flow-editor/workflows/:id/execute
Body: { execution_method, mcp_server_id?, ssh_config_id? }
Response: { execution_id: string }

// Get execution status
GET /api/flow-editor/executions/:id
Response: { execution: WorkflowExecution }

// Get execution logs (WebSocket)
WS /api/flow-editor/executions/:id/logs
```

## 🎨 **Frontend Components**

### **Core Components Structure**
```
client/src/components/flow-editor/
├── FlowEditor.tsx              # Main editor container
├── Canvas/
│   ├── FlowCanvas.tsx         # React Flow canvas
│   ├── CustomNode.tsx         # Custom block component
│   ├── CustomEdge.tsx         # Custom connection component
│   └── CanvasControls.tsx     # Zoom, pan, fit controls
├── Sidebar/
│   ├── BlockPalette.tsx       # Available blocks
│   ├── WorkflowList.tsx       # User workflows
│   └── TemplateSelector.tsx   # Script templates
├── Configuration/
│   ├── BlockConfigPanel.tsx   # Block parameter editor
│   ├── WorkflowSettings.tsx   # Global workflow settings
│   └── ExecutionPanel.tsx     # Execution controls
├── Execution/
│   ├── ExecutionMonitor.tsx   # Real-time execution status
│   ├── LogViewer.tsx          # Execution logs
│   └── ResultsPanel.tsx       # Execution results
└── Common/
    ├── BlockTypes.ts          # Block type definitions
    ├── FlowTypes.ts           # Flow type definitions
    └── ValidationUtils.ts     # Input validation
```

### **Block Types for FlowDir Script**
```typescript
interface FlowDirBlocks {
  ProjectInput: {
    type: 'input';
    label: 'Project Configuration';
    fields: ['project_name', 'block_name', 'user_name'];
  };
  ToolSelection: {
    type: 'selection';
    label: 'Tool Selection';
    options: ['cadence', 'synopsys'];
  };
  FlowStage: {
    type: 'multi-select';
    label: 'Flow Stage';
    options: ['Synthesis', 'PD', 'LEC', 'STA', 'all'];
  };
  PDSteps: {
    type: 'conditional';
    label: 'PD Steps';
    condition: 'FlowStage.includes("PD")';
    options: ['Floorplan', 'Place', 'CTS', 'Route', 'all'];
  };
  RunConfiguration: {
    type: 'input';
    label: 'Run Configuration';
    fields: ['run_name', 'ref_run_path?'];
  };
  ExecutionTarget: {
    type: 'execution';
    label: 'Execute FlowDir';
    method: ['mcp', 'ssh', 'local'];
  };
}
```

## 🔗 **MCP Integration**

### **Execution Flow via MCP**
```typescript
// 1. Prepare execution payload
const executionPayload = {
  script_path: '/path/to/flowdir.py',
  parameters: extractedBlockParameters,
  working_directory: userWorkingDir,
  environment: userEnvironment
};

// 2. Send to MCP server
const mcpResponse = await mcpService.executeScript({
  server_id: selectedMCPServer,
  payload: executionPayload,
  user_id: currentUser.id
});

// 3. Monitor execution via WebSocket
const executionSocket = new WebSocket(`/api/mcp/executions/${mcpResponse.execution_id}/logs`);
```

### **MCP Server Requirements**
- **Python Script Execution**: Ability to run Python scripts
- **File System Access**: Create directories and files
- **Environment Management**: Handle different user environments
- **Real-time Logging**: Stream execution logs back to client
- **Error Handling**: Capture and report script errors

## 📈 **Development Phases**

### **Phase 1: Foundation (Week 1-2)**
- ✅ Database schema implementation
- ✅ Basic API endpoints
- ✅ React Flow canvas setup
- ✅ User authentication integration
- ✅ Basic block components

### **Phase 2: Core Editor (Week 3-4)**
- ✅ Drag & drop functionality
- ✅ Block configuration panels
- ✅ Canvas persistence
- ✅ Workflow CRUD operations
- ✅ Template system

### **Phase 3: FlowDir Integration (Week 5-6)**
- ✅ FlowDir script template
- ✅ Parameter extraction and validation
- ✅ Block-to-parameter mapping
- ✅ Input validation and error handling

### **Phase 4: Execution Engine (Week 7-8)**
- ✅ MCP integration for script execution
- ✅ Real-time execution monitoring
- ✅ Log streaming via WebSocket
- ✅ Error handling and recovery

### **Phase 5: Enhancement (Week 9-10)**
- ✅ SSH execution method
- ✅ Workflow sharing and export
- ✅ Advanced canvas features
- ✅ Performance optimization

### **Phase 6: Production (Week 11-12)**
- ✅ Testing and bug fixes
- ✅ Documentation completion
- ✅ Deployment preparation
- ✅ User training materials

## 🎯 **Success Metrics**

- **User Adoption**: 80% of users try the visual editor within first month
- **Workflow Creation**: Average 5+ workflows per active user
- **Execution Success**: 95% successful script executions
- **User Satisfaction**: 4.5+ star rating from user feedback
- **Performance**: <2s canvas load time, <5s execution start time

## 🔄 **Next Steps**

1. **Create Development Branch**: Set up feature branch for development
2. **Database Migration**: Implement new tables and relationships
3. **API Development**: Build core API endpoints
4. **Frontend Setup**: Initialize React Flow components
5. **MCP Integration**: Connect with existing MCP infrastructure

---

*This documentation will be updated as the project progresses. For technical questions or implementation details, refer to the specific component documentation in their respective folders.*
