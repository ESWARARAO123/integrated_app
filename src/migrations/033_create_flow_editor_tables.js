/**
 * Migration to create Flow Editor tables
 * Supports saving/loading flows with nodes, edges, canvas state, and user association
 */

const { pool } = require('../database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create flows table - main container for each flow
    await client.query(`
      CREATE TABLE IF NOT EXISTS flows (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        canvas_state JSONB DEFAULT '{}',
        workspace_settings JSONB DEFAULT '{}',
        is_template BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_executed_at TIMESTAMP WITH TIME ZONE,
        execution_count INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create flow_nodes table - stores individual nodes in flows
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_nodes (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        flow_id UUID NOT NULL,
        node_id VARCHAR(255) NOT NULL, -- React Flow node ID
        node_type VARCHAR(100) NOT NULL, -- 'input', 'process', 'output'
        position_x FLOAT NOT NULL DEFAULT 0,
        position_y FLOAT NOT NULL DEFAULT 0,
        width FLOAT,
        height FLOAT,
        data JSONB NOT NULL DEFAULT '{}', -- Node-specific data (parameters, values, etc.)
        style JSONB DEFAULT '{}',
        class_name VARCHAR(255),
        draggable BOOLEAN DEFAULT true,
        selectable BOOLEAN DEFAULT true,
        deletable BOOLEAN DEFAULT true,
        z_index INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        UNIQUE(flow_id, node_id)
      )
    `);

    // Create flow_edges table - stores connections between nodes
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_edges (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        flow_id UUID NOT NULL,
        edge_id VARCHAR(255) NOT NULL, -- React Flow edge ID
        source_node_id VARCHAR(255) NOT NULL,
        target_node_id VARCHAR(255) NOT NULL,
        source_handle VARCHAR(255),
        target_handle VARCHAR(255),
        edge_type VARCHAR(100) DEFAULT 'default',
        animated BOOLEAN DEFAULT false,
        style JSONB DEFAULT '{}',
        label VARCHAR(255),
        label_style JSONB DEFAULT '{}',
        marker_end JSONB DEFAULT '{}',
        data JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        UNIQUE(flow_id, edge_id)
      )
    `);

    // Create flow_executions table - track flow execution history
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_executions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        flow_id UUID NOT NULL,
        user_id UUID NOT NULL,
        status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        execution_logs JSONB DEFAULT '[]',
        error_message TEXT,
        input_data JSONB DEFAULT '{}',
        output_data JSONB DEFAULT '{}',
        execution_time_ms INTEGER,
        node_execution_order JSONB DEFAULT '[]', -- Array of node IDs in execution order
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create flow_templates table - predefined flow templates
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_templates (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        template_data JSONB NOT NULL, -- Complete flow structure
        preview_image_url TEXT,
        is_public BOOLEAN DEFAULT true,
        created_by UUID,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create flow_sharing table - for sharing flows between users
    await client.query(`
      CREATE TABLE IF NOT EXISTS flow_sharing (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        flow_id UUID NOT NULL,
        shared_by UUID NOT NULL,
        shared_with UUID NOT NULL,
        permission_level VARCHAR(50) DEFAULT 'view', -- 'view', 'edit', 'execute'
        shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT true,
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_with) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(flow_id, shared_with)
      )
    `);

    // Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flows_updated_at ON flows(updated_at DESC)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flows_is_active ON flows(is_active)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow_id ON flow_nodes(flow_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_nodes_node_type ON flow_nodes(node_type)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_edges_flow_id ON flow_edges(flow_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_edges_source_target ON flow_edges(source_node_id, target_node_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_id ON flow_executions(flow_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_executions_user_id ON flow_executions(user_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_executions_status ON flow_executions(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_templates_category ON flow_templates(category)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_templates_public ON flow_templates(is_public)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_sharing_flow_id ON flow_sharing(flow_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_flow_sharing_shared_with ON flow_sharing(shared_with)
    `);

    // Create triggers for updated_at timestamps
    await client.query(`
      DROP TRIGGER IF EXISTS update_flows_timestamp ON flows;
      CREATE TRIGGER update_flows_timestamp 
      BEFORE UPDATE ON flows 
      FOR EACH ROW 
      EXECUTE FUNCTION update_timestamp_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_flow_nodes_timestamp ON flow_nodes;
      CREATE TRIGGER update_flow_nodes_timestamp 
      BEFORE UPDATE ON flow_nodes 
      FOR EACH ROW 
      EXECUTE FUNCTION update_timestamp_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_flow_edges_timestamp ON flow_edges;
      CREATE TRIGGER update_flow_edges_timestamp 
      BEFORE UPDATE ON flow_edges 
      FOR EACH ROW 
      EXECUTE FUNCTION update_timestamp_column();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_flow_templates_timestamp ON flow_templates;
      CREATE TRIGGER update_flow_templates_timestamp 
      BEFORE UPDATE ON flow_templates 
      FOR EACH ROW 
      EXECUTE FUNCTION update_timestamp_column();
    `);

    await client.query('COMMIT');
    console.log('Migration 033: Flow Editor tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 033 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop triggers first
    await client.query('DROP TRIGGER IF EXISTS update_flows_timestamp ON flows');
    await client.query('DROP TRIGGER IF EXISTS update_flow_nodes_timestamp ON flow_nodes');
    await client.query('DROP TRIGGER IF EXISTS update_flow_edges_timestamp ON flow_edges');
    await client.query('DROP TRIGGER IF EXISTS update_flow_templates_timestamp ON flow_templates');

    // Drop tables in reverse order (respecting foreign key dependencies)
    await client.query('DROP TABLE IF EXISTS flow_sharing CASCADE');
    await client.query('DROP TABLE IF EXISTS flow_templates CASCADE');
    await client.query('DROP TABLE IF EXISTS flow_executions CASCADE');
    await client.query('DROP TABLE IF EXISTS flow_edges CASCADE');
    await client.query('DROP TABLE IF EXISTS flow_nodes CASCADE');
    await client.query('DROP TABLE IF EXISTS flows CASCADE');

    await client.query('COMMIT');
    console.log('Migration 033: Flow Editor tables dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 033 rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down }; 