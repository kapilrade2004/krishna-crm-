-- ============================================================
--  Krishna CRM — Migration 002
--  Module    : Shipping & Tracking (SOW §3.4)
--  Adds      : shipping_partners, pincode_serviceability
--  Date      : 2026-06-15
-- ============================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;

USE krishna_crm;

-- ============================================================
--  SHIPPING PARTNERS
--  Master list of courier/logistics partners. api_config is
--  reserved JSON for future live courier API credentials.
-- ============================================================
CREATE TABLE IF NOT EXISTS shipping_partners (
  id                    CHAR(36)      NOT NULL,
  name                  VARCHAR(100)  NOT NULL,
  code                  VARCHAR(20)   NOT NULL                COMMENT 'e.g. DELHIVERY, BLUEDART, DTDC',
  contact_person        VARCHAR(100)      NULL,
  contact_phone         VARCHAR(20)       NULL,
  contact_email         VARCHAR(150)      NULL,
  tracking_url_template VARCHAR(500)      NULL                COMMENT 'use {tracking_number} placeholder',
  default_tat_days      INT               NULL                COMMENT 'fallback TAT if no pincode entry',
  is_active             TINYINT(1)    NOT NULL DEFAULT 1,
  notes                 TEXT              NULL,
  api_config            JSON              NULL                COMMENT 'reserved for Phase 2 courier API creds',
  created_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME          NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_shipping_partners_name (name),
  UNIQUE KEY uq_shipping_partners_code (code),
  INDEX      ix_shipping_partners_active (is_active)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Courier / logistics partner master list';

-- ============================================================
--  PINCODE SERVICEABILITY
--  Lookup table powering "Delivery Confirmation as per Pincodes /
--  Delivery TAT" (order processing flow stage 4).
--  shipping_partner_id NULL = applies to all partners.
-- ============================================================
CREATE TABLE IF NOT EXISTS pincode_serviceability (
  id                   CHAR(36)     NOT NULL,
  pincode              VARCHAR(10)  NOT NULL,
  city                 VARCHAR(100)     NULL,
  state                VARCHAR(100)     NULL,
  shipping_partner_id  CHAR(36)         NULL,
  is_serviceable       TINYINT(1)   NOT NULL DEFAULT 1,
  tat_days             INT          NOT NULL                  COMMENT 'estimated delivery TAT in days',
  cod_available        TINYINT(1)   NOT NULL DEFAULT 1,
  notes                TEXT             NULL,
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_pincode_partner (pincode, shipping_partner_id),
  INDEX      ix_pincode_serviceability_pincode (pincode),
  INDEX      ix_pincode_serviceability_partner (shipping_partner_id),

  CONSTRAINT fk_pincode_serviceability_partner
    FOREIGN KEY (shipping_partner_id) REFERENCES shipping_partners(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Pincode-level delivery serviceability and TAT';

-- ============================================================
--  SEED: common shipping partners
-- ============================================================
INSERT IGNORE INTO shipping_partners (id, name, code, tracking_url_template, default_tat_days, is_active, created_at, updated_at)
VALUES
  (UUID(), 'Delhivery',    'DELHIVERY',  'https://www.delhivery.com/track/package/{tracking_number}', 4, 1, NOW(), NOW()),
  (UUID(), 'Blue Dart',    'BLUEDART',   'https://www.bluedart.com/tracking?trackingId={tracking_number}', 3, 1, NOW(), NOW()),
  (UUID(), 'DTDC',         'DTDC',       'https://www.dtdc.in/tracking/tracking_results.asp?strCnno={tracking_number}', 5, 1, NOW(), NOW()),
  (UUID(), 'Ecom Express', 'ECOM',       'https://ecomexpress.in/tracking/?awb_field={tracking_number}', 5, 1, NOW(), NOW()),
  (UUID(), 'Xpressbees',   'XPRESSBEES', 'https://www.xpressbees.com/track?awbNo={tracking_number}', 4, 1, NOW(), NOW());

SET foreign_key_checks = 1;

-- Mark applied
INSERT IGNORE INTO schema_migrations (filename) VALUES ('002_shipping_module.sql');

SELECT 'Migration 002 (Shipping & Tracking) applied.' AS result;
