# FlowDir Backend Implementation Plan

## 📋 Overview

This document outlines the complete plan for implementing remote execution of `flowdir.py` script through the Flow Editor backend, enabling VLSI directory structure creation via the web interface.

## 🔍 Current State Analysis

### Script Comparison: Original vs Current

| Aspect | Original (tested) | Current (our version) | Action Required |
|--------|------------------|----------------------|-----------------|
| **Working Directory** | `/nas/nas_v1/Innovus_trials/users/` | `/mnt/projects_107/vasu_backend` | ✅ Use settings |
| **Central Scripts Path** | `./central_scripts` | `/mnt/projects/vasu_backend/flow/central_scripts` | ✅ Use settings |
| **Input Method** | Interactive `input()` | Interactive `input()` | 🔄 Convert to CLI args |
| **Reference Run Handling** | Simple name | Full path parsing | ⚠️ Need to adapt |
| **LEC/STA Support** | Basic | Enhanced with sub-flows | ✅ Keep enhanced |
| **Error Handling** | Basic | Basic | 🔄 Add structured logging |

### Key Differences Identified

1. **Path Configuration**: Different base paths (easily configurable)
2. **Reference Run Input**: Original uses simple names, current uses full paths
3. **Enhanced Features**: Current version has better LEC/STA support
4. **Structure**: Both create same directory hierarchy

## 🎯 Implementation Strategy

### Phase 1: Script Parameterization
Convert interactive script to CLI-based execution

### Phase 2: Structured Logging
Add parseable output for frontend tracking

### Phase 3: Remote Execution
Implement Base64 encoding and MCP execution

### Phase 4: Frontend Integration
Connect with Flow Editor UI

## 📝 Detailed Implementation Plan

### 1. 🔧 Script Modification (`flowdir_parameterized.py`)

#### 1.1 Command Line Arguments
```bash
python3 flowdir.py \
  --project-name "Bigendian" \
  --block-name "Top_encoder_01" \
  --tool-name "cadence" \
  --stage "all" \
  --run-name "run-yaswanth-01" \
  --reference-run "" \
  --working-directory "/mnt/projects_107/vasu_backend" \
  --central-scripts "/mnt/projects/vasu_backend/flow/central_scripts"
```

#### 1.2 Parameter Injection Points
Replace these interactive inputs:
- `input("Enter the name of your project: ")` → `args.project_name`
- `input("Enter the name of your block : ")` → `args.block_name`
- `input("Enter the tool to be used ( cadence , synopsys ) : ")` → `args.tool_name`
- `input("Enter the stage in flow (ex: all Synthesis PD LEC STA ): ")` → `args.stage`
- `input('Enter stages Floorplan Place CTS Route all : ')` → Auto-determine from stage
- `input('Enter run name : ')` → `args.run_name`
- `input('Enter ref run name (to skip press enter) :')` → `args.reference_run`

#### 1.3 Path Configuration
Replace hardcoded paths:
- `os.chdir('/nas/nas_v1/Innovus_trials/users/')` → `os.chdir(args.working_directory)`
- `central_directory_path = "./central_scripts"` → `args.central_scripts`

### 2. 📊 Structured Logging Implementation

#### 2.1 Log Prefixes for Parsing
```python
def log_action(action_type, path, status="SUCCESS"):
    """Structured logging for frontend parsing"""
    print(f"FLOWDIR_LOG:{action_type}:{status}:{path}")

# Usage examples:
log_action("DIR_CREATED", "/path/to/directory")
log_action("FILE_COPIED", "/source/to/dest")
log_action("SYMLINK_CREATED", "/link/path")
log_action("OPERATION_FAILED", "/failed/path", "ERROR")
```

#### 2.2 Progress Tracking
```python
def log_progress(current_step, total_steps, description):
    """Progress tracking for frontend"""
    print(f"FLOWDIR_PROGRESS:{current_step}/{total_steps}:{description}")

# Usage:
log_progress(1, 5, "Creating base directories")
log_progress(2, 5, "Setting up SYNTH flow")
log_progress(3, 5, "Setting up PD flow")
```

#### 2.3 Summary Output
```python
def log_summary(project, block, run, created_paths):
    """Final summary for frontend display"""
    print(f"FLOWDIR_SUMMARY:PROJECT:{project}")
    print(f"FLOWDIR_SUMMARY:BLOCK:{block}")
    print(f"FLOWDIR_SUMMARY:RUN:{run}")
    print(f"FLOWDIR_SUMMARY:TOTAL_DIRS:{len(created_paths)}")
    for path in created_paths:
        print(f"FLOWDIR_SUMMARY:PATH:{path}")
```

### 3. 🚀 Backend API Implementation

#### 3.1 Enhanced `dir-create-api/server.js`

