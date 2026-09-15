-- ============================================================
--  Krishna CRM — Migration 009
--  Change : User Access Control (Roles, Permissions & User Overrides)
--  Date   : 2026-07-28
-- ============================================================

SET NAMES utf8mb4;

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  data_scope VARCHAR(50) NOT NULL DEFAULT 'Global',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX ix_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX ix_permissions_module (module),
  INDEX ix_permissions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create Role Permissions Table
CREATE TABLE IF NOT EXISTS role_permissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_role_permission (role_id, permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create User Permissions (Per-User Overrides: Grant / Revoke)
CREATE TABLE IF NOT EXISTS user_permissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_permission (user_id, permission_id),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Alter Users Role ENUM
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'super_admin', 'manager', 'employee', 'hr', 'sales', 'support', 'ceo') NOT NULL DEFAULT 'sales';

-- 6. Insert Default System Roles
INSERT IGNORE INTO roles (id, name, description, data_scope, is_system) VALUES
('r-super-admin', 'Super admin', 'Master login with full system access and ability to grant/revoke access rights.', 'Global', TRUE),
('r-manager',     'Manager',     'Management access over teams, orders, customers, tasks, and reports.', 'Global', TRUE),
('r-employee',    'Employee',    'Operational access for standard tasks and customer interactions.', 'Global', TRUE),
('r-hr',          'Hr',          'HR access for employee profiles, documents, and management.', 'Global', TRUE),
('r-sales',       'Sales',       'Sales access for orders, customers, follow-ups, and shipping.', 'Global', TRUE);

-- 7. Insert System Permissions
INSERT IGNORE INTO permissions (id, module, action, name, description) VALUES
-- Dashboard
('p-dash-view',    'dashboard', 'view',   'dashboard:view',   'View analytical dashboard'),
-- Orders
('p-ord-view',     'orders',    'view',   'orders:view',      'View orders list and details'),
('p-ord-create',   'orders',    'create', 'orders:create',    'Create new orders'),
('p-ord-edit',     'orders',    'edit',   'orders:edit',      'Edit order details and status'),
('p-ord-delete',   'orders',    'delete', 'orders:delete',    'Delete orders'),
-- Customers
('p-cust-view',    'customers', 'view',   'customers:view',   'View customers list'),
('p-cust-create',  'customers', 'create', 'customers:create', 'Create new customers'),
('p-cust-edit',    'customers', 'edit',   'customers:edit',   'Edit customer details'),
('p-cust-delete',  'customers', 'delete', 'customers:delete', 'Delete customers'),
-- Shipping
('p-ship-view',    'shipping',  'view',   'shipping:view',    'View shipping and tracking'),
('p-ship-edit',    'shipping',  'edit',   'shipping:edit',    'Update shipping status'),
-- Follow-Ups
('p-fup-view',     'followups', 'view',   'followups:view',   'View follow-up reminders'),
('p-fup-create',   'followups', 'create', 'followups:create', 'Create follow-up reminders'),
('p-fup-edit',     'followups', 'edit',   'followups:edit',   'Update follow-up status'),
-- Tasks
('p-task-view',    'tasks',     'view',   'tasks:view',       'View tasks'),
('p-task-create',  'tasks',     'create', 'tasks:create',     'Create new tasks'),
('p-task-edit',    'tasks',     'edit',   'tasks:edit',       'Update and score tasks'),
('p-task-delete',  'tasks',     'delete', 'tasks:delete',     'Delete tasks'),
-- CSV Import
('p-csv-import',   'csv',       'import', 'csv:import',       'Import CSV files'),
-- Reports
('p-rep-view',     'reports',   'view',   'reports:view',     'View sales and operational reports'),
-- Employees
('p-emp-view',     'employees', 'view',   'employees:view',   'View employee directory'),
('p-emp-create',   'employees', 'create', 'employees:create', 'Create employee profiles'),
('p-emp-edit',     'employees', 'edit',   'employees:edit',   'Edit employee records'),
('p-emp-delete',   'employees', 'delete', 'employees:delete', 'Delete employee records'),
-- Users & Rights
('p-usr-view',     'users',     'view',   'users:view',       'View system users list'),
('p-usr-manage',   'users',     'manage', 'users:manage',     'Create and activate/deactivate users'),
('p-acc-manage',   'access',    'manage', 'access:manage',    'Give and revoke access rights to users');

