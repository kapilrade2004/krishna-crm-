'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/callLogController');
const { protect, authorize } = require('../middleware/auth');
const { createCallLogRules, updateCallLogRules, validate } = require('../validators');

router.use(protect);

router.get('/stats', ctrl.getStats);
router.get('/',      ctrl.getAll);
router.post('/',     createCallLogRules, validate, ctrl.create);
router.patch('/:id', updateCallLogRules, validate, ctrl.update);
router.delete('/:id', authorize('admin', 'manager'), ctrl.remove);

module.exports = router;
