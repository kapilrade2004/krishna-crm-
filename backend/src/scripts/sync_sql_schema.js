'use strict';

const fs = require('fs');
const path = require('path');

function syncSQLSchema() {
  const sqlPath = path.join(__dirname, '..', '..', 'migrations', '001_complete_schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`Error: Schema file not found at ${sqlPath}`);
    process.exit(1);
  }

  let content = fs.readFileSync(sqlPath, 'utf8');

  console.log('🔄 Surgically updating existing tables in 001_complete_schema.sql...');

  // 1. Update users table: add display_password before created_at
  const userTarget = `  phone                   VARCHAR(20)   NULL,\r\n  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const userReplacement = `  phone                   VARCHAR(20)   NULL,\r\n  display_password        VARCHAR(255)  NULL,\r\n  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  
  const userTargetLF = `  phone                   VARCHAR(20)   NULL,\n  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const userReplacementLF = `  phone                   VARCHAR(20)   NULL,\n  display_password        VARCHAR(255)  NULL,\n  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;

  if (content.includes(userTarget)) {
    content = content.replace(userTarget, userReplacement);
  } else {
    content = content.replace(userTargetLF, userReplacementLF);
  }

  // 2. Update customers table: add installation fields before created_at
  const custTarget = `  last_contacted_at         DATETIME      NULL,\r\n  created_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const custReplacement = `  last_contacted_at         DATETIME      NULL,\r\n  installation_help_requested TINYINT(1) NOT NULL DEFAULT 0,\r\n  installation_help_requested_at DATETIME NULL,\r\n  installation_help_status VARCHAR(50) NULL DEFAULT 'pending',\r\n  installation_notes TEXT NULL,\r\n  created_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;

  const custTargetLF = `  last_contacted_at         DATETIME      NULL,\n  created_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const custReplacementLF = `  last_contacted_at         DATETIME      NULL,\n  installation_help_requested TINYINT(1) NOT NULL DEFAULT 0,\n  installation_help_requested_at DATETIME NULL,\n  installation_help_status VARCHAR(50) NULL DEFAULT 'pending',\n  installation_notes TEXT NULL,\n  created_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;

  if (content.includes(custTarget)) {
    content = content.replace(custTarget, custReplacement);
  } else {
    content = content.replace(custTargetLF, custReplacementLF);
  }

  // 3. Update employee_audit_daily_summaries: change leave_taken to leave, add deleted_at
  content = content.replace(/leave_taken                   TINYINT\(1\)    NOT NULL DEFAULT 0,/g, '`leave`                       TINYINT(1)    NOT NULL DEFAULT 0,');
  
  const eadsTarget = `  total_completion_time_minutes INT           NOT NULL DEFAULT 0,\r\n  created_at                    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const eadsReplacement = `  total_completion_time_minutes INT           NOT NULL DEFAULT 0,\r\n  deleted_at                    DATETIME      NULL,\r\n  created_at                    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;

  const eadsTargetLF = `  total_completion_time_minutes INT           NOT NULL DEFAULT 0,\n  created_at                    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const eadsReplacementLF = `  total_completion_time_minutes INT           NOT NULL DEFAULT 0,\n  deleted_at                    DATETIME      NULL,\n  created_at                    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`;

  if (content.includes(eadsTarget)) {
    content = content.replace(eadsTarget, eadsReplacement);
  } else {
    content = content.replace(eadsTargetLF, eadsReplacementLF);
  }

  // 4. Update warranties table: add 30 missing columns
  const warrantyTarget = `  rejection_reason      TEXT         NULL,\r\n  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const warrantyReplacement = `  rejection_reason      TEXT         NULL,\r\n  order_item_id VARCHAR(100) NULL,\r\n  serial_number VARCHAR(100) NULL,\r\n  unit_identifier VARCHAR(100) NULL,\r\n  delivery_id VARCHAR(100) NULL,\r\n  delivery_partner VARCHAR(100) NULL,\r\n  tracking_number VARCHAR(150) NULL,\r\n  delivered_at DATETIME NULL,\r\n  installation_id VARCHAR(100) NULL,\r\n  installation_completed_at DATETIME NULL,\r\n  activation_due_at DATETIME NULL,\r\n  activation_message_id VARCHAR(100) NULL,\r\n  activation_sent_at DATETIME NULL,\r\n  activated_at DATETIME NULL,\r\n  warranty_start_at DATETIME NULL,\r\n  warranty_end_at DATETIME NULL,\r\n  warranty_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_DELIVERY',\r\n  return_status VARCHAR(50) NOT NULL DEFAULT 'NONE',\r\n  return_requested_at DATETIME NULL,\r\n  returned_at DATETIME NULL,\r\n  returned_reason TEXT NULL,\r\n  return_id CHAR(36) NULL,\r\n  cancellation_reason TEXT NULL,\r\n  warranty_activation_date DATETIME NULL,\r\n  warranty_expiry_date DATETIME NULL,\r\n  warranty_reset_date DATETIME NULL,\r\n  warranty_reset_by CHAR(36) NULL,\r\n  warranty_reset_reason TEXT NULL,\r\n  is_returned TINYINT(1) NOT NULL DEFAULT 0,\r\n  created_by CHAR(36) NULL,\r\n  updated_by CHAR(36) NULL,\r\n  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`;

  const warrantyTargetLF = `  rejection_reason      TEXT         NULL,\n  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const warrantyReplacementLF = `  rejection_reason      TEXT         NULL,\n  order_item_id VARCHAR(100) NULL,\n  serial_number VARCHAR(100) NULL,\n  unit_identifier VARCHAR(100) NULL,\n  delivery_id VARCHAR(100) NULL,\n  delivery_partner VARCHAR(100) NULL,\n  tracking_number VARCHAR(150) NULL,\n  delivered_at DATETIME NULL,\n  installation_id VARCHAR(100) NULL,\n  installation_completed_at DATETIME NULL,\n  activation_due_at DATETIME NULL,\n  activation_message_id VARCHAR(100) NULL,\n  activation_sent_at DATETIME NULL,\n  activated_at DATETIME NULL,\n  warranty_start_at DATETIME NULL,\n  warranty_end_at DATETIME NULL,\n  warranty_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_DELIVERY',\n  return_status VARCHAR(50) NOT NULL DEFAULT 'NONE',\n  return_requested_at DATETIME NULL,\n  returned_at DATETIME NULL,\n  returned_reason TEXT NULL,\n  return_id CHAR(36) NULL,\n  cancellation_reason TEXT NULL,\n  warranty_activation_date DATETIME NULL,\n  warranty_expiry_date DATETIME NULL,\n  warranty_reset_date DATETIME NULL,\n  warranty_reset_by CHAR(36) NULL,\n  warranty_reset_reason TEXT NULL,\n  is_returned TINYINT(1) NOT NULL DEFAULT 0,\n  created_by CHAR(36) NULL,\n  updated_by CHAR(36) NULL,\n  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`;

  if (content.includes(warrantyTarget)) {
    content = content.replace(warrantyTarget, warrantyReplacement);
  } else {
    content = content.replace(warrantyTargetLF, warrantyReplacementLF);
  }

  // 5. Update warranty_events table: add 5 fields
  const weTarget = `  metadata      JSON         NULL,\r\n  timestamp     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const weReplacement = `  metadata      JSON         NULL,\r\n  from_status VARCHAR(50) NULL,\r\n  to_status VARCHAR(50) NULL,\r\n  source_type VARCHAR(50) NULL,\r\n  source_id VARCHAR(100) NULL,\r\n  timestamp     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,\r\n  deleted_at DATETIME NULL,`;

  const weTargetLF = `  metadata      JSON         NULL,\n  timestamp     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`;
  const weReplacementLF = `  metadata      JSON         NULL,\n  from_status VARCHAR(50) NULL,\n  to_status VARCHAR(50) NULL,\n  source_type VARCHAR(50) NULL,\n  source_id VARCHAR(100) NULL,\n  timestamp     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  deleted_at DATETIME NULL,`;

  if (content.includes(weTarget)) {
    content = content.replace(weTarget, weReplacement);
  } else {
    content = content.replace(weTargetLF, weReplacementLF);
  }

  // 6. Add deleted_at to soft deleted tables
  const softDeletes = [
    { target: `  failure_reason VARCHAR(255) NULL,\r\n  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  failure_reason VARCHAR(255) NULL,\r\n  deleted_at     DATETIME     NULL,\r\n  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    { target: `  failure_reason VARCHAR(255) NULL,\n  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  failure_reason VARCHAR(255) NULL,\n  deleted_at     DATETIME     NULL,\n  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    
    { target: `  user_agent     VARCHAR(500) NULL,\r\n  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  user_agent     VARCHAR(500) NULL,\r\n  deleted_at     DATETIME     NULL,\r\n  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    { target: `  user_agent     VARCHAR(500) NULL,\n  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  user_agent     VARCHAR(500) NULL,\n  deleted_at     DATETIME     NULL,\n  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    
    { target: `  permissions JSON          NULL,\r\n  created_by  CHAR(36)      NULL,\r\n  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  permissions JSON          NULL,\r\n  created_by  CHAR(36)      NULL,\r\n  deleted_at  DATETIME      NULL,\r\n  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    { target: `  permissions JSON          NULL,\n  created_by  CHAR(36)      NULL,\n  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  permissions JSON          NULL,\n  created_by  CHAR(36)      NULL,\n  deleted_at  DATETIME      NULL,\n  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    
    { target: `  rejection_reason      TEXT        NULL,\r\n  created_at            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  rejection_reason      TEXT        NULL,\r\n  deleted_at            DATETIME    NULL,\r\n  created_at            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    { target: `  rejection_reason      TEXT        NULL,\n  created_at            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  rejection_reason      TEXT        NULL,\n  deleted_at            DATETIME    NULL,\n  created_at            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    
    { target: `  notes                TEXT         NULL,\r\n  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  notes                TEXT         NULL,\r\n  deleted_at           DATETIME     NULL,\r\n  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    { target: `  notes                TEXT         NULL,\n  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  notes                TEXT         NULL,\n  deleted_at           DATETIME     NULL,\n  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    
    { target: `  new_values    JSON          NULL,\r\n  ip_address    VARCHAR(45)   NULL,\r\n  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  new_values    JSON          NULL,\r\n  ip_address    VARCHAR(45)   NULL,\r\n  deleted_at    DATETIME      NULL,\r\n  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    { target: `  new_values    JSON          NULL,\n  ip_address    VARCHAR(45)   NULL,\n  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  new_values    JSON          NULL,\n  ip_address    VARCHAR(45)   NULL,\n  deleted_at    DATETIME      NULL,\n  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    
    { target: `  new_value     TEXT        NULL,\r\n  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  new_value     TEXT        NULL,\r\n  deleted_at    DATETIME    NULL,\r\n  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    { target: `  new_value     TEXT        NULL,\n  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  new_value     TEXT        NULL,\n  deleted_at    DATETIME    NULL,\n  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    
    { target: `  notes       TEXT        NULL,\r\n  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  notes       TEXT        NULL,\r\n  deleted_at  DATETIME    NULL,\r\n  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,` },
    { target: `  notes       TEXT        NULL,\n  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,`, rep: `  notes       TEXT        NULL,\n  deleted_at  DATETIME    NULL,\n  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,` }
  ];

  for (const sd of softDeletes) {
    content = content.replace(sd.target, sd.rep);
  }

  // 7. Inject DDL definitions for the 20 missing tables before "SET foreign_key_checks = 1;"
  const insertMarkerTarget = `SET foreign_key_checks = 1;`;
  
  const missingTablesDDL = `
-- ============================================================
--  35. WHATSAPP OUTBOX QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id              CHAR(36)      NOT NULL,
  order_id        CHAR(36)      NULL,
  customer_id     CHAR(36)      NULL,
  recipient_phone VARCHAR(30)   NOT NULL,
  template_name   VARCHAR(100)  NOT NULL,
  payload         JSON          NULL,
  status          ENUM('pending', 'processing', 'sent', 'failed', 'paused') NOT NULL DEFAULT 'pending',
  attempts        INT           NOT NULL DEFAULT 0,
  max_attempts    INT           NOT NULL DEFAULT 5,
  last_error      TEXT          NULL,
  next_attempt_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         DATETIME      NULL,
  idempotency_key VARCHAR(150)  NULL UNIQUE,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX ix_wo_status_next (status, next_attempt_at),
  INDEX ix_wo_order_template (order_id, template_name),
  INDEX ix_wo_recipient_phone (recipient_phone),
  UNIQUE KEY uq_wo_idempotency_key (idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  36. WARRANTY RETURNS (RMA Logistics)
-- ============================================================
CREATE TABLE IF NOT EXISTS warranty_returns (
  id                      CHAR(36)      NOT NULL,
  return_number           VARCHAR(50)   NOT NULL,
  warranty_id             CHAR(36)      NOT NULL,
  order_id                CHAR(36)      NULL,
  customer_id             CHAR(36)      NOT NULL,
  requested_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  request_source          VARCHAR(50)   NOT NULL DEFAULT 'CUSTOMER_WEB',
  reason_code             VARCHAR(50)   NULL,
  reason_text             TEXT          NOT NULL,
  photos_json             JSON          NULL,
  documents_json          JSON          NULL,
  status                  VARCHAR(50)   NOT NULL DEFAULT 'REQUESTED',
  approved_by             CHAR(36)      NULL,
  approved_at             DATETIME      NULL,
  rejection_reason        TEXT          NULL,
  pickup_id               VARCHAR(100)  NULL,
  pickup_partner          VARCHAR(100)  NULL,
  pickup_tracking_number  VARCHAR(150)  NULL,
  pickup_scheduled_date   DATETIME      NULL,
  picked_up_at            DATETIME      NULL,
  received_at             DATETIME      NULL,
  inspected_at            DATETIME      NULL,
  inspection_result       VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
  inspection_notes        TEXT          NULL,
  refund_id               VARCHAR(100)  NULL,
  replacement_order_id    VARCHAR(100)  NULL,
  replacement_warranty_id CHAR(36)      NULL,
  closed_at               DATETIME      NULL,
  notes                   TEXT          NULL,
  created_by              CHAR(36)      NULL,
  updated_by              CHAR(36)      NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at              DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_wr_return_number (return_number),
  INDEX idx_wr_warranty (warranty_id),
  INDEX idx_wr_order (order_id),
  INDEX idx_wr_customer (customer_id),
  INDEX idx_wr_status (status),
  INDEX idx_wr_approved (approved_by),
  INDEX idx_wr_requested (requested_at),
  CONSTRAINT fk_wr_warranty FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wr_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wr_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  37. WARRANTY MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS warranty_messages (
  id                  CHAR(36)      NOT NULL,
  warranty_id         CHAR(36)      NOT NULL,
  customer_id         CHAR(36)      NULL,
  phone_number        VARCHAR(20)   NOT NULL,
  template_key        VARCHAR(100)  NOT NULL DEFAULT 'warranty_claim',
  channel             VARCHAR(50)   NOT NULL DEFAULT 'WHATSAPP',
  scheduled_at        DATETIME      NULL,
  sent_at             DATETIME      NULL,
  provider_message_id VARCHAR(150)  NULL,
  delivery_status     VARCHAR(50)   NOT NULL DEFAULT 'QUEUED',
  failure_reason      TEXT          NULL,
  attempt_count       INT           NOT NULL DEFAULT 1,
  idempotency_key     VARCHAR(255)  NOT NULL,
  activation_token    TEXT          NULL,
  activation_url      TEXT          NULL,
  payload             JSON          NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_wm_idempotency_key (idempotency_key),
  INDEX idx_wm_warranty (warranty_id),
  INDEX idx_wm_customer (customer_id),
  INDEX idx_wm_phone (phone_number),
  INDEX idx_wm_delivery_status (delivery_status),
  INDEX idx_wm_provider_message (provider_message_id),
  CONSTRAINT fk_wm_warranty FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_wm_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  38. BIOMETRIC DEVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS biometric_devices (
  id                           CHAR(36)      NOT NULL,
  device_name                  VARCHAR(100)  NOT NULL,
  serial_number                VARCHAR(100)  NOT NULL UNIQUE,
  smartoffice_device_id        VARCHAR(100)  NULL,
  device_type                  VARCHAR(50)   NOT NULL DEFAULT 'BioMax',
  location                     VARCHAR(150)  NULL DEFAULT 'Main Office',
  ip_address                   VARCHAR(45)   NULL,
  port                         INT           NULL DEFAULT 4370,
  status                       ENUM('online', 'degraded', 'offline', 'auth_error', 'sync_error') NOT NULL DEFAULT 'online',
  last_sync_at                 DATETIME      NULL,
  last_successful_log_fetch_at DATETIME      NULL,
  error_count                  INT           NOT NULL DEFAULT 0,
  last_error_message           TEXT          NULL,
  is_active                    TINYINT(1)    NOT NULL DEFAULT 1,
  created_by                   CHAR(36)      NULL,
  created_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_bd_serial_number (serial_number),
  INDEX idx_bd_status (status),
  INDEX idx_bd_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  39. EMPLOYEE BIOMETRIC MAPPINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_biometric_mappings (
  id                         CHAR(36)     NOT NULL,
  employee_id                CHAR(36)     NOT NULL UNIQUE,
  employee_code              VARCHAR(50)  NOT NULL UNIQUE,
  smartoffice_employee_code  VARCHAR(50)  NULL,
  device_id                  CHAR(36)     NULL,
  device_serial_number       VARCHAR(100) NULL,
  biometric_user_id          VARCHAR(100) NULL,
  fingerprint_enabled        TINYINT(1)   NOT NULL DEFAULT 1,
  face_enabled               TINYINT(1)   NOT NULL DEFAULT 0,
  card_enabled               TINYINT(1)   NOT NULL DEFAULT 0,
  card_number                VARCHAR(50)  NULL,
  enrollment_status          ENUM('not_enrolled', 'pending_enrollment', 'enrolled', 'sync_failed', 'disabled') NOT NULL DEFAULT 'not_enrolled',
  last_synced_at             DATETIME     NULL,
  sync_error                 TEXT         NULL,
  created_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                 DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ebm_employee_id (employee_id),
  UNIQUE KEY uq_ebm_employee_code (employee_code),
  INDEX idx_ebm_enrollment (enrollment_status),
  INDEX idx_ebm_device_serial (device_serial_number),
  CONSTRAINT fk_ebm_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  40. BIOMETRIC PUNCH EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS biometric_punch_events (
  id                   CHAR(36)     NOT NULL,
  employee_code        VARCHAR(50)  NOT NULL,
  employee_id          CHAR(36)     NULL,
  device_id            CHAR(36)     NULL,
  device_serial_number VARCHAR(100) NULL,
  punch_timestamp      DATETIME     NOT NULL,
  punch_date           DATE         NOT NULL,
  punch_direction      ENUM('IN', 'OUT', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  temperature          DECIMAL(5,2) NULL,
  temperature_state    VARCHAR(50)  NULL DEFAULT 'Normal',
  source               ENUM('BIOMETRIC', 'MANUAL', 'HYBRID') NOT NULL DEFAULT 'BIOMETRIC',
  external_event_hash  VARCHAR(64)  NOT NULL UNIQUE,
  raw_payload          JSON         NULL,
  processing_status    ENUM('PENDING', 'PROCESSED', 'DUPLICATE', 'UNMAPPED', 'ERROR') NOT NULL DEFAULT 'PENDING',
  processed_at         DATETIME     NULL,
  error_reason         TEXT         NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at           DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_bpe_hash (external_event_hash),
  INDEX idx_bpe_emp_code (employee_code),
  INDEX idx_bpe_emp_id (employee_id),
  INDEX idx_bpe_date (punch_date),
  INDEX idx_bpe_timestamp (punch_timestamp),
  INDEX idx_bpe_status (processing_status),
  INDEX idx_bpe_device (device_serial_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  41. ATTENDANCE SHIFTS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_shifts (
  id                         CHAR(36)     NOT NULL,
  shift_name                 VARCHAR(100) NOT NULL DEFAULT 'General Shift',
  shift_code                 VARCHAR(50)  NOT NULL UNIQUE,
  start_time                 VARCHAR(8)   NOT NULL DEFAULT '10:00:00',
  end_time                   VARCHAR(8)   NOT NULL DEFAULT '18:00:00',
  grace_period_minutes       INT          NOT NULL DEFAULT 10,
  late_after_minutes         INT          NOT NULL DEFAULT 10,
  early_leave_before_minutes INT          NOT NULL DEFAULT 10,
  min_full_day_hours         DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  min_half_day_hours         DECIMAL(4,2) NOT NULL DEFAULT 4.00,
  is_default                 TINYINT(1)   NOT NULL DEFAULT 0,
  is_active                  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                 DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ash_code (shift_code),
  INDEX idx_ash_default (is_default),
  INDEX idx_ash_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  42. ATTENDANCE DAYS (Daily Records)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_days (
  id                  CHAR(36)     NOT NULL,
  employee_id         CHAR(36)     NOT NULL,
  employee_code       VARCHAR(50)  NULL,
  date                DATE         NOT NULL,
  shift_id            CHAR(36)     NULL,
  scheduled_start     VARCHAR(8)   NULL DEFAULT '10:00:00',
  scheduled_end       VARCHAR(8)   NULL DEFAULT '18:00:00',
  first_in            VARCHAR(8)   NULL,
  last_out            VARCHAR(8)   NULL,
  total_work_minutes  INT          NOT NULL DEFAULT 0,
  total_break_minutes INT          NOT NULL DEFAULT 0,
  work_hours          DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  break_hours         DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  late_minutes        INT          NOT NULL DEFAULT 0,
  early_leave_minutes INT          NOT NULL DEFAULT 0,
  overtime_minutes    INT          NOT NULL DEFAULT 0,
  status              ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEK_OFF', 'WORK_FROM_HOME', 'INCOMPLETE', 'EARLY_LEAVE', 'OVERTIME') NOT NULL DEFAULT 'ABSENT',
  source              ENUM('BIOMETRIC', 'MANUAL', 'HYBRID') NOT NULL DEFAULT 'BIOMETRIC',
  is_locked           TINYINT(1)   NOT NULL DEFAULT 0,
  is_corrected        TINYINT(1)   NOT NULL DEFAULT 0,
  remarks             TEXT         NULL,
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_ad_emp_date (employee_id, date),
  INDEX idx_ad_date (date),
  INDEX idx_ad_status (status),
  INDEX idx_ad_source (source),
  CONSTRAINT fk_ad_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ad_shift FOREIGN KEY (shift_id) REFERENCES attendance_shifts(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  43. ATTENDANCE SEGMENTS (Break Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_segments (
  id                CHAR(36)    NOT NULL,
  attendance_day_id CHAR(36)    NOT NULL,
  employee_id       CHAR(36)    NOT NULL,
  segment_type      ENUM('WORK', 'BREAK') NOT NULL DEFAULT 'WORK',
  in_time           DATETIME    NOT NULL,
  out_time          DATETIME    NULL,
  duration_minutes  INT         NOT NULL DEFAULT 0,
  in_event_id       CHAR(36)    NULL,
  out_event_id      CHAR(36)    NULL,
  created_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME    NULL,

  PRIMARY KEY (id),
  INDEX idx_ase_day (attendance_day_id),
  INDEX idx_ase_employee (employee_id),
  INDEX idx_ase_type (segment_type),
  CONSTRAINT fk_ase_day FOREIGN KEY (attendance_day_id) REFERENCES attendance_days(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ase_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  44. ATTENDANCE CORRECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id                CHAR(36)    NOT NULL,
  attendance_day_id CHAR(36)    NULL,
  employee_id       CHAR(36)    NOT NULL,
  correction_date   DATE        NOT NULL,
  original_in       VARCHAR(8)  NULL,
  original_out      VARCHAR(8)  NULL,
  original_status   VARCHAR(50) NULL,
  corrected_in      VARCHAR(8)  NULL,
  corrected_out     VARCHAR(8)  NULL,
  corrected_status  VARCHAR(50) NULL,
  reason            TEXT        NOT NULL,
  requested_by      CHAR(36)    NOT NULL,
  approved_by       CHAR(36)    NULL,
  approved_at       DATETIME    NULL,
  status            ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  rejection_reason  TEXT        NULL,
  created_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME    NULL,

  PRIMARY KEY (id),
  INDEX idx_ac_employee (employee_id),
  INDEX idx_ac_date (correction_date),
  INDEX idx_ac_status (status),
  CONSTRAINT fk_ac_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ac_day FOREIGN KEY (attendance_day_id) REFERENCES attendance_days(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_ac_requester FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ac_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  45. INTEGRATION SYNC STATES
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_sync_states (
  id                         CHAR(36)     NOT NULL,
  integration_name           VARCHAR(100) NOT NULL UNIQUE,
  device_id                  CHAR(36)     NULL,
  last_successful_cursor     DATETIME     NULL,
  last_successful_timestamp  DATETIME     NULL,
  last_attempt_at            DATETIME     NULL,
  last_success_at            DATETIME     NULL,
  last_error                 TEXT         NULL,
  status                     ENUM('healthy', 'degraded', 'failing', 'syncing') NOT NULL DEFAULT 'healthy',
  sync_count                 INT          NOT NULL DEFAULT 0,
  created_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                 DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_iss_name (integration_name),
  INDEX idx_iss_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  46. ATTENDANCE AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id            CHAR(36)     NOT NULL,
  actor_user_id CHAR(36)     NULL,
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(50)  NOT NULL,
  entity_id     VARCHAR(100) NOT NULL,
  before_state  JSON         NULL,
  after_state   JSON         NULL,
  reason        TEXT         NULL,
  ip_address    VARCHAR(45)  NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX idx_aal_actor (actor_user_id),
  INDEX idx_aal_action (action),
  INDEX idx_aal_entity (entity_type, entity_id),
  INDEX idx_aal_created (created_at),
  CONSTRAINT fk_aal_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  47. PRODUCT REVIEWS (Operational Feedback)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_reviews (
  id             CHAR(36)     NOT NULL,
  order_id       CHAR(36)     NULL,
  customer_id    CHAR(36)     NULL,
  customer_name  VARCHAR(150) NULL,
  customer_phone VARCHAR(25)  NULL,
  marketplace    VARCHAR(50)  NOT NULL DEFAULT 'amazon',
  product_sku    VARCHAR(100) NULL,
  product_name   VARCHAR(255) NOT NULL,
  product_rating INT          NULL,
  seller_rating  INT          NULL,
  review_title   VARCHAR(255) NULL,
  review_text    TEXT         NULL,
  screenshot_url VARCHAR(500) NULL,
  status         VARCHAR(50)  NOT NULL DEFAULT 'pending_verification',
  verified_by    CHAR(36)     NULL,
  verified_at    DATETIME     NULL,
  notes          TEXT         NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX idx_pr_order (order_id),
  INDEX idx_pr_customer (customer_id),
  CONSTRAINT fk_pr_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_pr_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_pr_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  48. ACCOUNTING RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS accounting_records (
  id                   CHAR(36)      NOT NULL,
  record_type          VARCHAR(50)   NOT NULL,
  voucher_number       VARCHAR(100)  NULL,
  \`date\`               DATE          NOT NULL,
  party_name           VARCHAR(200)  NULL,
  category             VARCHAR(100)  NULL,
  debit_amount         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  credit_amount        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock_sku            VARCHAR(100)  NULL,
  physical_quantity    INT           NULL,
  book_quantity        INT           NULL,
  discrepancy_quantity INT           NULL,
  reconciled           TINYINT(1)    NOT NULL DEFAULT 0,
  portal_name          VARCHAR(50)   NOT NULL DEFAULT 'Tally',
  remarks              TEXT          NULL,
  created_by           CHAR(36)      NOT NULL,
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at           DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX idx_ar_type (record_type),
  INDEX idx_ar_category (category),
  CONSTRAINT fk_ar_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  49. CHEQUE COLLECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS cheque_collections (
  id             CHAR(36)      NOT NULL,
  customer_name  VARCHAR(150)  NOT NULL,
  customer_phone VARCHAR(25)   NULL,
  order_id       CHAR(36)      NULL,
  cheque_number  VARCHAR(50)   NOT NULL,
  bank_name      VARCHAR(150)  NOT NULL,
  amount         DECIMAL(10,2) NOT NULL,
  cheque_date    DATE          NOT NULL,
  photo_url      VARCHAR(500)  NULL,
  status         VARCHAR(50)   NOT NULL DEFAULT 'assigned_pickup',
  assigned_to    CHAR(36)      NOT NULL,
  collected_at   DATETIME      NULL,
  verified_by    CHAR(36)      NULL,
  verified_at    DATETIME      NULL,
  notes          TEXT          NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX idx_cc_order (order_id),
  INDEX idx_cc_status (status),
  INDEX idx_cc_assigned (assigned_to),
  CONSTRAINT fk_cc_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_cc_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_cc_verifier FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  50. AD CAMPAIGN METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS ad_campaign_metrics (
  id             CHAR(36)      NOT NULL,
  campaign_name  VARCHAR(200)  NOT NULL,
  marketplace    VARCHAR(50)   NOT NULL DEFAULT 'amazon',
  campaign_type  VARCHAR(50)   NOT NULL DEFAULT 'exact',
  target_date    DATE          NOT NULL,
  budget_daily   DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  spend          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sales          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  orders_count   INT           NOT NULL DEFAULT 0,
  impressions    INT           NOT NULL DEFAULT 0,
  clicks         INT           NOT NULL DEFAULT 0,
  ctr_percent    DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  acos_percent   DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
  roas           DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
  status         VARCHAR(50)   NOT NULL DEFAULT 'active',
  bid_status     VARCHAR(100)  NULL,
  recommendation TEXT          NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at     DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX idx_acm_name (campaign_name),
  INDEX idx_acm_date (target_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  51. KEYWORD METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS keyword_metrics (
  id                    CHAR(36)      NOT NULL,
  keyword               VARCHAR(255)  NOT NULL,
  campaign_name         VARCHAR(200)  NOT NULL,
  match_type            VARCHAR(50)   NOT NULL DEFAULT 'exact',
  impressions           INT           NOT NULL DEFAULT 0,
  clicks                INT           NOT NULL DEFAULT 0,
  spend                 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  sales                 DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  orders                INT           NOT NULL DEFAULT 0,
  current_bid           DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  suggested_bid         DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  conversion_rate       DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  is_negative           TINYINT(1)    NOT NULL DEFAULT 0,
  is_migrated_from_auto TINYINT(1)    NOT NULL DEFAULT 0,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX idx_km_keyword (keyword),
  INDEX idx_km_campaign (campaign_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  52. RETURN CLAIMS (Reverse Logistics)
-- ============================================================
CREATE TABLE IF NOT EXISTS return_claims (
  id                      CHAR(36)      NOT NULL,
  marketplace             VARCHAR(50)   NOT NULL DEFAULT 'amazon',
  return_order_number     VARCHAR(100)  NOT NULL,
  product_sku             VARCHAR(100)  NOT NULL,
  product_name            VARCHAR(255)  NOT NULL,
  quantity                INT           NOT NULL DEFAULT 1,
  return_date             DATE          NOT NULL,
  reason                  VARCHAR(255)  NULL,
  customer_calling_status VARCHAR(50)   NOT NULL DEFAULT 'pending_call',
  product_condition       VARCHAR(50)   NOT NULL DEFAULT 'pending_inspection',
  oms_guru_putaway        TINYINT(1)    NOT NULL DEFAULT 0,
  claim_type              VARCHAR(50)   NOT NULL DEFAULT 'none',
  claim_status            VARCHAR(50)   NOT NULL DEFAULT 'not_eligible',
  claim_amount            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  reimbursed_amount       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  handled_by              CHAR(36)      NOT NULL,
  notes                   TEXT          NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at              DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX idx_rc_order_num (return_order_number),
  INDEX idx_rc_sku (product_sku),
  CONSTRAINT fk_rc_handler FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  53. SYSTEM SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  \`key\`       VARCHAR(100) NOT NULL,
  \`value\`     TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME     NULL,

  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  54. RESET AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS reset_audit_logs (
  id                    CHAR(36)     NOT NULL,
  initiated_by_id       CHAR(36)     NOT NULL,
  initiated_by_email    VARCHAR(150) NOT NULL,
  timestamp             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  environment           VARCHAR(50)  NOT NULL,
  records_deleted       JSON         NOT NULL,
  execution_duration_ms INT          NOT NULL,
  status                VARCHAR(50)  NOT NULL,
  failure_reason        TEXT         NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME     NULL,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;`;

  // Inject the new tables right before "SET foreign_key_checks = 1;"
  const hasReplacement = content.includes(insertMarkerTarget);
  if (hasReplacement) {
    content = content.replace(insertMarkerTarget, missingTablesDDL);
    console.log('✅ Injected 20 missing tables DDL schema definitions successfully.');
  } else {
    console.warn('⚠️ Could not find insert marker target in schema file.');
  }

  fs.writeFileSync(sqlPath, content, 'utf8');
  console.log('🎉 001_complete_schema.sql has been synchronized successfully.');
}

if (require.main === module) {
  syncSQLSchema();
}
