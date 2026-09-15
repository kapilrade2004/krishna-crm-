'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/warrantyController');
const { protect, authorize } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');

// Public & Internal Warranty Registration (accepts optional invoice file)
const optionalUpload = (req, res, next) => {
  documentUpload.single('purchaseInvoice')(req, res, (err) => {
    next();
  });
};

router.post('/register', optionalUpload, ctrl.registerWarranty);

// Public Order Lookup for Warranty Form Auto-Fill
router.get('/lookup-order', ctrl.lookupOrder);
router.get('/lookup-order/:orderId', ctrl.lookupOrder);

// Public Customer Self-Activation via Signed Expiring Token
router.get('/activate/:token', ctrl.checkActivationToken);
router.post('/activate/:token', ctrl.activateByToken);

// Public Webhooks for Carrier Logistics & Installation
router.post('/webhooks/delivery', ctrl.handleDeliveryWebhook);
router.post('/webhooks/installation', ctrl.handleInstallationWebhook);
router.post('/webhooks/return', ctrl.handleReturnWebhook);

// ── All subsequent routes require authentication ──────────────────────────────
router.use(protect);

// Direct Document View & Download
router.get('/documents/:docId/view', ctrl.viewWarrantyDocument);
router.get('/documents/:docId/download', ctrl.downloadWarrantyDocument);

// Dashboard KPI Stats & List & SKU Customer Lookup
router.get('/stats', ctrl.getDashboardStats);
router.get('/returns', ctrl.getReturnsList);
router.get('/sku-products', ctrl.getProductsSkuList);
router.get('/customers-by-sku', ctrl.getCustomersBySku);
router.get('/customers-by-sku/:sku', ctrl.getCustomersBySku);
router.get('/', ctrl.getWarrantiesList);

// Service Request Details & Technician Job Workflow
router.get('/service-requests/:srId', ctrl.getServiceRequestById);
router.patch('/service-requests/:srId/status', ctrl.updateServiceRequestStatus);

// Returns & Reverse Logistics Workflow Endpoints
router.post('/returns/:id/approve', ctrl.approveReturn);
router.post('/returns/:id/reject', ctrl.rejectReturn);
router.post('/returns/:id/schedule-pickup', ctrl.scheduleReturnPickup);
router.post('/returns/:id/mark-picked-up', ctrl.markReturnPickedUp);
router.post('/returns/:id/mark-received', ctrl.markReturnReceived);
router.post('/returns/:id/inspect', ctrl.inspectReturn);
router.post('/returns/:id/close', ctrl.closeReturn);

// Message Retries
router.post('/messages/:messageId/retry', ctrl.retryWarrantyMessage);

// Single Warranty Detail, Activation, Returns, Reset & Verification
router.get('/:id', ctrl.getWarrantyById);
router.post('/:id/activate', ctrl.activateWarranty);
router.post('/:id/returns', ctrl.requestReturn);
router.post('/:id/reset', ctrl.resetWarranty);
router.patch('/:id/verify', ctrl.verifyWarranty);
router.post('/:id/service-requests', ctrl.createServiceRequest);

module.exports = router;
