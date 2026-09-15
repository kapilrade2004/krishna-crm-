'use strict';

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
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
} = require('../controllers/userAccess.controller');

// All routes require authentication
router.use(protect);

// ── Users Core CRUD ──────────────────────────────────────────────────────────
router.get('/users', authorize('admin', 'super_admin', 'manager', 'hr', 'ceo'), getUsers);
router.get('/users/:id', authorize('admin', 'super_admin', 'manager', 'hr', 'ceo'), getUserById);
router.post('/users', authorize('admin', 'super_admin', 'manager', 'hr'), createUser);
router.patch('/users/:id', authorize('admin', 'super_admin', 'manager', 'hr'), updateUser);
router.delete('/users/:id', authorize('admin', 'super_admin', 'manager', 'hr'), deleteUser);

// ── Security, Password & Locking Actions ─────────────────────────────────────
router.post('/users/:id/reset-password', authorize('admin', 'super_admin', 'manager'), resetPassword);
router.post('/users/:id/lock', authorize('admin', 'super_admin', 'manager'), toggleLockUser);
router.post('/users/clone', authorize('admin', 'super_admin', 'manager', 'hr'), cloneUser);
router.post('/users/bulk-import', authorize('admin', 'super_admin', 'manager', 'hr'), bulkImportUsers);

// ── User Permissions Grant / Revoke ──────────────────────────────────────────
router.get('/users/:id/permissions', authorize('admin', 'super_admin', 'manager', 'hr'), getUserPermissions);
router.put('/users/:id/permissions', authorize('admin', 'super_admin', 'manager'), updateUserPermissions);
router.post('/users/:id/permissions', authorize('admin', 'super_admin', 'manager'), updateUserPermissions);

// ── Roles & Permissions Management ───────────────────────────────────────────
router.get('/roles', authorize('admin', 'super_admin', 'manager', 'hr'), getRoles);
router.put('/roles/:id/permissions', authorize('admin', 'super_admin'), updateRolePermissions);
router.get('/permissions', authorize('admin', 'super_admin', 'manager', 'hr'), getPermissions);

// ── Observability: Login History & User Audit Logs ────────────────────────────
router.get('/login-history', authorize('admin', 'super_admin', 'manager', 'hr'), getLoginHistory);
router.get('/audit-logs', authorize('admin', 'super_admin', 'manager', 'hr'), getUserAuditLogs);

// ── Access Templates ──────────────────────────────────────────────────────────
router.get('/templates', authorize('admin', 'super_admin', 'manager', 'hr'), getAccessTemplates);
router.post('/templates', authorize('admin', 'super_admin', 'manager'), createAccessTemplate);
router.delete('/templates/:id', authorize('admin', 'super_admin'), deleteAccessTemplate);

module.exports = router;
