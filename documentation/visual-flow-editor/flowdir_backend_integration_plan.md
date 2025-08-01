# FlowDir Backend Integration Plan

## Overview
Integration plan for `flowdir_parameterized.py` with the Flow Editor backend, enabling remote execution via MCP with Base64 payload strategy.

## Architecture Flow

```
Flow Editor (Frontend) 
    ↓ [User arranges flow & clicks run]
Parameter Extraction & Validation
    ↓ [Extract CLI parameters from flow nodes]
User Approval Interface
    ↓ [Show parameters to user for approval]
Backend API (/api/dir-create/execute-flowdir)
    ↓ [Receive approved parameters]
Script Injection & Base64 Encoding
    ↓ [Inject parameters + encode script]
MCP Remote Execution (runShellCommand)
    ↓ [Execute via python3 -c "import base64; exec(base64.b64decode('...'))")
Response Processing & Parsing
    ↓ [Parse structured logs]
Frontend Status Display
    ↓ [Show progress, paths, and results]
```

## Phase 1: Parameter Extraction & User Interface

### 1.1 Flow Node Parameter Extraction
**Location**: `client/src/components/FlowEditor/FlowEditorProvider.tsx`

**Task**: Create `extractFlowdirParameters()` function
```typescript
interface FlowdirParameters {
  projectName: string;
  blockName: string;
  toolName: 'cadence' | 'synopsys';
  stage: 'all' | 'Synthesis' | 'PD' | 'LEC' | 'STA';
  runName: string;
  referenceRun?: string;
  workingDirectory?: string;
  centralScripts?: string;
}

function extractFlowdirParameters(nodes: Node[]): FlowdirParameters | null {
  // Extract parameters from FlowDir node properties
  // Validate required fields
  // Apply user settings defaults for directories
}
```

### 1.2 Parameter Approval Modal
**Location**: `client/src/components/FlowEditor/FlowdirApprovalModal.tsx` (NEW)

**Features**:
- Display extracted parameters in a clean UI
- Allow user to modify parameters before execution
- Show working directory and central scripts from settings
- Validation and error handling
- "Execute" and "Cancel" buttons

## Phase 2: Backend API Enhancement

### 2.1 Enhanced API Endpoint
**Location**: `Docker/dir-create-api/server.js`

**Current**: Basic structure exists
**Enhancement**: 
```javascript
app.post('/execute-flowdir', async (req, res) => {
  const { parameters, mcpServerUrl, executionId } = req.body;
  
  try {
    // 1. Validate parameters
    // 2. Load flowdir_parameterized.py
    // 3. Inject parameters into script
    // 4. Convert to Base64
    // 5. Execute via runShellCommand
    // 6. Parse structured response
    // 7. Return processed results
  } catch (error) {
    // Error handling
  }
});
```

### 2.2 Parameter Injection Function
```javascript
function injectParameters(scriptContent, parameters) {
  // Replace CLI argument parsing with direct variable assignment
  const injectedScript = `
#!/usr/bin/env python3
# Auto-generated script with injected parameters
import os,getpass,json,time,sys
from os.path import join as pj 
import subprocess

# Injected parameters
class Args:
    project_name = "${parameters.projectName}"
    block_name = "${parameters.blockName}"
    tool_name = "${parameters.toolName}"
    stage = "${parameters.stage}"
    run_name = "${parameters.runName}"
    reference_run = "${parameters.referenceRun || ''}"
    working_directory = "${parameters.workingDirectory}"
    central_scripts = "${parameters.centralScripts}"

args = Args()

${scriptContent.replace('args = parser.parse_args()', '# Parameters injected above')}
  `;
  
  return injectedScript;
}
```

### 2.3 Base64 Execution Strategy
```javascript
async function executeViaBase64(mcpServerUrl, scriptContent, executionId) {
  const base64Script = Buffer.from(scriptContent).toString('base64');
  
  const command = `python3 -c "import base64; exec(base64.b64decode('${base64Script}').decode('utf-8'))"`;
  
  const response = await mcpRunShellCommand(mcpServerUrl, command, executionId);
  return response;
}
```

## Phase 3: Response Processing & Parsing

### 3.1 Structured Log Parser
```javascript
function parseFlowdirResponse(output) {
  const lines = output.split('\n');
  const result = {
    progress: [],
    directories: [],
    files: [],
    symlinks: [],
    errors: [],
    summary: {},
    status: 'unknown'
  };
  
  lines.forEach(line => {
    if (line.startsWith('FLOWDIR_PROGRESS:')) {
      const [, step, description] = line.split(':');
      result.progress.push({ step, description, timestamp: new Date() });
    }
    else if (line.startsWith('FLOWDIR_LOG:DIR_CREATED:SUCCESS:')) {
      const path = line.split(':').slice(3).join(':');
      result.directories.push(path);
    }
    else if (line.startsWith('FLOWDIR_SUMMARY:')) {
      const [, key, value] = line.split(':');
      result.summary[key.toLowerCase()] = value;
    }
    else if (line.startsWith('FLOWDIR_ERROR:')) {
      result.errors.push(line.substring(13));
    }
    else if (line.includes('COMPLETION:SUCCESS')) {
      result.status = 'success';
    }
  });
  
  return result;
}
```

