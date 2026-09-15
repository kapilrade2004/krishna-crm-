'use strict';

const { Op } = require('sequelize');
const { DailyActivity, DailyActivityHistory, User, Employee } = require('../models');
const { createAuditEvent } = require('../services/auditService');
const { evaluateSingleActivity } = require('../services/activityShiftScheduler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../config/logger');

function getFormattedDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

/**
 * Role & Permission-Based Assignment Authorization Rule Matrix:
 * - Super Admin: All users
 * - Manager / HR / Custom Roles with create permission: All users except Super Admin / Admin
 * - Telecaller: All users including Super Admin / Admin
 * - Sales (without explicit create permission): Cannot assign Daily Activities
 */
const canAssignDailyActivityTo = (assignerRole, targetRole, assignerPerms = []) => {
  const normAssigner = (assignerRole || '').toLowerCase().trim();
  const normTarget = (targetRole || '').toLowerCase().trim();
  const isTargetAdmin =
    normTarget === 'super_admin' || normTarget === 'admin' || normTarget === 'super admin';

  // Telecaller & Super Admin can assign to ALL users
  if (
    normAssigner === 'telecaller' ||
    normAssigner === 'super_admin' ||
    normAssigner === 'admin' ||
    normAssigner === 'super admin' ||
    assignerPerms.includes('*')
  ) {
    return true;
  }

  // Manager & HR can assign to all users EXCEPT Super Admin / Admin
  if (normAssigner === 'manager' || normAssigner === 'hr') {
    return !isTargetAdmin;
  }

  // Users with daily_activities:create or daily_tasks:create permission
  if (
    assignerPerms.includes('daily_activities:create') ||
    assignerPerms.includes('daily_tasks:create') ||
    assignerPerms.includes('tasks:create')
  ) {
    return !isTargetAdmin;
  }

  // Sales without override cannot assign
  if (normAssigner === 'sales') {
    return false;
  }

  // Default for recognized custom roles with permissions
  return !isTargetAdmin;
};

/**
 * GET /api/daily-activities/assignable-users
 */
exports.getAssignableUsers = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userPerms = req.user.permissions || [];
    const hasCreatePerm =
      userPerms.includes('*') ||
      userPerms.includes('daily_activities:create') ||
      userPerms.includes('daily_tasks:create') ||
      userPerms.includes('tasks:create');

    if (userRole === 'sales' && !hasCreatePerm) {
      return sendSuccess(res, [], 'Sales role is not permitted to assign daily activities.');
    }

    const allUsers = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'],
      order: [['name', 'ASC']],
    });

    const assignable = allUsers.filter((u) => canAssignDailyActivityTo(userRole, u.role, userPerms));

    return sendSuccess(res, assignable, 'Assignable users retrieved successfully.');
  } catch (error) {
    logger.error('Error fetching assignable users for daily activities:', error);
    return sendError(res, 'Failed to fetch assignable users', 500, error.message);
  }
};

/**
 * GET /api/daily-activities/calendar-overview
 * Multi-day task distribution (-6 days to +7 days) for the interactive timeline selector
 */
exports.getCalendarOverview = async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin =
      userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || req.user.permissions?.includes('*');
    const isManagerOrHr = userRole === 'manager' || userRole === 'hr';

    const targetUserId = req.query.user_id && (isSuperAdmin || isManagerOrHr) ? req.query.user_id : req.user.id;

    // Support dynamic date ranges for full calendar display
    let startDate = req.query.start_date;
    let endDate = req.query.end_date;

    if (!startDate || !endDate) {
      if (req.query.month) {
        // e.g. "2026-08" -> full month + padding
        const [y, m] = req.query.month.split('-').map(Number);
        const firstDay = new Date(y, m - 1, 1);
        const lastDay = new Date(y, m, 0);
        startDate = new Date(firstDay.setDate(firstDay.getDate() - 7)).toISOString().split('T')[0];
        endDate = new Date(lastDay.setDate(lastDay.getDate() + 7)).toISOString().split('T')[0];
      } else {
        // Default wide window covering full active months (-60 days to +60 days)
        startDate = getFormattedDate(-60);
        endDate = getFormattedDate(60);
      }
    }

    const where = {};

    if (!isSuperAdmin || req.query.user_id) {
      where.assigned_to = targetUserId;
    }

    const activities = await DailyActivity.findAll({
      where,
      attributes: ['id', 'status', 'scheduled_date', 'assigned_at'],
    });

    // Build map for each day in range
    const dayMap = {};
    const curr = new Date(startDate);
    const stop = new Date(endDate);
    while (curr <= stop) {
      const dStr = curr.toISOString().split('T')[0];
      dayMap[dStr] = { scheduled_date: dStr, total_count: 0, completed_count: 0, pending_count: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    for (const a of activities) {
      let dStr = a.scheduled_date;
      if (!dStr && a.assigned_at) {
        dStr = new Date(a.assigned_at).toISOString().split('T')[0];
      }
      if (dStr) {
        if (!dayMap[dStr]) {
          dayMap[dStr] = { scheduled_date: dStr, total_count: 0, completed_count: 0, pending_count: 0 };
        }
        dayMap[dStr].total_count++;
        if (a.status === 'COMPLETED' || a.status === 'completed' || a.status === 'LATE') {
          dayMap[dStr].completed_count++;
        } else {
          dayMap[dStr].pending_count++;
        }
      }
    }

    const daySummaries = Object.values(dayMap).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    return sendSuccess(res, { daySummaries }, 'Calendar overview retrieved successfully.');
  } catch (error) {
    logger.error('Error fetching calendar overview:', error);
    return sendError(res, 'Failed to fetch calendar overview', 500, error.message);
  }
};

