const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getFlowEditorSettings,
  saveFlowEditorSettings,
  resetFlowEditorSettings,
} = require('../controllers/flowEditorSettingsController');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/flow-editor-settings - Get user's flow editor settings
router.get('/', getFlowEditorSettings);

// POST /api/flow-editor-settings - Save or update user's flow editor settings
router.post('/', saveFlowEditorSettings);

// DELETE /api/flow-editor-settings - Reset user's flow editor settings to defaults
router.delete('/', resetFlowEditorSettings);

module.exports = router; 