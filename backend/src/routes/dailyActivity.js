'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dailyActivityController');
const { protect, checkPermission } = require('../middleware/auth');

router.use(protect);

// 1. Assignable users list (filtered by role hierarchy)
router.get(
  '/assignable-users',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view', 'daily_activities:create', 'daily_tasks:create'),
  ctrl.getAssignableUsers
);

// 2. Employee Performance Analytics (HR & Super Admin)
router.get(
  '/analytics',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view', 'employees:view'),
  ctrl.getActivityAnalytics
);

// 3. Multi-day timeline overview for calendar strip
router.get(
  '/calendar-overview',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getCalendarOverview
);

// 4. Daily KPI summary for selected date
router.get(
  '/daily-summary',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getDailySummary
);

// 5. Personal productivity scorecard & completed archive
router.get(
  '/scorecard',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getPersonalScorecard
);

// 6. Daily activities list (scoped to user's assigned/created activities, or global for Super Admin)
router.get(
  '/',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getDailyActivities
);

// 6b. Sync mandatory daily routines
router.post(
  '/sync-mandatory',
  ctrl.syncMandatoryTasks
);

// 7. Create and assign new operational activity
router.post(
  '/',
  checkPermission('daily_activities:create', 'daily_tasks:create', 'tasks:create'),
  ctrl.createDailyActivity
);

// 8. Get single activity details with history log
router.get(
  '/:id',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getDailyActivityById
);

// 9. Update activity (Super Admin full edit, Employee status/progress update)
router.put(
  '/:id',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view', 'daily_activities:edit', 'daily_tasks:edit'),
  ctrl.updateDailyActivity
);

router.patch(
  '/:id',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view', 'daily_activities:edit', 'daily_tasks:edit'),
  ctrl.updateDailyActivity
);

// 10. Start activity (ASSIGNED -> IN_PROGRESS - validated by controller ownership)
router.patch(
  '/:id/start',
  ctrl.startDailyActivity
);

// 11. Complete activity (IN_PROGRESS/INCOMPLETE -> COMPLETED/LATE - validated by controller ownership)
router.patch(
  '/:id/complete',
  ctrl.completeDailyActivity
);

// 12. Activity history timeline
router.get(
  '/:id/history',
  checkPermission('daily_activities:view', 'daily_tasks:view', 'tasks:view'),
  ctrl.getActivityHistory
);

// 13. Delete activity
router.delete(
  '/:id',
  checkPermission('daily_activities:delete', 'daily_tasks:delete', 'tasks:delete'),
  ctrl.deleteDailyActivity
);

module.exports = router;
