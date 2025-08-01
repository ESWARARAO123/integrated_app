import React, { useState, useEffect } from 'react';
import { useToast } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { useTheme } from '../../contexts/ThemeContext';

interface FlowEditorSettings {
  id?: string;
  user_id: string;
  // Script Locations
  working_directory?: string;
  central_scripts_directory?: string;
  mcp_server_id?: string; // Reference to MCP server ID
  mcp_server_url?: string; // Custom URL if not using predefined server
  
  // Canvas Appearance
  canvas_background_color: string;
  canvas_grid_size: number;
  canvas_grid_color: string;
  canvas_zoom_sensitivity: number;
  
  // Node Styling
  node_border_thickness: number;
  node_border_radius: number;
  node_text_size: number;
  node_text_color: string;
  node_background_brightness: number;
  node_shadow_intensity: number;
  
  // Edge Styling
  edge_thickness: number;
  edge_color: string;
  edge_animation_speed: number;
  
  // Execution Settings
  execution_timeout: number;
  auto_save_interval: number;
  show_execution_logs: boolean;
  
  created_at?: string;
  updated_at?: string;
}

interface MCPServer {
  id: string;
  mcp_nickname: string;
  mcp_host: string;
  mcp_port: number;
  mcp_connection_status: string;
  is_default: boolean;
}

// Theme-aware default settings
const getDefaultSettings = (isDark: boolean): Omit<FlowEditorSettings, 'user_id'> => ({
  // Script Locations (optional)
  working_directory: '',
  central_scripts_directory: '',
  mcp_server_id: '', // Will be set from available servers
  mcp_server_url: '',
  
  // Canvas Appearance - Theme aware
  canvas_background_color: isDark ? '#1a1f2d' : '#f8fafc',
  canvas_grid_size: 20,
  canvas_grid_color: isDark ? '#2d3748' : '#e2e8f0',
  canvas_zoom_sensitivity: 0.8,
  
  // Node Styling - Theme aware
  node_border_thickness: 2,
  node_border_radius: 8,
  node_text_size: 14,
  node_text_color: isDark ? '#ffffff' : '#1a202c',
  node_background_brightness: 100,
  node_shadow_intensity: 20,
  
  // Edge Styling - Theme aware
  edge_thickness: 2,
  edge_color: '#3b82f6', // Primary color works in both themes
  edge_animation_speed: 1,
  
  // Execution Settings
  execution_timeout: 300,
  auto_save_interval: 30,
  show_execution_logs: true,
});

// Helper function to validate color contrast
const validateColorContrast = (backgroundColor: string, textColor: string, isDark: boolean): { isValid: boolean; suggestion?: string } => {
  // Simple color contrast validation
  const bgIsLight = backgroundColor.includes('f') || backgroundColor.includes('e') || backgroundColor.includes('d');
  const textIsLight = textColor.includes('f') || textColor.includes('e') || textColor.includes('d');
  
  // If both are light or both are dark, suggest better contrast
  if (bgIsLight === textIsLight) {
    return {
      isValid: false,
      suggestion: isDark 
        ? 'Consider using lighter text on dark backgrounds' 
        : 'Consider using darker text on light backgrounds'
    };
  }
  
  return { isValid: true };
};

// Theme-aware color suggestions
const getColorSuggestions = (isDark: boolean) => ({
  canvas: {
    background: isDark ? ['#1a1f2d', '#0f1117', '#1e293b'] : ['#f8fafc', '#ffffff', '#f1f5f9'],
    grid: isDark ? ['#2d3748', '#374151', '#475569'] : ['#e2e8f0', '#cbd5e1', '#94a3b8']
  },
  node: {
    text: isDark ? ['#ffffff', '#f3f4f6', '#e5e7eb'] : ['#1a202c', '#2d3748', '#4a5568']
  },
  edge: {
    color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444']
  }
});

