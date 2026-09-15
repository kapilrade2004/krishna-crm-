'use strict';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { User, Employee, sequelize, syncModels } = require('../models');
const userAccessController = require('../controllers/userAccess.controller');
const userEmployeeSyncService = require('../services/userEmployeeSyncService');

async function runTests() {
  console.log('================================================================');
  console.log('⚡ STARTING USER-TO-EMPLOYEE FULL SYNCHRONIZATION TEST MATRIX');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // 0. Ensure tables and data are synced
  await syncModels();

  // Find or use admin
  let admin = await User.findOne({ where: { role: 'admin' } });
  if (!admin) admin = await User.findOne();
  const adminId = admin ? admin.id : 'admin-01';

  // TC01: Existing Users Sync
  console.log('▶ [TEST 1] Verifying all existing users have corresponding Employee records...');
  try {
    const syncRes = await userEmployeeSyncService.syncAllUsersToEmployees();
    const users = await User.findAll({ where: { is_deleted: false } });
    const employees = await Employee.findAll();

    for (const u of users) {
      const emp = await Employee.findOne({
        where: {
          [require('sequelize').Op.or]: [
            { user_id: u.id },
            { email: u.email },
          ],
        },
      });
      assert.ok(emp, `Employee profile must exist for user ${u.name} (${u.email})`);
      assert.strictEqual(emp.user_id, u.id, `Employee user_id must match User ID for ${u.name}`);
    }

    console.log(`  ✅ [PASS] TC01: All ${users.length} active users are fully linked in Employee Directory`);
    passed++;
  } catch (err) {
    console.error('  ❌ [FAIL] TC01:', err.message);
    failed++;
  }

  // TC02: Real-Time Sync on User Creation
  console.log('\n▶ [TEST 2] Testing real-time Employee creation when a new User is created...');
  try {
    const testEmail = `new.staff.${Date.now()}@krishnacrm.com`;
    const fakeReq = {
      user: { id: adminId, role: 'super_admin', permissions: ['*'] },
      body: {
        name: 'Rohan Kulkarni',
        first_name: 'Rohan',
        last_name: 'Kulkarni',
        email: testEmail,
        password: 'Password@123',
        role: 'telecaller',
        department: 'Customer Support',
        designation: 'Senior Telecaller',
        status: 'active',
      },
    };

    let createdUserData = null;
    await new Promise((resolve, reject) => {
      const fakeRes = {
        status: (code) => ({
          json: (d) => { createdUserData = d; resolve(d); return d; },
        }),
        json: (d) => { createdUserData = d; resolve(d); return d; },
      };
      userAccessController.createUser(fakeReq, fakeRes, (err) => {
        if (err) reject(err);
      });
    });

    const userInDb = await User.findOne({ where: { email: testEmail } });
    assert.ok(userInDb, 'User must be created in DB');

    const empInDb = await Employee.findOne({ where: { user_id: userInDb.id } });
    assert.ok(empInDb, 'Corresponding Employee profile must be created automatically');
    assert.strictEqual(empInDb.first_name, 'Rohan');
    assert.strictEqual(empInDb.last_name, 'Kulkarni');
    assert.strictEqual(empInDb.email, testEmail);
    assert.strictEqual(empInDb.department, 'Customer Support');
    assert.strictEqual(empInDb.designation, 'Senior Telecaller');
    assert.strictEqual(empInDb.status, 'active');

    console.log('  ✅ [PASS] TC02: New User creation immediately generated linked Employee record');
    passed++;
  } catch (err) {
    console.error('  ❌ [FAIL] TC02:', err.message);
    failed++;
  }

  // TC03: Real-Time Sync on User Update
  console.log('\n▶ [TEST 3] Testing real-time Employee update when User details change...');
  try {
    const testEmail = `update.staff.${Date.now()}@krishnacrm.com`;
    const user = await User.create({
      id: uuidv4(),
      name: 'Aditi Rao',
      first_name: 'Aditi',
      last_name: 'Rao',
      email: testEmail,
      password: 'Password@123',
      role: 'sales',
      status: 'active',
      is_active: true,
    });
    await userEmployeeSyncService.syncUserToEmployee(user);

    // Update user role and department
    const fakeReq = {
      user: { id: adminId, role: 'super_admin', permissions: ['*'] },
      params: { id: user.id },
      body: {
        name: 'Aditi Rao Hydari',
        first_name: 'Aditi',
        last_name: 'Rao Hydari',
        role: 'manager',
        department: 'Operations',
        designation: 'Area Operations Head',
      },
    };

    await new Promise((resolve, reject) => {
      const fakeRes = {
        status: (code) => ({
          json: (d) => { resolve(d); return d; },
        }),
        json: (d) => { resolve(d); return d; },
      };
      userAccessController.updateUser(fakeReq, fakeRes, (err) => {
        if (err) reject(err);
      });
    });

    const updatedEmp = await Employee.findOne({ where: { user_id: user.id } });
    assert.ok(updatedEmp, 'Employee must exist');
    assert.strictEqual(updatedEmp.department, 'Operations');
    assert.strictEqual(updatedEmp.designation, 'Area Operations Head');
    assert.strictEqual(updatedEmp.first_name, 'Aditi');

    console.log('  ✅ [PASS] TC03: Updating User profile immediately reflected in Employee Directory');
    passed++;
  } catch (err) {
    console.error('  ❌ [FAIL] TC03:', err.message);
    failed++;
  }

  // TC04: Real-Time Sync on User Archive / Soft Delete
  console.log('\n▶ [TEST 4] Testing Employee status synchronization when User is archived...');
  try {
    const testEmail = `archive.staff.${Date.now()}@krishnacrm.com`;
    const user = await User.create({
      id: uuidv4(),
      name: 'Tanmay Bhatt',
      first_name: 'Tanmay',
      last_name: 'Bhatt',
      email: testEmail,
      password: 'Password@123',
      role: 'employee',
      status: 'active',
      is_active: true,
    });
    await userEmployeeSyncService.syncUserToEmployee(user);

    const fakeReq = {
      user: { id: adminId, role: 'super_admin', permissions: ['*'] },
      params: { id: user.id },
    };

    await new Promise((resolve, reject) => {
      const fakeRes = {
        status: (code) => ({
          json: (d) => { resolve(d); return d; },
        }),
        json: (d) => { resolve(d); return d; },
      };
      userAccessController.deleteUser(fakeReq, fakeRes, (err) => {
        if (err) reject(err);
      });
    });

    const archivedEmp = await Employee.findOne({ where: { user_id: user.id } });
    assert.ok(archivedEmp, 'Employee record must exist');
    assert.strictEqual(archivedEmp.status, 'inactive', 'Employee status must change to inactive upon user archive');

    console.log('  ✅ [PASS] TC04: Archiving User automatically marked Employee as inactive');
    passed++;
  } catch (err) {
    console.error('  ❌ [FAIL] TC04:', err.message);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`🎯 USER-EMPLOYEE SYNC TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
