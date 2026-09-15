'use strict';

const jwt = require('jsonwebtoken');
const { User, Role, Permission, UserPermission } = require('../models');
const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * Compute user effective permissions combining role defaults and user-specific grant/revoke overrides
 */
const getEffectivePermissions = async (user) => {
  if (!user) return [];
  const userRole = (user.role || '').toLowerCase().trim();

  if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'super admin') {
    try {
      const allPerms = await Permission.findAll({ attributes: ['name'] });
      if (allPerms && allPerms.length > 0) return ['*', ...allPerms.map(p => p.name)];
    } catch (_) {}
    return ['*'];
  }

  const roleNameMap = {
    admin: 'Super admin',
    super_admin: 'Super admin',
    'super admin': 'Super admin',
    manager: 'Manager',
    employee: 'Employee',
    hr: 'Hr',
    sales: 'Sales',
    telecaller: 'Telecaller',
    'tele caller': 'Telecaller',
    support: 'Employee',
    ceo: 'Manager',
    reviewer: 'Reviewer',
    accountant: 'Accountant',
    spn_ads_manager: 'SPN & ADs Manager',
    'spn & ads manager': 'SPN & ADs Manager',
    senior_account_manager: 'Senior Account Manager',
    'senior account manager': 'Senior Account Manager',
    delivery_boy: 'Delivery Boy',
    'delivery boy': 'Delivery Boy',
    ecommerce_executive: 'E-Commerce Executive',
    'e-commerce executive': 'E-Commerce Executive',
  };

  const targetRoleName = roleNameMap[userRole] || user.role;
  let permissions = [];

  try {
    const roles = await Role.findAll({
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    });

    const matchedRole = roles.find(
      r => r.name.toLowerCase().trim() === targetRoleName.toLowerCase().trim()
    );

    if (matchedRole && matchedRole.permissions) {
      permissions = matchedRole.permissions.map(p => p.name);
    }
  } catch (e) {
    logger.warn(`Could not load role permissions for role ${targetRoleName}: ${e.message}`);
  }

  try {
    const overrides = await UserPermission.findAll({
      where: { user_id: user.id },
      include: [{ model: Permission, as: 'permission' }],
    });

    overrides.forEach(ov => {
      if (ov.permission) {
        if (ov.is_allowed) {
          if (!permissions.includes(ov.permission.name)) permissions.push(ov.permission.name);
        } else {
          permissions = permissions.filter(p => p !== ov.permission.name);
        }
      }
    });
  } catch (e) {
    logger.warn(`Could not load user permission overrides for user ${user.id}: ${e.message}`);
  }

  return permissions;
};

/**
 * Verify JWT and attach user & permissions to req.user
 */
const protect = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return next(new AppError('Access token required. Please log in.', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password', 'refresh_token'] },
    });

    if (!user) {
      return next(new AppError('User associated with this token no longer exists.', 401));
    }

    if (!user.is_active) {
      return next(new AppError('Your account has been deactivated. Contact an administrator.', 401));
    }

    const { SYSTEM_ROLES, DATA_SCOPES } = require('../config/rolesAndCapabilities');
    const permissions = await getEffectivePermissions(user);
    user.permissions = permissions;
    if (!user.data_scope) {
      const roleDef = SYSTEM_ROLES.find(
        r => r.name.toLowerCase().trim() === (user.role || '').toLowerCase().trim() ||
             r.key.toLowerCase().trim() === (user.role || '').toLowerCase().trim()
      );
      user.data_scope = roleDef ? roleDef.data_scope : DATA_SCOPES.ALL;
    }
    req.user = user;
    try {
      const { trackPresence } = require('./presenceMiddleware');
      trackPresence(req, res, () => {});
    } catch (_) {}
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token has expired. Please refresh your session.', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid access token.', 401));
    }
    logger.error('Auth middleware error:', err);
    next(new AppError('Authentication failed.', 401));
  }
};

