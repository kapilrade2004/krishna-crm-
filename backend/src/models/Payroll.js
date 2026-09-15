'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

// ── Payroll Profile (Compensation Structure) ──────────────────────────────────
class PayrollProfile extends Model {}

PayrollProfile.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      unique: true,
    },
    salary_type: {
      type: DataTypes.STRING(30),
      defaultValue: 'monthly', // monthly, hourly
    },
    basic_salary: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    fixed_allowances: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    fixed_deductions: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    net_payable_reference: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    payment_method: {
      type: DataTypes.STRING(50),
      defaultValue: 'bank_transfer', // bank_transfer, cheque, cash, upi
    },
    bank_account_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    bank_ifsc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    pan_number: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(30),
      defaultValue: 'active', // active, inactive, on_hold
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PayrollProfile',
    tableName: 'payroll_profiles',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['employee_id'], unique: true },
      { fields: ['status'] },
    ],
  }
);

// ── Payroll Record (Monthly Compensation Slips) ──────────────────────────────
class PayrollRecord extends Model {}

PayrollRecord.init(
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
    payroll_month: {
      type: DataTypes.STRING(7), // YYYY-MM
      allowNull: false,
    },
    gross_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    allowances: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    deductions: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    net_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    payment_status: {
      type: DataTypes.STRING(30),
      defaultValue: 'draft', // draft, approved, processed, cancelled
    },
    processed_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    payment_method: {
      type: DataTypes.STRING(50),
      defaultValue: 'bank_transfer',
    },
    transaction_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PayrollRecord',
    tableName: 'payroll_records',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['employee_id', 'payroll_month'] },
      { fields: ['payroll_month'] },
      { fields: ['payment_status'] },
    ],
  }
);

module.exports = {
  PayrollProfile,
  PayrollRecord,
};
