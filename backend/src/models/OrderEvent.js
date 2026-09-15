'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class OrderEvent extends Model {}

OrderEvent.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    order_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    customer_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'system',
    },
    actor_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'user',
    },
    actor_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    actor: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    previous_state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    before_state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    new_state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    after_state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    correlation_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'OrderEvent',
    tableName: 'order_events',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['order_id'] },
      { fields: ['customer_id'] },
      { fields: ['event_type'] },
      { fields: ['correlation_id'] },
      { fields: ['created_at'] },
    ],
  }
);

module.exports = OrderEvent;
