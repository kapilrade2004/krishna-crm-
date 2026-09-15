'use strict';

const express = require('express');
const router = express.Router();
// MODULE DISABLED / COMMENTED OUT OVERALL
/*
const spnAdsController = require('../controllers/spnAdsController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);

router.route('/campaigns')
  .get(checkPermission('spn_ads:view', 'sam:view'), spnAdsController.getCampaigns);

router.route('/campaigns/:id')
  .put(checkPermission('spn_ads:budget'), spnAdsController.updateCampaign);

router.route('/keywords')
  .get(checkPermission('spn_ads:keywords', 'sam:view'), spnAdsController.getKeywords);

router.route('/keywords/:id/migrate-auto')
  .put(checkPermission('spn_ads:keywords'), spnAdsController.migrateAutoToExact);

router.route('/keywords/:id/negative')
  .put(checkPermission('spn_ads:keywords'), spnAdsController.flagNegative);

router.route('/bottom-10-skus')
  .get(checkPermission('spn_ads:sku_audit', 'sam:view'), spnAdsController.getBottom10Skus);
*/

module.exports = router;
