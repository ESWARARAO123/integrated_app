/**
 * MCP Service
 * 
 * This service handles MCP server configuration retrieval for the visual flow editor.
 * It gets the MCP server URL from user settings or default MCP server configuration.
 */

export interface MCPServer {
  id: string;
  mcp_nickname: string;
  mcp_host: string;
  mcp_port: number;
  mcp_connection_status: string;
  is_default: boolean;
}

export interface FlowEditorSettings {
  mcp_server_id?: string;
  mcp_server_url?: string;
  [key: string]: any;
}

/**
 * Get MCP server URL from user settings or default server
 */
export const getMCPServerUrl = async (): Promise<string> => {
  try {
    // First, try to get the MCP server URL from flow editor settings
    const settingsResponse = await fetch('/api/settings/flow-editor', {
      credentials: 'include'
    });

    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json();
      const settings: FlowEditorSettings = settingsData.settings;

      // If user has a custom MCP server URL, use it
      if (settings?.mcp_server_url) {
        console.log(`🔧 Using custom MCP server URL: ${settings.mcp_server_url}`);
        return settings.mcp_server_url;
      }

      // If user has a specific MCP server ID, get that server's URL
      if (settings?.mcp_server_id) {
        const serverResponse = await fetch(`/api/mcp/server/config/${settings.mcp_server_id}`, {
          credentials: 'include'
        });

        if (serverResponse.ok) {
          const serverData = await serverResponse.json();
          const serverUrl = `http://${serverData.mcp_host}:${serverData.mcp_port}`;
          console.log(`🔧 Using configured MCP server: ${serverUrl}`);
          return serverUrl;
        }
      }
    }

    // Fallback: Get default MCP server from MCP configuration
    const mcpResponse = await fetch('/api/mcp/server/config', {
      credentials: 'include'
    });

    if (mcpResponse.ok) {
      const mcpData = await mcpResponse.json();
      const servers: MCPServer[] = mcpData.configurations || [];
      
      // Find default server
      const defaultServer = servers.find(server => server.is_default);
      
      if (defaultServer) {
        const serverUrl = `http://${defaultServer.mcp_host}:${defaultServer.mcp_port}`;
        console.log(`🔧 Using default MCP server: ${serverUrl}`);
        return serverUrl;
      }
      
      // If no default, use first available server
      if (servers.length > 0) {
        const firstServer = servers[0];
        const serverUrl = `http://${firstServer.mcp_host}:${firstServer.mcp_port}`;
        console.log(`🔧 Using first available MCP server: ${serverUrl}`);
        return serverUrl;
      }
    }

    // Final fallback: Use default from config
    const configResponse = await fetch('/api/mcp/config', {
      credentials: 'include'
    });

    if (configResponse.ok) {
      const configData = await configResponse.json();
      const defaultHost = configData.defaultTool?.defaultHost || 'localhost';
      const defaultPort = configData.defaultTool?.defaultPort || 8080;
      const serverUrl = `http://${defaultHost}:${defaultPort}`;
      console.log(`🔧 Using fallback MCP server: ${serverUrl}`);
      return serverUrl;
    }

    // No MCP server configuration found
    throw new Error('No MCP server configuration found. Please configure an MCP server in settings.');

  } catch (error) {
    console.error('Error getting MCP server URL:', error);
    throw error;
  }
};

/**
 * Get all available MCP servers
 */
export const getMCPServers = async (): Promise<MCPServer[]> => {
  try {
    const response = await fetch('/api/mcp/server/config', {
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      return data.configurations || [];
    }

    return [];
  } catch (error) {
    console.error('Error getting MCP servers:', error);
    return [];
  }
};

/**
 * Get default MCP server
 */
export const getDefaultMCPServer = async (): Promise<MCPServer | null> => {
  try {
    const servers = await getMCPServers();
    return servers.find(server => server.is_default) || null;
  } catch (error) {
    console.error('Error getting default MCP server:', error);
    return null;
  }
};

/**
 * Test MCP server connection
 */
export const testMCPConnection = async (serverUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${serverUrl}/info`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error testing MCP connection:', error);
    return false;
  }
};

/**
 * Validate MCP server URL format
 */
export const validateMCPServerUrl = (url: string): { valid: boolean; error?: string } => {
  if (!url) {
    return { valid: false, error: 'MCP server URL is required' };
  }

  if (!url.trim()) {
    return { valid: false, error: 'MCP server URL cannot be empty' };
  }

  // Basic URL validation
  try {
    const urlObj = new URL(url);
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'MCP server URL must use HTTP or HTTPS protocol' };
    }

    if (!urlObj.hostname) {
      return { valid: false, error: 'MCP server URL must have a valid hostname' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid MCP server URL format' };
  }
};

/**
 * Get MCP server URL with caching (for performance)
 */
let cachedMCPServerUrl: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getCachedMCPServerUrl = async (): Promise<string> => {
  const now = Date.now();
  
  // Return cached URL if it's still valid
  if (cachedMCPServerUrl && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedMCPServerUrl;
  }

  // Fetch new URL and cache it
  cachedMCPServerUrl = await getMCPServerUrl();
  cacheTimestamp = now;
  
  return cachedMCPServerUrl;
};

/**
 * Clear MCP server URL cache (useful when settings change)
 */
export const clearMCPServerUrlCache = (): void => {
  cachedMCPServerUrl = null;
  cacheTimestamp = 0;
};