/**
 * GET /api/daily-activities/daily-summary
 * Get day-specific KPI summary for selected date & user
 */
exports.getDailySummary = async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin =
      userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || req.user.permissions?.includes('*');
    const isManagerOrHr = userRole === 'manager' || userRole === 'hr';

    const targetUserId = req.query.user_id && (isSuperAdmin || isManagerOrHr) ? req.query.user_id : req.user.id;
    const date = req.query.date || getFormattedDate(0);

    const where = {};

    if (!isSuperAdmin || req.query.user_id) {
      where.assigned_to = targetUserId;
    }

    const allActs = await DailyActivity.findAll({
      where,
      attributes: ['id', 'status', 'scheduled_date', 'assigned_at', 'estimated_hours', 'actual_hours', 'shift_duration'],
    });

    let total = 0;
    let pending = 0;
    let in_progress = 0;
    let completed = 0;
    let blocked = 0;
    let late = 0;
    let total_estimated_hours = 0;
    let total_actual_hours = 0;

    for (const a of allActs) {
      const dStr = a.scheduled_date || (a.assigned_at ? new Date(a.assigned_at).toISOString().split('T')[0] : '');
      if (dStr === date) {
        total++;
        total_estimated_hours += Number(a.estimated_hours || 0);
        total_actual_hours += Number(a.actual_hours || 0);

        if (a.status === 'ASSIGNED') pending++;
        else if (a.status === 'IN_PROGRESS') in_progress++;
        else if (a.status === 'COMPLETED') completed++;
        else if (a.status === 'BLOCKED' || a.status === 'INCOMPLETE') blocked++;
        else if (a.status === 'LATE') late++;
      }
    }

    const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return sendSuccess(
      res,
      {
        date,
        stats: {
          total,
          pending,
          in_progress,
          completed,
          blocked,
          late,
          completion_rate,
          total_estimated_hours: Number(total_estimated_hours.toFixed(1)),
          total_actual_hours: Number(total_actual_hours.toFixed(1)),
        },
      },
      'Daily summary retrieved successfully.'
    );
  } catch (error) {
    logger.error('Error fetching daily summary:', error);
    return sendError(res, 'Failed to compute daily summary', 500, error.message);
  }
};

/**
 * GET /api/daily-activities/scorecard
 * Personal productivity scorecard & completed deliverables archive
 */
exports.getPersonalScorecard = async (req, res) => {
  try {
    const userId = req.user.id;
    const todayStr = getFormattedDate(0);

    const userTasks = await DailyActivity.findAll({
      where: { assigned_to: userId },
      include: [
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email'] },
      ],
      order: [['completed_at', 'DESC'], ['updated_at', 'DESC']],
    });

    let myTotalTasks = userTasks.length;
    let myCompletedTasks = 0;
    let todayTotal = 0;
    let todayCompleted = 0;
    let todayInProgress = 0;
    let todayPending = 0;
    let todayBlocked = 0;

    const completedTasks = [];

    for (const t of userTasks) {
      const dStr = t.scheduled_date || (t.assigned_at ? new Date(t.assigned_at).toISOString().split('T')[0] : '');
      const isDone = t.status === 'COMPLETED' || t.status === 'LATE';

      if (isDone) {
        myCompletedTasks++;
        completedTasks.push(t);
      }

      if (dStr === todayStr) {
        todayTotal++;
        if (isDone) todayCompleted++;
        else if (t.status === 'IN_PROGRESS') todayInProgress++;
        else if (t.status === 'ASSIGNED') todayPending++;
        else if (t.status === 'BLOCKED' || t.status === 'INCOMPLETE') todayBlocked++;
      }
    }

    const overallCompletionRate = myTotalTasks > 0 ? Math.round((myCompletedTasks / myTotalTasks) * 100) : 0;
    const todayCompletionRate = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

    return sendSuccess(
      res,
      {
        myTotalTasks,
        myCompletedTasks,
        overallCompletionRate,
        today: {
          total: todayTotal,
          completed: todayCompleted,
          in_progress: todayInProgress,
          pending: todayPending,
          blocked: todayBlocked,
          completionRate: todayCompletionRate,
        },
        completedTasks,
      },
      'Personal scorecard retrieved successfully.'
    );
  } catch (error) {
    logger.error('Error fetching personal scorecard:', error);
    return sendError(res, 'Failed to fetch personal scorecard', 500, error.message);
  }
};

