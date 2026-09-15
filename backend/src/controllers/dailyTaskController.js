'use strict';

const { Op } = require('sequelize');
const { DailyTask, DailyTaskHistory, User } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../config/logger');

/**
 * Role & Permission-Based Assignment Authorization Rule Matrix:
 * - Super Admin: All users
 * - Manager / HR / Custom Roles with create permission: All users except Super Admin / Admin
 * - Telecaller: All users including Super Admin / Admin
 * - Sales (without explicit create permission): Cannot assign Daily Tasks
 */
const canAssignDailyTaskTo = (assignerRole, targetRole, assignerPerms = []) => {
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

  // Users with daily_tasks:create or tasks:create permission
  if (assignerPerms.includes('daily_tasks:create') || assignerPerms.includes('tasks:create')) {
    return !isTargetAdmin;
  }

  // Sales without override cannot assign daily tasks
  if (normAssigner === 'sales') {
    return false;
  }

  // Default for recognized custom roles with permissions
  return !isTargetAdmin;
};

/**
 * GET /api/daily-tasks/assignable-users
 * Returns list of active users that current user can assign daily tasks to based on role and permission rules.
 */
exports.getAssignableUsers = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userPerms = req.user.permissions || [];
    const hasCreatePerm =
      userPerms.includes('*') ||
      userPerms.includes('daily_tasks:create') ||
      userPerms.includes('tasks:create');

    if (userRole === 'sales' && !hasCreatePerm) {
      return sendSuccess(res, [], 'Sales role is not permitted to assign daily tasks.');
    }

    const allUsers = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'],
      order: [['name', 'ASC']],
    });

    const assignable = allUsers.filter((u) => canAssignDailyTaskTo(userRole, u.role, userPerms));

    return sendSuccess(res, assignable, 'Assignable users retrieved successfully.');
  } catch (error) {
    logger.error('Error fetching assignable users for daily tasks:', error);
    return sendError(res, 'Failed to fetch assignable users', 500, error.message);
  }
};

/**
 * GET /api/daily-tasks
 * Scoped daily tasks list + KPI stats overview
 */
exports.getDailyTasks = async (req, res) => {
  try {
    const {
      assigned_by,
      assigned_to,
      status,
      priority,
      search,
      start_date,
      end_date,
      page = 1,
      limit = 100,
    } = req.query;

    const userRole = (req.user.role || '').toLowerCase();
    const userId = req.user.id;
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin';

    const where = {};

    // Data Scoping: Non-Super-Admins can ONLY view tasks where they are assignee or assigner
    if (!isSuperAdmin) {
      where[Op.or] = [{ assigned_to: userId }, { assigned_by: userId }];
    }

    // Apply explicit filters if provided
    if (assigned_by) where.assigned_by = assigned_by;
    if (assigned_to) where.assigned_to = assigned_to;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (start_date && end_date) {
      where.due_date = { [Op.between]: [start_date, end_date] };
    } else if (start_date) {
      where.due_date = { [Op.gte]: start_date };
    } else if (end_date) {
      where.due_date = { [Op.lte]: end_date };
    }

    if (search) {
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { remarks: { [Op.like]: `%${search}%` } },
        ],
      });
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows: dailyTasks } = await DailyTask.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset,
    });

    // KPI Summary Calculations for Scoped View
    const scopeWhere = !isSuperAdmin
      ? { [Op.or]: [{ assigned_to: userId }, { assigned_by: userId }] }
      : {};

    const allScopedTasks = await DailyTask.findAll({ where: scopeWhere, attributes: ['id', 'status', 'due_date'] });
    const todayStr = new Date().toISOString().split('T')[0];

    const kpis = {
      total: allScopedTasks.length,
      pending: allScopedTasks.filter((t) => t.status === 'pending').length,
      in_progress: allScopedTasks.filter((t) => t.status === 'in_progress').length,
      completed: allScopedTasks.filter((t) => t.status === 'completed').length,
      cancelled: allScopedTasks.filter((t) => t.status === 'cancelled').length,
      overdue: allScopedTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.due_date < todayStr).length,
    };

    return sendSuccess(res, { dailyTasks, pagination: { total: count, page: parseInt(page, 10), limit: parseInt(limit, 10) }, kpis }, 'Daily tasks retrieved successfully.');
  } catch (error) {
    logger.error('Error fetching daily tasks:', error);
    return sendError(res, 'Failed to fetch daily tasks', 500, error.message);
  }
};

