-- ============================================================
--  Krishna CRM — Migration 013
--  Manual Order Processing & Verification Module
-- ============================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

ALTER TABLE orders
  ADD COLUMN verification_status ENUM(
    'pending_verification',
    'image_received',
    'verification_in_review',
    'sku_matched',
    'sku_mismatched',
    'image_unreadable',
    'product_not_found',
    'pending_confirmation',
    'confirmed',
    'cancelled',
    'verification_exception'
  ) NOT NULL DEFAULT 'pending_verification'
  COMMENT 'Manual SKU verification state' AFTER status;

ALTER TABLE orders
  ADD COLUMN verified_by CHAR(36) NULL
  COMMENT 'User/Employee who manually verified SKU' AFTER verification_status;

ALTER TABLE orders
  ADD COLUMN verified_at DATETIME NULL
  COMMENT 'Timestamp when manual verification decision was saved' AFTER verified_by;

ALTER TABLE orders
  ADD COLUMN verification_notes TEXT NULL
  COMMENT 'Notes/remarks during manual verification' AFTER verified_at;

ALTER TABLE orders
  ADD COLUMN confirmation_sent_at DATETIME NULL
  COMMENT 'Timestamp when WhatsApp confirmation message was sent' AFTER verification_notes;

ALTER TABLE orders
  ADD COLUMN customer_confirmed_at DATETIME NULL
  COMMENT 'Timestamp when customer clicked confirm on WhatsApp' AFTER confirmation_sent_at;

ALTER TABLE orders
  ADD INDEX ix_orders_verification_status (verification_status);

ALTER TABLE orders
  ADD INDEX ix_orders_verified_by (verified_by);

SET foreign_key_checks = 1;