/**
 * GET /api/daily-activities
 * List activities with scoping, filtering, dynamic shift evaluation, and KPIs
 */
exports.getDailyActivities = async (req, res) => {
  try {
    const {
      assigned_by,
      assigned_to,
      status,
      priority,
      category,
      search,
      scheduled_date,
      day_filter, // 'today', 'yesterday', 'tomorrow', 'overdue', 'upcoming', 'all'
      date_from,
      date_to,
      page = 1,
      limit = 150,
    } = req.query;

    const userRole = (req.user.role || '').toLowerCase();
    const userId = req.user.id;
    const isSuperAdmin =
      userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || req.user.permissions?.includes('*');
    const isManagerOrHr = userRole === 'manager' || userRole === 'hr';

    const where = {};

    // Data Scoping
    if (!isSuperAdmin) {
      if (isManagerOrHr) {
        where[Op.or] = [{ assigned_to: userId }, { assigned_by: userId }];
      } else {
        // Employees / Sales see ONLY activities assigned to them
        where.assigned_to = userId;
      }
    }

    // Explicit filters
    if (assigned_by && assigned_by !== 'ALL') where.assigned_by = assigned_by;
    if (assigned_to && assigned_to !== 'ALL') where.assigned_to = assigned_to;
    if (status && status !== 'all' && status !== 'ALL') where.status = status;
    if (priority && priority !== 'all' && priority !== 'ALL') where.priority = priority;
    if (category && category !== 'all' && category !== 'ALL') where.category = category;

    const todayStr = getFormattedDate(0);
    const yesterdayStr = getFormattedDate(-1);
    const tomorrowStr = getFormattedDate(1);

    // Auto-sync mandatory daily tasks for today if user or target user has an active catalog
    if (!scheduled_date || scheduled_date === todayStr) {
      try {
        const { syncUserMandatoryTasks } = require('../services/mandatoryTaskService');
        if (assigned_to && assigned_to !== 'ALL') {
          const targetU = await User.findByPk(assigned_to);
          if (targetU) await syncUserMandatoryTasks(targetU, todayStr, req.user.id);
        } else if (!isSuperAdmin) {
          await syncUserMandatoryTasks(req.user, todayStr, req.user.id);
        }
      } catch (err) {
        logger.warn('Non-blocking mandatory routine sync notice:', err.message);
      }
    }

    if (day_filter) {
      if (day_filter === 'today') {
        where[Op.or] = [
          { scheduled_date: todayStr },
          { [Op.and]: [{ scheduled_date: null }, { assigned_at: { [Op.gte]: new Date(`${todayStr}T00:00:00`) } }] },
        ];
      } else if (day_filter === 'yesterday') {
        where[Op.or] = [
          { scheduled_date: yesterdayStr },
          { [Op.and]: [{ scheduled_date: null }, { assigned_at: { [Op.between]: [new Date(`${yesterdayStr}T00:00:00`), new Date(`${todayStr}T00:00:00`)] } }] },
        ];
      } else if (day_filter === 'tomorrow') {
        where.scheduled_date = tomorrowStr;
      } else if (day_filter === 'overdue') {
        where[Op.and] = [
          { [Op.or]: [{ due_date: { [Op.lt]: todayStr } }, { scheduled_date: { [Op.lt]: todayStr } }] },
          { status: { [Op.notIn]: ['COMPLETED', 'LATE'] } },
        ];
      } else if (day_filter === 'upcoming') {
        where.scheduled_date = { [Op.gt]: todayStr };
      }
    } else if (scheduled_date) {
      where[Op.or] = [
        { scheduled_date },
        { [Op.and]: [{ scheduled_date: null }, { assigned_at: { [Op.between]: [new Date(`${scheduled_date}T00:00:00`), new Date(`${scheduled_date}T23:59:59`)] } }] },
      ];
    } else if (date_from && date_to) {
      where.assigned_at = { [Op.between]: [new Date(date_from), new Date(date_to)] };
    } else if (date_from) {
      where.assigned_at = { [Op.gte]: new Date(date_from) };
    } else if (date_to) {
      where.assigned_at = { [Op.lte]: new Date(date_to) };
    }

    if (search) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { notes: { [Op.like]: `%${search}%` } },
          { completion_notes: { [Op.like]: `%${search}%` } },
          { category: { [Op.like]: `%${search}%` } },
        ],
      });
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows: activities } = await DailyActivity.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
      ],
      order: [
        ['scheduled_date', 'DESC'],
        ['assigned_at', 'DESC'],
      ],
      limit: parseInt(limit, 10),
      offset,
    });

    // Evaluate on-the-fly for any queried active activity whose shift duration expired
    for (const activity of activities) {
      if (['ASSIGNED', 'IN_PROGRESS'].includes(activity.status)) {
        await evaluateSingleActivity(activity);
      }
    }

    // KPI Summary Calculations for Scoped View
    const scopeWhere = !isSuperAdmin
      ? isManagerOrHr
        ? { [Op.or]: [{ assigned_to: userId }, { assigned_by: userId }] }
        : { assigned_to: userId }
      : {};

    const allScoped = await DailyActivity.findAll({
      where: scopeWhere,
      attributes: ['id', 'status', 'assigned_at', 'scheduled_date', 'shift_duration', 'estimated_hours', 'actual_hours'],
    });

    // Re-evaluate scoped items for KPI accuracy
    const now = Date.now();
    let assignedCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let incompleteCount = 0;
    let blockedCount = 0;
    let lateCount = 0;
    let totalEstimatedHours = 0;
    let totalActualHours = 0;

    for (const item of allScoped) {
      let st = item.status;
      const assignedAtTime = new Date(item.assigned_at).getTime();
      const shiftMs = (item.shift_duration || 24) * 3600000;
      if (['ASSIGNED', 'IN_PROGRESS'].includes(st) && now > assignedAtTime + shiftMs) {
        st = 'INCOMPLETE';
      }

      totalEstimatedHours += Number(item.estimated_hours || 0);
      totalActualHours += Number(item.actual_hours || 0);

      if (st === 'ASSIGNED') assignedCount++;
      else if (st === 'IN_PROGRESS') inProgressCount++;
      else if (st === 'COMPLETED') completedCount++;
      else if (st === 'BLOCKED') blockedCount++;
      else if (st === 'INCOMPLETE') incompleteCount++;
      else if (st === 'LATE') lateCount++;
    }

    const kpis = {
      total: allScoped.length,
      assigned: assignedCount,
      in_progress: inProgressCount,
      completed: completedCount,
      blocked: blockedCount,
      incomplete: incompleteCount,
      late: lateCount,
      total_estimated_hours: Number(totalEstimatedHours.toFixed(1)),
      total_actual_hours: Number(totalActualHours.toFixed(1)),
    };

    return sendSuccess(
      res,
      {
        activities,
        pagination: { total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) },
        kpis,
      },
      'Daily activities retrieved successfully.'
    );
  } catch (error) {
    logger.error('Error fetching daily activities:', error);
    return sendError(res, 'Failed to fetch daily activities', 500, error.message);
  }
};

