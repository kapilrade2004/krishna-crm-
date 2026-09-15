'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class ReturnClaim extends Model {}

ReturnClaim.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    marketplace: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'amazon', // amazon, flipkart, meesho, direct
    },
    return_order_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    product_sku: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    product_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    return_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    customer_calling_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending_call', // pending_call, customer_satisfied_resolved, return_mandatory, unreachable
    },
    product_condition: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending_inspection', // good_usable, damaged_scrap, incorrect_product_received, pending_inspection
    },
    oms_guru_putaway: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    claim_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'none', // none, channel_damage_claim, 60_day_return_claim, wrong_product_claim
    },
    claim_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'not_eligible', // not_eligible, draft, submitted, in_review, approved, rejected
    },
    claim_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    reimbursed_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    handled_by: {
      type: DataTypes.CHAR(36),
      allowNull: false, // E-Commerce Executive (Shruti / Priya)
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ReturnClaim',
    tableName: 'return_claims',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

module.exports = ReturnClaim;
