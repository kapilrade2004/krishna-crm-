'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class AccountingRecord extends Model {}

AccountingRecord.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    record_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      // tally_entry, stock_reconciliation, purchase_bill, mybillbook_invoice, banking_deposit, dsr_filing
    },
    voucher_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    party_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true, // Vendor PO, Customer Sales, Overhead, Tax, Inventory Inward/Outward
    },
    debit_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    credit_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    stock_sku: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    physical_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    book_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    discrepancy_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reconciled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    portal_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Tally', // Tally, MyBillBook, Bank, Pureit/Kent/Usha PO
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'AccountingRecord',
    tableName: 'accounting_records',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

module.exports = AccountingRecord;
