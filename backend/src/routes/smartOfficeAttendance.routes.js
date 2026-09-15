'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/smartOfficeAttendanceController');
const { protect, authorize } = require('../middleware/auth');

// All attendance routes require valid CRM login
router.use(protect);

// ── SmartOffice Administrative & Sync Endpoints (Must precede param routes) ──
router.get('/smartoffice/status',    controller.getSmartOfficeStatus);
router.get('/smartoffice/sync-runs', controller.getSmartOfficeSyncRuns);
router.post('/smartoffice/sync',     authorize('admin', 'super_admin', 'hr'), controller.triggerSmartOfficeSync);
router.post('/smartoffice/map-employee', authorize('admin', 'super_admin', 'hr'), controller.mapEmployee);

// ── Raw Event Query ──
router.get('/events', controller.getAttendanceEvents);

// ── Daily Attendance Roster & Employee Detail ──
router.get('/',            controller.getAttendance);
router.get('/:employeeId', controller.getEmployeeAttendance);

module.exports = router;
