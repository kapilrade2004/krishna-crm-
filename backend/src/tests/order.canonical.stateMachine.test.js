'use strict';

const assert = require('assert');
const {
  ORDER_WORKFLOW_STATES,
  canTransition,
  isValidState,
  isTerminalState,
} = require('../services/orderWorkflow/orderStateMachine');
const {
  OrderTransitionGuard,
  OrderTransitionError,
} = require('../services/orderWorkflow/orderTransitionGuard');

function runFeature1AcceptanceTests() {
  console.log('🧪 RUNNING FEATURE 1 ACCEPTANCE TESTS: Canonical Order Workflow State Machine\n');

  // Test 1: Validate Allowed Transition (PENDING_VERIFICATION → CONFIRMED)
  console.log('1. Verifying PENDING_VERIFICATION → CONFIRMED is allowed...');
  assert.strictEqual(
    canTransition(ORDER_WORKFLOW_STATES.PENDING_VERIFICATION, ORDER_WORKFLOW_STATES.CONFIRMED),
    true,
    'PENDING_VERIFICATION → CONFIRMED must be allowed'
  );
  const guardAllowed = OrderTransitionGuard.validate({
    currentState: ORDER_WORKFLOW_STATES.PENDING_VERIFICATION,
    targetState: ORDER_WORKFLOW_STATES.CONFIRMED,
  });
  assert.strictEqual(guardAllowed.allowed, true);
  assert.strictEqual(guardAllowed.isIdempotent, false);
  console.log('   ✓ PENDING_VERIFICATION → CONFIRMED passed successfully.');

  // Test 2: Validate Rejected Transition (CONFIRMED → SCREENSHOT_REQUESTED)
  console.log('2. Verifying CONFIRMED → SCREENSHOT_REQUESTED is strictly rejected...');
  assert.strictEqual(
    canTransition(ORDER_WORKFLOW_STATES.CONFIRMED, ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED),
    false,
    'CONFIRMED → SCREENSHOT_REQUESTED must be prohibited'
  );
  assert.throws(
    () => {
      OrderTransitionGuard.validate({
        currentState: ORDER_WORKFLOW_STATES.CONFIRMED,
        targetState: ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED,
      });
    },
    (err) => {
      assert(err instanceof OrderTransitionError);
      assert.strictEqual(err.code, 'TERMINAL_STATE_IMMUTABLE');
      return true;
    },
    'Should throw OrderTransitionError with code TERMINAL_STATE_IMMUTABLE'
  );
  console.log('   ✓ CONFIRMED → SCREENSHOT_REQUESTED strictly rejected.');

  // Test 3: Validate CANCELLED terminal state rejection
  console.log('3. Verifying CANCELLED → CONFIRMED is strictly rejected...');
  assert.strictEqual(
    canTransition(ORDER_WORKFLOW_STATES.CANCELLED, ORDER_WORKFLOW_STATES.CONFIRMED),
    false
  );
  assert.throws(
    () => {
      OrderTransitionGuard.validate({
        currentState: ORDER_WORKFLOW_STATES.CANCELLED,
        targetState: ORDER_WORKFLOW_STATES.CONFIRMED,
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'TERMINAL_STATE_IMMUTABLE');
      return true;
    }
  );
  console.log('   ✓ CANCELLED → CONFIRMED strictly rejected.');

  // Test 4: Idempotent same-state check
  console.log('4. Verifying same-state idempotent transitions...');
  const idempotentResult = OrderTransitionGuard.validate({
    currentState: ORDER_WORKFLOW_STATES.PENDING_VERIFICATION,
    targetState: ORDER_WORKFLOW_STATES.PENDING_VERIFICATION,
  });
  assert.strictEqual(idempotentResult.isIdempotent, true);
  console.log('   ✓ Same-state transition is safely marked idempotent.');

  // Test 5: Customer Phone Ownership Check
  console.log('5. Verifying customer ownership guard...');
  const mockOrder = {
    id: 'ord-123',
    order_number: 'ORD-TEST-001',
    customer_phone: '9876543210',
  };
  // Matching phone
  assert.strictEqual(
    OrderTransitionGuard.validateCustomerOwnership(mockOrder, '+919876543210'),
    true
  );
  // Mismatched phone
  assert.throws(
    () => {
      OrderTransitionGuard.validateCustomerOwnership(mockOrder, '9999999999');
    },
    (err) => {
      assert(err instanceof OrderTransitionError);
      assert.strictEqual(err.code, 'UNAUTHORIZED_ORDER_ACCESS');
      return true;
    }
  );
  console.log('   ✓ Customer ownership guard strictly blocks unauthorized phone numbers.');

  // Test 6: Invalid workflow state check
  console.log('6. Verifying unrecognized state validation...');
  assert.throws(
    () => {
      OrderTransitionGuard.validate({
        currentState: ORDER_WORKFLOW_STATES.PENDING_VERIFICATION,
        targetState: 'NON_EXISTENT_STATE',
      });
    },
    (err) => {
      assert.strictEqual(err.code, 'UNKNOWN_WORKFLOW_STATE');
      return true;
    }
  );
  console.log('   ✓ Unrecognized workflow state rejected.');

  console.log('\n🎉 ALL FEATURE 1 ACCEPTANCE TESTS PASSED (100% SUCCESS)\n');
}

runFeature1AcceptanceTests();
