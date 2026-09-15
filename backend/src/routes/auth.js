'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const { loginRules, createUserRules, changePasswordRules, validate } = require('../validators');

router.get('/demo-accounts',   ctrl.getDemoAccounts);
router.post('/login',           loginRules, validate, ctrl.login);
router.post('/refresh',         ctrl.refresh);
router.post('/logout',          protect, ctrl.logout);
router.get('/me',               protect, ctrl.getMe);
router.patch('/me',             protect, ctrl.updateMe);
router.patch('/change-password', protect, changePasswordRules, validate, ctrl.changePassword);

// Admin user management
router.post('/users',      protect, authorize('admin'), createUserRules, validate, ctrl.createUser);
router.get('/users',       protect, authorize('admin', 'manager', 'ceo', 'sales', 'support'), ctrl.getUsers);
router.patch('/users/:id', protect, authorize('admin'), ctrl.updateUser);
router.delete('/users/:id', protect, authorize('admin', 'super_admin'), ctrl.deleteUser);

module.exports = router;
