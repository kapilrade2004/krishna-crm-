'use strict';

const jwt = require('jsonwebtoken');
const { User, LoginHistory, sequelize } = require('../models');
const { AppError } = require('../utils/errors');
const { Op } = require('sequelize');
const { sendSuccess, sendCreated } = require('../utils/response');
const logger = require('../config/logger');

const parseDeviceInfo = (req) => {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  
  let browser = 'Unknown';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Postman')) browser = 'Postman Runtime';
  
  let os = 'Unknown';
  if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let device = 'Desktop';
  if (/mobile|android|iphone|ipad|phone/i.test(ua)) device = 'Mobile';
  if (/ipad|tablet/i.test(ua)) device = 'Tablet';

  return { ip, userAgent: ua.slice(0, 500), browser, os, device };
};

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'refresh_secret', {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

const { getEffectivePermissions } = require('../middleware/auth');

const sendTokenResponse = async (user, statusCode, res) => {
  const accessToken = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  // httpOnly cookie for refresh token
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });

  const userSafe = user.toSafeJSON ? user.toSafeJSON() : user;
  try {
    userSafe.permissions = await getEffectivePermissions(user);
  } catch (err) {
    logger.warn(`Failed to resolve permissions for user ${user.id}: ${err.message}`);
    userSafe.permissions = [];
  }

  // Include security flags
  userSafe.force_password_reset = Boolean(user.force_password_reset);
  userSafe.is_locked = Boolean(user.is_locked);
  userSafe.status = user.status || 'active';

  return res.status(statusCode).json({
    status: 'success',
    accessToken,
    refreshToken,
    user: userSafe,
  });
};

