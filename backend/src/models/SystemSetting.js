'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class SystemSetting extends Model {}

SystemSetting.init(
  {
    key: {
      type: DataTypes.STRING(100),
      primaryKey: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'SystemSetting',
    tableName: 'system_settings',
    timestamps: true,
    underscored: true,
  }
);

module.exports = SystemSetting;
