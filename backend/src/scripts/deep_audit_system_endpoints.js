'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const jwt = require('jsonwebtoken');
const { sequelize, connectDB } = require('../config/database');
const { User, Employee, Role, Permission } = require('../models');

// Import all routers
const authRoutes = require('../routes/auth');
const customerRoutes = require('../routes/customers');
const orderRoutes = require('../routes/orders');
const followUpRoutes = require('../routes/followUps');
const taskRoutes = require('../routes/tasks');
const csvRoutes = require('../routes/csv');
const dashboardRoutes = require('../routes/dashboard');
const whatsappRoutes = require('../routes/whatsapp');
const reportRoutes = require('../routes/reports');
const shippingRoutes = require('../routes/shipping');
const callLogRoutes = require('../routes/callLogs');
const employeeRoutes = require('../routes/employees');
const userAccessRoutes = require('../routes/userAccess');
const dailyTaskRoutes = require('../routes/dailyTask');
const employeeAuditRoutes = require('../routes/employeeAudit');
const warrantyRoutes = require('../routes/warranty.routes');
const settingsRoutes = require('../routes/settings');
const payrollRoutes = require('../routes/payroll');
const hrRoutes = require('../routes/hr.routes');

async function runDeepAudit() {
  console.log('🔍 Starting Deep System-Wide Endpoint & Connection Audit...');
  await connectDB();

  // Create Express audit app
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Mount Health Check
  app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

  // Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/hr', hrRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/follow-ups', followUpRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/csv', csvRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/shipping', shippingRoutes);
  app.use('/api/call-logs', callLogRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/user-access', userAccessRoutes);
  app.use('/api/user-management', userAccessRoutes);
  app.use('/api/daily-tasks', dailyTaskRoutes);
  app.use('/api/employee-audit', employeeAuditRoutes);
  app.use('/api/warranty', warrantyRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/settings', settingsRoutes);

  // Global Error Handler
  app.use((err, req, res, next) => {
    res.status(err.statusCode || err.status || 500).json({
      success: false,
      status: 'error',
      message: err.message,
    });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Find or create admin user for testing
  let admin = await User.findOne({ where: { role: 'admin' } });
  if (!admin) {
    admin = await User.findOne();
  }
  const token = jwt.sign(
    { id: admin.id },
    process.env.JWT_SECRET || '3952671983632f1273b28ee10e8e65bc8a1b41020af50146652a74f0a91a132ca6c40a5657241a6ef4b01a60dcb17725f0e3a8fd7ea15ea287516fb4a16a565c',
    { expiresIn: '7d' }
  );
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Find sample employee for targeted tests
  const sampleEmployee = await Employee.findOne();
  const sampleEmpId = sampleEmployee ? sampleEmployee.id : admin.id;

  const endpointsToTest = [
    // 1. Health
    { method: 'GET', url: '/health', auth: false, desc: 'System Health Check' },

    // 2. Auth Module
    { method: 'GET', url: '/api/auth/demo-accounts', auth: false, desc: 'Auth: Demo Accounts' },
    { method: 'GET', url: '/api/auth/me', auth: true, desc: 'Auth: Current User Profile' },
    { method: 'GET', url: '/api/auth/users', auth: true, desc: 'Auth: Users List' },

    // 3. User Management & Access Control
    { method: 'GET', url: '/api/user-access/users', auth: true, desc: 'User Access: Full User Directory' },
    { method: 'GET', url: '/api/user-access/roles', auth: true, desc: 'User Access: Roles Matrix' },
    { method: 'GET', url: '/api/user-access/permissions', auth: true, desc: 'User Access: System Permissions' },
    { method: 'GET', url: '/api/user-access/login-history', auth: true, desc: 'User Access: Login History Log' },
    { method: 'GET', url: '/api/user-access/audit-logs', auth: true, desc: 'User Access: User Audit Trail' },
    { method: 'GET', url: '/api/user-access/templates', auth: true, desc: 'User Access: Role Templates' },

    // 4. Employee Management & HR Module
    { method: 'GET', url: '/api/employees', auth: true, desc: 'Employees: Directory' },
    { method: 'GET', url: `/api/employees/${sampleEmpId}`, auth: true, desc: 'Employees: Profile & 5 Mandatory Docs' },
    { method: 'GET', url: `/api/employees/${sampleEmpId}/onboarding`, auth: true, desc: 'Employees: Onboarding Progress' },
    { method: 'GET', url: '/api/hr/attendance', auth: true, desc: 'HR: Attendance Records' },
    { method: 'GET', url: '/api/hr/payroll', auth: true, desc: 'HR: Payroll Matrix' },
    { method: 'GET', url: '/api/hr/policies', auth: true, desc: 'HR: Policy Documents' },

    // 5. Payroll Module
    { method: 'GET', url: `/api/payroll/profile/${sampleEmpId}`, auth: true, desc: 'Payroll: Compensation Structure' },
    { method: 'GET', url: `/api/payroll/history/${sampleEmpId}`, auth: true, desc: 'Payroll: Payslip History' },
    { method: 'GET', url: '/api/payroll/records', auth: true, desc: 'Payroll: All Records' },

    // 6. Operations: Customers & Orders
    { method: 'GET', url: '/api/customers', auth: true, desc: 'Operations: Customers List' },
    { method: 'GET', url: '/api/orders', auth: true, desc: 'Operations: Orders Directory' },
    { method: 'GET', url: '/api/follow-ups', auth: true, desc: 'Operations: Pending Follow-ups' },
    { method: 'GET', url: '/api/call-logs', auth: true, desc: 'Operations: Manual Call Logs' },

    // 7. Tasks & Daily Tasks
    { method: 'GET', url: '/api/tasks', auth: true, desc: 'Tasks: Operational Tasks' },
    { method: 'GET', url: '/api/tasks/dashboard', auth: true, desc: 'Tasks: Dashboard Metrics' },
    { method: 'GET', url: '/api/tasks/score-dashboard', auth: true, desc: 'Tasks: Score Leaderboard' },
    { method: 'GET', url: '/api/tasks/unscored', auth: true, desc: 'Tasks: Unscored Tasks' },
    { method: 'GET', url: '/api/daily-tasks', auth: true, desc: 'Daily Tasks: Daily Assignments' },
    { method: 'GET', url: '/api/daily-tasks/assignable-users', auth: true, desc: 'Daily Tasks: Assignable Users' },

    // 8. Employee Audit & Activity
    { method: 'GET', url: '/api/employee-audit/employees', auth: true, desc: 'Employee Audit: Employees Summary' },
    { method: 'GET', url: `/api/employee-audit/${sampleEmpId}`, auth: true, desc: 'Employee Audit: Employee Profile' },
    { method: 'GET', url: `/api/employee-audit/${sampleEmpId}/metrics`, auth: true, desc: 'Employee Audit: Performance Metrics' },
    { method: 'GET', url: `/api/employee-audit/${sampleEmpId}/activity`, auth: true, desc: 'Employee Audit: Chronological Activity' },

    // 9. Warranty & Service Requests
    { method: 'GET', url: '/api/warranty/stats', auth: true, desc: 'Warranty: Dashboard Stats' },
    { method: 'GET', url: '/api/warranty/sku-products', auth: true, desc: 'Warranty: SKU Products' },
    { method: 'GET', url: '/api/warranty/customers-by-sku', auth: true, desc: 'Warranty: Customers by SKU' },
    { method: 'GET', url: '/api/warranty', auth: true, desc: 'Warranty: Warranty Registrations' },

    // 10. Shipping & Logistics
    { method: 'GET', url: '/api/shipping/partners', auth: true, desc: 'Shipping: Courier Partners' },
    { method: 'GET', url: '/api/shipping/dashboard', auth: true, desc: 'Shipping: Delivery KPIs' },

    // 11. Dashboard & Reports
    { method: 'GET', url: '/api/dashboard/kpis', auth: true, desc: 'Dashboard: Core KPIs' },
    { method: 'GET', url: '/api/dashboard/ceo', auth: true, desc: 'Dashboard: CEO High-Level View' },
    { method: 'GET', url: '/api/reports/sales', auth: true, desc: 'Reports: Sales Analysis' },
    { method: 'GET', url: '/api/reports/customers', auth: true, desc: 'Reports: Customer Growth' },
    { method: 'GET', url: '/api/reports/team', auth: true, desc: 'Reports: Team Performance' },

    // 12. CSV & WhatsApp
    { method: 'GET', url: '/api/csv/batches', auth: true, desc: 'CSV: Import Batches' },
    { method: 'GET', url: '/api/whatsapp/logs', auth: true, desc: 'WhatsApp: Notification Logs' },
  ];

  let passed = 0;
  let failed = 0;

  for (const ep of endpointsToTest) {
    try {
      const res = await fetch(`${baseUrl}${ep.url}`, {
        method: ep.method,
        headers: ep.auth ? headers : { 'Content-Type': 'application/json' },
      });

      const json = await res.json().catch(() => null);
      if (res.status >= 200 && res.status < 400) {
        console.log(`✅ [${res.status}] ${ep.desc} -> ${ep.method} ${ep.url}`);
        passed++;
      } else {
        console.error(`❌ [${res.status}] ${ep.desc} -> ${ep.method} ${ep.url}`, json);
        failed++;
      }
    } catch (err) {
      console.error(`💥 [ERROR] ${ep.desc} -> ${ep.method} ${ep.url}`, err.message);
      failed++;
    }
  }

  server.close();
  console.log(`\n========================================`);
  console.log(`Audit Finished: ${passed} PASSED, ${failed} FAILED (Total: ${endpointsToTest.length})`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runDeepAudit().catch((err) => {
  console.error('Fatal Audit Failure:', err);
  process.exit(1);
});
