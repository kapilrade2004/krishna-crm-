'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/taskController');
const { protect, authorize } = require('../middleware/auth');
const { createTaskRules, updateTaskRules, taskScoreRules, validate } = require('../validators');

router.use(protect);

// Dashboard + score-dashboard must come before /:id routes
router.get('/dashboard',       ctrl.getDashboard);
router.get('/score-dashboard', authorize('admin', 'super_admin', 'manager', 'ceo'), ctrl.getScoreDashboard);
router.get('/unscored',        authorize('admin', 'super_admin', 'manager'), ctrl.getUnscored);

router.get('/',    ctrl.getAll);
router.post('/',   createTaskRules, validate, ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', updateTaskRules, validate, ctrl.update);
router.patch('/:id/score', authorize('admin', 'super_admin', 'manager'), taskScoreRules, validate, ctrl.setScore);
router.delete('/:id', authorize('admin', 'super_admin', 'manager'), ctrl.remove);

module.exports = router;
