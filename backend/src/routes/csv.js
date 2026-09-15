'use strict';
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/csvController');
const { protect, authorize } = require('../middleware/auth');
const { csvUpload } = require('../middleware/upload');

router.use(protect);

// Marketplace order import (Amazon / Flipkart / IndiaMart)
router.post('/upload',
  authorize('admin', 'manager', 'sales'),
  csvUpload.single('file'),
  ctrl.upload
);

router.post('/delivery-upload',
  authorize('admin', 'manager'),
  csvUpload.single('file'),
  ctrl.uploadDeliveryCsv
);

router.get('/batches',     ctrl.getBatches);
router.get('/batches/:id', ctrl.getBatch);

module.exports = router;
