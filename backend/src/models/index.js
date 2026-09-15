'use strict';

const { sequelize } = require('../config/database');
const logger = require('../config/logger');
const User = require('./User');
const Customer = require('./Customer');
const Order = require('./Order');
const { OrderActivity, FollowUp, Task, CsvImportBatch, WhatsAppLog, ManualCallLog, CustomerImage } = require('./Operations');
const { ShippingPartner, PincodeServiceability } = require('./Shipping');
const { Employee, EmployeeDocument } = require('./Employee');
const Role = require('./Role');
const Permission = require('./Permission');
const { RolePermission, UserPermission } = require('./UserPermission');
const { DailyTask, DailyTaskHistory } = require('./DailyTask');
const { DailyActivity, DailyActivityHistory } = require('./DailyActivity');
const { EmployeeAuditEvent, EmployeeAuditDailySummary } = require('./EmployeeAuditEvent');
const { Warranty, WarrantyDocument, WarrantyServiceRequest, WarrantyEvent } = require('./Warranty');
const WarrantyReturn = require('./WarrantyReturn');
const WarrantyMessage = require('./WarrantyMessage');
const LoginHistory = require('./LoginHistory');
const UserAuditLog = require('./UserAuditLog');
const WhatsAppOutbox = require('./WhatsAppOutbox');
const WhatsAppBatch = require('./WhatsAppBatch');
const WhatsAppRateLimitEvent = require('./WhatsAppRateLimitEvent');
const { AccessTemplate, AccessRequest } = require('./AccessTemplate');
const { PayrollProfile, PayrollRecord } = require('./Payroll');
const {
  BiometricDevice,
  EmployeeBiometricMapping,
  BiometricPunchEvent,
  AttendanceShift,
  AttendanceDay,
  AttendanceSegment,
  AttendanceCorrection,
  IntegrationSyncState,
  AttendanceAuditLog,
  AttendanceEvent,
  AttendanceSyncRun,
} = require('./Biometric');
const ProductReview = require('./ProductReview');
const AccountingRecord = require('./AccountingRecord');
const ChequeCollection = require('./ChequeCollection');
const AdCampaignMetric = require('./AdCampaignMetric');
const KeywordMetric = require('./KeywordMetric');
const ReturnClaim = require('./ReturnClaim');
const SystemSetting = require('./SystemSetting');
const ResetAuditLog = require('./ResetAuditLog');
const OrderEvent = require('./OrderEvent');

// ─── User Management Associations ─────────────────────────────────────────────
User.hasMany(LoginHistory, { foreignKey: 'user_id', as: 'loginHistories' });
LoginHistory.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(UserAuditLog, { foreignKey: 'target_user_id', as: 'auditLogs' });
UserAuditLog.belongsTo(User, { foreignKey: 'target_user_id', as: 'targetUser' });
UserAuditLog.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor' });

User.hasMany(AccessRequest, { foreignKey: 'user_id', as: 'accessRequests' });
AccessRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AccessRequest.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

// ─── Warranty Module Associations ─────────────────────────────────────────────
Customer.hasMany(Warranty, { foreignKey: 'customer_id', as: 'warranties' });
Warranty.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

Order.hasOne(Warranty, { foreignKey: 'order_id', as: 'warranty' });
Warranty.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

Order.hasMany(WhatsAppOutbox, { foreignKey: 'order_id', as: 'outboxMessages', constraints: false });
WhatsAppOutbox.belongsTo(Order, { foreignKey: 'order_id', as: 'order', constraints: false });

Customer.hasMany(WhatsAppOutbox, { foreignKey: 'customer_id', as: 'outboxMessages', constraints: false });
WhatsAppOutbox.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer', constraints: false });

Warranty.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier' });
User.hasMany(Warranty, { foreignKey: 'verified_by', as: 'verifiedWarranties' });

Warranty.belongsTo(User, { foreignKey: 'warranty_reset_by', as: 'resetByUser' });
User.hasMany(Warranty, { foreignKey: 'warranty_reset_by', as: 'resetWarranties' });

Warranty.hasMany(WarrantyDocument, { foreignKey: 'warranty_id', as: 'documents' });
WarrantyDocument.belongsTo(Warranty, { foreignKey: 'warranty_id', as: 'warranty' });

