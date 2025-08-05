/**
 * DIR Create Module API Server
 * 
 * This server provides API endpoints for remote VLSI directory structure creation,
 * implementing the flowdir.py script execution via MCP with parameter injection.
 * 
 * Implements Option 1 from the analysis: Script Transfer + Execution
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3582;

// Configure Express settings for large requests (disable trust proxy to avoid rate limiting issues)
// app.set('trust proxy', true);

// Increase server timeout for large file operations
app.timeout = 300000; // 5 minutes

// Configure middleware
app.use(helmet());
app.use(compression());
// Enable CORS for cross-origin requests (needed for direct access and proxy)
app.use(cors({
  origin: ['http://localhost:5641', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Connection', 'Cache-Control'],
  credentials: true
}));
app.use(morgan('combined'));
// Increase body parser limits for large config files and set timeout
app.use(bodyParser.json({ 
  limit: '50mb',
  parameterLimit: 50000,
  type: 'application/json'
}));
app.use(bodyParser.urlencoded({ 
  limit: '50mb', 
  extended: true,
  parameterLimit: 50000
}));
app.use(bodyParser.text({ limit: '50mb' }));
app.use(bodyParser.raw({ limit: '50mb' }));

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Add timeout middleware for large requests
app.use((req, res, next) => {
  // Set longer timeout for PUT requests (file saves)
  if (req.method === 'PUT' && req.url.includes('/api/config-file')) {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000); // 5 minutes
    console.log(`⏱️ Extended timeout set for file save request: ${req.url}`);
  }
  next();
});

// Add error handler for body parsing issues
app.use((error, req, res, next) => {
  if (error.type === 'request.aborted') {
    console.error('❌ Request aborted during body parsing:', {
      url: req.url,
      method: req.method,
      contentLength: req.headers['content-length'],
      error: error.message,
      code: error.code
    });
    return res.status(400).json({
      success: false,
      error: 'Request aborted during body parsing',
      details: 'The request body was too large or the connection was interrupted'
    });
  }
  next(error);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'dir-create-module',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Config File Operations API Endpoints
 * These endpoints provide file read/write operations via MCP for the visual flow editor
 */

// Read config file content via MCP
app.get('/api/config-file', async (req, res) => {
  try {
    const { filePath, serverUrl } = req.query;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath parameter is required'
      });
    }

    if (!serverUrl) {
      return res.status(400).json({
        success: false,
        error: 'serverUrl parameter is required'
      });
    }

    console.log(`📖 Reading config file: ${filePath}`);

    // Execute MCP readFile command via orchestrator
    const result = await executeMCPCommand(serverUrl, 'readFile', {
      filePath: filePath
    });

    if (result.success) {
      // Extract text content from MCP response
      let fileContent = '';
      if (result.data && typeof result.data === 'object' && result.data.text) {
        fileContent = result.data.text;
      } else if (typeof result.data === 'string') {
        fileContent = result.data;
      } else {
        fileContent = result.data?.content || '';
      }

      res.json({
        success: true,
        content: fileContent,
        filePath: filePath,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to read file',
        filePath: filePath
      });
    }

  } catch (error) {
    console.error('Error reading config file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      filePath: req.query.filePath
    });
  }
});

// Write config file content via MCP
app.put('/api/config-file', async (req, res) => {
  try {
    console.log(`📥 PUT request received - Content-Length: ${req.headers['content-length']}`);
    console.log(`📥 Request body keys:`, Object.keys(req.body || {}));
    
    const { filePath, content, serverUrl } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required in request body'
      });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({
        success: false,
        error: 'content is required in request body'
      });
    }

    if (!serverUrl) {
      return res.status(400).json({
        success: false,
        error: 'serverUrl is required in request body'
      });
    }

    console.log(`✏️ Writing config file: ${filePath}`);
    console.log(`📊 Content length: ${content.length} characters`);

    // Use shell command approach instead of editFile MCP tool
    // This is more reliable and doesn't maintain persistent connections
    const result = await writeFileViaShellCommand(serverUrl, filePath, content);

    if (result.success) {
      res.json({
        success: true,
        message: 'File saved successfully',
        filePath: filePath,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to write file',
        filePath: filePath
      });
    }

  } catch (error) {
    console.error('❌ Error writing config file:', error);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error code:', error.code);
    console.error('❌ Request body available:', !!req.body);
    console.error('❌ Request body keys:', req.body ? Object.keys(req.body) : 'none');
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      errorType: error.constructor.name,
      errorCode: error.code,
      filePath: req.body?.filePath || 'unknown'
    });
  }
});

