'use strict';

const express = require('express');
const router = express.Router();
const presenceController = require('../controllers/presenceController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/heartbeat', presenceController.heartbeat);
router.get('/heartbeat',  presenceController.heartbeat);
router.get('/team',       presenceController.getTeamPresence);

module.exports = router;