/**
 * Role & Permission-based access control
 * Checks role matching or granted module permissions
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    const userRole = (req.user.role || '').toLowerCase().trim();
    const isSuperAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === 'super admin' ||
      (Array.isArray(req.user.permissions) && req.user.permissions.includes('*'));

    if (isSuperAdmin) {
      return next();
    }

    const normalizedAllowedRoles = roles.map(r => r.toLowerCase().trim());
    if (normalizedAllowedRoles.includes(userRole)) {
      return next();
    }

    // Dynamic Module Permission Fallback for Custom Access Users
    const userPerms = req.user.permissions || [];
    const routeModuleMap = {
      orders: ['orders:view', 'orders:create', 'orders:edit', 'orders:delete'],
      customers: ['customers:view', 'customers:create', 'customers:edit', 'customers:delete'],
      tasks: ['tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'daily_tasks:view', 'daily_tasks:create', 'daily_tasks:edit', 'daily_tasks:delete'],
      'daily-tasks': ['daily_tasks:view', 'daily_tasks:create', 'daily_tasks:edit', 'daily_tasks:delete', 'tasks:view', 'tasks:create'],
      followups: ['followups:view', 'followups:create', 'followups:edit'],
      'follow-ups': ['followups:view', 'followups:create', 'followups:edit'],
      shipping: ['shipping:view', 'shipping:edit'],
      warranty: ['warranty:view', 'warranty:verify'],
      reviews: ['reviews:view', 'reviews:create', 'reviews:edit', 'reviews:delete', 'reviews:verify'],
      accounting: ['accounting:view', 'accounting:edit', 'accounting:manage'],
      inventory: ['inventory:view', 'inventory:edit', 'inventory:manage'],
      ads: ['ads:view', 'ads:manage'],
      delivery: ['delivery:view', 'delivery:manage'],
      cheques: ['cheques:view', 'cheques:manage'],
      reports: ['reports:view'],
      employees: ['employees:view', 'employees:create', 'employees:edit', 'employees:delete', 'onboarding:view'],
      hr: ['employees:view', 'onboarding:view', 'document_center:view', 'attendance:view'],
      attendance: ['attendance:view', 'attendance:edit', 'attendance:manage', 'employees:view'],
      biometric: ['biometric:view', 'biometric:manage', 'biometric:sync', 'attendance:manage'],
      'user-access': ['users:view', 'users:manage', 'access:manage'],
      'user-management': ['users:view', 'users:manage', 'access:manage'],
      users: ['users:view', 'users:manage', 'access:manage'],
      'employee-audit': ['employees:view', 'access:manage'],
      settings: ['access:manage', 'users:manage'],
    };

    const pathOrBase = (req.baseUrl || req.originalUrl || req.path || '').toLowerCase();
    for (const [modKey, perms] of Object.entries(routeModuleMap)) {
      if (pathOrBase.includes(modKey)) {
        if (perms.some(p => userPerms.includes(p))) {
          return next();
        }
      }
    }

    return next(
      new AppError(
        `Role '${req.user.role}' is not authorized to access this resource.`,
        403
      )
    );
  };
};

/**
 * Permission-based access control
 * Checks if user has any of the required permissions
 */
const checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }
    const userRole = (req.user.role || '').toLowerCase().trim();
    if (
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === 'super admin' ||
      (Array.isArray(req.user.permissions) && req.user.permissions.includes('*'))
    ) {
      return next();
    }
    const userPerms = req.user.permissions || [];
    const hasPerm = requiredPermissions.some(reqPerm => {
      if (userPerms.includes(reqPerm)) return true;
      const mod = reqPerm.split(':')[0];
      if (userPerms.includes(`${mod}:*`)) return true;
      return false;
    });
    if (!hasPerm) {
      return next(
        new AppError(`Forbidden: Missing required permission [${requiredPermissions.join(', ')}]`, 403)
      );
    }
    next();
  };
};

/**
 * Allow admins to act as other users (for impersonation/support)
 */
const optionalProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password', 'refresh_token'] },
      });
      if (user && user.is_active) {
        const permissions = await getEffectivePermissions(user);
        const userObj = user.toJSON ? user.toJSON() : user;
        userObj.permissions = permissions;
        req.user = userObj;
      }
    }
  } catch (_) {}
  next();
};

module.exports = { protect, authenticate: protect, authorize, checkPermission, optionalProtect, getEffectivePermissions };