/**
 * POST /api/daily-activities
 * Assign a new operational activity
 */
exports.createDailyActivity = async (req, res) => {
  try {
    const {
      title,
      description,
      assigned_to,
      priority = 'medium',
      category = 'General',
      scheduled_date,
      due_date,
      estimated_hours = 1.0,
      notes,
    } = req.body;

    const assignerId = req.user.id;
    const assignerRole = req.user.role;
    const assignerPerms = req.user.permissions || [];

    const finalDescription = (description && description.trim()) || title.trim();
    const todayStr = getFormattedDate(0);
    const finalScheduledDate = scheduled_date || todayStr;
    const finalDueDate = due_date || finalScheduledDate;

    if (!title || !assigned_to) {
      return sendError(res, 'Title and assigned_to are required.', 400);
    }

    const assigneeIds = Array.isArray(assigned_to) ? assigned_to : [assigned_to];
    if (assigneeIds.length === 0) {
      return sendError(res, 'At least one assignee user must be selected.', 400);
    }

    // Verify target users exist & satisfy role assignment rules
    const targetUsers = await User.findAll({
      where: {
        id: { [Op.in]: assigneeIds },
        [Op.and]: [
          { [Op.or]: [{ is_active: true }, { is_active: null }] },
          { [Op.or]: [{ status: { [Op.ne]: 'archived' } }, { status: null }] },
          { [Op.or]: [{ is_deleted: false }, { is_deleted: null }] },
        ],
      },
    });

    if (targetUsers.length !== assigneeIds.length) {
      return sendError(res, 'One or more selected assignee users do not exist or are inactive.', 400);
    }

    for (const targetUser of targetUsers) {
      if (!canAssignDailyActivityTo(assignerRole, targetUser.role, assignerPerms)) {
        return sendError(
          res,
          `Your role (${assignerRole}) is not permitted to assign activities to ${targetUser.name} (${targetUser.role}).`,
          403
        );
      }
    }

    const createdActivities = [];

    for (const targetUser of targetUsers) {
      const activity = await DailyActivity.create({
        title: title.trim(),
        description: finalDescription,
        assigned_by: assignerId,
        assigned_to: targetUser.id,
        priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
        category: category ? category.trim() : 'General',
        scheduled_date: finalScheduledDate,
        due_date: finalDueDate,
        estimated_hours: parseFloat(estimated_hours) || 1.0,
        actual_hours: 0.0,
        notes: notes ? notes.trim() : null,
        status: 'ASSIGNED',
        assigned_at: new Date(),
        shift_duration: 24,
      });

      // History Record
      await DailyActivityHistory.create({
        activity_id: activity.id,
        actor_id: assignerId,
        event_type: 'ACTIVITY_CREATED',
        old_status: null,
        new_status: 'ASSIGNED',
        notes: `Activity created by ${req.user.name} and scheduled for ${finalScheduledDate}`,
      });

      // Employee Audit Log
      await createAuditEvent({
        userId: targetUser.id,
        actorUserId: assignerId,
        action: 'ACTIVITY_ASSIGNED',
        module: 'daily_activities',
        entityType: 'DailyActivity',
        entityId: activity.id,
        metadata: {
          title: activity.title,
          priority: activity.priority,
          category: activity.category,
          scheduled_date: activity.scheduled_date,
          due_date: activity.due_date,
          estimated_hours: activity.estimated_hours,
        },
        newValues: { status: 'ASSIGNED' },
      });

      const reloaded = await DailyActivity.findByPk(activity.id, {
        include: [
          { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
          { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        ],
      });

      createdActivities.push(reloaded);
    }

    const result = createdActivities.length === 1 ? createdActivities[0] : createdActivities;
    return sendSuccess(res, result, 'Daily activity created and assigned successfully.', 201);
  } catch (error) {
    logger.error('Error creating daily activity:', error);
    return sendError(res, 'Failed to create daily activity', 500, error.message);
  }
};

/**
 * PUT / PATCH /api/daily-activities/:id
 * Super Admin full edit / Employee progress update
 */
exports.updateDailyActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await DailyActivity.findByPk(id);

    if (!activity) {
      return sendError(res, 'Daily activity not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin =
      userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || req.user.permissions?.includes('*');
    const isManagerOrHr = userRole === 'manager' || userRole === 'hr';

    // Object-level authorization check
    if (!isSuperAdmin && !isManagerOrHr && activity.assigned_to !== req.user.id) {
      return sendError(res, 'You are not authorized to update this activity.', 403);
    }

    const {
      title,
      description,
      priority,
      category,
      scheduled_date,
      due_date,
      estimated_hours,
      actual_hours,
      completion_notes,
      status,
      note,
    } = req.body;

    const oldStatus = activity.status;
    let newStatus = status || activity.status;

    if (isSuperAdmin || isManagerOrHr) {
      if (title !== undefined) activity.title = title.trim();
      if (description !== undefined) activity.description = description.trim();
      if (priority !== undefined) activity.priority = priority;
      if (category !== undefined) activity.category = category.trim();
      if (scheduled_date !== undefined) activity.scheduled_date = scheduled_date;
      if (due_date !== undefined) activity.due_date = due_date;
      if (estimated_hours !== undefined) activity.estimated_hours = parseFloat(estimated_hours) || 1.0;
    }

    if (actual_hours !== undefined) {
      activity.actual_hours = parseFloat(actual_hours) || 0.0;
    }

    if (completion_notes !== undefined) {
      activity.completion_notes = completion_notes.trim();
    }

    if (status && status !== oldStatus) {
      if (newStatus === 'COMPLETED') {
        const todayStr = getFormattedDate(0);
        const taskDate = activity.scheduled_date || (activity.assigned_at ? new Date(activity.assigned_at).toISOString().split('T')[0] : todayStr);
        const assignedAtTime = new Date(activity.assigned_at).getTime();
        const shiftMs = (activity.shift_duration || 24) * 3600000;
        const isWithinShift = new Date().getTime() <= assignedAtTime + shiftMs;
        const isCompletedOnSameDay = taskDate >= todayStr;

        if (!isWithinShift || !isCompletedOnSameDay || oldStatus === 'INCOMPLETE') {
          newStatus = 'LATE';
        }
        activity.completed_at = activity.completed_at || new Date();
      } else if (newStatus === 'IN_PROGRESS' && !activity.started_at) {
        activity.started_at = new Date();
      }

      activity.status = newStatus;

      await DailyActivityHistory.create({
        activity_id: activity.id,
        actor_id: req.user.id,
        event_type: newStatus === 'LATE' ? 'ACTIVITY_LATE' : 'STATUS_CHANGED',
        old_status: oldStatus,
        new_status: newStatus,
        notes: note || `Status updated from ${oldStatus} to ${newStatus} by ${req.user.name}`,
      });
    } else if (note) {
      await DailyActivityHistory.create({
        activity_id: activity.id,
        actor_id: req.user.id,
        event_type: 'COMMENT_ADDED',
        old_status: oldStatus,
        new_status: oldStatus,
        notes: note,
      });
    }

    await activity.save();

    const updated = await DailyActivity.findByPk(activity.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        {
          model: DailyActivityHistory,
          as: 'history',
          include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email', 'role'] }],
        },
      ],
    });

    return sendSuccess(res, updated, 'Daily activity updated successfully.');
  } catch (error) {
    logger.error('Error updating daily activity:', error);
    return sendError(res, 'Failed to update daily activity', 500, error.message);
  }
};

