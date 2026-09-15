'use strict';

const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Profile
router.get('/profile/:employeeId', payrollController.getPayrollProfile);
router.post('/profile/:employeeId', authorize('admin', 'super_admin', 'hr'), payrollController.upsertPayrollProfile);

// Records & Slips
router.get('/records', payrollController.getPayrollRecords);
router.post('/records', authorize('admin', 'super_admin', 'hr'), payrollController.createPayrollRecord);
router.patch('/records/:id/status', authorize('admin', 'super_admin', 'hr'), payrollController.updatePayrollRecordStatus);

// History
router.get('/history/:employeeId', payrollController.getEmployeePayrollHistory);

module.exports = router;
