'use strict';

const { User, Employee, EmployeeBiometricMapping, AttendanceDay } = require('../models');
const { computePresenceStatus, presenceCache } = require('../middleware/presenceMiddleware');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * POST /api/presence/heartbeat
 * Heartbeat sent by client application every 30s.
 */
exports.heartbeat = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError('Authentication required.', 401));
    }

    const now = new Date();
    presenceCache.set(userId, now.getTime());

    await User.update(
      {
        last_active_at: now,
        presence_status: 'online',
      },
      { where: { id: userId } }
    );

    sendSuccess(res, {
      user_id: userId,
      status: 'online',
      timestamp: now.toISOString(),
    }, 'Heartbeat acknowledged.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/presence/team
 * Returns the application presence of workforce members along with biometric status indicator.
 * Clearly separates CRM Application Online status from Biometric Attendance status.
 */
exports.getTeamPresence = async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Fetch active users with linked employee profile and today's attendance if exists
    const users = await User.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'email', 'role', 'department', 'designation', 'last_active_at', 'presence_status', 'avatar_url'],
      include: [
        {
          model: Employee,
          as: 'employeeProfile',
          attributes: ['id', 'employee_code', 'first_name', 'last_name', 'department', 'designation'],
          include: [
            {
              model: AttendanceDay,
              as: 'attendanceDays',
              where: { date: todayStr },
              required: false,
              attributes: ['id', 'status', 'first_in', 'last_out', 'work_hours'],
            },
            {
              model: EmployeeBiometricMapping,
              as: 'biometricMapping',
              required: false,
              attributes: ['biometric_user_id', 'enrollment_status'],
            },
          ],
        },
      ],
      order: [['name', 'ASC']],
    });

    const members = users.map((u) => {
      const computedPresence = computePresenceStatus(u.last_active_at);
      const emp = u.employeeProfile;
      const todayAtt = emp?.attendanceDays?.[0];

      return {
        user_id: u.id,
        user_name: u.name,
        user_email: u.email,
        role: u.role,
        department: u.department || emp?.department || 'General',
        designation: u.designation || emp?.designation || 'Staff',
        avatar_url: u.avatar_url,
        // CRM Application Presence
        crm_presence: {
          status: computedPresence,
          last_active_at: u.last_active_at,
          is_online: computedPresence === 'online',
        },
        // Physical Biometric Attendance (Independent)
        biometric_attendance: {
          employee_id: emp?.id || null,
          employee_code: emp?.employee_code || null,
          enrolled: emp?.biometricMapping?.enrollment_status === 'enrolled',
          status_today: todayAtt?.status || 'ABSENT',
          clock_in: todayAtt?.first_in || null,
          clock_out: todayAtt?.last_out || null,
          work_hours: todayAtt?.work_hours || 0,
        },
      };
    });

    const summary = {
      total_users: members.length,
      crm_online: members.filter((m) => m.crm_presence.status === 'online').length,
      crm_idle: members.filter((m) => m.crm_presence.status === 'idle').length,
      crm_offline: members.filter((m) => m.crm_presence.status === 'offline').length,
      biometric_present: members.filter((m) => ['PRESENT', 'LATE', 'HALF_DAY', 'OVERTIME'].includes(m.biometric_attendance.status_today)).length,
    };

    sendSuccess(res, { members, summary });
  } catch (err) {
    next(err);
  }
};