// Replace specific lines in config file (more efficient for small changes)
app.patch('/api/config-file', async (req, res) => {
  try {
    console.log(`🔄 PATCH request received for line replacement`);
    console.log(`📥 Request body keys:`, Object.keys(req.body || {}));
    
    const { filePath, replacements, serverUrl } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required in request body'
      });
    }

    if (!replacements || !Array.isArray(replacements) || replacements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'replacements array is required in request body'
      });
    }

    if (!serverUrl) {
      return res.status(400).json({
        success: false,
        error: 'serverUrl is required in request body'
      });
    }

    console.log(`🔄 Replacing lines in config file: ${filePath}`);
    console.log(`📊 Number of replacements: ${replacements.length}`);

    // Use sed command approach for line replacements
    const result = await replaceFileLines(serverUrl, filePath, replacements);

    if (result.success) {
      res.json({
        success: true,
        message: 'Lines replaced successfully',
        method: result.method,
        filePath: filePath,
        replacements: replacements.length,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to replace lines',
        method: result.method,
        filePath: filePath
      });
    }

  } catch (error) {
    console.error('❌ Error replacing lines in config file:', error);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error code:', error.code);
    console.error('❌ Request body available:', !!req.body);
    console.error('❌ Request body keys:', req.body ? Object.keys(req.body) : 'none');
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      errorType: error.constructor.name,
      errorCode: error.code,
      filePath: req.body?.filePath || 'unknown'
    });
  }
});

// Service info endpoint
app.get('/info', (req, res) => {
  res.status(200).json({
    name: 'DIR Create Module API',
    version: '1.0.0',
    description: 'Remote VLSI directory structure creation service',
    capabilities: [
      'flowdir.py remote execution',
      'parameter injection',
      'MCP integration',
      'VLSI workflow automation'
    ]
  });
});

/**
 * Execute flowdir script with remote directory creation
 * POST /execute-flowdir
 * Enhanced with new parameter structure and Base64 execution
 * 
 * Body:
 * {
 *   "mcpServerUrl": "http://172.28.142.23:8080",
 *   "projectName": "Bigendian",
 *   "blockName": "Top_encoder_01",
 *   "toolName": "cadence",
 *   "stage": "all",
 *   "runName": "run-yaswanth-01",
 *   "pdSteps": "all",
 *   "referenceRun": "",
 *   "workingDirectory": "/mnt/projects_107/vasu_backend",
 *   "centralScriptsDirectory": "/mnt/projects_107/vasu_backend/flow/central_scripts"
 * }
 */
