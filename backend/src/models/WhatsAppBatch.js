'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class WhatsAppBatch extends Model {}

WhatsAppBatch.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    batch_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
      comment: 'Human-readable unique identifier, e.g. WB-20260830-001-01',
    },
    import_batch_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: 'Reference to csv_import_batches if created from an upload',
    },
    batch_index: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '1-based index in the upload batch series',
    },
    total_batches: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Total number of batches in this upload series',
    },
    customer_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of unique customers in this batch (Max 100)',
      validate: {
        max: 100,
      },
    },
    message_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of messages to be dispatched for this batch',
    },
    order_range_start: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'First order number in non-consecutive sequence',
    },
    order_range_end: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Last order number in non-consecutive sequence',
    },
    status: {
      type: DataTypes.ENUM(
        'CREATED',
        'READY',
        'AWAITING_CONFIRMATION',
        'QUEUED',
        'PROCESSING',
        'COMPLETED',
        'PARTIALLY_FAILED',
        'FAILED',
        'PAUSED',
        'CANCELLED'
      ),
      defaultValue: 'AWAITING_CONFIRMATION',
      allowNull: false,
    },
    estimated_cost: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    actual_cost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    reserved_cost: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00,
      allowNull: false,
      comment: 'Atomically reserved spend for active batch before provider confirmation',
    },
    estimated_duration_seconds: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    estimated_duration_text: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    sent_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    failed_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    cancelled_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    paused_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    confirmed_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: 'User ID who confirmed dispatch of this specific batch',
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    idempotency_key: {
      type: DataTypes.STRING(150),
      allowNull: true,
      unique: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: 'WhatsAppBatch',
    tableName: 'whatsapp_batches',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['import_batch_id'] },
      { fields: ['status'] },
      { fields: ['batch_id'], unique: true },
      { fields: ['idempotency_key'], unique: true },
      { fields: ['created_at'] },
    ],
  }
);

module.exports = WhatsAppBatch;
