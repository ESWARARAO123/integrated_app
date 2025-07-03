/**
 * MCP Orchestrator API Server
 * 
 * This server provides API endpoints for MCP orchestration,
 * running the Python orchestrator script within the container.
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

// Create Express app
const app = express();
const PORT = process.env.PORT || 3581;

// Configure middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json({ limit: '1mb' }));

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// List available tools endpoint
app.get('/tools', async (req, res) => {
  try {
    const serverUrl = req.query.server || process.env.MCP_SERVER_URL;
    
    if (!serverUrl) {
      return res.status(400).json({
        success: false,
        error: 'MCP server URL is required'
      });
    }
    
    const result = await listTools(serverUrl);
    res.json(result);
  } catch (error) {
    console.error('Error listing tools:', error);
    res.status(500).json({
      success: false,
      error: `Error listing tools: ${error.message}`
    });
  }
});

// Execute command endpoint
app.post('/execute', async (req, res) => {
  try {
    const { server, tool, parameters } = req.body;
    
    if (!server || !tool) {
      return res.status(400).json({
        success: false,
        error: 'Server URL and tool name are required'
      });
    }
    
    console.log(`Executing tool ${tool} on server ${server}`);
    console.log('Parameters:', JSON.stringify(parameters || {}));
    
    const result = await executeCommand(server, tool, parameters || {});
    res.json(result);
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({
      success: false,
      error: `Error executing command: ${error.message}`
    });
  }
});

/**
 * List available tools from MCP server
 * @param {string} serverUrl - MCP server URL
 * @returns {Promise<Object>} - List of available tools
 */
function listTools(serverUrl) {
  return new Promise((resolve, reject) => {
    const pythonScript = '/app/python/orchestrator.py';
    
    console.log(`Listing tools from server: ${serverUrl}`);
    
    const pythonProcess = spawn('python', [
      pythonScript,
      '--server', serverUrl,
      '--list'
    ]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`Python stderr: ${data.toString()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error(`stderr: ${stderr}`);
        return resolve({
          success: false,
          error: `Python execution failed with code ${code}: ${stderr}`
        });
      }
      
      try {
        // Extract the tools list from the output
        const toolsMatch = stdout.match(/Available MCP Tools:([\s\S]*)/);
        if (toolsMatch) {
          const toolsText = toolsMatch[1].trim();
          const toolsList = toolsText.split('\n').map(line => {
            const match = line.match(/- ([^:]+): (.*)/);
            if (match) {
              return {
                name: match[1].trim(),
                description: match[2].trim()
              };
            }
            return null;
          }).filter(Boolean);
          
          return resolve({
            success: true,
            tools: toolsList
          });
        }
        
        // If we can't parse the output, return the raw output
        return resolve({
          success: true,
          rawOutput: stdout
        });
      } catch (error) {
        console.error('Error parsing Python output:', error);
        return resolve({
          success: false,
          error: `Error parsing Python output: ${error.message}`,
          rawOutput: stdout.substring(0, 500)
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Error executing Python script:', error);
      reject(error);
    });
  });
}

/**
 * Execute MCP command using the Python orchestrator
 * @param {string} serverUrl - MCP server URL
 * @param {string} tool - Tool name to execute
 * @param {Object} parameters - Tool parameters
 * @returns {Promise<Object>} - Command execution result
 */
function executeCommand(serverUrl, tool, parameters) {
  return new Promise((resolve, reject) => {
    const pythonScript = '/app/python/orchestrator.py';
    
    console.log(`Executing command on server: ${serverUrl}`);
    console.log(`Tool: ${tool}`);
    console.log(`Parameters: ${JSON.stringify(parameters)}`);
    
    // Convert parameters to JSON string
    const parametersJson = JSON.stringify(parameters);
    
    const pythonProcess = spawn('python', [
      pythonScript,
      '--server', serverUrl,
      tool,
      parametersJson
    ]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`Python stderr: ${data.toString()}`);
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error(`stderr: ${stderr}`);
        return resolve({
          success: false,
          error: `Python execution failed with code ${code}: ${stderr}`
        });
      }
      
      try {
        // Try to parse JSON from the output
        const jsonStart = stdout.indexOf('{');
        if (jsonStart >= 0) {
          const jsonOutput = stdout.substring(jsonStart);
          const result = JSON.parse(jsonOutput);
          return resolve(result);
        }
        
        // If no JSON found, return the raw output
        return resolve({
          success: true,
          output: stdout
        });
      } catch (error) {
        console.error('Error parsing Python output:', error);
        return resolve({
          success: false,
          error: `Error parsing Python output: ${error.message}`,
          rawOutput: stdout.substring(0, 500)
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error('Error executing Python script:', error);
      reject(error);
    });
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`MCP Orchestrator API server running on port ${PORT}`);
}); 