const FlowEditorSettings: React.FC = () => {
  const { isDark, currentTheme } = useTheme();
  const [settings, setSettings] = useState<FlowEditorSettings>(() => ({
    ...getDefaultSettings(isDark),
    user_id: '', // Will be set when loaded
  }));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [currentSettings, setCurrentSettings] = useState<FlowEditorSettings | null>(null);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [loadingMcpServers, setLoadingMcpServers] = useState<boolean>(false);
  const [useCustomMcpUrl, setUseCustomMcpUrl] = useState<boolean>(false);
  const toast = useToast();

  // Load MCP servers
  const loadMcpServers = async () => {
    try {
      setLoadingMcpServers(true);
      const response = await axios.get('/api/mcp/server/config');
      const servers = response.data.configurations || [];
      const mappedServers = servers.map((server: any) => ({
        id: server.id,
        mcp_nickname: server.server_name,
        mcp_host: server.mcp_host,
        mcp_port: server.mcp_port,
        mcp_connection_status: server.last_connection_status || 'unknown',
        is_default: server.is_default
      }));
      setMcpServers(mappedServers);
    } catch (error) {
      console.error('Error loading MCP servers:', error);
      // Don't show error toast here, just use empty array
      setMcpServers([]);
    } finally {
      setLoadingMcpServers(false);
    }
  };

  // Load existing settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        
        // Load MCP servers first
        await loadMcpServers();
        
        const response = await fetch('/api/flow-editor-settings', {
          credentials: 'include',
        });

        if (response.ok) {
          const userSettings = await response.json();
          if (userSettings) {
            setCurrentSettings(userSettings);
            setSettings(userSettings);
            
            // Check if user has custom MCP URL
            setUseCustomMcpUrl(!userSettings.mcp_server_id && !!userSettings.mcp_server_url);
          }
        }
      } catch (error) {
        console.error('Error loading flow editor settings:', error);
        toast({
          title: 'Error loading settings',
          description: 'Could not load your flow editor settings. Using defaults.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [toast]);

  // Handle saving the settings
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/flow-editor-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const savedSettings = await response.json();
      setCurrentSettings(savedSettings);

      toast({
        title: 'Settings saved',
        description: 'Your flow editor settings have been saved successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error saving flow editor settings:', error);
      toast({
        title: 'Error saving settings',
        description: 'Could not save your flow editor settings. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset to defaults
  const handleReset = () => {
    setSettings({
      ...getDefaultSettings(isDark),
      user_id: settings.user_id,
      id: settings.id,
    });
  };

  // Handle input changes
  const handleChange = (field: keyof FlowEditorSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
        <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>Loading flow editor settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
      {/* Script Locations Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 border border-solid rounded-lg"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          🔧 Execution Configuration
        </h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Configure MCP server and optional script locations for VLSI flow execution.
        </p>

        <div className="space-y-4">
          {/* MCP Server Selection */}
          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              MCP Server
            </label>
            
            {loadingMcpServers ? (
              <div className="p-3 rounded-md border" style={{ backgroundColor: 'var(--color-input-bg)', borderColor: 'var(--color-border)' }}>
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading MCP servers...</span>
              </div>
            ) : mcpServers.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="use-existing-mcp"
                    checked={!useCustomMcpUrl}
                    onChange={() => setUseCustomMcpUrl(false)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <label htmlFor="use-existing-mcp" className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    Use existing MCP server
                  </label>
                </div>
                
                {!useCustomMcpUrl && (
                  <select
                    value={settings.mcp_server_id || ''}
                    onChange={(e) => handleChange('mcp_server_id', e.target.value)}
                    className="w-full p-3 rounded-md border font-mono text-sm"
                    style={{
                      backgroundColor: 'var(--color-input-bg)',
                      color: 'var(--color-text)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <option value="">Select an MCP server</option>
                    {mcpServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.mcp_nickname} ({server.mcp_host}:{server.mcp_port})
                        {server.is_default ? ' - Default' : ''}
                        {server.mcp_connection_status === 'connected' ? ' ✅' : ' ❌'}
                      </option>
                    ))}
                  </select>
                )}
                
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="use-custom-mcp"
                    checked={useCustomMcpUrl}
                    onChange={() => setUseCustomMcpUrl(true)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <label htmlFor="use-custom-mcp" className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    Use custom MCP server URL
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 rounded-md border" style={{ backgroundColor: 'var(--color-surface-dark)', borderColor: 'var(--color-border)' }}>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    No MCP servers configured. You can add servers in the MCP Integration settings or enter a custom URL below.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="use-custom-mcp-only"
                    checked={useCustomMcpUrl}
                    onChange={(e) => setUseCustomMcpUrl(e.target.checked)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <label htmlFor="use-custom-mcp-only" className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    Use custom MCP server URL
                  </label>
                </div>
              </div>
            )}
            
            {useCustomMcpUrl && (
              <input
                type="text"
                value={settings.mcp_server_url || ''}
                onChange={(e) => handleChange('mcp_server_url', e.target.value)}
                placeholder="http://172.28.142.23:8080"
                className="w-full p-3 rounded-md border font-mono text-sm mt-2"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              />
            )}
          </div>

          {/* Optional Script Locations */}
          <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <h4 className="font-medium text-sm mb-3" style={{ color: 'var(--color-text)' }}>
              📁 Optional Script Locations
            </h4>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              These paths are optional and will be used if specified. Leave empty to use server defaults.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block mb-1 font-medium text-xs" style={{ color: 'var(--color-text)' }}>
                  Working Directory
                </label>
                <input
                  type="text"
                  value={settings.working_directory || ''}
                  onChange={(e) => handleChange('working_directory', e.target.value)}
                  placeholder="e.g., /mnt/projects_107/vasu_backend (optional)"
                  className="w-full p-2 rounded-md border font-mono text-xs"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-border)',
                  }}
                />
              </div>

              <div>
                <label className="block mb-1 font-medium text-xs" style={{ color: 'var(--color-text)' }}>
                  Central Scripts Directory
                </label>
                <input
                  type="text"
                  value={settings.central_scripts_directory || ''}
                  onChange={(e) => handleChange('central_scripts_directory', e.target.value)}
                  placeholder="e.g., /mnt/projects/vasu_backend/flow/central_scripts (optional)"
                  className="w-full p-2 rounded-md border font-mono text-xs"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    color: 'var(--color-text)',
                    borderColor: 'var(--color-border)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Canvas Appearance Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-6 border border-solid rounded-lg"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          🎨 Canvas Appearance
        </h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Customize the look and feel of your flow editor canvas. Colors are optimized for <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{currentTheme}</span> theme.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Background Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.canvas_background_color}
                onChange={(e) => handleChange('canvas_background_color', e.target.value)}
                className="w-12 h-10 rounded border"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <input
                type="text"
                value={settings.canvas_background_color}
                onChange={(e) => handleChange('canvas_background_color', e.target.value)}
                className="flex-1 p-2 rounded-md border font-mono text-sm"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              />
            </div>
            {/* Theme-aware color suggestions */}
            <div className="mt-2">
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Suggested for {currentTheme} theme:
              </p>
              <div className="flex gap-1">
                {getColorSuggestions(isDark).canvas.background.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => handleChange('canvas_background_color', color)}
                    className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: color,
                      borderColor: settings.canvas_background_color === color ? 'var(--color-primary)' : 'var(--color-border)'
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Grid Size: {settings.canvas_grid_size}px
            </label>
            <input
              type="range"
              min="10"
              max="50"
              value={settings.canvas_grid_size}
              onChange={(e) => handleChange('canvas_grid_size', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Grid Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.canvas_grid_color}
                onChange={(e) => handleChange('canvas_grid_color', e.target.value)}
                className="w-12 h-10 rounded border"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <input
                type="text"
                value={settings.canvas_grid_color}
                onChange={(e) => handleChange('canvas_grid_color', e.target.value)}
                className="flex-1 p-2 rounded-md border font-mono text-sm"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              />
            </div>
            {/* Theme-aware grid color suggestions */}
            <div className="mt-2">
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Suggested grid colors:
              </p>
              <div className="flex gap-1">
                {getColorSuggestions(isDark).canvas.grid.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => handleChange('canvas_grid_color', color)}
                    className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: color,
                      borderColor: settings.canvas_grid_color === color ? 'var(--color-primary)' : 'var(--color-border)'
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Zoom Sensitivity: {settings.canvas_zoom_sensitivity}
            </label>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={settings.canvas_zoom_sensitivity}
              onChange={(e) => handleChange('canvas_zoom_sensitivity', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </motion.div>

      {/* Node Styling Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-6 border border-solid rounded-lg"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          📦 Node Styling
        </h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Customize the appearance of flow nodes and blocks.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Border Thickness: {settings.node_border_thickness}px
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={settings.node_border_thickness}
              onChange={(e) => handleChange('node_border_thickness', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Border Radius: {settings.node_border_radius}px
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={settings.node_border_radius}
              onChange={(e) => handleChange('node_border_radius', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Text Size: {settings.node_text_size}px
            </label>
            <input
              type="range"
              min="10"
              max="24"
              value={settings.node_text_size}
              onChange={(e) => handleChange('node_text_size', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Text Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.node_text_color}
                onChange={(e) => handleChange('node_text_color', e.target.value)}
                className="w-12 h-10 rounded border"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <input
                type="text"
                value={settings.node_text_color}
                onChange={(e) => handleChange('node_text_color', e.target.value)}
                className="flex-1 p-2 rounded-md border font-mono text-sm"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              />
            </div>
            {/* Theme-aware text color suggestions with contrast validation */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Suggested text colors:
                </p>
                {(() => {
                  const contrast = validateColorContrast(settings.canvas_background_color, settings.node_text_color, isDark);
                  return !contrast.isValid ? (
                    <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
                      ⚠️ {contrast.suggestion}
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="flex gap-1">
                {getColorSuggestions(isDark).node.text.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => handleChange('node_text_color', color)}
                    className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: color,
                      borderColor: settings.node_text_color === color ? 'var(--color-primary)' : 'var(--color-border)'
                    }}
                    title={`${color} - Good contrast for ${currentTheme} theme`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Background Brightness: {settings.node_background_brightness}%
            </label>
            <input
              type="range"
              min="50"
              max="150"
              value={settings.node_background_brightness}
              onChange={(e) => handleChange('node_background_brightness', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Shadow Intensity: {settings.node_shadow_intensity}%
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={settings.node_shadow_intensity}
              onChange={(e) => handleChange('node_shadow_intensity', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </motion.div>

      {/* Edge Styling Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 border border-solid rounded-lg"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          🔗 Edge Styling
        </h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Customize the connections between flow nodes.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Edge Thickness: {settings.edge_thickness}px
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={settings.edge_thickness}
              onChange={(e) => handleChange('edge_thickness', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Edge Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={settings.edge_color}
                onChange={(e) => handleChange('edge_color', e.target.value)}
                className="w-12 h-10 rounded border"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <input
                type="text"
                value={settings.edge_color}
                onChange={(e) => handleChange('edge_color', e.target.value)}
                className="flex-1 p-2 rounded-md border font-mono text-sm"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)',
                }}
              />
            </div>
            {/* Universal edge color suggestions */}
            <div className="mt-2">
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Popular edge colors (work in all themes):
              </p>
              <div className="flex gap-1">
                {getColorSuggestions(isDark).edge.color.map((color, index) => (
                  <button
                    key={index}
                    onClick={() => handleChange('edge_color', color)}
                    className="w-6 h-6 rounded border-2 hover:scale-110 transition-transform"
                    style={{ 
                      backgroundColor: color,
                      borderColor: settings.edge_color === color ? 'var(--color-primary)' : 'var(--color-border)'
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Animation Speed: {settings.edge_animation_speed}x
            </label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={settings.edge_animation_speed}
              onChange={(e) => handleChange('edge_animation_speed', parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </motion.div>

      {/* Execution Settings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="p-6 border border-solid rounded-lg"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          ⚙️ Execution Settings
        </h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Configure how flows are executed and monitored.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Execution Timeout: {settings.execution_timeout}s
            </label>
            <input
              type="range"
              min="30"
              max="1800"
              step="30"
              value={settings.execution_timeout}
              onChange={(e) => handleChange('execution_timeout', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium text-sm" style={{ color: 'var(--color-text)' }}>
              Auto-save Interval: {settings.auto_save_interval}s
            </label>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={settings.auto_save_interval}
              onChange={(e) => handleChange('auto_save_interval', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.show_execution_logs}
                onChange={(e) => handleChange('show_execution_logs', e.target.checked)}
                className="rounded"
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>
                Show Execution Logs
              </span>
            </label>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Display detailed logs during flow execution for debugging purposes.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="sticky bottom-0 bg-opacity-95 backdrop-blur-sm p-6 border-t rounded-lg"
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-border)' 
        }}
      >
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 rounded-lg font-medium text-white transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              style={{ 
                backgroundColor: isSaving ? 'var(--color-primary-muted)' : 'var(--color-primary)',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Settings</span>
                </>
              )}
            </button>
            
            <button
              onClick={() => {
                // Auto-adjust colors for current theme
                const themeDefaults = getDefaultSettings(isDark);
                setSettings(prev => ({
                  ...prev,
                  canvas_background_color: themeDefaults.canvas_background_color,
                  canvas_grid_color: themeDefaults.canvas_grid_color,
                  node_text_color: themeDefaults.node_text_color,
                  edge_color: themeDefaults.edge_color
                }));
              }}
              disabled={isSaving}
              className="px-4 py-3 rounded-lg font-medium border-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              style={{ 
                color: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                backgroundColor: 'transparent'
              }}
              title={`Optimize colors for ${currentTheme} theme`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
              </svg>
              <span>Auto-Adjust for {currentTheme}</span>
            </button>
            
            <button
              onClick={handleReset}
              disabled={isSaving}
              className="px-6 py-3 rounded-lg font-medium border-2 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
              style={{ 
                color: 'var(--color-text)',
                borderColor: 'var(--color-border)',
                backgroundColor: 'transparent'
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset All</span>
            </button>
          </div>
          
          {currentSettings && (
            <div className="text-xs text-center sm:text-right" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="font-medium">Last updated:</div>
              <div className="font-mono text-xs opacity-75">{new Date(currentSettings.updated_at || '').toLocaleString()}</div>
            </div>
          )}
        </div>
      </motion.div>

      {currentSettings && (
        <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
          Last updated: {new Date(currentSettings.updated_at || '').toLocaleString()}
        </p>
      )}
      </div>
    </div>
  );
};

export default FlowEditorSettings; 