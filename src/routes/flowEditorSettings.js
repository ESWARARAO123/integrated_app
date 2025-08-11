const express = require('express');
const router = express.Router();
const {
  getFlowEditorSettings,
  saveFlowEditorSettings,
  resetFlowEditorSettings,
} = require('../controllers/flowEditorSettingsController');

// Middleware to check if user is authenticated
const authenticateToken = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/flow-editor-settings - Get user's flow editor settings
router.get('/', getFlowEditorSettings);

// POST /api/flow-editor-settings - Save or update user's flow editor settings
router.post('/', saveFlowEditorSettings);

// DELETE /api/flow-editor-settings - Reset user's flow editor settings to defaults
router.delete('/', resetFlowEditorSettings);

module.exports = router; 