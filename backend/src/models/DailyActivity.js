'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class DailyActivity extends Model {}

DailyActivity.init(
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
      allowNull: false,
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
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'General',
    },
    scheduled_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    estimated_hours: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1.0,
    },
    actual_hours: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
    completion_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED', 'INCOMPLETE', 'LATE'),
      allowNull: false,
      defaultValue: 'ASSIGNED',
    },
    assigned_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    shift_duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 24, // in hours
    },
  },
  {
    sequelize,
    modelName: 'DailyActivity',
    tableName: 'daily_activities',
    timestamps: true,
    underscored: true,
  }
);

class DailyActivityHistory extends Model {}

DailyActivityHistory.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    activity_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    actor_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    event_type: {
      type: DataTypes.ENUM(
        'ACTIVITY_CREATED',
        'ACTIVITY_ASSIGNED',
        'ACTIVITY_STARTED',
        'ACTIVITY_COMPLETED',
        'ACTIVITY_INCOMPLETE',
        'ACTIVITY_LATE',
        'STATUS_CHANGED',
        'COMMENT_ADDED',
        'HOURS_LOGGED',
        'ACTIVITY_UPDATED'
      ),
      allowNull: false,
    },
    old_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    new_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'DailyActivityHistory',
    tableName: 'daily_activity_history',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = {
  DailyActivity,
  DailyActivityHistory,
};

