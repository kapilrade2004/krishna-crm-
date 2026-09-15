-- ============================================================
--  KRISHNA CRM — MASTER CONSOLIDATED DATABASE SCHEMA
--  Target Engine : MySQL 8.0+ (AWS RDS / Aurora MySQL / EC2)
--  Version       : 2.0.0 (Production Live Release)
--  Charset       : utf8mb4 | Collation: utf8mb4_unicode_ci
--
--  Includes all 34 Core Application Tables + RBAC + Audit +
--  HR + Payroll + Warranty + Activities + Baseline Seeds
--
--  Run on AWS RDS / Local MySQL:
--    mysql -h <AWS_HOST> -u <DB_USER> -p <DB_NAME> < 001_complete_schema.sql
-- ============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET time_zone = '+05:30';
SET foreign_key_checks = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
--  0. SCHEMA MIGRATIONS REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  filename   VARCHAR(255) NOT NULL UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  1. ROLES (RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id          CHAR(36)      NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  description TEXT          NULL,
  data_scope  VARCHAR(50)   NOT NULL DEFAULT 'Global',
  is_system   TINYINT(1)    NOT NULL DEFAULT 0,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name),
  INDEX ix_roles_name (name),
  INDEX ix_roles_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  2. PERMISSIONS (RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id          CHAR(36)      NOT NULL,
  module      VARCHAR(100)  NOT NULL,
  action      VARCHAR(100)  NOT NULL,
  name        VARCHAR(150)  NOT NULL,
  description TEXT          NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_name (name),
  INDEX ix_permissions_module (module),
  INDEX ix_permissions_name (name),
  INDEX ix_permissions_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  3. ROLE PERMISSIONS (RBAC Junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id            CHAR(36)  NOT NULL,
  role_id       CHAR(36)  NOT NULL,
  permission_id CHAR(36)  NOT NULL,
  created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_role_permission (role_id, permission_id),
  INDEX ix_rp_role_id (role_id),
  INDEX ix_rp_permission_id (permission_id),

  CONSTRAINT fk_role_permissions_role
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_role_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  4. USERS (Identity, Security & Profile)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                      CHAR(36)      NOT NULL,
  name                    VARCHAR(100)  NOT NULL,
  email                   VARCHAR(150)  NOT NULL,
  password                VARCHAR(255)  NOT NULL,
  role                    ENUM('super_admin','admin','manager','senior_account_manager','hr','spn_ads_manager','accountant','ecommerce_executive','telecaller','sales','technician','reviewer','delivery_boy','employee','support','ceo') NOT NULL DEFAULT 'sales',
  is_active               TINYINT(1)    NOT NULL DEFAULT 1,
  status                  VARCHAR(30)   NOT NULL DEFAULT 'active',
  first_name              VARCHAR(100)  NULL,
  last_name               VARCHAR(100)  NULL,
  department              VARCHAR(100)  NULL,
  designation             VARCHAR(100)  NULL,
  employee_id             VARCHAR(50)   NULL,
  reporting_manager_id    CHAR(36)      NULL,
  is_locked               TINYINT(1)    NOT NULL DEFAULT 0,
  locked_reason           VARCHAR(255)  NULL,
  locked_at               DATETIME      NULL,
  force_password_reset    TINYINT(1)    NOT NULL DEFAULT 0,
  temp_password_created_at DATETIME     NULL,
  is_deleted              TINYINT(1)    NOT NULL DEFAULT 0,
  refresh_token           TEXT          NULL,
  last_login_at           DATETIME      NULL,
  avatar_url              VARCHAR(500)  NULL,
  phone                   VARCHAR(20)   NULL,
  display_password        VARCHAR(255)  NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at              DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  INDEX ix_users_role (role),
  INDEX ix_users_is_active (is_active),
  INDEX ix_users_status (status),
  INDEX ix_users_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  5. USER PERMISSIONS (Per-User Granular Overrides)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_permissions (
  id            CHAR(36)    NOT NULL,
  user_id       CHAR(36)    NOT NULL,
  permission_id CHAR(36)    NOT NULL,
  is_allowed    TINYINT(1)  NOT NULL DEFAULT 1,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_user_permission (user_id, permission_id),
  INDEX ix_up_user_id (user_id),
  INDEX ix_up_permission_id (permission_id),

  CONSTRAINT fk_user_permissions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_user_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  6. LOGIN HISTORIES (Security & Audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS login_histories (
  id             CHAR(36)     NOT NULL,
  user_id        CHAR(36)     NULL,
  email          VARCHAR(150) NOT NULL,
  login_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address     VARCHAR(45)  NULL,
  user_agent     VARCHAR(500) NULL,
  browser        VARCHAR(100) NULL,
  os             VARCHAR(100) NULL,
  device         VARCHAR(100) NULL,
  status         VARCHAR(30)  NOT NULL DEFAULT 'success',
  failure_reason VARCHAR(255) NULL,
  deleted_at     DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_login_histories_user_id (user_id),
  INDEX idx_login_histories_email (email),
  INDEX idx_login_histories_login_at (login_at),
  INDEX idx_login_histories_status (status),

  CONSTRAINT fk_login_histories_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  7. USER AUDIT LOGS (Management Audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_audit_logs (
  id             CHAR(36)     NOT NULL,
  actor_user_id  CHAR(36)     NULL,
  target_user_id CHAR(36)     NULL,
  event_type     VARCHAR(100) NOT NULL,
  module         VARCHAR(50)  NOT NULL DEFAULT 'user_management',
  old_values     JSON         NULL,
  new_values     JSON         NULL,
  ip_address     VARCHAR(45)  NULL,
  user_agent     VARCHAR(500) NULL,
  deleted_at     DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_user_audit_logs_actor_user_id (actor_user_id),
  INDEX idx_user_audit_logs_target_user_id (target_user_id),
  INDEX idx_user_audit_logs_event_type (event_type),
  INDEX idx_user_audit_logs_module (module),
  INDEX idx_user_audit_logs_created_at (created_at),

  CONSTRAINT fk_user_audit_logs_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_user_audit_logs_target
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  8. ACCESS TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS access_templates (
  id          CHAR(36)      NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  description VARCHAR(255)  NULL,
  role_id     CHAR(36)      NULL,
  permissions JSON          NULL,
  created_by  CHAR(36)      NULL,
  deleted_at  DATETIME      NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_access_templates_name (name),
  INDEX idx_access_templates_role_id (role_id),
  INDEX idx_access_templates_created_by (created_by),

  CONSTRAINT fk_access_templates_role
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_access_templates_creator
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  9. ACCESS REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS access_requests (
  id                    CHAR(36)    NOT NULL,
  user_id               CHAR(36)    NOT NULL,
  requested_permissions JSON        NOT NULL,
  reason                TEXT        NULL,
  status                ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by           CHAR(36)    NULL,
  reviewed_at           DATETIME    NULL,
  rejection_reason      TEXT        NULL,
  deleted_at            DATETIME    NULL,
  created_at            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_access_requests_user_id (user_id),
  INDEX idx_access_requests_reviewed_by (reviewed_by),
  INDEX idx_access_requests_status (status),

  CONSTRAINT fk_access_requests_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_access_requests_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  10. CUSTOMERS (CRM Master)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id                        CHAR(36)      NOT NULL,
  name                      VARCHAR(150)  NOT NULL,
  email                     VARCHAR(150)  NULL,
  phone                     VARCHAR(20)   NULL,
  whatsapp_number           VARCHAR(20)   NULL,
  address_line1             VARCHAR(255)  NULL,
  address_line2             VARCHAR(255)  NULL,
  city                      VARCHAR(100)  NULL,
  state                     VARCHAR(100)  NULL,
  pincode                   VARCHAR(10)   NULL,
  country                   VARCHAR(100)  NOT NULL DEFAULT 'India',
  source                    ENUM('amazon','flipkart','indiamart','akuabeat_website','website','direct','other') NOT NULL DEFAULT 'other',
  status                    ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  lifecycle_stage           ENUM('prospect','customer','installation_pending','installation_done','feedback_pending','engaged') NOT NULL DEFAULT 'prospect',
  installation_sent_at      DATETIME      NULL,
  installation_confirmed_at DATETIME      NULL,
  feedback_collected_at     DATETIME      NULL,
  engagement_notes          TEXT          NULL,
  tags                      JSON          NULL,
  notes                     TEXT          NULL,
  total_orders              INT           NOT NULL DEFAULT 0,
  total_revenue             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  assigned_to               CHAR(36)      NULL,
  whatsapp_opt_in           TINYINT(1)    NOT NULL DEFAULT 0,
  last_contacted_at         DATETIME      NULL,
  installation_help_requested TINYINT(1) NOT NULL DEFAULT 0,
  installation_help_requested_at DATETIME NULL,
  installation_help_status VARCHAR(50) NULL DEFAULT 'pending',
  installation_notes TEXT NULL,
  created_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX ix_customers_phone (phone),
  INDEX ix_customers_email (email),
  INDEX ix_customers_source (source),
  INDEX ix_customers_status (status),
  INDEX ix_customers_lifecycle_stage (lifecycle_stage),
  INDEX ix_customers_assigned_to (assigned_to),
  INDEX ix_customers_pincode (pincode),
  INDEX ix_customers_deleted (deleted_at),

  CONSTRAINT fk_customers_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  11. CSV IMPORT BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS csv_import_batches (
  id              CHAR(36)      NOT NULL,
  uploaded_by     CHAR(36)      NOT NULL,
  marketplace     ENUM('amazon','flipkart','indiamart','akuabeat_website','website','direct','other') NOT NULL,
  channel         VARCHAR(100)  NULL,
  filename        VARCHAR(255)  NOT NULL,
  file_path       VARCHAR(500)  NOT NULL,
  status          ENUM('uploaded','processing','completed','failed','partial') NOT NULL DEFAULT 'uploaded',
  total_rows      INT           NOT NULL DEFAULT 0,
  processed_rows  INT           NOT NULL DEFAULT 0,
  success_rows    INT           NOT NULL DEFAULT 0,
  failed_rows     INT           NOT NULL DEFAULT 0,
  duplicate_rows  INT           NOT NULL DEFAULT 0,
  error_log       JSON          NULL,
  processed_at    DATETIME      NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX ix_csv_uploaded_by (uploaded_by),
  INDEX ix_csv_marketplace (marketplace),
  INDEX ix_csv_status (status),
  INDEX ix_csv_deleted (deleted_at),

  CONSTRAINT fk_csv_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  12. SHIPPING PARTNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS shipping_partners (
  id                    CHAR(36)      NOT NULL,
  name                  VARCHAR(100)  NOT NULL,
  code                  VARCHAR(20)   NOT NULL,
  contact_person        VARCHAR(100)  NULL,
  contact_phone         VARCHAR(20)   NULL,
  contact_email         VARCHAR(150)  NULL,
  tracking_url_template VARCHAR(500)  NULL,
  default_tat_days      INT           NULL,
  is_active             TINYINT(1)    NOT NULL DEFAULT 1,
  notes                 TEXT          NULL,
  api_config            JSON          NULL,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_shipping_partners_name (name),
  UNIQUE KEY uq_shipping_partners_code (code),
  INDEX ix_shipping_partners_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  13. PINCODE SERVICEABILITY
-- ============================================================
CREATE TABLE IF NOT EXISTS pincode_serviceability (
  id                   CHAR(36)     NOT NULL,
  pincode              VARCHAR(10)  NOT NULL,
  city                 VARCHAR(100) NULL,
  state                VARCHAR(100) NULL,
  shipping_partner_id  CHAR(36)     NULL,
  is_serviceable       TINYINT(1)   NOT NULL DEFAULT 1,
  tat_days             INT          NOT NULL,
  cod_available        TINYINT(1)   NOT NULL DEFAULT 1,
  notes                TEXT         NULL,
  deleted_at           DATETIME     NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_pincode_partner (pincode, shipping_partner_id),
  INDEX ix_pincode_serviceability_pincode (pincode),
  INDEX ix_pincode_serviceability_partner (shipping_partner_id),

  CONSTRAINT fk_pincode_serviceability_partner
    FOREIGN KEY (shipping_partner_id) REFERENCES shipping_partners(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  14. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                          CHAR(36)       NOT NULL,
  order_number                VARCHAR(100)   NOT NULL,
  marketplace_order_id        VARCHAR(150)   NULL,
  marketplace                 ENUM('amazon','flipkart','indiamart','akuabeat_website','website','direct','other') NOT NULL DEFAULT 'direct',
  channel                     VARCHAR(100)   NULL,
  customer_id                 CHAR(36)       NOT NULL,

  -- Status & Verification
  status                      ENUM(
                                'pending','image_verification','pending_confirmation','confirmed','processing',
                                'dispatched','delivered','cancelled','returned','refunded'
                              ) NOT NULL DEFAULT 'pending',
  verification_status         ENUM(
                                'pending_verification','screenshot_requested','image_received','verification_in_review',
                                'sku_matched','sku_mismatched','image_unreadable',
                                'product_not_found','pending_confirmation','confirmed',
                                'cancelled','verification_exception'
                              ) NOT NULL DEFAULT 'pending_verification',
  workflow_state              VARCHAR(50)    NOT NULL DEFAULT 'PENDING_VERIFICATION',
  whatsapp_batch_id           CHAR(36)       NULL,
  verified_by                 CHAR(36)       NULL,
  verified_at                 DATETIME       NULL,
  verification_notes          TEXT           NULL,
  matched_at                  DATETIME       NULL,
  matched_by                  CHAR(36)       NULL,
  confirmation_sent_at        DATETIME       NULL,
  final_confirmation_sent_at  DATETIME       NULL,
  customer_confirmed_at       DATETIME       NULL,
  customer_cancelled_at       DATETIME       NULL,
  cancelled_at                DATETIME       NULL,
  cancel_reason               VARCHAR(255)   NULL,
  screenshot_requested_at     DATETIME       NULL,
  screenshot_deadline_at      DATETIME       NULL,
  screenshot_received_at      DATETIME       NULL,
  second_message_due_at       DATETIME       NULL,
  second_message_sent_at      DATETIME       NULL,
  confirmation_message_sent_at DATETIME      NULL,
  delivered_message_sent_at   DATETIME       NULL,

  -- Message Correlation IDs
  message_1_id                VARCHAR(150)   NULL,
  screenshot_message_id       VARCHAR(150)   NULL,
  message_2_id                VARCHAR(150)   NULL,
  final_confirmation_message_id VARCHAR(150) NULL,
  cancelled_message_id        VARCHAR(150)   NULL,

  -- Processing Flow
  flow_stage                  ENUM(
                                'ask_images','match_pending','match_confirmed',
                                'match_alternate','match_reorder','match_cancelled',
                                'processing','delivery_confirmed','installation',
                                'feedback_pending','completed'
                              ) NOT NULL DEFAULT 'ask_images',
  images_provided             TINYINT(1)     NOT NULL DEFAULT 0,
  image_rejection_reason      VARCHAR(500)   NULL,

  -- Product & Pricing
  product_name                VARCHAR(255)   NULL,
  product_sku                 VARCHAR(100)   NULL,
  quantity                    INT            NOT NULL DEFAULT 1,
  unit_price                  DECIMAL(10,2)  NULL,
  total_amount                DECIMAL(12,2)  NULL,
  discount_amount             DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  shipping_charge             DECIMAL(10,2)  NOT NULL DEFAULT 0.00,

  -- Shipping & Delivery
  shipping_partner            VARCHAR(100)   NULL,
  tracking_number             VARCHAR(150)   NULL,
  shipping_address            JSON           NULL,
  delivery_pincode            VARCHAR(10)    NULL,
  estimated_delivery_date     DATE           NULL,
  latest_ship_date            DATETIME       NULL,
  earliest_delivery_date      DATETIME       NULL,
  dispatched_at               DATETIME       NULL,
  delivered_at                DATETIME       NULL,

  -- WhatsApp Automation Flags
  whatsapp_confirmation_sent  TINYINT(1)     NOT NULL DEFAULT 0,
  whatsapp_dispatch_sent      TINYINT(1)     NOT NULL DEFAULT 0,
  whatsapp_delivery_sent      TINYINT(1)     NOT NULL DEFAULT 0,

  -- Internal & Feedback
  assigned_to                 CHAR(36)       NULL,
  internal_notes              TEXT           NULL,
  customer_feedback           TEXT           NULL,
  feedback_rating             TINYINT        NULL,
  feedback_status             ENUM('not_collected','happy','unhappy','escalated','resolved') NOT NULL DEFAULT 'not_collected',
  feedback_issue_notes        TEXT           NULL,
  import_batch_id             CHAR(36)       NULL,
  raw_csv_data                JSON           NULL,
  order_date                  DATE           NULL,

  created_at                  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME       NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_number (order_number),
  INDEX ix_orders_marketplace_order_id (marketplace_order_id),
  INDEX ix_orders_marketplace (marketplace),
  INDEX ix_orders_customer_id (customer_id),
  INDEX ix_orders_status (status),
  INDEX ix_orders_workflow_state (workflow_state),
  INDEX ix_orders_whatsapp_batch_id (whatsapp_batch_id),
  INDEX ix_orders_flow_stage (flow_stage),
  INDEX ix_orders_verification_status (verification_status),
  INDEX ix_orders_verified_by (verified_by),
  INDEX ix_orders_matched_by (matched_by),
  INDEX ix_orders_screenshot_deadline (screenshot_deadline_at),
  INDEX ix_orders_assigned_to (assigned_to),
  INDEX ix_orders_import_batch_id (import_batch_id),
  INDEX ix_orders_order_date (order_date),
  INDEX ix_orders_delivery_pincode (delivery_pincode),
  INDEX ix_orders_latest_ship_date (latest_ship_date),
  INDEX ix_orders_earliest_delivery_date (earliest_delivery_date),
  INDEX ix_orders_feedback_status (feedback_status),
  INDEX ix_orders_deleted (deleted_at),
  INDEX ix_orders_status_date (status, order_date),
  INDEX ix_orders_marketplace_status (marketplace, status),

  CONSTRAINT fk_orders_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_matched_by
    FOREIGN KEY (matched_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_import_batch_id
    FOREIGN KEY (import_batch_id) REFERENCES csv_import_batches(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  15. ORDER ACTIVITIES (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_activities (
  id          CHAR(36)      NOT NULL,
  order_id    CHAR(36)      NOT NULL,
  user_id     CHAR(36)      NULL,
  action      VARCHAR(100)  NOT NULL,
  from_value  VARCHAR(100)  NULL,
  to_value    VARCHAR(100)  NULL,
  note        TEXT          NULL,
  metadata    JSON          NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX ix_order_activities_order_id (order_id),
  INDEX ix_order_activities_user_id (user_id),
  INDEX ix_order_activities_action (action),

  CONSTRAINT fk_oa_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_oa_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  15B. ORDER EVENTS (Canonical State Machine & Workflow Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_events (
  id              CHAR(36)      NOT NULL,
  order_id        CHAR(36)      NOT NULL,
  customer_id     CHAR(36)      NULL,
  event_type      VARCHAR(100)  NOT NULL,
  source          VARCHAR(100)  NOT NULL DEFAULT 'system',
  actor_type      VARCHAR(50)   NOT NULL DEFAULT 'user',
  actor_id        VARCHAR(150)  NULL,
  actor           VARCHAR(150)  NULL,
  previous_state  VARCHAR(100)  NULL,
  before_state    VARCHAR(100)  NULL,
  new_state       VARCHAR(100)  NULL,
  after_state     VARCHAR(100)  NULL,
  correlation_id  VARCHAR(150)  NULL,
  metadata        JSON          NULL,
  timestamp       DATETIME      NULL DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_order_events_order_id (order_id),
  INDEX idx_order_events_customer_id (customer_id),
  INDEX idx_order_events_event_type (event_type),
  INDEX idx_order_events_correlation_id (correlation_id),
  INDEX idx_order_events_created_at (created_at),

  CONSTRAINT fk_order_events_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_events_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  16. FOLLOW-UPS
-- ============================================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id               CHAR(36)     NOT NULL,
  customer_id      CHAR(36)     NOT NULL,
  order_id         CHAR(36)     NULL,
  assigned_to      CHAR(36)     NOT NULL,
  type             ENUM('call','whatsapp','email','visit','other') NOT NULL DEFAULT 'call',
  status           ENUM('pending','in_progress','completed','cancelled','rescheduled') NOT NULL DEFAULT 'pending',
  priority         ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  subject          VARCHAR(255) NOT NULL,
  notes            TEXT         NULL,
  outcome          TEXT         NULL,
  due_at           DATETIME     NOT NULL,
  completed_at     DATETIME     NULL,
  next_followup_at DATETIME     NULL,
  reminder_sent    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX ix_fu_customer_id (customer_id),
  INDEX ix_fu_order_id (order_id),
  INDEX ix_fu_assigned_to (assigned_to),
  INDEX ix_fu_status (status),
  INDEX ix_fu_due_at (due_at),
  INDEX ix_fu_deleted (deleted_at),
  INDEX ix_fu_agent_status_due (assigned_to, status, due_at),

  CONSTRAINT fk_fu_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_fu_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_fu_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  17. TASKS (with Quality Scoring)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id               CHAR(36)     NOT NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT         NULL,
  assigned_to      CHAR(36)     NOT NULL,
  created_by       CHAR(36)     NOT NULL,
  customer_id      CHAR(36)     NULL,
  order_id         CHAR(36)     NULL,
  status           ENUM('todo','in_progress','review','done','cancelled') NOT NULL DEFAULT 'todo',
  priority         ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  due_date         DATE         NULL,
  completed_at     DATETIME     NULL,
  tags             JSON         NULL,
  notes            TEXT         NULL,
  progress_percent TINYINT      NOT NULL DEFAULT 0,
  score            TINYINT      NULL,
  score_comment    TEXT         NULL,
  scored_by        CHAR(36)     NULL,
  scored_at        DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX ix_tasks_assigned_to (assigned_to),
  INDEX ix_tasks_created_by (created_by),
  INDEX ix_tasks_status (status),
  INDEX ix_tasks_priority (priority),
  INDEX ix_tasks_due_date (due_date),
  INDEX ix_tasks_customer_id (customer_id),
  INDEX ix_tasks_order_id (order_id),
  INDEX ix_tasks_score (score),
  INDEX ix_tasks_scored_by (scored_by),
  INDEX ix_tasks_deleted (deleted_at),
  INDEX ix_tasks_agent_status_due (assigned_to, status, due_date),
  INDEX ix_tasks_assigned_score (assigned_to, score),

  CONSTRAINT fk_tasks_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_scored_by
    FOREIGN KEY (scored_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  18. MANUAL CALL LOGS (Rep Telecalling Records)
-- ============================================================
CREATE TABLE IF NOT EXISTS manual_call_logs (
  id               CHAR(36)     NOT NULL,
  order_id         CHAR(36)     NULL,
  customer_id      CHAR(36)     NOT NULL,
  user_id          CHAR(36)     NOT NULL,
  call_type        ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
  phone_used       VARCHAR(20)  NULL,
  duration_seconds INT          NULL,
  outcome          ENUM('answered','no_answer','busy','callback_requested','confirmed','rejected','escalated') NOT NULL DEFAULT 'answered',
  context          ENUM('image_collection','reorder_assistance','feedback_resolution','general') NOT NULL DEFAULT 'general',
  notes            TEXT         NULL,
  called_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX ix_call_logs_order_id (order_id),
  INDEX ix_call_logs_customer_id (customer_id),
  INDEX ix_call_logs_user_id (user_id),
  INDEX ix_call_logs_outcome (outcome),
  INDEX ix_call_logs_called_at (called_at),

  CONSTRAINT fk_call_logs_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_call_logs_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_call_logs_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  19. CUSTOMER IMAGES (Inbound WhatsApp Product Verification)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_images (
  id               CHAR(36)      NOT NULL,
  order_id         CHAR(36)      NULL,
  customer_id      CHAR(36)      NULL,
  wa_message_id    VARCHAR(150)  NULL,
  media_id         VARCHAR(150)  NULL,
  category         VARCHAR(50)   NOT NULL DEFAULT 'other',
  caption          VARCHAR(255)  NULL,
  file_url         VARCHAR(1000) NULL,
  mime_type        VARCHAR(100)  NULL,
  file_size        INT           NULL,
  s3_key           VARCHAR(500)  NULL,
  is_verified      TINYINT(1)    NOT NULL DEFAULT 0,
  status           ENUM('received','approved','rejected') NOT NULL DEFAULT 'received',
  reviewed_by      CHAR(36)      NULL,
  reviewed_at      DATETIME      NULL,
  rejection_reason VARCHAR(500)  NULL,
  uploaded_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX ix_customer_images_order_id (order_id),
  INDEX ix_customer_images_customer_id (customer_id),
  INDEX ix_customer_images_status (status),
  INDEX ix_customer_images_wa_msg_id (wa_message_id),

  CONSTRAINT fk_cust_images_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_cust_images_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_cust_images_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  20. WHATSAPP LOGS (Automated & Manual Message History)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id            CHAR(36)      NOT NULL,
  customer_id   CHAR(36)      NULL,
  order_id      CHAR(36)      NULL,
  batch_id      CHAR(36)      NULL,
  phone_number  VARCHAR(20)   NOT NULL,
  message_type  ENUM('template','text','media','interactive','image','document','audio','video') NOT NULL DEFAULT 'template',
  template_name VARCHAR(100)  NULL,
  direction     ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
  status        ENUM('queued','sent','delivered','read','failed','paused') NOT NULL DEFAULT 'queued',
  wa_message_id VARCHAR(150)  NULL,
  payload       JSON          NULL,
  error_message TEXT          NULL,
  sent_at       DATETIME      NULL,
  delivered_at  DATETIME      NULL,
  read_at       DATETIME      NULL,
  failed_at     DATETIME      NULL,
  retry_count   INT           NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  actual_cost   DECIMAL(10,2) NULL,
  cost_currency VARCHAR(10)   NOT NULL DEFAULT 'INR',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX ix_wa_phone_number (phone_number),
  INDEX ix_wa_order_id (order_id),
  INDEX ix_wa_customer_id (customer_id),
  INDEX ix_wa_status (status),
  INDEX ix_wa_direction (direction),
  INDEX ix_wa_wa_message_id (wa_message_id),
  INDEX ix_wa_order_sent (order_id, sent_at),
  INDEX idx_wal_status_sent (status, sent_at),
  INDEX idx_wal_created_at (created_at),
  INDEX idx_wal_template_sent (template_name, sent_at),
  INDEX idx_wal_batch_id (batch_id),

  CONSTRAINT fk_wa_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_wa_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_wa_batch_id
    FOREIGN KEY (batch_id) REFERENCES whatsapp_batches(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  21. EMPLOYEES (HR Directory & Lifecycle)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id                         CHAR(36)      NOT NULL,
  user_id                    CHAR(36)      NULL,
  employee_code              VARCHAR(30)   NULL,
  smartoffice_employee_code  VARCHAR(50)   NULL,
  first_name                 VARCHAR(100)  NOT NULL,
  last_name                  VARCHAR(100)  NOT NULL,
  email                      VARCHAR(150)  NULL,
  phone                      VARCHAR(20)   NULL,
  avatar_url                 VARCHAR(500)  NULL,
  status                     ENUM('active','inactive','terminated') NOT NULL DEFAULT 'active',
  onboarding_status          VARCHAR(30)   NOT NULL DEFAULT 'pending',
  date_of_birth              DATE          NULL,
  gender                     ENUM('male','female','other') NULL,
  blood_group                VARCHAR(5)    NULL,
  personal_email             VARCHAR(150)  NULL,
  personal_phone             VARCHAR(20)   NULL,
  present_address            TEXT          NULL,
  permanent_address          TEXT          NULL,
  department                 VARCHAR(100)  NULL,
  designation                VARCHAR(100)  NULL,
  date_of_joining            DATE          NULL,
  date_of_leaving            DATE          NULL,
  probation_end_date         DATE          NULL,
  confirmation_date          DATE          NULL,
  exit_date                  DATE          NULL,
  exit_reason                VARCHAR(255)  NULL,
  handover_notes             TEXT          NULL,
  offboarded_by              CHAR(36)      NULL,
  offboarded_at              DATETIME      NULL,
  employment_type            ENUM('full_time','part_time','contract','intern') NOT NULL DEFAULT 'full_time',
  reporting_manager          VARCHAR(100)  NULL,
  reporting_manager_id       CHAR(36)      NULL,
  work_location              VARCHAR(100)  NULL,
  salary                     DECIMAL(12,2) NULL,
  bank_name                  VARCHAR(100)  NULL,
  bank_account_number        VARCHAR(30)   NULL,
  bank_ifsc                  VARCHAR(20)   NULL,
  pan_number                 VARCHAR(20)   NULL,
  aadhaar_last4              VARCHAR(4)    NULL,
  uan_number                 VARCHAR(20)   NULL,
  emergency_contact_name     VARCHAR(100)  NULL,
  emergency_contact_phone    VARCHAR(20)   NULL,
  emergency_contact_relation VARCHAR(50)   NULL,
  notes                      TEXT          NULL,
  created_by                 CHAR(36)      NULL,
  created_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                 DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_code (employee_code),
  UNIQUE KEY uq_employees_email (email),
  INDEX ix_employees_status (status),
  INDEX ix_employees_onboarding_status (onboarding_status),
  INDEX ix_employees_department (department),
  INDEX ix_employees_employee_code (employee_code),
  INDEX ix_employees_smartoffice_code (smartoffice_employee_code),
  INDEX ix_employees_user_id (user_id),
  INDEX ix_employees_reporting_manager_id (reporting_manager_id),
  INDEX ix_employees_deleted (deleted_at),

  CONSTRAINT fk_employees_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_employees_reporting_mgr
    FOREIGN KEY (reporting_manager_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  22. EMPLOYEE DOCUMENTS (Document Center & KYC)
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_documents (
  id                  CHAR(36)      NOT NULL,
  employee_id         CHAR(36)      NOT NULL,
  document_type       VARCHAR(50)   NOT NULL DEFAULT 'other',
  document_name       VARCHAR(200)  NOT NULL,
  original_name       VARCHAR(300)  NOT NULL,
  file_path           VARCHAR(1000) NOT NULL,
  file_size           INT           NOT NULL,
  mime_type           VARCHAR(100)  NOT NULL,
  status              VARCHAR(30)   NOT NULL DEFAULT 'uploaded',
  version             INT           NOT NULL DEFAULT 1,
  is_current          TINYINT(1)    NOT NULL DEFAULT 1,
  replaced_by         CHAR(36)      NULL,
  verified_by         CHAR(36)      NULL,
  verified_at         DATETIME      NULL,
  rejection_reason    VARCHAR(500)  NULL,
  remarks             TEXT          NULL,
  review_requested_at DATETIME      NULL,
  expiry_date         DATE          NULL,
  notes               TEXT          NULL,
  uploaded_by         CHAR(36)      NOT NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX ix_employee_docs_employee_id (employee_id),
  INDEX ix_employee_docs_status (status),
  INDEX ix_employee_docs_is_current (is_current),

  CONSTRAINT fk_employee_docs_employee_id
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_employee_docs_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_employee_docs_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  23. PAYROLL PROFILES (Salary Structure)
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_profiles (
  id                     CHAR(36)      NOT NULL,
  employee_id            CHAR(36)      NOT NULL,
  salary_type            VARCHAR(30)   NOT NULL DEFAULT 'monthly',
  basic_salary           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  fixed_allowances       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  fixed_deductions       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_payable_reference  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  effective_from         DATE          NULL,
  payment_method         VARCHAR(50)   NOT NULL DEFAULT 'bank_transfer',
  bank_account_reference VARCHAR(100)  NULL,
  bank_name              VARCHAR(100)  NULL,
  bank_ifsc              VARCHAR(50)   NULL,
  pan_number             VARCHAR(30)   NULL,
  status                 VARCHAR(30)   NOT NULL DEFAULT 'active',
  notes                  TEXT          NULL,
  created_by             CHAR(36)      NULL,
  updated_by             CHAR(36)      NULL,
  created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at             DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_profiles_employee (employee_id),
  INDEX ix_payroll_profiles_status (status),

  CONSTRAINT fk_payroll_profiles_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  24. PAYROLL RECORDS (Monthly Payslips & Disbursals)
-- ============================================================
CREATE TABLE IF NOT EXISTS payroll_records (
  id                    CHAR(36)      NOT NULL,
  employee_id           CHAR(36)      NOT NULL,
  payroll_month         VARCHAR(7)    NOT NULL,
  gross_amount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  allowances            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  deductions            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_amount            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_status        VARCHAR(30)   NOT NULL DEFAULT 'draft',
  processed_by          CHAR(36)      NULL,
  processed_at          DATETIME      NULL,
  payment_method        VARCHAR(50)   NOT NULL DEFAULT 'bank_transfer',
  transaction_reference VARCHAR(100)  NULL,
  remarks               TEXT          NULL,
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX idx_payroll_records_emp_month (employee_id, payroll_month),
  INDEX idx_payroll_records_month (payroll_month),
  INDEX idx_payroll_records_status (payment_status),

  CONSTRAINT fk_payroll_records_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payroll_records_processor
    FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  25. EMPLOYEE AUDIT EVENTS (HR & Operational Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_audit_events (
  id            CHAR(36)      NOT NULL,
  employee_id   CHAR(36)      NOT NULL,
  user_id       CHAR(36)      NULL,
  actor_user_id CHAR(36)      NULL,
  event_type    VARCHAR(100)  NOT NULL,
  module        VARCHAR(50)   NOT NULL,
  entity_type   VARCHAR(50)   NULL,
  entity_id     CHAR(36)      NULL,
  metadata      JSON          NULL,
  old_values    JSON          NULL,
  new_values    JSON          NULL,
  ip_address    VARCHAR(45)   NULL,
  deleted_at    DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_eae_employee_id (employee_id),
  INDEX idx_eae_user_id (user_id),
  INDEX idx_eae_event_type (event_type),
  INDEX idx_eae_module (module),
  INDEX idx_eae_created_at (created_at),

  CONSTRAINT fk_eae_employee_id
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_eae_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_eae_actor_user_id
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  26. EMPLOYEE AUDIT DAILY SUMMARIES (Performance Aggregation)
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_audit_daily_summaries (
  id                            CHAR(36)      NOT NULL,
  employee_id                   CHAR(36)      NOT NULL,
  user_id                       CHAR(36)      NULL,
  date                          DATE          NOT NULL,
  present                       TINYINT(1)    NOT NULL DEFAULT 0,
  late                          TINYINT(1)    NOT NULL DEFAULT 0,
  `leave`                       TINYINT(1)    NOT NULL DEFAULT 0,
  half_day                      TINYINT(1)    NOT NULL DEFAULT 0,
  work_hours                    DECIMAL(4,2)  NOT NULL DEFAULT 0.00,

  -- Offline / Sales Executive metrics
  customer_interactions         INT           NOT NULL DEFAULT 0,
  new_customers                 INT           NOT NULL DEFAULT 0,
  followups_created             INT           NOT NULL DEFAULT 0,
  followups_completed           INT           NOT NULL DEFAULT 0,
  calls_logged                  INT           NOT NULL DEFAULT 0,
  orders_created                INT           NOT NULL DEFAULT 0,
  orders_completed              INT           NOT NULL DEFAULT 0,
  units_sold                    INT           NOT NULL DEFAULT 0,
  revenue                       DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  tasks_assigned                INT           NOT NULL DEFAULT 0,
  tasks_completed               INT           NOT NULL DEFAULT 0,
  daily_tasks_assigned          INT           NOT NULL DEFAULT 0,
  daily_tasks_completed         INT           NOT NULL DEFAULT 0,

  -- Technician / Field metrics
  jobs_assigned                 INT           NOT NULL DEFAULT 0,
  jobs_accepted                 INT           NOT NULL DEFAULT 0,
  jobs_completed                INT           NOT NULL DEFAULT 0,
  pending_jobs                  INT           NOT NULL DEFAULT 0,
  installations                 INT           NOT NULL DEFAULT 0,
  repairs                       INT           NOT NULL DEFAULT 0,
  maintenance_visits            INT           NOT NULL DEFAULT 0,
  customer_visits               INT           NOT NULL DEFAULT 0,
  total_completion_time_minutes INT           NOT NULL DEFAULT 0,

  created_at                    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                    DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_eads_emp_date (employee_id, date),
  INDEX idx_eads_employee_date (employee_id, date),
  INDEX idx_eads_deleted (deleted_at),

  CONSTRAINT fk_eads_employee_id
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  27. WARRANTIES (Product Warranty Registry)
-- ============================================================
CREATE TABLE IF NOT EXISTS warranties (
  id                    CHAR(36)     NOT NULL,
  warranty_number       VARCHAR(50)  NOT NULL,
  customer_id           CHAR(36)     NOT NULL,
  order_id              CHAR(36)     NULL,
  product_id            CHAR(36)     NULL,
  product_name_snapshot VARCHAR(255) NOT NULL,
  brand_snapshot        VARCHAR(100) NULL,
  model_snapshot        VARCHAR(100) NULL,
  marketplace           VARCHAR(100) NULL,
  purchase_date         DATE         NOT NULL,
  warranty_start_date   DATE         NOT NULL,
  warranty_end_date     DATE         NOT NULL,
  status                VARCHAR(30)  NOT NULL DEFAULT 'PENDING_VERIFICATION',
  verification_status   VARCHAR(30)  NOT NULL DEFAULT 'PENDING',
  registration_source   VARCHAR(50)  NOT NULL DEFAULT 'WEBSITE_FORM',
  terms_accepted        TINYINT(1)   NOT NULL DEFAULT 1,
  privacy_accepted      TINYINT(1)   NOT NULL DEFAULT 1,
  registered_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at           DATETIME     NULL,
  verified_by           CHAR(36)     NULL,
  rejection_reason      TEXT         NULL,
  order_item_id VARCHAR(100) NULL,
  serial_number VARCHAR(100) NULL,
  unit_identifier VARCHAR(100) NULL,
  delivery_id VARCHAR(100) NULL,
  delivery_partner VARCHAR(100) NULL,
  tracking_number VARCHAR(150) NULL,
  delivered_at DATETIME NULL,
  installation_id VARCHAR(100) NULL,
  installation_completed_at DATETIME NULL,
  activation_due_at DATETIME NULL,
  activation_message_id VARCHAR(100) NULL,
  activation_sent_at DATETIME NULL,
  activated_at DATETIME NULL,
  warranty_start_at DATETIME NULL,
  warranty_end_at DATETIME NULL,
  warranty_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_DELIVERY',
  return_status VARCHAR(50) NOT NULL DEFAULT 'NONE',
  return_requested_at DATETIME NULL,
  returned_at DATETIME NULL,
  returned_reason TEXT NULL,
  return_id CHAR(36) NULL,
  cancellation_reason TEXT NULL,
  warranty_activation_date DATETIME NULL,
  warranty_expiry_date DATETIME NULL,
  warranty_reset_date DATETIME NULL,
  warranty_reset_by CHAR(36) NULL,
  warranty_reset_reason TEXT NULL,
  product_sku           VARCHAR(100) NULL,
  product_name          VARCHAR(255) NULL,
  customer_name         VARCHAR(150) NULL,
  customer_phone        VARCHAR(30)  NULL,
  customer_email        VARCHAR(150) NULL,
  channel               VARCHAR(50)  NULL,
  warranty_period_months INT         NULL DEFAULT 12,
  activation_token      VARCHAR(255) NULL,
  activation_token_expires_at DATETIME NULL,
  invoice_verified      TINYINT(1)   NOT NULL DEFAULT 0,
  invoice_url           VARCHAR(500) NULL,
  invoice_number        VARCHAR(100) NULL,
  notes                 TEXT         NULL,
  is_returned TINYINT(1) NOT NULL DEFAULT 0,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_warranties_number (warranty_number),
  INDEX idx_warranties_customer_id (customer_id),
  INDEX idx_warranties_order_id (order_id),
  INDEX idx_warranties_number (warranty_number),
  INDEX idx_warranties_status (status),

  CONSTRAINT fk_warranties_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_warranties_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_warranties_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  28. WARRANTY DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS warranty_documents (
  id            CHAR(36)     NOT NULL,
  warranty_id   CHAR(36)     NOT NULL,
  document_type VARCHAR(50)  NOT NULL DEFAULT 'PURCHASE_INVOICE',
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_size     INT          NULL,
  mime_type     VARCHAR(100) NULL,
  uploaded_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX idx_warranty_docs_warranty_id (warranty_id),

  CONSTRAINT fk_warranty_docs_warranty_id
    FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  29. WARRANTY SERVICE REQUESTS (RMA & Field Tickets)
-- ============================================================
CREATE TABLE IF NOT EXISTS warranty_service_requests (
  id                     CHAR(36)     NOT NULL,
  service_request_number VARCHAR(50)  NOT NULL,
  warranty_id            CHAR(36)     NOT NULL,
  customer_id            CHAR(36)     NOT NULL,
  technician_id          CHAR(36)     NULL,
  created_by             CHAR(36)     NULL,
  issue                  VARCHAR(255) NOT NULL,
  description            TEXT         NULL,
  priority               VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
  status                 VARCHAR(30)  NOT NULL DEFAULT 'NEW',
  assigned_at            DATETIME     NULL,
  scheduled_at           DATETIME     NULL,
  started_at             DATETIME     NULL,
  completed_at           DATETIME     NULL,
  resolution             TEXT         NULL,
  parts_used             TEXT         NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at             DATETIME     NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_service_request_number (service_request_number),
  INDEX idx_service_requests_warranty (warranty_id),
  INDEX idx_service_requests_customer (customer_id),
  INDEX idx_service_requests_technician (technician_id),
  INDEX idx_service_requests_status (status),

  CONSTRAINT fk_service_requests_warranty_id
    FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_service_requests_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_service_requests_technician
    FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_service_requests_creator
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  30. WARRANTY EVENTS (Lifecycle Event History)
-- ============================================================
CREATE TABLE IF NOT EXISTS warranty_events (
  id            CHAR(36)     NOT NULL,
  warranty_id   CHAR(36)     NOT NULL,
  actor_user_id CHAR(36)     NULL,
  event_type    VARCHAR(50)  NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT         NULL,
  metadata      JSON         NULL,
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NULL,
  source_type VARCHAR(50) NULL,
  source_id VARCHAR(100) NULL,
  timestamp     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_warranty_events_warranty_id (warranty_id),
  INDEX idx_warranty_events_actor (actor_user_id),

  CONSTRAINT fk_warranty_events_warranty_id
    FOREIGN KEY (warranty_id) REFERENCES warranties(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_warranty_events_actor
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  31. DAILY TASKS (Daily Target Module)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_tasks (
  id          CHAR(36)     NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT         NULL,
  assigned_by CHAR(36)     NOT NULL,
  assigned_to CHAR(36)     NOT NULL,
  priority    ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  due_date    DATE         NOT NULL,
  status      ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  remarks     TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX idx_daily_tasks_assigned_by (assigned_by),
  INDEX idx_daily_tasks_assigned_to (assigned_to),
  INDEX idx_daily_tasks_status (status),
  INDEX idx_daily_tasks_due_date (due_date),

  CONSTRAINT fk_daily_tasks_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_daily_tasks_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  32. DAILY TASK HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_task_history (
  id            CHAR(36)    NOT NULL,
  daily_task_id CHAR(36)    NOT NULL,
  changed_by    CHAR(36)    NOT NULL,
  field_changed VARCHAR(50) NOT NULL,
  old_value     TEXT        NULL,
  new_value     TEXT        NULL,
  deleted_at    DATETIME    NULL,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_dth_daily_task_id (daily_task_id),
  INDEX idx_dth_changed_by (changed_by),

  CONSTRAINT fk_dth_daily_task_id
    FOREIGN KEY (daily_task_id) REFERENCES daily_tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dth_changed_by
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  33. DAILY ACTIVITIES (5-State Operational Shift Workflow)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_activities (
  id               CHAR(36)     NOT NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT         NOT NULL,
  assigned_by      CHAR(36)     NOT NULL,
  assigned_to      CHAR(36)     NOT NULL,
  priority         ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  category         VARCHAR(100) NULL,
  notes            TEXT         NULL,
  status           ENUM('ASSIGNED','IN_PROGRESS','COMPLETED','BLOCKED','INCOMPLETE','LATE') NOT NULL DEFAULT 'ASSIGNED',
  assigned_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at       DATETIME     NULL,
  completed_at     DATETIME     NULL,
  shift_duration   INT          NOT NULL DEFAULT 24,
  scheduled_date   DATE         NULL,
  due_date         DATE         NULL,
  estimated_hours  DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  actual_hours     DECIMAL(4,2) NOT NULL DEFAULT 0.00,
  completion_notes TEXT         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX idx_da_assigned_to (assigned_to),
  INDEX idx_da_assigned_by (assigned_by),
  INDEX idx_da_status (status),
  INDEX idx_da_assigned_at (assigned_at),

  CONSTRAINT fk_da_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_da_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  34. DAILY ACTIVITY HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_activity_history (
  id          CHAR(36)    NOT NULL,
  activity_id CHAR(36)    NOT NULL,
  actor_id    CHAR(36)    NOT NULL,
  event_type  ENUM('ACTIVITY_CREATED','ACTIVITY_ASSIGNED','ACTIVITY_STARTED','ACTIVITY_COMPLETED','ACTIVITY_INCOMPLETE','ACTIVITY_LATE','STATUS_CHANGED','COMMENT_ADDED','HOURS_LOGGED','ACTIVITY_UPDATED') NOT NULL,
  old_status  VARCHAR(50) NULL,
  new_status  VARCHAR(50) NOT NULL,
  notes       TEXT        NULL,
  deleted_at  DATETIME    NULL,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_dah_activity_id (activity_id),
  INDEX idx_dah_created_at (created_at),

  CONSTRAINT fk_dah_activity_id
    FOREIGN KEY (activity_id) REFERENCES daily_activities(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_dah_actor_id
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  BASE SEED DATA: 1. SYSTEM ROLES
-- ============================================================
INSERT IGNORE INTO roles (id, name, description, data_scope, is_system, created_at, updated_at) VALUES
  ('r-super-admin', 'Super admin', 'Master login with full system access and unrestricted control.', 'Global', 1, NOW(), NOW()),
  ('r-manager',     'Manager',     'Operational management over teams, orders, tasks, and reports.',     'Global', 1, NOW(), NOW()),
  ('r-hr',          'Hr',          'HR access for employee profiles, documents, and payroll.',           'Global', 1, NOW(), NOW()),
  ('r-sales',       'Sales',       'Sales and order processing access across marketplaces.',             'Global', 1, NOW(), NOW()),
  ('r-telecaller',  'Telecaller',  'Telecalling leads, verification calls, and customer follow-ups.',    'Global', 1, NOW(), NOW()),
  ('r-technician',  'Technician',  'Field service technician for warranty repairs and installation.',   'Global', 1, NOW(), NOW()),
  ('r-employee',    'Employee',    'General staff for shift activities, personal documents, and profile.', 'Global', 1, NOW(), NOW());

-- ============================================================
--  BASE SEED DATA: 2. SYSTEM PERMISSIONS
-- ============================================================
INSERT IGNORE INTO permissions (id, module, action, name, description, created_at, updated_at) VALUES
  -- Dashboard
  ('p-dash-view',    'dashboard', 'view',   'dashboard:view',   'View analytical dashboard', NOW(), NOW()),
  -- Orders
  ('p-ord-view',     'orders',    'view',   'orders:view',      'View orders list and details', NOW(), NOW()),
  ('p-ord-create',   'orders',    'create', 'orders:create',    'Create new orders', NOW(), NOW()),
  ('p-ord-edit',     'orders',    'edit',   'orders:edit',      'Edit order details and status', NOW(), NOW()),
  ('p-ord-delete',   'orders',    'delete', 'orders:delete',    'Delete orders', NOW(), NOW()),
  -- Customers
  ('p-cust-view',    'customers', 'view',   'customers:view',   'View customers list', NOW(), NOW()),
  ('p-cust-create',  'customers', 'create', 'customers:create', 'Create new customers', NOW(), NOW()),
  ('p-cust-edit',    'customers', 'edit',   'customers:edit',   'Edit customer details', NOW(), NOW()),
  ('p-cust-delete',  'customers', 'delete', 'customers:delete', 'Delete customers', NOW(), NOW()),
  -- Shipping
  ('p-ship-view',    'shipping',  'view',   'shipping:view',    'View shipping and tracking', NOW(), NOW()),
  ('p-ship-edit',    'shipping',  'edit',   'shipping:edit',    'Update shipping status', NOW(), NOW()),
  -- Follow-Ups
  ('p-fup-view',     'followups', 'view',   'followups:view',   'View follow-up reminders', NOW(), NOW()),
  ('p-fup-create',   'followups', 'create', 'followups:create', 'Create follow-up reminders', NOW(), NOW()),
  ('p-fup-edit',     'followups', 'edit',   'followups:edit',   'Update follow-up status', NOW(), NOW()),
  -- Tasks
  ('p-task-view',    'tasks',     'view',   'tasks:view',       'View tasks', NOW(), NOW()),
  ('p-task-create',  'tasks',     'create', 'tasks:create',     'Create new tasks', NOW(), NOW()),
  ('p-task-edit',    'tasks',     'edit',   'tasks:edit',       'Update and score tasks', NOW(), NOW()),
  ('p-task-delete',  'tasks',     'delete', 'tasks:delete',     'Delete tasks', NOW(), NOW()),
  -- CSV Import
  ('p-csv-import',   'csv',       'import', 'csv:import',       'Import CSV files', NOW(), NOW()),
  -- Reports
  ('p-rep-view',     'reports',   'view',   'reports:view',     'View sales and operational reports', NOW(), NOW()),
  -- Employees
  ('p-emp-view',     'employees', 'view',   'employees:view',   'View employee directory', NOW(), NOW()),
  ('p-emp-create',   'employees', 'create', 'employees:create', 'Create employee profiles', NOW(), NOW()),
  ('p-emp-edit',     'employees', 'edit',   'employees:edit',   'Edit employee records', NOW(), NOW()),
  ('p-emp-delete',   'employees', 'delete', 'employees:delete', 'Delete employee records', NOW(), NOW()),
  -- Users & Rights
  ('p-usr-view',     'users',     'view',   'users:view',       'View system users list', NOW(), NOW()),
  ('p-usr-manage',   'users',     'manage', 'users:manage',     'Create and activate/deactivate users', NOW(), NOW()),
  ('p-acc-manage',   'access',    'manage', 'access:manage',    'Give and revoke access rights to users', NOW(), NOW()),
  -- Daily Tasks & Activities
  ('p-dtask-view',   'daily_tasks', 'view', 'daily_tasks:view', 'View daily tasks & activities', NOW(), NOW()),
  ('p-dtask-create', 'daily_tasks', 'create','daily_tasks:create','Assign daily tasks & activities', NOW(), NOW()),
  ('p-dtask-edit',   'daily_tasks', 'edit', 'daily_tasks:edit', 'Edit daily tasks and status', NOW(), NOW()),
  ('p-dtask-delete', 'daily_tasks', 'delete','daily_tasks:delete','Delete daily tasks', NOW(), NOW()),
  -- Onboarding & Document Center
  ('p-onboard-view', 'onboarding',  'view', 'onboarding:view',  'View employee onboarding status', NOW(), NOW()),
  ('p-onboard-manage','onboarding', 'manage','onboarding:manage','Manage onboarding & verify documents', NOW(), NOW()),
  ('p-doccenter-view','document_center','view','document_center:view','Access HR Document Center', NOW(), NOW());

-- ============================================================
--  BASE SEED DATA: 3. ROLE PERMISSION MAPPINGS
-- ============================================================
-- Super Admin (All Permissions)
INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at, updated_at) VALUES
  ('rp-sa-1',  'r-super-admin', 'p-dash-view', NOW(), NOW()),
  ('rp-sa-2',  'r-super-admin', 'p-ord-view', NOW(), NOW()),
  ('rp-sa-3',  'r-super-admin', 'p-ord-create', NOW(), NOW()),
  ('rp-sa-4',  'r-super-admin', 'p-ord-edit', NOW(), NOW()),
  ('rp-sa-5',  'r-super-admin', 'p-ord-delete', NOW(), NOW()),
  ('rp-sa-6',  'r-super-admin', 'p-cust-view', NOW(), NOW()),
  ('rp-sa-7',  'r-super-admin', 'p-cust-create', NOW(), NOW()),
  ('rp-sa-8',  'r-super-admin', 'p-cust-edit', NOW(), NOW()),
  ('rp-sa-9',  'r-super-admin', 'p-cust-delete', NOW(), NOW()),
  ('rp-sa-10', 'r-super-admin', 'p-ship-view', NOW(), NOW()),
  ('rp-sa-11', 'r-super-admin', 'p-ship-edit', NOW(), NOW()),
  ('rp-sa-12', 'r-super-admin', 'p-fup-view', NOW(), NOW()),
  ('rp-sa-13', 'r-super-admin', 'p-fup-create', NOW(), NOW()),
  ('rp-sa-14', 'r-super-admin', 'p-fup-edit', NOW(), NOW()),
  ('rp-sa-15', 'r-super-admin', 'p-task-view', NOW(), NOW()),
  ('rp-sa-16', 'r-super-admin', 'p-task-create', NOW(), NOW()),
  ('rp-sa-17', 'r-super-admin', 'p-task-edit', NOW(), NOW()),
  ('rp-sa-18', 'r-super-admin', 'p-task-delete', NOW(), NOW()),
  ('rp-sa-19', 'r-super-admin', 'p-csv-import', NOW(), NOW()),
  ('rp-sa-20', 'r-super-admin', 'p-rep-view', NOW(), NOW()),
  ('rp-sa-21', 'r-super-admin', 'p-emp-view', NOW(), NOW()),
  ('rp-sa-22', 'r-super-admin', 'p-emp-create', NOW(), NOW()),
  ('rp-sa-23', 'r-super-admin', 'p-emp-edit', NOW(), NOW()),
  ('rp-sa-24', 'r-super-admin', 'p-emp-delete', NOW(), NOW()),
  ('rp-sa-25', 'r-super-admin', 'p-usr-view', NOW(), NOW()),
  ('rp-sa-26', 'r-super-admin', 'p-usr-manage', NOW(), NOW()),
  ('rp-sa-27', 'r-super-admin', 'p-acc-manage', NOW(), NOW()),
  ('rp-sa-28', 'r-super-admin', 'p-dtask-view', NOW(), NOW()),
  ('rp-sa-29', 'r-super-admin', 'p-dtask-create', NOW(), NOW()),
  ('rp-sa-30', 'r-super-admin', 'p-dtask-edit', NOW(), NOW()),
  ('rp-sa-31', 'r-super-admin', 'p-dtask-delete', NOW(), NOW()),
  ('rp-sa-32', 'r-super-admin', 'p-onboard-view', NOW(), NOW()),
  ('rp-sa-33', 'r-super-admin', 'p-onboard-manage', NOW(), NOW()),
  ('rp-sa-34', 'r-super-admin', 'p-doccenter-view', NOW(), NOW());

-- Manager
INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at, updated_at) VALUES
  ('rp-mgr-1',  'r-manager', 'p-dash-view', NOW(), NOW()),
  ('rp-mgr-2',  'r-manager', 'p-ord-view', NOW(), NOW()),
  ('rp-mgr-3',  'r-manager', 'p-ord-create', NOW(), NOW()),
  ('rp-mgr-4',  'r-manager', 'p-ord-edit', NOW(), NOW()),
  ('rp-mgr-5',  'r-manager', 'p-cust-view', NOW(), NOW()),
  ('rp-mgr-6',  'r-manager', 'p-cust-create', NOW(), NOW()),
  ('rp-mgr-7',  'r-manager', 'p-cust-edit', NOW(), NOW()),
  ('rp-mgr-8',  'r-manager', 'p-ship-view', NOW(), NOW()),
  ('rp-mgr-9',  'r-manager', 'p-ship-edit', NOW(), NOW()),
  ('rp-mgr-10', 'r-manager', 'p-fup-view', NOW(), NOW()),
  ('rp-mgr-11', 'r-manager', 'p-fup-create', NOW(), NOW()),
  ('rp-mgr-12', 'r-manager', 'p-fup-edit', NOW(), NOW()),
  ('rp-mgr-13', 'r-manager', 'p-task-view', NOW(), NOW()),
  ('rp-mgr-14', 'r-manager', 'p-task-create', NOW(), NOW()),
  ('rp-mgr-15', 'r-manager', 'p-task-edit', NOW(), NOW()),
  ('rp-mgr-16', 'r-manager', 'p-csv-import', NOW(), NOW()),
  ('rp-mgr-17', 'r-manager', 'p-rep-view', NOW(), NOW()),
  ('rp-mgr-18', 'r-manager', 'p-emp-view', NOW(), NOW()),
  ('rp-mgr-19', 'r-manager', 'p-emp-create', NOW(), NOW()),
  ('rp-mgr-20', 'r-manager', 'p-emp-edit', NOW(), NOW()),
  ('rp-mgr-21', 'r-manager', 'p-dtask-view', NOW(), NOW()),
  ('rp-mgr-22', 'r-manager', 'p-dtask-create', NOW(), NOW()),
  ('rp-mgr-23', 'r-manager', 'p-dtask-edit', NOW(), NOW()),
  ('rp-mgr-24', 'r-manager', 'p-dtask-delete', NOW(), NOW()),
  ('rp-mgr-25', 'r-manager', 'p-onboard-view', NOW(), NOW());

-- HR
INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at, updated_at) VALUES
  ('rp-hr-1',  'r-hr', 'p-dash-view', NOW(), NOW()),
  ('rp-hr-2',  'r-hr', 'p-emp-view', NOW(), NOW()),
  ('rp-hr-3',  'r-hr', 'p-emp-create', NOW(), NOW()),
  ('rp-hr-4',  'r-hr', 'p-emp-edit', NOW(), NOW()),
  ('rp-hr-5',  'r-hr', 'p-emp-delete', NOW(), NOW()),
  ('rp-hr-6',  'r-hr', 'p-usr-view', NOW(), NOW()),
  ('rp-hr-7',  'r-hr', 'p-usr-manage', NOW(), NOW()),
  ('rp-hr-8',  'r-hr', 'p-task-view', NOW(), NOW()),
  ('rp-hr-9',  'r-hr', 'p-task-create', NOW(), NOW()),
  ('rp-hr-10', 'r-hr', 'p-task-edit', NOW(), NOW()),
  ('rp-hr-11', 'r-hr', 'p-fup-view', NOW(), NOW()),
  ('rp-hr-12', 'r-hr', 'p-dtask-view', NOW(), NOW()),
  ('rp-hr-13', 'r-hr', 'p-dtask-create', NOW(), NOW()),
  ('rp-hr-14', 'r-hr', 'p-dtask-edit', NOW(), NOW()),
  ('rp-hr-15', 'r-hr', 'p-dtask-delete', NOW(), NOW()),
  ('rp-hr-16', 'r-hr', 'p-onboard-view', NOW(), NOW()),
  ('rp-hr-17', 'r-hr', 'p-onboard-manage', NOW(), NOW()),
  ('rp-hr-18', 'r-hr', 'p-doccenter-view', NOW(), NOW());

-- Sales
INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at, updated_at) VALUES
  ('rp-sal-1',  'r-sales', 'p-dash-view', NOW(), NOW()),
  ('rp-sal-2',  'r-sales', 'p-ord-view', NOW(), NOW()),
  ('rp-sal-3',  'r-sales', 'p-ord-create', NOW(), NOW()),
  ('rp-sal-4',  'r-sales', 'p-ord-edit', NOW(), NOW()),
  ('rp-sal-5',  'r-sales', 'p-cust-view', NOW(), NOW()),
  ('rp-sal-6',  'r-sales', 'p-cust-create', NOW(), NOW()),
  ('rp-sal-7',  'r-sales', 'p-cust-edit', NOW(), NOW()),
  ('rp-sal-8',  'r-sales', 'p-ship-view', NOW(), NOW()),
  ('rp-sal-9',  'r-sales', 'p-fup-view', NOW(), NOW()),
  ('rp-sal-10', 'r-sales', 'p-fup-create', NOW(), NOW()),
  ('rp-sal-11', 'r-sales', 'p-fup-edit', NOW(), NOW()),
  ('rp-sal-12', 'r-sales', 'p-task-view', NOW(), NOW()),
  ('rp-sal-13', 'r-sales', 'p-task-create', NOW(), NOW()),
  ('rp-sal-14', 'r-sales', 'p-task-edit', NOW(), NOW()),
  ('rp-sal-15', 'r-sales', 'p-csv-import', NOW(), NOW()),
  ('rp-sal-16', 'r-sales', 'p-dtask-view', NOW(), NOW()),
  ('rp-sal-17', 'r-sales', 'p-dtask-edit', NOW(), NOW());

-- Telecaller
INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at, updated_at) VALUES
  ('rp-tel-1',  'r-telecaller', 'p-dash-view', NOW(), NOW()),
  ('rp-tel-2',  'r-telecaller', 'p-cust-view', NOW(), NOW()),
  ('rp-tel-3',  'r-telecaller', 'p-cust-create', NOW(), NOW()),
  ('rp-tel-4',  'r-telecaller', 'p-cust-edit', NOW(), NOW()),
  ('rp-tel-5',  'r-telecaller', 'p-fup-view', NOW(), NOW()),
  ('rp-tel-6',  'r-telecaller', 'p-fup-create', NOW(), NOW()),
  ('rp-tel-7',  'r-telecaller', 'p-fup-edit', NOW(), NOW()),
  ('rp-tel-8',  'r-telecaller', 'p-task-view', NOW(), NOW()),
  ('rp-tel-9',  'r-telecaller', 'p-task-edit', NOW(), NOW()),
  ('rp-tel-10', 'r-telecaller', 'p-csv-import', NOW(), NOW()),
  ('rp-tel-11', 'r-telecaller', 'p-dtask-view', NOW(), NOW()),
  ('rp-tel-12', 'r-telecaller', 'p-dtask-create', NOW(), NOW()),
  ('rp-tel-13', 'r-telecaller', 'p-dtask-edit', NOW(), NOW());

-- Technician
INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at, updated_at) VALUES
  ('rp-tec-1', 'r-technician', 'p-dash-view', NOW(), NOW()),
  ('rp-tec-2', 'r-technician', 'p-task-view', NOW(), NOW()),
  ('rp-tec-3', 'r-technician', 'p-task-edit', NOW(), NOW()),
  ('rp-tec-4', 'r-technician', 'p-dtask-view', NOW(), NOW()),
  ('rp-tec-5', 'r-technician', 'p-dtask-edit', NOW(), NOW());

-- Employee
INSERT IGNORE INTO role_permissions (id, role_id, permission_id, created_at, updated_at) VALUES
  ('rp-emp-1', 'r-employee', 'p-dash-view', NOW(), NOW()),
  ('rp-emp-2', 'r-employee', 'p-task-view', NOW(), NOW()),
  ('rp-emp-3', 'r-employee', 'p-task-edit', NOW(), NOW()),
  ('rp-emp-4', 'r-employee', 'p-fup-view', NOW(), NOW()),
  ('rp-emp-5', 'r-employee', 'p-fup-edit', NOW(), NOW()),
  ('rp-emp-6', 'r-employee', 'p-dtask-view', NOW(), NOW()),
  ('rp-emp-7', 'r-employee', 'p-dtask-edit', NOW(), NOW());

-- ============================================================
--  BASE SEED DATA: 4. DEFAULT USERS
--  Passwords are set to: <Role>@123456 (e.g. Admin@123456)
-- ============================================================
INSERT IGNORE INTO users (
  id, name, first_name, last_name, email, password, role, is_active, status,
  department, designation, employee_id, phone, created_at, updated_at
) VALUES
  (
    'u-admin-0001',
    'Super Admin',
    'Super',
    'Admin',
    'admin@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'admin', 1, 'active',
    'Executive Management', 'Managing Director', 'KR-EMP-001', '9820011001',
    NOW(), NOW()
  ),
  (
    'u-manager-0002',
    'Vikram Malhotra',
    'Vikram',
    'Malhotra',
    'manager@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'manager', 1, 'active',
    'Operations', 'Operations Head', 'KR-EMP-002', '9820011002',
    NOW(), NOW()
  ),
  (
    'u-hr-0003',
    'Pooja Hegde',
    'Pooja',
    'Hegde',
    'hr@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'hr', 1, 'active',
    'Human Resources', 'HR Lead & People Ops', 'KR-EMP-003', '9820011003',
    NOW(), NOW()
  ),
  (
    'u-sales-0004',
    'Rahul Deshmukh',
    'Rahul',
    'Deshmukh',
    'sales@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'sales', 1, 'active',
    'Sales & Marketing', 'Senior Sales Executive', 'KR-EMP-004', '9820011004',
    NOW(), NOW()
  ),
  (
    'u-telecaller-0005',
    'Neha Sharma',
    'Neha',
    'Sharma',
    'telecaller@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'telecaller', 1, 'active',
    'Customer Support', 'Senior Telecaller', 'KR-EMP-005', '9820011005',
    NOW(), NOW()
  ),
  (
    'u-technician-0006',
    'Amit Shinde',
    'Amit',
    'Shinde',
    'technician@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'technician', 1, 'active',
    'Field Service', 'Lead Field Engineer', 'KR-EMP-006', '9820011006',
    NOW(), NOW()
  ),
  (
    'u-employee-0007',
    'Standard Employee',
    'Standard',
    'Employee',
    'employee@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'employee', 1, 'active',
    'General Operations', 'Associate', 'KR-EMP-007', '9820011007',
    NOW(), NOW()
  ),
  (
    'u-ceo-0008',
    'CEO User',
    'CEO',
    'User',
    'ceo@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'ceo', 1, 'active',
    'Executive Management', 'Chief Executive Officer', 'KR-EMP-008', '9820011008',
    NOW(), NOW()
  );

-- ============================================================
--  BASE SEED DATA: 5. DEFAULT SHIPPING PARTNERS
-- ============================================================
INSERT IGNORE INTO shipping_partners (id, name, code, tracking_url_template, default_tat_days, is_active, created_at, updated_at) VALUES
  ('sp-delhivery', 'Delhivery',    'DELHIVERY',  'https://www.delhivery.com/track/package/{tracking_number}', 4, 1, NOW(), NOW()),
  ('sp-bluedart',  'Blue Dart',    'BLUEDART',   'https://www.bluedart.com/tracking?trackingId={tracking_number}', 3, 1, NOW(), NOW()),
  ('sp-dtdc',      'DTDC',         'DTDC',       'https://www.dtdc.in/tracking/tracking_results.asp?strCnno={tracking_number}', 5, 1, NOW(), NOW()),
  ('sp-ecom',      'Ecom Express', 'ECOM',       'https://ecomexpress.in/tracking/?awb_field={tracking_number}', 5, 1, NOW(), NOW()),
  ('sp-xpressbees','Xpressbees',   'XPRESSBEES', 'https://www.xpressbees.com/track?awbNo={tracking_number}', 4, 1, NOW(), NOW());

-- ============================================================
--  REGISTER ALL MIGRATIONS IN REGISTRY
-- ============================================================
INSERT IGNORE INTO schema_migrations (filename, applied_at) VALUES
  ('001_complete_schema.sql', NOW()),
  ('001_initial_schema.sql', NOW()),
  ('002_shipping_module.sql', NOW()),
  ('003_cr_changes.sql', NOW()),
  ('004_task_score.sql', NOW()),
  ('007_amazon_delivery_dates.sql', NOW()),
  ('009_user_access_control.sql', NOW()),
  ('010_onboarding_documents.sql', NOW()),
  ('011_employee_audit_system.sql', NOW()),
  ('012_warranty_module.sql', NOW()),
  ('013_manual_order_verification.sql', NOW()),
  ('014_user_management_v2.sql', NOW()),
  ('015_employee_hr_v2.sql', NOW()),
  ('016_daily_activities_v2.sql', NOW());


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
  `date`               DATE          NOT NULL,
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
  `key`       VARCHAR(100) NOT NULL,
  `value`     TEXT         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  DATETIME     NULL,

  PRIMARY KEY (`key`)
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

-- ============================================================
--  55. WHATSAPP BATCHES (Controlled Bulk Messaging Max 100)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_batches (
  id                         CHAR(36)      NOT NULL,
  batch_id                   VARCHAR(64)   NOT NULL,
  import_batch_id            CHAR(36)      NULL,
  batch_index                INT           NOT NULL DEFAULT 1,
  total_batches              INT           NOT NULL DEFAULT 1,
  customer_count             INT           NOT NULL DEFAULT 0,
  message_count              INT           NOT NULL DEFAULT 0,
  order_range_start          VARCHAR(100)  NULL,
  order_range_end            VARCHAR(100)  NULL,
  status                     ENUM('CREATED','READY','AWAITING_CONFIRMATION','QUEUED','PROCESSING','COMPLETED','PARTIALLY_FAILED','FAILED','PAUSED','CANCELLED') NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
  estimated_cost             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  actual_cost                DECIMAL(10,2) NULL,
  reserved_cost              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  estimated_duration_seconds INT           NOT NULL DEFAULT 0,
  estimated_duration_text    VARCHAR(100)  NULL,
  sent_count                 INT           NOT NULL DEFAULT 0,
  failed_count               INT           NOT NULL DEFAULT 0,
  cancelled_count            INT           NOT NULL DEFAULT 0,
  paused_count               INT           NOT NULL DEFAULT 0,
  confirmed_by               CHAR(36)      NULL,
  confirmed_at               DATETIME      NULL,
  started_at                 DATETIME      NULL,
  completed_at               DATETIME      NULL,
  idempotency_key            VARCHAR(150)  NULL,
  metadata                   JSON          NULL,
  created_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                 DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_wb_batch_id (batch_id),
  UNIQUE KEY uq_wb_idempotency (idempotency_key),
  INDEX idx_wb_import_batch (import_batch_id),
  INDEX idx_wb_status (status),
  INDEX idx_wb_created_at (created_at),
  CONSTRAINT fk_wb_import_batch FOREIGN KEY (import_batch_id) REFERENCES csv_import_batches(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_wb_confirmer FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  56. WHATSAPP OUTBOX (Rate-Limited Queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id              CHAR(36)      NOT NULL,
  order_id        CHAR(36)      NULL,
  customer_id     CHAR(36)      NULL,
  batch_id        CHAR(36)      NULL,
  recipient_phone VARCHAR(30)   NOT NULL,
  template_name   VARCHAR(100)  NOT NULL,
  payload         JSON          NULL,
  status          VARCHAR(50)   NOT NULL DEFAULT 'QUEUED',
  provider        VARCHAR(50)   NULL,
  provider_message_id VARCHAR(150) NULL,
  attempt_count   INT           NOT NULL DEFAULT 0,
  attempts        INT           NOT NULL DEFAULT 0,
  max_attempts    INT           NOT NULL DEFAULT 5,
  queued_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at     DATETIME      NULL,
  sent_at         DATETIME      NULL,
  delivered_at    DATETIME      NULL,
  read_at         DATETIME      NULL,
  failed_at       DATETIME      NULL,
  failure_code    VARCHAR(100)  NULL,
  failure_reason  TEXT          NULL,
  error_category  VARCHAR(50)   NULL,
  last_error      TEXT          NULL,
  locked_at       DATETIME      NULL,
  worker_id       VARCHAR(100)  NULL,
  next_attempt_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  idempotency_key VARCHAR(150)  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_wo_idempotency (idempotency_key),
  INDEX idx_wo_status_next (status, next_attempt_at),
  INDEX idx_wo_order_template (order_id, template_name),
  INDEX idx_wo_recipient (recipient_phone),
  INDEX idx_wo_batch_id (batch_id),
  INDEX idx_wo_worker_lock (worker_id, locked_at),
  INDEX idx_wo_queued_at (queued_at),
  INDEX idx_wo_provider_msg (provider_message_id),
  CONSTRAINT fk_wo_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_wo_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_wo_batch FOREIGN KEY (batch_id) REFERENCES whatsapp_batches(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  57. WHATSAPP RATE LIMIT & SPEND EVENTS (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_rate_limit_events (
  id                CHAR(36)      NOT NULL,
  event_type        VARCHAR(50)   NOT NULL,
  batch_id          CHAR(36)      NULL,
  outbox_id         CHAR(36)      NULL,
  worker_id         VARCHAR(100)  NULL,
  configured_limit  INT           NULL,
  current_usage     INT           NULL,
  amount            DECIMAL(10,2) NULL,
  details           JSON          NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_wrle_event_type (event_type),
  INDEX idx_wrle_created_at (created_at),
  INDEX idx_wrle_batch_id (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  58. ATTENDANCE EVENTS (SmartOffice Biometric Raw Punches)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_events (
  id                        CHAR(36)      NOT NULL,
  employee_id               CHAR(36)      NULL,
  smartoffice_employee_code VARCHAR(50)   NOT NULL,
  device_serial_number      VARCHAR(100)  NULL,
  log_datetime              DATETIME      NOT NULL,
  punch_direction           VARCHAR(20)   NOT NULL DEFAULT 'UNKNOWN',
  temperature               DECIMAL(5,2)  NOT NULL DEFAULT 0.00,
  temperature_state         VARCHAR(50)   NOT NULL DEFAULT 'Not Measured',
  source                    VARCHAR(50)   NOT NULL DEFAULT 'smartoffice',
  external_event_key        VARCHAR(191)  NOT NULL,
  status                    VARCHAR(50)   NOT NULL DEFAULT 'PROCESSED',
  raw_payload               JSON          NULL,
  received_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_events_external_key (external_event_key),
  INDEX idx_attendance_events_employee_id (employee_id),
  INDEX idx_attendance_events_smartoffice_code (smartoffice_employee_code),
  INDEX idx_attendance_events_log_datetime (log_datetime),
  INDEX idx_attendance_events_status (status),
  INDEX idx_attendance_events_device_serial (device_serial_number),
  CONSTRAINT fk_ae_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  59. ATTENDANCE SYNC RUNS (Biometric Integration Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_sync_runs (
  id                CHAR(36)      NOT NULL,
  from_datetime     VARCHAR(50)   NOT NULL,
  to_datetime       VARCHAR(50)   NOT NULL,
  started_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at      DATETIME      NULL,
  duration_ms       INT           NOT NULL DEFAULT 0,
  records_received  INT           NOT NULL DEFAULT 0,
  records_inserted  INT           NOT NULL DEFAULT 0,
  records_duplicate INT           NOT NULL DEFAULT 0,
  records_unmatched INT           NOT NULL DEFAULT 0,
  records_failed    INT           NOT NULL DEFAULT 0,
  status            ENUM('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'RUNNING',
  error_message     TEXT          NULL,
  sync_type         VARCHAR(50)   NOT NULL DEFAULT 'SCHEDULED',
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at        DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX idx_attendance_sync_runs_started_at (started_at),
  INDEX idx_attendance_sync_runs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET foreign_key_checks = 1;

-- ============================================================
--  COMPLETION STATUS
-- ============================================================
SELECT '✅ Krishna CRM Master Schema (34 Core + Modules + Batches + RateLimiter + Seeds) successfully initialized.' AS result;
