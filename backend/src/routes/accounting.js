'use strict';

const express = require('express');
const router = express.Router();
// MODULE DISABLED / COMMENTED OUT OVERALL
/*
const accountingController = require('../controllers/accountingController');
const { protect, checkPermission, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/records')
  .get(checkPermission('accounting:view'), accountingController.getRecords)
  .post(checkPermission('accounting:tally', 'accounting:invoicing', 'accounting:stock_audit'), accountingController.createRecord);

router.route('/cheques')
  .get(checkPermission('accounting:cheques', 'accounting:view'), accountingController.getCheques);

router.route('/cheques/:id/verify')
  .put(checkPermission('accounting:cheques'), accountingController.verifyCheque);

router.route('/dsr-summary')
  .get(checkPermission('accounting:view'), accountingController.getDsrSummary);

router.route('/reset')
  .post(authorize('admin', 'super_admin'), accountingController.resetAccountingData);
*/

module.exports = router;
