-- Migration 011: Employee Audit System
-- Creates audit event logging and daily summary aggregation tables

CREATE TABLE IF NOT EXISTS employee_audit_events (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  actor_user_id CHAR(36) NULL,
  event_type VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id CHAR(36) NULL,
  metadata TEXT NULL,
  old_values TEXT NULL,
  new_values TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eae_employee_id ON employee_audit_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_eae_user_id ON employee_audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_eae_event_type ON employee_audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_eae_module ON employee_audit_events(module);
CREATE INDEX IF NOT EXISTS idx_eae_created_at ON employee_audit_events(created_at);

CREATE TABLE IF NOT EXISTS employee_audit_daily_summaries (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  user_id CHAR(36) NULL,
  date DATE NOT NULL,
  present BOOLEAN DEFAULT 0,
  late BOOLEAN DEFAULT 0,
  leave BOOLEAN DEFAULT 0,
  half_day BOOLEAN DEFAULT 0,
  work_hours DECIMAL(4,2) DEFAULT 0.00,
  
  -- Offline / Sales Executive metrics
  customer_interactions INT DEFAULT 0,
  new_customers INT DEFAULT 0,
  followups_created INT DEFAULT 0,
  followups_completed INT DEFAULT 0,
  calls_logged INT DEFAULT 0,
  orders_created INT DEFAULT 0,
  orders_completed INT DEFAULT 0,
  units_sold INT DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0.00,
  
  tasks_assigned INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  daily_tasks_assigned INT DEFAULT 0,
  daily_tasks_completed INT DEFAULT 0,
  
  -- Technician metrics
  jobs_assigned INT DEFAULT 0,
  jobs_accepted INT DEFAULT 0,
  jobs_completed INT DEFAULT 0,
  pending_jobs INT DEFAULT 0,
  installations INT DEFAULT 0,
  repairs INT DEFAULT 0,
  maintenance_visits INT DEFAULT 0,
  customer_visits INT DEFAULT 0,
  total_completion_time_minutes INT DEFAULT 0,
  
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_eads_employee_date ON employee_audit_daily_summaries(employee_id, date);
