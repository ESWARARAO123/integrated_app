const { pool } = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new FlowDir execution record
 */
const createFlowdirExecution = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.session.userId;
    const {
      flowId,
      projectName,
      blockName,
      toolName,
      stage,
      runName,
      pdSteps,
      referenceRun,
      workingDirectory,
      centralScriptsDirectory,
      mcpServerUrl
    } = req.body;

    // Generate unique execution ID
    const executionId = uuidv4();

    const query = `
      INSERT INTO flowdir_executions (
        user_id, flow_id, execution_id, project_name, block_name, 
        tool_name, stage, run_name, pd_steps, reference_run,
        working_directory, central_scripts_directory, mcp_server_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, execution_id, started_at
    `;

    const values = [
      userId, flowId, executionId, projectName, blockName,
      toolName, stage, runName, pdSteps, referenceRun,
      workingDirectory, centralScriptsDirectory, mcpServerUrl
    ];

    const result = await client.query(query, values);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating FlowDir execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create FlowDir execution record'
    });
  } finally {
    client.release();
  }
};

/**
 * Update FlowDir execution with results
 */
const updateFlowdirExecution = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { executionId } = req.params;
    const {
      success,
      executionTimeMs,
      totalDirectoriesCreated,
      totalFilesCreated,
      totalSymlinksCreated,
      summary,
      createdPaths,
      logs,
      errorMessage
    } = req.body;

    const query = `
      UPDATE flowdir_executions 
      SET 
        success = $1,
        execution_time_ms = $2,
        total_directories_created = $3,
        total_files_created = $4,
        total_symlinks_created = $5,
        summary = $6,
        created_paths = $7,
        logs = $8,
        error_message = $9,
        completed_at = CURRENT_TIMESTAMP
      WHERE execution_id = $10 AND user_id = $11
      RETURNING id, execution_id, success, completed_at
    `;

    const values = [
      success,
      executionTimeMs,
      totalDirectoriesCreated,
      totalFilesCreated,
      totalSymlinksCreated,
      JSON.stringify(summary),
      JSON.stringify(createdPaths),
      JSON.stringify(logs),
      errorMessage,
      executionId,
      req.session.userId
    ];

    const result = await client.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'FlowDir execution not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating FlowDir execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update FlowDir execution record'
    });
  } finally {
    client.release();
  }
};

/**
 * Get FlowDir execution history for user
 */
const getFlowdirExecutions = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.session.userId;
    const { limit = 50, offset = 0, projectName, success } = req.query;

    let query = `
      SELECT
        id, execution_id, flow_id, project_name, block_name, tool_name,
        stage, run_name, success, execution_time_ms,
        total_directories_created, total_files_created, total_symlinks_created,
        summary, created_paths, logs,
        started_at, completed_at, error_message
      FROM flowdir_executions
      WHERE user_id = $1
    `;
    
    const values = [userId];
    let paramCount = 1;

    if (projectName) {
      paramCount++;
      query += ` AND project_name ILIKE $${paramCount}`;
      values.push(`%${projectName}%`);
    }

    if (success !== undefined) {
      paramCount++;
      query += ` AND success = $${paramCount}`;
      values.push(success === 'true');
    }

    query += ` ORDER BY started_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(parseInt(limit), parseInt(offset));

    console.log('Executing FlowDir executions query:', query);
    console.log('Query values:', values);

    const result = await client.query(query, values);
    console.log('Query result rows:', result.rows.length);

    // Parse JSON fields for each execution
    const executions = result.rows.map(execution => {
      const parsed = { ...execution };

      // Safely parse JSON fields
      try {
        if (parsed.summary && typeof parsed.summary === 'string') {
          parsed.summary = JSON.parse(parsed.summary);
        }
      } catch (e) {
        console.warn('Failed to parse summary JSON:', e);
        parsed.summary = null;
      }

      try {
        if (parsed.created_paths && typeof parsed.created_paths === 'string') {
          parsed.created_paths = JSON.parse(parsed.created_paths);
        }
      } catch (e) {
        console.warn('Failed to parse created_paths JSON:', e);
        parsed.created_paths = null;
      }

      try {
        if (parsed.logs && typeof parsed.logs === 'string') {
          parsed.logs = JSON.parse(parsed.logs);
        }
      } catch (e) {
        console.warn('Failed to parse logs JSON:', e);
        parsed.logs = null;
      }

      return parsed;
    });

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM flowdir_executions
      WHERE user_id = $1
      ${projectName ? `AND project_name ILIKE '%${projectName}%'` : ''}
      ${success !== undefined ? `AND success = ${success === 'true'}` : ''}
    `;

    const countResult = await client.query(countQuery, [userId]);

    res.json({
      success: true,
      data: {
        executions: executions,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching FlowDir executions:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FlowDir execution history',
      details: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Get detailed FlowDir execution by ID
 */
const getFlowdirExecutionById = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { executionId } = req.params;
    const userId = req.session.userId;

    const query = `
      SELECT * FROM flowdir_executions 
      WHERE execution_id = $1 AND user_id = $2
    `;

    const result = await client.query(query, [executionId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'FlowDir execution not found'
      });
    }

    // Parse JSON fields
    const execution = result.rows[0];
    if (execution.summary) execution.summary = JSON.parse(execution.summary);
    if (execution.created_paths) execution.created_paths = JSON.parse(execution.created_paths);
    if (execution.logs) execution.logs = JSON.parse(execution.logs);

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    console.error('Error fetching FlowDir execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FlowDir execution details'
    });
  } finally {
    client.release();
  }
};

/**
 * Delete FlowDir execution
 */
const deleteFlowdirExecution = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { executionId } = req.params;
    const userId = req.session.userId;

    const query = `
      DELETE FROM flowdir_executions 
      WHERE execution_id = $1 AND user_id = $2
      RETURNING id
    `;

    const result = await client.query(query, [executionId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'FlowDir execution not found'
      });
    }

    res.json({
      success: true,
      message: 'FlowDir execution deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting FlowDir execution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete FlowDir execution'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  createFlowdirExecution,
  updateFlowdirExecution,
  getFlowdirExecutions,
  getFlowdirExecutionById,
  deleteFlowdirExecution
}; 