// GET /api/auth/demo-accounts (public)
exports.getDemoAccounts = async (req, res, next) => {
  try {
    const roleBadges = {
      super_admin: 'bg-red-100 text-red-800 border border-red-200',
      admin: 'bg-red-100 text-red-800 border border-red-200',
      manager: 'bg-purple-100 text-purple-800 border border-purple-200',
      hr: 'bg-pink-100 text-pink-800 border border-pink-200',
      telecaller: 'bg-amber-100 text-amber-800 border border-amber-200',
      sales: 'bg-blue-100 text-blue-800 border border-blue-200',
      technician: 'bg-orange-100 text-orange-800 border border-orange-200',
      employee: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      reviewer: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
      accountant: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      spn_ads_manager: 'bg-orange-100 text-orange-800 border border-orange-200',
      senior_account_manager: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
      delivery_boy: 'bg-lime-100 text-lime-800 border border-lime-200',
      ecommerce_executive: 'bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200',
      support: 'bg-teal-100 text-teal-800 border border-teal-200',
      ceo: 'bg-amber-100 text-amber-800 border border-amber-200',
    };

    const roleLabels = {
      super_admin: 'Super Admin',
      admin: 'Super Admin',
      manager: 'Operations Manager',
      hr: 'HR Executive',
      telecaller: 'Telecaller',
      sales: 'Sales Executive',
      technician: 'Field Technician',
      employee: 'Operations Staff',
      reviewer: 'Product Reviewer',
      accountant: 'Accountant',
      spn_ads_manager: 'SPN & Ads Manager',
      senior_account_manager: 'Senior Account Manager',
      delivery_boy: 'Delivery / Dispatch',
      ecommerce_executive: 'E-Commerce Executive',
      support: 'Customer Support',
      ceo: 'Chief Executive Officer',
    };

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const activeUsers = await User.findAll({
      where: {
        is_active: true,
        [Op.or]: [{ is_deleted: false }, { is_deleted: null }],
        status: 'active',
        is_locked: false,
      },
      attributes: ['id', 'email', 'role', 'name', 'first_name', 'last_name', 'display_password', 'department', 'designation', 'phone', 'employee_id', 'status'],
      order: [
        sequelize.literal("CASE WHEN role IN ('admin', 'super_admin') THEN 1 WHEN role = 'manager' THEN 2 WHEN role = 'hr' THEN 3 WHEN role = 'sales' THEN 4 WHEN role = 'telecaller' THEN 5 ELSE 6 END"),
        ['name', 'ASC'],
      ],
    });

    const accounts = activeUsers.map((u) => {
      const roleKey = (u.role || '').toLowerCase();
      const pwd = u.display_password || 'Admin@123456';
      const cleanName = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User';
      const cleanRoleLabel = roleLabels[roleKey] || u.role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        id: u.id,
        name: cleanName,
        email: u.email,
        password: pwd,
        role: u.role,
        roleLabel: cleanRoleLabel,
        roleDesc: u.designation || (u.department ? `${u.department} · ${cleanRoleLabel}` : cleanRoleLabel),
        department: u.department || 'Operations',
        badgeColor: roleBadges[roleKey] || 'bg-slate-100 text-slate-700 border border-slate-200',
        status: u.status,
      };
    });

    sendSuccess(res, accounts);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  const devInfo = parseDeviceInfo(req);
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Email and password are required.', 400));
    }

    const cleanEmail = email.toLowerCase().trim();
    let user = await User.findOne({ where: { email: cleanEmail } });

    // Backward compatibility alias lookup
    if (!user && cleanEmail.includes('@laxmiindustries.com')) {
      user = await User.findOne({ where: { email: cleanEmail.replace('@laxmiindustries.com', '@krishnacrm.com') } });
    }
    if (!user && cleanEmail.includes('@krishnacrm.com')) {
      user = await User.findOne({ where: { email: cleanEmail.replace('@krishnacrm.com', '@laxmiindustries.com') } });
    }

    if (!user || !(await user.comparePassword(password))) {
      await LoginHistory.create({
        user_id: user ? user.id : null,
        email: cleanEmail,
        login_at: new Date(),
        ip_address: devInfo.ip,
        user_agent: devInfo.userAgent,
        browser: devInfo.browser,
        os: devInfo.os,
        device: devInfo.device,
        status: 'failed',
        failure_reason: 'Invalid email or password',
      }).catch(e => logger.warn(`LoginHistory log failed: ${e.message}`));

      return next(new AppError('Invalid email or password.', 401));
    }

    // Check if account is locked
    if (user.is_locked) {
      await LoginHistory.create({
        user_id: user.id,
        email: cleanEmail,
        login_at: new Date(),
        ip_address: devInfo.ip,
        user_agent: devInfo.userAgent,
        browser: devInfo.browser,
        os: devInfo.os,
        device: devInfo.device,
        status: 'locked',
        failure_reason: user.locked_reason || 'Account is locked by administrator',
      }).catch(e => logger.warn(`LoginHistory log failed: ${e.message}`));

      return next(new AppError(user.locked_reason ? `Account is locked: ${user.locked_reason}` : 'Your account has been locked. Please contact your Super Admin.', 403));
    }

    // Check account status
    const status = user.status || (user.is_active ? 'active' : 'inactive');
    if (status === 'suspended') {
      await LoginHistory.create({
        user_id: user.id,
        email: cleanEmail,
        login_at: new Date(),
        ip_address: devInfo.ip,
        user_agent: devInfo.userAgent,
        browser: devInfo.browser,
        os: devInfo.os,
        device: devInfo.device,
        status: 'suspended',
        failure_reason: 'Account suspended',
      }).catch(e => logger.warn(`LoginHistory log failed: ${e.message}`));

      return next(new AppError('Your account has been suspended. Please contact an administrator.', 403));
    }

    if (status === 'pending_activation') {
      await LoginHistory.create({
        user_id: user.id,
        email: cleanEmail,
        login_at: new Date(),
        ip_address: devInfo.ip,
        user_agent: devInfo.userAgent,
        browser: devInfo.browser,
        os: devInfo.os,
        device: devInfo.device,
        status: 'pending_activation',
        failure_reason: 'Pending account activation',
      }).catch(e => logger.warn(`LoginHistory log failed: ${e.message}`));

      return next(new AppError('Your account is pending activation. Please wait for an administrator to activate your access.', 403));
    }

    if (!user.is_active || user.is_deleted || status === 'inactive' || status === 'archived') {
      await LoginHistory.create({
        user_id: user.id,
        email: cleanEmail,
        login_at: new Date(),
        ip_address: devInfo.ip,
        user_agent: devInfo.userAgent,
        browser: devInfo.browser,
        os: devInfo.os,
        device: devInfo.device,
        status: 'inactive',
        failure_reason: 'Account deactivated or archived',
      }).catch(e => logger.warn(`LoginHistory log failed: ${e.message}`));

      return next(new AppError('Your account is deactivated. Contact an administrator.', 401));
    }

    // Persist refresh token & last login
    const refreshToken = signRefreshToken(user.id);
    await user.update({
      refresh_token: refreshToken,
      last_login_at: new Date(),
    });

    // Record successful login
    await LoginHistory.create({
      user_id: user.id,
      email: cleanEmail,
      login_at: new Date(),
      ip_address: devInfo.ip,
      user_agent: devInfo.userAgent,
      browser: devInfo.browser,
      os: devInfo.os,
      device: devInfo.device,
      status: 'success',
    }).catch(e => logger.warn(`LoginHistory log failed: ${e.message}`));

    logger.info(`User ${user.email} logged in successfully from ${devInfo.ip} (${devInfo.browser} on ${devInfo.os})`);
    await sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
