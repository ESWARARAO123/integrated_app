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
    const pythonScript = '/app/python/terminal-mcp-orchestrator/orchestrator.py';
    
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
    const pythonScript = '/app/python/terminal-mcp-orchestrator/orchestrator.py';
    
    console.log(`Executing command on server: ${serverUrl}`);
    console.log(`Tool: ${tool}`);
    console.log(`Parameters: ${JSON.stringify(parameters)}`);
    
    // Convert parameters to JSON string and properly escape it
    const parametersJson = JSON.stringify(parameters);

    console.log(`Received parameters: ${JSON.stringify(parameters, null, 2)}`);
    console.log(`JSON string to send via stdin: ${parametersJson}`);

    // Use stdio to pass the JSON parameters instead of command line arguments
    // This avoids shell interpretation issues with special characters
    const pythonProcess = spawn('python', [
      pythonScript,
      '--server', serverUrl,
      tool,
      '--stdin'  // Signal to read parameters from stdin
    ], {
      stdio: ['pipe', 'pipe', 'pipe']  // Enable stdin pipe
    });
    
    let stdout = '';
    let stderr = '';

    // Send the JSON parameters via stdin
    pythonProcess.stdin.write(parametersJson);
    pythonProcess.stdin.end();

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
        // Look for the last line that might be JSON, or find JSON blocks
        const lines = stdout.trim().split('\n');
        let jsonResult = null;

        // Try to find JSON in the output (could be last line or embedded)
        // First try to find multi-line JSON blocks
        const jsonStartIndex = stdout.lastIndexOf('{');
        const jsonEndIndex = stdout.lastIndexOf('}');

        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          const jsonCandidate = stdout.substring(jsonStartIndex, jsonEndIndex + 1);
          try {
            jsonResult = JSON.parse(jsonCandidate);
          } catch (e) {
            // If multi-line JSON fails, try single lines
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{') || line.startsWith('[')) {
                try {
                  jsonResult = JSON.parse(line);
                  break;
                } catch (e) {
                  // Continue searching
                }
              }
            }
          }
        }

        // If we found JSON, return it
        if (jsonResult) {
          return resolve(jsonResult);
        }

        // Try to find JSON anywhere in the output
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonOutput = stdout.substring(jsonStart, jsonEnd + 1);
          try {
            const result = JSON.parse(jsonOutput);
            return resolve(result);
          } catch (e) {
            // Fall through to raw output handling
          }
        }

        // If no JSON found, check if the output looks like a simple result
        const outputLines = stdout.trim().split('\n');
        const lastLine = outputLines[outputLines.length - 1].trim();

        // Check if the last line is a simple result (number, short text, etc.)
        if (lastLine && !lastLine.includes('ERROR') && !lastLine.includes('Error') &&
            !lastLine.includes('Connecting') && !lastLine.includes('Executing') &&
            !lastLine.includes('Disconnected') && lastLine.length < 1000) {
          // If it's a simple output (like a number), treat it as success
          return resolve({
            success: true,
            output: lastLine,
            result: lastLine
          });
        }

        // If we have multiple lines, try to find the actual result
        const cleanOutput = stdout.trim();
        if (cleanOutput && !cleanOutput.includes('ERROR') && !cleanOutput.includes('Error')) {
          // Return the full output but mark it as potentially needing parsing
          return resolve({
            success: true,
            output: cleanOutput,
            result: lastLine || cleanOutput,
            rawOutput: cleanOutput
          });
        }

        // Return the raw output as an error case
        return resolve({
          success: false,
          error: 'No valid JSON output found',
          rawOutput: stdout.substring(0, 500)
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