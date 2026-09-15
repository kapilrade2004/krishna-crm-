'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class DailyTask extends Model {}

DailyTask.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    assigned_by: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    assigned_to: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'medium',
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DailyTask',
    tableName: 'daily_tasks',
    timestamps: true,
    underscored: true,
  }
);

class DailyTaskHistory extends Model {}

DailyTaskHistory.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    daily_task_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    changed_by: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    field_changed: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    old_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    new_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DailyTaskHistory',
    tableName: 'daily_task_history',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = {
  DailyTask,
  DailyTaskHistory,
};
