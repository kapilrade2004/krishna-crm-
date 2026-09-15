'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/kpis', ctrl.getKpis);
router.get('/ceo', authorize('admin', 'ceo', 'manager'), ctrl.getCeoView);

module.exports = router;
