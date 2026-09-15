const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.NODE_ENV = 'test';
const assert = require('assert');
const { sequelize, WhatsAppOutbox } = require('../models');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');

async function runFeature3AcceptanceTests() {
  console.log('🧪 RUNNING FEATURE 3 ACCEPTANCE TESTS: WhatsApp Outbox Foundation & Idempotency\n');

  await sequelize.sync();

  const testOrderId = `test-ord-${Date.now()}`;
  const logicalIdempotencyKey = `order_verification_${testOrderId}`;
  const recipientPhone = '+919876543210';
  const templateName = 'order_verification_interactive';

  // Test: Calling enqueue FIVE times with the exact same logical key
  console.log(`1. Calling whatsappOutboxQueue.enqueue 5 times with logical key "${logicalIdempotencyKey}"...`);

  const results = [];
  for (let i = 1; i <= 5; i++) {
    const item = await whatsappOutboxQueue.enqueue({
      order_id: testOrderId,
      recipient_phone: recipientPhone,
      template_name: templateName,
      payload: { iteration: i },
      idempotency_key: logicalIdempotencyKey,
    });
    results.push(item);
  }

  // Verification 1: All 5 calls returned the exact same record ID
  const firstId = results[0].id;
  assert(firstId, 'Outbox item must have a valid ID');
  for (let i = 1; i < results.length; i++) {
    assert.strictEqual(
      results[i].id,
      firstId,
      `Iteration ${i + 1} returned ID ${results[i].id}, expected same ID ${firstId}`
    );
  }
  console.log('   ✓ All 5 calls returned the identical outbox record.');

  // Verification 2: Query DB directly - exactly 1 row must exist
  const countInDb = await WhatsAppOutbox.count({
    where: { idempotency_key: logicalIdempotencyKey },
  });
  assert.strictEqual(
    countInDb,
    1,
    `Expected exactly 1 row in database for key "${logicalIdempotencyKey}", but found ${countInDb}`
  );
  console.log('   ✓ Database contains exactly 1 logical outbox record (0 duplicates created).');

  // Verification 3: Verify Canonical Status & Fields
  const record = await WhatsAppOutbox.findOne({
    where: { idempotency_key: logicalIdempotencyKey },
  });
  assert.strictEqual(record.status, 'QUEUED', 'Status must be canonically QUEUED');
  assert(record.queued_at, 'queued_at must be populated');
  assert.strictEqual(record.idempotency_key, logicalIdempotencyKey);
  console.log('   ✓ Record status is canonically QUEUED with queued_at timestamp.');

  // Clean up
  await WhatsAppOutbox.destroy({ where: { idempotency_key: logicalIdempotencyKey } });

  console.log('\n🎉 ALL FEATURE 3 ACCEPTANCE TESTS PASSED (100% SUCCESS)\n');
}

runFeature3AcceptanceTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Feature 3 test failed:', err);
    process.exit(1);
  });
