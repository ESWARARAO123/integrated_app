const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * Service for executing shell commands via MCP orchestrator
 * Supports both containerized service and local Python execution
 */
class ShellCommandService {
  constructor() {
    // Get Python interpreter path from config and normalize for current OS
    const config = require('../utils/config');
    const configPythonPath = config.get('python.interpreter') || 'python';
    
    // Handle Windows path separators in config
    this.pythonInterpreter = configPythonPath.replace(/\\/g, path.sep);
    
    // Path to the Python orchestrator (relative to project root)
    this.orchestratorPath = path.join(__dirname, '../../python/terminal-mcp-orchestrator/orchestrator.py');
    
    // Read configuration from config.ini
    const mcpConfig = config.getSection('mcp_orchestrator');
    
    // Check if we should use the containerized service
    // The value in config.ini is a string, so we need to compare it to the string 'true'
    this.useService = mcpConfig.use_service === 'true';
    
    // Force useService to true for testing
    this.useService = true;
    
    // Build service URL from config components
    const protocol = mcpConfig.protocol || 'http';
    const host = mcpConfig.host || 'localhost';
    const port = mcpConfig.port || '3581';
    this.serviceUrl = mcpConfig.url || `${protocol}://${host}:${port}`;
    
    // Enable fallback by default unless explicitly disabled
    this.fallbackEnabled = mcpConfig.fallback_enabled !== 'false';
    
    logger.info(`Shell Command Service initialized with useService=${this.useService}, serviceUrl=${this.serviceUrl}`);
    if (!this.useService || this.fallbackEnabled) {
      logger.info(`Python fallback: ${this.pythonInterpreter}, Orchestrator path: ${this.orchestratorPath}`);
    }
    
    // Load mcpDBService here to avoid circular dependencies
    this.mcpDBService = require('./mcpDBService');
    
    // Load fetch for API calls
    this.fetch = require('node-fetch');
  }

