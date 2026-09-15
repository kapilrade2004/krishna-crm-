'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Customer extends Model {}

Customer.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    whatsapp_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    address_line1: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    address_line2: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(100),
      defaultValue: 'India',
    },
    source: {
      type: DataTypes.ENUM('amazon', 'flipkart', 'indiamart', 'akuabeat_website', 'website', 'direct', 'other'),
      defaultValue: 'other',
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'active',
    },
    // CR4 — Post-sale customer journey stage
    lifecycle_stage: {
      type: DataTypes.ENUM(
        'prospect',            // Lead / potential buyer
        'customer',            // Order confirmed, not yet delivered
        'installation_pending',// Delivered, installation guide not yet sent
        'installation_done',   // Customer confirmed installation complete
        'feedback_pending',    // Awaiting post-install feedback
        'engaged'              // Fully onboarded, ongoing relationship
      ),
      defaultValue: 'prospect',
    },
    installation_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    installation_confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // WhatsApp Installation Guide Help Tracking
    installation_help_requested: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      get() {
        const raw = this.getDataValue('installation_help_requested');
        return raw === true || raw === 1 || raw === '1' || raw === 'true';
      },
    },
    installation_help_requested_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    installation_help_status: {
      type: DataTypes.ENUM('pending', 'contacted', 'visit_scheduled', 'resolved'),
      defaultValue: 'pending',
    },
    installation_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    feedback_collected_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    engagement_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    total_orders: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    total_revenue: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    assigned_to: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    whatsapp_opt_in: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    last_contacted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Customer',
    tableName: 'customers',
    indexes: [
      { fields: ['phone'] },
      { fields: ['whatsapp_number'] },
      { fields: ['email'] },
      { fields: ['source'] },
      { fields: ['status'] },
      { fields: ['lifecycle_stage'] },
      { fields: ['installation_help_requested'] },
      { fields: ['installation_help_status'] },
      { fields: ['assigned_to'] },
      { fields: ['pincode'] },
      // High-concurrency composite indexes
      { fields: ['phone', 'status'] },
      { fields: ['installation_help_requested', 'installation_help_status'] },
      { fields: ['lifecycle_stage', 'created_at'] },
    ],
  }
);

module.exports = Customer;