Warranty.hasMany(WarrantyServiceRequest, { foreignKey: 'warranty_id', as: 'serviceRequests' });
WarrantyServiceRequest.belongsTo(Warranty, { foreignKey: 'warranty_id', as: 'warranty' });

Customer.hasMany(WarrantyServiceRequest, { foreignKey: 'customer_id', as: 'serviceRequests' });
WarrantyServiceRequest.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

WarrantyServiceRequest.belongsTo(User, { foreignKey: 'technician_id', as: 'technician' });
User.hasMany(WarrantyServiceRequest, { foreignKey: 'technician_id', as: 'assignedServiceRequests' });

WarrantyServiceRequest.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(WarrantyServiceRequest, { foreignKey: 'created_by', as: 'createdServiceRequests' });

Warranty.hasMany(WarrantyEvent, { foreignKey: 'warranty_id', as: 'events' });
WarrantyEvent.belongsTo(Warranty, { foreignKey: 'warranty_id', as: 'warranty' });
WarrantyEvent.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor' });

// ─── Reverse Logistics / Return Associations ──────────────────────────────────
Warranty.hasMany(WarrantyReturn, { foreignKey: 'warranty_id', as: 'returns', constraints: false });
WarrantyReturn.belongsTo(Warranty, { foreignKey: 'warranty_id', as: 'warranty', constraints: false });

Customer.hasMany(WarrantyReturn, { foreignKey: 'customer_id', as: 'warrantyReturns', constraints: false });
WarrantyReturn.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer', constraints: false });

Order.hasMany(WarrantyReturn, { foreignKey: 'order_id', as: 'warrantyReturns', constraints: false });
WarrantyReturn.belongsTo(Order, { foreignKey: 'order_id', as: 'order', constraints: false });

WarrantyReturn.belongsTo(User, { foreignKey: 'approved_by', as: 'approver', constraints: false });
User.hasMany(WarrantyReturn, { foreignKey: 'approved_by', as: 'approvedWarrantyReturns', constraints: false });

// ─── Warranty Messaging Associations ──────────────────────────────────────────
Warranty.hasMany(WarrantyMessage, { foreignKey: 'warranty_id', as: 'messages', constraints: false });
WarrantyMessage.belongsTo(Warranty, { foreignKey: 'warranty_id', as: 'warranty', constraints: false });

Customer.hasMany(WarrantyMessage, { foreignKey: 'customer_id', as: 'warrantyMessages', constraints: false });
WarrantyMessage.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer', constraints: false });

// ─── Associations ─────────────────────────────────────────────────────────────

// User ↔ Customer (assigned)
User.hasMany(Customer, { foreignKey: 'assigned_to', as: 'assignedCustomers' });
Customer.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });

// Order ↔ OrderEvent
Order.hasMany(OrderEvent, { foreignKey: 'order_id', as: 'events' });
OrderEvent.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
Customer.hasMany(OrderEvent, { foreignKey: 'customer_id', as: 'orderEvents' });
OrderEvent.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

// Customer ↔ Orders
Customer.hasMany(Order, { foreignKey: 'customer_id', as: 'orders' });
Order.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });

// User ↔ Orders (assigned & verified)
User.hasMany(Order, { foreignKey: 'assigned_to', as: 'assignedOrders' });
Order.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });
User.hasMany(Order, { foreignKey: 'verified_by', as: 'verifiedOrders' });
Order.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier' });

// Order ↔ OrderActivity
Order.hasMany(OrderActivity, { foreignKey: 'order_id', as: 'activities' });
OrderActivity.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
User.hasMany(OrderActivity, { foreignKey: 'user_id', as: 'activities' });
OrderActivity.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Customer ↔ FollowUps
Customer.hasMany(FollowUp, { foreignKey: 'customer_id', as: 'followUps' });
FollowUp.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Order.hasMany(FollowUp, { foreignKey: 'order_id', as: 'followUps' });
FollowUp.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
User.hasMany(FollowUp, { foreignKey: 'assigned_to', as: 'followUps' });
FollowUp.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });

