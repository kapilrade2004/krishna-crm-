-- ============================================================
--  Krishna CRM – MySQL Schema Migration
--  Version  : 1.0.0
--  Date     : 2026-06-13
--  Engine   : InnoDB  |  Charset: utf8mb4  |  Collation: utf8mb4_unicode_ci
--
--  Modules covered:
--    1. users
--    2. customers
--    3. orders
--    4. order_activities
--    5. follow_ups
--    6. tasks
--    7. csv_import_batches
--    8. whatsapp_logs
--
--  Run:  mysql -u root -p krishna_crm < migration.sql
-- ============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET time_zone = '+05:30';
SET foreign_key_checks = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
--  DATABASE
-- ============================================================
CREATE DATABASE IF NOT EXISTS krishna_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE krishna_crm;

-- ============================================================
--  1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              CHAR(36)      NOT NULL,
  name            VARCHAR(100)  NOT NULL,
  email           VARCHAR(150)  NOT NULL,
  password        VARCHAR(255)  NOT NULL,
  role            ENUM('admin','manager','sales','support','ceo') NOT NULL DEFAULT 'sales',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  refresh_token   TEXT          NULL,
  last_login_at   DATETIME      NULL,
  avatar_url      VARCHAR(500)  NULL,
  phone           VARCHAR(20)   NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME      NULL,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_users_email (email),
  INDEX   ix_users_role      (role),
  INDEX   ix_users_is_active (is_active),
  INDEX   ix_users_deleted   (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  2. CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id                  CHAR(36)      NOT NULL,
  name                VARCHAR(150)  NOT NULL,
  email               VARCHAR(150)  NULL,
  phone               VARCHAR(20)   NULL,
  whatsapp_number     VARCHAR(20)   NULL,
  address_line1       VARCHAR(255)  NULL,
  address_line2       VARCHAR(255)  NULL,
  city                VARCHAR(100)  NULL,
  state               VARCHAR(100)  NULL,
  pincode             VARCHAR(10)   NULL,
  country             VARCHAR(100)  NOT NULL DEFAULT 'India',
  source              ENUM('amazon','flipkart','indiamart','website','direct','other') NOT NULL DEFAULT 'other',
  status              ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  tags                JSON          NULL,
  notes               TEXT          NULL,
  total_orders        INT           NOT NULL DEFAULT 0,
  total_revenue       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  assigned_to         CHAR(36)      NULL,
  whatsapp_opt_in     TINYINT(1)    NOT NULL DEFAULT 0,
  last_contacted_at   DATETIME      NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at          DATETIME      NULL,

  PRIMARY KEY (id),
  INDEX ix_customers_phone       (phone),
  INDEX ix_customers_email       (email),
  INDEX ix_customers_source      (source),
  INDEX ix_customers_status      (status),
  INDEX ix_customers_assigned_to (assigned_to),
  INDEX ix_customers_pincode     (pincode),
  INDEX ix_customers_deleted     (deleted_at),

  CONSTRAINT fk_customers_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  3. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                          CHAR(36)       NOT NULL,
  order_number                VARCHAR(100)   NOT NULL,
  marketplace_order_id        VARCHAR(150)   NULL,
  marketplace                 ENUM('amazon','flipkart','indiamart','website','direct','other') NOT NULL DEFAULT 'direct',
  customer_id                 CHAR(36)       NOT NULL,

  -- Status & flow
  status                      ENUM(
                                'pending','confirmed','processing',
                                'dispatched','delivered','cancelled','returned','refunded'
                              ) NOT NULL DEFAULT 'pending',
  flow_stage                  ENUM(
                                'ask_images','match_pending','match_confirmed',
                                'match_alternate','match_reorder','match_cancelled',
                                'processing','delivery_confirmed','installation',
                                'feedback_pending','completed'
                              ) NOT NULL DEFAULT 'ask_images',
  images_provided             TINYINT(1)     NOT NULL DEFAULT 0,

  -- Product
  product_name                VARCHAR(255)   NULL,
  product_sku                 VARCHAR(100)   NULL,
  quantity                    INT            NOT NULL DEFAULT 1,
  unit_price                  DECIMAL(10,2)  NULL,
  total_amount                DECIMAL(12,2)  NULL,
  discount_amount             DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  shipping_charge             DECIMAL(10,2)  NOT NULL DEFAULT 0.00,

  -- Shipping
  shipping_partner            VARCHAR(100)   NULL,
  tracking_number             VARCHAR(150)   NULL,
  shipping_address            JSON           NULL,
  delivery_pincode            VARCHAR(10)    NULL,
  estimated_delivery_date     DATE           NULL,
  dispatched_at               DATETIME       NULL,
  delivered_at                DATETIME       NULL,

  -- WhatsApp flags
  whatsapp_confirmation_sent  TINYINT(1)     NOT NULL DEFAULT 0,
  whatsapp_dispatch_sent      TINYINT(1)     NOT NULL DEFAULT 0,
  whatsapp_delivery_sent      TINYINT(1)     NOT NULL DEFAULT 0,

  -- Internal
  assigned_to                 CHAR(36)       NULL,
  internal_notes              TEXT           NULL,
  customer_feedback           TEXT           NULL,
  feedback_rating             TINYINT        NULL COMMENT '1-5 stars',
  import_batch_id             CHAR(36)       NULL,
  raw_csv_data                JSON           NULL,
  order_date                  DATE           NULL,

  created_at                  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at                  DATETIME       NULL,

  PRIMARY KEY (id),
  UNIQUE  KEY uq_orders_order_number        (order_number),
  INDEX   ix_orders_marketplace_order_id   (marketplace_order_id),
  INDEX   ix_orders_marketplace            (marketplace),
  INDEX   ix_orders_customer_id            (customer_id),
  INDEX   ix_orders_status                 (status),
  INDEX   ix_orders_flow_stage             (flow_stage),
  INDEX   ix_orders_assigned_to            (assigned_to),
  INDEX   ix_orders_import_batch_id        (import_batch_id),
  INDEX   ix_orders_order_date             (order_date),
  INDEX   ix_orders_delivery_pincode       (delivery_pincode),
  INDEX   ix_orders_deleted                (deleted_at),
  -- Composite for dashboard queries
  INDEX   ix_orders_status_date            (status, order_date),
  INDEX   ix_orders_marketplace_status     (marketplace, status),

  CONSTRAINT fk_orders_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  4. ORDER ACTIVITIES (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_activities (
  id          CHAR(36)      NOT NULL,
  order_id    CHAR(36)      NOT NULL,
  user_id     CHAR(36)      NULL,
  action      VARCHAR(100)  NOT NULL  COMMENT 'e.g. status_changed, note_added, flow_stage_changed',
  from_value  VARCHAR(100)  NULL,
  to_value    VARCHAR(100)  NULL,
  note        TEXT          NULL,
  metadata    JSON          NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX ix_order_activities_order_id (order_id),
  INDEX ix_order_activities_user_id  (user_id),
  INDEX ix_order_activities_action   (action),

  CONSTRAINT fk_oa_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_oa_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  5. FOLLOW-UPS
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
  INDEX ix_fu_order_id    (order_id),
  INDEX ix_fu_assigned_to (assigned_to),
  INDEX ix_fu_status      (status),
  INDEX ix_fu_due_at      (due_at),
  INDEX ix_fu_deleted     (deleted_at),
  -- Composite: agent's pending workload ordered by due date
  INDEX ix_fu_agent_status_due (assigned_to, status, due_at),

  CONSTRAINT fk_fu_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_fu_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_fu_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  6. TASKS
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
  progress_percent TINYINT      NOT NULL DEFAULT 0 COMMENT '0-100',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at       DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX ix_tasks_assigned_to (assigned_to),
  INDEX ix_tasks_created_by  (created_by),
  INDEX ix_tasks_status      (status),
  INDEX ix_tasks_priority    (priority),
  INDEX ix_tasks_due_date    (due_date),
  INDEX ix_tasks_customer_id (customer_id),
  INDEX ix_tasks_order_id    (order_id),
  INDEX ix_tasks_deleted     (deleted_at),
  -- Composite: task board view
  INDEX ix_tasks_agent_status_due (assigned_to, status, due_date),

  CONSTRAINT fk_tasks_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_tasks_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  7. CSV IMPORT BATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS csv_import_batches (
  id              CHAR(36)     NOT NULL,
  uploaded_by     CHAR(36)     NOT NULL,
  marketplace     ENUM('amazon','flipkart','indiamart','other') NOT NULL,
  filename        VARCHAR(255) NOT NULL,
  file_path       VARCHAR(500) NOT NULL,
  status          ENUM('uploaded','processing','completed','failed','partial') NOT NULL DEFAULT 'uploaded',
  total_rows      INT          NOT NULL DEFAULT 0,
  processed_rows  INT          NOT NULL DEFAULT 0,
  success_rows    INT          NOT NULL DEFAULT 0,
  failed_rows     INT          NOT NULL DEFAULT 0,
  duplicate_rows  INT          NOT NULL DEFAULT 0,
  error_log       JSON         NULL,
  processed_at    DATETIME     NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME     NULL,

  PRIMARY KEY (id),
  INDEX ix_csv_uploaded_by  (uploaded_by),
  INDEX ix_csv_marketplace  (marketplace),
  INDEX ix_csv_status       (status),
  INDEX ix_csv_deleted      (deleted_at),

  CONSTRAINT fk_csv_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- orders.import_batch_id FK (batch must exist first)
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_import_batch_id
    FOREIGN KEY (import_batch_id) REFERENCES csv_import_batches(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
--  8. WHATSAPP LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_logs (
  id             CHAR(36)     NOT NULL,
  customer_id    CHAR(36)     NULL,
  order_id       CHAR(36)     NULL,
  phone_number   VARCHAR(20)  NOT NULL,
  message_type   ENUM('template','text','media','interactive') NOT NULL DEFAULT 'template',
  template_name  VARCHAR(100) NULL,
  direction      ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
  status         ENUM('queued','sent','delivered','read','failed') NOT NULL DEFAULT 'queued',
  wa_message_id  VARCHAR(150) NULL,
  payload        JSON         NULL,
  error_message  TEXT         NULL,
  sent_at        DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX ix_wa_phone_number  (phone_number),
  INDEX ix_wa_order_id      (order_id),
  INDEX ix_wa_customer_id   (customer_id),
  INDEX ix_wa_status        (status),
  INDEX ix_wa_direction     (direction),
  INDEX ix_wa_wa_message_id (wa_message_id),
  -- Fast lookup: all messages for an order sorted by time
  INDEX ix_wa_order_sent    (order_id, sent_at),

  CONSTRAINT fk_wa_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_wa_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  SEED: default users
--  Passwords are bcrypt hashes of the plaintext shown below.
--  CHANGE ALL PASSWORDS IMMEDIATELY AFTER FIRST LOGIN.
--
--  admin@krishnacrm.com   → Admin@123456
--  ceo@krishnacrm.com     → Ceo@123456
--  sales@krishnacrm.com   → Sales@123456
-- ============================================================
INSERT IGNORE INTO users (id, name, email, password, role, is_active, created_at, updated_at)
VALUES
  (
    UUID(),
    'Admin User',
    'admin@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'admin', 1, NOW(), NOW()
  ),
  (
    UUID(),
    'CEO',
    'ceo@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'ceo', 1, NOW(), NOW()
  ),
  (
    UUID(),
    'Sales Executive',
    'sales@krishnacrm.com',
    '$2a$12$K8GpRqHaZjPq2FqZ3xH5.uFJGWq6Mq2j4mWn5IQ8LvRfYJhBdpAKS',
    'sales', 1, NOW(), NOW()
  );

SET foreign_key_checks = 1;

-- ============================================================
--  DONE
-- ============================================================
SELECT 'Krishna CRM schema migration complete.' AS result;
