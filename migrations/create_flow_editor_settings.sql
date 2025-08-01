-- Migration: Create flow_editor_settings table
-- Description: Store user-specific flow editor configuration settings

CREATE TABLE IF NOT EXISTS flow_editor_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Execution Configuration
    working_directory TEXT, -- Optional working directory
    central_scripts_directory TEXT, -- Optional central scripts directory
    mcp_server_id UUID REFERENCES mcp_server_configs(id) ON DELETE SET NULL, -- Reference to MCP server
    mcp_server_url TEXT, -- Custom MCP server URL if not using predefined server
    
    -- Canvas Appearance
    canvas_background_color TEXT NOT NULL DEFAULT '#1a1f2d',
    canvas_grid_size INTEGER NOT NULL DEFAULT 20 CHECK (canvas_grid_size >= 10 AND canvas_grid_size <= 50),
    canvas_grid_color TEXT NOT NULL DEFAULT '#2d3748',
    canvas_zoom_sensitivity DECIMAL(3,1) NOT NULL DEFAULT 0.8 CHECK (canvas_zoom_sensitivity >= 0.1 AND canvas_zoom_sensitivity <= 2.0),
    
    -- Node Styling
    node_border_thickness INTEGER NOT NULL DEFAULT 2 CHECK (node_border_thickness >= 1 AND node_border_thickness <= 8),
    node_border_radius INTEGER NOT NULL DEFAULT 8 CHECK (node_border_radius >= 0 AND node_border_radius <= 20),
    node_text_size INTEGER NOT NULL DEFAULT 14 CHECK (node_text_size >= 10 AND node_text_size <= 24),
    node_text_color TEXT NOT NULL DEFAULT '#ffffff',
    node_background_brightness INTEGER NOT NULL DEFAULT 100 CHECK (node_background_brightness >= 50 AND node_background_brightness <= 150),
    node_shadow_intensity INTEGER NOT NULL DEFAULT 20 CHECK (node_shadow_intensity >= 0 AND node_shadow_intensity <= 50),
    
    -- Edge Styling
    edge_thickness INTEGER NOT NULL DEFAULT 2 CHECK (edge_thickness >= 1 AND edge_thickness <= 8),
    edge_color TEXT NOT NULL DEFAULT '#3b82f6',
    edge_animation_speed DECIMAL(2,1) NOT NULL DEFAULT 1.0 CHECK (edge_animation_speed >= 0.1 AND edge_animation_speed <= 3.0),
    
    -- Execution Settings
    execution_timeout INTEGER NOT NULL DEFAULT 300 CHECK (execution_timeout >= 30 AND execution_timeout <= 1800),
    auto_save_interval INTEGER NOT NULL DEFAULT 30 CHECK (auto_save_interval >= 10 AND auto_save_interval <= 300),
    show_execution_logs BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(user_id) -- Each user can have only one settings record
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_flow_editor_settings_user_id ON flow_editor_settings(user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_flow_editor_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_flow_editor_settings_updated_at
    BEFORE UPDATE ON flow_editor_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_flow_editor_settings_updated_at();

-- Insert default settings for existing users (optional)
-- INSERT INTO flow_editor_settings (user_id)
-- SELECT id FROM users
-- WHERE id NOT IN (SELECT user_id FROM flow_editor_settings);

COMMENT ON TABLE flow_editor_settings IS 'User-specific configuration settings for the Flow Editor';
COMMENT ON COLUMN flow_editor_settings.working_directory IS 'Optional base directory for VLSI project files';
COMMENT ON COLUMN flow_editor_settings.central_scripts_directory IS 'Optional directory containing central VLSI scripts';
COMMENT ON COLUMN flow_editor_settings.mcp_server_id IS 'Reference to configured MCP server for remote execution';
COMMENT ON COLUMN flow_editor_settings.mcp_server_url IS 'Custom MCP server URL if not using predefined server';
COMMENT ON COLUMN flow_editor_settings.canvas_background_color IS 'Background color of the flow editor canvas';
COMMENT ON COLUMN flow_editor_settings.canvas_grid_size IS 'Size of the grid dots on the canvas in pixels';
COMMENT ON COLUMN flow_editor_settings.canvas_grid_color IS 'Color of the grid dots on the canvas';
COMMENT ON COLUMN flow_editor_settings.canvas_zoom_sensitivity IS 'Sensitivity of zoom operations (0.1 = slow, 2.0 = fast)';
COMMENT ON COLUMN flow_editor_settings.node_border_thickness IS 'Thickness of node borders in pixels';
COMMENT ON COLUMN flow_editor_settings.node_border_radius IS 'Border radius of nodes in pixels';
COMMENT ON COLUMN flow_editor_settings.node_text_size IS 'Font size of text inside nodes in pixels';
COMMENT ON COLUMN flow_editor_settings.node_text_color IS 'Color of text inside nodes';
COMMENT ON COLUMN flow_editor_settings.node_background_brightness IS 'Brightness adjustment for node backgrounds (100 = normal)';
COMMENT ON COLUMN flow_editor_settings.node_shadow_intensity IS 'Intensity of node shadows as percentage';
COMMENT ON COLUMN flow_editor_settings.edge_thickness IS 'Thickness of edges connecting nodes in pixels';
COMMENT ON COLUMN flow_editor_settings.edge_color IS 'Color of edges connecting nodes';
COMMENT ON COLUMN flow_editor_settings.edge_animation_speed IS 'Speed multiplier for edge animations';
COMMENT ON COLUMN flow_editor_settings.execution_timeout IS 'Maximum time to wait for flow execution in seconds';
COMMENT ON COLUMN flow_editor_settings.auto_save_interval IS 'Interval between automatic saves in seconds';
COMMENT ON COLUMN flow_editor_settings.show_execution_logs IS 'Whether to display execution logs in the UI'; 