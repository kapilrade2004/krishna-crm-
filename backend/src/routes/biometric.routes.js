'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const biometricController = require('../controllers/biometricController');
const { protect, authorize } = require('../middleware/auth');
const { verifyBiometricWebhook } = require('../middleware/webhookAuth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max file size
});

// ── Public / Hardware Terminal Push Webhooks (Secured via verifyBiometricWebhook)
router.post('/webhook', verifyBiometricWebhook, biometricController.receiveDeviceWebhook);
router.post('/push',    verifyBiometricWebhook, biometricController.receiveDeviceWebhook);

// ── Authenticated CRM Routes ──────────────────────────────────────────────────
router.use(protect);

// Device Management
router.get('/devices',          biometricController.getDevices);
router.post('/devices',         authorize('admin', 'super_admin', 'hr'), biometricController.registerDevice);
router.delete('/devices/:id',    authorize('admin', 'super_admin', 'hr'), biometricController.deleteDevice);
router.post('/devices/:id/test',authorize('admin', 'super_admin', 'hr'), biometricController.testDeviceConnection);

// Sync & Health ("With or Without Wire")
router.post('/sync',                 authorize('admin', 'super_admin', 'hr'), biometricController.triggerSync);
router.post('/pull-data',            authorize('admin', 'super_admin', 'hr'), biometricController.pullDataFromBiomax);
router.get('/pull-data',             authorize('admin', 'super_admin', 'hr'), biometricController.pullDataFromBiomax);
router.get('/sync-state',            biometricController.getSyncState);
router.get('/raw-punches',           biometricController.getRawPunches);
router.post('/upload-logs',          authorize('admin', 'super_admin', 'hr'), upload.single('file'), biometricController.uploadOfflineLogs);
router.post('/auto-map-employees',   authorize('admin', 'super_admin', 'hr'), biometricController.autoMapEmployees);

// Employee Biometric Operations
router.post('/employees/:employeeId/upload',            authorize('admin', 'super_admin', 'hr'), biometricController.uploadEmployeeToDevice);
router.post('/employees/:employeeId/trigger-enrollment',authorize('admin', 'super_admin', 'hr'), biometricController.triggerOnlineEnrollment);

// Shift Rules
router.get('/shifts',           biometricController.getShifts);
router.post('/shifts',          authorize('admin', 'super_admin', 'hr'), biometricController.createShift);
router.put('/shifts/:id',       authorize('admin', 'super_admin', 'hr'), biometricController.updateShift);

module.exports = router;

