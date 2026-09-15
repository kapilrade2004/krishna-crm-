'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

// ─── Order Activity Log ──────────────────────────────────────────────────────
class OrderActivity extends Model {}
OrderActivity.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    order_id: { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'orders', key: 'id' } },
    user_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'users', key: 'id' } },
    action: { type: DataTypes.STRING(100), allowNull: false }, // e.g. 'status_changed', 'note_added'
    from_value: { type: DataTypes.STRING(100), allowNull: true },
    to_value: { type: DataTypes.STRING(100), allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSON, defaultValue: {} },
  },
  {
    sequelize,
    modelName: 'OrderActivity',
    tableName: 'order_activities',
    paranoid: false,
    indexes: [{ fields: ['order_id'] }, { fields: ['user_id'] }],
  }
);

// ─── Follow-Up ───────────────────────────────────────────────────────────────
class FollowUp extends Model {}
FollowUp.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    customer_id: { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'customers', key: 'id' } },
    order_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'orders', key: 'id' } },
    assigned_to: { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'users', key: 'id' } },
    type: {
      type: DataTypes.ENUM('call', 'whatsapp', 'email', 'visit', 'other'),
      defaultValue: 'call',
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled', 'rescheduled'),
      defaultValue: 'pending',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium',
    },
    subject: { type: DataTypes.STRING(255), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    outcome: { type: DataTypes.TEXT, allowNull: true },
    due_at: { type: DataTypes.DATE, allowNull: false },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    next_followup_at: { type: DataTypes.DATE, allowNull: true },
    reminder_sent: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'FollowUp',
    tableName: 'follow_ups',
    indexes: [
      { fields: ['customer_id'] },
      { fields: ['order_id'] },
      { fields: ['assigned_to'] },
      { fields: ['status'] },
      { fields: ['due_at'] },
    ],
  }
);

// ─── Task ─────────────────────────────────────────────────────────────────────
class Task extends Model {}
Task.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    assigned_to: { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'users', key: 'id' } },
    created_by: { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'users', key: 'id' } },
    // Optional refs
    customer_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'customers', key: 'id' } },
    order_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'orders', key: 'id' } },
    status: {
      type: DataTypes.ENUM('todo', 'in_progress', 'review', 'done', 'cancelled'),
      defaultValue: 'todo',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      defaultValue: 'medium',
    },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    tags: { type: DataTypes.JSON, defaultValue: [] },
    notes: { type: DataTypes.TEXT, allowNull: true },
    progress_percent: { type: DataTypes.TINYINT, defaultValue: 0, validate: { min: 0, max: 100 } },
    // SOW §3.7 — Task Score Management: manager scores each task after completion
    score: {
      type: DataTypes.TINYINT,
      allowNull: true,
      validate: { min: 0, max: 10 },
      comment: 'Manager-assigned score (0-10) for task quality/performance',
    },
    score_comment: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Manager remarks explaining the score',
    },
    scored_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'Manager who assigned the score',
    },
    scored_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    indexes: [
      { fields: ['assigned_to'] },
      { fields: ['created_by'] },
      { fields: ['status'] },
      { fields: ['priority'] },
      { fields: ['due_date'] },
      { fields: ['customer_id'] },
      { fields: ['order_id'] },
      { fields: ['score'] },
      { fields: ['scored_by'] },
    ],
  }
);

// ─── CSV Import Batch ─────────────────────────────────────────────────────────
class CsvImportBatch extends Model {}
CsvImportBatch.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    uploaded_by: { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'users', key: 'id' } },
    marketplace: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'direct',
    },
    channel: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Channel identifier e.g. amazon_channel_1, amazon_channel_2, amazon_channel_3',
    },
    filename: { type: DataTypes.STRING(255), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    status: {
      type: DataTypes.ENUM('uploaded', 'processing', 'completed', 'failed', 'partial'),
      defaultValue: 'uploaded',
    },
    total_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
    processed_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
    success_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
    failed_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
    duplicate_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
    error_log: { type: DataTypes.JSON, defaultValue: [] },
    existing_customers_reused: { type: DataTypes.INTEGER, defaultValue: 0 },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    duration_ms: { type: DataTypes.INTEGER, defaultValue: 0 },
    processed_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'CsvImportBatch',
    tableName: 'csv_import_batches',
    indexes: [{ fields: ['uploaded_by'] }, { fields: ['marketplace'] }, { fields: ['status'] }],
  }
);

