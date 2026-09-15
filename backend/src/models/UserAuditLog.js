'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class UserAuditLog extends Model {}

UserAuditLog.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    actor_user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    target_user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    module: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'user_management',
    },
    old_values: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    new_values: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'UserAuditLog',
    tableName: 'user_audit_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['actor_user_id'] },
      { fields: ['target_user_id'] },
      { fields: ['event_type'] },
      { fields: ['module'] },
      { fields: ['created_at'] },
    ],
  }
);

module.exports = UserAuditLog;
