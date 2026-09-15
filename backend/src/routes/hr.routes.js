'use strict';

const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');
const attendanceController = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Attendance routes
router.get('/attendance',                  attendanceController.getDailyAttendanceRoster);
router.get('/attendance/me',               attendanceController.getMyAttendance);
router.post('/attendance/clock-in',         hrController.clockIn);
router.post('/attendance/clock-out',        hrController.clockOut);
router.get('/attendance/employee/:id',     attendanceController.getEmployeeAttendanceHistory);

// Attendance Corrections
router.get('/attendance/corrections',      attendanceController.getCorrections);
router.post('/attendance/corrections',     attendanceController.requestCorrection);
router.post('/attendance/corrections/:id/review', authorize('admin', 'super_admin', 'hr'), attendanceController.reviewCorrection);
router.post('/attendance/recalculate',     authorize('admin', 'super_admin', 'hr'), attendanceController.recalculateAttendance);

// Payroll routes (HR, Super Admin, Manager)
router.get('/payroll',          authorize('admin', 'super_admin', 'manager', 'hr'), hrController.getPayroll);
router.post('/payroll/calculate',authorize('admin', 'super_admin', 'manager', 'hr'), hrController.calculatePayroll);

// Policies routes
router.get('/policies',  hrController.getPolicies);
router.post('/policies', authorize('admin', 'super_admin', 'hr'), hrController.createPolicy);

module.exports = router;
