'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

// ── 1. Biometric Device ────────────────────────────────────────────────────────
class BiometricDevice extends Model {}

BiometricDevice.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    device_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    serial_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    smartoffice_device_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    device_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'BioMax', // BioMax, SpeedFace, etc.
    },
    location: {
      type: DataTypes.STRING(150),
      allowNull: true,
      defaultValue: 'Main Office',
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    port: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 4370,
    },
    status: {
      type: DataTypes.ENUM('online', 'degraded', 'offline', 'auth_error', 'sync_error'),
      defaultValue: 'online',
    },
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_successful_log_fetch_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    error_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    last_error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'BiometricDevice',
    tableName: 'biometric_devices',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['serial_number'], unique: true },
      { fields: ['status'] },
      { fields: ['is_active'] },
    ],
  }
);

// ── 2. Employee ↔ Biometric Mapping ──────────────────────────────────────────
class EmployeeBiometricMapping extends Model {}

EmployeeBiometricMapping.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      unique: true,
    },
    employee_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    smartoffice_employee_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    device_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    device_serial_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    biometric_user_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    fingerprint_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    face_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    card_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    card_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    enrollment_status: {
      type: DataTypes.ENUM('not_enrolled', 'pending_enrollment', 'enrolled', 'sync_failed', 'disabled'),
      defaultValue: 'not_enrolled',
    },
    last_synced_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sync_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'EmployeeBiometricMapping',
    tableName: 'employee_biometric_mappings',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['employee_id'], unique: true },
      { fields: ['employee_code'], unique: true },
      { fields: ['enrollment_status'] },
      { fields: ['device_serial_number'] },
    ],
  }
);

// ── 3. Raw Biometric Punch Event ──────────────────────────────────────────────
class BiometricPunchEvent extends Model {}

BiometricPunchEvent.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    employee_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: true, // Nullable when punch arrives for unknown/unmapped employee
    },
    device_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    device_serial_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    punch_timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    punch_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    punch_direction: {
      type: DataTypes.ENUM('IN', 'OUT', 'UNKNOWN'),
      defaultValue: 'UNKNOWN',
    },
    temperature: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    temperature_state: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'Normal',
    },
    source: {
      type: DataTypes.STRING(50),
      defaultValue: 'BIOMETRIC',
    },
    external_event_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true, // Guarantees duplicate punches are rejected
    },
    raw_payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    processing_status: {
      type: DataTypes.ENUM('PENDING', 'PROCESSED', 'DUPLICATE', 'UNMAPPED', 'ERROR'),
      defaultValue: 'PENDING',
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    error_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'BiometricPunchEvent',
    tableName: 'biometric_punch_events',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['external_event_hash'], unique: true },
      { fields: ['employee_code'] },
      { fields: ['employee_id'] },
      { fields: ['punch_date'] },
      { fields: ['punch_timestamp'] },
      { fields: ['processing_status'] },
      { fields: ['device_serial_number'] },
    ],
  }
);

// ── 4. Attendance Shift Definitions ──────────────────────────────────────────
class AttendanceShift extends Model {}

AttendanceShift.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    shift_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'General Shift',
    },
    shift_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      defaultValue: 'GEN_10_06',
    },
    start_time: {
      type: DataTypes.STRING(8), // HH:mm:ss e.g. "10:00:00"
      allowNull: false,
      defaultValue: '10:00:00',
    },
    end_time: {
      type: DataTypes.STRING(8), // HH:mm:ss e.g. "18:00:00"
      allowNull: false,
      defaultValue: '18:00:00',
    },
    grace_period_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 10, // up to 10:10 AM is not considered late
    },
    late_after_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
    },
    early_leave_before_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 10, // leaving before 05:50 PM is early leave
    },
    min_full_day_hours: {
      type: DataTypes.DECIMAL(4, 2),
      defaultValue: 8.0,
    },
    min_half_day_hours: {
      type: DataTypes.DECIMAL(4, 2),
      defaultValue: 4.0,
    },
    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'AttendanceShift',
    tableName: 'attendance_shifts',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['shift_code'], unique: true },
      { fields: ['is_default'] },
      { fields: ['is_active'] },
    ],
  }
);

// ── 5. Calculated Daily Attendance Record ─────────────────────────────────────
class AttendanceDay extends Model {}

