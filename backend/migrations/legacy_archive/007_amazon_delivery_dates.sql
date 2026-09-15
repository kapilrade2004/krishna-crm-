-- ============================================================
--  Krishna CRM — Migration 007
--  Change : Add Amazon delivery window fields to orders table
--  Source : Client Excel highlighted columns (BLUE)
--           latest-ship-date, earliest-delivery-date, latest-delivery-date
--  Date   : 2026-07-11
-- ============================================================

SET NAMES utf8mb4;
USE krishna_crm;

-- latest-ship-date (BLUE) — must ship by this date
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS latest_ship_date DATETIME NULL
    COMMENT 'Amazon: latest-ship-date — must ship by this date'
    AFTER estimated_delivery_date;

-- earliest-delivery-date (BLUE) — delivery window start
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS earliest_delivery_date DATETIME NULL
    COMMENT 'Amazon: earliest-delivery-date — delivery window start'
    AFTER latest_ship_date;

-- Note: latest-delivery-date maps to existing estimated_delivery_date column
-- No new column needed — we reuse estimated_delivery_date for latest-delivery-date

ALTER TABLE orders ADD INDEX IF NOT EXISTS ix_orders_latest_ship_date (latest_ship_date);
ALTER TABLE orders ADD INDEX IF NOT EXISTS ix_orders_earliest_delivery_date (earliest_delivery_date);

INSERT IGNORE INTO schema_migrations (filename) VALUES ('007_amazon_delivery_dates.sql');
SELECT 'Migration 007 (Amazon delivery date fields) applied.' AS result;