-- 8. Map Default Permissions to Roles
-- Super Admin (All Permissions)
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
('rp-sa-1',  'r-super-admin', 'p-dash-view'),
('rp-sa-2',  'r-super-admin', 'p-ord-view'),
('rp-sa-3',  'r-super-admin', 'p-ord-create'),
('rp-sa-4',  'r-super-admin', 'p-ord-edit'),
('rp-sa-5',  'r-super-admin', 'p-ord-delete'),
('rp-sa-6',  'r-super-admin', 'p-cust-view'),
('rp-sa-7',  'r-super-admin', 'p-cust-create'),
('rp-sa-8',  'r-super-admin', 'p-cust-edit'),
('rp-sa-9',  'r-super-admin', 'p-cust-delete'),
('rp-sa-10', 'r-super-admin', 'p-ship-view'),
('rp-sa-11', 'r-super-admin', 'p-ship-edit'),
('rp-sa-12', 'r-super-admin', 'p-fup-view'),
('rp-sa-13', 'r-super-admin', 'p-fup-create'),
('rp-sa-14', 'r-super-admin', 'p-fup-edit'),
('rp-sa-15', 'r-super-admin', 'p-task-view'),
('rp-sa-16', 'r-super-admin', 'p-task-create'),
('rp-sa-17', 'r-super-admin', 'p-task-edit'),
('rp-sa-18', 'r-super-admin', 'p-task-delete'),
('rp-sa-19', 'r-super-admin', 'p-csv-import'),
('rp-sa-20', 'r-super-admin', 'p-rep-view'),
('rp-sa-21', 'r-super-admin', 'p-emp-view'),
('rp-sa-22', 'r-super-admin', 'p-emp-create'),
('rp-sa-23', 'r-super-admin', 'p-emp-edit'),
('rp-sa-24', 'r-super-admin', 'p-emp-delete'),
('rp-sa-25', 'r-super-admin', 'p-usr-view'),
('rp-sa-26', 'r-super-admin', 'p-usr-manage'),
('rp-sa-27', 'r-super-admin', 'p-acc-manage');

-- Manager
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
('rp-mgr-1',  'r-manager', 'p-dash-view'),
('rp-mgr-2',  'r-manager', 'p-ord-view'),
('rp-mgr-3',  'r-manager', 'p-ord-create'),
('rp-mgr-4',  'r-manager', 'p-ord-edit'),
('rp-mgr-5',  'r-manager', 'p-cust-view'),
('rp-mgr-6',  'r-manager', 'p-cust-create'),
('rp-mgr-7',  'r-manager', 'p-cust-edit'),
('rp-mgr-8',  'r-manager', 'p-ship-view'),
('rp-mgr-9',  'r-manager', 'p-ship-edit'),
('rp-mgr-10', 'r-manager', 'p-fup-view'),
('rp-mgr-11', 'r-manager', 'p-fup-create'),
('rp-mgr-12', 'r-manager', 'p-fup-edit'),
('rp-mgr-13', 'r-manager', 'p-task-view'),
('rp-mgr-14', 'r-manager', 'p-task-create'),
('rp-mgr-15', 'r-manager', 'p-task-edit'),
('rp-mgr-16', 'r-manager', 'p-csv-import'),
('rp-mgr-17', 'r-manager', 'p-rep-view');

-- Employee
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
('rp-emp-1', 'r-employee', 'p-dash-view'),
('rp-emp-2', 'r-employee', 'p-task-view'),
('rp-emp-3', 'r-employee', 'p-task-edit'),
('rp-emp-4', 'r-employee', 'p-fup-view'),
('rp-emp-5', 'r-employee', 'p-fup-edit');

-- Hr
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
('rp-hr-1', 'r-hr', 'p-emp-view'),
('rp-hr-2', 'r-hr', 'p-emp-create'),
('rp-hr-3', 'r-hr', 'p-emp-edit'),
('rp-hr-4', 'r-hr', 'p-emp-delete');

-- Sales
INSERT IGNORE INTO role_permissions (id, role_id, permission_id) VALUES
('rp-sal-1', 'r-sales', 'p-dash-view'),
('rp-sal-2', 'r-sales', 'p-ord-view'),
('rp-sal-3', 'r-sales', 'p-ord-create'),
('rp-sal-4', 'r-sales', 'p-ord-edit'),
('rp-sal-5', 'r-sales', 'p-cust-view'),
('rp-sal-6', 'r-sales', 'p-cust-create'),
('rp-sal-7', 'r-sales', 'p-cust-edit'),
('rp-sal-8', 'r-sales', 'p-ship-view'),
('rp-sal-9', 'r-sales', 'p-fup-view'),
('rp-sal-10','r-sales', 'p-fup-create'),
('rp-sal-11','r-sales', 'p-fup-edit'),
('rp-sal-12','r-sales', 'p-task-view'),
('rp-sal-13','r-sales', 'p-task-create'),
('rp-sal-14','r-sales', 'p-csv-import');