AttendanceDay.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    employee_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    shift_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    scheduled_start: {
      type: DataTypes.STRING(8),
      allowNull: true,
      defaultValue: '10:00:00',
    },
    scheduled_end: {
      type: DataTypes.STRING(8),
      allowNull: true,
      defaultValue: '18:00:00',
    },
    first_in: {
      type: DataTypes.STRING(8), // HH:mm:ss or HH:mm
      allowNull: true,
    },
    last_out: {
      type: DataTypes.STRING(8), // HH:mm:ss or HH:mm
      allowNull: true,
    },
    total_work_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    total_break_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    work_hours: {
      type: DataTypes.DECIMAL(4, 2),
      defaultValue: 0.0,
    },
    break_hours: {
      type: DataTypes.DECIMAL(4, 2),
      defaultValue: 0.0,
    },
    late_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    early_leave_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    overtime_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM(
        'PRESENT',
        'ABSENT',
        'LATE',
        'HALF_DAY',
        'ON_LEAVE',
        'HOLIDAY',
        'WEEK_OFF',
        'WORK_FROM_HOME',
        'INCOMPLETE',
        'EARLY_LEAVE',
        'OVERTIME'
      ),
      defaultValue: 'ABSENT',
    },
    source: {
      type: DataTypes.ENUM('BIOMETRIC', 'MANUAL', 'HYBRID'),
      defaultValue: 'BIOMETRIC',
    },
    is_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_corrected: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AttendanceDay',
    tableName: 'attendance_days',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['employee_id', 'date'], unique: true },
      { fields: ['date'] },
      { fields: ['status'] },
      { fields: ['source'] },
    ],
  }
);

// ── 6. Attendance Work / Break Segments ────────────────────────────────────────
class AttendanceSegment extends Model {}

AttendanceSegment.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    attendance_day_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    segment_type: {
      type: DataTypes.ENUM('WORK', 'BREAK'),
      defaultValue: 'WORK',
    },
    in_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    out_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    in_event_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    out_event_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AttendanceSegment',
    tableName: 'attendance_segments',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['attendance_day_id'] },
      { fields: ['employee_id'] },
      { fields: ['segment_type'] },
    ],
  }
);

// ── 7. Attendance Correction Requests & Approvals ─────────────────────────────
class AttendanceCorrection extends Model {}

AttendanceCorrection.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    attendance_day_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    correction_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    original_in: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    original_out: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    original_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    corrected_in: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    corrected_out: {
      type: DataTypes.STRING(8),
      allowNull: true,
    },
    corrected_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    requested_by: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },
    approved_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending',
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AttendanceCorrection',
    tableName: 'attendance_corrections',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['employee_id'] },
      { fields: ['correction_date'] },
      { fields: ['status'] },
    ],
  }
);

// ── 8. Integration Sync State ────────────────────────────────────────────────
class IntegrationSyncState extends Model {}

IntegrationSyncState.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    integration_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'smartoffice_biometric',
    },
    device_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    last_successful_cursor: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_successful_timestamp: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_attempt_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_success_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('healthy', 'degraded', 'failing', 'syncing'),
      defaultValue: 'healthy',
    },
    sync_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: 'IntegrationSyncState',
    tableName: 'integration_sync_states',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['integration_name'], unique: true },
      { fields: ['status'] },
    ],
  }
);

// ── 9. Attendance Audit Log ───────────────────────────────────────────────────
class AttendanceAuditLog extends Model {}

AttendanceAuditLog.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    actor_user_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    before_state: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    after_state: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'AttendanceAuditLog',
    tableName: 'attendance_audit_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['actor_user_id'] },
      { fields: ['action'] },
      { fields: ['entity_type', 'entity_id'] },
      { fields: ['created_at'] },
    ],
  }
);

// ── 10. SmartOffice Raw Attendance Event (Immutable Punches) ──────────────────
class AttendanceEvent extends Model {}

AttendanceEvent.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    employee_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    smartoffice_employee_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    device_serial_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    log_datetime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    punch_direction: {
      type: DataTypes.STRING(20),
      defaultValue: 'UNKNOWN',
    },
    temperature: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.0,
    },
    temperature_state: {
      type: DataTypes.STRING(50),
      defaultValue: 'Not Measured',
    },
    source: {
      type: DataTypes.STRING(50),
      defaultValue: 'smartoffice',
    },
    external_event_key: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'PROCESSED', // PROCESSED, UNMATCHED_EMPLOYEE, DUPLICATE, ERROR
    },
    raw_payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    received_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'AttendanceEvent',
    tableName: 'attendance_events',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['external_event_key'], unique: true },
      { fields: ['employee_id'] },
      { fields: ['smartoffice_employee_code'] },
      { fields: ['log_datetime'] },
      { fields: ['status'] },
      { fields: ['device_serial_number'] },
    ],
  }
);

// ── 11. Attendance Sync Run Tracking ──────────────────────────────────────────
class AttendanceSyncRun extends Model {}

AttendanceSyncRun.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    from_datetime: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    to_datetime: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    started_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    records_received: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    records_inserted: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    records_duplicate: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    records_unmatched: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    records_failed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'),
      defaultValue: 'RUNNING',
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sync_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'SCHEDULED', // SCHEDULED, MANUAL, BACKFILL
    },
  },
  {
    sequelize,
    modelName: 'AttendanceSyncRun',
    tableName: 'attendance_sync_runs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['started_at'] },
      { fields: ['status'] },
    ],
  }
);

module.exports = {
  BiometricDevice,
  EmployeeBiometricMapping,
  BiometricPunchEvent,
  AttendanceShift,
  AttendanceDay,
  AttendanceSegment,
  AttendanceCorrection,
  IntegrationSyncState,
  AttendanceAuditLog,
  AttendanceEvent,
  AttendanceSyncRun,
};

