-- ============================================================
-- Migration 016: Daily Activities Module
-- Description: Creates operational employee activity tables
--              (daily_activities and daily_activity_history)
-- ============================================================

-- 1. Create daily_activities table
CREATE TABLE IF NOT EXISTS daily_activities (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  assigned_by CHAR(36) NOT NULL,
  assigned_to CHAR(36) NOT NULL,
  priority ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
  category VARCHAR(100) NULL,
  notes TEXT NULL,
  status ENUM('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'INCOMPLETE', 'LATE') NOT NULL DEFAULT 'ASSIGNED',
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  shift_duration INT NOT NULL DEFAULT 24,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_da_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_da_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_da_assigned_to (assigned_to),
  INDEX idx_da_assigned_by (assigned_by),
  INDEX idx_da_status (status),
  INDEX idx_da_assigned_at (assigned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create daily_activity_history table
CREATE TABLE IF NOT EXISTS daily_activity_history (
  id CHAR(36) PRIMARY KEY,
  activity_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  event_type ENUM(
    'ACTIVITY_CREATED',
    'ACTIVITY_ASSIGNED',
    'ACTIVITY_STARTED',
    'ACTIVITY_COMPLETED',
    'ACTIVITY_INCOMPLETE',
    'ACTIVITY_LATE'
  ) NOT NULL,
  old_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dah_activity_id FOREIGN KEY (activity_id) REFERENCES daily_activities(id) ON DELETE CASCADE,
  CONSTRAINT fk_dah_actor_id FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_dah_activity_id (activity_id),
  INDEX idx_dah_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
