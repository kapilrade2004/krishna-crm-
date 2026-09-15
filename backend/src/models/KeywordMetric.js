'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class KeywordMetric extends Model {}

KeywordMetric.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    keyword: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    campaign_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    match_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'exact', // exact, phrase, broad, negative
    },
    impressions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    clicks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    spend: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    sales: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    orders: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    current_bid: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    suggested_bid: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    conversion_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    is_negative: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_migrated_from_auto: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: 'KeywordMetric',
    tableName: 'keyword_metrics',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

module.exports = KeywordMetric;
