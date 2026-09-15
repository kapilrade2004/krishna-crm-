'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');

router.use(protect);

// ── HR Document Center & Dashboard Widgets (before /:id) ──────────────────────
router.get('/document-center',        authorize('admin', 'super_admin', 'hr'), ctrl.getDocumentCenter);
router.get('/onboarding-dashboard',   authorize('admin', 'super_admin', 'hr', 'manager'), ctrl.getOnboardingDashboard);

// ── Document management global lists ──────────────────────────────────────────
router.get('/documents',              authorize('admin', 'super_admin', 'hr', 'manager'), ctrl.getAllDocuments);
router.get('/documents/stats',        authorize('admin', 'super_admin', 'hr', 'manager'), ctrl.getDocumentStats);
router.patch('/documents/:docId',     authorize('admin', 'super_admin', 'hr'), ctrl.updateDocument);
router.patch('/documents/:docId/request-review', ctrl.requestReview);
router.patch('/documents/:docId/verify', authorize('admin', 'super_admin', 'hr'), ctrl.verifyDocument);
router.delete('/documents/:docId',    authorize('admin', 'super_admin', 'hr'), ctrl.deleteDocument);

// ── Employee CRUD & Directory ─────────────────────────────────────────────────
router.get('/',           authorize('admin', 'super_admin', 'hr', 'manager'), ctrl.getAll);
router.post('/',          authorize('admin', 'super_admin', 'hr'), ctrl.create);
router.get('/departments',ctrl.getDepartments);
router.get('/:id',        ctrl.getOne);
router.patch('/:id',      authorize('admin', 'super_admin', 'hr', 'manager'), ctrl.update);
router.delete('/:id',     authorize('admin', 'super_admin'), ctrl.remove);

// ── Per-employee onboarding & document actions ────────────────────────────────
router.get('/:id/onboarding', ctrl.getOnboardingChecklist);
router.patch('/:id/onboarding', authorize('admin', 'super_admin', 'hr'), ctrl.updateOnboardingStatus);
router.post('/:id/offboard', authorize('admin', 'super_admin', 'hr'), ctrl.offboard);
router.post('/:id/documents', documentUpload.single('file'), ctrl.uploadDocument);
router.post('/:id/documents/:docId/replace', documentUpload.single('file'), ctrl.replaceDocument);
router.get('/:id/documents/:docId/versions', ctrl.getDocumentVersions);
router.get('/:id/documents/:docId/download', ctrl.downloadDocument);

module.exports = router;