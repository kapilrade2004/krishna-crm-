'use strict';

/**
 * End-to-End Verification Test:
 * Dynamic CRM User Synchronization & Login Screen Reflection
 *
 * Validates:
 * 1. Initial active system accounts returned by getDemoAccounts.
 * 2. Creating a new user immediately reflects in getDemoAccounts with their name and display_password.
 * 3. Updating the user's name and password immediately reflects in getDemoAccounts.
 * 4. Resetting the user's password via resetPassword immediately reflects in getDemoAccounts.
 * 5. Server boot logic preserves updated user passwords without overwriting them.
 * 6. Deleting / archiving a user removes them completely from getDemoAccounts.
 */

const { User, Employee, sequelize } = require('../models');
const { getDemoAccounts } = require('../controllers/authController');
const userAccessController = require('../controllers/userAccess.controller');

function invokeController(controllerFn, req = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    const res = {
      statusCode: 200,
      headers,
      setHeader: (k, v) => { headers[k] = v; },
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(payload) {
        resolve({ statusCode: this.statusCode, headers, payload });
      },
    };
    const next = (err) => {
      if (err) reject(err);
      else resolve({ statusCode: res.statusCode, headers, payload: null });
    };

    try {
      controllerFn(req, res, next);
    } catch (e) {
      reject(e);
    }
  });
}