// Tasks
User.hasMany(Task, { foreignKey: 'assigned_to', as: 'tasks' });
Task.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser' });
User.hasMany(Task, { foreignKey: 'created_by', as: 'createdTasks' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
// SOW §3.7 — Task Score Management
User.hasMany(Task, { foreignKey: 'scored_by', as: 'scoredTasks' });
Task.belongsTo(User, { foreignKey: 'scored_by', as: 'scorer' });
Customer.hasMany(Task, { foreignKey: 'customer_id', as: 'tasks' });
Task.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Order.hasMany(Task, { foreignKey: 'order_id', as: 'tasks' });
Task.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Daily Tasks (Legacy)
User.hasMany(DailyTask, { foreignKey: 'assigned_to', as: 'dailyTasksAssignedTo' });
DailyTask.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
User.hasMany(DailyTask, { foreignKey: 'assigned_by', as: 'dailyTasksAssignedBy' });
DailyTask.belongsTo(User, { foreignKey: 'assigned_by', as: 'assigner' });
DailyTask.hasMany(DailyTaskHistory, { foreignKey: 'daily_task_id', as: 'history' });
DailyTaskHistory.belongsTo(DailyTask, { foreignKey: 'daily_task_id', as: 'dailyTask' });
DailyTaskHistory.belongsTo(User, { foreignKey: 'changed_by', as: 'changer' });

// Daily Activities
User.hasMany(DailyActivity, { foreignKey: 'assigned_to', as: 'dailyActivitiesAssignedTo' });
DailyActivity.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
User.hasMany(DailyActivity, { foreignKey: 'assigned_by', as: 'dailyActivitiesAssignedBy' });
DailyActivity.belongsTo(User, { foreignKey: 'assigned_by', as: 'assigner' });
DailyActivity.hasMany(DailyActivityHistory, { foreignKey: 'activity_id', as: 'history' });
DailyActivityHistory.belongsTo(DailyActivity, { foreignKey: 'activity_id', as: 'activity' });
DailyActivityHistory.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });

// CSV Import Batches
User.hasMany(CsvImportBatch, { foreignKey: 'uploaded_by', as: 'csvBatches' });
CsvImportBatch.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });
Order.belongsTo(CsvImportBatch, { foreignKey: 'import_batch_id', as: 'importBatch', constraints: false });

// WhatsApp Logs
Customer.hasMany(WhatsAppLog, { foreignKey: 'customer_id', as: 'whatsappLogs', constraints: false });
WhatsAppLog.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer', constraints: false });
Order.hasMany(WhatsAppLog, { foreignKey: 'order_id', as: 'whatsappLogs', constraints: false });
WhatsAppLog.belongsTo(Order, { foreignKey: 'order_id', as: 'order', constraints: false });

// WhatsApp Batches & Outbox
CsvImportBatch.hasMany(WhatsAppBatch, { foreignKey: 'import_batch_id', as: 'whatsappBatches', constraints: false });
WhatsAppBatch.belongsTo(CsvImportBatch, { foreignKey: 'import_batch_id', as: 'importBatch', constraints: false });
WhatsAppBatch.hasMany(WhatsAppOutbox, { foreignKey: 'batch_id', as: 'outboxItems', constraints: false });
WhatsAppOutbox.belongsTo(WhatsAppBatch, { foreignKey: 'batch_id', as: 'batch', constraints: false });
User.hasMany(WhatsAppBatch, { foreignKey: 'confirmed_by', as: 'confirmedBatches', constraints: false });
WhatsAppBatch.belongsTo(User, { foreignKey: 'confirmed_by', as: 'confirmer', constraints: false });
WhatsAppBatch.hasMany(WhatsAppLog, { foreignKey: 'batch_id', as: 'whatsappLogs', constraints: false });
WhatsAppLog.belongsTo(WhatsAppBatch, { foreignKey: 'batch_id', as: 'batch', constraints: false });

// Shipping — Order ↔ ShippingPartner (by code reference, soft link via shipping_partner string)
// PincodeServiceability ↔ ShippingPartner
ShippingPartner.hasMany(PincodeServiceability, { foreignKey: 'shipping_partner_id', as: 'serviceability' });
PincodeServiceability.belongsTo(ShippingPartner, { foreignKey: 'shipping_partner_id', as: 'shippingPartner' });

