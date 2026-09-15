'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class WhatsAppRateLimitEvent extends Model {}

WhatsAppRateLimitEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'THROTTLED, PROVIDER_429, SPEND_CEILING_BLOCKED, BALANCE_BLOCKED, RESERVATION_ACQUIRED, RESERVATION_RELEASED',
    },
    batch_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    outbox_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    worker_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    configured_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    current_usage: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    details: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: 'WhatsAppRateLimitEvent',
    tableName: 'whatsapp_rate_limit_events',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['event_type'] },
      { fields: ['created_at'] },
      { fields: ['batch_id'] },
    ],
  }
);

module.exports = WhatsAppRateLimitEvent;
