'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class WhatsAppOutbox extends Model {}

WhatsAppOutbox.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    order_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    customer_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    batch_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: 'Reference to whatsapp_batches.id',
    },
    recipient_phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    template_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    idempotency_key: {
      type: DataTypes.STRING(150),
      allowNull: true,
      unique: true,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'QUEUED',
      allowNull: false,
      comment: 'QUEUED, PROCESSING, PROVIDER_ACCEPTED, SENT, DELIVERED, READ, FAILED, PAUSED',
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Provider responsible for sending (aoc, meta)',
    },
    provider_message_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Vendor/Meta/AOC returned message identifier',
    },
    attempt_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    max_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      allowNull: false,
    },
    queued_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: true,
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failure_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Classified failure code (e.g. RATE_LIMIT_EXCEEDED, INVALID_PHONE, etc.)',
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error_category: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    last_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    locked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    worker_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    next_attempt_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'WhatsAppOutbox',
    tableName: 'whatsapp_outbox',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['status', 'next_attempt_at'] },
      { fields: ['idempotency_key'], unique: true },
      { fields: ['order_id', 'template_name'] },
      { fields: ['recipient_phone'] },
      { fields: ['batch_id'] },
      { fields: ['provider_message_id'] },
    ],
  }
);

module.exports = WhatsAppOutbox;
