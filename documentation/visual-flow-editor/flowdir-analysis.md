# FlowDir Script Analysis & Visual Mapping

## 📋 **Script Overview**

The `flowdir.py` script is a sophisticated directory structure creation tool for VLSI/EDA workflows. It creates complex hierarchical directory structures based on user inputs and handles various tool flows (Cadence, Synopsys) and stages (Synthesis, PD, LEC, STA).

## 🔍 **Input Parameter Analysis**

### **Primary Inputs (Sequential Flow)**

#### **1. User Data Storage**
```python
# Function: user_data_storage() / get_user_input()
pname = input("Enter the name of your project: ")
block_name = input("Enter the name of your block : ")
user_name = getpass.getuser()  # Auto-detected
```

**Visual Block**: `ProjectConfiguration`
- **Project Name**: Text input
- **Block Name**: Text input  
- **User Name**: Auto-filled (from session)

#### **2. Tool Selection**
```python
tool_used = input("Enter the tool to be used ( cadence , synopsys ) : ")
```

**Visual Block**: `ToolSelection`
- **Type**: Radio buttons or dropdown
- **Options**: ["cadence", "synopsys"]
- **Validation**: Must select one

#### **3. Flow Stage Selection**
```python
stage_in_flow = input("Enter the stage in flow (ex: all Synthesis PD LEC STA ): ")
```

**Visual Block**: `FlowStageSelection`
- **Type**: Multi-select checkboxes
- **Options**: ["all", "Synthesis", "PD", "LEC", "STA"]
- **Logic**: "all" selects all others

#### **4. PD Steps (Conditional)**
```python
if (stage_in_flow=='PD'):
    text = input('Enter stages Floorplan Place CTS Route all : ')
    if (text=='all'):
        steps = "Floorplan Place CTS Route".split(' ')
    else:
        steps = text.replace('all','').replace('  ',' ').split(' ')
```

**Visual Block**: `PDStepsSelection`
- **Type**: Conditional multi-select
- **Condition**: Only show if "PD" selected in FlowStage
- **Options**: ["all", "Floorplan", "Place", "CTS", "Route"]
- **Logic**: "all" selects all PD steps

#### **5. Run Configuration**
```python
run = input('Enter run name : ')
```

**Visual Block**: `RunConfiguration`
- **Run Name**: Text input (required)
- **Validation**: Cannot be empty

#### **6. Reference Run (Optional)**
```python
runlink = input('Enter ref run path (to skip press enter) :')
```

**Visual Block**: `ReferenceRun`
- **Type**: Optional text input
- **Purpose**: Link to existing run for copying configurations
- **Validation**: Path validation if provided

## 🎨 **Visual Block Design**

### **Block Layout Flow**
```
[ProjectConfiguration] → [ToolSelection] → [FlowStageSelection]
                                                    ↓
[ReferenceRun] ← [RunConfiguration] ← [PDStepsSelection]
                                                    ↓
                                            [ExecuteScript]
```

### **Block Specifications**

#### **1. ProjectConfiguration Block**
```typescript
interface ProjectConfigurationBlock {
  id: string;
  type: 'project-config';
  position: { x: number; y: number };
  data: {
    project_name: string;
    block_name: string;
    user_name: string; // Auto-filled from session
  };
  style: {
    backgroundColor: '#1e293b';
    border: '2px solid #3b82f6';
    borderRadius: '8px';
  };
}
```

#### **2. ToolSelection Block**
```typescript
interface ToolSelectionBlock {
  id: string;
  type: 'tool-selection';
  position: { x: number; y: number };
  data: {
    selected_tool: 'cadence' | 'synopsys' | null;
    options: ['cadence', 'synopsys'];
  };
  style: {
    backgroundColor: '#1e293b';
    border: '2px solid #10b981';
  };
}
```

#### **3. FlowStageSelection Block**
```typescript
interface FlowStageSelectionBlock {
  id: string;
  type: 'flow-stage-selection';
  position: { x: number; y: number };
  data: {
    selected_stages: string[];
    options: ['all', 'Synthesis', 'PD', 'LEC', 'STA'];
    logic: 'all' | 'custom';
  };
  style: {
    backgroundColor: '#1e293b';
    border: '2px solid #f59e0b';
  };
}
```

#### **4. PDStepsSelection Block (Conditional)**
```typescript
interface PDStepsSelectionBlock {
  id: string;
  type: 'pd-steps-selection';
  position: { x: number; y: number };
  data: {
    selected_steps: string[];
    options: ['all', 'Floorplan', 'Place', 'CTS', 'Route'];
    visible: boolean; // Based on FlowStage selection
  };
  style: {
    backgroundColor: '#1e293b';
    border: '2px solid #8b5cf6';
    opacity: visible ? 1 : 0.5;
  };
}
```

#### **5. RunConfiguration Block**
```typescript
interface RunConfigurationBlock {
  id: string;
  type: 'run-configuration';
  position: { x: number; y: number };
  data: {
    run_name: string;
    validation: {
      required: true;
      pattern: /^[a-zA-Z0-9_-]+$/;
    };
  };
  style: {
    backgroundColor: '#1e293b';
    border: '2px solid #ef4444';
  };
}
```