// CR2 — Manual Call Logs
Order.hasMany(ManualCallLog, { foreignKey: 'order_id', as: 'callLogs' });
ManualCallLog.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
Customer.hasMany(ManualCallLog, { foreignKey: 'customer_id', as: 'callLogs' });
ManualCallLog.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
User.hasMany(ManualCallLog, { foreignKey: 'user_id', as: 'callLogs' });
ManualCallLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// CR3 — Customer Images
Order.hasMany(CustomerImage, { foreignKey: 'order_id', as: 'customerImages' });
CustomerImage.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
Customer.hasMany(CustomerImage, { foreignKey: 'customer_id', as: 'customerImages' });
CustomerImage.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
User.hasMany(CustomerImage, { foreignKey: 'reviewed_by', as: 'reviewedImages' });
CustomerImage.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

/**
 * Sync all models with DB.
 * Always use migrations (006_hr_role.sql etc.) to alter schema.
 * sync({ alter: true }) causes "Data truncated" errors when ENUM values
 * in the DB don't match the model — never use it in any environment.
 */

// ── SOW §3.6 — Standalone Employee Module ────────────────────────────────────
// Note: Employee <-> EmployeeDocument associations are defined inside Employee.js
// Here we only add User FK associations (uploader / verifier / linkedUser / reportingManager)
EmployeeDocument.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader',  constraints: false });
EmployeeDocument.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier',  constraints: false });
User.hasMany(EmployeeDocument,   { foreignKey: 'uploaded_by', as: 'uploadedEmployeeDocs' });
User.hasMany(EmployeeDocument,   { foreignKey: 'verified_by', as: 'verifiedEmployeeDocs' });

Employee.belongsTo(User, { foreignKey: 'user_id', as: 'linkedUser', constraints: false });
Employee.belongsTo(User, { foreignKey: 'reporting_manager_id', as: 'reportingManager', constraints: false });
User.hasOne(Employee,   { foreignKey: 'user_id', as: 'employeeProfile' });
User.hasMany(Employee,  { foreignKey: 'reporting_manager_id', as: 'managedEmployees' });

// Payroll Associations
Employee.hasOne(PayrollProfile, { foreignKey: 'employee_id', as: 'payrollProfile' });
PayrollProfile.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Employee.hasMany(PayrollRecord, { foreignKey: 'employee_id', as: 'payrollRecords' });
PayrollRecord.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

PayrollRecord.belongsTo(User, { foreignKey: 'processed_by', as: 'processor' });
User.hasMany(PayrollRecord, { foreignKey: 'processed_by', as: 'processedPayrollRecords' });

// ─── Biometric & Attendance Associations ──────────────────────────────────────
Employee.hasOne(EmployeeBiometricMapping, { foreignKey: 'employee_id', as: 'biometricMapping', constraints: false });
EmployeeBiometricMapping.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee', constraints: false });

BiometricDevice.hasMany(EmployeeBiometricMapping, { foreignKey: 'device_id', as: 'employeeMappings', constraints: false });
EmployeeBiometricMapping.belongsTo(BiometricDevice, { foreignKey: 'device_id', as: 'device', constraints: false });

Employee.hasMany(BiometricPunchEvent, { foreignKey: 'employee_id', as: 'punchEvents', constraints: false });
BiometricPunchEvent.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee', constraints: false });

Employee.hasMany(AttendanceEvent, { foreignKey: 'employee_id', as: 'attendanceEvents', constraints: false });
AttendanceEvent.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee', constraints: false });

BiometricDevice.hasMany(BiometricPunchEvent, { foreignKey: 'device_id', as: 'punchEvents', constraints: false });
BiometricPunchEvent.belongsTo(BiometricDevice, { foreignKey: 'device_id', as: 'device', constraints: false });

Employee.hasMany(AttendanceDay, { foreignKey: 'employee_id', as: 'attendanceDays', constraints: false });
AttendanceDay.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee', constraints: false });

AttendanceShift.hasMany(AttendanceDay, { foreignKey: 'shift_id', as: 'attendanceDays', constraints: false });
AttendanceDay.belongsTo(AttendanceShift, { foreignKey: 'shift_id', as: 'shift', constraints: false });

AttendanceDay.hasMany(AttendanceSegment, { foreignKey: 'attendance_day_id', as: 'segments', constraints: false });
AttendanceSegment.belongsTo(AttendanceDay, { foreignKey: 'attendance_day_id', as: 'attendanceDay', constraints: false });

