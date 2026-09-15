'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

// ════════════════════════════════════════════════════════════════════════════
//  SHIPPING PARTNER
//  Master list of courier/logistics partners. Phase 1 = manual data entry by
//  ops team. Architecture is ready for live courier API integration later
//  (api_config JSON column reserved for credentials/endpoints).
// ════════════════════════════════════════════════════════════════════════════
class ShippingPartner extends Model {}

ShippingPartner.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Short code e.g. DELHIVERY, BLUEDART, DTDC, ECOM, XPRESSBEES',
    },
    contact_person: { type: DataTypes.STRING(100), allowNull: true },
    contact_phone: { type: DataTypes.STRING(20), allowNull: true },
    contact_email: { type: DataTypes.STRING(150), allowNull: true },
    tracking_url_template: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "URL template with {tracking_number} placeholder, e.g. https://track.delhivery.com/p/{tracking_number}",
    },
    default_tat_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Default delivery TAT in days if no pincode-specific entry exists',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    api_config: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Reserved for future courier API credentials/endpoints (Phase 2+)',
    },
  },
  {
    sequelize,
    modelName: 'ShippingPartner',
    tableName: 'shipping_partners',
    indexes: [
      { fields: ['code'] },
      { fields: ['is_active'] },
    ],
  }
);

// ════════════════════════════════════════════════════════════════════════════
//  PINCODE SERVICEABILITY
//  Lookup table: pincode (+ optional partner) → serviceable, TAT, COD support.
//  Used to power "Delivery Confirmation as per Pincodes / Delivery TAT" from
//  the order processing flow (mindmap stage 4).
// ════════════════════════════════════════════════════════════════════════════
class PincodeServiceability extends Model {}

PincodeServiceability.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    city: { type: DataTypes.STRING(100), allowNull: true },
    state: { type: DataTypes.STRING(100), allowNull: true },
    shipping_partner_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      references: { model: 'shipping_partners', key: 'id' },
      comment: 'NULL = applies to all partners (general TAT for this pincode)',
    },
    is_serviceable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    tat_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Estimated delivery TAT in days for this pincode',
    },
    cod_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'PincodeServiceability',
    tableName: 'pincode_serviceability',
    indexes: [
      { fields: ['pincode'] },
      { fields: ['shipping_partner_id'] },
      // Fast lookup: pincode + partner combo
      { fields: ['pincode', 'shipping_partner_id'], unique: true, name: 'uq_pincode_partner' },
    ],
  }
);

module.exports = { ShippingPartner, PincodeServiceability };
