'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class LoginHistory extends Model {}

LoginHistory.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    login_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    browser: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    os: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    device: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('success', 'failed', 'locked', 'suspended', 'pending_activation', 'inactive'),
      allowNull: false,
      defaultValue: 'success',
    },
    failure_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'LoginHistory',
    tableName: 'login_histories',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['email'] },
      { fields: ['login_at'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = LoginHistory;