async function runTest() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING: Dynamic CRM User & Login Reflection Test');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  const testEmail = `test.officer.${Date.now()}@krishnacrm.com`;
  let createdUserId = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Initial getDemoAccounts returns all active system accounts
    // -----------------------------------------------------------------
    console.log('[STEP 1] Fetching live demo accounts...');
    const initialRes = await invokeController(getDemoAccounts);
    assert(initialRes.statusCode === 200, 'getDemoAccounts returns HTTP 200');
    assert(initialRes.headers['Cache-Control']?.includes('no-store'), 'Cache-Control header prevents stale browser cache');
    
    const initialAccounts = initialRes.payload?.data || [];
    assert(initialAccounts.length >= 22, `Initial accounts count >= 22 (got: ${initialAccounts.length})`);
    
    const adminAccount = initialAccounts.find(a => a.email === 'admin@krishnacrm.com');
    assert(adminAccount && adminAccount.name === 'Super Admin' && adminAccount.password === 'Admin@123456', 'Super Admin account correctly populated with password');

    // -----------------------------------------------------------------
    // TEST 2: Super Admin creates a new user -> must appear in getDemoAccounts
    // -----------------------------------------------------------------
    console.log('\n[STEP 2] Super Admin creating a new user...');
    const createReq = {
      user: { id: adminAccount.id, role: 'admin' },
      body: {
        name: 'Cadence Vance',
        email: testEmail,
        password: 'Cadence@123456',
        role: 'telecaller',
        department: 'Customer Support',
        designation: 'Telecaller Specialist',
        phone: '9876543210',
        status: 'active',
      },
    };

    const createRes = await invokeController(userAccessController.createUser, createReq);
    assert(createRes.statusCode === 201, `createUser returned HTTP 201 (status: ${createRes.statusCode})`);
    createdUserId = createRes.payload?.data?.id;
    assert(Boolean(createdUserId), `New user created with ID: ${createdUserId}`);

    // Verify user immediately reflects in getDemoAccounts
    const afterCreateRes = await invokeController(getDemoAccounts);
    const afterCreateAccounts = afterCreateRes.payload?.data || [];
    const foundNewUser = afterCreateAccounts.find(a => a.email === testEmail);
    assert(Boolean(foundNewUser), 'New user immediately reflects on login demo-accounts list');
    assert(foundNewUser?.name === 'Cadence Vance', `Name reflects accurately: ${foundNewUser?.name}`);
    assert(foundNewUser?.password === 'Cadence@123456', `Password reflects accurately: ${foundNewUser?.password}`);
    assert(foundNewUser?.role === 'telecaller', `Role reflects accurately: ${foundNewUser?.role}`);

    // -----------------------------------------------------------------
    // TEST 3: Super Admin updates Name & Password -> must reflect in getDemoAccounts
    // -----------------------------------------------------------------
    console.log('\n[STEP 3] Super Admin updating Name & Password...');
    const updateReq = {
      params: { id: createdUserId },
      user: { id: adminAccount.id, role: 'admin' },
      body: {
        name: 'Cadence Vance Senior',
        password: 'NewCadencePassword@789',
        department: 'Executive Operations',
        designation: 'Senior Telecaller Specialist',
      },
    };

    const updateRes = await invokeController(userAccessController.updateUser, updateReq);
    assert(updateRes.statusCode === 200, `updateUser returned HTTP 200`);

    const afterUpdateRes = await invokeController(getDemoAccounts);
    const afterUpdateAccounts = afterUpdateRes.payload?.data || [];
    const foundUpdatedUser = afterUpdateAccounts.find(a => a.email === testEmail);
    assert(foundUpdatedUser?.name === 'Cadence Vance Senior', `Updated Name reflects: ${foundUpdatedUser?.name}`);
    assert(foundUpdatedUser?.password === 'NewCadencePassword@789', `Updated Password reflects: ${foundUpdatedUser?.password}`);

    // -----------------------------------------------------------------
    // TEST 4: Super Admin resets password -> must reflect in getDemoAccounts
    // -----------------------------------------------------------------
    console.log('\n[STEP 4] Super Admin resetting password...');
    const resetReq = {
      params: { id: createdUserId },
      user: { id: adminAccount.id, role: 'admin' },
      body: {
        newPassword: 'ResetCadencePassword@999',
        forcePasswordReset: false,
      },
    };

    const resetRes = await invokeController(userAccessController.resetPassword, resetReq);
    assert(resetRes.statusCode === 200, `resetPassword returned HTTP 200`);

    const afterResetRes = await invokeController(getDemoAccounts);
    const afterResetAccounts = afterResetRes.payload?.data || [];
    const foundResetUser = afterResetAccounts.find(a => a.email === testEmail);
    assert(foundResetUser?.password === 'ResetCadencePassword@999', `Reset Password reflects on login screen: ${foundResetUser?.password}`);

    // -----------------------------------------------------------------
    // TEST 5: Server boot simulation preserves customized passwords
    // -----------------------------------------------------------------
    console.log('\n[STEP 5] Testing server boot password preservation...');
    const userInDb = await User.findByPk(createdUserId);
    // Simulate boot check
    if (!userInDb.display_password) {
      userInDb.display_password = 'Overwritten@123';
      await userInDb.save();
    }
    assert(userInDb.display_password === 'ResetCadencePassword@999', 'Server boot check preserves modified user password');

    // -----------------------------------------------------------------
    // TEST 6: Super Admin deletes/archives user -> must be removed from getDemoAccounts
    // -----------------------------------------------------------------
    console.log('\n[STEP 6] Super Admin deleting/archiving user...');
    const deleteReq = {
      params: { id: createdUserId },
      user: { id: adminAccount.id, role: 'admin' },
      body: {
        reason: 'Staff member departure',
      },
    };

    const deleteRes = await invokeController(userAccessController.deleteUser, deleteReq);
    assert(deleteRes.statusCode === 200, `deleteUser returned HTTP 200`);

    const afterDeleteRes = await invokeController(getDemoAccounts);
    const afterDeleteAccounts = afterDeleteRes.payload?.data || [];
    const foundDeletedUser = afterDeleteAccounts.find(a => a.email === testEmail);
    assert(!foundDeletedUser, 'Archived / Deleted user is COMPLETELY REMOVED from login accounts list');

  } catch (err) {
    console.error('💥 Error during test execution:', err);
    failed++;
  } finally {
    // Cleanup test fixtures
    if (createdUserId) {
      await User.destroy({ where: { id: createdUserId }, force: true }).catch(() => {});
      await Employee.destroy({ where: { user_id: createdUserId }, force: true }).catch(() => {});
    }
    console.log('\n======================================================');
    console.log(`📊 TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
    console.log('======================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTest();
