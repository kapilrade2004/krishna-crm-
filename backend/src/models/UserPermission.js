'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class RolePermission extends Model {}

RolePermission.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    role_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    permission_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'RolePermission',
    tableName: 'role_permissions',
    timestamps: true,
    paranoid: false,
  }
);

class UserPermission extends Model {}

UserPermission.init(
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
    permission_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    is_allowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'UserPermission',
    tableName: 'user_permissions',
    timestamps: true,
    paranoid: false,
  }
);

module.exports = { RolePermission, UserPermission };
