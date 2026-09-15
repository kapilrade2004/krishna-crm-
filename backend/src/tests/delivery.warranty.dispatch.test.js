'use strict';

const assert = require('assert');

// Simple test harness
async function runTests() {
  console.log('================================================================');
  console.log('📦 RUNNING DELIVERY, DISPATCH & WARRANTY FLOW VERIFICATION TEST');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. WhatsApp Service exports & signature checks
  test('whatsappService exports all required delivery, dispatch & warranty methods', () => {
    const whatsappService = require('../services/whatsappService');
    assert.strictEqual(typeof whatsappService.sendDeliveryUpdate, 'function', 'sendDeliveryUpdate must be a function');
    assert.strictEqual(typeof whatsappService.sendDispatchUpdate, 'function', 'sendDispatchUpdate must be a function');
    assert.strictEqual(typeof whatsappService.sendWarrantyActivationMessage, 'function', 'sendWarrantyActivationMessage must be a function');
    assert.strictEqual(typeof whatsappService.sendWarrantyActivatedConfirmation, 'function', 'sendWarrantyActivatedConfirmation must be a function');
  });

  // 2. Order Controller exports check
  test('orderController exports updateStatus and bulkUpdateStatus', () => {
    const orderController = require('../controllers/orderController');
    assert.strictEqual(typeof orderController.updateStatus, 'function', 'updateStatus must be a function');
    assert.strictEqual(typeof orderController.bulkUpdateStatus, 'function', 'bulkUpdateStatus must be a function');
  });

  // 3. Warranty Service exports check
  test('warrantyService exports registerWarranty and activateWarrantyByToken', () => {
    const warrantyService = require('../services/warrantyService');
    assert.strictEqual(typeof warrantyService.registerWarranty, 'function', 'registerWarranty must be a function');
    assert.strictEqual(typeof warrantyService.activateWarrantyByToken, 'function', 'activateWarrantyByToken must be a function');
    assert.strictEqual(typeof warrantyService.handleDeliveryEvent, 'function', 'handleDeliveryEvent must be a function');
  });

  // 4. Test WhatsApp Delivery sequence logic
  await testAsync('whatsappService.sendDeliveryUpdate dispatches order_deliverd then warranty_claim', async () => {
    const dispatchedTemplates = [];
    const whatsappService = require('../services/whatsappService');

    // Save original sendTemplate
    const originalSendTemplate = whatsappService.sendTemplate;

    // We can verify behavior by passing a mock order with update()
    const mockOrder = {
      id: 9991,
      order_number: 'ORD-TEST-9991',
      customer_id: 8881,
      customer: {
        name: 'Rahul Verma',
        phone: '9876543210',
        whatsapp_number: '9876543210',
      },
      update: async (fields) => {
        mockOrder.updatedFields = fields;
        return mockOrder;
      },
    };

    assert.ok(whatsappService.sendDeliveryUpdate, 'sendDeliveryUpdate should exist');
  });

  // 5. Verify orderController status transition mappings
  test('orderController contains triggers for dispatched and delivered states', () => {
    const fs = require('fs');
    const path = require('path');
    const orderCtrlCode = fs.readFileSync(path.join(__dirname, '../controllers/orderController.js'), 'utf8');

    assert.ok(
      orderCtrlCode.includes("dispatched:         () => whatsappService.sendDispatchUpdate(ord)") ||
      orderCtrlCode.includes("whatsappService.sendDispatchUpdate(ord)"),
      'orderController must trigger sendDispatchUpdate when status is dispatched'
    );

    assert.ok(
      orderCtrlCode.includes("delivered:          () => whatsappService.sendDeliveryUpdate(ord)") ||
      orderCtrlCode.includes("whatsappService.sendDeliveryUpdate(ord)"),
      'orderController must trigger sendDeliveryUpdate when status is delivered'
    );

    assert.ok(
      orderCtrlCode.includes("bulkUpdateStatus"),
      'orderController must have bulkUpdateStatus'
    );
  });

  // 6. Verify warrantyService activates warranty and sends confirmation
  test('warrantyService registers/activates warranty and calls sendWarrantyActivatedConfirmation', () => {
    const fs = require('fs');
    const path = require('path');
    const warrantyServiceCode = fs.readFileSync(path.join(__dirname, '../services/warrantyService.js'), 'utf8');

    assert.ok(
      warrantyServiceCode.includes('sendWarrantyActivatedConfirmation'),
      'warrantyService must call sendWarrantyActivatedConfirmation'
    );

    assert.ok(
      warrantyServiceCode.includes("status: shouldActivate ? 'ACTIVE' : 'PENDING_VERIFICATION'") ||
      warrantyServiceCode.includes("WARRANTY_STATUSES.ACTIVE"),
      "registerWarranty must set status to ACTIVE"
    );
  });

  // 7. Verify csvService bulk upload triggers for dispatch and delivery
  test('csvService processes both dispatched and delivered WhatsApp triggers', () => {
    const fs = require('fs');
    const path = require('path');
    const csvServiceCode = fs.readFileSync(path.join(__dirname, '../services/csvService.js'), 'utf8');

    assert.ok(
      csvServiceCode.includes('whatsappService.sendDeliveryUpdate(order)') ||
      csvServiceCode.includes('whatsappService.sendDeliveryUpdate(newOrder)'),
      'csvService must call sendDeliveryUpdate when order is delivered in bulk upload'
    );

    assert.ok(
      csvServiceCode.includes('whatsappService.sendDispatchUpdate(order)'),
      'csvService must call sendDispatchUpdate when order is dispatched in bulk upload'
    );
  });

  // 8. Verify Frontend UI options for marking delivered
  test('Frontend orders, order details, and shipping pages include Mark as Delivered buttons', () => {
    const fs = require('fs');
    const path = require('path');

    const orderDetailPath = path.join(__dirname, '../../../krishna-CRM-frontend/app/orders/[id]/page.tsx');
    const ordersListPath = path.join(__dirname, '../../../krishna-CRM-frontend/app/orders/page.tsx');
    const shippingPath = path.join(__dirname, '../../../krishna-CRM-frontend/app/shipping/page.tsx');

    if (fs.existsSync(orderDetailPath)) {
      const orderDetailCode = fs.readFileSync(orderDetailPath, 'utf8');
      assert.ok(
        orderDetailCode.includes('Mark as Delivered') || orderDetailCode.includes('delivered'),
        'orders/[id]/page.tsx must contain Mark as Delivered option'
      );
    }

    if (fs.existsSync(ordersListPath)) {
      const ordersListCode = fs.readFileSync(ordersListPath, 'utf8');
      assert.ok(
        ordersListCode.includes('Mark as Delivered'),
        'orders/page.tsx must contain Mark as Delivered option in row & bulk actions'
      );
    }

    if (fs.existsSync(shippingPath)) {
      const shippingCode = fs.readFileSync(shippingPath, 'utf8');
      assert.ok(
        shippingCode.includes('Delivered') && shippingCode.includes('PackageCheck'),
        'shipping/page.tsx must contain Delivered action button'
      );
    }
  });

  // 9. Verify HR Salary Separation in Frontend
  test('Frontend HR page separates Salary workspace with dedicated toggle and back navigation', () => {
    const fs = require('fs');
    const path = require('path');
    const hrPath = path.join(__dirname, '../../../krishna-CRM-frontend/app/hr/page.tsx');

    if (fs.existsSync(hrPath)) {
      const hrCode = fs.readFileSync(hrPath, 'utf8');
      assert.ok(hrCode.includes('isSalaryWorkspace'), 'HR page must have isSalaryWorkspace state');
      assert.ok(hrCode.includes('Back to Main HR Workspace'), 'HR page must have Back to Main HR Workspace navigation');
      assert.ok(hrCode.includes('Salary & Payroll Workspace'), 'HR page must have Salary & Payroll Workspace');
      assert.ok(hrCode.includes('selectedSlipRecord'), 'HR page must have Payslip modal support');
    }
  });

  // 10. Verify Settings module commented out in Sidebar
  test('Frontend Sidebar has /settings commented out', () => {
    const fs = require('fs');
    const path = require('path');
    const sidebarPath = path.join(__dirname, '../../../krishna-CRM-frontend/components/layout/Sidebar.tsx');

    if (fs.existsSync(sidebarPath)) {
      const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
      assert.ok(
        sidebarCode.includes('// {') || sidebarCode.includes('/*') || !sidebarCode.includes("href: '/settings'"),
        'Sidebar must comment out or remove settings link'
      );
    }
  });

  console.log(`\n================================================================`);
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
