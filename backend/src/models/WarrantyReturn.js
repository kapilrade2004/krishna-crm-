'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WarrantyReturn = sequelize.define('WarrantyReturn', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  return_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  warranty_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  order_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  requested_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
  request_source: {
    type: DataTypes.STRING(50),
    defaultValue: 'CUSTOMER_WEB',
  },
  reason_code: {
    type: DataTypes.STRING(50),
    allowNull: true, // e.g. DEFECTIVE, WRONG_ITEM, NOT_NEEDED, DAMAGED_IN_TRANSIT, PERFORMANCE_ISSUE
  },
  reason_text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  photos_json: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  documents_json: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'REQUESTED',
  },
  approved_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  approved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  pickup_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  pickup_partner: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  pickup_tracking_number: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  pickup_scheduled_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  picked_up_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  received_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  inspected_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  inspection_result: {
    type: DataTypes.STRING(50),
    defaultValue: 'PENDING',
  },
  inspection_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  refund_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  replacement_order_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  replacement_warranty_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'warranty_returns',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['return_number'] },
    { fields: ['warranty_id'] },
    { fields: ['order_id'] },
    { fields: ['customer_id'] },
    { fields: ['status'] },
    { fields: ['approved_by'] },
    { fields: ['requested_at'] },
  ],
});

module.exports = WarrantyReturn;
