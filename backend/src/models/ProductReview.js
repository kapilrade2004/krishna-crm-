'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class ProductReview extends Model {}

ProductReview.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    order_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    customer_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    customer_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    customer_phone: {
      type: DataTypes.STRING(25),
      allowNull: true,
    },
    marketplace: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'amazon', // amazon, flipkart, indiamart, website, direct
    },
    product_sku: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    product_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    product_rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
    },
    seller_rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 5 },
    },
    review_title: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    review_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    screenshot_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending_verification', // pending_verification, verified_genuine, flagged_suspicious, rejected_fake, deleted
    },
    verified_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'ProductReview',
    tableName: 'product_reviews',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

module.exports = ProductReview;