/**
 * GET /api/daily-activities/:id
 */
exports.getDailyActivityById = async (req, res) => {
  try {
    const { id } = req.params;
    let activity = await DailyActivity.findByPk(id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        {
          model: DailyActivityHistory,
          as: 'history',
          include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email', 'role', 'avatar_url'] }],
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!activity) {
      return sendError(res, 'Daily activity not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin =
      userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || req.user.permissions?.includes('*');

    if (!isSuperAdmin && activity.assigned_to !== req.user.id && activity.assigned_by !== req.user.id) {
      return sendError(res, 'Access denied. You can only view activities assigned to or created by you.', 403);
    }

    // Dynamic shift check
    if (['ASSIGNED', 'IN_PROGRESS'].includes(activity.status)) {
      activity = await evaluateSingleActivity(activity);
    }

    return sendSuccess(res, activity, 'Daily activity details retrieved.');
  } catch (error) {
    logger.error('Error fetching daily activity by ID:', error);
    return sendError(res, 'Failed to fetch daily activity', 500, error.message);
  }
};

/**
 * PATCH /api/daily-activities/:id/start
 * Employee starts the activity (ASSIGNED -> IN_PROGRESS)
 */
exports.startDailyActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await DailyActivity.findByPk(id);

    if (!activity) {
      return sendError(res, 'Daily activity not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin =
      userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || req.user.permissions?.includes('*');

    // Only assigned employee or Super Admin can start
    if (!isSuperAdmin && activity.assigned_to !== req.user.id) {
      return sendError(res, 'Only the assigned employee can start this activity.', 403);
    }

    // Evaluate shift expiry
    const assignedAtTime = new Date(activity.assigned_at).getTime();
    const shiftMs = (activity.shift_duration || 24) * 3600000;
    if (Date.now() > assignedAtTime + shiftMs) {
      await evaluateSingleActivity(activity, req.user.id);
      return sendError(res, 'The 24-hour shift duration for this activity has expired. It is now marked INCOMPLETE.', 400);
    }

    activity.status = 'IN_PROGRESS';
    activity.started_at = new Date();
    await activity.save();

    // History log
    await DailyActivityHistory.create({
      activity_id: activity.id,
      actor_id: req.user.id,
      event_type: 'ACTIVITY_STARTED',
      old_status: 'ASSIGNED',
      new_status: 'IN_PROGRESS',
      notes: `Activity started by ${req.user.name}`,
    });

    // Employee Audit log
    await createAuditEvent({
      userId: activity.assigned_to,
      actorUserId: req.user.id,
      action: 'ACTIVITY_STARTED',
      module: 'daily_activities',
      entityType: 'DailyActivity',
      entityId: activity.id,
      metadata: { title: activity.title, started_at: activity.started_at },
      oldValues: { status: 'ASSIGNED' },
      newValues: { status: 'IN_PROGRESS' },
    });

    const updated = await DailyActivity.findByPk(activity.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone'] },
        {
          model: DailyActivityHistory,
          as: 'history',
          include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email', 'role'] }],
        },
      ],
    });

    return sendSuccess(res, updated, 'Activity started successfully.');
  } catch (error) {
    logger.error('Error starting daily activity:', error);
    return sendError(res, 'Failed to start daily activity', 500, error.message);
  }
};

/**
 * PATCH /api/daily-activities/:id/complete
 * Employee completes the activity (IN_PROGRESS/ASSIGNED/INCOMPLETE -> COMPLETED or LATE)
 */
exports.completeDailyActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, actual_hours } = req.body || {};
    const activity = await DailyActivity.findByPk(id);

    if (!activity) {
      return sendError(res, 'Daily activity not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin =
      userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || req.user.permissions?.includes('*');

    // Only assigned employee or Super Admin can complete
    if (!isSuperAdmin && activity.assigned_to !== req.user.id) {
      return sendError(res, 'Only the assigned employee can complete this activity.', 403);
    }

    // Forbidden transitions
    if (['COMPLETED', 'LATE'].includes(activity.status)) {
      return sendError(res, `Activity is already marked as ${activity.status}.`, 400);
    }

    const oldStatus = activity.status;
    const now = new Date();
    const todayStr = getFormattedDate(0);
    const taskDate = activity.scheduled_date || (activity.assigned_at ? new Date(activity.assigned_at).toISOString().split('T')[0] : todayStr);

    const assignedAtTime = new Date(activity.assigned_at).getTime();
    const shiftMs = (activity.shift_duration || 24) * 3600000;
    const isWithinShift = now.getTime() <= assignedAtTime + shiftMs;
    const isCompletedOnSameDay = taskDate >= todayStr;

    let newStatus = 'COMPLETED';
    let eventType = 'ACTIVITY_COMPLETED';

    if (!isWithinShift || !isCompletedOnSameDay || oldStatus === 'INCOMPLETE') {
      newStatus = 'LATE';
      eventType = 'ACTIVITY_LATE';
    }

    activity.status = newStatus;
    activity.completed_at = now;
    if (!activity.started_at) {
      activity.started_at = now;
    }
    if (actual_hours !== undefined) {
      activity.actual_hours = parseFloat(actual_hours) || activity.actual_hours;
    }
    if (notes) {
      activity.completion_notes = notes.trim();
    }
    await activity.save();

    // History log
    await DailyActivityHistory.create({
      activity_id: activity.id,
      actor_id: req.user.id,
      event_type: eventType,
      old_status: oldStatus,
      new_status: newStatus,
      notes: notes || `Activity completed as ${newStatus} by ${req.user.name}`,
    });

    // Employee Audit log
    await createAuditEvent({
      userId: activity.assigned_to,
      actorUserId: req.user.id,
      action: eventType,
      module: 'daily_activities',
      entityType: 'DailyActivity',
      entityId: activity.id,
      metadata: {
        title: activity.title,
        started_at: activity.started_at,
        completed_at: activity.completed_at,
        within_shift: isWithinShift,
        actual_hours: activity.actual_hours,
      },
      oldValues: { status: oldStatus },
      newValues: { status: newStatus },
    });

    const updated = await DailyActivity.findByPk(activity.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone'] },
        {
          model: DailyActivityHistory,
          as: 'history',
          include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email', 'role'] }],
        },
      ],
    });

    return sendSuccess(res, updated, `Activity marked as ${newStatus} successfully.`);
  } catch (error) {
    logger.error('Error completing daily activity:', error);
    return sendError(res, 'Failed to complete daily activity', 500, error.message);
  }
};

