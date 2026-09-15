'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class ResetAuditLog extends Model {}

ResetAuditLog.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    initiated_by_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    initiated_by_email: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    environment: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    records_deleted: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    execution_duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ResetAuditLog',
    tableName: 'reset_audit_logs',
    timestamps: true,
    underscored: true,
  }
);

module.exports = ResetAuditLog;
