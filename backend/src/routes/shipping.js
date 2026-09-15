'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/shippingController');
const { protect, authorize } = require('../middleware/auth');
const { csvUpload } = require('../middleware/upload');
const {
  createShippingPartnerRules, updateShippingPartnerRules,
  createServiceabilityRules, updateServiceabilityRules, bulkServiceabilityRules,
  validate,
} = require('../validators');

router.use(protect);

// ── Shipping operations dashboard & shipments tracking ────────────────────────
router.get('/dashboard', ctrl.getShippingDashboard);
router.get('/shipments', ctrl.getShipments);
router.post('/bulk-upload', authorize('admin', 'manager', 'sales', 'telecaller'), csvUpload.single('file'), ctrl.bulkUploadShipments);


// ── Shipping Partners ───────────────────────────────────────────────────────────
router.get('/partners', ctrl.getPartners);
router.post('/partners', authorize('admin', 'manager'), createShippingPartnerRules, validate, ctrl.createPartner);
router.get('/partners/:id', ctrl.getPartner);
router.patch('/partners/:id', authorize('admin', 'manager'), updateShippingPartnerRules, validate, ctrl.updatePartner);
router.delete('/partners/:id', authorize('admin', 'manager'), ctrl.deletePartner);

// ── Pincode Serviceability ──────────────────────────────────────────────────────
// Public lookup (any authenticated user) — used during order processing
router.get('/serviceability', ctrl.checkServiceability);

// Management list + CRUD (admin/manager)
router.get('/serviceability/list', authorize('admin', 'manager'), ctrl.getServiceabilityList);
router.post('/serviceability', authorize('admin', 'manager'), createServiceabilityRules, validate, ctrl.createServiceability);
router.post('/serviceability/bulk', authorize('admin', 'manager'), bulkServiceabilityRules, validate, ctrl.bulkCreateServiceability);
router.patch('/serviceability/:id', authorize('admin', 'manager'), updateServiceabilityRules, validate, ctrl.updateServiceability);
router.delete('/serviceability/:id', authorize('admin', 'manager'), ctrl.deleteServiceability);

module.exports = router;
