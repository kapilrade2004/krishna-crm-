
'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerController');
const callLogCtrl = require('../controllers/callLogController');
const { protect, authorize } = require('../middleware/auth');
const {
  createCustomerRules, updateCustomerRules, lifecycleUpdateRules, validate,
} = require('../validators');

router.use(protect);

router.get('/',    ctrl.getAll);
router.post('/',   createCustomerRules, validate, ctrl.create);
router.delete('/clear-all', authorize('admin', 'super_admin', 'manager'), ctrl.removeAll);
router.post('/bulk-delete', authorize('admin', 'super_admin', 'manager'), ctrl.bulkDelete);
router.post('/bulk-assign', authorize('admin', 'super_admin', 'manager'), ctrl.bulkAssign);
router.post('/export',      authorize('admin', 'super_admin', 'manager', 'ceo'), ctrl.exportCustomers);
router.get('/:id', ctrl.getOne);
router.patch('/:id', updateCustomerRules, validate, ctrl.update);
router.delete('/:id', authorize('admin', 'super_admin', 'manager'), ctrl.remove);
router.get('/:id/orders', ctrl.getOrders);

// WhatsApp opt-in toggle
router.patch('/:id/whatsapp-optin', async (req, res, next) => {
  try {
    const { Customer } = require('../models');
    const { AppError } = require('../utils/errors');
    const { sendSuccess } = require('../utils/response');
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return next(new AppError('Customer not found.', 404));
    const newVal = req.body.whatsapp_opt_in === true || req.body.whatsapp_opt_in === 'true';
    await customer.update({ whatsapp_opt_in: newVal });
    sendSuccess(res, { customer }, `WhatsApp opt-in ${newVal ? 'enabled' : 'disabled'}.`);
  } catch (err) {
    next(err);
  }
});

// CR4 — Post-sale lifecycle journey
router.patch('/:id/lifecycle', lifecycleUpdateRules, validate, ctrl.advanceLifecycle);

// Telecaller — Dispatch store/centre visit
router.post('/:id/dispatch-visit', ctrl.dispatchVisit);

// Telecaller — Update installation help status
router.patch('/:id/installation-status', ctrl.updateInstallationHelpStatus);

// CR2 — Call logs per customer
router.get('/:customerId/call-logs', callLogCtrl.getByCustomer);

module.exports = router;