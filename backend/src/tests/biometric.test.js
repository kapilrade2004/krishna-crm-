'use strict';

const assert = require('assert');
const crypto = require('crypto');
const { sequelize, connectDB } = require('../config/database');
const {
  syncModels,
  User,
  Employee,
  BiometricDevice,
  EmployeeBiometricMapping,
  BiometricPunchEvent,
  AttendanceShift,
  AttendanceDay,
  AttendanceSegment,
  AttendanceCorrection,
  IntegrationSyncState,
} = require('../models');

const smartOfficeClient = require('../services/smartOfficeClient');
const attendanceEngine = require('../services/attendanceEngine');
const biometricService = require('../services/biometricService');
const payrollAttendanceService = require('../services/payrollAttendanceService');

async function runBiometricTestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING BIOMETRIC ATTENDANCE END-TO-END TEST SUITE');
  console.log('====================================================');

  try {
    await connectDB();
    await syncModels();
    console.log('✅ Database connected and models synchronized.');

    // ── Test 1: SmartOffice API Client Unit Tests ──────────────────────────────
    console.log('\n--- [Test 1] SmartOffice Client Verification ---');
    const mockLogs = await smartOfficeClient.getDeviceLogs({
      fromDate: '2026-08-22 00:00:00',
      toDate: '2026-08-22 23:59:59',
    });
    assert(Array.isArray(mockLogs), 'SmartOffice logs should return an array');
    console.log(`✅ SmartOfficeClient.getDeviceLogs returned ${mockLogs.length} logs.`);
    if (mockLogs.length > 0) {
      assert(mockLogs[0].EmployeeCode, 'Log item must contain EmployeeCode');
      assert(mockLogs[0].LogDate, 'Log item must contain LogDate');
      assert(mockLogs[0].SerialNumber, 'Log item must contain SerialNumber');
      console.log(`✅ Sample log format verified: ${mockLogs[0].EmployeeCode} @ ${mockLogs[0].LogDate} (${mockLogs[0].PunchDirection})`);
    }

    // ── Test 2: Shift Policy Configuration ──────────────────────────────────
    console.log('\n--- [Test 2] Attendance Shift Policy Verification ---');
    const defaultShift = await AttendanceShift.findOne({ where: { shift_code: 'GEN_10_06' } });
    assert(defaultShift, 'Default shift GEN_10_06 should exist');
    assert.strictEqual(defaultShift.grace_period_minutes, 10, 'Grace period should be 10 minutes');
    console.log(`✅ Default Shift verified: ${defaultShift.shift_name} (Grace: ${defaultShift.grace_period_minutes}m, Min Full: ${defaultShift.min_full_day_hours}h)`);

    // ── Test 3: Employee Biometric Provisioning & Device Registration ─────────
    console.log('\n--- [Test 3] Biometric Device & Employee Mapping ---');
    const [testDevice] = await BiometricDevice.findOrCreate({
      where: { serial_number: 'TEST_BIOMAX_01' },
      defaults: {
        device_name: 'HQ Front Gate BioMax',
        serial_number: 'TEST_BIOMAX_01',
        location: 'HQ Reception',
        status: 'online',
        is_active: true,
      },
    });

    const [testUser] = await User.findOrCreate({
      where: { email: 'biometric.test@krishnacrm.com' },
      defaults: {
        name: 'Biometric Test User',
        email: 'biometric.test@krishnacrm.com',
        password: 'Password@123',
        role: 'employee',
      },
    });

    const [testEmployee] = await Employee.findOrCreate({
      where: { employee_code: 'TEST-EMP-99' },
      defaults: {
        user_id: testUser.id,
        first_name: 'Aakash',
        last_name: 'Verma',
        employee_code: 'TEST-EMP-99',
        department: 'Operations',
        designation: 'Field Executive',
        status: 'active',
      },
    });

    const mapping = await biometricService.uploadEmployeeToDevice(testEmployee.id, testDevice.id);
    assert(mapping, 'Biometric mapping must be created');
    assert.strictEqual(mapping.employee_code, 'TEST-EMP-99');
    console.log(`✅ Employee ${mapping.employee_code} mapped to device ${testDevice.serial_number}`);

    // ── Test 4: SHA-256 Deduplication & Punch Ingestion ──────────────────────
    console.log('\n--- [Test 4] SHA-256 Deduplication & Punch Ingestion ---');
    const testDate = '2026-08-22';
    const rawPunches = [
      {
        EmployeeCode: 'TEST-EMP-99',
        LogDate: '2026-08-22 10:05:00', // On time (within 10m grace)
        SerialNumber: testDevice.serial_number,
        PunchDirection: 'IN',
      },
      {
        EmployeeCode: 'TEST-EMP-99',
        LogDate: '2026-08-22 13:00:00', // Out for lunch
        SerialNumber: testDevice.serial_number,
        PunchDirection: 'OUT',
      },
      {
        EmployeeCode: 'TEST-EMP-99',
        LogDate: '2026-08-22 14:00:00', // Back from lunch
        SerialNumber: testDevice.serial_number,
        PunchDirection: 'IN',
      },
      {
        EmployeeCode: 'TEST-EMP-99',
        LogDate: '2026-08-22 19:30:00', // Clock out with overtime (+1.5 hrs)
        SerialNumber: testDevice.serial_number,
        PunchDirection: 'OUT',
      },
    ];

    let insertedCount = 0;
    for (const p of rawPunches) {
      const hash = crypto
        .createHash('sha256')
        .update(`${p.EmployeeCode}|${p.LogDate}|${p.SerialNumber}|${p.PunchDirection}`)
        .digest('hex');

      const [record, created] = await BiometricPunchEvent.findOrCreate({
        where: { external_event_hash: hash },
        defaults: {
          employee_code: p.EmployeeCode,
          employee_id: testEmployee.id,
          device_id: testDevice.id,
          device_serial_number: p.SerialNumber,
          punch_timestamp: new Date(p.LogDate),
          punch_date: testDate,
          punch_direction: p.PunchDirection,
          source: 'BIOMETRIC',
          external_event_hash: hash,
          processing_status: 'PENDING',
        },
      });

      if (created) insertedCount++;
    }
    console.log(`✅ Ingested ${insertedCount} test punches with unique SHA-256 hashes.`);

    // Test Duplicate Punch Rejection
    const dupHash = crypto
      .createHash('sha256')
      .update(`${rawPunches[0].EmployeeCode}|${rawPunches[0].LogDate}|${rawPunches[0].SerialNumber}|${rawPunches[0].PunchDirection}`)
      .digest('hex');
    const [dupRec, dupCreated] = await BiometricPunchEvent.findOrCreate({
      where: { external_event_hash: dupHash },
      defaults: {
        employee_code: rawPunches[0].EmployeeCode,
        external_event_hash: dupHash,
      },
    });
    assert.strictEqual(dupCreated, false, 'Duplicate punch with identical SHA-256 hash must be rejected');
    console.log('✅ Duplicate punch rejection confirmed (Idempotency verified).');

    // ── Test 5: Deterministic Attendance Calculation Engine ──────────────────
    console.log('\n--- [Test 5] Attendance Calculation Engine (Multi-Punch & Overtime) ---');
    const calculatedDay = await attendanceEngine.calculateAttendanceForDay(testEmployee.id, testDate);

    assert(calculatedDay, 'AttendanceDay record must be returned');
    assert.strictEqual(calculatedDay.first_in, '10:05:00', 'First IN time should be 10:05:00');
    assert.strictEqual(calculatedDay.last_out, '19:30:00', 'Last OUT time should be 19:30:00');
    assert(calculatedDay.work_hours >= 8.0, `Work hours should be >= 8.0 (calculated: ${calculatedDay.work_hours} hrs)`);
    assert.strictEqual(calculatedDay.status, 'OVERTIME', 'Employee working with 90m overtime should have status OVERTIME');
    assert(calculatedDay.overtime_minutes > 0, `Overtime minutes should be > 0 (calculated: ${calculatedDay.overtime_minutes}m)`);
    console.log(`✅ Attendance calculated: Status=${calculatedDay.status}, First IN=${calculatedDay.first_in}, Last OUT=${calculatedDay.last_out}, Work=${calculatedDay.work_hours}h, Break=${calculatedDay.break_hours}h, Overtime=${calculatedDay.overtime_minutes}m`);

    // Verify Segments
    const segments = await AttendanceSegment.findAll({ where: { attendance_day_id: calculatedDay.id } });
    assert(segments.length >= 2, 'Should create at least 2 work segments from 4 punches');
    console.log(`✅ Multi-punch paired into ${segments.length} distinct work/break segments.`);

    // ── Test 6: Late Arrival and Incomplete / Missing Punch Handling ──────────
    console.log('\n--- [Test 6] Late Arrival & Missing Punch Validation ---');
    const lateDate = '2026-08-23';
    // Clear any previous test run records for this day
    await AttendanceCorrection.destroy({ where: { employee_id: testEmployee.id, correction_date: lateDate }, force: true });
    await AttendanceDay.destroy({ where: { employee_id: testEmployee.id, date: lateDate }, force: true });
    await BiometricPunchEvent.destroy({ where: { employee_id: testEmployee.id, punch_date: lateDate }, force: true });

    const lateHash = crypto.createHash('sha256').update(`TEST-EMP-99|${lateDate} 10:35:00|${testDevice.serial_number}|IN`).digest('hex');
    await BiometricPunchEvent.findOrCreate({
      where: { external_event_hash: lateHash },
      defaults: {
        employee_code: 'TEST-EMP-99',
        employee_id: testEmployee.id,
        punch_timestamp: new Date(`${lateDate} 10:35:00`),
        punch_date: lateDate,
        punch_direction: 'IN',
        source: 'BIOMETRIC',
        external_event_hash: lateHash,
        processing_status: 'PENDING',
      },
    });

    const lateCalc = await attendanceEngine.calculateAttendanceForDay(testEmployee.id, lateDate);
    assert.strictEqual(lateCalc.status, 'INCOMPLETE', 'Single IN punch with no OUT punch should be INCOMPLETE');
    assert.strictEqual(lateCalc.late_minutes, 35, 'Late minutes should be 35 (10:35 - 10:00)');
    console.log(`✅ Incomplete single punch correctly flagged as INCOMPLETE with +${lateCalc.late_minutes}m late.`);

    // ── Test 7: Attendance Correction Workflow & Recalculation ────────────────
    console.log('\n--- [Test 7] Attendance Correction & Audit Trail ---');
    const correction = await biometricService.submitCorrection(
      {
        employee_id: testEmployee.id,
        correction_date: lateDate,
        corrected_in: '10:35:00',
        corrected_out: '18:35:00',
        reason: 'Forgot to punch out due to offsite technical repair visit.',
      },
      testUser.id
    );
    assert.strictEqual(correction.status, 'pending');

    const reviewed = await biometricService.reviewCorrection(
      correction.id,
      'approved',
      testUser.id
    );
    assert.strictEqual(reviewed.status, 'approved');

    const correctedDay = await AttendanceDay.findOne({ where: { employee_id: testEmployee.id, date: lateDate } });
    assert.strictEqual(correctedDay.last_out, '18:35:00');
    assert.strictEqual(correctedDay.is_corrected, true);
    assert.strictEqual(correctedDay.status, 'LATE');
    console.log(`✅ Correction applied! Recalculated status: ${correctedDay.status}, Work hours: ${correctedDay.work_hours}h`);

    // ── Test 8: Payroll Integration & Monthly Salary Computation ─────────────
    console.log('\n--- [Test 8] Attendance-Driven Monthly Payroll Calculation ---');
    const payrollCalc = await payrollAttendanceService.calculateMonthlySalary(testEmployee.id, '2026-08', {
      basic: 30000,
      hra: 12000,
      conveyance: 3000,
      special_allowance: 5000,
      pf: 1800,
      esi: 500,
      tds: 1500,
    });

    assert(payrollCalc.breakdown.gross_salary > 0, 'Gross salary must be calculated');
    assert(payrollCalc.breakdown.net_salary > 0, 'Net salary must be calculated');
    assert(payrollCalc.attendance_summary, 'Attendance summary should be included in payroll');
    console.log(`✅ Payroll calculated for ${payrollCalc.employee_name}:`);
    console.log(`   Base Salary: ₹${payrollCalc.breakdown.base_salary}`);
    console.log(`   Overtime Addition: +₹${payrollCalc.breakdown.overtime_addition}`);
    console.log(`   Late Deductions: -₹${payrollCalc.breakdown.late_penalty_deduction}`);
    console.log(`   Gross Salary: ₹${payrollCalc.breakdown.gross_salary}`);
    console.log(`   Total Deductions: ₹${payrollCalc.breakdown.total_deductions}`);
    console.log(`   Net Payable: ₹${payrollCalc.breakdown.net_salary}`);

    console.log('\n====================================================');
    console.log('🎉 ALL 8 BIOMETRIC & ATTENDANCE INTEGRATION TESTS PASSED!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runBiometricTestSuite();
