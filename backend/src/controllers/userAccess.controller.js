'use strict';

const {
  User,
  Role,
  Permission,
  UserPermission,
  RolePermission,
  LoginHistory,
  UserAuditLog,
  AccessTemplate,
  AccessRequest,
  Employee,
  sequelize
} = require('../models');
const { AppError } = require('../utils/errors');
const { getEffectivePermissions } = require('../middleware/auth');
const logger = require('../config/logger');
const { Op } = require('sequelize');
const userEmployeeSyncService = require('../services/userEmployeeSyncService');

// Helper to log user management audit event
const logUserAudit = async ({
  actorUserId,
  targetUserId,
  eventType,
  oldValues = null,
  newValues = null,
  req = null,
  transaction = null
}) => {
  try {
    const ipAddress = req ? (req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '') : null;
    const userAgent = req ? (req.headers?.['user-agent'] || '').slice(0, 500) : null;
    await UserAuditLog.create(
      {
        actor_user_id: actorUserId,
        target_user_id: targetUserId,
        event_type: eventType,
        module: 'user_management',
        old_values: oldValues,
        new_values: newValues,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      transaction ? { transaction } : {}
    );
  } catch (err) {
    logger.warn(`Failed to create UserAuditLog for ${eventType}: ${err.message}`);
  }
};

/**
 * Get all users (with optional archived filter)
 */
const getUsers = async (req, res, next) => {
  try {
    const { search, role, status, includeArchived } = req.query;

    const where = {};
    if (includeArchived !== 'true') {
      where.is_deleted = false;
      where.status = { [Op.ne]: 'archived' };
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.like]: q } },
        { email: { [Op.like]: q } },
        { phone: { [Op.like]: q } },
        { department: { [Op.like]: q } },
        { designation: { [Op.like]: q } },
        { employee_id: { [Op.like]: q } },
      ];
    }

    const users = await User.findAll({
      where,
      attributes: { exclude: ['password', 'refresh_token'] },
      order: [['created_at', 'DESC']],
    });

    const userList = await Promise.all(
      users.map(async (u) => {
        const uJson = u.toJSON();
        uJson.permissions = await getEffectivePermissions(u);
        uJson.display_password = u.display_password || 'Admin@123456';
        return uJson;
      })
    );

    res.json({
      status: 'success',
      data: userList,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single user by ID
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password', 'refresh_token'] },
    });

    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    const uJson = user.toJSON();
    uJson.permissions = await getEffectivePermissions(user);

    res.json({
      status: 'success',
      data: uJson,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new user (4-Section input: Personal, Organization, Account, Access)
 */
const createUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      // Section 1: Personal
      first_name,
      last_name,
      email,
      phone,
      // Section 2: Organization
      department,
      designation,
      employee_id,
      reporting_manager_id,
      // Section 3: Account
      name,
      password,
      status = 'active',
      force_password_reset = false,
      // Section 4: Access Control
      access_type = 'role', // 'role' | 'custom'
      role = 'sales',
      custom_role_name,
      overrides = [],
      template_id = null,
    } = req.body;

    const finalName = name?.trim() || `${first_name || ''} ${last_name || ''}`.trim();
    const cleanEmail = email?.toLowerCase().trim();

    if (!finalName || !cleanEmail || !password) {
      await transaction.rollback();
      return next(new AppError('Name/First Name, Email, and Password are required.', 400));
    }

    const creatorRole = req.user ? req.user.role : 'super_admin';
    const isSuperAdmin = creatorRole === 'admin' || creatorRole === 'super_admin';
    const isManager = creatorRole === 'manager' || creatorRole === 'ceo';
    const isHR = creatorRole === 'hr';

    let targetRole = role || 'sales';
    if (targetRole === 'custom' && custom_role_name && custom_role_name.trim()) {
      targetRole = custom_role_name.trim();
    }

    // Hierarchy check: Non-super admins CANNOT create Super Admin accounts
    if (!isSuperAdmin) {
      if (['admin', 'super_admin', 'super admin'].includes(targetRole.toLowerCase())) {
        await transaction.rollback();
        return next(new AppError('Only Super Admin can create Super Admin accounts.', 403));
      }

      // If manager or HR, allowed operational creation
      if (!isManager && !isHR) {
        const creatorPermissions = req.user ? req.user.permissions || [] : [];
        if (!creatorPermissions.includes('*') && !creatorPermissions.includes('users:create')) {
          await transaction.rollback();
          return next(new AppError('You do not possess permission to create users.', 403));
        }
      }
    }

    const existing = await User.findOne({ where: { email: cleanEmail }, transaction });
    if (existing) {
      await transaction.rollback();
      return next(new AppError('Email is already registered in the system.', 400));
    }

    const newUser = await User.create(
      {
        name: finalName,
        first_name: first_name?.trim() || null,
        last_name: last_name?.trim() || null,
        email: cleanEmail,
        password,
        display_password: password,
        phone: phone || null,
        department: department || null,
        designation: designation || null,
        employee_id: employee_id || null,
        reporting_manager_id: reporting_manager_id || null,
        role: targetRole,
        status: status || 'active',
        is_active: status === 'active',
        force_password_reset: Boolean(force_password_reset),
        temp_password_created_at: new Date(),
        is_deleted: false,
      },
      { transaction }
    );

    // Apply template permissions if specified
    let finalOverrides = [...overrides];
    if (template_id) {
      const tpl = await AccessTemplate.findByPk(template_id, { transaction });
      if (tpl && Array.isArray(tpl.permissions)) {
        tpl.permissions.forEach(pName => {
          if (!finalOverrides.some(ov => ov.permission_name === pName)) {
            finalOverrides.push({ permission_name: pName, is_allowed: true });
          }
        });
      }
    }

    // Enforce delegation check: Non-super-admins cannot grant permissions they don't have
    if (Array.isArray(finalOverrides) && finalOverrides.length > 0) {
      const creatorPermissions = req.user ? req.user.permissions || [] : [];

      for (const ov of finalOverrides) {
        if (ov.is_allowed === true) {
          let perm = null;
          if (ov.permission_id) {
            perm = await Permission.findByPk(ov.permission_id, { transaction });
          } else if (ov.permission_name) {
            perm = await Permission.findOne({ where: { name: ov.permission_name }, transaction });
          }

          if (perm && !isSuperAdmin && !creatorPermissions.includes('*') && !creatorPermissions.includes(perm.name)) {
            await transaction.rollback();
            return next(new AppError(`Forbidden: You cannot grant permission '${perm.name}' as you do not possess access to it.`, 403));
          }

          if (perm) {
            await UserPermission.create(
              {
                user_id: newUser.id,
                permission_id: perm.id,
                is_allowed: Boolean(ov.is_allowed),
              },
              { transaction }
            );
          }
        }
      }
    }

    // Automatically synchronize new user into Employee directory
    try {
      await userEmployeeSyncService.syncUserToEmployee(newUser, { transaction });
    } catch (empErr) {
      logger.warn(`Could not sync employee profile for ${cleanEmail}: ${empErr.message}`);
    }

    // Audit Logging
    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: newUser.id,
      eventType: 'USER_CREATED',
      newValues: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        department: newUser.department,
        designation: newUser.designation,
      },
      req,
      transaction,
    });

    await transaction.commit();

    const userJson = newUser.toSafeJSON();
    userJson.permissions = await getEffectivePermissions(newUser);

    res.status(201).json({
      status: 'success',
      message: 'User created successfully.',
      data: userJson,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Update user basic details, organization, status, or role
 */
const updateUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      name,
      first_name,
      last_name,
      email,
      role,
      custom_role_name,
      phone,
      department,
      designation,
      employee_id,
      reporting_manager_id,
      status,
      is_active,
      is_locked,
      locked_reason,
      force_password_reset,
      password,
      newPassword,
      new_password,
    } = req.body;

    const user = await User.findByPk(id, { transaction });
    if (!user) {
      await transaction.rollback();
      return next(new AppError('User not found.', 404));
    }

    const creatorRole = req.user ? req.user.role : 'super_admin';
    const isSuperAdmin = creatorRole === 'admin' || creatorRole === 'super_admin';

    // Hierarchy Protection Rule:
    // Only Super Admin can modify Super Admin, Manager, HR, or elevated custom users
    const isTargetSuperAdmin = user.role === 'admin' || user.role === 'super_admin';
    const isTargetElevated = ['manager', 'hr', 'ceo'].includes(user.role?.toLowerCase());

    if (!isSuperAdmin) {
      if (isTargetSuperAdmin) {
        await transaction.rollback();
        return next(new AppError('Forbidden: Only Super Admin can modify Super Admin accounts.', 403));
      }
      if (isTargetElevated && req.user.id !== user.id) {
        await transaction.rollback();
        return next(new AppError('Forbidden: Only Super Admin can modify Manager or HR accounts.', 403));
      }
      if (role && ['admin', 'super_admin'].includes(role.toLowerCase())) {
        await transaction.rollback();
        return next(new AppError('Forbidden: You cannot promote users to Super Admin.', 403));
      }
    }

    const oldValues = user.toJSON();

    if (name !== undefined) user.name = name;
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;
    if (first_name || last_name) {
      user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name;
    }

    // Email update support with uniqueness check
    if (email && email.trim() && email.toLowerCase().trim() !== user.email) {
      const cleanEmail = email.toLowerCase().trim();
      const existingEmail = await User.findOne({
        where: {
          email: cleanEmail,
          id: { [Op.ne]: user.id },
        },
        transaction,
      });
      if (existingEmail) {
        await transaction.rollback();
        return next(new AppError('Email is already registered to another user.', 400));
      }
      user.email = cleanEmail;
    }

    let targetRole = role;
    if (targetRole === 'custom' && custom_role_name && custom_role_name.trim()) {
      targetRole = custom_role_name.trim();
    }
    if (targetRole !== undefined) user.role = targetRole;

    if (phone !== undefined) user.phone = phone;
    if (department !== undefined) user.department = department;
    if (designation !== undefined) user.designation = designation;
    if (employee_id !== undefined) user.employee_id = employee_id;
    if (reporting_manager_id !== undefined) user.reporting_manager_id = reporting_manager_id;

    if (status !== undefined) {
      user.status = status;
      user.is_active = status === 'active';
    } else if (is_active !== undefined) {
      user.is_active = is_active;
      user.status = is_active ? 'active' : 'inactive';
    }

    if (is_locked !== undefined) {
      user.is_locked = Boolean(is_locked);
      user.locked_at = is_locked ? new Date() : null;
      user.locked_reason = is_locked ? (locked_reason || 'Locked by administrator') : null;
    }

    if (force_password_reset !== undefined) {
      user.force_password_reset = Boolean(force_password_reset);
    }

    // Password update support with display_password sync
    const pwd = password || newPassword || new_password;
    if (pwd && String(pwd).trim().length >= 6) {
      user.password = String(pwd).trim();
      user.display_password = String(pwd).trim();
      user.temp_password_created_at = new Date();
    }

    await user.save({ transaction });

    // Synchronize changes to linked Employee directory
    try {
      await userEmployeeSyncService.syncUserToEmployee(user, { transaction });
    } catch (syncErr) {
      logger.warn(`Failed to sync updated user to employee directory: ${syncErr.message}`);
    }

    // Audit Logging
    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: user.id,
      eventType: 'USER_UPDATED',
      oldValues: {
        name: oldValues.name,
        role: oldValues.role,
        status: oldValues.status,
        department: oldValues.department,
      },
      newValues: {
        name: user.name,
        role: user.role,
        status: user.status,
        department: user.department,
      },
      req,
      transaction,
    });

    await transaction.commit();

    const userJson = user.toSafeJSON();
    userJson.permissions = await getEffectivePermissions(user);

    res.json({
      status: 'success',
      message: 'User updated successfully.',
      data: userJson,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Soft Delete / Archive User
 */
const deleteUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, { transaction });
    if (!user) {
      await transaction.rollback();
      return next(new AppError('User not found.', 404));
    }

    // Prevent self-deletion
    if (req.user && String(req.user.id) === String(id)) {
      await transaction.rollback();
      return next(new AppError('You cannot delete or archive your own account.', 400));
    }

    const creatorRole = req.user ? req.user.role : 'super_admin';
    const isSuperAdmin = creatorRole === 'admin' || creatorRole === 'super_admin';

    // Prevent non-super admin from deleting Super Admin
    if ((user.role === 'admin' || user.role === 'super_admin') && !isSuperAdmin) {
      await transaction.rollback();
      return next(new AppError('Forbidden: You cannot delete a Super Admin account.', 403));
    }

    // Prevent archiving the only remaining Super Admin
    if (user.role === 'admin' || user.role === 'super_admin') {
      const superAdminCount = await User.count({
        where: {
          role: ['admin', 'super_admin'],
          is_deleted: false,
        },
        transaction,
      });
      if (superAdminCount <= 1) {
        await transaction.rollback();
        return next(new AppError('Cannot archive the only remaining active Super Admin account.', 400));
      }
    }

    // Soft delete: remove login access, set status to archived
    user.is_deleted = true;
    user.is_active = false;
    user.status = 'archived';
    user.deleted_at = new Date();
    user.refresh_token = null;
    await user.save({ transaction });

    // Synchronize archive status to employee directory
    try {
      await userEmployeeSyncService.syncUserToEmployee(user, { transaction });
    } catch (syncErr) {
      logger.warn(`Failed to sync archived user status to employee directory: ${syncErr.message}`);
    }

    // Audit Logging
    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: user.id,
      eventType: 'USER_ARCHIVED',
      oldValues: { status: 'active', is_deleted: false },
      newValues: { status: 'archived', is_deleted: true, deleted_at: user.deleted_at },
      req,
      transaction,
    });

    await transaction.commit();

    res.json({
      status: 'success',
      message: `User '${user.name}' has been archived and login access removed.`,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Reset password & optionally force password reset
 */
const resetPassword = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const newPassword = req.body.newPassword || req.body.new_password || req.body.password;
    const forcePasswordReset = req.body.forcePasswordReset !== undefined
      ? req.body.forcePasswordReset
      : req.body.force_password_reset !== undefined
      ? req.body.force_password_reset
      : true;

    if (!newPassword || newPassword.length < 6) {
      await transaction.rollback();
      return next(new AppError('Password must be at least 6 characters.', 400));
    }

    const user = await User.findByPk(id, { transaction });
    if (!user) {
      await transaction.rollback();
      return next(new AppError('User not found.', 404));
    }

    const creatorRole = req.user ? req.user.role : 'super_admin';
    const isSuperAdmin = creatorRole === 'admin' || creatorRole === 'super_admin';
    if (!isSuperAdmin && (user.role === 'admin' || user.role === 'super_admin')) {
      await transaction.rollback();
      return next(new AppError('Forbidden: You cannot reset password for a Super Admin.', 403));
    }

    user.password = newPassword;
    user.display_password = newPassword;
    user.force_password_reset = Boolean(forcePasswordReset);
    user.temp_password_created_at = new Date();
    user.refresh_token = null; // Invalidate current session
    await user.save({ transaction });

    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: user.id,
      eventType: 'PASSWORD_RESET',
      newValues: { force_password_reset: user.force_password_reset },
      req,
      transaction,
    });

    await transaction.commit();

    res.json({
      status: 'success',
      message: `Password reset successfully for ${user.name}.`,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Lock or Unlock user account
 */
const toggleLockUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { lock, reason } = req.body; // lock: boolean

    const user = await User.findByPk(id, { transaction });
    if (!user) {
      await transaction.rollback();
      return next(new AppError('User not found.', 404));
    }

    if (req.user && String(req.user.id) === String(id)) {
      await transaction.rollback();
      return next(new AppError('You cannot lock your own account.', 400));
    }

    const shouldLock = Boolean(lock);
    user.is_locked = shouldLock;
    user.locked_at = shouldLock ? new Date() : null;
    user.locked_reason = shouldLock ? (reason || 'Locked by administrator') : null;
    if (shouldLock) {
      user.refresh_token = null;
    }
    await user.save({ transaction });

    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: user.id,
      eventType: shouldLock ? 'ACCOUNT_LOCKED' : 'ACCOUNT_UNLOCKED',
      newValues: { is_locked: user.is_locked, locked_reason: user.locked_reason },
      req,
      transaction,
    });

    await transaction.commit();

    res.json({
      status: 'success',
      message: `User account has been ${shouldLock ? 'locked' : 'unlocked'} successfully.`,
      data: {
        is_locked: user.is_locked,
        locked_reason: user.locked_reason,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Clone an existing user
 */
const cloneUser = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { sourceUserId, name, email, password, phone, department, designation, employee_id } = req.body;

    if (!sourceUserId || !email || !password) {
      await transaction.rollback();
      return next(new AppError('Source User ID, Email, and Password are required for cloning.', 400));
    }

    const sourceUser = await User.findByPk(sourceUserId, { transaction });
    if (!sourceUser) {
      await transaction.rollback();
      return next(new AppError('Source user to clone from was not found.', 404));
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ where: { email: cleanEmail }, transaction });
    if (existing) {
      await transaction.rollback();
      return next(new AppError('Email is already in use by another user.', 400));
    }

    const creatorRole = req.user ? req.user.role : 'super_admin';
    const isSuperAdmin = creatorRole === 'admin' || creatorRole === 'super_admin';

    if (!isSuperAdmin && (sourceUser.role === 'admin' || sourceUser.role === 'super_admin')) {
      await transaction.rollback();
      return next(new AppError('Forbidden: Cannot clone Super Admin permissions without Super Admin role.', 403));
    }

    const newUser = await User.create(
      {
        name: name || `Clone of ${sourceUser.name}`,
        email: cleanEmail,
        password,
        phone: phone || null,
        department: department || sourceUser.department,
        designation: designation || sourceUser.designation,
        employee_id: employee_id || null,
        reporting_manager_id: sourceUser.reporting_manager_id,
        role: sourceUser.role,
        status: 'active',
        is_active: true,
        force_password_reset: true,
        temp_password_created_at: new Date(),
      },
      { transaction }
    );

    // Synchronize cloned user into Employee directory
    try {
      await userEmployeeSyncService.syncUserToEmployee(newUser, { transaction });
    } catch (syncErr) {
      logger.warn(`Failed to sync cloned user to employee directory: ${syncErr.message}`);
    }

    // Clone custom overrides
    const sourceOverrides = await UserPermission.findAll({
      where: { user_id: sourceUserId },
      transaction,
    });

    for (const ov of sourceOverrides) {
      await UserPermission.create(
        {
          user_id: newUser.id,
          permission_id: ov.permission_id,
          is_allowed: ov.is_allowed,
        },
        { transaction }
      );
    }

    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: newUser.id,
      eventType: 'USER_CLONED',
      newValues: {
        cloned_from: sourceUser.id,
        cloned_role: sourceUser.role,
        overrides_count: sourceOverrides.length,
      },
      req,
      transaction,
    });

    await transaction.commit();

    const userJson = newUser.toSafeJSON();
    userJson.permissions = await getEffectivePermissions(newUser);

    res.status(201).json({
      status: 'success',
      message: `User successfully cloned from '${sourceUser.name}'.`,
      data: userJson,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Bulk User Import (Array of user rows from Excel/CSV)
 */
const bulkImportUsers = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { users } = req.body; // Array of user objects

    if (!Array.isArray(users) || users.length === 0) {
      await transaction.rollback();
      return next(new AppError('No user data provided for bulk import.', 400));
    }

    const createdUsers = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const email = u.email ? u.email.toLowerCase().trim() : '';
      const name = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim();
      const role = u.role || 'sales';
      const password = u.password || `Welcome@${Math.floor(1000 + Math.random() * 9000)}`;

      if (!email || !name) {
        errors.push({ row: i + 1, email, error: 'Name and Email are mandatory.' });
        continue;
      }

      const existing = await User.findOne({ where: { email }, transaction });
      if (existing) {
        errors.push({ row: i + 1, email, error: 'Email already exists.' });
        continue;
      }

      const newUser = await User.create(
        {
          name,
          first_name: u.first_name || null,
          last_name: u.last_name || null,
          email,
          password,
          phone: u.phone || null,
          department: u.department || null,
          designation: u.designation || null,
          employee_id: u.employee_id || null,
          role,
          status: 'active',
          is_active: true,
          force_password_reset: true,
          temp_password_created_at: new Date(),
        },
        { transaction }
      );

      createdUsers.push({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        tempPassword: password,
      });
    }

    if (createdUsers.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'No users were imported due to validation errors.',
        errors,
      });
    }

    // Synchronize all bulk created users into Employee directory
    for (const u of createdUsers) {
      try {
        const createdUser = await User.findByPk(u.id, { transaction });
        if (createdUser) {
          await userEmployeeSyncService.syncUserToEmployee(createdUser, { transaction });
        }
      } catch (syncErr) {
        logger.warn(`Bulk employee sync notice for user ${u.id}: ${syncErr.message}`);
      }
    }

    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: null,
      eventType: 'BULK_USERS_IMPORTED',
      newValues: { imported_count: createdUsers.length, error_count: errors.length },
      req,
      transaction,
    });

    await transaction.commit();

    res.status(201).json({
      status: 'success',
      message: `Successfully imported ${createdUsers.length} user(s).`,
      data: {
        importedUsers: createdUsers,
        errors,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Get user permissions matrix & overrides
 */
const getUserPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, { attributes: { exclude: ['password', 'refresh_token'] } });
    if (!user) {
      return next(new AppError('User not found.', 404));
    }

    const allPermissions = await Permission.findAll({ order: [['module', 'ASC'], ['name', 'ASC']] });
    const effectivePerms = await getEffectivePermissions(user);

    const userOverrides = await UserPermission.findAll({
      where: { user_id: id },
    });

    res.json({
      status: 'success',
      data: {
        user: user.toJSON(),
        effectivePermissions: effectivePerms,
        allPermissions,
        overrides: userOverrides,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Grant or Revoke specific permissions for a user
 */
const updateUserPermissions = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { overrides } = req.body; // array of { permission_id, is_allowed: boolean | null }

    const user = await User.findByPk(id, { transaction });
    if (!user) {
      await transaction.rollback();
      return next(new AppError('User not found.', 404));
    }

    if (!Array.isArray(overrides)) {
      await transaction.rollback();
      return next(new AppError('Overrides must be an array of permissions.', 400));
    }

    const creatorRole = req.user ? req.user.role : 'super_admin';
    const isSuperAdmin = creatorRole === 'admin' || creatorRole === 'super_admin';

    // Hierarchy Protection
    if (!isSuperAdmin && (user.role === 'admin' || user.role === 'super_admin')) {
      await transaction.rollback();
      return next(new AppError('Forbidden: Only Super Admin can modify Super Admin permissions.', 403));
    }

    if (!isSuperAdmin) {
      const creatorPermissions = req.user ? req.user.permissions || [] : [];
      for (const ov of overrides) {
        if (ov.is_allowed === true) {
          const perm = await Permission.findByPk(ov.permission_id, { transaction });
          if (perm && !creatorPermissions.includes('*') && !creatorPermissions.includes(perm.name)) {
            await transaction.rollback();
            return next(new AppError(`Forbidden: You cannot grant permission '${perm.name}' as you do not possess access to it.`, 403));
          }
        }
      }
    }

    for (const ov of overrides) {
      const { permission_id, is_allowed } = ov;
      if (is_allowed === null || is_allowed === undefined) {
        // Clear override (restore role default)
        await UserPermission.destroy({
          where: { user_id: id, permission_id },
          transaction,
        });
      } else {
        // Upsert override
        const existing = await UserPermission.findOne({
          where: { user_id: id, permission_id },
          transaction,
        });

        if (existing) {
          existing.is_allowed = Boolean(is_allowed);
          await existing.save({ transaction });
        } else {
          await UserPermission.create(
            {
              user_id: id,
              permission_id,
              is_allowed: Boolean(is_allowed),
            },
            { transaction }
          );
        }
      }
    }

    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: user.id,
      eventType: 'PERMISSIONS_MODIFIED',
      newValues: { overridesCount: overrides.length },
      req,
      transaction,
    });

    await transaction.commit();

    const effectivePerms = await getEffectivePermissions(user);

    res.json({
      status: 'success',
      message: 'User access rights updated successfully.',
      data: {
        user_id: id,
        effectivePermissions: effectivePerms,
      },
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Get all roles with default permissions
 */
const getRoles = async (req, res, next) => {
  try {
    let roles = [];
    try {
      roles = await Role.findAll({
        include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
        order: [['name', 'ASC']],
      });
    } catch (joinErr) {
      logger.warn(`Primary getRoles query encountered an issue (${joinErr.message}). Initiating self-healing reindex & fallback...`);
      try {
        await sequelize.query('REINDEX;');
      } catch (_) {}

      // Fallback: fetch roles directly without multi-table join
      roles = await Role.findAll({ order: [['name', 'ASC']] });
      const rolePermissions = await RolePermission.findAll().catch(() => []);
      const allPermissions = await Permission.findAll().catch(() => []);
      const permMap = new Map(allPermissions.map(p => [p.id, p]));

      roles = roles.map(r => {
        const plainRole = typeof r.toJSON === 'function' ? r.toJSON() : { ...r };
        const rolePermIds = rolePermissions.filter(rp => rp.role_id === r.id).map(rp => rp.permission_id);
        plainRole.permissions = rolePermIds.map(pid => permMap.get(pid)).filter(Boolean);
        return plainRole;
      });
    }

    // Safety: If roles table is somehow empty, ensure system baseline roles are loaded
    if (!roles || roles.length === 0) {
      try {
        const { seedComprehensiveCRMData } = require('../services/seedService');
        await seedComprehensiveCRMData();
        roles = await Role.findAll({
          include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
          order: [['name', 'ASC']],
        });
      } catch (seedErr) {
        logger.warn(`Fallback role seeding skipped: ${seedErr.message}`);
      }
    }

    res.json({
      status: 'success',
      data: roles || [],
    });
  } catch (err) {
    logger.error('Unhandled error in getRoles:', err);
    res.json({
      status: 'success',
      data: [],
    });
  }
};

/**
 * Update role default permissions
 */
const updateRolePermissions = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    const role = await Role.findByPk(id, { transaction });
    if (!role) {
      await transaction.rollback();
      return next(new AppError('Role not found.', 404));
    }

    if (!Array.isArray(permissionIds)) {
      await transaction.rollback();
      return next(new AppError('permissionIds must be an array.', 400));
    }

    await RolePermission.destroy({ where: { role_id: id }, transaction });

    for (const pid of permissionIds) {
      await RolePermission.create(
        {
          role_id: id,
          permission_id: pid,
        },
        { transaction }
      );
    }

    await logUserAudit({
      actorUserId: req.user ? req.user.id : null,
      targetUserId: null,
      eventType: 'ROLE_PERMISSIONS_UPDATED',
      newValues: { role_id: id, role_name: role.name, permissionsCount: permissionIds.length },
      req,
      transaction,
    });

    await transaction.commit();

    const updatedRole = await Role.findByPk(id, {
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    });

    res.json({
      status: 'success',
      message: 'Role permissions updated successfully.',
      data: updatedRole,
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Get all system permissions grouped by module
 */
const getPermissions = async (req, res, next) => {
  try {
    const permissions = await Permission.findAll({
      order: [['module', 'ASC'], ['name', 'ASC']],
    });

    res.json({
      status: 'success',
      data: permissions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Login History logs with pagination and filters
 */
const getLoginHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, email, status } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = {};
    if (email && email.trim()) {
      where.email = { [Op.like]: `%${email.trim()}%` };
    }
    if (status && status !== 'all') {
      where.status = status;
    }

    const { count, rows } = await LoginHistory.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['login_at', 'DESC']],
    });

    res.json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        logs: rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get User Audit Logs
 */
const getUserAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, event_type, target_user_id } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = {};
    if (event_type && event_type !== 'all') {
      where.event_type = event_type;
    }
    if (target_user_id) {
      where.target_user_id = target_user_id;
    }

    const { count, rows } = await UserAuditLog.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['created_at', 'DESC']],
    });

    res.json({
      status: 'success',
      data: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        logs: rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Access Templates CRUD
 */
const getAccessTemplates = async (req, res, next) => {
  try {
    const templates = await AccessTemplate.findAll({
      order: [['name', 'ASC']],
    });

    // Provide default system templates if none exist
    if (templates.length === 0) {
      const defaultTemplates = [
        {
          name: 'Telecaller Standard Template',
          description: 'Optimized access for telecalling leads, CSV uploads, and call logs.',
          permissions: ['telecaller:view', 'csv:import', 'customers:view', 'followups:view', 'followups:create', 'followups:edit'],
        },
        {
          name: 'Sales Executive Template',
          description: 'Order management, customer engagement, warranty lookups, and shipping dispatch.',
          permissions: ['orders:view', 'orders:create', 'orders:edit', 'customers:view', 'customers:create', 'warranty:view', 'shipping:view', 'shipping:edit'],
        },
        {
          name: 'Field Technician Template',
          description: 'Warranty service requests, installation tickets, and customer visits.',
          permissions: ['warranty:view', 'warranty:edit', 'tasks:view', 'tasks:edit'],
        },
        {
          name: 'HR Executive Template',
          description: 'Employee directory, onboarding verification, and HR document management.',
          permissions: ['employees:view', 'employees:create', 'employees:edit', 'onboarding:view', 'onboarding:manage', 'document_center:view'],
        },
      ];

      for (const dt of defaultTemplates) {
        await AccessTemplate.create(dt);
      }

      const refreshed = await AccessTemplate.findAll({ order: [['name', 'ASC']] });
      return res.json({ status: 'success', data: refreshed });
    }

    res.json({
      status: 'success',
      data: templates,
    });
  } catch (err) {
    next(err);
  }
};

const createAccessTemplate = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name || !name.trim()) {
      return next(new AppError('Template name is required.', 400));
    }

    const template = await AccessTemplate.create({
      name: name.trim(),
      description: description || null,
      permissions: Array.isArray(permissions) ? permissions : [],
      created_by: req.user ? req.user.id : null,
    });

    res.status(201).json({
      status: 'success',
      message: 'Access template created successfully.',
      data: template,
    });
  } catch (err) {
    next(err);
  }
};

const deleteAccessTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await AccessTemplate.findByPk(id);
    if (!template) return next(new AppError('Template not found.', 404));

    await template.destroy();
    res.json({
      status: 'success',
      message: 'Access template deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  toggleLockUser,
  cloneUser,
  bulkImportUsers,
  getUserPermissions,
  updateUserPermissions,
  getRoles,
  updateRolePermissions,
  getPermissions,
  getLoginHistory,
  getUserAuditLogs,
  getAccessTemplates,
  createAccessTemplate,
  deleteAccessTemplate,
};