// ─── WhatsApp Message Log ─────────────────────────────────────────────────────
class WhatsAppLog extends Model {}
WhatsAppLog.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    customer_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'customers', key: 'id' } },
    order_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'orders', key: 'id' } },
    batch_id: { type: DataTypes.CHAR(36), allowNull: true, comment: 'Reference to whatsapp_batches.id' },
    phone_number: { type: DataTypes.STRING(20), allowNull: false },
    message_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'template',
    },
    template_name: { type: DataTypes.STRING(100), allowNull: true },
    direction: { type: DataTypes.ENUM('outbound', 'inbound'), defaultValue: 'outbound' },
    status: {
      type: DataTypes.ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'paused'),
      defaultValue: 'queued',
    },
    wa_message_id: { type: DataTypes.STRING(150), allowNull: true },
    payload: { type: DataTypes.JSON, allowNull: true },
    error_message: { type: DataTypes.TEXT, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    read_at: { type: DataTypes.DATE, allowNull: true },
    failed_at: { type: DataTypes.DATE, allowNull: true },
    retry_count: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
    estimated_cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00, allowNull: false },
    actual_cost: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    cost_currency: { type: DataTypes.STRING(10), defaultValue: 'INR', allowNull: false },
  },
  {
    sequelize,
    modelName: 'WhatsAppLog',
    tableName: 'whatsapp_logs',
    paranoid: false,
    indexes: [
      { fields: ['phone_number'] },
      { fields: ['order_id'] },
      { fields: ['customer_id'] },
      { fields: ['status'] },
      { fields: ['wa_message_id'] },
      { fields: ['status', 'sent_at'] },
      { fields: ['created_at'] },
      { fields: ['template_name', 'sent_at'] },
      { fields: ['batch_id'] },
    ],
  }
);

module.exports = { OrderActivity, FollowUp, Task, CsvImportBatch, WhatsAppLog };

// ─── CR2 — Manual Call Log ────────────────────────────────────────────────────
// Reps log calls when WhatsApp goes unanswered (steps 2.3 & 6 of order flow)
class ManualCallLog extends Model {}
ManualCallLog.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    order_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'orders', key: 'id' } },
    customer_id: { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'customers', key: 'id' } },
    user_id: { type: DataTypes.CHAR(36), allowNull: false, references: { model: 'users', key: 'id' } },
    call_type: { type: DataTypes.ENUM('outbound', 'inbound'), defaultValue: 'outbound' },
    phone_used: { type: DataTypes.STRING(20), allowNull: true },
    duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
    outcome: {
      type: DataTypes.ENUM(
        'answered', 'no_answer', 'busy',
        'callback_requested', 'confirmed', 'rejected', 'escalated'
      ),
      defaultValue: 'answered',
    },
    context: {
      type: DataTypes.STRING(100),
      defaultValue: 'general',
      comment: 'Context of the call e.g. image_collection, reorder_assistance, feedback_resolution, verification_pending, general',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    called_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'ManualCallLog',
    tableName: 'manual_call_logs',
    paranoid: false,
    indexes: [
      { fields: ['order_id'] },
      { fields: ['customer_id'] },
      { fields: ['user_id'] },
      { fields: ['outcome'] },
      { fields: ['called_at'] },
    ],
  }
);

// ─── CR3 — Customer Images (inbound via WhatsApp) ─────────────────────────────
// Product images sent by customers are stored here for the image verification flow
class CustomerImage extends Model {}
CustomerImage.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    order_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'orders', key: 'id' } },
    customer_id: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'customers', key: 'id' } },
    wa_message_id: { type: DataTypes.STRING(150), allowNull: true, comment: 'Meta inbound message ID' },
    media_id: { type: DataTypes.STRING(150), allowNull: true, comment: 'Meta/AOC media ID for download API' },
    s3_key: { type: DataTypes.STRING(500), allowNull: true, comment: 'AWS S3 object key' },
    file_url: { type: DataTypes.STRING(1000), allowNull: true, comment: 'Local/cloud stored URL after download' },
    mime_type: { type: DataTypes.STRING(100), allowNull: true },
    file_size: { type: DataTypes.INTEGER, allowNull: true, comment: 'File size in bytes' },
    image_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'tap_photo',
      comment: 'Image category: tap_photo, screenshot, invoice, purifier_photo, general',
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'received',
      comment: 'received, approved, rejected, unmatched, media_download_failed',
    },
    reviewed_by: { type: DataTypes.CHAR(36), allowNull: true, references: { model: 'users', key: 'id' } },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
    rejection_reason: { type: DataTypes.STRING(500), allowNull: true },
    uploaded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'CustomerImage',
    tableName: 'customer_images',
    paranoid: false,
    indexes: [
      { fields: ['order_id'] },
      { fields: ['customer_id'] },
      { fields: ['status'] },
      { fields: ['wa_message_id'] },
      { fields: ['s3_key'] },
    ],
  }
);

module.exports = {
  OrderActivity, FollowUp, Task, CsvImportBatch, WhatsAppLog,
  ManualCallLog, CustomerImage,
};