/**
 * POST /api/daily-tasks
 * Create and assign a daily task (or multiple tasks if assigned_to is an array)
 */
exports.createDailyTask = async (req, res) => {
  try {
    const { title, description, assigned_to, priority = 'medium', due_date, target_date, remarks } = req.body;
    const assignerId = req.user.id;
    const assignerRole = req.user.role;
    const finalDueDate = due_date || target_date || new Date().toISOString().split('T')[0];

    if (!title || !assigned_to) {
      return sendError(res, 'Title and assigned_to are required.', 400);
    }

    // Support single user ID or array of user IDs
    const assigneeIds = Array.isArray(assigned_to) ? assigned_to : [assigned_to];

    if (assigneeIds.length === 0) {
      return sendError(res, 'At least one assigned_to user must be selected.', 400);
    }

    // Verify all target users exist & satisfy role assignment rules
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

    // Enforce role assignment rules
    for (const targetUser of targetUsers) {
      if (!canAssignDailyTaskTo(assignerRole, targetUser.role)) {
        return sendError(
          res,
          `Your role (${assignerRole}) is not permitted to assign daily tasks to ${targetUser.name} (${targetUser.role}).`,
          403
        );
      }
    }

    const createdTasks = [];

    for (const targetUser of targetUsers) {
      const task = await DailyTask.create({
        title,
        description,
        assigned_by: assignerId,
        assigned_to: targetUser.id,
        priority,
        due_date: finalDueDate,
        status: 'pending',
        remarks: remarks || null,
      });

      // Audit history log
      await DailyTaskHistory.create({
        daily_task_id: task.id,
        changed_by: assignerId,
        field_changed: 'created',
        old_value: null,
        new_value: `Task created by ${req.user.name} and assigned to ${targetUser.name}`,
      });

      const reloadedTask = await DailyTask.findByPk(task.id, {
        include: [
          { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone'] },
          { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone'] },
        ],
      });

      createdTasks.push(reloadedTask);
    }

    const result = createdTasks.length === 1 ? createdTasks[0] : createdTasks;
    return sendSuccess(res, result, 'Daily task(s) created and assigned successfully.', 201);
  } catch (error) {
    logger.error('Error creating daily task:', error);
    return sendError(res, 'Failed to create daily task', 500, error.message);
  }
};

/**
 * GET /api/daily-tasks/:id
 * Get single daily task details with full audit log history
 */
exports.getDailyTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await DailyTask.findByPk(id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone', 'avatar_url'] },
        {
          model: DailyTaskHistory,
          as: 'history',
          include: [{ model: User, as: 'changer', attributes: ['id', 'name', 'email', 'role'] }],
          order: [['created_at', 'ASC']],
        },
      ],
    });

    if (!task) {
      return sendError(res, 'Daily task not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin';

    if (!isSuperAdmin && task.assigned_to !== req.user.id && task.assigned_by !== req.user.id) {
      return sendError(res, 'Access denied. You can only view tasks assigned to or created by you.', 403);
    }

    return sendSuccess(res, task, 'Daily task details retrieved.');
  } catch (error) {
    logger.error('Error fetching daily task by ID:', error);
    return sendError(res, 'Failed to fetch daily task', 500, error.message);
  }
};

/**
 * PATCH /api/daily-tasks/:id
 * Update task details (assigner or super admin only)
 */
