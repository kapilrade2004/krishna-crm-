'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class ChequeCollection extends Model {}

ChequeCollection.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    customer_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    customer_phone: {
      type: DataTypes.STRING(25),
      allowNull: true,
    },
    order_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    cheque_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    bank_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cheque_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    photo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'assigned_pickup',
      // assigned_pickup, collected, submitted_to_office, verified_by_accountant, deposited, cleared, bounced
    },
    assigned_to: {
      type: DataTypes.CHAR(36),
      allowNull: false, // Delivery Boy (Manoj)
    },
    collected_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verified_by: {
      type: DataTypes.CHAR(36),
      allowNull: true, // Accountant (Riya/Sanjay)
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
    modelName: 'ChequeCollection',
    tableName: 'cheque_collections',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

module.exports = ChequeCollection;
