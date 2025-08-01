import axios from 'axios';

export interface FlowEditorSettings {
  id?: string;
  user_id: string;
  // Execution Configuration
  working_directory?: string;
  central_scripts_directory?: string;
  mcp_server_id?: string;
  mcp_server_url?: string;
  
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

export const getFlowEditorSettings = async (): Promise<FlowEditorSettings | null> => {
  try {
    const response = await axios.get('/api/flow-editor-settings');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // No settings found, will use defaults
    }
    throw error;
  }
};

export const saveFlowEditorSettings = async (settings: Partial<FlowEditorSettings>): Promise<FlowEditorSettings> => {
  try {
    const response = await axios.post('/api/flow-editor-settings', settings);
    return response.data;
  } catch (error) {
    console.error('Error saving flow editor settings:', error);
    throw error;
  }
};

export const resetFlowEditorSettings = async (): Promise<void> => {
  try {
    await axios.delete('/api/flow-editor-settings');
  } catch (error) {
    console.error('Error resetting flow editor settings:', error);
    throw error;
  }
}; 