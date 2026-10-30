const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { requireAdmin } = require('../middleware/auth.middleware');

router.get('/', settingsController.getSettings);
router.get('/hours', settingsController.getWorkingHours);
router.put('/', requireAdmin, settingsController.updateSettings);

module.exports = router;
