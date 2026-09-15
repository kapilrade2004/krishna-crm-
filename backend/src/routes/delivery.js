'use strict';

const express = require('express');
const router = express.Router();
// MODULE DISABLED / COMMENTED OUT OVERALL
/*
const deliveryController = require('../controllers/deliveryController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);

router.route('/run-sheet')
  .get(checkPermission('delivery:view', 'shipping:deliveries'), deliveryController.getRunSheet);

router.route('/deliveries/:id/status')
  .put(checkPermission('delivery:status', 'shipping:deliveries'), deliveryController.updateDeliveryStatus);

router.route('/cheques')
  .get(checkPermission('delivery:cheque_collect', 'delivery:view'), deliveryController.getMyCheques)
  .post(checkPermission('delivery:cheque_collect'), deliveryController.collectCheque);

router.route('/cheques/submit-office')
  .post(checkPermission('delivery:cheque_collect'), deliveryController.submitChequesToOffice);
*/

module.exports = router;
