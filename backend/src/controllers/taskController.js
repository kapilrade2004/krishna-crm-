'use strict';

const { Op, fn, col, literal } = require('sequelize');
const { sequelize, Task, User, Customer, Order } = require('../models');
const { AppError } = require('../utils/errors');
const { sendSuccess, sendCreated, sendPaginated, getPagination, getOrder } = require('../utils/response');

const ALLOWED_SORT = ['due_date', 'created_at', 'priority', 'status', 'progress_percent', 'score'];

// GET /api/tasks
exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);
    const order = getOrder(req.query, ALLOWED_SORT);

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.priority) where.priority = req.query.priority;
    if (req.query.customer_id) where.customer_id = req.query.customer_id;
    if (req.query.order_id) where.order_id = req.query.order_id;

    // Strict Task Visibility Scoping:
    // Super Admin can view all tasks.
    // All other roles (Manager, HR, Telecaller, Employee, Sales) can ONLY view tasks
    // assigned to them OR created by them.
    const isSuperAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    if (!isSuperAdmin) {
      where[Op.or] = [
        { assigned_to: req.user.id },
        { created_by: req.user.id },
      ];
    } else if (req.query.assigned_to) {
      where.assigned_to = req.query.assigned_to;
    }

    if (req.query.overdue === 'true') {
      where.due_date = { [Op.lt]: new Date().toISOString().split('T')[0] };
      where.status = { [Op.notIn]: ['done', 'cancelled'] };
    }
    if (req.query.unscored === 'true') {
      where.status = 'done';
      where.score = null;
    }
    if (req.query.q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${req.query.q}%` } },
        { description: { [Op.like]: `%${req.query.q}%` } },
      ];
    }

    const { count, rows } = await Task.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'scorer', attributes: ['id', 'name'], required: false },
        { model: Customer, as: 'customer', attributes: ['id', 'name'] },
        { model: Order, as: 'order', attributes: ['id', 'order_number'] },
      ],
      order,
      limit,
      offset,
    });

    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/:id
exports.getOne = async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'creator', attributes: ['id', 'name'] },
        { model: User, as: 'scorer', attributes: ['id', 'name'], required: false },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: Order, as: 'order', attributes: ['id', 'order_number', 'status'] },
      ],
    });
    if (!task) return next(new AppError('Task not found.', 404));

    const isSuperAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    if (!isSuperAdmin && task.assigned_to !== req.user.id && task.created_by !== req.user.id) {
      return next(new AppError('Forbidden: You can only view tasks assigned to you or created by you.', 403));
    }

    sendSuccess(res, { task });
  } catch (err) {
    next(err);
  }
};

// POST /api/tasks
exports.create = async (req, res, next) => {
  try {
    const task = await Task.create({
      ...req.body,
      created_by: req.user.id,
      assigned_to: req.body.assigned_to || req.user.id,
    });
    sendCreated(res, { task }, 'Task created.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tasks/:id
exports.update = async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return next(new AppError('Task not found.', 404));

    const isSuperAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const isCreator = task.created_by === req.user.id;
    const isAssignee = task.assigned_to === req.user.id;

    if (!isSuperAdmin && !isCreator && !isAssignee) {
      return next(new AppError('Forbidden: You can only update tasks assigned to you or created by you.', 403));
    }

    let allowed = [];
    if (isSuperAdmin || isCreator) {
      // Assigner / Super Admin can edit all task fields
      allowed = [
        'title', 'description', 'assigned_to', 'status', 'priority',
        'due_date', 'completed_at', 'tags', 'notes', 'progress_percent',
        'customer_id', 'order_id',
      ];
    } else {
      // Assignee (e.g. HR / Telecaller / Employee) can ONLY update status, progress, and leave execution notes for assigner
      allowed = ['status', 'progress_percent', 'notes', 'completed_at'];
    }

    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    if (updates.status === 'done' && !updates.completed_at) {
      updates.completed_at = new Date();
      updates.progress_percent = 100;
    }

    await task.update(updates);
    sendSuccess(res, { task }, 'Task updated.');
  } catch (err) {
    next(err);
  }
};

// ─── SOW §3.7: PATCH /api/tasks/:id/score ─────────────────────────────────────
// Manager/Admin enters a score (0-10) + optional comment for a task.
exports.setScore = async (req, res, next) => {
  try {
    const { score, score_comment } = req.body;

    if (score === undefined || score === null) {
      return next(new AppError('score is required.', 400));
    }
    const numScore = Number(score);
    if (Number.isNaN(numScore) || numScore < 0 || numScore > 10) {
      return next(new AppError('score must be a number between 0 and 10.', 422));
    }

    // Only admin / manager can score tasks
    if (!['admin', 'super_admin', 'manager'].includes(req.user.role)) {
      return next(new AppError('Only managers and admins can score tasks.', 403));
    }

    const task = await Task.findByPk(req.params.id);
    if (!task) return next(new AppError('Task not found.', 404));

    await task.update({
      score: numScore,
      score_comment: score_comment || null,
      scored_by: req.user.id,
      scored_at: new Date(),
    });

    const populated = await Task.findByPk(task.id, {
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name'] },
        { model: User, as: 'scorer', attributes: ['id', 'name'] },
      ],
    });

    sendSuccess(res, { task: populated }, 'Task score saved.');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tasks/:id
exports.remove = async (req, res, next) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return next(new AppError('Task not found.', 404));

    const isSuperAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
    const isCreator = task.created_by === req.user.id;

    if (!isSuperAdmin && !isCreator) {
      return next(new AppError('Forbidden: Only the task assigner or Super Admin can delete this task.', 403));
    }

    await task.destroy();
    sendSuccess(res, null, 'Task deleted.');
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/dashboard – summary for the task board
exports.getDashboard = async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    let baseWhere = {};
    if (!isSuperAdmin) {
      baseWhere = {
        [Op.or]: [
          { assigned_to: req.user.id },
          { created_by: req.user.id },
        ],
      };
    } else if (req.query.user_id) {
      baseWhere = { assigned_to: req.query.user_id };
    }

    const [todo, inProgress, review, done, overdue, unscored] = await Promise.all([
      Task.count({ where: { ...baseWhere, status: 'todo' } }),
      Task.count({ where: { ...baseWhere, status: 'in_progress' } }),
      Task.count({ where: { ...baseWhere, status: 'review' } }),
      Task.count({ where: { ...baseWhere, status: 'done' } }),
      Task.count({
        where: {
          ...baseWhere,
          status: { [Op.notIn]: ['done', 'cancelled'] },
          due_date: { [Op.lt]: new Date().toISOString().split('T')[0] },
        },
      }),
      Task.count({ where: { ...baseWhere, status: 'done', score: null } }),
    ]);

    sendSuccess(res, { dashboard: { todo, inProgress, review, done, overdue, unscored } });
  } catch (err) {
    next(err);
  }
};

// ─── SOW §3.7: GET /api/tasks/score-dashboard ─────────────────────────────────
// Score Dashboard with Score Table — per-user average score, distribution, leaderboard.
exports.getScoreDashboard = async (req, res, next) => {
  try {
    const { from_date, to_date } = req.query;
    const dateWhere = (from_date && to_date)
      ? { scored_at: { [Op.between]: [from_date, to_date] } }
      : {};

    // Per-user score table — avg score, task count, completion rate
    const scoreTable = await sequelize.query(
      `SELECT
         u.id, u.name, u.role,
         COUNT(t.id) AS total_tasks,
         COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS completed_tasks,
         COUNT(CASE WHEN t.score IS NOT NULL THEN 1 END) AS scored_tasks,
         ROUND(AVG(t.score), 2) AS avg_score,
         MIN(t.score) AS min_score,
         MAX(t.score) AS max_score,
         COUNT(CASE WHEN t.status = 'done' AND t.score IS NULL THEN 1 END) AS pending_score_count
       FROM users u
       LEFT JOIN tasks t ON t.assigned_to = u.id AND t.deleted_at IS NULL
         ${from_date && to_date ? 'AND t.scored_at BETWEEN :from_date AND :to_date' : ''}
       WHERE u.deleted_at IS NULL AND u.is_active = 1
       GROUP BY u.id, u.name, u.role
       HAVING total_tasks > 0
       ORDER BY avg_score DESC`,
      {
        replacements: (from_date && to_date) ? { from_date, to_date } : {},
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Score distribution (0-2, 3-5, 6-8, 9-10 buckets)
    const distribution = await sequelize.query(
      `SELECT
         CASE
           WHEN score BETWEEN 0 AND 2 THEN '0-2 (Poor)'
           WHEN score BETWEEN 3 AND 5 THEN '3-5 (Average)'
           WHEN score BETWEEN 6 AND 8 THEN '6-8 (Good)'
           WHEN score BETWEEN 9 AND 10 THEN '9-10 (Excellent)'
         END AS bucket,
         COUNT(*) AS count
       FROM tasks
       WHERE score IS NOT NULL AND deleted_at IS NULL
       GROUP BY bucket
       ORDER BY MIN(score)`,
      { type: sequelize.QueryTypes.SELECT }
    );

    // Overall summary
    const summary = await sequelize.query(
      `SELECT
         COUNT(*) AS total_scored,
         ROUND(AVG(score), 2) AS overall_avg_score,
         (SELECT COUNT(*) FROM tasks WHERE status = 'done' AND score IS NULL AND deleted_at IS NULL) AS pending_score_count
       FROM tasks
       WHERE score IS NOT NULL AND deleted_at IS NULL`,
      { type: sequelize.QueryTypes.SELECT }
    );

    sendSuccess(res, {
      scoreDashboard: {
        scoreTable,
        distribution,
        summary: summary[0],
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/unscored — tasks ready for scoring (done, no score yet)
exports.getUnscored = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req.query);

    const where = { status: 'done', score: null };
    if (req.query.assigned_to) where.assigned_to = req.query.assigned_to;

    const { count, rows } = await Task.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name'] },
        { model: Order, as: 'order', attributes: ['id', 'order_number'] },
      ],
      order: [['completed_at', 'DESC']],
      limit,
      offset,
    });

    sendPaginated(res, rows, { total: count, page, limit });
  } catch (err) {
    next(err);
  }
};
