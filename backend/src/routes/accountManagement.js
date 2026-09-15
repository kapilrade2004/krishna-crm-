'use strict';

const express = require('express');
const router = express.Router();
// MODULE DISABLED / COMMENTED OUT OVERALL
/*
const accountManagementController = require('../controllers/accountManagementController');
const { protect, checkPermission, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/health')
  .get(checkPermission('sam:account_health', 'sam:view'), accountManagementController.getAccountHealth);

router.route('/promotions')
  .get(checkPermission('sam:promotions', 'sam:view'), accountManagementController.getPromotions);

router.route('/profitability')
  .get(checkPermission('sam:profitability', 'sam:view'), accountManagementController.getProfitability);

router.route('/fba-oms')
  .get(checkPermission('sam:fba_oms', 'sam:view'), accountManagementController.getFbaAndOms);

router.route('/reset')
  .post(authorize('admin', 'super_admin'), accountManagementController.resetAccountDepartment);
*/

module.exports = router;
