'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');
const shippingCtrl = require('../controllers/shippingController');
const callLogCtrl = require('../controllers/callLogController');
const { protect, authorize } = require('../middleware/auth');
const {
  createOrderRules, updateStatusRules, updateFlowStageRules, bulkStatusRules,
  updateOrderShippingRules, imageApprovalRules, feedbackResolutionRules, validate,
} = require('../validators');

// ─── Public Image Viewing (for <img> tags in browser without Authorization header) ─
router.get('/images/view', ctrl.viewCustomerImage);
router.get('/images/:imageId/view', ctrl.viewCustomerImage);
router.get('/:id/images/:imageId/view', ctrl.viewCustomerImage);
router.viewCustomerImage = ctrl.viewCustomerImage;

router.use(protect);

// Stats + bulk + export — before /:id routes
router.get('/stats',         ctrl.getStats);
router.patch('/bulk-status', authorize('admin', 'manager'), bulkStatusRules, validate, ctrl.bulkUpdateStatus);
router.post('/bulk-delete',  authorize('admin', 'super_admin', 'manager'), ctrl.bulkDelete);
router.post('/bulk-assign',  authorize('admin', 'super_admin', 'manager'), ctrl.bulkAssign);
router.post('/bulk-send-whatsapp', ctrl.bulkSendWhatsApp);
router.post('/export',       authorize('admin', 'super_admin', 'manager', 'ceo'), ctrl.exportOrders);
router.delete('/clear-all',  authorize('admin', 'super_admin', 'manager'), ctrl.clearAll);

router.get('/',    ctrl.getAll);
router.post('/',   createOrderRules, validate, ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.patch('/:id/status',              updateStatusRules,    validate, ctrl.updateStatus);
router.patch('/:id/verification-status', ctrl.updateVerificationStatus);
router.patch('/:id/flow-stage',          updateFlowStageRules, validate, ctrl.updateFlowStage);
router.patch('/:id/shipping',            updateOrderShippingRules, validate, shippingCtrl.updateOrderShipping);
router.delete('/:id', authorize('admin', 'manager'), ctrl.remove);

// Activity log & verification details
router.get('/:id/activities', ctrl.getActivities);
router.get('/:id/verification-detail', ctrl.getVerificationDetail);
router.get('/:id/whatsapp-logs', ctrl.getOrderWhatsAppLogs);
router.get('/:id/call-logs', callLogCtrl.getByOrder);

// Manual WhatsApp template dispatch
router.post('/:id/send-template', ctrl.sendTemplateForOrder);

// Manual verification actions
router.post('/:id/send-verification', ctrl.sendVerification);
router.post('/:id/sku-match',          ctrl.skuMatch);
router.post('/:id/sku-mismatch',       ctrl.skuMismatch);
router.post('/:id/request-new-image',  ctrl.requestNewImage);
router.post('/:id/mark-unreadable',    ctrl.markUnreadable);
router.post('/:id/send-confirmation',  ctrl.sendConfirmation);
router.post('/:id/customer-confirm',   ctrl.customerConfirm);
router.post('/:id/send-to-exception',  ctrl.sendToException);

// CR1 — Image verification
router.post('/:id/approve-images', imageApprovalRules, validate, ctrl.approveImages);
router.post('/:id/reject-images',  imageApprovalRules, validate, ctrl.rejectImages);
router.get('/:id/images',          ctrl.getOrderImages);
router.patch('/:id/assign-image/:imageId', ctrl.assignImageToOrder);

// CR7 — Feedback resolution
router.patch('/:id/feedback-resolution', feedbackResolutionRules, validate, ctrl.updateFeedbackResolution);

module.exports = router;

