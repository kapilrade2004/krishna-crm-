-- Migration 010: Employee Onboarding & Document Management Extensions

-- Add onboarding fields to employees table
ALTER TABLE employees ADD COLUMN onboarding_status VARCHAR(30) DEFAULT 'pending';
ALTER TABLE employees ADD COLUMN user_id CHAR(36) DEFAULT NULL;
ALTER TABLE employees ADD COLUMN reporting_manager_id CHAR(36) DEFAULT NULL;

-- Create indexes for new employee columns
CREATE INDEX idx_employees_onboarding_status ON employees(onboarding_status);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_reporting_manager_id ON employees(reporting_manager_id);

-- Extend employee_documents table
ALTER TABLE employee_documents MODIFY COLUMN document_type VARCHAR(50) DEFAULT 'other';
ALTER TABLE employee_documents MODIFY COLUMN status VARCHAR(30) DEFAULT 'uploaded';
ALTER TABLE employee_documents ADD COLUMN version INT DEFAULT 1;
ALTER TABLE employee_documents ADD COLUMN is_current TINYINT(1) DEFAULT 1;
ALTER TABLE employee_documents ADD COLUMN replaced_by CHAR(36) DEFAULT NULL;
ALTER TABLE employee_documents ADD COLUMN remarks TEXT DEFAULT NULL;
ALTER TABLE employee_documents ADD COLUMN review_requested_at DATETIME DEFAULT NULL;

-- Create indexes for document status & versioning
CREATE INDEX idx_employee_documents_is_current ON employee_documents(is_current);