### 3.2 Real-time Progress Updates
**WebSocket Integration** for live progress updates:
```javascript
// Backend: Emit progress events
io.emit(`flowdir-progress-${executionId}`, {
  step: currentStep,
  total: 10,
  description: progressDescription,
  timestamp: new Date()
});

// Frontend: Listen for progress
useEffect(() => {
  socket.on(`flowdir-progress-${executionId}`, (progress) => {
    setExecutionProgress(progress);
  });
}, [executionId]);
```

## Phase 4: Frontend Integration

### 4.1 Execution Flow in FlowEditorProvider
```typescript
const executeFlow = useCallback(async () => {
  try {
    // 1. Extract parameters from flow
    const parameters = extractFlowdirParameters(state.nodes);
    if (!parameters) {
      toast.error('No FlowDir node found or invalid parameters');
      return;
    }
    
    // 2. Show approval modal
    const approved = await showApprovalModal(parameters);
    if (!approved) return;
    
    // 3. Execute via API
    const response = await fetch('/api/dir-create/execute-flowdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parameters: approved.parameters,
        mcpServerUrl: approved.mcpServerUrl,
        executionId: generateExecutionId()
      })
    });
    
    // 4. Handle response
    const result = await response.json();
    if (result.success) {
      toast.success(`Created ${result.totalDirectories} directories successfully!`);
      setExecutionResults(result);
    } else {
      toast.error(`Execution failed: ${result.error}`);
    }
    
  } catch (error) {
    toast.error(`Execution error: ${error.message}`);
  }
}, [state.nodes]);
```

### 4.2 Results Display Component
**Location**: `client/src/components/FlowEditor/ExecutionResults.tsx` (NEW)

**Features**:
- Progress bar with current step
- Real-time log streaming
- Directory tree visualization
- File/symlink counters
- Error display
- Export results option

## Phase 5: Docker & Deployment

### 5.1 Enhanced Dockerfile
**Location**: `Docker/Dockerfile.dir-create-module`

**Enhancements**:
- Include `flowdir_parameterized.py`
- Ensure Python 3.9+ compatibility
- Add required dependencies
- Set proper working directory

### 5.2 Container Orchestration
```yaml
# docker-compose.yml enhancement
services:
  dir-create-api:
    build:
      context: .
      dockerfile: Docker/Dockerfile.dir-create-module
    ports:
      - "3582:3582"
    environment:
      - NODE_ENV=production
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

## Phase 6: Error Handling & Validation

### 6.1 Parameter Validation
- Required field validation
- Path existence checks
- MCP server connectivity
- Tool name validation
- Stage compatibility checks

### 6.2 Error Recovery
- Fallback to Script Transfer (Option 1) if Base64 fails
- Retry mechanism for network issues
- Graceful degradation for partial failures
- Cleanup on execution failures

## Phase 7: Testing & Quality Assurance

### 7.1 Test Scenarios
1. **Basic Execution**: All parameters, successful creation
2. **Error Handling**: Invalid parameters, network failures
3. **Large Projects**: Performance with complex directory structures
4. **Concurrent Executions**: Multiple users executing simultaneously
5. **MCP Connectivity**: Various MCP server configurations

### 7.2 Performance Monitoring
- Execution time tracking
- Memory usage monitoring
- Network latency measurement
- Error rate monitoring

## Implementation Timeline

### Week 1: Core Backend (Phase 2)
- [ ] Enhance API endpoint
- [ ] Implement parameter injection
- [ ] Add Base64 execution strategy
- [ ] Create response parser

### Week 2: Frontend Integration (Phase 1 & 4)
- [ ] Create parameter extraction function
- [ ] Build approval modal
- [ ] Integrate with FlowEditorProvider
- [ ] Create results display component

### Week 3: Advanced Features (Phase 3 & 5)
- [ ] Add WebSocket for real-time updates
- [ ] Enhance Docker configuration
- [ ] Implement error handling
- [ ] Add validation layers

### Week 4: Testing & Polish (Phase 6 & 7)
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Deployment preparation

## Success Metrics

1. **Execution Success Rate**: >95% successful executions
2. **Response Time**: <30 seconds for typical directory structures
3. **User Experience**: Smooth parameter approval flow
4. **Error Handling**: Clear error messages and recovery options
5. **Scalability**: Support for concurrent executions

## Next Steps

1. **Immediate**: Start with Phase 2.1 - Enhanced API endpoint
2. **Priority**: Parameter injection and Base64 execution
3. **Testing**: Validate against your working `flowdir_parameterized.py`
4. **Integration**: Connect with existing Flow Editor infrastructure

---

*This plan provides a comprehensive roadmap for integrating the parameterized FlowDir script with the Flow Editor backend, ensuring robust remote execution capabilities via MCP.* 