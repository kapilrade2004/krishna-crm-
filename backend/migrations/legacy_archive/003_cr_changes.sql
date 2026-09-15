-- ============================================================
--  Krishna CRM — Migration 003
--  Change Requests : CR1, CR2, CR3, CR4, CR7
--  Date            : 2026-06-15
-- ============================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;
USE krishna_crm;

-- ============================================================
--  CR1 — Image Verification Status
--  Add 'image_verification' bucket to orders.status ENUM
--  Add image_rejection_reason column
-- ============================================================
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'pending',
    'image_verification',
    'confirmed',
    'processing',
    'dispatched',
    'delivered',
    'cancelled',
    'returned',
    'refunded'
  ) NOT NULL DEFAULT 'pending' COMMENT 'image_verification = awaiting product image approval';

ALTER TABLE orders
  ADD COLUMN image_rejection_reason VARCHAR(500) NULL
    COMMENT 'Reason provided when images are rejected (CR1)'
    AFTER images_provided;

-- ============================================================
--  CR7 — Feedback Resolution Tracking
--  Add feedback_status and feedback_issue_notes to orders
-- ============================================================
ALTER TABLE orders
  ADD COLUMN feedback_status ENUM(
    'not_collected',
    'happy',
    'unhappy',
    'escalated',
    'resolved'
  ) NOT NULL DEFAULT 'not_collected'
    COMMENT 'CR7 — tracks post-delivery customer satisfaction'
    AFTER feedback_rating;

ALTER TABLE orders
  ADD COLUMN feedback_issue_notes TEXT NULL
    COMMENT 'CR7 — resolution notes when customer is unhappy'
    AFTER feedback_status;

-- Index for quick unhappy order queries
ALTER TABLE orders
  ADD INDEX ix_orders_feedback_status (feedback_status);

-- ============================================================
--  CR4 — Customer Post-Sale Lifecycle Journey
--  Add lifecycle fields to customers table
-- ============================================================
ALTER TABLE customers
  ADD COLUMN lifecycle_stage ENUM(
    'prospect',
    'customer',
    'installation_pending',
    'installation_done',
    'feedback_pending',
    'engaged'
  ) NOT NULL DEFAULT 'prospect'
    COMMENT 'CR4 — post-sale journey stage'
    AFTER status;

ALTER TABLE customers
  ADD COLUMN installation_sent_at DATETIME NULL
    COMMENT 'When installation guide WhatsApp was sent'
    AFTER lifecycle_stage;

ALTER TABLE customers
  ADD COLUMN installation_confirmed_at DATETIME NULL
    COMMENT 'When customer confirmed installation complete'
    AFTER installation_sent_at;

ALTER TABLE customers
  ADD COLUMN feedback_collected_at DATETIME NULL
    COMMENT 'When post-sale feedback was received'
    AFTER installation_confirmed_at;

ALTER TABLE customers
  ADD COLUMN engagement_notes TEXT NULL
    COMMENT 'General engagement / post-sale notes'
    AFTER feedback_collected_at;

ALTER TABLE customers
  ADD INDEX ix_customers_lifecycle_stage (lifecycle_stage);

-- ============================================================
--  CR2 — Manual Call Logs
--  New table for rep-logged phone calls (no auto-dialer)
-- ============================================================
CREATE TABLE IF NOT EXISTS manual_call_logs (
  id               CHAR(36)     NOT NULL,
  order_id         CHAR(36)         NULL  COMMENT 'Related order (optional)',
  customer_id      CHAR(36)     NOT NULL,
  user_id          CHAR(36)     NOT NULL  COMMENT 'Rep who made/logged the call',
  call_type        ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
  phone_used       VARCHAR(20)      NULL  COMMENT 'Number dialled or received on',
  duration_seconds INT              NULL  COMMENT 'Call duration in seconds',
  outcome          ENUM(
                     'answered',
                     'no_answer',
                     'busy',
                     'callback_requested',
                     'confirmed',
                     'rejected',
                     'escalated'
                   ) NOT NULL DEFAULT 'answered',
  context          ENUM(
                     'image_collection',
                     'reorder_assistance',
                     'feedback_resolution',
                     'general'
                   ) NOT NULL DEFAULT 'general'
                   COMMENT 'Which flow step triggered this call (CR2)',
  notes            TEXT             NULL,
  called_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX ix_call_logs_order_id    (order_id),
  INDEX ix_call_logs_customer_id (customer_id),
  INDEX ix_call_logs_user_id     (user_id),
  INDEX ix_call_logs_outcome     (outcome),
  INDEX ix_call_logs_called_at   (called_at),

  CONSTRAINT fk_call_logs_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_call_logs_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_call_logs_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='CR2 — manual call log by sales reps when WA gets no reply';

-- ============================================================
--  CR3 — Customer Images (inbound via WhatsApp)
--  Stores product images sent by customers for verification
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_images (
  id            CHAR(36)     NOT NULL,
  order_id      CHAR(36)         NULL,
  customer_id   CHAR(36)         NULL,
  wa_message_id VARCHAR(150)     NULL  COMMENT 'Meta message ID of the inbound image',
  media_id      VARCHAR(150)     NULL  COMMENT 'Meta media ID for downloading via API',
  file_url      VARCHAR(1000)    NULL  COMMENT 'Downloaded/stored file URL',
  mime_type     VARCHAR(100)     NULL,
  status        ENUM(
                  'received',
                  'approved',
                  'rejected'
                ) NOT NULL DEFAULT 'received',
  reviewed_by   CHAR(36)         NULL  COMMENT 'User who approved/rejected',
  reviewed_at   DATETIME         NULL,
  rejection_reason VARCHAR(500)  NULL,
  uploaded_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX ix_customer_images_order_id    (order_id),
  INDEX ix_customer_images_customer_id (customer_id),
  INDEX ix_customer_images_status      (status),
  INDEX ix_customer_images_wa_msg_id   (wa_message_id),

  CONSTRAINT fk_cust_images_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_cust_images_customer_id
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_cust_images_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='CR3 — inbound product images from customers via WhatsApp';

SET foreign_key_checks = 1;

INSERT IGNORE INTO schema_migrations (filename) VALUES ('003_cr_changes.sql');
SELECT 'Migration 003 (CR1+CR2+CR3+CR4+CR7) applied.' AS result;
