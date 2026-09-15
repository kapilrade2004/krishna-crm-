'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dailyActivityController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);

// Backward-compatible alias routing to dailyActivityController
router.get(
  '/assignable-users',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view', 'daily_activities:create', 'daily_tasks:create'),
  ctrl.getAssignableUsers
);

router.get(
  '/analytics',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view', 'employees:view'),
  ctrl.getActivityAnalytics
);

router.get(
  '/',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getDailyActivities
);

router.post(
  '/',
  checkPermission('daily_activities:create', 'daily_tasks:create', 'tasks:create'),
  ctrl.createDailyActivity
);

router.get(
  '/:id',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getDailyActivityById
);

router.patch(
  '/:id/start',
  checkPermission('daily_activities:edit', 'daily_tasks:edit', 'daily_activities:view', 'daily_tasks:view'),
  ctrl.startDailyActivity
);

router.patch(
  '/:id/complete',
  checkPermission('daily_activities:edit', 'daily_tasks:edit', 'daily_activities:view', 'daily_tasks:view'),
  ctrl.completeDailyActivity
);

router.patch(
  '/:id/status',
  checkPermission('daily_activities:edit', 'daily_tasks:edit', 'daily_activities:view', 'daily_tasks:view'),
  ctrl.updateDailyActivityStatus
);

router.patch(
  '/:id',
  checkPermission('daily_activities:edit', 'daily_tasks:edit', 'daily_activities:view', 'daily_tasks:view'),
  ctrl.updateDailyActivityStatus
);

router.get(
  '/:id/history',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getActivityHistory
);

router.delete(
  '/:id',
  checkPermission('daily_activities:delete', 'daily_tasks:delete', 'tasks:delete'),
  ctrl.deleteDailyActivity
);

module.exports = router;
