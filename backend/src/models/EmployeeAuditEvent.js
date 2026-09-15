'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class EmployeeAuditEvent extends Model {}

EmployeeAuditEvent.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    actor_user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    entity_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
    old_values: {
      type: DataTypes.JSON,
      defaultValue: null,
    },
    new_values: {
      type: DataTypes.JSON,
      defaultValue: null,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'EmployeeAuditEvent',
    tableName: 'employee_audit_events',
    updatedAt: false,
    indexes: [
      { fields: ['employee_id'] },
      { fields: ['user_id'] },
      { fields: ['event_type'] },
      { fields: ['module'] },
      { fields: ['created_at'] },
    ],
  }
);

class EmployeeAuditDailySummary extends Model {}

EmployeeAuditDailySummary.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    present: { type: DataTypes.BOOLEAN, defaultValue: false },
    late: { type: DataTypes.BOOLEAN, defaultValue: false },
    leave: { type: DataTypes.BOOLEAN, defaultValue: false },
    half_day: { type: DataTypes.BOOLEAN, defaultValue: false },
    work_hours: { type: DataTypes.DECIMAL(4, 2), defaultValue: 0.00 },

    // Offline / Sales metrics
    customer_interactions: { type: DataTypes.INTEGER, defaultValue: 0 },
    new_customers: { type: DataTypes.INTEGER, defaultValue: 0 },
    followups_created: { type: DataTypes.INTEGER, defaultValue: 0 },
    followups_completed: { type: DataTypes.INTEGER, defaultValue: 0 },
    calls_logged: { type: DataTypes.INTEGER, defaultValue: 0 },
    orders_created: { type: DataTypes.INTEGER, defaultValue: 0 },
    orders_completed: { type: DataTypes.INTEGER, defaultValue: 0 },
    units_sold: { type: DataTypes.INTEGER, defaultValue: 0 },
    revenue: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },

    tasks_assigned: { type: DataTypes.INTEGER, defaultValue: 0 },
    tasks_completed: { type: DataTypes.INTEGER, defaultValue: 0 },
    daily_tasks_assigned: { type: DataTypes.INTEGER, defaultValue: 0 },
    daily_tasks_completed: { type: DataTypes.INTEGER, defaultValue: 0 },

    // Technician metrics
    jobs_assigned: { type: DataTypes.INTEGER, defaultValue: 0 },
    jobs_accepted: { type: DataTypes.INTEGER, defaultValue: 0 },
    jobs_completed: { type: DataTypes.INTEGER, defaultValue: 0 },
    pending_jobs: { type: DataTypes.INTEGER, defaultValue: 0 },
    installations: { type: DataTypes.INTEGER, defaultValue: 0 },
    repairs: { type: DataTypes.INTEGER, defaultValue: 0 },
    maintenance_visits: { type: DataTypes.INTEGER, defaultValue: 0 },
    customer_visits: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_completion_time_minutes: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'EmployeeAuditDailySummary',
    tableName: 'employee_audit_daily_summaries',
    indexes: [
      { unique: true, fields: ['employee_id', 'date'] },
      { fields: ['employee_id'] },
      { fields: ['date'] },
    ],
  }
);

module.exports = {
  EmployeeAuditEvent,
  EmployeeAuditDailySummary,
};
