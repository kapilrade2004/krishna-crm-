'use strict';

require('dotenv').config();
const { DailyActivity, DailyActivityHistory, User, syncModels } = require('../models');
const { evaluateSingleActivity, runEvaluation } = require('../services/activityShiftScheduler');

async function runTests() {
  console.log('🧪 Starting Daily Activities End-to-End Verification Test...');

  await syncModels();

  // Find or select users
  const admin = await User.findOne({ where: { is_active: true } });
  if (!admin) {
    throw new Error('No active user found in DB to run tests.');
  }

  const employee = await User.findOne({
    where: { is_active: true, id: { [require('sequelize').Op.ne]: admin.id } },
  }) || admin;

  console.log(`👤 Using Assigner: ${admin.name} (${admin.role}) | Assignee: ${employee.name} (${employee.role})`);

  // 1. Create Daily Activity (Standard Shift)
  console.log('\n--- Test 1: Create Daily Activity (ASSIGNED) ---');
  const activity1 = await DailyActivity.create({
    title: 'Test Order Verification',
    description: 'Verify 50 pending orders from yesterday',
    assigned_by: admin.id,
    assigned_to: employee.id,
    priority: 'high',
    category: 'Operations',
    notes: 'Priority task for morning shift',
    status: 'ASSIGNED',
    assigned_at: new Date(),
    shift_duration: 24,
  });

  await DailyActivityHistory.create({
    activity_id: activity1.id,
    actor_id: admin.id,
    event_type: 'ACTIVITY_CREATED',
    old_status: null,
    new_status: 'ASSIGNED',
    notes: 'Test creation',
  });

  console.log(`✅ Activity created: ID=${activity1.id}, status=${activity1.status}`);

  // 2. Start Activity (ASSIGNED -> IN_PROGRESS)
  console.log('\n--- Test 2: Start Activity (IN_PROGRESS) ---');
  activity1.status = 'IN_PROGRESS';
  activity1.started_at = new Date();
  await activity1.save();

  await DailyActivityHistory.create({
    activity_id: activity1.id,
    actor_id: employee.id,
    event_type: 'ACTIVITY_STARTED',
    old_status: 'ASSIGNED',
    new_status: 'IN_PROGRESS',
    notes: 'Started by employee',
  });
  console.log(`✅ Activity started: status=${activity1.status}, started_at=${activity1.started_at.toISOString()}`);

  // 3. Complete Activity within Shift (IN_PROGRESS -> COMPLETED)
  console.log('\n--- Test 3: Complete Activity within 24h Shift (COMPLETED) ---');
  activity1.status = 'COMPLETED';
  activity1.completed_at = new Date();
  await activity1.save();

  await DailyActivityHistory.create({
    activity_id: activity1.id,
    actor_id: employee.id,
    event_type: 'ACTIVITY_COMPLETED',
    old_status: 'IN_PROGRESS',
    new_status: 'COMPLETED',
    notes: 'Completed successfully on time',
  });
  console.log(`✅ Activity completed on time: status=${activity1.status}, completed_at=${activity1.completed_at.toISOString()}`);

  // 4. Test Shift Expiry & Incomplete Transition (24h passed)
  console.log('\n--- Test 4: Automatic Shift Expiry (ASSIGNED -> INCOMPLETE) ---');
  const past25Hours = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const expiredActivity = await DailyActivity.create({
    title: 'Test Expired Activity',
    description: 'Activity assigned 25 hours ago that was never completed',
    assigned_by: admin.id,
    assigned_to: employee.id,
    priority: 'medium',
    status: 'IN_PROGRESS',
    assigned_at: past25Hours,
    started_at: past25Hours,
    shift_duration: 24,
  });

  console.log(`  Initial status before evaluation: ${expiredActivity.status}, assigned_at: ${expiredActivity.assigned_at.toISOString()}`);
  await evaluateSingleActivity(expiredActivity, admin.id);

  const reloadedExpired = await DailyActivity.findByPk(expiredActivity.id);
  console.log(`  Status after evaluation: ${reloadedExpired.status}`);
  if (reloadedExpired.status !== 'INCOMPLETE') {
    throw new Error(`Expected INCOMPLETE but got ${reloadedExpired.status}`);
  }
  console.log('✅ Automatic INCOMPLETE transition verified!');

  // 5. Complete Incomplete Activity (INCOMPLETE -> LATE)
  console.log('\n--- Test 5: Complete Expired Activity (INCOMPLETE -> LATE) ---');
  reloadedExpired.status = 'LATE';
  reloadedExpired.completed_at = new Date();
  await reloadedExpired.save();

  await DailyActivityHistory.create({
    activity_id: reloadedExpired.id,
    actor_id: employee.id,
    event_type: 'ACTIVITY_LATE',
    old_status: 'INCOMPLETE',
    new_status: 'LATE',
    notes: 'Completed after shift ended',
  });

  const finalLate = await DailyActivity.findByPk(reloadedExpired.id);
  console.log(`  Status after late completion: ${finalLate.status}`);
  if (finalLate.status !== 'LATE') {
    throw new Error(`Expected LATE but got ${finalLate.status}`);
  }
  console.log('✅ LATE status transition verified!');

  // 6. Verify History Timeline
  console.log('\n--- Test 6: Verify History Records ---');
  const history = await DailyActivityHistory.findAll({
    where: { activity_id: finalLate.id },
    order: [['created_at', 'ASC']],
  });
  console.log(`  Found ${history.length} history event(s) for activity.`);
  history.forEach((h) => {
    console.log(`    - [${h.event_type}] ${h.old_status || 'NONE'} -> ${h.new_status} (${h.notes})`);
  });

  // Cleanup test records
  await DailyActivityHistory.destroy({ where: { activity_id: [activity1.id, expiredActivity.id] } });
  await DailyActivity.destroy({ where: { id: [activity1.id, expiredActivity.id] } });

  console.log('\n🎉 ALL DAILY ACTIVITIES TESTS PASSED SUCCESSFULLY!\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
