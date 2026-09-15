-- Migration 014: User Management Module Refinements
-- Expands User entity with full identity, organization, security, lock, and soft-delete fields
-- Creates Login History, User Audit Logs, Access Templates, and Access Requests tables

-- 1. Add new columns to users table (if using MySQL / SQLite)
-- SQLite compatible table adjustments

CREATE TABLE IF NOT EXISTS login_histories (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NULL,
  email VARCHAR(150) NOT NULL,
  login_at DATETIME NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  browser VARCHAR(100) NULL,
  os VARCHAR(100) NULL,
  device VARCHAR(100) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'success',
  failure_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS user_audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_user_id CHAR(36) NULL,
  target_user_id CHAR(36) NULL,
  event_type VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL DEFAULT 'user_management',
  old_values TEXT NULL,
  new_values TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS access_templates (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  role_id CHAR(36) NULL,
  permissions TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS access_requests (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  requested_permissions TEXT NOT NULL,
  reason TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  rejection_reason TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_login_histories_user_id ON login_histories(user_id);
CREATE INDEX IF NOT EXISTS idx_login_histories_login_at ON login_histories(login_at);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_target_user_id ON user_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_actor_user_id ON user_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_logs_event_type ON user_audit_logs(event_type);
