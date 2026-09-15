'use strict';

/**
 * Verification Test: WhatsApp Outbox Circuit Breaker & Gateway Resilience
 *
 * Validates:
 * 1. Circuit breaker trips immediately upon encountering "Insufficient credit".
 * 2. Attempts counter is preserved (not incremented) during credit exhaustion.
 * 3. Batch processing aborts immediately, protecting CPU and network.
 * 4. Queue checks are skipped while circuit breaker is active.
 * 5. Order verification worker skips execution during active circuit breaker.
 * 6. Circuit breaker can be queried via getStatus() and reset via resetCircuitBreaker().
 */

const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const { WhatsAppOutbox, Order, Customer } = require('../models');

async function runTest() {
  console.log('\n=============================================================');
  console.log('🧪 TESTING WHATSAPP OUTBOX CIRCUIT BREAKER & FAULT TOLERANCE');
  console.log('=============================================================\n');

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

  try {
    // -------------------------------------------------------------
    // Test 1: Initial Circuit Breaker State is Closed (Inactive)
    // -------------------------------------------------------------
    console.log('[STEP 1] Verifying initial circuit breaker state...');
    whatsappOutboxQueue.resetCircuitBreaker();
    assert(!whatsappOutboxQueue.isCircuitBreakerActive(), 'Circuit breaker initially closed / inactive');
    const initialStatus = whatsappOutboxQueue.getStatus();
    assert(!initialStatus.circuit_breaker_open, 'getStatus() reports circuit_breaker_open = false');

    // -------------------------------------------------------------
    // Test 2: Tripping Circuit Breaker on "Insufficient credit"
    // -------------------------------------------------------------
    console.log('\n[STEP 2] Simulating Insufficient credit failure on an outbox item...');
    const testItem = await WhatsAppOutbox.create({
      recipient_phone: '9988776655',
      template_name: 'order_verification_interactive',
      status: 'pending',
      attempts: 0,
      max_attempts: 5,
    });

    // Mock sendProductVerificationTemplate and sendTemplate to simulate remote gateway "Insufficient credit"
    const whatsappService = require('../services/whatsappService');
    const originalSendVerif = whatsappService.sendProductVerificationTemplate;
    const originalSendTemplate = whatsappService.sendTemplate;

    const creditErrorHandler = async () => {
      const err = new Error('Insufficient credit');
      err.isInsufficientCredit = true;
      throw err;
    };

    whatsappService.sendProductVerificationTemplate = creditErrorHandler;
    whatsappService.sendTemplate = creditErrorHandler;

    const processResult = await whatsappOutboxQueue.processItem(testItem);
    assert(processResult.circuitTripped === true, 'processItem identified credit error and set circuitTripped = true');
    assert(whatsappOutboxQueue.isCircuitBreakerActive(), 'Circuit breaker is now ACTIVE');

    // Verify item state
    const refreshedItem = await WhatsAppOutbox.findByPk(testItem.id);
    assert(refreshedItem.status === 'pending', 'Item remains pending (NOT failed)');
    assert(refreshedItem.attempts === 0, 'Attempts count preserved at 0 (did not burn retry budget)');
    assert(refreshedItem.last_error?.includes('Insufficient credit'), 'Error correctly recorded');
    assert(new Date(refreshedItem.next_attempt_at) > new Date(Date.now() + 10 * 60 * 1000), 'Next attempt postponed 15 minutes');

    // -------------------------------------------------------------
    // Test 3: processQueue skips completely while circuit breaker is open
    // -------------------------------------------------------------
    console.log('\n[STEP 3] Verifying processQueue skips when circuit breaker is active...');
    let apiHitCount = 0;
    whatsappService.sendProductVerificationTemplate = async () => {
      apiHitCount++;
      return { success: true };
    };

    await whatsappOutboxQueue.processQueue(10);
    assert(apiHitCount === 0, 'Zero API calls executed while circuit breaker active (queue skipped)');

    // -------------------------------------------------------------
    // Test 4: orderVerificationWorker skips when circuit breaker is open
    // -------------------------------------------------------------
    console.log('\n[STEP 4] Verifying order verification worker skips when circuit breaker is active...');
    const orderVerificationWorker = require('../services/orderVerificationWorker');
    const workerResult = await orderVerificationWorker.processOrderVerificationQueue();
    assert(workerResult.reason === 'circuit_breaker_active', 'Order verification worker skipped with reason: circuit_breaker_active');

    // -------------------------------------------------------------
    // Test 5: Circuit Breaker Reset & Recovery
    // -------------------------------------------------------------
    console.log('\n[STEP 5] Testing circuit breaker reset...');
    whatsappOutboxQueue.resetCircuitBreaker();
    assert(!whatsappOutboxQueue.isCircuitBreakerActive(), 'Circuit breaker is now closed after reset');

    // Clean up mock
    whatsappService.sendProductVerificationTemplate = originalSendVerif;
    whatsappService.sendTemplate = originalSendTemplate;
    await testItem.destroy({ force: true });

  } catch (err) {
    console.error('💥 Test error:', err);
    failed++;
  } finally {
    console.log('\n=============================================================');
    console.log(`📊 TEST RESULTS: Passed: ${passed}, Failed: ${failed}`);
    console.log('=============================================================\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTest();
