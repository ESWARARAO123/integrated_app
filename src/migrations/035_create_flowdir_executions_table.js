/**
 * Migration to create flowdir_executions table
 */

const { pool } = require('../database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS flowdir_executions (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        flow_id VARCHAR(255), -- Optional: Link to specific flow if available
        execution_id VARCHAR(255) UNIQUE NOT NULL, -- Unique execution ID from API
        
        -- Project parameters
        project_name VARCHAR(255) NOT NULL,
        block_name VARCHAR(255) NOT NULL,
        tool_name VARCHAR(50) NOT NULL CHECK (tool_name IN ('cadence', 'synopsys')),
        stage VARCHAR(50) NOT NULL,
        run_name VARCHAR(255) NOT NULL,
        pd_steps VARCHAR(255),
        reference_run VARCHAR(255),
        
        -- Directory paths
        working_directory TEXT,
        central_scripts_directory TEXT,
        
        -- MCP configuration
        mcp_server_url TEXT NOT NULL,
        
        -- Execution results
        success BOOLEAN NOT NULL DEFAULT false,
        execution_time_ms INTEGER,
        total_directories_created INTEGER DEFAULT 0,
        total_files_created INTEGER DEFAULT 0,
        total_symlinks_created INTEGER DEFAULT 0,
        
        -- Detailed results (JSON)
        summary JSONB,
        created_paths JSONB,
        logs JSONB,
        error_message TEXT,
        
        -- Timestamps
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE,
        
        -- Constraints
        CONSTRAINT fk_flowdir_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_flowdir_executions_user_id ON flowdir_executions(user_id);
      CREATE INDEX IF NOT EXISTS idx_flowdir_executions_execution_id ON flowdir_executions(execution_id);
      CREATE INDEX IF NOT EXISTS idx_flowdir_executions_project ON flowdir_executions(project_name, block_name);
      CREATE INDEX IF NOT EXISTS idx_flowdir_executions_started_at ON flowdir_executions(started_at);
      CREATE INDEX IF NOT EXISTS idx_flowdir_executions_success ON flowdir_executions(success);
      
      -- Add trigger for updating completed_at
      CREATE OR REPLACE FUNCTION update_flowdir_completed_at()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.success IS DISTINCT FROM OLD.success OR 
           NEW.error_message IS DISTINCT FROM OLD.error_message THEN
          NEW.completed_at = CURRENT_TIMESTAMP;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      DROP TRIGGER IF EXISTS trigger_update_flowdir_completed_at ON flowdir_executions;
      CREATE TRIGGER trigger_update_flowdir_completed_at
        BEFORE UPDATE ON flowdir_executions
        FOR EACH ROW
        EXECUTE FUNCTION update_flowdir_completed_at();
    `);

    await client.query('COMMIT');
    console.log('Migration 035: FlowDir executions table created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 035 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DROP TRIGGER IF EXISTS trigger_update_flowdir_completed_at ON flowdir_executions');
    await client.query('DROP FUNCTION IF EXISTS update_flowdir_completed_at()');
    await client.query('DROP TABLE IF EXISTS flowdir_executions CASCADE');

    await client.query('COMMIT');
    console.log('Migration 035: FlowDir executions table dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 035 rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down }; 