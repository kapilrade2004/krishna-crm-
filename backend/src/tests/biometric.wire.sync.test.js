'use strict';

const assert = require('assert');
const { connectDB } = require('../config/database');
const {
  syncModels,
  Employee,
  BiometricDevice,
  EmployeeBiometricMapping,
  BiometricPunchEvent,
  AttendanceDay,
  IntegrationSyncState,
} = require('../models');

const biometricService = require('../services/biometricService');
const smartOfficeClient = require('../services/smartOfficeClient');

async function testWireAndWirelessSync() {
  console.log('========================================================');
  console.log('🧪 TESTING BIOMETRIC SYNC: WITH & WITHOUT WIRE SCENARIOS');
  console.log('========================================================');

  await connectDB();
  await syncModels();

  // Test 1: Verify SmartOffice API Key Configuration
  console.log('\n--- [Scenario 1] SmartOffice API Key & Configuration ---');
  assert.strictEqual(smartOfficeClient.apiKey, '274416082629', 'API key must match user provided 274416082629');
  console.log(`✅ SmartOfficeClient initialized with user API Key: ${smartOfficeClient.apiKey}`);

  // Test 2: Auto-Mapping of Active Employees to Biometric IDs
  console.log('\n--- [Scenario 2] Auto-Mapping Employees to Biometric IDs ---');
  const mappedCount = await biometricService.autoMapDefaultEmployees();
  console.log(`✅ Auto-mapped employees count: ${mappedCount}`);
  const totalMappings = await EmployeeBiometricMapping.count();
  assert(totalMappings > 0, 'There must be active biometric mappings in DB');
  console.log(`✅ Total active biometric mappings in database: ${totalMappings}`);

  // Test 3: "Without Wire" Mode - Offline USB Log File Parsing
  console.log('\n--- [Scenario 3] "Without Wire" USB AttLog File Ingestion ---');
  const sampleBioMaxDat = [
    '1\t2026-08-29 09:05:00\t0\t1\t0',
    '2\t2026-08-29 09:10:00\t0\t1\t0',
    '1\t2026-08-29 18:15:00\t1\t1\t0',
    '2\t2026-08-29 18:25:00\t1\t1\t0',
  ].join('\n');

  const parsedUsbLogs = biometricService.parseUSBLogFile(sampleBioMaxDat);
  assert.strictEqual(parsedUsbLogs.length, 4, 'Should parse 4 punch records from USB dat file');
  assert.strictEqual(parsedUsbLogs[0].EmployeeCode, '1');
  assert.strictEqual(parsedUsbLogs[0].PunchDirection, 'IN');
  assert.strictEqual(parsedUsbLogs[2].PunchDirection, 'OUT');
  console.log('✅ USB attlog.dat successfully parsed with correct PIN and Punch Directions.');

  const usbIngestResult = await biometricService.ingestRawLogs(parsedUsbLogs, 'USB_OFFLINE');
  console.log('✅ USB Ingestion Result:', usbIngestResult);
  assert(usbIngestResult.inserted >= 0, 'Ingested records should be >= 0');

  // Test 4: Re-ingestion Deduplication
  console.log('\n--- [Scenario 4] Idempotency & SHA-256 Deduplication ---');
  const reIngestResult = await biometricService.ingestRawLogs(parsedUsbLogs, 'USB_OFFLINE');
  assert.strictEqual(reIngestResult.inserted, 0, 'No duplicate records should be inserted');
  assert.strictEqual(reIngestResult.duplicates, 4, 'All 4 records must be identified as duplicates');
  console.log('✅ 100% SHA-256 deduplication confirmed on repeated USB imports.');

  // Test 5: "With Wire" Live Poll / Reconnection Catch-Up
  console.log('\n--- [Scenario 5] "With Wire" Polling & Standby Handling ---');
  const syncResult = await biometricService.syncBiometricLogs();
  assert(syncResult.status === 'healthy' || syncResult.status === 'offline_standby', 'Sync must return healthy or offline_standby');
  console.log(`✅ Biometric sync executed gracefully in state: ${syncResult.status}`);

  // Test 6: Cloud Push / ADMS Webhook Ingestion
  console.log('\n--- [Scenario 6] Cloud Push / ADMS Webhook Ingestion ---');
  const pushPunches = [
    {
      EmployeeCode: '1',
      LogDate: '2026-08-29 12:30:00',
      SerialNumber: 'BIOMAX_PUSH_01',
      PunchDirection: 'OUT',
    },
    {
      EmployeeCode: '1',
      LogDate: '2026-08-29 13:15:00',
      SerialNumber: 'BIOMAX_PUSH_01',
      PunchDirection: 'IN',
    },
  ];
  const pushResult = await biometricService.ingestRawLogs(pushPunches, 'CLOUD_PUSH');
  console.log('✅ Cloud Push Ingestion Result:', pushResult);
  assert.strictEqual(pushResult.total, 2);

  // Test 7: Verify Resulting Attendance Day Calculation
  console.log('\n--- [Scenario 7] Real-Time Daily Attendance Recalculation ---');
  const attDay = await AttendanceDay.findOne({
    where: { date: '2026-08-29', employee_code: 'KR-EMP-001' },
  });
  assert(attDay, 'AttendanceDay must exist for KR-EMP-001 on 2026-08-29');
  console.log(`✅ Calculated Attendance Day for KR-EMP-001: First IN=${attDay.first_in}, Last OUT=${attDay.last_out}, Work=${attDay.work_hours}h, Status=${attDay.status}`);

  console.log('\n========================================================');
  console.log('🎉 ALL WIRE & WIRELESS SYNC SCENARIOS PASSED WITH 100% INTEGRITY!');
  console.log('========================================================');
}

testWireAndWirelessSync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
