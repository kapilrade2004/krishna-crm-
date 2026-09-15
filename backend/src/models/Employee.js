'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const DOC_TYPES = [
  'id_proof','address_proof','photo','pan_card','aadhaar_card',
  'offer_letter','appointment_letter','relieving_letter',
  'experience_letter','educational_certificate','bank_passbook','resume','other',
];

const DOC_TYPE_LABELS = {
  id_proof:'ID Proof', address_proof:'Address Proof', photo:'Passport Size Photo',
  pan_card:'PAN Card', aadhaar_card:'Aadhaar Card', offer_letter:'Offer Letter',
  appointment_letter:'Appointment Letter', relieving_letter:'Relieving Letter',
  experience_letter:'Experience Letter', educational_certificate:'Educational Certificate',
  bank_passbook:'Bank Passbook / Cancelled Cheque', resume:'Resume / CV', other:'Other',
};

const MANDATORY_DOC_TYPES = [
  'aadhaar_card', 'pan_card', 'resume', 'bank_passbook', 'photo'
];

// ── Standalone / Linked Employee ─────────────────────────────────────────────
class Employee extends Model {}

Employee.init({
  id:            { type: DataTypes.CHAR(36),    primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  user_id:       { type: DataTypes.CHAR(36),    allowNull: true }, // Optional link to CRM user
  employee_code: { type: DataTypes.STRING(30),  allowNull: true,  unique: true },
  smartoffice_employee_code: { type: DataTypes.STRING(50), allowNull: true },
  first_name:    { type: DataTypes.STRING(100), allowNull: false },
  last_name:     { type: DataTypes.STRING(100), allowNull: false },
  email:         { type: DataTypes.STRING(150), allowNull: true,  unique: true },
  phone:         { type: DataTypes.STRING(20),  allowNull: true },
  avatar_url:    { type: DataTypes.STRING(500), allowNull: true },
  status:        { type: DataTypes.ENUM('active','inactive','terminated'), defaultValue: 'active' },
  onboarding_status: { type: DataTypes.STRING(30), defaultValue: 'pending' }, // pending, in_progress, completed, waived
  // Personal
  date_of_birth:     { type: DataTypes.DATEONLY,   allowNull: true },
  gender:            { type: DataTypes.ENUM('male','female','other'), allowNull: true },
  blood_group:       { type: DataTypes.STRING(5),  allowNull: true },
  personal_email:    { type: DataTypes.STRING(150),allowNull: true },
  personal_phone:    { type: DataTypes.STRING(20), allowNull: true },
  present_address:   { type: DataTypes.TEXT,       allowNull: true },
  permanent_address: { type: DataTypes.TEXT,       allowNull: true },
  // Job
  department:           { type: DataTypes.STRING(100),allowNull: true },
  designation:          { type: DataTypes.STRING(100),allowNull: true },
  date_of_joining:      { type: DataTypes.DATEONLY,   allowNull: true },
  date_of_leaving:      { type: DataTypes.DATEONLY,   allowNull: true },
  probation_end_date:   { type: DataTypes.DATEONLY,   allowNull: true },
  confirmation_date:    { type: DataTypes.DATEONLY,   allowNull: true },
  exit_date:            { type: DataTypes.DATEONLY,   allowNull: true },
  exit_reason:          { type: DataTypes.STRING(255), allowNull: true },
  handover_notes:       { type: DataTypes.TEXT,        allowNull: true },
  offboarded_by:        { type: DataTypes.CHAR(36),    allowNull: true },
  offboarded_at:        { type: DataTypes.DATE,        allowNull: true },
  employment_type:      { type: DataTypes.ENUM('full_time','part_time','contract','intern'), defaultValue: 'full_time' },
  reporting_manager:    { type: DataTypes.STRING(100),allowNull: true },
  reporting_manager_id: { type: DataTypes.CHAR(36),   allowNull: true }, // FK to User id
  work_location:        { type: DataTypes.STRING(100),allowNull: true },
  salary:               { type: DataTypes.DECIMAL(12,2), allowNull: true },
  // Bank / Tax
  bank_name:           { type: DataTypes.STRING(100),allowNull: true },
  bank_account_number: { type: DataTypes.STRING(30), allowNull: true },
  bank_ifsc:           { type: DataTypes.STRING(20), allowNull: true },
  pan_number:          { type: DataTypes.STRING(20), allowNull: true },
  aadhaar_last4:       { type: DataTypes.STRING(4),  allowNull: true },
  uan_number:          { type: DataTypes.STRING(20), allowNull: true },
  // Emergency
  emergency_contact_name:     { type: DataTypes.STRING(100),allowNull: true },
  emergency_contact_phone:    { type: DataTypes.STRING(20), allowNull: true },
  emergency_contact_relation: { type: DataTypes.STRING(50), allowNull: true },
  notes:      { type: DataTypes.TEXT,     allowNull: true },
  created_by: { type: DataTypes.CHAR(36), allowNull: true },
}, {
  sequelize, modelName: 'Employee', tableName: 'employees',
  indexes: [
    { fields: ['status'] },
    { fields: ['onboarding_status'] },
    { fields: ['department'] },
    { fields: ['employee_code'] },
    { fields: ['user_id'] },
    { fields: ['reporting_manager_id'] }
  ],
});

// ── Employee Document ──────────────────────────────────────────────────────────
class EmployeeDocument extends Model {}

EmployeeDocument.init({
  id:            { type: DataTypes.CHAR(36),    primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  employee_id:   { type: DataTypes.CHAR(36),    allowNull: false },
  document_type: { type: DataTypes.STRING(50),  defaultValue: 'other' },
  document_name: { type: DataTypes.STRING(200), allowNull: false },
  original_name: { type: DataTypes.STRING(300), allowNull: false },
  file_path:     { type: DataTypes.STRING(1000),allowNull: false },
  file_size:     { type: DataTypes.INTEGER,     allowNull: false },
  mime_type:     { type: DataTypes.STRING(100), allowNull: false },
  status:        { type: DataTypes.STRING(30),  defaultValue: 'uploaded' }, // missing, uploaded, under_review, verified, rejected
  version:       { type: DataTypes.INTEGER,     defaultValue: 1 },
  is_current:    { type: DataTypes.BOOLEAN,     defaultValue: true },
  replaced_by:   { type: DataTypes.CHAR(36),    allowNull: true },
  verified_by:   { type: DataTypes.CHAR(36),    allowNull: true },
  verified_at:   { type: DataTypes.DATE,        allowNull: true },
  rejection_reason: { type: DataTypes.STRING(500), allowNull: true },
  remarks:       { type: DataTypes.TEXT,        allowNull: true },
  review_requested_at: { type: DataTypes.DATE, allowNull: true },
  expiry_date:   { type: DataTypes.DATEONLY,    allowNull: true },
  notes:         { type: DataTypes.TEXT,        allowNull: true },
  uploaded_by:   { type: DataTypes.CHAR(36),    allowNull: false },
}, {
  sequelize, modelName: 'EmployeeDocument', tableName: 'employee_documents',
  indexes: [
    { fields: ['employee_id'] },
    { fields: ['status'] },
    { fields: ['is_current'] }
  ],
});

Employee.hasMany(EmployeeDocument, { foreignKey: 'employee_id', as: 'documents' });
EmployeeDocument.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

module.exports = { Employee, EmployeeDocument, DOC_TYPES, DOC_TYPE_LABELS, MANDATORY_DOC_TYPES };