```javascript
// Enhanced execute-flowdir endpoint
app.post('/execute-flowdir', async (req, res) => {
  const executionId = uuidv4();
  const startTime = Date.now();
  
  try {
    const { 
      mcpServerUrl, 
      projectName,
      blockName,
      toolName,
      stage,
      runName,
      referenceRun,
      workingDirectory,
      centralScriptsDirectory 
    } = req.body;

    // Validate required parameters
    const requiredParams = ['projectName', 'blockName', 'toolName', 'stage', 'runName'];
    const missing = requiredParams.filter(param => !req.body[param]);
    
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required parameters: ${missing.join(', ')}`
      });
    }

    // Execute flowdir remotely
    const result = await executeFlowdirRemotely({
      mcpServerUrl,
      parameters: {
        projectName,
        blockName,
        toolName,
        stage,
        runName,
        referenceRun: referenceRun || '',
        workingDirectory: workingDirectory || '/mnt/projects_107/vasu_backend',
        centralScriptsDirectory: centralScriptsDirectory || '/mnt/projects/vasu_backend/flow/central_scripts'
      },
      executionId
    });

    const executionTime = Date.now() - startTime;

    res.json({
      success: result.success,
      executionId,
      executionTime,
      data: result.data,
      logs: result.logs,
      createdPaths: result.createdPaths,
      summary: result.summary,
      error: result.error
    });

  } catch (error) {
    console.error('Error in execute-flowdir:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      executionId
    });
  }
});
```

#### 3.2 Remote Execution Strategies

##### Strategy 1: Base64 Payload Execution (Primary)
```javascript
async function executeFlowdirViaPayload(mcpServerUrl, parameters, executionId) {
  const logs = [];
  
  try {
    // Read and modify the script
    const originalScript = await fs.readFile('/app/python/terminal-mcp-orchestrator/flowdir.py', 'utf8');
    const modifiedScript = injectParameters(originalScript, parameters);
    
    // Convert to base64
    const base64Script = Buffer.from(modifiedScript).toString('base64');
    
    logs.push('Executing flowdir script via base64 payload...');
    
    // Execute via runShellCommand
    const command = `echo "${base64Script}" | base64 -d | python3 - ${buildCliArgs(parameters)}`;
    const executionResult = await mcpRunShellCommand(mcpServerUrl, command);
    
    if (executionResult.success) {
      const parsedOutput = parseFlowdirOutput(executionResult.stdout);
      return {
        success: true,
        data: parsedOutput,
        logs: [...logs, ...parsedOutput.logs],
        createdPaths: parsedOutput.createdPaths,
        summary: parsedOutput.summary
      };
    } else {
      throw new Error(executionResult.error || 'Script execution failed');
    }
    
  } catch (error) {
    logs.push(`Payload execution failed: ${error.message}`);
    throw error;
  }
}
```

##### Strategy 2: Script Transfer + Execution (Fallback)
```javascript
async function executeFlowdirViaTransfer(mcpServerUrl, parameters, executionId) {
  const logs = [];
  const remoteScriptPath = `/tmp/flowdir_${executionId}.py`;
  
  try {
    // Read and modify the script
    const originalScript = await fs.readFile('/app/python/terminal-mcp-orchestrator/flowdir.py', 'utf8');
    const modifiedScript = injectParameters(originalScript, parameters);
    
    logs.push('Transferring modified script to remote server...');
    
    // Transfer script
    const transferResult = await mcpCreateFile(mcpServerUrl, remoteScriptPath, modifiedScript);
    if (!transferResult.success) {
      throw new Error('Failed to transfer script to remote server');
    }
    
    logs.push('Executing flowdir script on remote server...');
    
    // Execute script
    const executionResult = await mcpRunPythonFile(mcpServerUrl, remoteScriptPath, buildCliArgs(parameters));
    
    // Cleanup
    logs.push('Cleaning up temporary files...');
    await mcpDeleteFile(mcpServerUrl, remoteScriptPath);
    
    if (executionResult.success) {
      const parsedOutput = parseFlowdirOutput(executionResult.stdout);
      return {
        success: true,
        data: parsedOutput,
        logs: [...logs, ...parsedOutput.logs],
        createdPaths: parsedOutput.createdPaths,
        summary: parsedOutput.summary
      };
    } else {
      throw new Error(executionResult.error || 'Script execution failed');
    }
    
  } catch (error) {
    logs.push(`Transfer execution failed: ${error.message}`);
    throw error;
  }
}
```

#### 3.3 Parameter Injection Logic

```javascript
function injectParameters(originalScript, parameters) {
  let modifiedScript = originalScript;
  
  // Replace hardcoded paths
  modifiedScript = modifiedScript.replace(
    /os\.chdir\(['"]/[^'"]+['"]\)/g,
    `os.chdir('${parameters.workingDirectory}')`
  );
  
  modifiedScript = modifiedScript.replace(
    /central_directory_path\s*=\s*['"]/[^'"]+['"]/g,
    `central_directory_path = "${parameters.centralScriptsDirectory}"`
  );
  
  // Add argument parsing at the beginning
  const argParsingCode = `
import argparse

# Parse command line arguments
parser = argparse.ArgumentParser(description='VLSI Flow Directory Creator')
parser.add_argument('--project-name', required=True, help='Project name')
parser.add_argument('--block-name', required=True, help='Block name')
parser.add_argument('--tool-name', required=True, choices=['cadence', 'synopsys'], help='Tool name')
parser.add_argument('--stage', required=True, help='Stage in flow')
parser.add_argument('--run-name', required=True, help='Run name')
parser.add_argument('--reference-run', default='', help='Reference run name')
parser.add_argument('--working-directory', default='/mnt/projects_107/vasu_backend', help='Working directory')
parser.add_argument('--central-scripts', default='/mnt/projects/vasu_backend/flow/central_scripts', help='Central scripts directory')

args = parser.parse_args()

# Override interactive inputs with CLI arguments
def get_user_input():
    tool_used = args.tool_name
    pname = args.project_name
    block_name = args.block_name
    user_name = getpass.getuser()
    stage_in_flow = args.stage
    run = args.run_name
    runlink = args.reference_run
    
    # Process stage and steps
    steps = ''
    if stage_in_flow == 'PD':
        flowsc = [stage_in_flow]
        steps = ["Floorplan", "Place", "CTS", "Route"]
    elif stage_in_flow == 'Synthesis':
        flowsc = ['SYNTH']
    elif stage_in_flow == 'all':
        flowsc = ['SYNTH','PD','LEC','STA']
        steps = ['Floorplan', 'Place', 'CTS', 'Route']
    else:
        flowsc = [item for item in stage_in_flow.replace('all','').replace('Synthesis','SYNTH').split(' ') if item.strip()]
    
    # Handle reference run logic
    exists = 0
    namess = ''
    ref_flowsc = []
    
    if runlink:
        # Reference run validation logic here
        exists = 1  # Simplified for now
    
    return tool_used, pname, block_name, user_name, flowsc, run, steps, runlink, exists, namess, ref_flowsc
`;

  // Insert argument parsing before the main execution
  modifiedScript = modifiedScript.replace(
    /tool_used.*?=.*?get_user_input\(\)/s,
    argParsingCode + '\ntool_used, pname, block_name, user_name, flowsc, run, steps, runlink, exists, namess, ref_flowsc = get_user_input()'
  );
  
  return modifiedScript;
}
```

#### 3.4 Output Parsing Logic

```javascript
function parseFlowdirOutput(stdout) {
  const logs = [];
  const createdPaths = [];
  const summary = {};
  const errors = [];
  
  const lines = stdout.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('FLOWDIR_LOG:')) {
      const [, actionType, status, path] = line.split(':');
      logs.push({ actionType, status, path, timestamp: new Date().toISOString() });
      
      if (status === 'SUCCESS' && actionType === 'DIR_CREATED') {
        createdPaths.push(path);
      }
    } else if (line.startsWith('FLOWDIR_PROGRESS:')) {
      const [, progress, description] = line.split(':', 3);
      logs.push({ type: 'progress', progress, description, timestamp: new Date().toISOString() });
    } else if (line.startsWith('FLOWDIR_SUMMARY:')) {
      const [, key, value] = line.split(':', 3);
      summary[key.toLowerCase()] = value;
    } else if (line.startsWith('FLOWDIR_ERROR:')) {
      const error = line.substring('FLOWDIR_ERROR:'.length);
      errors.push(error);
      logs.push({ type: 'error', message: error, timestamp: new Date().toISOString() });
    } else if (line.trim()) {
      // Regular output
      logs.push({ type: 'output', message: line, timestamp: new Date().toISOString() });
    }
  }
  
  return {
    logs,
    createdPaths,
    summary,
    errors,
    success: errors.length === 0
  };
}
```

### 4. 🎨 Frontend Integration

#### 4.1 Flow Editor Integration

```typescript
// In FlowEditorProvider.tsx
const executeFlowDir = async (flowParameters: FlowDirParameters) => {
  try {
    dispatch({ type: 'SET_EXECUTING', payload: true });
    dispatch({ type: 'ADD_LOG', payload: 'Starting VLSI directory structure creation...' });
    
    const response = await fetch('/api/dir-create/execute-flowdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        mcpServerUrl: settings.mcpServerUrl,
        projectName: flowParameters.projectName,
        blockName: flowParameters.blockName,
        toolName: flowParameters.toolName,
        stage: flowParameters.stage,
        runName: flowParameters.runName,
        referenceRun: flowParameters.referenceRun,
        workingDirectory: settings.workingDirectory,
        centralScriptsDirectory: settings.centralScriptsDirectory
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      dispatch({ type: 'ADD_LOG', payload: `✅ Directory structure created successfully!` });
      dispatch({ type: 'ADD_LOG', payload: `📁 Created ${result.createdPaths.length} directories` });
      dispatch({ type: 'ADD_LOG', payload: `⏱️ Execution time: ${result.executionTime}ms` });
      
      // Display created paths
      result.createdPaths.forEach(path => {
        dispatch({ type: 'ADD_LOG', payload: `📂 ${path}` });
      });
      
      // Show summary
      if (result.summary) {
        dispatch({ type: 'ADD_LOG', payload: `🎯 Project: ${result.summary.project}` });
        dispatch({ type: 'ADD_LOG', payload: `🔧 Block: ${result.summary.block}` });
        dispatch({ type: 'ADD_LOG', payload: `🏃 Run: ${result.summary.run}` });
      }
    } else {
      dispatch({ type: 'ADD_LOG', payload: `❌ Error: ${result.error}` });
    }
    
  } catch (error) {
    dispatch({ type: 'ADD_LOG', payload: `❌ Network error: ${error.message}` });
  } finally {
    dispatch({ type: 'SET_EXECUTING', payload: false });
  }
};
```

#### 4.2 Flow Parameters Extraction

```typescript
interface FlowDirParameters {
  projectName: string;
  blockName: string;
  toolName: 'cadence' | 'synopsys';
  stage: string;
  runName: string;
  referenceRun?: string;
}

