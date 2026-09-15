'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class AdCampaignMetric extends Model {}

AdCampaignMetric.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    campaign_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    marketplace: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'amazon', // amazon, flipkart, other
    },
    campaign_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'exact', // auto, exact, broad, phrase, sponsored_brand, sponsored_display
    },
    target_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    budget_daily: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 500.0,
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
    orders_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    ctr_percent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    acos_percent: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    roas: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'active', // active, paused, needs_budget, low_roas, high_waste
    },
    bid_status: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    recommendation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AdCampaignMetric',
    tableName: 'ad_campaign_metrics',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

module.exports = AdCampaignMetric;
