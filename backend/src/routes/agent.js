'use strict';

const express = require('express');
const router = express.Router();
const agentIntelligenceController = require('../controllers/agentIntelligenceController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/system-map')
  .get(agentIntelligenceController.getSystemMap);

router.route('/context')
  .get(agentIntelligenceController.getContext);

module.exports = router;