const extractFlowParameters = (nodes: Node[]): FlowDirParameters | null => {
  // Look for FlowDir node type
  const flowDirNode = nodes.find(node => node.type === 'flowdir');
  
  if (!flowDirNode) return null;
  
  return {
    projectName: flowDirNode.data.projectName || 'DefaultProject',
    blockName: flowDirNode.data.blockName || 'DefaultBlock',
    toolName: flowDirNode.data.toolName || 'cadence',
    stage: flowDirNode.data.stage || 'all',
    runName: flowDirNode.data.runName || `run-${Date.now()}`,
    referenceRun: flowDirNode.data.referenceRun || ''
  };
};
```

## 📋 Implementation Checklist

### Phase 1: Script Parameterization ✅
- [ ] Create `flowdir_parameterized.py` with CLI arguments
- [ ] Add argument parsing with `argparse`
- [ ] Replace all `input()` calls with parameter usage
- [ ] Test script with CLI arguments
- [ ] Validate against original script output

### Phase 2: Structured Logging ✅
- [ ] Add `log_action()` function for operations
- [ ] Add `log_progress()` function for progress tracking
- [ ] Add `log_summary()` function for final summary
- [ ] Replace all `os.system()` calls with logged versions
- [ ] Add error logging with `FLOWDIR_ERROR:` prefix

### Phase 3: Backend API ✅
- [ ] Enhance `dir-create-api/server.js` with new endpoint
- [ ] Implement `executeFlowdirViaPayload()` (primary strategy)
- [ ] Implement `executeFlowdirViaTransfer()` (fallback strategy)
- [ ] Add `injectParameters()` function
- [ ] Add `parseFlowdirOutput()` function
- [ ] Add comprehensive error handling

### Phase 4: Frontend Integration ✅
- [ ] Add FlowDir node type to Flow Editor
- [ ] Implement `extractFlowParameters()` function
- [ ] Add `executeFlowDir()` to FlowEditorProvider
- [ ] Connect with user settings for paths
- [ ] Add progress display and logging
- [ ] Add result visualization

### Phase 5: Testing & Validation ✅
- [ ] Unit tests for parameter injection
- [ ] Integration tests for remote execution
- [ ] End-to-end tests with Flow Editor
- [ ] Performance testing with large directory structures
- [ ] Error handling validation

## 🎯 Success Criteria

1. **✅ Functional**: Script creates identical directory structure as original
2. **✅ Remote**: Executes successfully on remote MCP server
3. **✅ Integrated**: Works seamlessly with Flow Editor UI
4. **✅ Configurable**: Uses user settings for paths and MCP server
5. **✅ Traceable**: Provides detailed logs and progress tracking
6. **✅ Robust**: Handles errors gracefully with fallback strategies

## 🚀 Next Steps

1. **Immediate**: Create parameterized version of flowdir.py
2. **Short-term**: Implement structured logging
3. **Medium-term**: Build backend API with dual execution strategies
4. **Long-term**: Full frontend integration and testing

---

*This plan provides a comprehensive roadmap for implementing remote VLSI directory structure creation through the Flow Editor interface, maintaining the robustness of the original script while adding modern web-based interaction capabilities.* 