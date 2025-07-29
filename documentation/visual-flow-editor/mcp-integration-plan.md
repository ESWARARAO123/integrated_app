# MCP Integration Plan for Visual Flow Editor

## 🎯 **Overview**

This document outlines how the Visual Flow Editor will integrate with the existing MCP (Model Context Protocol) infrastructure to execute Python scripts remotely. The integration leverages the current user-specific MCP server configurations and extends the MCP service to support script execution workflows.

## 🏗️ **Current MCP Architecture Analysis**

### **Existing MCP Components**

#### **1. MCP Database Tables**
```sql
-- User MCP Server Configurations
user_mcp_server_configurations (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    mcp_nickname VARCHAR(255),
    mcp_host VARCHAR(255),
    mcp_port INTEGER,
    is_default BOOLEAN,
    -- ... other fields
)

-- MCP Connections
mcp_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    mcp_host VARCHAR(100),
    mcp_port INTEGER,
    status VARCHAR(20),
    -- ... other fields
)
```

#### **2. MCP Services**
- **mcpService.js**: Core MCP connection and tool execution
- **mcpDBService.js**: Database operations for MCP configurations
- **WebSocket Integration**: Real-time communication with MCP servers

#### **3. MCP API Endpoints**
- `GET /api/mcp/server/config` - Get user MCP configurations
- `POST /api/mcp/server/config` - Create MCP configuration
- `POST /api/mcp/connect/:id` - Connect to MCP server
- `POST /api/mcp/execute` - Execute MCP tools

## 🔌 **Integration Strategy**

### **1. Extend MCP Service for Script Execution**

#### **New MCP Tool: Python Script Executor**
```typescript
interface PythonScriptExecutorTool {
  name: 'python_script_executor';
  description: 'Execute Python scripts with parameters';
  inputSchema: {
    type: 'object';
    properties: {
      script_path: { type: 'string' };
      parameters: { type: 'object' };
      working_directory: { type: 'string' };
      environment_variables: { type: 'object' };
      timeout: { type: 'number' };
    };
    required: ['script_path', 'parameters'];
  };
}
```

#### **Extended MCP Service Methods**
```javascript
// src/services/mcpService.js

/**
 * Execute Python script via MCP
 */
async function executePythonScript(serverId, scriptConfig) {
  const { script_path, parameters, working_directory, environment } = scriptConfig;
  
  // Prepare script execution payload
  const executionPayload = {
    tool_name: 'python_script_executor',
    arguments: {
      script_path,
      parameters: JSON.stringify(parameters),
      working_directory: working_directory || '/tmp',
      environment_variables: environment || {},
      timeout: 300 // 5 minutes default
    }
  };
  
  // Execute via existing MCP infrastructure
  return await executeTool(serverId, executionPayload);
}

/**
 * Stream script execution logs
 */
async function streamScriptExecution(serverId, executionId, callback) {
  const connection = connections.get(serverId);
  if (!connection || connection.status !== 'connected') {
    throw new Error('MCP server not connected');
  }
  
  // Set up SSE listener for execution logs
  connection.sse.addEventListener('execution_log', (event) => {
    const logData = JSON.parse(event.data);
    if (logData.execution_id === executionId) {
      callback(logData);
    }
  });
}
```

### **2. Flow Editor MCP Integration**

#### **Execution Method Selection**
```typescript
interface ExecutionMethod {
  type: 'mcp';
  server_id: string;
  server_name: string;
  host: string;
  port: number;
  status: 'connected' | 'disconnected' | 'error';
}

// Component: ExecutionMethodSelector
function ExecutionMethodSelector({ onSelect }: { onSelect: (method: ExecutionMethod) => void }) {
  const { data: mcpServers } = useQuery('user-mcp-servers', fetchUserMCPServers);
  
  return (
    <div className="execution-method-selector">
      <h3>Select Execution Method</h3>
      {mcpServers?.map(server => (
        <div key={server.id} className="mcp-server-option">
          <input
            type="radio"
            name="execution-method"
            value={server.id}
            onChange={() => onSelect({
              type: 'mcp',
              server_id: server.id,
              server_name: server.server_name,
              host: server.mcp_host,
              port: server.mcp_port,
              status: server.last_connection_status
            })}
          />
          <label>
            {server.server_name} ({server.mcp_host}:{server.mcp_port})
            <span className={`status ${server.last_connection_status}`}>
              {server.last_connection_status}
            </span>
          </label>
        </div>
      ))}
    </div>
  );
}
```

