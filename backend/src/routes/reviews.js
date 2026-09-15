'use strict';

const express = require('express');
const router = express.Router();
// MODULE DISABLED / COMMENTED OUT OVERALL
/*
const reviewController = require('../controllers/reviewController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(checkPermission('reviews:view', 'telecaller:reviews'), reviewController.getReviews)
  .post(checkPermission('reviews:create', 'telecaller:easyship'), reviewController.createReview);

router.route('/:id/moderate')
  .put(checkPermission('reviews:verify'), reviewController.moderateReview);

router.route('/:id')
  .delete(checkPermission('reviews:delete'), reviewController.deleteReview);
*/

module.exports = router;
