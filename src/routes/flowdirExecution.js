const express = require('express');
const router = express.Router();
const { requireAuth } = require('./auth');
const {
  createFlowdirExecution,
  updateFlowdirExecution,
  getFlowdirExecutions,
  getFlowdirExecutionById,
  deleteFlowdirExecution
} = require('../controllers/flowdirExecutionController');

// Apply authentication middleware to all routes
router.use(requireAuth);

// Create new FlowDir execution record
router.post('/', createFlowdirExecution);

// Update FlowDir execution with results
router.put('/:executionId', updateFlowdirExecution);

// Get FlowDir execution history for user (with pagination and filtering)
router.get('/', getFlowdirExecutions);

// Get detailed FlowDir execution by ID
router.get('/:executionId', getFlowdirExecutionById);

// Delete FlowDir execution
router.delete('/:executionId', deleteFlowdirExecution);

module.exports = router; 