#### **Script Execution Flow**
```typescript
// services/flowEditorService.ts

export class FlowEditorExecutionService {
  async executeWorkflow(workflowId: string, executionMethod: ExecutionMethod): Promise<string> {
    // 1. Extract parameters from workflow canvas
    const workflow = await this.getWorkflow(workflowId);
    const parameters = this.extractParameters(workflow.canvas_data);
    
    // 2. Validate parameters
    const validation = this.validateParameters(parameters, workflow.script_template);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // 3. Prepare script execution configuration
    const scriptConfig = {
      script_path: this.getScriptPath(workflow.script_template),
      parameters: this.formatParameters(parameters),
      working_directory: `/tmp/floweditor/${workflowId}`,
      environment: {
        USER_ID: this.userId,
        WORKFLOW_ID: workflowId,
        EXECUTION_ID: uuidv4()
      }
    };
    
    // 4. Execute via MCP
    const executionResult = await mcpService.executePythonScript(
      executionMethod.server_id,
      scriptConfig
    );
    
    // 5. Store execution record
    await this.createExecutionRecord({
      workflow_id: workflowId,
      execution_method: 'mcp',
      mcp_server_id: executionMethod.server_id,
      input_parameters: parameters,
      status: 'running'
    });
    
    return executionResult.execution_id;
  }
  
  private extractParameters(canvasData: any): FlowDirParameters {
    const nodes = canvasData.nodes;
    
    return {
      project_name: this.getBlockValue(nodes, 'project-config', 'project_name'),
      block_name: this.getBlockValue(nodes, 'project-config', 'block_name'),
      user_name: this.getBlockValue(nodes, 'project-config', 'user_name'),
      tool_used: this.getBlockValue(nodes, 'tool-selection', 'selected_tool'),
      stage_in_flow: this.getBlockValue(nodes, 'flow-stage-selection', 'selected_stages').join(' '),
      pd_steps: this.getBlockValue(nodes, 'pd-steps-selection', 'selected_steps'),
      run_name: this.getBlockValue(nodes, 'run-configuration', 'run_name'),
      ref_run_path: this.getBlockValue(nodes, 'reference-run', 'ref_run_path') || ''
    };
  }
  
  private formatParameters(params: FlowDirParameters): string {
    // Format parameters as input stream for the Python script
    return [
      params.project_name,
      params.block_name,
      params.tool_used,
      params.stage_in_flow,
      ...(params.pd_steps || []),
      params.run_name,
      params.ref_run_path
    ].join('\n');
  }
}
```

### **3. Real-time Execution Monitoring**

#### **WebSocket Integration**
```javascript
// src/websocket/flowEditorSocket.js

const WebSocket = require('ws');
const { authenticateWebSocket } = require('./auth');

function setupFlowEditorWebSocket(server, sessionStore) {
  const wss = new WebSocket.Server({ 
    server,
    path: '/api/flow-editor/executions/ws'
  });
  
  wss.on('connection', async (ws, req) => {
    const userId = await authenticateWebSocket(req);
    if (!userId) {
      ws.close(1008, 'Authentication required');
      return;
    }
    
    ws.userId = userId;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        switch (data.type) {
          case 'subscribe_execution':
            await handleExecutionSubscription(ws, data.execution_id);
            break;
            
          case 'cancel_execution':
            await handleExecutionCancellation(ws, data.execution_id);
            break;
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message
        }));
      }
    });
  });
}

async function handleExecutionSubscription(ws, executionId) {
  // Verify user owns this execution
  const execution = await db.query(
    'SELECT * FROM workflow_executions WHERE id = ? AND user_id = ?',
    [executionId, ws.userId]
  );
  
  if (!execution.rows[0]) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Execution not found or access denied'
    }));
    return;
  }
  
  // Subscribe to MCP execution logs
  const mcpServerId = execution.rows[0].mcp_server_id;
  await mcpService.streamScriptExecution(mcpServerId, executionId, (logData) => {
    ws.send(JSON.stringify({
      type: 'execution_log',
      execution_id: executionId,
      timestamp: logData.timestamp,
      level: logData.level,
      message: logData.message
    }));
  });
}
```

#### **Frontend Real-time Updates**
```typescript
// hooks/useExecutionMonitor.ts

export function useExecutionMonitor(executionId: string) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [status, setStatus] = useState<ExecutionStatus>('pending');
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  useEffect(() => {
    if (!executionId) return;
    
    const websocket = new WebSocket(`/api/flow-editor/executions/ws`);
    
    websocket.onopen = () => {
      websocket.send(JSON.stringify({
        type: 'subscribe_execution',
        execution_id: executionId
      }));
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'execution_log':
          setLogs(prev => [...prev, {
            timestamp: data.timestamp,
            level: data.level,
            message: data.message
          }]);
          break;
          
        case 'execution_status':
          setStatus(data.status);
          break;
          
        case 'execution_complete':
          setStatus('completed');
          break;
          
        case 'execution_error':
          setStatus('error');
          break;
      }
    };
    
    setWs(websocket);
    
    return () => {
      websocket.close();
    };
  }, [executionId]);
  
  const cancelExecution = useCallback(() => {
    if (ws) {
      ws.send(JSON.stringify({
        type: 'cancel_execution',
        execution_id: executionId
      }));
    }
  }, [ws, executionId]);
  
  return { logs, status, cancelExecution };
}
```

