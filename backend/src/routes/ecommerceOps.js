'use strict';

const express = require('express');
const router = express.Router();
// MODULE DISABLED / COMMENTED OUT OVERALL
/*
const ecommerceOpsController = require('../controllers/ecommerceOpsController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);

router.route('/cutoff-orders')
  .get(checkPermission('ecommerce:orders', 'ecommerce:view'), ecommerceOpsController.getCutoffOrders);

router.route('/returns')
  .get(checkPermission('ecommerce:returns', 'ecommerce:view'), ecommerceOpsController.getReturnsAndClaims)
  .post(checkPermission('ecommerce:returns'), ecommerceOpsController.createReturnEntry);

router.route('/returns/:id/putaway')
  .put(checkPermission('ecommerce:returns'), ecommerceOpsController.updatePutaway);

router.route('/returns/:id/claim')
  .put(checkPermission('ecommerce:claims'), ecommerceOpsController.fileClaim);

router.route('/fba-shipments')
  .get(checkPermission('ecommerce:fba', 'ecommerce:view'), ecommerceOpsController.getFbaShipments);
*/

module.exports = router;
