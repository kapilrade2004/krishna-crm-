'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// Role to Department & Designation mapping
const ROLE_METADATA = {
  super_admin:             { department: 'Administration', designation: 'Super Admin', prefix: 'KR-ADM' },
  admin:                   { department: 'Administration', designation: 'Administrator', prefix: 'KR-ADM' },
  manager:                 { department: 'Operations', designation: 'Operations Manager', prefix: 'KR-MGR' },
  hr:                      { department: 'Human Resources', designation: 'HR Manager', prefix: 'KR-HR' },
  sales:                   { department: 'Sales & Business', designation: 'Sales Executive', prefix: 'KR-SAL' },
  telecaller:              { department: 'Customer Support', designation: 'Telecaller Executive', prefix: 'KR-TEL' },
  technician:              { department: 'Technical & Service', designation: 'Field Technician', prefix: 'KR-TEC' },
  reviewer:                { department: 'Quality Assurance', designation: 'Reviewer / QA Analyst', prefix: 'KR-REV' },
  accountant:              { department: 'Finance & Accounts', designation: 'Accountant', prefix: 'KR-ACC' },
  spn_ads_manager:         { department: 'Marketing & Ads', designation: 'SPN Ads Manager', prefix: 'KR-SPN' },
  senior_account_manager:  { department: 'Key Accounts', designation: 'Senior Account Manager', prefix: 'KR-SAM' },
  delivery_boy:            { department: 'Logistics & Dispatch', designation: 'Delivery Associate', prefix: 'KR-DEL' },
  ecommerce_executive:     { department: 'E-Commerce Operations', designation: 'E-Commerce Executive', prefix: 'KR-ECM' },
  employee:                { department: 'General Operations', designation: 'Operations Associate', prefix: 'KR-EMP' },
  ceo:                     { department: 'Executive Management', designation: 'Chief Executive Officer', prefix: 'KR-CEO' },
  support:                 { department: 'Customer Support', designation: 'Support Specialist', prefix: 'KR-SUP' },
};

/**
 * Parses full name into first_name and last_name
 */
function parseName(fullName = '') {
  const parts = String(fullName).trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return { first_name: 'Team', last_name: 'Member' };
  if (parts.length === 1) return { first_name: parts[0], last_name: 'Staff' };
  const first_name = parts[0];
  const last_name = parts.slice(1).join(' ');
  return { first_name, last_name };
}

/**
 * Synchronizes a single User into the Employee directory
 */