exports.updateDailyTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, due_date, assigned_to, remarks } = req.body;

    const task = await DailyTask.findByPk(id);
    if (!task) {
      return sendError(res, 'Daily task not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin';

    if (!isSuperAdmin && task.assigned_by !== req.user.id) {
      return sendError(res, 'Only the task assigner or Super Admin can modify task details.', 403);
    }

    // If assigned_to changed, verify role rules
    if (assigned_to && assigned_to !== task.assigned_to) {
      const targetUser = await User.findByPk(assigned_to);
      if (!targetUser) return sendError(res, 'Target assignee user not found.', 400);

      if (!canAssignDailyTaskTo(req.user.role, targetUser.role)) {
        return sendError(res, `Your role (${req.user.role}) is not allowed to assign to ${targetUser.role}.`, 403);
      }

      await DailyTaskHistory.create({
        daily_task_id: task.id,
        changed_by: req.user.id,
        field_changed: 'assigned_to',
        old_value: task.assigned_to,
        new_value: targetUser.id,
      });

      task.assigned_to = assigned_to;
    }

    if (title && title !== task.title) {
      await DailyTaskHistory.create({
        daily_task_id: task.id,
        changed_by: req.user.id,
        field_changed: 'title',
        old_value: task.title,
        new_value: title,
      });
      task.title = title;
    }

    if (description !== undefined && description !== task.description) {
      task.description = description;
    }
    if (priority && priority !== task.priority) {
      task.priority = priority;
    }
    if (due_date && due_date !== task.due_date) {
      task.due_date = due_date;
    }
    if (remarks !== undefined) {
      task.remarks = remarks;
    }

    await task.save();

    const updatedTask = await DailyTask.findByPk(task.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone'] },
      ],
    });

    return sendSuccess(res, updatedTask, 'Daily task updated successfully.');
  } catch (error) {
    logger.error('Error updating daily task:', error);
    return sendError(res, 'Failed to update daily task', 500, error.message);
  }
};

/**
 * PATCH /api/daily-tasks/:id/status
 * Update status & execution remarks (Assignee, Assigner, or Super Admin)
 */
exports.updateDailyTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return sendError(res, `Invalid status. Allowed values: ${validStatuses.join(', ')}`, 400);
    }

    const task = await DailyTask.findByPk(id);
    if (!task) {
      return sendError(res, 'Daily task not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin';

    if (!isSuperAdmin && task.assigned_to !== req.user.id && task.assigned_by !== req.user.id) {
      return sendError(res, 'Access denied. You can only update status for tasks assigned to or created by you.', 403);
    }

    if (status && status !== task.status) {
      await DailyTaskHistory.create({
        daily_task_id: task.id,
        changed_by: req.user.id,
        field_changed: 'status',
        old_value: task.status,
        new_value: status,
      });
      task.status = status;
    }

    if (remarks !== undefined && remarks !== task.remarks) {
      await DailyTaskHistory.create({
        daily_task_id: task.id,
        changed_by: req.user.id,
        field_changed: 'remarks',
        old_value: task.remarks,
        new_value: remarks,
      });
      task.remarks = remarks;
    }

    await task.save();

    const updatedTask = await DailyTask.findByPk(task.id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'role', 'phone'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email', 'role', 'phone'] },
        {
          model: DailyTaskHistory,
          as: 'history',
          include: [{ model: User, as: 'changer', attributes: ['id', 'name', 'email', 'role'] }],
        },
      ],
    });

    return sendSuccess(res, updatedTask, 'Daily task status updated successfully.');
  } catch (error) {
    logger.error('Error updating daily task status:', error);
    return sendError(res, 'Failed to update daily task status', 500, error.message);
  }
};

/**
 * DELETE /api/daily-tasks/:id
 * Delete daily task (Assigner or Super Admin only)
 */
exports.deleteDailyTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await DailyTask.findByPk(id);

    if (!task) {
      return sendError(res, 'Daily task not found.', 404);
    }

    const userRole = (req.user.role || '').toLowerCase();
    const isSuperAdmin = userRole === 'super_admin' || userRole === 'admin' || userRole === 'super admin';

    if (!isSuperAdmin && task.assigned_by !== req.user.id) {
      return sendError(res, 'Only the assigner or Super Admin can delete daily tasks.', 403);
    }

    await task.destroy();
    return sendSuccess(res, { id }, 'Daily task deleted successfully.');
  } catch (error) {
    logger.error('Error deleting daily task:', error);
    return sendError(res, 'Failed to delete daily task', 500, error.message);
  }
};
