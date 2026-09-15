'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Employee,
  AttendanceEvent,
  AttendanceSyncRun,
  AttendanceDay,
  User,
} = require('../models');
const smartOfficeClient = require('../services/smartoffice/smartOfficeClient');
const {
  normalizePunchDirection,
  normalizeLogDateTime,
  normalizeSmartOfficeLog,
  normalizeSmartOfficeLogs,
} = require('../services/smartoffice/smartOfficeNormalizer');
const smartOfficeAttendanceService = require('../services/smartoffice/smartOfficeAttendanceService');

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 SMARTOFFICE BIOMETRIC ATTENDANCE INTEGRATION TEST SUITE');
  console.log('======================================================================\n');

  await sequelize.authenticate();
  console.log('✅ Database connected.');

  // Create clean test employee
  const testSuffix = Math.floor(1000 + Math.random() * 9000);
  const testSmartOfficeCode = `SO_TEST_${testSuffix}`;
  const testEmpCode = `EMP_${testSuffix}`;

  const [testUser] = await User.findOrCreate({
    where: { email: `so.test.${testSuffix}@krishnacrm.com` },
    defaults: {
      id: uuidv4(),
      name: `SmartOffice Tester ${testSuffix}`,
      email: `so.test.${testSuffix}@krishnacrm.com`,
      password: '$2a$10$abcdefghijklmnopqrstuuTestPasswordHash',
      role: 'admin',
    },
  });

  const [testEmp] = await Employee.findOrCreate({
    where: { employee_code: testEmpCode },
    defaults: {
      id: uuidv4(),
      user_id: testUser.id,
      employee_code: testEmpCode,
      smartoffice_employee_code: testSmartOfficeCode,
      first_name: 'SmartOffice',
      last_name: `Tester ${testSuffix}`,
      department: 'Technology',
      designation: 'Integration Specialist',
      status: 'active',
    },
  });

  console.log(`✅ Test employee prepared: ID=${testEmp.id}, EmpCode=${testEmpCode}, SmartOfficeCode=${testSmartOfficeCode}\n`);

  let passedTests = 0;

  // -------------------------------------------------------------------------
  // TEST 1: Normalizer Blank Direction Rule (Requirement 9)
  // -------------------------------------------------------------------------
  console.log('▶ TEST 1: Blank & Whitespace PunchDirection Normalization');
  assert.strictEqual(normalizePunchDirection(' '), 'UNKNOWN', 'Whitespace punch direction must map to UNKNOWN');
  assert.strictEqual(normalizePunchDirection(''), 'UNKNOWN', 'Empty punch direction must map to UNKNOWN');
  assert.strictEqual(normalizePunchDirection(null), 'UNKNOWN', 'Null punch direction must map to UNKNOWN');
  assert.strictEqual(normalizePunchDirection(undefined), 'UNKNOWN', 'Undefined punch direction must map to UNKNOWN');
  assert.strictEqual(normalizePunchDirection('IN'), 'IN', 'IN must map to IN');
  assert.strictEqual(normalizePunchDirection('in'), 'IN', 'in must map to IN');
  assert.strictEqual(normalizePunchDirection('OUT'), 'OUT', 'OUT must map to OUT');
  assert.strictEqual(normalizePunchDirection('out'), 'OUT', 'out must map to OUT');
  console.log('  ✔ Verified: Blank punch direction is strictly mapped to UNKNOWN (no random guessing)\n');
  passedTests++;

  // -------------------------------------------------------------------------
  // TEST 2: Deterministic External Event Key Normalization (Requirement 5 & 8)
  // -------------------------------------------------------------------------
  console.log('▶ TEST 2: Canonical Normalization & Deterministic Key Generation');
  const sampleLog = {
    EmployeeCode: '10',
    LogDate: '2026-08-01 08:58:30',
    SerialNumber: 'AMDB24070600331',
    PunchDirection: ' ',
    Temperature: 0,
    TemperatureState: 'Not Measured',
  };
  const normalized = normalizeSmartOfficeLog(sampleLog);
  assert.strictEqual(normalized.employeeCode, '10');
  assert.strictEqual(normalized.logDateTime, '2026-08-01 08:58:30');
  assert.strictEqual(normalized.serialNumber, 'AMDB24070600331');
  assert.strictEqual(normalized.punchDirection, 'UNKNOWN');
  assert.strictEqual(normalized.externalEventKey, 'AMDB24070600331_10_2026-08-01 08:58:30');
  console.log('  ✔ Verified: Canonical format and deterministic external_event_key verified.\n');
  passedTests++;

  // -------------------------------------------------------------------------
  // TEST 3: Employee Matching (Requirement 10)
  // -------------------------------------------------------------------------
  console.log('▶ TEST 3: Employee Matching Resolution');
  const dateStr = '2026-09-12';
  const punchTime1 = `${dateStr} 09:05:00`;
  const punchTime2 = `${dateStr} 18:15:00`;

  const logsToSync = [
    {
      EmployeeCode: testSmartOfficeCode,
      LogDate: punchTime1,
      SerialNumber: 'AMDB24070600331',
      PunchDirection: 'IN',
      Temperature: 98.4,
      TemperatureState: 'Normal',
    },
    {
      EmployeeCode: testSmartOfficeCode,
      LogDate: punchTime2,
      SerialNumber: 'AMDB24070600331',
      PunchDirection: 'OUT',
      Temperature: 98.6,
      TemperatureState: 'Normal',
    },
  ];

  // Directly test service sync with mock data injection
  const origGetLogs = smartOfficeClient.getDeviceLogs;
  smartOfficeClient.getDeviceLogs = async () => logsToSync;

  try {
    const syncRes1 = await smartOfficeAttendanceService.syncLogs({
      fromDate: dateStr,
      toDate: dateStr,
      syncType: 'MANUAL',
    });

    assert.strictEqual(syncRes1.status, 'COMPLETED');
    assert.strictEqual(syncRes1.recordsReceived, 2);
    assert.strictEqual(syncRes1.recordsInserted, 2);
    assert.strictEqual(syncRes1.recordsDuplicate, 0);

    const insertedEvents = await AttendanceEvent.findAll({
      where: { smartoffice_employee_code: testSmartOfficeCode },
    });
    assert.strictEqual(insertedEvents.length, 2);
    assert.strictEqual(insertedEvents[0].employee_id, testEmp.id);
    assert.strictEqual(insertedEvents[0].status, 'PROCESSED');
    console.log(`  ✔ Verified: Punches matched to CRM employee ID ${testEmp.id} with status=PROCESSED\n`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 4: Duplicate Deduplication (Requirement 5)
    // -------------------------------------------------------------------------
    console.log('▶ TEST 4: Idempotent Sync & Duplicate Deduplication');
    const syncRes2 = await smartOfficeAttendanceService.syncLogs({
      fromDate: dateStr,
      toDate: dateStr,
      syncType: 'MANUAL',
    });

    assert.strictEqual(syncRes2.status, 'COMPLETED');
    assert.strictEqual(syncRes2.recordsReceived, 2);
    assert.strictEqual(syncRes2.recordsInserted, 0, 'No records should be re-inserted on identical run');
    assert.strictEqual(syncRes2.recordsDuplicate, 2, 'Both records must be detected as duplicates');

    const countAfterSecondSync = await AttendanceEvent.count({
      where: { smartoffice_employee_code: testSmartOfficeCode },
    });
    assert.strictEqual(countAfterSecondSync, 2, 'Database row count must remain exactly 2');
    console.log('  ✔ Verified: Zero duplicates inserted on secondary identical sync runs.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 5: Daily Attendance Calculation & Present Status (Requirement 12 & 13)
    // -------------------------------------------------------------------------
    console.log('▶ TEST 5: Daily Attendance Derivation & Present Logic');
    const attendanceDay = await AttendanceDay.findOne({
      where: { employee_id: testEmp.id, date: dateStr },
    });

    assert(attendanceDay, 'AttendanceDay record must be generated');
    assert.strictEqual(attendanceDay.status, 'PRESENT', 'Attendance status must be PRESENT');
    assert.strictEqual(attendanceDay.first_in, '09:05:00');
    assert.strictEqual(attendanceDay.last_out, '18:15:00');
    assert(attendanceDay.total_work_minutes > 500, 'Work minutes must be correctly calculated (~550 mins)');
    console.log(`  ✔ Verified: Daily attendance derived: status=${attendanceDay.status}, first_in=${attendanceDay.first_in}, last_out=${attendanceDay.last_out}, worked=${attendanceDay.total_work_minutes}m\n`);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 6: Unknown / Unmatched Employee Handling (Requirement 10)
    // -------------------------------------------------------------------------
    console.log('▶ TEST 6: Unknown Employee Handling (UNMATCHED_EMPLOYEE)');
    const unknownCode = `UNKNOWN_CODE_${testSuffix}`;
    const unknownPunch = [
      {
        EmployeeCode: unknownCode,
        LogDate: `${dateStr} 11:20:00`,
        SerialNumber: 'AMDB24070600331',
        PunchDirection: ' ',
      },
    ];
    smartOfficeClient.getDeviceLogs = async () => unknownPunch;

    const unknownSync = await smartOfficeAttendanceService.syncLogs({
      fromDate: dateStr,
      toDate: dateStr,
    });

    assert.strictEqual(unknownSync.recordsUnmatched, 1);
    const unmatchedEvent = await AttendanceEvent.findOne({
      where: { smartoffice_employee_code: unknownCode },
    });
    assert(unmatchedEvent, 'Unmatched punch must NOT be discarded');
    assert.strictEqual(unmatchedEvent.employee_id, null, 'Unmatched punch employee_id must be null');
    assert.strictEqual(unmatchedEvent.status, 'UNMATCHED_EMPLOYEE');
    console.log('  ✔ Verified: Unmatched employee punch stored with employee_id=null and status=UNMATCHED_EMPLOYEE\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 7: Retroactive Mapping Resolution
    // -------------------------------------------------------------------------
    console.log('▶ TEST 7: Retroactive Employee Mapping Resolution');
    const mapResult = await smartOfficeAttendanceService.mapUnmatchedEmployee(unknownCode, testEmp.id);
    assert.strictEqual(mapResult.success, true);
    assert.strictEqual(mapResult.eventsMapped, 1);

    const recheckEvent = await AttendanceEvent.findOne({
      where: { smartoffice_employee_code: unknownCode },
    });
    assert.strictEqual(recheckEvent.employee_id, testEmp.id);
    assert.strictEqual(recheckEvent.status, 'PROCESSED');
    console.log('  ✔ Verified: Retroactive mapping converted unmatched punch to PROCESSED and linked to employee.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 8: Multiple Device Punch Ingestion (Requirement 19)
    // -------------------------------------------------------------------------
    console.log('▶ TEST 8: Multiple Device Support');
    const multiDevicePunches = [
      {
        EmployeeCode: testSmartOfficeCode,
        LogDate: `${dateStr} 12:00:00`,
        SerialNumber: 'DEVICE_GATE_A',
        PunchDirection: 'IN',
      },
      {
        EmployeeCode: testSmartOfficeCode,
        LogDate: `${dateStr} 12:00:00`, // exact same timestamp, different device
        SerialNumber: 'DEVICE_GATE_B',
        PunchDirection: 'IN',
      },
    ];
    smartOfficeClient.getDeviceLogs = async () => multiDevicePunches;

    const multiDevSync = await smartOfficeAttendanceService.syncLogs({
      fromDate: dateStr,
      toDate: dateStr,
    });

    assert.strictEqual(multiDevSync.recordsInserted, 2, 'Punches from distinct devices at same time must both be retained');
    const devA = await AttendanceEvent.findOne({ where: { device_serial_number: 'DEVICE_GATE_A' } });
    const devB = await AttendanceEvent.findOne({ where: { device_serial_number: 'DEVICE_GATE_B' } });
    assert(devA && devB, 'Both device punches must exist in database');
    console.log('  ✔ Verified: Multi-device punch events preserved cleanly.\n');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 9: Graceful Error Handling & Preservation (Requirement 20)
    // -------------------------------------------------------------------------
    console.log('▶ TEST 9: Network Error / Service Unavailable Graceful Handling');
    smartOfficeClient.getDeviceLogs = async () => {
      throw new Error('fetch failed: connect ECONNREFUSED 192.168.1.38:82');
    };

    const failSync = await smartOfficeAttendanceService.syncLogs({
      fromDate: dateStr,
      toDate: dateStr,
    });

    assert.strictEqual(failSync.status, 'FAILED');
    assert(failSync.errorMessage.includes('ECONNREFUSED'));

    // Verify existing attendance was NOT deleted or marked absent
    const preservedAttendance = await AttendanceDay.findOne({
      where: { employee_id: testEmp.id, date: dateStr },
    });
    assert(preservedAttendance, 'Existing attendance must NOT be erased');
    assert.strictEqual(preservedAttendance.status, 'PRESENT', 'Status must remain PRESENT');
    console.log('  ✔ Verified: Network failure recorded cleanly; existing attendance remains intact.\n');
    passedTests++;

  } finally {
    // Restore original method
    smartOfficeClient.getDeviceLogs = origGetLogs;
  }

  console.log('======================================================================');
  console.log(`🎉 ALL ${passedTests} MANDATORY TESTS PASSED CLEANLY (100%)!`);
  console.log('======================================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  });