async function syncUserToEmployee(user, options = {}) {
  const { User, Employee } = require('../models');
  if (!user || !user.id) return null;

  try {
    const rawUser = typeof user.toJSON === 'function' ? user.toJSON() : user;
    const roleKey = String(rawUser.role || 'employee').toLowerCase();
    const meta = ROLE_METADATA[roleKey] || {
      department: rawUser.department || 'General',
      designation: rawUser.designation || 'Staff Associate',
      prefix: 'KR-EMP',
    };

    const { first_name, last_name } = parseName(rawUser.first_name && rawUser.last_name ? `${rawUser.first_name} ${rawUser.last_name}` : rawUser.name);
    const cleanFirstName = (first_name && first_name.trim()) || 'Team';
    const cleanLastName = (last_name && last_name.trim()) || 'Member';
    const department = rawUser.department || meta.department;
    const designation = rawUser.designation || meta.designation;
    const email = rawUser.email ? rawUser.email.toLowerCase().trim() : null;
    const status = ['inactive', 'suspended', 'locked', 'archived'].includes(rawUser.status) ? 'inactive' : 'active';

    // Check if Employee record already exists for this User ID or Email (avoiding collation mismatch in Op.or)
    let employee = await Employee.findOne({
      where: { user_id: rawUser.id },
      transaction: options.transaction,
    });

    if (!employee && email) {
      employee = await Employee.findOne({
        where: { email },
        transaction: options.transaction,
      });
    }

    if (employee) {
      // Update employee record with latest user attributes
      const updateData = {
        first_name: cleanFirstName !== 'Team' ? cleanFirstName : employee.first_name,
        last_name: cleanLastName !== 'Member' ? cleanLastName : employee.last_name,
        phone: rawUser.phone !== undefined ? rawUser.phone : employee.phone,
        department: department || employee.department,
        designation: designation || employee.designation,
        status,
      };

      // Only assign user_id if not already bound to another distinct user
      if (!employee.user_id || employee.user_id === rawUser.id) {
        updateData.user_id = rawUser.id;
      }

      await employee.update(updateData, { transaction: options.transaction });
    } else {
      // Determine unique target email (nullify if already taken by another employee to prevent UNIQUE crash)
      let targetEmail = email;
      if (targetEmail) {
        const emailTaken = await Employee.findOne({
          where: { email: targetEmail },
          transaction: options.transaction,
        });
        if (emailTaken) {
          targetEmail = null;
        }
      }

      // Generate code
      let employeeCode = rawUser.employee_id;
      if (!employeeCode) {
        const count = await Employee.count({ transaction: options.transaction });
        employeeCode = `${meta.prefix}-${String(count + 1).padStart(3, '0')}`;
      }

      // Ensure code is globally unique
      let existingCode = await Employee.findOne({ where: { employee_code: employeeCode }, transaction: options.transaction });
      while (existingCode) {
        employeeCode = `${meta.prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
        existingCode = await Employee.findOne({ where: { employee_code: employeeCode }, transaction: options.transaction });
      }

      try {
        employee = await Employee.create(
          {
            id: uuidv4(),
            user_id: rawUser.id,
            employee_code: employeeCode,
            first_name: cleanFirstName,
            last_name: cleanLastName,
            email: targetEmail,
            phone: rawUser.phone || null,
            department,
            designation,
            status,
            employment_type: 'full_time',
            date_of_joining: new Date().toISOString().slice(0, 10),
            onboarding_status: 'completed',
            salary: 30000.0,
          },
          { transaction: options.transaction }
        );
      } catch (createErr) {
        // Fallback retry with anonymous code and null email if unique constraint tripped
        const fallbackCode = `${meta.prefix}-${Date.now().toString().slice(-6)}`;
        employee = await Employee.create(
          {
            id: uuidv4(),
            user_id: rawUser.id,
            employee_code: fallbackCode,
            first_name: cleanFirstName,
            last_name: cleanLastName,
            email: null,
            phone: rawUser.phone || null,
            department,
            designation,
            status,
            employment_type: 'full_time',
            date_of_joining: new Date().toISOString().slice(0, 10),
            onboarding_status: 'completed',
            salary: 30000.0,
          },
          { transaction: options.transaction }
        );
      }
    }

    // Link user.employee_id back to employee.employee_code if not set
    if (!rawUser.employee_id && employee.employee_code) {
      await User.update(
        { employee_id: employee.employee_code },
        { where: { id: rawUser.id }, transaction: options.transaction }
      ).catch(() => {});
    }

    return employee;
  } catch (err) {
    const errorDetails = err.errors && Array.isArray(err.errors)
      ? err.errors.map(e => `${e.path || e.type}: ${e.message}`).join(', ')
      : err.message;
    logger.warn(`Failed to sync user ${user.id} to employee directory: ${errorDetails}`);
    return null;
  }
}

/**
 * Synchronizes ALL Users in the database into the Employee directory
 */
async function syncAllUsersToEmployees() {
  const { User, Employee } = require('../models');
  try {
    const users = await User.findAll();
    logger.info(`Checking and synchronizing ${users.length} user(s) with Employee directory...`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const u of users) {
      const existingEmp = await Employee.findOne({ where: { user_id: u.id } });
      const emp = await syncUserToEmployee(u);
      if (emp) {
        if (!existingEmp) createdCount++;
        else updatedCount++;
      }
    }

    logger.info(`User-Employee synchronization completed: ${createdCount} new employee(s) created, ${updatedCount} updated.`);
    return { totalUsers: users.length, createdCount, updatedCount };
  } catch (err) {
    logger.error('Error in syncAllUsersToEmployees:', err);
    throw err;
  }
}

module.exports = {
  syncUserToEmployee,
  syncAllUsersToEmployees,
  ROLE_METADATA,
};
