-- ============================================================
--  Krishna CRM — Migration 004
--  Module    : Task Score Management (SOW v0.5 §3.7)
--  Date      : 2026-06-22
-- ============================================================

SET NAMES utf8mb4;
SET foreign_key_checks = 0;
USE krishna_crm;

-- ============================================================
--  TASK SCORE MANAGEMENT
--  Manager enters a score (0-10) per task with optional remarks.
--  Powers the Score Dashboard + Score Table per SOW §3.7.
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN score TINYINT NULL
    COMMENT 'Manager-assigned score 0-10 for task quality/performance'
    AFTER progress_percent;

ALTER TABLE tasks
  ADD COLUMN score_comment TEXT NULL
    COMMENT 'Manager remarks explaining the score'
    AFTER score;

ALTER TABLE tasks
  ADD COLUMN scored_by CHAR(36) NULL
    COMMENT 'Manager who assigned the score'
    AFTER score_comment;

ALTER TABLE tasks
  ADD COLUMN scored_at DATETIME NULL
    COMMENT 'When the score was assigned'
    AFTER scored_by;

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_scored_by
    FOREIGN KEY (scored_by) REFERENCES users(id)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE tasks
  ADD INDEX ix_tasks_score (score);

ALTER TABLE tasks
  ADD INDEX ix_tasks_scored_by (scored_by);

-- Composite index for score dashboard: per-user average score queries
ALTER TABLE tasks
  ADD INDEX ix_tasks_assigned_score (assigned_to, score);

SET foreign_key_checks = 1;

INSERT IGNORE INTO schema_migrations (filename) VALUES ('004_task_score.sql');
SELECT 'Migration 004 (Task Score Management) applied.' AS result;