#### **6. ReferenceRun Block**
```typescript
interface ReferenceRunBlock {
  id: string;
  type: 'reference-run';
  position: { x: number; y: number };
  data: {
    ref_run_path: string;
    optional: true;
    validation: {
      pathFormat: true;
    };
  };
  style: {
    backgroundColor: '#1e293b';
    border: '2px solid #6b7280';
    borderStyle: 'dashed'; // Indicates optional
  };
}
```

#### **7. ExecuteScript Block**
```typescript
interface ExecuteScriptBlock {
  id: string;
  type: 'execute-script';
  position: { x: number; y: number };
  data: {
    script_path: '/path/to/flowdir.py';
    execution_method: 'mcp' | 'ssh' | 'local';
    status: 'ready' | 'running' | 'completed' | 'error';
  };
  style: {
    backgroundColor: '#1e293b';
    border: '3px solid #059669';
    borderRadius: '12px';
  };
}
```

## 🔗 **Connection Logic**

### **Data Flow Connections**
```typescript
interface FlowDirConnections {
  // Project data flows to all subsequent blocks
  'project-config → tool-selection': {
    data: ['project_name', 'block_name', 'user_name'];
  };
  
  // Tool selection affects execution environment
  'tool-selection → flow-stage': {
    data: ['selected_tool'];
  };
  
  // Flow stage determines available options
  'flow-stage → pd-steps': {
    data: ['selected_stages'];
    condition: 'selected_stages.includes("PD")';
  };
  
  // All configuration flows to execution
  'run-config → execute': {
    data: ['run_name'];
  };
  
  'reference-run → execute': {
    data: ['ref_run_path'];
    optional: true;
  };
}
```

## 🎯 **Script Execution Mapping**

### **Parameter Extraction**
```typescript
function extractFlowDirParameters(canvasData: FlowCanvas): FlowDirParams {
  const blocks = canvasData.nodes;
  
  return {
    // From ProjectConfiguration block
    project_name: blocks.find(b => b.type === 'project-config')?.data.project_name,
    block_name: blocks.find(b => b.type === 'project-config')?.data.block_name,
    user_name: blocks.find(b => b.type === 'project-config')?.data.user_name,
    
    // From ToolSelection block
    tool_used: blocks.find(b => b.type === 'tool-selection')?.data.selected_tool,
    
    // From FlowStageSelection block
    stage_in_flow: blocks.find(b => b.type === 'flow-stage-selection')?.data.selected_stages.join(' '),
    
    // From PDStepsSelection block (if visible)
    pd_steps: blocks.find(b => b.type === 'pd-steps-selection')?.data.selected_steps,
    
    // From RunConfiguration block
    run_name: blocks.find(b => b.type === 'run-configuration')?.data.run_name,
    
    // From ReferenceRun block (optional)
    ref_run_path: blocks.find(b => b.type === 'reference-run')?.data.ref_run_path || '',
  };
}
```

### **Script Execution Command**
```typescript
function generateExecutionCommand(params: FlowDirParams): string {
  // Simulate user inputs for the script
  const inputs = [
    params.project_name,
    params.block_name,
    params.tool_used,
    params.stage_in_flow,
    ...(params.pd_steps || []),
    params.run_name,
    params.ref_run_path || ''
  ].join('\n');
  
  return `echo "${inputs}" | python3 /path/to/flowdir.py`;
}
```

## 🔄 **Validation Rules**

### **Block-Level Validation**
```typescript
interface ValidationRules {
  ProjectConfiguration: {
    project_name: { required: true, pattern: /^[a-zA-Z0-9_-]+$/ };
    block_name: { required: true, pattern: /^[a-zA-Z0-9_-]+$/ };
  };
  
  ToolSelection: {
    selected_tool: { required: true, enum: ['cadence', 'synopsys'] };
  };
  
  FlowStageSelection: {
    selected_stages: { required: true, minItems: 1 };
  };
  
  RunConfiguration: {
    run_name: { required: true, pattern: /^[a-zA-Z0-9_-]+$/ };
  };
}
```

### **Flow-Level Validation**
```typescript
function validateFlowDirWorkflow(canvas: FlowCanvas): ValidationResult {
  const errors: string[] = [];
  
  // Check required blocks
  const requiredBlocks = ['project-config', 'tool-selection', 'flow-stage', 'run-config', 'execute-script'];
  requiredBlocks.forEach(blockType => {
    if (!canvas.nodes.find(n => n.type === blockType)) {
      errors.push(`Missing required block: ${blockType}`);
    }
  });
  
  // Check conditional blocks
  const flowStageBlock = canvas.nodes.find(n => n.type === 'flow-stage-selection');
  if (flowStageBlock?.data.selected_stages.includes('PD')) {
    if (!canvas.nodes.find(n => n.type === 'pd-steps-selection')) {
      errors.push('PD steps selection required when PD flow is selected');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

## 📊 **Expected Output Structure**

The script creates a complex directory structure. Here's what the visual editor should show as expected output:

```
{project_name}/
├── Phase-0/
│   └── {block_name}/
│       ├── RTL/
│       ├── centroid_inputs/
│       ├── config/
│       ├── SYNTH/ (if selected)
│       │   └── {user_name}/
│       │       └── run_{tool}_{run_name}/
│       ├── PD/ (if selected)
│       │   └── {user_name}/
│       │       └── run_{tool}_{run_name}/
│       ├── LEC/ (if selected)
│       └── STA/ (if selected)
```

This analysis provides the foundation for creating an intuitive visual interface that maps directly to the script's complex input requirements and execution flow.
