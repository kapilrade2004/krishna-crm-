'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const jwt = require('jsonwebtoken');
const { sequelize, connectDB } = require('../config/database');
const { User, Employee, Customer, Order, Warranty } = require('../models');

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

async function runMutationAudit() {
  console.log('🔄 Starting Deep System Mutation & Write Workflow Audit...');
  await connectDB();

  const app = express();
  app.use(express.json());
  app.use(cookieParser());

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

  let admin = await User.findOne({ where: { role: 'admin' } });
  if (!admin) admin = await User.findOne();

  const token = jwt.sign(
    { id: admin.id },
    process.env.JWT_SECRET || '3952671983632f1273b28ee10e8e65bc8a1b41020af50146652a74f0a91a132ca6c40a5657241a6ef4b01a60dcb17725f0e3a8fd7ea15ea287516fb4a16a565c',
    { expiresIn: '7d' }
  );
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const ts = Date.now();
  let passed = 0;
  let failed = 0;

  async function testReq(desc, method, url, body = null) {
    try {
      const opts = {
        method,
        headers,
      };
      if (body) opts.body = JSON.stringify(body);

      const res = await fetch(`${baseUrl}${url}`, opts);
      const json = await res.json().catch(() => null);

      if (res.status >= 200 && res.status < 400) {
        console.log(`✅ [${res.status}] ${desc} -> ${method} ${url}`);
        passed++;
        return json;
      } else {
        console.error(`❌ [${res.status}] ${desc} -> ${method} ${url}`, json);
        failed++;
        return null;
      }
    } catch (err) {
      console.error(`💥 [ERROR] ${desc} -> ${method} ${url}: ${err.message}`);
      failed++;
      return null;
    }
  }

  // 1. User Management Mutations
  const userPayload = {
    name: `Audit User ${ts}`,
    email: `audit_${ts}@krishnacrm.com`,
    password: 'Password@12345',
    role: 'sales',
    phone: '9988776655',
    department: 'Sales',
    designation: 'Executive',
  };
  const createRes = await testReq('Create New User', 'POST', '/api/user-access/users', userPayload);
  const testUserId = createRes?.data?.user?.id || createRes?.data?.id;

  if (testUserId) {
    await testReq('Update User Profile', 'PATCH', `/api/user-access/users/${testUserId}`, {
      name: `Updated Audit User ${ts}`,
      phone: '9988776600',
    });

    await testReq('Reset User Password', 'POST', `/api/user-access/users/${testUserId}/reset-password`, {
      new_password: 'NewPassword@12345',
    });

    await testReq('Lock / Unlock User Account', 'POST', `/api/user-access/users/${testUserId}/lock`, {
      lock: true,
      reason: 'Audit Testing',
    });

    await testReq('Unlock User Account', 'POST', `/api/user-access/users/${testUserId}/lock`, {
      lock: false,
    });
  }

  // 2. Customer & Order Mutations
  const custPayload = {
    name: `Audit Customer ${ts}`,
    phone: `9188${ts.toString().slice(-6)}`,
    email: `customer_${ts}@example.com`,
    city: 'Mumbai',
    state: 'Maharashtra',
    address_line1: '100 Industrial Area',
  };
  const custRes = await testReq('Create Customer', 'POST', '/api/customers', custPayload);
  const custId = custRes?.data?.customer?.id || custRes?.data?.id;

  let orderId = null;
  if (custId) {
    await testReq('Update Customer', 'PATCH', `/api/customers/${custId}`, {
      city: 'Pune',
    });

    const orderPayload = {
      customer_id: custId,
      marketplace: 'amazon',
      marketplace_order_id: `AMZ-AUDIT-${ts}`,
      product_name: 'Aqua RO 2000 Premier Purifier',
      product_sku: 'AKUA-RO-2000',
      quantity: 1,
      total_amount: 15999,
      status: 'pending_verification',
      address_city: 'Pune',
    };
    const orderRes = await testReq('Create Order', 'POST', '/api/orders', orderPayload);
    orderId = orderRes?.data?.order?.id || orderRes?.data?.id;

    if (orderId) {
      await testReq('Update Order Status', 'PATCH', `/api/orders/${orderId}`, {
        status: 'verified',
        verification_method: 'manual_call',
      });
    }
  }

  // 3. Operational Tasks Mutations
  const taskPayload = {
    title: `Audit Task ${ts}`,
    description: 'Verify system integrity',
    priority: 'high',
    status: 'todo',
    assigned_to: admin.id,
    due_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
  };
  const taskRes = await testReq('Create Operational Task', 'POST', '/api/tasks', taskPayload);
  const taskId = taskRes?.data?.task?.id || taskRes?.data?.id;

  if (taskId) {
    await testReq('Update Task Details', 'PATCH', `/api/tasks/${taskId}`, {
      status: 'done',
    });
    await testReq('Score Completed Task', 'PATCH', `/api/tasks/${taskId}/score`, {
      score: 9.5,
      score_comment: 'Excellent execution',
    });
    await testReq('Delete Task', 'DELETE', `/api/tasks/${taskId}`);
  }

  // 4. Daily Tasks Mutations
  const dtPayload = {
    title: `Audit Daily Task ${ts}`,
    description: 'Daily operational verification',
    assigned_to: admin.id,
    target_date: new Date().toISOString().split('T')[0],
  };
  const dtRes = await testReq('Create Daily Task', 'POST', '/api/daily-tasks', dtPayload);
  const dtId = dtRes?.data?.dailyTask?.id || dtRes?.data?.id;

  if (dtId) {
    await testReq('Update Daily Task Status', 'PATCH', `/api/daily-tasks/${dtId}/status`, {
      status: 'completed',
      remarks: 'Done during audit',
    });
    await testReq('Delete Daily Task', 'DELETE', `/api/daily-tasks/${dtId}`);
  }

  // 5. Warranty Mutations
  const sampleEmp = await Employee.findOne();
  if (orderId && custId) {
    const warrantyPayload = {
      order_id: orderId,
      customer_id: custId,
      product_name: 'Aqua RO 2000 Premier Purifier',
      product_sku: 'AKUA-RO-2000',
      serial_number: `SN-AUDIT-${ts}`,
      purchase_date: new Date().toISOString().split('T')[0],
      duration_months: 12,
    };
    const wRes = await testReq('Register Warranty', 'POST', '/api/warranty/register', warrantyPayload);
    const warrantyId = wRes?.data?.warranty?.id || wRes?.data?.id;

    if (warrantyId) {
      await testReq('Verify Warranty Registration', 'PATCH', `/api/warranty/${warrantyId}/verify`, {
        status: 'VERIFIED',
      });

      await testReq('Create Warranty Service Request', 'POST', `/api/warranty/${warrantyId}/service-requests`, {
        issue_type: 'membrane_leak',
        issue_description: 'Audit service request test',
        priority: 'high',
      });
    }
  }

  // 6. Payroll Mutations
  if (sampleEmp) {
    await testReq('Upsert Payroll Profile', 'POST', `/api/payroll/profile/${sampleEmp.id}`, {
      salary_type: 'monthly',
      basic_salary: 30000,
      fixed_allowances: 8000,
      fixed_deductions: 2000,
      payment_method: 'bank_transfer',
    });

    const pRecRes = await testReq('Create Monthly Payroll Record', 'POST', '/api/payroll/records', {
      employee_id: sampleEmp.id,
      payroll_month: new Date().toISOString().slice(0, 7),
      gross_amount: 38000,
      allowances: 8000,
      deductions: 2000,
      payment_status: 'draft',
      remarks: 'Audit monthly payout draft',
    });

    const pRecId = pRecRes?.data?.record?.id || pRecRes?.data?.id;
    if (pRecId) {
      await testReq('Update Payroll Record Status', 'PATCH', `/api/payroll/records/${pRecId}/status`, {
        payment_status: 'approved',
      });
    }
  }

  // Cleanup created test user
  if (testUserId) {
    await testReq('Archive / Delete Test User', 'DELETE', `/api/user-access/users/${testUserId}`);
  }

  server.close();
  console.log(`\n========================================`);
  console.log(`Mutation Audit Finished: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runMutationAudit().catch((err) => {
  console.error('Fatal Mutation Audit Failure:', err);
  process.exit(1);
});