/**
 * GET /api/daily-activities/:id/history
 */
exports.getActivityHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await DailyActivityHistory.findAll({
      where: { activity_id: id },
      include: [{ model: User, as: 'actor', attributes: ['id', 'name', 'email', 'role', 'avatar_url'] }],
      order: [['created_at', 'DESC']],
    });

    return sendSuccess(res, history, 'Activity history retrieved successfully.');
  } catch (error) {
    logger.error('Error fetching activity history:', error);
    return sendError(res, 'Failed to fetch activity history', 500, error.message);
  }
};

/**
 * GET /api/daily-activities/analytics
 * Employee Performance Analytics for HR & Super Admin
 */
exports.getActivityAnalytics = async (req, res) => {
  try {
    const { date_from, date_to, role } = req.query;

    const where = {};
    if (date_from && date_to) {
      where.assigned_at = { [Op.between]: [new Date(date_from), new Date(date_to)] };
    } else if (date_from) {
      where.assigned_at = { [Op.gte]: new Date(date_from) };
    } else if (date_to) {
      where.assigned_at = { [Op.lte]: new Date(date_to) };
    }

    const userWhere = { is_active: true };
    if (role && role !== 'all') {
      userWhere.role = role;
    }

    const employees = await User.findAll({
      where: userWhere,
      attributes: ['id', 'name', 'email', 'role', 'avatar_url'],
      order: [['name', 'ASC']],
    });

    const activities = await DailyActivity.findAll({
      where,
      attributes: ['id', 'assigned_to', 'status', 'assigned_at', 'shift_duration'],
    });

    const now = Date.now();
    const analytics = employees.map((emp) => {
      const empActs = activities.filter((a) => a.assigned_to === emp.id);
      let assigned = 0;
      let inProgress = 0;
      let completed = 0;
      let incomplete = 0;
      let blocked = 0;
      let late = 0;

      for (const a of empActs) {
        let st = a.status;
        const assignedAtTime = new Date(a.assigned_at).getTime();
        const shiftMs = (a.shift_duration || 24) * 3600000;
        if (['ASSIGNED', 'IN_PROGRESS'].includes(st) && now > assignedAtTime + shiftMs) {
          st = 'INCOMPLETE';
        }

        if (st === 'ASSIGNED') assigned++;
        else if (st === 'IN_PROGRESS') inProgress++;
        else if (st === 'COMPLETED') completed++;
        else if (st === 'BLOCKED') blocked++;
        else if (st === 'INCOMPLETE') incomplete++;
        else if (st === 'LATE') late++;
      }

      const total = empActs.length;
      // Performance Formula: Completion Rate = (Completed Activities / Assigned Activities) * 100
      const completionRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;

      return {
        user: emp,
        assigned,
        in_progress: inProgress,
        completed,
        blocked,
        incomplete,
        late,
        total,
        completion_rate: completionRate,
      };
    });

    return sendSuccess(res, analytics, 'Activity performance analytics retrieved successfully.');
  } catch (error) {
    logger.error('Error fetching activity analytics:', error);
    return sendError(res, 'Failed to fetch activity analytics', 500, error.message);
  }
};