exports.refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!token) return next(new AppError('Refresh token required.', 401));

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findOne({
      where: { id: decoded.id, refresh_token: token },
    });

    if (!user || !user.is_active) {
      return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
    }

    const newRefreshToken = signRefreshToken(user.id);
    await user.update({ refresh_token: newRefreshToken });

    await sendTokenResponse(user, 200, res);
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid or expired refresh token. Please log in again.', 401));
    }
    next(err);
  }
};

// POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    if (req.user) {
      await req.user.update({ refresh_token: null });
    }
    res.clearCookie('refresh_token');
    sendSuccess(res, null, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const userSafe = req.user.toSafeJSON ? req.user.toSafeJSON() : { ...req.user };
    try {
      userSafe.permissions = await getEffectivePermissions(req.user);
    } catch (_) {
      userSafe.permissions = req.user.permissions || [];
    }
    sendSuccess(res, { user: userSafe });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/me
exports.updateMe = async (req, res, next) => {
  try {
    const { name, phone, avatar_url } = req.body;
    // Prevent password change via this route
    if (req.body.password) {
      return next(new AppError('Use /auth/change-password to update your password.', 400));
    }
    await req.user.update({ name, phone, avatar_url });
    const userSafe = req.user.toSafeJSON ? req.user.toSafeJSON() : { ...req.user };
    try {
      userSafe.permissions = await getEffectivePermissions(req.user);
    } catch (_) {
      userSafe.permissions = req.user.permissions || [];
    }
    sendSuccess(res, { user: userSafe }, 'Profile updated.');
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return next(new AppError('Current and new password are required.', 400));
    }
    if (newPassword.length < 8) {
      return next(new AppError('New password must be at least 8 characters.', 400));
    }

    const user = await User.findByPk(req.user.id);
    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect.', 400));
    }

    await user.update({ password: newPassword });
    sendSuccess(res, null, 'Password changed successfully.');
  } catch (err) {
    next(err);
  }
};

// ─── Admin: User Management ───────────────────────────────────────────────────

// POST /api/auth/users  (admin only)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const user = await User.create({ name, email: email.toLowerCase(), password, role, phone });
    sendCreated(res, { user: user.toSafeJSON() }, 'User created successfully.');
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/users  (admin/manager)
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password', 'refresh_token'] },
      order: [['name', 'ASC']],
    });
    sendSuccess(res, { users });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/users/:id  (admin)
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return next(new AppError('User not found.', 404));
    const { name, role, is_active, phone } = req.body;
    await user.update({ name, role, is_active, phone });
    sendSuccess(res, { user: user.toSafeJSON() }, 'User updated.');
  } catch (err) {
    next(err);
  }
};

// DELETE /api/auth/users/:id  (admin)
exports.deleteUser = async (req, res, next) => {
  const { deleteUser } = require('./userAccess.controller');
  return deleteUser(req, res, next);
};
