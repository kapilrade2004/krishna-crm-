'use strict';

const { Op } = require('sequelize');
const { DailyActivity, DailyActivityHistory, User } = require('../models');
const { createAuditEvent } = require('./auditService');
const logger = require('../config/logger');

const EVALUATION_INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes

let timer = null;

/**
 * Dynamically evaluate an individual activity.
 * If elapsed time > shift_duration (hours) and status is ASSIGNED or IN_PROGRESS,
 * marks it INCOMPLETE and logs history.
 */
async function evaluateSingleActivity(activity, actorId = null) {
  if (!activity || !['ASSIGNED', 'IN_PROGRESS'].includes(activity.status)) {
    return activity;
  }

  const assignedAtTime = new Date(activity.assigned_at).getTime();
  const shiftDurationMs = (activity.shift_duration || 24) * 60 * 60 * 1000;
  const now = Date.now();

  if (now > assignedAtTime + shiftDurationMs) {
    const oldStatus = activity.status;
    activity.status = 'INCOMPLETE';
    await activity.save();

    // Log history
    await DailyActivityHistory.create({
      activity_id: activity.id,
      actor_id: actorId || activity.assigned_by,
      event_type: 'ACTIVITY_INCOMPLETE',
      old_status: oldStatus,
      new_status: 'INCOMPLETE',
      notes: `Activity marked INCOMPLETE automatically after ${activity.shift_duration || 24} hours shift duration expired.`,
    });

    // Log Employee Audit Event
    await createAuditEvent({
      userId: activity.assigned_to,
      actorUserId: actorId || activity.assigned_by,
      action: 'ACTIVITY_INCOMPLETE',
      module: 'daily_activities',
      entityType: 'DailyActivity',
      entityId: activity.id,
      metadata: {
        title: activity.title,
        shift_duration: activity.shift_duration || 24,
        assigned_at: activity.assigned_at,
        expired_at: new Date(),
      },
      oldValues: { status: oldStatus },
      newValues: { status: 'INCOMPLETE' },
    });

    logger.info(`DailyActivity ${activity.id} ("${activity.title}") automatically transitioned to INCOMPLETE.`);
  }

  return activity;
}

/**
 * Batch evaluation runner for all active activities across the system.
 */
const runEvaluation = async () => {
  try {
    const activeActivities = await DailyActivity.findAll({
      where: {
        status: { [Op.in]: ['ASSIGNED', 'IN_PROGRESS'] },
      },
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'assigner', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (activeActivities.length === 0) return;

    let expiredCount = 0;
    for (const activity of activeActivities) {
      const assignedAtTime = new Date(activity.assigned_at).getTime();
      const shiftDurationMs = (activity.shift_duration || 24) * 60 * 60 * 1000;
      const now = Date.now();

      if (now > assignedAtTime + shiftDurationMs) {
        await evaluateSingleActivity(activity);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.info(`Shift Evaluation: Transitioned ${expiredCount} expired activities to INCOMPLETE.`);
    }
  } catch (err) {
    logger.error('Error during automatic shift evaluation run:', err);
  }
};

const start = () => {
  if (timer) return;
  logger.info('Daily Activity shift evaluation scheduler started (interval: 5 min).');
  // Initial evaluation on startup
  runEvaluation();
  timer = setInterval(runEvaluation, EVALUATION_INTERVAL_MS);
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Daily Activity shift evaluation scheduler stopped.');
  }
};

module.exports = {
  start,
  stop,
  runEvaluation,
  evaluateSingleActivity,
};