  /**
   * Execute a shell command via the MCP orchestrator
   * @param {string} command - The shell command to execute
   * @param {string} userId - User ID for server configuration lookup
   * @param {Object} options - Execution options
   * @param {string} options.serverId - Specific MCP server ID (optional, uses default if not provided)
   * @param {number} options.timeout - Execution timeout in seconds (default: 30)
   * @returns {Promise<Object>} - Execution result
   */
  async executeShellCommand(command, userId, options = {}) {
    const { serverId, timeout = 30 } = options;

    // Get MCP server configuration for the user
    let serverConfig;
    if (serverId) {
      serverConfig = await this.mcpDBService.getMCPServerConfiguration(serverId, userId);
      if (!serverConfig) {
        throw new Error(`MCP server configuration not found for server ID: ${serverId}`);
      }
    } else {
      // Use default server for the user
      serverConfig = await this.mcpDBService.getDefaultMCPServerConfiguration(userId);
      if (!serverConfig) {
        throw new Error('No default MCP server configured for user. Please configure an MCP server first.');
      }
    }

    const serverUrl = `http://${serverConfig.mcp_host}:${serverConfig.mcp_port}`;
    
    // If containerized service is enabled, try to use it first
    if (this.useService) {
      try {
        logger.info(`Executing shell command via containerized MCP orchestrator for user ${userId}`);
        logger.info(`Command: ${command}`);
        logger.info(`MCP Server: ${serverUrl} (${serverConfig.server_name})`);
        logger.info(`Service URL: ${this.serviceUrl}`);
        
        const result = await this.executeWithService(serverUrl, command, timeout);
        
        // Return the result with server config
        return {
          ...result,
          serverConfig: {
            id: serverConfig.id,
            name: serverConfig.server_name,
            host: serverConfig.mcp_host,
            port: serverConfig.mcp_port
          },
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        logger.error(`Error using containerized service: ${error.message}`);
        
        // If fallback is not enabled, rethrow the error
        if (!this.fallbackEnabled) {
          throw error;
        }
        
        // Otherwise, fall back to local Python execution
        logger.info('Falling back to local Python execution');
      }
    }
    
    // Use local Python execution (either as primary method or fallback)
    return this.executeWithPython(serverUrl, command, timeout, serverConfig);
  }

  /**
   * Execute command using the containerized MCP orchestrator service
   * @param {string} serverUrl - MCP server URL
   * @param {string} command - Command to execute
   * @param {number} timeout - Timeout in seconds
   * @returns {Promise<Object>} - Execution result
   */
  async executeWithService(serverUrl, command, timeout) {
    try {
      const response = await this.fetch(`${this.serviceUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          server: serverUrl,
          tool: 'runShellCommand',
          parameters: { command }
        }),
        timeout: timeout * 1000
      });
      
      if (!response.ok) {
        throw new Error(`Service returned status ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        command,
        result: result,
        output: JSON.stringify(result, null, 2),
        service: true
      };
    } catch (error) {
      logger.error('Error calling MCP orchestrator service:', error);
      throw error;
    }
  }

  /**
   * Execute command using local Python execution
   * @param {string} serverUrl - MCP server URL
   * @param {string} command - Command to execute
   * @param {number} timeout - Timeout in seconds
   * @param {Object} serverConfig - Server configuration
   * @returns {Promise<Object>} - Execution result
   */
  async executeWithPython(serverUrl, command, timeout, serverConfig) {
    return new Promise((resolve, reject) => {
      const parameters = JSON.stringify({ command });
      
      logger.info(`Executing shell command via local Python orchestrator`);
      logger.info(`Command: ${command}`);
      logger.info(`MCP Server: ${serverUrl} (${serverConfig.server_name})`);

      // Spawn Python orchestrator process using configured Python interpreter
      const pythonProcess = spawn(this.pythonInterpreter, [
        this.orchestratorPath,
        '--server', serverUrl,
        'runShellCommand',
        parameters
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeout * 1000
      });

      let stdout = '';
      let stderr = '';

      // Collect stdout data
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr data
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        logger.info(`Python orchestrator process exited with code: ${code}`);
        
        if (code === 0) {
          // For successful execution, always preserve the complete raw output
          // The user wants to see the full orchestrator logs + JSON result
          resolve({
            success: true,
            command,
            result: null, // Don't try to parse - just show raw output
            output: stdout, // This contains the complete orchestrator output
            serverConfig: {
              id: serverConfig.id,
              name: serverConfig.server_name,
              host: serverConfig.mcp_host,
              port: serverConfig.mcp_port
            },
            timestamp: new Date().toISOString(),
            service: false
          });
        } else {
          resolve({
            success: false,
            command,
            error: `Process exited with code ${code}`,
            output: stdout,
            stderr,
            serverConfig: {
              id: serverConfig.id,
              name: serverConfig.server_name,
              host: serverConfig.mcp_host,
              port: serverConfig.mcp_port
            },
            timestamp: new Date().toISOString(),
            service: false
          });
        }
      });

      // Handle process errors
      pythonProcess.on('error', (error) => {
        logger.error('Error spawning Python orchestrator:', error);
        reject({
          success: false,
          command,
          error: error.message,
          serverConfig: {
            id: serverConfig.id,
            name: serverConfig.server_name,
            host: serverConfig.mcp_host,
            port: serverConfig.mcp_port
          },
          timestamp: new Date().toISOString(),
          service: false
        });
      });

      // Handle timeout
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill();
          reject({
            success: false,
            command,
            error: `Command execution timed out after ${timeout} seconds`,
            serverConfig: {
              id: serverConfig.id,
              name: serverConfig.server_name,
              host: serverConfig.mcp_host,
              port: serverConfig.mcp_port
            },
            timestamp: new Date().toISOString(),
            service: false
          });
        }
      }, timeout * 1000);
    });
  }

  /**
   * Get available MCP tools from a user's server
   * @param {string} userId - User ID for server configuration lookup
   * @param {Object} options - Options
   * @param {string} options.serverId - Specific MCP server ID (optional, uses default if not provided)
   * @returns {Promise<Object>} - Available tools
   */
  async getAvailableTools(userId, options = {}) {
    const { serverId } = options;

    // Get MCP server configuration for the user
    let serverConfig;
    if (serverId) {
      serverConfig = await this.mcpDBService.getMCPServerConfiguration(serverId, userId);
      if (!serverConfig) {
        throw new Error(`MCP server configuration not found for server ID: ${serverId}`);
      }
    } else {
      // Use default server for the user
      serverConfig = await this.mcpDBService.getDefaultMCPServerConfiguration(userId);
      if (!serverConfig) {
        throw new Error('No default MCP server configured for user. Please configure an MCP server first.');
      }
    }

    const serverUrl = `http://${serverConfig.mcp_host}:${serverConfig.mcp_port}`;
    
    // If containerized service is enabled, try to use it first
    if (this.useService) {
      try {
        logger.info(`Getting available tools via containerized MCP orchestrator for user ${userId}`);
        logger.info(`MCP Server: ${serverUrl} (${serverConfig.server_name})`);
        logger.info(`Service URL: ${this.serviceUrl}`);
        
        const response = await this.fetch(`${this.serviceUrl}/tools?server=${encodeURIComponent(serverUrl)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          throw new Error(`Service returned status ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        return {
          success: true,
          tools: JSON.stringify(result.tools || [], null, 2),
          serverConfig: {
            id: serverConfig.id,
            name: serverConfig.server_name,
            host: serverConfig.mcp_host,
            port: serverConfig.mcp_port
          },
          timestamp: new Date().toISOString(),
          service: true
        };
      } catch (error) {
        logger.error(`Error getting tools from containerized service: ${error.message}`);
        
        // If fallback is not enabled, rethrow the error
        if (!this.fallbackEnabled) {
          throw error;
        }
        
        // Otherwise, fall back to local Python execution
        logger.info('Falling back to local Python for tool listing');
      }
    }
    
    // Use local Python execution (either as primary method or fallback)
    return new Promise((resolve, reject) => {
      logger.info(`Getting available tools from MCP server for user ${userId}`);
      logger.info(`MCP Server: ${serverUrl} (${serverConfig.server_name})`);

      // Spawn Python orchestrator process with --list flag
      const pythonProcess = spawn(this.pythonInterpreter, [
        this.orchestratorPath,
        '--server', serverUrl,
        '--list'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

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
          resolve({
            success: true,
            tools: stdout,
            serverConfig: {
              id: serverConfig.id,
              name: serverConfig.server_name,
              host: serverConfig.mcp_host,
              port: serverConfig.mcp_port
            },
            timestamp: new Date().toISOString(),
            service: false
          });
        } else {
          reject({
            success: false,
            error: `Failed to get tools. Process exited with code ${code}`,
            output: stdout,
            stderr,
            serverConfig: {
              id: serverConfig.id,
              name: serverConfig.server_name,
              host: serverConfig.mcp_host,
              port: serverConfig.mcp_port
            },
            timestamp: new Date().toISOString(),
            service: false
          });
        }
      });

      pythonProcess.on('error', (error) => {
        logger.error('Error getting tools from MCP server:', error);
        reject({
          success: false,
          error: error.message,
          serverConfig: {
            id: serverConfig.id,
            name: serverConfig.server_name,
            host: serverConfig.mcp_host,
            port: serverConfig.mcp_port
          },
          timestamp: new Date().toISOString(),
          service: false
        });
      });
    });
  }

  /**
   * Test connection to MCP server
   * @param {string} userId - User ID for server configuration lookup
   * @param {Object} options - Options
   * @param {string} options.serverId - Specific MCP server ID (optional, uses default if not provided)
   * @returns {Promise<Object>} - Connection test result
   */
  async testConnection(userId, options = {}) {
    try {
      const result = await this.getAvailableTools(userId, options);
      return {
        success: true,
        message: 'Successfully connected to MCP server',
        serverConfig: result.serverConfig,
        service: result.service
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to MCP server: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Get all MCP servers configured for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} - List of server configurations
   */
  async getUserMCPServers(userId) {
    return this.mcpDBService.getUserMCPServers(userId);
  }

  /**
   * Get default MCP server for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Default server configuration
   */
  async getUserDefaultMCPServer(userId) {
    return this.mcpDBService.getDefaultMCPServerConfiguration(userId);
  }
}

// Export the class instead of an instance
module.exports = ShellCommandService; 