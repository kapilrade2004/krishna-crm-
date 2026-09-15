'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/employeeAuditController');
const { protect, authorize } = require('../middleware/auth');

// All audit routes require authentication and authorized manager/HR/Admin role
router.use(protect);
router.use(authorize('admin', 'super_admin', 'hr', 'manager'));

router.get('/employees', ctrl.getEmployees);
router.get('/:employeeId', ctrl.getEmployeeProfile);
router.get('/:employeeId/metrics', ctrl.getMetrics);
router.get('/:employeeId/daily-breakdown', ctrl.getDailyBreakdown);
router.get('/:employeeId/activity', ctrl.getActivityTimeline);
router.get('/:employeeId/export', ctrl.exportAudit);

module.exports = router;
