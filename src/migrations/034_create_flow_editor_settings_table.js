/**
 * Migration to create flow_editor_settings table
 * User-specific configuration settings for the Flow Editor
 */

const { pool } = require('../database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create flow_editor_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_editor_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        
        -- Execution Configuration
        working_directory TEXT, -- Optional working directory
        central_scripts_directory TEXT, -- Optional central scripts directory
        mcp_server_id UUID, -- Reference to MCP server (will be added when MCP table exists)
        mcp_server_url TEXT, -- Custom MCP server URL if not using predefined server
        
        -- Canvas Appearance
        canvas_background_color TEXT NOT NULL DEFAULT '#1a1f2d',
        canvas_grid_size INTEGER NOT NULL DEFAULT 20 CHECK (canvas_grid_size >= 10 AND canvas_grid_size <= 50),
        canvas_grid_color TEXT NOT NULL DEFAULT '#2d3748',
        canvas_zoom_sensitivity DECIMAL(3,2) NOT NULL DEFAULT 0.8 CHECK (canvas_zoom_sensitivity >= 0.1 AND canvas_zoom_sensitivity <= 2.0),
        
        -- Node Styling
        node_border_thickness INTEGER NOT NULL DEFAULT 2 CHECK (node_border_thickness >= 1 AND node_border_thickness <= 10),
        node_border_radius INTEGER NOT NULL DEFAULT 8 CHECK (node_border_radius >= 0 AND node_border_radius <= 50),
        node_text_size INTEGER NOT NULL DEFAULT 14 CHECK (node_text_size >= 8 AND node_text_size <= 24),
        node_text_color TEXT NOT NULL DEFAULT '#ffffff',
        node_background_brightness INTEGER NOT NULL DEFAULT 100 CHECK (node_background_brightness >= 0 AND node_background_brightness <= 200),
        node_shadow_intensity INTEGER NOT NULL DEFAULT 20 CHECK (node_shadow_intensity >= 0 AND node_shadow_intensity <= 100),
        
        -- Edge Styling
        edge_thickness INTEGER NOT NULL DEFAULT 2 CHECK (edge_thickness >= 1 AND edge_thickness <= 10),
        edge_color TEXT NOT NULL DEFAULT '#3b82f6',
        edge_animation_speed DECIMAL(3,2) NOT NULL DEFAULT 1.0 CHECK (edge_animation_speed >= 0.1 AND edge_animation_speed <= 5.0),
        
        -- Execution Settings
        execution_timeout INTEGER NOT NULL DEFAULT 300 CHECK (execution_timeout >= 30 AND execution_timeout <= 3600),
        auto_save_interval INTEGER NOT NULL DEFAULT 30 CHECK (auto_save_interval >= 5 AND auto_save_interval <= 300),
        show_execution_logs BOOLEAN NOT NULL DEFAULT true,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        
        -- Ensure one settings record per user
        UNIQUE(user_id)
      )
    `);

    // Create index for faster user lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_editor_settings_user_id ON flow_editor_settings(user_id)
    `);

    // Create trigger to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_flow_editor_settings_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      CREATE TRIGGER update_flow_editor_settings_updated_at
      BEFORE UPDATE ON flow_editor_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_flow_editor_settings_updated_at();
    `);

    // Add table and column comments
    await client.query(`
      COMMENT ON TABLE flow_editor_settings IS 'User-specific configuration settings for the Flow Editor'
    `);
    
    await client.query(`
      COMMENT ON COLUMN flow_editor_settings.working_directory IS 'Optional base directory for VLSI project files';
      COMMENT ON COLUMN flow_editor_settings.central_scripts_directory IS 'Optional directory containing central VLSI scripts';
      COMMENT ON COLUMN flow_editor_settings.mcp_server_id IS 'Reference to configured MCP server for remote execution';
      COMMENT ON COLUMN flow_editor_settings.mcp_server_url IS 'Custom MCP server URL if not using predefined server';
      COMMENT ON COLUMN flow_editor_settings.canvas_background_color IS 'Background color of the flow editor canvas';
      COMMENT ON COLUMN flow_editor_settings.canvas_grid_size IS 'Size of the grid dots on the canvas in pixels';
      COMMENT ON COLUMN flow_editor_settings.canvas_grid_color IS 'Color of the grid dots on the canvas';
      COMMENT ON COLUMN flow_editor_settings.canvas_zoom_sensitivity IS 'Zoom sensitivity for mouse wheel interactions';
      COMMENT ON COLUMN flow_editor_settings.node_border_thickness IS 'Thickness of node borders in pixels';
      COMMENT ON COLUMN flow_editor_settings.node_border_radius IS 'Border radius of nodes in pixels';
      COMMENT ON COLUMN flow_editor_settings.node_text_size IS 'Font size for node text in pixels';
      COMMENT ON COLUMN flow_editor_settings.node_text_color IS 'Color of text inside nodes';
      COMMENT ON COLUMN flow_editor_settings.node_background_brightness IS 'Background brightness percentage for nodes';
      COMMENT ON COLUMN flow_editor_settings.node_shadow_intensity IS 'Shadow intensity percentage for nodes';
      COMMENT ON COLUMN flow_editor_settings.edge_thickness IS 'Thickness of edges connecting nodes in pixels';
      COMMENT ON COLUMN flow_editor_settings.edge_color IS 'Color of edges connecting nodes';
      COMMENT ON COLUMN flow_editor_settings.edge_animation_speed IS 'Speed multiplier for edge animations';
      COMMENT ON COLUMN flow_editor_settings.execution_timeout IS 'Maximum execution time for flows in seconds';
      COMMENT ON COLUMN flow_editor_settings.auto_save_interval IS 'Auto-save interval in seconds';
      COMMENT ON COLUMN flow_editor_settings.show_execution_logs IS 'Whether to show execution logs in the UI';
    `);

    await client.query('COMMIT');
    console.log('Migration 034: Flow Editor Settings table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 034 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Drop trigger and function
    await client.query(`DROP TRIGGER IF EXISTS update_flow_editor_settings_updated_at ON flow_editor_settings`);
    await client.query(`DROP FUNCTION IF EXISTS update_flow_editor_settings_updated_at()`);
    
    // Drop table
    await client.query(`DROP TABLE IF EXISTS flow_editor_settings CASCADE`);
    
    await client.query('COMMIT');
    console.log('Migration 034: Flow Editor Settings table dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 034 rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
