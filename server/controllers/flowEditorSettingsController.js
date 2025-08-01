const pool = require('../config/database');

// Get user's flow editor settings
const getFlowEditorSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM flow_editor_settings WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No settings found for user' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching flow editor settings:', error);
    res.status(500).json({ error: 'Failed to fetch flow editor settings' });
  }
};

// Save or update user's flow editor settings
const saveFlowEditorSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      // Execution Configuration
      working_directory,
      central_scripts_directory,
      mcp_server_id,
      mcp_server_url,
      
      // Canvas Appearance
      canvas_background_color,
      canvas_grid_size,
      canvas_grid_color,
      canvas_zoom_sensitivity,
      
      // Node Styling
      node_border_thickness,
      node_border_radius,
      node_text_size,
      node_text_color,
      node_background_brightness,
      node_shadow_intensity,
      
      // Edge Styling
      edge_thickness,
      edge_color,
      edge_animation_speed,
      
      // Execution Settings
      execution_timeout,
      auto_save_interval,
      show_execution_logs,
    } = req.body;

    // Validate that either mcp_server_id or mcp_server_url is provided
    if (!mcp_server_id && !mcp_server_url) {
      return res.status(400).json({ 
        error: 'Either mcp_server_id or mcp_server_url must be provided' 
      });
    }

    // Check if settings exist for this user
    const existingSettings = await pool.query(
      'SELECT id FROM flow_editor_settings WHERE user_id = $1',
      [userId]
    );

    let result;
    if (existingSettings.rows.length > 0) {
      // Update existing settings
      result = await pool.query(`
        UPDATE flow_editor_settings SET
          working_directory = $2,
          central_scripts_directory = $3,
          mcp_server_id = $4,
          mcp_server_url = $5,
          canvas_background_color = $6,
          canvas_grid_size = $7,
          canvas_grid_color = $8,
          canvas_zoom_sensitivity = $9,
          node_border_thickness = $10,
          node_border_radius = $11,
          node_text_size = $12,
          node_text_color = $13,
          node_background_brightness = $14,
          node_shadow_intensity = $15,
          edge_thickness = $16,
          edge_color = $17,
          edge_animation_speed = $18,
          execution_timeout = $19,
          auto_save_interval = $20,
          show_execution_logs = $21,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `, [
        userId,
        working_directory,
        central_scripts_directory,
        mcp_server_id,
        mcp_server_url,
        canvas_background_color || '#1a1f2d',
        canvas_grid_size || 20,
        canvas_grid_color || '#2d3748',
        canvas_zoom_sensitivity || 0.8,
        node_border_thickness || 2,
        node_border_radius || 8,
        node_text_size || 14,
        node_text_color || '#ffffff',
        node_background_brightness || 100,
        node_shadow_intensity || 20,
        edge_thickness || 2,
        edge_color || '#3b82f6',
        edge_animation_speed || 1.0,
        execution_timeout || 300,
        auto_save_interval || 30,
        show_execution_logs !== undefined ? show_execution_logs : true,
      ]);
    } else {
      // Insert new settings
      result = await pool.query(`
        INSERT INTO flow_editor_settings (
          user_id,
          working_directory,
          central_scripts_directory,
          mcp_server_id,
          mcp_server_url,
          canvas_background_color,
          canvas_grid_size,
          canvas_grid_color,
          canvas_zoom_sensitivity,
          node_border_thickness,
          node_border_radius,
          node_text_size,
          node_text_color,
          node_background_brightness,
          node_shadow_intensity,
          edge_thickness,
          edge_color,
          edge_animation_speed,
          execution_timeout,
          auto_save_interval,
          show_execution_logs
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) RETURNING *
      `, [
        userId,
        working_directory,
        central_scripts_directory,
        mcp_server_id,
        mcp_server_url,
        canvas_background_color || '#1a1f2d',
        canvas_grid_size || 20,
        canvas_grid_color || '#2d3748',
        canvas_zoom_sensitivity || 0.8,
        node_border_thickness || 2,
        node_border_radius || 8,
        node_text_size || 14,
        node_text_color || '#ffffff',
        node_background_brightness || 100,
        node_shadow_intensity || 20,
        edge_thickness || 2,
        edge_color || '#3b82f6',
        edge_animation_speed || 1.0,
        execution_timeout || 300,
        auto_save_interval || 30,
        show_execution_logs !== undefined ? show_execution_logs : true,
      ]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving flow editor settings:', error);
    
    // Handle specific database constraint errors
    if (error.code === '23514') { // Check constraint violation
      return res.status(400).json({ 
        error: 'Invalid setting value. Please check the allowed ranges for numeric fields.' 
      });
    }
    
    res.status(500).json({ error: 'Failed to save flow editor settings' });
  }
};

// Reset user's flow editor settings to defaults
const resetFlowEditorSettings = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      'DELETE FROM flow_editor_settings WHERE user_id = $1',
      [userId]
    );

    res.json({ message: 'Flow editor settings reset to defaults' });
  } catch (error) {
    console.error('Error resetting flow editor settings:', error);
    res.status(500).json({ error: 'Failed to reset flow editor settings' });
  }
};

module.exports = {
  getFlowEditorSettings,
  saveFlowEditorSettings,
  resetFlowEditorSettings,
}; 