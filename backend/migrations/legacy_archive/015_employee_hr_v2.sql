-- ============================================================
-- Migration 015: Employee Management & HR Module
-- Description: Adds employment lifecycle fields, probation, confirmation,
--              offboarding fields to employees, and creates
--              payroll_profiles and payroll_records tables.
-- ============================================================

-- 1. Extend employees table with lifecycle fields
ALTER TABLE employees ADD COLUMN probation_end_date DATE;
ALTER TABLE employees ADD COLUMN confirmation_date DATE;
ALTER TABLE employees ADD COLUMN exit_date DATE;
ALTER TABLE employees ADD COLUMN exit_reason VARCHAR(255);
ALTER TABLE employees ADD COLUMN handover_notes TEXT;
ALTER TABLE employees ADD COLUMN offboarded_by CHAR(36);
ALTER TABLE employees ADD COLUMN offboarded_at DATETIME;

-- 2. Create payroll_profiles table
CREATE TABLE IF NOT EXISTS payroll_profiles (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL UNIQUE,
  salary_type VARCHAR(30) DEFAULT 'monthly', -- monthly, hourly
  basic_salary DECIMAL(12,2) DEFAULT 0.00,
  fixed_allowances DECIMAL(12,2) DEFAULT 0.00,
  fixed_deductions DECIMAL(12,2) DEFAULT 0.00,
  net_payable_reference DECIMAL(12,2) DEFAULT 0.00,
  effective_from DATE,
  payment_method VARCHAR(50) DEFAULT 'bank_transfer', -- bank_transfer, cheque, cash, upi
  bank_account_reference VARCHAR(100),
  bank_name VARCHAR(100),
  bank_ifsc VARCHAR(50),
  pan_number VARCHAR(30),
  status VARCHAR(30) DEFAULT 'active', -- active, inactive, on_hold
  created_by CHAR(36),
  updated_by CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- 3. Create payroll_records table
CREATE TABLE IF NOT EXISTS payroll_records (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  payroll_month VARCHAR(7) NOT NULL, -- YYYY-MM e.g. 2026-08
  gross_amount DECIMAL(12,2) DEFAULT 0.00,
  allowances DECIMAL(12,2) DEFAULT 0.00,
  deductions DECIMAL(12,2) DEFAULT 0.00,
  net_amount DECIMAL(12,2) DEFAULT 0.00,
  payment_status VARCHAR(30) DEFAULT 'draft', -- draft, approved, processed, cancelled
  processed_by CHAR(36),
  processed_at DATETIME,
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  transaction_reference VARCHAR(100),
  remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payroll_records_emp_month ON payroll_records (employee_id, payroll_month);
CREATE INDEX IF NOT EXISTS idx_payroll_records_month ON payroll_records (payroll_month);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records (payment_status);