AttendanceDay.hasMany(AttendanceCorrection, { foreignKey: 'attendance_day_id', as: 'corrections', constraints: false });
AttendanceCorrection.belongsTo(AttendanceDay, { foreignKey: 'attendance_day_id', as: 'attendanceDay', constraints: false });

Employee.hasMany(AttendanceCorrection, { foreignKey: 'employee_id', as: 'attendanceCorrections', constraints: false });
AttendanceCorrection.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee', constraints: false });

AttendanceCorrection.belongsTo(User, { foreignKey: 'requested_by', as: 'requester', constraints: false });
AttendanceCorrection.belongsTo(User, { foreignKey: 'approved_by', as: 'approver', constraints: false });

BiometricDevice.belongsTo(User, { foreignKey: 'created_by', as: 'creator', constraints: false });
AttendanceAuditLog.belongsTo(User, { foreignKey: 'actor_user_id', as: 'actor', constraints: false });

// ─── New Business Role Model Associations ──────────────────────────────────────
ProductReview.belongsTo(Order, { foreignKey: 'order_id', as: 'order', constraints: false });
Order.hasMany(ProductReview, { foreignKey: 'order_id', as: 'reviews', constraints: false });
ProductReview.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier', constraints: false });

AccountingRecord.belongsTo(User, { foreignKey: 'created_by', as: 'creator', constraints: false });

ChequeCollection.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedUser', constraints: false });
ChequeCollection.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier', constraints: false });
ChequeCollection.belongsTo(Order, { foreignKey: 'order_id', as: 'order', constraints: false });

ReturnClaim.belongsTo(User, { foreignKey: 'handled_by', as: 'handler', constraints: false });

const syncModels = async (options = {}) => {
  if (process.env.NODE_ENV === 'production') {
    logger.info('Production mode: skipping ORM auto-sync. Database schema is strictly governed by canonical migrations.');
    return;
  }

  // NEVER use alter:true or force:true — use migrations instead.
  // Only sync core models — Employee tables are managed via migrations (008+)
  // to avoid "Key column doesn't exist" errors when migrations haven't run yet.
  const coreModels = [
    require('./User'),
    require('./Customer'),
    require('./Order'),
    OrderEvent,
    require('./Shipping').ShippingPartner,
    require('./Shipping').PincodeServiceability,
    Role,
    Permission,
    RolePermission,
    UserPermission,
    DailyTask,
    DailyTaskHistory,
    DailyActivity,
    DailyActivityHistory,
    EmployeeAuditEvent,
    EmployeeAuditDailySummary,
    Warranty,
    WarrantyDocument,
    WarrantyServiceRequest,
    WarrantyEvent,
    WarrantyReturn,
    WarrantyMessage,
    LoginHistory,
    UserAuditLog,
    AccessTemplate,
    AccessRequest,
    PayrollProfile,
    PayrollRecord,
    BiometricDevice,
    EmployeeBiometricMapping,
    BiometricPunchEvent,
    AttendanceShift,
    AttendanceDay,
    AttendanceSegment,
    AttendanceCorrection,
    IntegrationSyncState,
    AttendanceAuditLog,
    ProductReview,
    AccountingRecord,
    ChequeCollection,
    AdCampaignMetric,
    KeywordMetric,
    ReturnClaim,
    SystemSetting,
    ResetAuditLog,
  ];

  for (const model of coreModels) {
    try {
      await model.sync({ force: false });
    } catch (err) {
      logger.warn(`sync skipped for ${model.name}: ${err.message}`);
    }
  }

  // Ensure default General Shift exists
  try {
    const existingDefaultShift = await AttendanceShift.findOne({ where: { is_default: true } });
    if (!existingDefaultShift) {
      await AttendanceShift.create({
        shift_name: 'General Day Shift (10 AM - 6 PM)',
        shift_code: 'GEN_10_06',
        start_time: '10:00:00',
        end_time: '18:00:00',
        grace_period_minutes: 10,
        late_after_minutes: 10,
        early_leave_before_minutes: 10,
        min_full_day_hours: 8.0,
        min_half_day_hours: 4.0,
        is_default: true,
        is_active: true,
      });
      logger.info('Initialized default general attendance shift (10:00 - 18:00).');
    }
  } catch (shiftErr) {
    logger.warn(`Default shift initialization notice: ${shiftErr.message}`);
  }

  // Ensure default IntegrationSyncState exists
  try {
    const existingSyncState = await IntegrationSyncState.findOne({ where: { integration_name: 'smartoffice_biometric' } });
    if (!existingSyncState) {
      await IntegrationSyncState.create({
        integration_name: 'smartoffice_biometric',
        last_successful_timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Default 24h back
        status: 'healthy',
        sync_count: 0,
      });
      logger.info('Initialized default SmartOffice biometric integration sync state.');
    }
  } catch (syncErr) {
    logger.warn(`Sync state initialization notice: ${syncErr.message}`);
  }

  // Sync Operations models (FollowUp, Task etc)
  const ops = require('./Operations');
  for (const model of Object.values(ops)) {
    if (model && typeof model.sync === 'function') {
      try {
        await model.sync({ force: false });
      } catch (err) {
        logger.warn(`sync skipped for ${model.name}: ${err.message}`);
      }
    }
  }

  // Employee tables — only sync if tables already exist (migration 008 was run)
  // If not run yet, skip gracefully
  try {
    const { Employee, EmployeeDocument } = require('./Employee');
    await Employee.sync({ force: false });
    await EmployeeDocument.sync({ force: false });
  } catch (err) {
    logger.warn(`Employee tables sync skipped — run migration 008: ${err.message}`);
  }

  // WhatsApp Batch table
  try {
    await WhatsAppBatch.sync({ force: false });
  } catch (err) {
    logger.warn(`WhatsAppBatch sync notice: ${err.message}`);
  }

  // Ensure all missing model columns are synced into database tables
  try {
    const syncMissingColumns = require('../scripts/sync_missing_columns');
    await syncMissingColumns();
  } catch (err) {
    logger.warn(`Missing columns sync notice: ${err.message}`);
  }

  // Ensure all Users are synchronized to the Employee directory
  try {
    const { syncAllUsersToEmployees } = require('../services/userEmployeeSyncService');
    await syncAllUsersToEmployees();
  } catch (syncErr) {
    logger.warn(`User-to-Employee directory sync notice: ${syncErr.message}`);
  }

  // Ensure all Enterprise Roles & Granular Permissions are synchronized
  try {
    const { syncAllRolesAndPermissions } = require('../scripts/sync_all_roles_and_permissions');
    await syncAllRolesAndPermissions();
  } catch (rbacErr) {
    logger.warn(`Enterprise RBAC sync notice: ${rbacErr.message}`);
  }
};