app.post('/execute-flowdir', async (req, res) => {
  const executionId = uuidv4();
  const startTime = Date.now();
  
  console.log(`\n=== NEW FLOWDIR REQUEST ${executionId} ===`);
  console.log('Request from:', req.ip);
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('Content-Length:', req.headers['content-length']);
  
  try {
    const { 
      mcpServerUrl, 
      projectName,
      blockName,
      toolName,
      stage,
      runName,
      pdSteps,
      referenceRun,
      workingDirectory,
      centralScriptsDirectory 
    } = req.body;
    
    // Validate required parameters
    if (!mcpServerUrl) {
      return res.status(400).json({
        success: false,
        error: 'MCP server URL is required'
      });
    }
    
    const requiredParams = ['projectName', 'blockName', 'toolName', 'stage', 'runName'];
    const missing = requiredParams.filter(param => !req.body[param]);
    
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required parameters: ${missing.join(', ')}`
      });
    }
    
    // Build parameters object for the script
    const parameters = {
      projectName,
      blockName,
      toolName,
      stage,
      runName,
      pdSteps: pdSteps || (stage === 'PD' ? 'all' : ''),
      referenceRun: referenceRun || '',
      workingDirectory: workingDirectory || '/mnt/projects_107/vasu_backend',
      centralScriptsDirectory: centralScriptsDirectory || '/mnt/projects_107/vasu_backend/flow/central_scripts'
    };
    
    console.log(`Starting flowdir execution ${executionId}`);
    console.log(`Parameters:`, JSON.stringify(parameters, null, 2));
    
    // Execute the flowdir script remotely using Base64 strategy (primary) with fallback
    const result = await executeFlowdirWithFallback(mcpServerUrl, parameters, executionId);
    
    const executionTime = Date.now() - startTime;
    
    console.log(`=== FLOWDIR RESPONSE ${executionId} ===`);
    console.log(`Execution time: ${executionTime}ms`);
    console.log(`Success: ${result.success}`);
    console.log(`Summary:`, JSON.stringify(result.summary, null, 2));
    console.log(`Created paths count: ${result.createdPaths?.length || 0}`);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        executionId,
        executionTime,
        message: 'FlowDir execution completed successfully',
        data: result.data,
        logs: result.logs,
        createdPaths: result.createdPaths,
        summary: result.summary
      });
      console.log(`Response sent successfully for ${executionId}`);
    } else {
      res.status(500).json({
        success: false,
        executionId,
        executionTime,
        error: result.error,
        logs: result.logs
      });
    }
    
  } catch (error) {
    console.error(`Error in flowdir execution ${executionId}:`, error);
    res.status(500).json({
      success: false,
      executionId,
      error: error.message
    });
  }
});

/**
 * Get execution status
 * GET /execution/:id/status
 */
app.get('/execution/:id/status', (req, res) => {
  // For now, return a simple status
  // In production, you'd want to track execution status in a database
  res.status(200).json({
    executionId: req.params.id,
    status: 'completed', // This would be dynamic in real implementation
    timestamp: new Date().toISOString()
  });
});

/**
 * Execute flowdir.py remotely with fallback strategy
 * Primary: Base64 Payload Execution (Option 2)
 * Fallback: Script Transfer + Execution (Option 1)
 */
async function executeFlowdirWithFallback(mcpServerUrl, parameters, executionId) {
  console.log(`Attempting Base64 execution for ${executionId}`);
  
  try {
    // Try Base64 execution first (Option 2)
    const result = await executeFlowdirViaBase64(mcpServerUrl, parameters, executionId);
    console.log(`Base64 execution successful for ${executionId}`);
    return result;
  } catch (error) {
    console.log(`Base64 execution failed for ${executionId}: ${error.message}`);
    console.log(`Falling back to script transfer method...`);
    
    try {
      // Fallback to script transfer (Option 1)
      const result = await executeFlowdirViaTransfer(mcpServerUrl, parameters, executionId);
      console.log(`Transfer execution successful for ${executionId}`);
      return result;
    } catch (fallbackError) {
      console.error(`Both execution methods failed for ${executionId}`);
      return {
        success: false,
        error: `Both execution methods failed. Base64: ${error.message}. Transfer: ${fallbackError.message}`,
        logs: [`Base64 failed: ${error.message}`, `Transfer failed: ${fallbackError.message}`]
      };
    }
  }
}

/**
 * Execute flowdir.py via Base64 payload (Option 2 - Primary Strategy)
 * Encodes the script as Base64 and executes via runShellCommand
 */
async function executeFlowdirViaBase64(mcpServerUrl, parameters, executionId) {
  const logs = [];
  
  try {
    // Step 1: Read and modify the script
    const originalScript = await fs.readFile('/app/python/DIR_CREATE_MODULE/flowdir_parameterized.py', 'utf8');
    const modifiedScript = injectParametersForBase64(originalScript, parameters);
    
    logs.push('Script modified with injected parameters');
    
    // Step 2: Convert to base64
    const base64Script = Buffer.from(modifiedScript).toString('base64');
    logs.push('Script encoded to Base64');
    
    // Step 3: Build the execution command
    const command = `echo "${base64Script}" | base64 -d | python3 -`;
    
    logs.push('Executing flowdir script via Base64 payload...');
    console.log(`Base64 command length: ${command.length} characters`);
    
    // Step 4: Execute via runShellCommand
    const executionResult = await mcpRunShellCommand(mcpServerUrl, command);
    
    if (executionResult.success) {
      logs.push('Base64 execution completed successfully');
      
      // Debug: Log the raw stdout data
      console.log(`Raw stdout length: ${(executionResult.stdout || '').length} characters`);
      console.log(`Raw stdout first 500 chars:`, (executionResult.stdout || '').substring(0, 500));
      console.log(`Raw stdout contains TOTAL_DIRS:`, (executionResult.stdout || '').includes('TOTAL_DIRS'));
      
      // Try to find the actual Python script output within the orchestrator response
      let actualPythonOutput = executionResult.stdout || '';
      
      // Look for the JSON structure that contains the Python script output
      // The JSON might be split across multiple lines, so we need to reconstruct it
      const lines = actualPythonOutput.split('\n');
      console.log(`Total lines in stdout: ${lines.length}`);
      
      let jsonStartIndex = -1;
      let jsonEndIndex = -1;
      
      // Find the start and end of the JSON object
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '{' && jsonStartIndex === -1) {
          jsonStartIndex = i;
          console.log(`JSON starts at line ${i}`);
        }
        if (line === '}' && jsonStartIndex !== -1) {
          jsonEndIndex = i;
          console.log(`JSON ends at line ${i}`);
          break;
        }
      }
      
      if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
        // Reconstruct the complete JSON object
        const jsonLines = lines.slice(jsonStartIndex, jsonEndIndex + 1);
        const completeJson = jsonLines.join('\n');
        console.log(`Complete JSON length: ${completeJson.length}`);
        console.log(`Complete JSON first 200 chars:`, completeJson.substring(0, 200));
        
        try {
          const jsonData = JSON.parse(completeJson);
          console.log(`Successfully parsed complete JSON, keys:`, Object.keys(jsonData));
          if (jsonData.text && jsonData.text.includes('FLOWDIR_')) {
            actualPythonOutput = jsonData.text;
            console.log(`Found Python output in JSON, length: ${actualPythonOutput.length}`);
          } else {
            console.log(`JSON parsed but no FLOWDIR_ content found in text field`);
          }
        } catch (e) {
          console.log(`Failed to parse complete JSON:`, e.message);
        }
      } else {
        console.log(`Could not find complete JSON object boundaries`);
      }
      
      const parsedOutput = parseFlowdirOutput(actualPythonOutput);
      
      return {
        success: true,
        data: parsedOutput,
        logs: [...logs, ...parsedOutput.logs],
        createdPaths: parsedOutput.createdPaths,
        summary: parsedOutput.summary
      };
    } else {
      throw new Error(executionResult.error || 'Base64 execution failed');
    }
    
  } catch (error) {
    logs.push(`Base64 execution failed: ${error.message}`);
    throw error;
  }
}

/**
 * Execute flowdir.py remotely using MCP (Option 1 - Fallback Strategy)
 * Implements Script Transfer + Execution
 */
async function executeFlowdirViaTransfer(mcpServerUrl, parameters, executionId) {
  const logs = [];
  
  try {
    // Step 1: Read the original flowdir.py script
    const originalScript = await fs.readFile('/app/python/DIR_CREATE_MODULE/flowdir.py', 'utf8');
    
    // Step 2: Create modified script with parameter injection
    const modifiedScript = injectParameters(originalScript, parameters, workingDirectory);
    
    // Step 3: Generate unique filename for remote execution
    const remoteScriptPath = `/tmp/flowdir_${executionId}.py`;
    
    // Step 4: Transfer script to remote server
    logs.push('Transferring modified script to remote server...');
    const transferResult = await mcpCreateFile(mcpServerUrl, remoteScriptPath, modifiedScript);
    
    if (!transferResult.success) {
      return {
        success: false,
        error: 'Failed to transfer script to remote server',
        logs
      };
    }
    
    logs.push('Script transferred successfully');
    
    // Step 5: Execute the script remotely
    logs.push('Executing flowdir script on remote server...');
    const executionResult = await mcpRunPythonFile(mcpServerUrl, remoteScriptPath);
    
    // Step 6: Cleanup - delete the temporary script
    logs.push('Cleaning up temporary files...');
    await mcpDeleteFile(mcpServerUrl, remoteScriptPath);
    
    if (executionResult.success) {
      logs.push('Flowdir execution completed successfully');
      return {
        success: true,
        data: executionResult.data,
        logs
      };
    } else {
      return {
        success: false,
        error: executionResult.error,
        logs
      };
    }
    
  } catch (error) {
    logs.push(`Error during execution: ${error.message}`);
    return {
      success: false,
      error: error.message,
      logs
    };
  }
}

/**
 * Inject parameters for Base64 execution (Option 2 - Simple sys.argv replacement)
 * This approach directly modifies sys.argv in the script, matching our successful manual test
 */
function injectParametersForBase64(originalScript, parameters) {
  // Build CLI arguments array
  const cliArgs = [
    'flowdir_parameterized.py',
    '--project-name', parameters.projectName,
    '--block-name', parameters.blockName,
    '--tool-name', parameters.toolName,
    '--stage', parameters.stage,
    '--run-name', parameters.runName
  ];
  
  if (parameters.pdSteps) {
    cliArgs.push('--pd-steps', parameters.pdSteps);
  }
  
  if (parameters.referenceRun) {
    cliArgs.push('--reference-run', parameters.referenceRun);
  }
  
  if (parameters.workingDirectory) {
    cliArgs.push('--working-directory', parameters.workingDirectory);
  }
  
  if (parameters.centralScriptsDirectory) {
    cliArgs.push('--central-scripts', parameters.centralScriptsDirectory);
  }
  
  // Create a modified script that injects sys.argv before parsing
  const modifiedScript = `#!/usr/bin/env python3
import sys

# INJECTED PARAMETERS - Replace sys.argv with actual values
sys.argv = ${JSON.stringify(cliArgs)}

# Execute the flowdir script content directly
${originalScript}
`;

  return modifiedScript;
}

/**
 * Inject parameters into flowdir.py script, replacing interactive inputs (Option 1 - Legacy)
 */
function injectParameters(originalScript, parameters, workingDirectory) {
  let modifiedScript = originalScript;
  
  // Replace the working directory change
  if (workingDirectory) {
    modifiedScript = modifiedScript.replace(
      /os\.chdir\('.*?'\)/,
      `os.chdir('${workingDirectory}')`
    );
  }
  
  // Create a parameter injection function
  const parameterInjection = `
# Parameter injection - replacing interactive inputs
def get_injected_parameters():
    return {
        'project_name': '${parameters.project_name}',
        'block_name': '${parameters.block_name}',
        'tool_used': '${parameters.tool_used}',
        'stage_in_flow': '${parameters.stage_in_flow}',
        'pd_steps': '${parameters.pd_steps || 'all'}',
        'run_name': '${parameters.run_name}',
        'ref_run_path': '${parameters.ref_run_path || ''}'
    }

injected_params = get_injected_parameters()
`;
  
  // Add parameter injection at the top
  modifiedScript = parameterInjection + modifiedScript;
  
  // Replace the get_user_input function with parameter injection
  const newGetUserInput = `
def get_user_input():
    # Use injected parameters instead of interactive input
    pname = injected_params['project_name']
    block_name = injected_params['block_name']
    user_name = getpass.getuser()
    tool_used = injected_params['tool_used']
    stage_in_flow = injected_params['stage_in_flow']
    run = injected_params['run_name']
    runlink = injected_params['ref_run_path']
    
    # Process stage_in_flow logic
    steps = ''
    if stage_in_flow == 'PD':
        flowsc = [stage_in_flow]
        pd_steps_param = injected_params.get('pd_steps', 'all')
        if pd_steps_param == 'all':
            steps = "Floorplan Place CTS Route".split(' ')
        else:
            steps = pd_steps_param.replace('all','').replace('  ',' ').split(' ')
    elif stage_in_flow == 'Synthesis':
        flowsc = ['SYNTH']
    elif stage_in_flow == 'all':
        flowsc = ['SYNTH','PD','LEC','STA']
        steps = ['Floorplan', 'Place', 'CTS', 'Route']
    else:
        flowsc = [item for item in stage_in_flow.replace('all','').replace('Synthesis','SYNTH').split(' ') if item.strip()]
    
    # Check for existing runs
    for flwext in flowsc:
        c = subprocess.check_output(f'find {pj(pname,rtlv,block_name,flwext,user_name)} -maxdepth 1 -type d -name "run_{tool_used}_{run}" | wc -l', shell=True, stderr=subprocess.DEVNULL)
        if int(c.strip()) != 0:
            print(f"directory {pj(pname,rtlv,block_name,flwext,user_name,f'run_{tool_used}_{run}')} already found")
            # In automated mode, we might want to handle this differently
            # For now, continue execution
    
    # Handle reference run
    exists = 0
    namess = ''
    ref_flowsc = ''
    
    if runlink:
        ref_run_parts = runlink.split("/")
        kkk = [item for item in ref_run_parts if item and item.strip()]
        if len(kkk) >= 6:
            pname = kkk[-6]
            block_name = kkk[-4]
            ref_flowsc = kkk[-3].split(',')
            namess = kkk[-2]
            runlink = kkk[-1]
            exists = 1
    
    return tool_used, pname, block_name, user_name, flowsc, run, steps, runlink, exists, namess, ref_flowsc
`;
  
  // Replace the original get_user_input function
  modifiedScript = modifiedScript.replace(
    /def get_user_input\(\):[\s\S]*?return.*?tool_used.*?,.*?pname.*?,.*?block_name.*?,.*?user_name.*?,.*?flowsc.*?,.*?run.*?,.*?steps.*?,.*?runlink.*?,.*?exists.*?,.*?namess.*?,.*?ref_flowsc/,
    newGetUserInput.trim()
  );
  
  return modifiedScript;
}

/**
 * MCP Helper Functions
 */

/**
 * Generic MCP command executor
 * Executes any MCP tool via the orchestrator.py script
 */
async function executeMCPCommand(serverUrl, toolName, parameters) {
  return new Promise((resolve) => {
    const pythonScript = '/app/python/DIR_CREATE_MODULE/orchestrator.py';
    const parametersJson = JSON.stringify(parameters);

    console.log(`🔧 Executing MCP command: ${toolName} with params:`, parameters);

    const pythonProcess = spawn('python', [
      pythonScript,
      '--server', serverUrl,
      toolName,
      parametersJson
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      console.log(`📋 MCP command ${toolName} completed with code: ${code}`);
      console.log(`📤 stdout:`, stdout);
      if (stderr) console.log(`❌ stderr:`, stderr);

      if (code === 0) {
        try {
          // Try to parse JSON response
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            resolve({ success: true, data: result });
          } else {
            // Return raw stdout if not JSON
            resolve({ success: true, data: stdout.trim() });
          }
        } catch (parseError) {
          // If JSON parsing fails, return raw stdout
          resolve({ success: true, data: stdout.trim() });
        }
      } else {
        resolve({
          success: false,
          error: stderr || `Command failed with exit code ${code}`
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`❌ Failed to start MCP command ${toolName}:`, error);
      resolve({
        success: false,
        error: `Failed to execute command: ${error.message}`
      });
    });
  });
}

async function mcpCreateFile(serverUrl, filePath, content) {
  return new Promise((resolve) => {
    const pythonScript = '/app/python/DIR_CREATE_MODULE/orchestrator.py';
    const parameters = JSON.stringify({ filePath, content, overwrite: true });
    
    const pythonProcess = spawn('python', [
      pythonScript,
      '--server', serverUrl,
      'createFile',
      parameters
    ]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, data: stdout });
      } else {
        resolve({ success: false, error: stderr });
      }
    });
  });
}

async function mcpRunPythonFile(serverUrl, filePath) {
  return new Promise((resolve) => {
    const pythonScript = '/app/python/DIR_CREATE_MODULE/orchestrator.py';
    const parameters = JSON.stringify({ filePath });
    
    const pythonProcess = spawn('python', [
      pythonScript,
      '--server', serverUrl,
      'runPythonFile',
      parameters
    ]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, data: stdout });
      } else {
        resolve({ success: false, error: stderr });
      }
    });
  });
}

async function mcpDeleteFile(serverUrl, filePath) {
  return new Promise((resolve) => {
    const pythonScript = '/app/python/DIR_CREATE_MODULE/orchestrator.py';
    const parameters = JSON.stringify({ filePath });
    
    const pythonProcess = spawn('python', [
      pythonScript,
      '--server', serverUrl,
      'deleteFile',
      parameters
    ]);
    
    pythonProcess.on('close', (code) => {
      resolve({ success: code === 0 });
    });
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

/**
 * Parse FlowDir structured output logs
 */
function parseFlowdirOutput(stdout) {
  const logs = [];
  const createdPaths = [];
  const summary = {};
  const errors = [];
  
  const lines = stdout.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('FLOWDIR_LOG:')) {
      const [, actionType, status, ...pathParts] = line.split(':');
      const path = pathParts.join(':'); // Rejoin in case path contains colons
      logs.push({ 
        type: 'action',
        actionType, 
        status, 
        path, 
        timestamp: new Date().toISOString() 
      });
      
      if (status === 'SUCCESS' && actionType === 'DIR_CREATED') {
        createdPaths.push(path);
      }
    } else if (line.startsWith('FLOWDIR_PROGRESS:')) {
      const [, progress, ...descParts] = line.split(':');
      const description = descParts.join(':');
      logs.push({ 
        type: 'progress', 
        progress, 
        description, 
        timestamp: new Date().toISOString() 
      });
    } else if (line.startsWith('FLOWDIR_SUMMARY:')) {
      const [, key, ...valueParts] = line.split(':');
      const value = valueParts.join(':');
      summary[key.toLowerCase()] = value;
    } else if (line.startsWith('FLOWDIR_ERROR:')) {
      const error = line.substring('FLOWDIR_ERROR:'.length);
      errors.push(error);
      logs.push({ 
        type: 'error', 
        message: error, 
        timestamp: new Date().toISOString() 
      });
    } else if (line.trim()) {
      // Regular output
      logs.push({ 
        type: 'output', 
        message: line, 
        timestamp: new Date().toISOString() 
      });
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

/**
 * Execute shell command via MCP runShellCommand
 */
/**
 * Write file content using shell commands instead of editFile MCP tool
 * This approach is more reliable and doesn't maintain persistent connections
 */
async function writeFileViaShellCommand(serverUrl, filePath, content) {
  try {
    console.log(`🐚 Writing file via shell command: ${filePath}`);
    
    // Escape the content for shell command
    // Use a here-document approach to handle special characters safely
    const tempMarker = `EOF_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create the shell command using cat with here-document
    const shellCommand = `cat > "${filePath}" << '${tempMarker}'
${content}
${tempMarker}`;

    console.log(`🐚 Shell command length: ${shellCommand.length} characters`);
    console.log(`🐚 Using temp marker: ${tempMarker}`);

    // Execute the shell command via MCP
    const result = await mcpRunShellCommand(serverUrl, shellCommand);
    
    if (result.success) {
      console.log(`✅ File written successfully via shell command`);
      return {
        success: true,
        message: 'File written successfully using shell command',
        method: 'shell_command',
        filePath: filePath
      };
    } else {
      console.error(`❌ Shell command failed:`, result.error);
      return {
        success: false,
        error: result.error || 'Shell command execution failed',
        method: 'shell_command'
      };
    }
  } catch (error) {
    console.error(`❌ Error in writeFileViaShellCommand:`, error);
    return {
      success: false,
      error: error.message || 'Failed to write file via shell command',
      method: 'shell_command'
    };
  }
}

/**
 * Alternative: Replace specific lines in a file using sed commands
 * More efficient for small changes
 */
async function replaceFileLines(serverUrl, filePath, replacements) {
  try {
    console.log(`🔄 Replacing lines in file: ${filePath}`);
    console.log(`🔄 Replacements:`, replacements);

    // Build sed command for multiple replacements
    let sedCommand = `sed -i`;
    
    for (const replacement of replacements) {
      const { lineNumber, newContent } = replacement;
      // Escape special characters in the content
      const escapedContent = newContent.replace(/[\/&]/g, '\\$&').replace(/\n/g, '\\n');
      sedCommand += ` -e '${lineNumber}s/.*/${escapedContent}/'`;
    }
    
    sedCommand += ` "${filePath}"`;

    console.log(`🔄 Sed command: ${sedCommand}`);

    // Execute the sed command via MCP
    const result = await mcpRunShellCommand(serverUrl, sedCommand);
    
    if (result.success) {
      console.log(`✅ Lines replaced successfully via sed`);
      return {
        success: true,
        message: 'Lines replaced successfully using sed',
        method: 'sed_replace',
        filePath: filePath,
        replacements: replacements.length
      };
    } else {
      console.error(`❌ Sed command failed:`, result.error);
      return {
        success: false,
        error: result.error || 'Sed command execution failed',
        method: 'sed_replace'
      };
    }
  } catch (error) {
    console.error(`❌ Error in replaceFileLines:`, error);
    return {
      success: false,
      error: error.message || 'Failed to replace lines via sed',
      method: 'sed_replace'
    };
  }
}

async function mcpRunShellCommand(mcpServerUrl, command) {
  return new Promise((resolve, reject) => {
    console.log(`🔗 Creating NEW MCP connection for shell command`);
    console.log(`🎯 MCP Server: ${mcpServerUrl}`);
    console.log(`🐚 Command: ${command.substring(0, 100)}...`);
    
    const orchestratorProcess = spawn('python3', [
      '/app/python/DIR_CREATE_MODULE/orchestrator.py',
      '--server', mcpServerUrl,
      'runShellCommand',
      JSON.stringify({ command })
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    orchestratorProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    orchestratorProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    orchestratorProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          // The MCP response contains the output in the 'text' field, not 'stdout'
          resolve({
            success: true,
            stdout: result.text || result.stdout || '',
            stderr: result.stderr || ''
          });
        } catch (parseError) {
          resolve({
            success: true,
            stdout: stdout,
            stderr: stderr
          });
        }
      } else {
        reject(new Error(`Shell command execution failed with code ${code}: ${stderr}`));
      }
    });

    orchestratorProcess.on('error', (error) => {
      reject(new Error(`Failed to spawn orchestrator process: ${error.message}`));
    });
  });
}

// Start server with proper timeout configuration
const server = app.listen(PORT, () => {
  console.log(`DIR Create Module API Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Service info: http://localhost:${PORT}/info`);
});

// Set server timeouts to handle large requests
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000; // 5 minutes
server.headersTimeout = 310000; // Slightly longer than keepAliveTimeout 