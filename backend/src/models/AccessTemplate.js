'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class AccessTemplate extends Model {}

AccessTemplate.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    role_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    created_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AccessTemplate',
    tableName: 'access_templates',
    timestamps: true,
    underscored: true,
  }
);

class AccessRequest extends Model {}

AccessRequest.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    requested_permissions: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    reviewed_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AccessRequest',
    tableName: 'access_requests',
    timestamps: true,
    underscored: true,
  }
);

module.exports = { AccessTemplate, AccessRequest };