// RBAC Associations
Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', otherKey: 'permission_id', as: 'permissions' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id', otherKey: 'role_id', as: 'roles' });
User.hasMany(UserPermission, { foreignKey: 'user_id', as: 'userPermissions' });
UserPermission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserPermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });
Permission.hasMany(UserPermission, { foreignKey: 'permission_id', as: 'userPermissions' });

module.exports = {
  sequelize,
  User,
  Customer,
  Order,
  OrderActivity,
  FollowUp,
  Task,
  CsvImportBatch,
  WhatsAppLog,
  ManualCallLog,
  CustomerImage,
  ShippingPartner,
  PincodeServiceability,
  Employee,
  EmployeeDocument,
  Role,
  Permission,
  RolePermission,
  UserPermission,
  DailyTask,
  DailyTaskHistory,
  DailyActivity,
  DailyActivityHistory,
  EmployeeAuditEvent,
  EmployeeAuditDailySummary,
  Warranty,
  WarrantyDocument,
  WarrantyServiceRequest,
  WarrantyEvent,
  WarrantyReturn,
  WarrantyMessage,
  WhatsAppOutbox,
  WhatsAppBatch,
  WhatsAppRateLimitEvent,
  LoginHistory,
  UserAuditLog,
  AccessTemplate,
  AccessRequest,
  PayrollProfile,
  PayrollRecord,
  BiometricDevice,
  EmployeeBiometricMapping,
  BiometricPunchEvent,
  AttendanceShift,
  AttendanceDay,
  AttendanceSegment,
  AttendanceCorrection,
  IntegrationSyncState,
  AttendanceAuditLog,
  AttendanceEvent,
  AttendanceSyncRun,
  ProductReview,
  AccountingRecord,
  ChequeCollection,
  AdCampaignMetric,
  KeywordMetric,
  ReturnClaim,
  SystemSetting,
  ResetAuditLog,
  OrderEvent,
  syncModels,
};