'use strict';

const path = require('path');
if (!process.env.DB_DIALECT) {
  process.env.DB_DIALECT = 'sqlite';
}

const {
  User,
  Role,
  Permission,
  ProductReview,
  AccountingRecord,
  ChequeCollection,
  AdCampaignMetric,
  KeywordMetric,
  ReturnClaim,
} = require('../models');

const { getEffectivePermissions } = require('../middleware/auth');
const { buildDataScopeWhere } = require('../middleware/dataScope');
const { SYSTEM_ROLES, MODULE_REGISTRY } = require('../config/rolesAndCapabilities');

async function runVerification() {
  console.log('🧪 ═══════════════════════════════════════════════════════════════');
  console.log('🧪  STARTING ENTERPRISE EXPANSION VERIFICATION SUITE');
  console.log('🧪 ═══════════════════════════════════════════════════════════════\n');

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

  // ─── Test 1: Single Source of Truth Registry ──────────────────────────────
  console.log('📋 Test Group 1: Single Source of Truth & Roles Registry');
  assert(SYSTEM_ROLES.length === 13, `13 System roles registered (found ${SYSTEM_ROLES.length})`);
  assert(MODULE_REGISTRY.length >= 15, `At least 15 modules registered in SSOT (found ${MODULE_REGISTRY.length})`);

  const dbRoles = await Role.findAll();
  assert(dbRoles.length >= 13, `Database roles table populated with at least 13 roles (found ${dbRoles.length})`);

  // ─── Test 2: Role Permissions for Key Staff ────────────────────────────────
  console.log('\n🔐 Test Group 2: Effective Permissions Calculation for Key Staff');

  const testCases = [
    { email: 'sushil@akuabeat.com', role: 'reviewer', requiredPerm: 'reviews:verify' },
    { email: 'yash.telecaller@nityamenterprises.com', role: 'telecaller', requiredPerm: 'telecaller:confirmation' },
    { email: 'sanjay.accountant@leretailproject.com', role: 'accountant', requiredPerm: 'accounting:tally' },
    { email: 'smallbusiness.ecs@gmail.com', role: 'spn_ads_manager', requiredPerm: 'spn_ads:keywords' },
    { email: 'bharat.manager@nityamenterprises.com', role: 'senior_account_manager', requiredPerm: 'sam:account_health' },
    { email: 'manoj.delivery@krishnacrm.com', role: 'delivery_boy', requiredPerm: 'delivery:cheque_collect' },
    { email: 'shruti.ecom@nityamenterprises.com', role: 'ecommerce_executive', requiredPerm: 'ecommerce:returns' },
    { email: 'admin@krishnacrm.com', role: 'admin', requiredPerm: '*' },
  ];

  for (const tc of testCases) {
    const user = await User.findOne({ where: { email: tc.email } });
    if (!user) {
      assert(false, `User with email ${tc.email} exists in DB`);
      continue;
    }
    const perms = await getEffectivePermissions(user);
    const hasPerm = perms.includes(tc.requiredPerm) || perms.includes('*');
    assert(hasPerm, `${user.name} (${tc.role}) possesses required permission '${tc.requiredPerm}'`);
  }

  // ─── Test 3: Data-Scope Query Condition Generation ─────────────────────────
  console.log('\n🛡️ Test Group 3: Data-Scope Isolation Engine');

  const admin = await User.findOne({ where: { email: 'admin@krishnacrm.com' } });
  const adminScope = buildDataScopeWhere(admin);
  assert(Object.keys(adminScope).length === 0, 'Admin receives empty/unrestricted data scope');

  const manoj = await User.findOne({ where: { email: 'manoj.delivery@krishnacrm.com' } });
  const manojScope = buildDataScopeWhere(manoj);
  assert(
    manojScope && Object.getOwnPropertySymbols(manojScope).length > 0,
    'Delivery Boy receives scoped filter matching assigned_to or user_id'
  );

  // ─── Test 4: Database Entities & Operational Records ───────────────────────
  console.log('\n📦 Test Group 4: New Business Domain Entities & Sample Records');

  const reviewCount = await ProductReview.count();
  assert(reviewCount > 0, `ProductReview table has active records (count: ${reviewCount})`);

  const accountingCount = await AccountingRecord.count();
  assert(accountingCount > 0, `AccountingRecord table has active records (count: ${accountingCount})`);

  const chequeCount = await ChequeCollection.count();
  assert(chequeCount > 0, `ChequeCollection table has active records (count: ${chequeCount})`);

  const campaignCount = await AdCampaignMetric.count();
  assert(campaignCount > 0, `AdCampaignMetric table has active records (count: ${campaignCount})`);

  const keywordCount = await KeywordMetric.count();
  assert(keywordCount > 0, `KeywordMetric table has active records (count: ${keywordCount})`);

  const returnCount = await ReturnClaim.count();
  assert(returnCount > 0, `ReturnClaim table has active records (count: ${returnCount})`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`🏁 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runVerification()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runVerification };
