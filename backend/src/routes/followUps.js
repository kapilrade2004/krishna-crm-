'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/followUpController');
const { protect, authorize } = require('../middleware/auth');
const { createFollowUpRules, updateFollowUpRules, validate } = require('../validators');

router.use(protect);

router.get('/',    ctrl.getAll);
router.post('/',   createFollowUpRules, validate, ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', updateFollowUpRules, validate, ctrl.update);
router.delete('/:id', authorize('admin', 'manager'), ctrl.remove);

module.exports = router;
