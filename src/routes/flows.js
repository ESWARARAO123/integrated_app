const express = require('express');
const { pool } = require('../database');

const router = express.Router();

// Middleware to check if user is authenticated (session-based like other routes)
const authenticateToken = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Apply authentication middleware to all flow routes
router.use(authenticateToken);

/**
 * Save a flow (create or update)
 * POST /api/flows
 */
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { 
      id, 
      name, 
      description, 
      nodes, 
      edges, 
      viewport, 
      workspaceSettings,
      isAutoSave = false 
    } = req.body;
    
    const userId = req.session.userId;
    
    // Prepare canvas state
    const canvasState = {
      viewport: viewport || { x: 0, y: 0, zoom: 1 },
      lastSaved: new Date().toISOString(),
      nodeCount: nodes?.length || 0,
      edgeCount: edges?.length || 0
    };

    let flowId;
    let flow;

    if (id) {
      // Update existing flow
      const updateResult = await client.query(`
        UPDATE flows 
        SET name = $1, description = $2, canvas_state = $3, workspace_settings = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 AND user_id = $6
        RETURNING *
      `, [name, description, canvasState, workspaceSettings || {}, id, userId]);
      
      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Flow not found or access denied' });
      }
      
      flow = updateResult.rows[0];
      flowId = id;
      
      // Delete existing nodes and edges
      await client.query('DELETE FROM flow_edges WHERE flow_id = $1', [flowId]);
      await client.query('DELETE FROM flow_nodes WHERE flow_id = $1', [flowId]);
    } else {
      // Create new flow
      const flowResult = await client.query(`
        INSERT INTO flows (user_id, name, description, canvas_state, workspace_settings)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [userId, name, description, canvasState, workspaceSettings || {}]);
      
      flow = flowResult.rows[0];
      flowId = flow.id;
    }

    // Save nodes
    if (nodes && nodes.length > 0) {
      for (const node of nodes) {
        await client.query(`
          INSERT INTO flow_nodes (
            flow_id, node_id, node_type, position_x, position_y, 
            width, height, data, style, class_name, draggable, 
            selectable, deletable, z_index
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          flowId,
          node.id,
          node.type,
          node.position?.x || 0,
          node.position?.y || 0,
          node.width,
          node.height,
          node.data || {},
          node.style || {},
          node.className,
          node.draggable !== false,
          node.selectable !== false,
          node.deletable !== false,
          node.zIndex || 0
        ]);
      }
    }

    // Save edges
    if (edges && edges.length > 0) {
      for (const edge of edges) {
        await client.query(`
          INSERT INTO flow_edges (
            flow_id, edge_id, source_node_id, target_node_id,
            source_handle, target_handle, edge_type, animated,
            style, label, label_style, marker_end, data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          flowId,
          edge.id,
          edge.source,
          edge.target,
          edge.sourceHandle,
          edge.targetHandle,
          edge.type || 'default',
          edge.animated || false,
          edge.style || {},
          edge.label,
          edge.labelStyle || {},
          edge.markerEnd || {},
          edge.data || {}
        ]);
      }
    }

    await client.query('COMMIT');
    
    res.json({
      id: flowId,
      name: flow.name,
      description: flow.description,
      created_at: flow.created_at,
      updated_at: flow.updated_at,
      canvas_state: flow.canvas_state,
      workspace_settings: flow.workspace_settings,
      message: isAutoSave ? 'Flow auto-saved successfully' : 'Flow saved successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving flow:', error);
    res.status(500).json({ error: 'Failed to save flow', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * Auto-save endpoint for background saves
 * POST /api/flows/autosave
 */
router.post('/autosave', async (req, res) => {
  try {
    // Reuse the main save logic but mark as auto-save
    req.body.isAutoSave = true;
    req.body.name = req.body.name || 'Auto-saved Flow';
    
    // Forward to main save handler
    return router.stack[1].handle(req, res);
  } catch (error) {
    console.error('Auto-save error:', error);
    res.status(500).json({ error: 'Auto-save failed' });
  }
});

/**
 * Get all flows for the authenticated user
 * GET /api/flows
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { limit = 50, offset = 0, search = '' } = req.query;
    
    console.log('🔍 GET /api/flows - User ID:', userId);
    console.log('🔍 Query params:', { limit, offset, search });
    
    // Debug: Check total flows for this user
    const debugResult = await pool.query('SELECT id, name, user_id, updated_at FROM flows WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC', [userId]);
    console.log('🔍 Debug - Total flows for user:', debugResult.rows.length);
    console.log('🔍 Debug - Flow names:', debugResult.rows.map(f => f.name));
    
    let query = `
      SELECT 
        f.*,
        COALESCE(node_counts.node_count, 0) as node_count,
        COALESCE(edge_counts.edge_count, 0) as edge_count
      FROM flows f
      LEFT JOIN (
        SELECT flow_id, COUNT(*) as node_count 
        FROM flow_nodes 
        GROUP BY flow_id
      ) node_counts ON f.id = node_counts.flow_id
      LEFT JOIN (
        SELECT flow_id, COUNT(*) as edge_count 
        FROM flow_edges 
        GROUP BY flow_id
      ) edge_counts ON f.id = edge_counts.flow_id
      WHERE f.user_id = $1 AND f.is_active = true
    `;
    
    const params = [userId];
    
    if (search) {
      query += ` AND (f.name ILIKE $${params.length + 1} OR f.description ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }
    
    query += `
      ORDER BY f.updated_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    console.log('📊 Database query result - rows found:', result.rows.length);
    console.log('📊 First few flows:', result.rows.slice(0, 3).map(f => ({ id: f.id, name: f.name, updated_at: f.updated_at })));
    
    const mappedFlows = result.rows.map(flow => ({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      created_at: flow.created_at,
      updated_at: flow.updated_at,
      last_executed_at: flow.last_executed_at,
      execution_count: flow.execution_count,
      node_count: parseInt(flow.node_count) || 0,
      edge_count: parseInt(flow.edge_count) || 0,
      canvas_state: flow.canvas_state
    }));
    
    console.log('📤 Sending response with', mappedFlows.length, 'flows');
    res.json(mappedFlows);

  } catch (error) {
    console.error('Error fetching flows:', error);
    res.status(500).json({ error: 'Failed to fetch flows' });
  }
});

/**
 * Load a specific flow with all its nodes and edges
 * GET /api/flows/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const flowId = req.params.id;
    const userId = req.session.userId;
    
    // Get flow details
    const flowResult = await pool.query(`
      SELECT * FROM flows 
      WHERE id = $1 AND user_id = $2 AND is_active = true
    `, [flowId, userId]);
    
    if (flowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Flow not found or access denied' });
    }
    
    const flow = flowResult.rows[0];
    
    // Get nodes
    const nodesResult = await pool.query(`
      SELECT * FROM flow_nodes 
      WHERE flow_id = $1 
      ORDER BY created_at ASC
    `, [flowId]);
    
    // Get edges
    const edgesResult = await pool.query(`
      SELECT * FROM flow_edges 
      WHERE flow_id = $1 
      ORDER BY created_at ASC
    `, [flowId]);
    
    // Transform nodes to React Flow format
    const nodes = nodesResult.rows.map(node => ({
      id: node.node_id,
      type: node.node_type,
      position: { x: node.position_x, y: node.position_y },
      data: node.data,
      style: node.style,
      className: node.class_name,
      draggable: node.draggable,
      selectable: node.selectable,
      deletable: node.deletable,
      zIndex: node.z_index,
      width: node.width,
      height: node.height
    }));
    
    // Transform edges to React Flow format
    const edges = edgesResult.rows.map(edge => ({
      id: edge.edge_id,
      source: edge.source_node_id,
      target: edge.target_node_id,
      sourceHandle: edge.source_handle,
      targetHandle: edge.target_handle,
      type: edge.edge_type,
      animated: edge.animated,
      style: edge.style,
      label: edge.label,
      labelStyle: edge.label_style,
      markerEnd: edge.marker_end,
      data: edge.data
    }));
    
    res.json({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      nodes,
      edges,
      canvas_state: flow.canvas_state,
      workspace_settings: flow.workspace_settings,
      created_at: flow.created_at,
      updated_at: flow.updated_at,
      last_executed_at: flow.last_executed_at,
      execution_count: flow.execution_count
    });

  } catch (error) {
    console.error('Error loading flow:', error);
    res.status(500).json({ error: 'Failed to load flow' });
  }
});

/**
 * Delete a flow
 * DELETE /api/flows/:id
 */
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const flowId = req.params.id;
    const userId = req.session.userId;
    
    // Verify ownership and delete
    const result = await client.query(`
      UPDATE flows 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2 AND is_active = true
      RETURNING id, name
    `, [flowId, userId]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flow not found or access denied' });
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      message: 'Flow deleted successfully', 
      id: result.rows[0].id,
      name: result.rows[0].name
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting flow:', error);
    res.status(500).json({ error: 'Failed to delete flow' });
  } finally {
    client.release();
  }
});

/**
 * Record flow execution
 * POST /api/flows/:id/execute
 */
router.post('/:id/execute', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const flowId = req.params.id;
    const userId = req.session.userId;
    const { inputData = {}, executionLogs = [] } = req.body;
    
    // Verify flow ownership
    const flowCheck = await client.query(`
      SELECT id FROM flows 
      WHERE id = $1 AND user_id = $2 AND is_active = true
    `, [flowId, userId]);
    
    if (flowCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Flow not found or access denied' });
    }
    
    // Create execution record
    const executionResult = await client.query(`
      INSERT INTO flow_executions (flow_id, user_id, status, input_data, execution_logs)
      VALUES ($1, $2, 'running', $3, $4)
      RETURNING id
    `, [flowId, userId, inputData, executionLogs]);
    
    const executionId = executionResult.rows[0].id;
    
    // Update flow execution count
    await client.query(`
      UPDATE flows 
      SET execution_count = execution_count + 1, last_executed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [flowId]);
    
    await client.query('COMMIT');
    
    res.json({ 
      executionId,
      message: 'Flow execution started',
      status: 'running'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting flow execution:', error);
    res.status(500).json({ error: 'Failed to start flow execution' });
  } finally {
    client.release();
  }
});

/**
 * Update flow execution status
 * PUT /api/flows/executions/:executionId
 */
router.put('/executions/:executionId', async (req, res) => {
  try {
    const executionId = req.params.executionId;
    const userId = req.session.userId;
    const { 
      status, 
      outputData, 
      errorMessage, 
      executionLogs, 
      executionTimeMs,
      nodeExecutionOrder 
    } = req.body;
    
    const result = await pool.query(`
      UPDATE flow_executions 
      SET 
        status = $1,
        completed_at = CASE WHEN $1 IN ('completed', 'failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END,
        output_data = COALESCE($2, output_data),
        error_message = $3,
        execution_logs = COALESCE($4, execution_logs),
        execution_time_ms = COALESCE($5, execution_time_ms),
        node_execution_order = COALESCE($6, node_execution_order)
      WHERE id = $7 AND user_id = $8
      RETURNING *
    `, [status, outputData, errorMessage, executionLogs, executionTimeMs, nodeExecutionOrder, executionId, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Execution not found or access denied' });
    }
    
    res.json({ 
      message: 'Execution updated successfully',
      execution: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating execution:', error);
    res.status(500).json({ error: 'Failed to update execution' });
  }
});

/**
 * Get flow execution history
 * GET /api/flows/:id/executions
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const flowId = req.params.id;
    const userId = req.session.userId;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await pool.query(`
      SELECT fe.* FROM flow_executions fe
      JOIN flows f ON fe.flow_id = f.id
      WHERE fe.flow_id = $1 AND f.user_id = $2
      ORDER BY fe.started_at DESC
      LIMIT $3 OFFSET $4
    `, [flowId, userId, limit, offset]);
    
    res.json(result.rows);

  } catch (error) {
    console.error('Error fetching execution history:', error);
    res.status(500).json({ error: 'Failed to fetch execution history' });
  }
});

module.exports = router; 