### **4. MCP Server Requirements**

#### **Required MCP Tools**
```python
# MCP Server Implementation (Python)

class PythonScriptExecutorTool:
    def __init__(self):
        self.name = "python_script_executor"
        self.description = "Execute Python scripts with parameters"
    
    async def execute(self, arguments):
        script_path = arguments.get('script_path')
        parameters = json.loads(arguments.get('parameters', '{}'))
        working_dir = arguments.get('working_directory', '/tmp')
        env_vars = arguments.get('environment_variables', {})
        timeout = arguments.get('timeout', 300)
        
        # Create execution environment
        execution_id = str(uuid.uuid4())
        execution_dir = os.path.join(working_dir, execution_id)
        os.makedirs(execution_dir, exist_ok=True)
        
        # Prepare script execution
        env = os.environ.copy()
        env.update(env_vars)
        
        # Format parameters as stdin input
        stdin_input = self.format_parameters(parameters)
        
        # Execute script
        process = await asyncio.create_subprocess_exec(
            'python3', script_path,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=execution_dir,
            env=env
        )
        
        # Stream output in real-time
        await self.stream_output(process, execution_id)
        
        # Wait for completion
        return_code = await process.wait()
        
        return {
            'execution_id': execution_id,
            'return_code': return_code,
            'status': 'completed' if return_code == 0 else 'error'
        }
    
    def format_parameters(self, params):
        """Format parameters as input stream for flowdir.py"""
        return '\n'.join([
            params.get('project_name', ''),
            params.get('block_name', ''),
            params.get('tool_used', ''),
            params.get('stage_in_flow', ''),
            params.get('run_name', ''),
            params.get('ref_run_path', '')
        ])
    
    async def stream_output(self, process, execution_id):
        """Stream stdout/stderr to WebSocket clients"""
        async def read_stream(stream, level):
            while True:
                line = await stream.readline()
                if not line:
                    break
                
                # Emit log event
                await self.emit_log({
                    'execution_id': execution_id,
                    'timestamp': datetime.now().isoformat(),
                    'level': level,
                    'message': line.decode().strip()
                })
        
        # Read both stdout and stderr concurrently
        await asyncio.gather(
            read_stream(process.stdout, 'info'),
            read_stream(process.stderr, 'error')
        )
```

### **5. Error Handling & Recovery**

#### **Connection Failures**
```typescript
class MCPExecutionService {
  async executeWithRetry(serverId: string, scriptConfig: any, maxRetries = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check MCP server connection
        const serverStatus = await mcpService.getMCPStatus(serverId);
        if (serverStatus.status !== 'connected') {
          await mcpService.connectToMCP(serverId);
        }
        
        // Execute script
        return await mcpService.executePythonScript(serverId, scriptConfig);
        
      } catch (error) {
        console.error(`Execution attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          throw new Error(`Execution failed after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}
```

#### **Fallback Execution Methods**
```typescript
interface ExecutionFallback {
  primary: 'mcp';
  fallbacks: ['ssh', 'local'];
}

async function executeWithFallback(workflow: Workflow, methods: ExecutionFallback): Promise<string> {
  // Try primary method (MCP)
  try {
    return await executeMCP(workflow);
  } catch (mcpError) {
    console.warn('MCP execution failed, trying SSH fallback:', mcpError);
    
    // Try SSH fallback
    try {
      return await executeSSH(workflow);
    } catch (sshError) {
      console.warn('SSH execution failed, trying local fallback:', sshError);
      
      // Try local fallback (development only)
      return await executeLocal(workflow);
    }
  }
}
```

## 🔒 **Security Considerations**

### **User Isolation**
- All executions are isolated by user_id
- MCP server access is validated per user
- Execution directories are user-specific
- File permissions are properly managed

### **Input Validation**
- All script parameters are validated before execution
- Path traversal protection for script_path
- Environment variable sanitization
- Timeout limits to prevent resource abuse

### **Audit Trail**
- All executions are logged in workflow_executions table
- MCP server usage is tracked
- Error logs are preserved for debugging
- User actions are auditable

This integration plan provides a comprehensive approach to leveraging the existing MCP infrastructure for the Visual Flow Editor while maintaining security, performance, and user experience standards.
