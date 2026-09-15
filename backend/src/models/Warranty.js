'use strict';

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Warranty = sequelize.define('Warranty', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  warranty_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  customer_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
  },
  order_id: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  order_item_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  product_id: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  product_name_snapshot: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  brand_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  model_snapshot: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  serial_number: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  unit_identifier: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  marketplace: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  purchase_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  delivery_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  delivery_partner: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  tracking_number: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  installation_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  installation_completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  activation_due_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  activation_message_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  activation_sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  activated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  warranty_start_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  warranty_end_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  warranty_start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  warranty_end_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(
      'PENDING_VERIFICATION',
      'ACTIVE',
      'EXPIRING_SOON',
      'EXPIRED',
      'CLAIM_IN_PROGRESS',
      'SUSPENDED',
      'CANCELLED'
    ),
    defaultValue: 'PENDING_VERIFICATION',
  },
  verification_status: {
    type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'),
    defaultValue: 'PENDING',
  },
  registration_source: {
    type: DataTypes.STRING(50),
    defaultValue: 'WEBSITE_FORM',
  },
  terms_accepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  privacy_accepted: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  registered_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  verified_by: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  rejection_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // ─── 16-State Lifecycle Machine & Reverse Logistics Fields ─────────────────
  warranty_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'PENDING_DELIVERY',
  },
  return_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'NONE',
  },
  return_requested_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  returned_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  returned_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  return_id: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  cancellation_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  warranty_activation_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  warranty_expiry_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  warranty_reset_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  warranty_reset_by: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  warranty_reset_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_returned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  created_by: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
}, {
  tableName: 'warranties',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['warranty_number'], unique: true },
    { fields: ['customer_id'] },
    { fields: ['order_id'] },
    { fields: ['warranty_status'] },
    { fields: ['return_status'] },
    { fields: ['activation_due_at'] },
    { fields: ['installation_completed_at'] },
    { fields: ['status'] },
  ],
});

const WarrantyDocument = sequelize.define('WarrantyDocument', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  warranty_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
  },
  document_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'PURCHASE_INVOICE',
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  mime_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  uploaded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'warranty_documents',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const WarrantyServiceRequest = sequelize.define('WarrantyServiceRequest', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  service_request_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  warranty_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
  },
  customer_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
  },
  technician_id: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  created_by: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  issue: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
  },
  status: {
    type: DataTypes.ENUM(
      'NEW',
      'UNDER_REVIEW',
      'WARRANTY_VERIFIED',
      'TECHNICIAN_ASSIGNED',
      'VISIT_SCHEDULED',
      'IN_PROGRESS',
      'COMPLETED',
      'CLOSED',
      'REJECTED'
    ),
    defaultValue: 'NEW',
  },
  assigned_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scheduled_at: {
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
  resolution: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  parts_used: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'warranty_service_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

const WarrantyEvent = sequelize.define('WarrantyEvent', {
  id: {
    type: DataTypes.CHAR(36),
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  warranty_id: {
    type: DataTypes.CHAR(36),
    allowNull: false,
  },
  actor_user_id: {
    type: DataTypes.CHAR(36),
    allowNull: true,
  },
  event_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  from_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  to_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  source_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'SYSTEM', // ORDER, DELIVERY, INSTALLATION, CUSTOMER, ADMIN, SYSTEM, WEBHOOK
  },
  source_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'warranty_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['warranty_id'] },
    { fields: ['event_type'] },
    { fields: ['timestamp'] },
    { fields: ['source_type'] },
  ],
});

module.exports = {
  Warranty,
  WarrantyDocument,
  WarrantyServiceRequest,
  WarrantyEvent,
};