/**
 * DELETE /api/daily-activities/:id
 */
exports.deleteDailyActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await DailyActivity.findByPk(id);

    if (!activity) {
      return sendError(res, 'Daily activity not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin =
      userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin' || req.user.permissions?.includes('*');

    if (!isSuperAdmin && activity.assigned_by !== req.user.id) {
      return sendError(res, 'Only the assigner or Super Admin can delete daily activities.', 403);
    }

    await activity.destroy();
    return sendSuccess(res, { id }, 'Daily activity deleted successfully.');
  } catch (error) {
    logger.error('Error deleting daily activity:', error);
    return sendError(res, 'Failed to delete daily activity', 500, error.message);
  }
};

/**
 * POST /api/daily-activities/sync-mandatory
 * Manually or programmatically trigger mandatory routine assignment for staff
 */
exports.syncMandatoryTasks = async (req, res) => {
  try {
    const { targetDate, targetUserId } = req.body || {};
    const { syncUserMandatoryTasks, syncAllMandatoryTasks } = require('../services/mandatoryTaskService');

    let result;
    if (targetUserId) {
      const targetUser = await User.findByPk(targetUserId);
      if (!targetUser) return sendError(res, 'Target user not found', 404);
      result = await syncUserMandatoryTasks(targetUser, targetDate, req.user.id);
    } else if (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'manager') {
      result = await syncAllMandatoryTasks(targetDate);
    } else {
      result = await syncUserMandatoryTasks(req.user, targetDate, req.user.id);
    }

    return sendSuccess(res, result, 'Mandatory daily tasks synchronized successfully.');
  } catch (error) {
    logger.error('Error syncing mandatory tasks:', error);
    return sendError(res, 'Failed to synchronize mandatory tasks', 500, error.message);
  }
};

