'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WarrantyMessage = sequelize.define('WarrantyMessage', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  warranty_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  template_key: {
    type: DataTypes.STRING(100),
    defaultValue: 'warranty_claim',
  },
  channel: {
    type: DataTypes.STRING(50),
    defaultValue: 'WHATSAPP',
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  provider_message_id: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  delivery_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'QUEUED', // QUEUED, SENT, DELIVERED, READ, FAILED
  },
  failure_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  attempt_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  idempotency_key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  activation_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  activation_url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'warranty_messages',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['idempotency_key'], unique: true },
    { fields: ['warranty_id'] },
    { fields: ['customer_id'] },
    { fields: ['phone_number'] },
    { fields: ['delivery_status'] },
    { fields: ['provider_message_id'] },
  ],
});

module.exports = WarrantyMessage;