/**
 * PATCH /api/daily-activities/:id/status
 * Update status (e.g. pending, in_progress, completed, incomplete, blocked)
 */
exports.updateDailyActivityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks, notes, actual_hours } = req.body || {};

    const activity = await DailyActivity.findByPk(id);
    if (!activity) {
      return sendError(res, 'Daily activity not found.', 404);
    }

    const normStatus = (status || '').toUpperCase().trim();
    const oldStatus = activity.status;

    if (normStatus === 'COMPLETED' || normStatus === 'LATE') {
      return exports.completeDailyActivity(req, res);
    }
    if (normStatus === 'IN_PROGRESS') {
      return exports.startDailyActivity(req, res);
    }

    activity.status = normStatus || oldStatus;
    if (remarks || notes) activity.remarks = remarks || notes;
    if (actual_hours !== undefined) activity.actual_hours = parseFloat(actual_hours) || activity.actual_hours;
    await activity.save();

    await DailyActivityHistory.create({
      activity_id: activity.id,
      actor_id: req.user.id,
      event_type: 'STATUS_UPDATED',
      old_status: oldStatus,
      new_status: activity.status,
      notes: remarks || notes || `Status updated to ${activity.status} by ${req.user.name}`,
    });

    const updated = await DailyActivity.findByPk(activity.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
      ],
    });

    return sendSuccess(res, updated, 'Daily activity status updated successfully.');
  } catch (error) {
    logger.error('Error updating daily activity status:', error);
    return sendError(res, 'Failed to update daily activity status', 500, error.message);
  }
};

