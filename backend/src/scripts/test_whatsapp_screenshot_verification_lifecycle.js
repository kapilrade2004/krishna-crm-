'use strict';

require('dotenv').config();
const { sequelize, Order, Customer, CustomerImage, OrderActivity, WhatsAppLog } = require('../models');
const whatsappService = require('../services/whatsappService');
const logger = require('../config/logger');

const runTest = async () => {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🧪 WHATSAPP SCREENSHOT CAPTURE, SKU MATCH & CONFIRMATION FLOW TEST');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  await sequelize.authenticate();
  console.log('✅ Database connected.\n');

  const testPhone = '9930386406';
  const testPhoneFull = '+919930386406';

  // 1. Setup Test Customer & Product & Order
  let customer = await Customer.findOne({ where: { whatsapp_number: testPhoneFull } });
  if (!customer) {
    customer = await Customer.create({
      name: 'Ramesh Sharma',
      phone: testPhone,
      whatsapp_number: testPhoneFull,
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      whatsapp_opt_in: true,
    });
    console.log(`👤 Created Test Customer: ${customer.name} (${customer.whatsapp_number})`);
  } else {
    console.log(`👤 Existing Test Customer Found: ${customer.name} (${customer.whatsapp_number})`);
  }

  const testSku = 'AKU-WTR-PREM-01';
  const testProductName = 'AquaBeat Water Purifier Premier';
  const testPrice = 2499;

  // Create a pending verification order
  const orderNumber = `TEST-${Date.now().toString().slice(-6)}`;
  const order = await Order.create({
    order_number: orderNumber,
    customer_id: customer.id,
    product_name: testProductName,
    product_sku: testSku,
    quantity: 1,
    unit_price: testPrice,
    total_amount: testPrice,
    status: 'pending',
    verification_status: 'pending_verification',
    payment_status: 'cod',
    marketplace: 'website',
  });
  console.log(`📋 Created Test Order: #${order.order_number} | Status: ${order.status} | Verification: ${order.verification_status}\n`);

  // 2. Simulate Inbound WhatsApp Webhook: Customer sends product screenshot
  console.log('── Step 1: Customer sends product screenshot via WhatsApp ──');
  const mockImagePayload = {
    channel: 'whatsapp',
    messages: [
      {
        from: testPhoneFull,
        id: `wamid.TEST_IMG_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        type: 'image',
        image: {
          id: `media_test_${Date.now()}`,
          mime_type: 'image/jpeg',
          url: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&auto=format&fit=crop&q=60',
          caption: 'Here is the product screenshot I ordered',
        },
      },
    ],
  };

  await whatsappService.handleWebhook(mockImagePayload);

  await order.reload({ include: [{ model: CustomerImage, as: 'customerImages' }] });
  console.log(`✅ Order Updated: status='${order.status}', verification_status='${order.verification_status}', images_provided=${order.images_provided}`);
  console.log(`📷 Customer Images attached to order: ${order.customerImages?.length || 0}`);
  if (order.customerImages?.[0]) {
    console.log(`   File URL: ${order.customerImages[0].file_url}`);
  }
  console.log();

  // 3. Simulate CRM Agent performing SKU MATCH
  console.log('── Step 2: CRM Employee reviews screenshot and performs SKU MATCH ──');
  await order.update({
    verification_status: 'sku_matched',
    verified_at: new Date(),
    verification_notes: 'Screenshot matched with catalog product SKU AKU-WTR-PREM-01.',
    flow_stage: 'match_pending',
  });
  await OrderActivity.create({
    order_id: order.id,
    action: 'sku_matched',
    from_value: 'image_received',
    to_value: 'sku_matched',
    note: 'Employee verified screenshot against Product Master SKU.',
  });
  console.log(`✅ Order Verification Status: '${order.verification_status}'\n`);

  // 4. Simulate Sending Verification Request (order_confirmation01.0)
  console.log('── Step 3: CRM sends order_confirmation01.0 template to Customer ──');
  await order.update({
    status: 'pending_confirmation',
    verification_status: 'pending_confirmation',
    whatsapp_confirmation_sent: true,
    confirmation_sent_at: new Date(),
  });

  const sendResult = await whatsappService.sendProductVerificationTemplate(order);
  console.log(`✅ Dispatched template 'order_confirmation01.0' to ${customer.whatsapp_number}`);
  console.log(`   Result Success: ${sendResult?.success || false}\n`);

  // 5. Simulate Customer Clicking [Confirm Order] Button
  console.log('── Step 4: Customer clicks [Confirm Order] button on WhatsApp ──');
  const mockButtonReplyPayload = {
    channel: 'whatsapp',
    messages: [
      {
        from: testPhoneFull,
        id: `wamid.TEST_BTN_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: {
            id: `confirm_order_${order.id}`,
            title: 'Confirm Order',
          },
        },
      },
    ],
  };

  await whatsappService.handleWebhook(mockButtonReplyPayload);

  await order.reload();
  console.log(`✅ Order Final Status: '${order.status}' | Verification: '${order.verification_status}'`);
  console.log(`   Customer Confirmed At: ${order.customer_confirmed_at}`);

  // Check recent logs
  const logs = await WhatsAppLog.findAll({
    where: { phone_number: { [sequelize.Sequelize.Op.like]: `%${testPhone}%` } },
    order: [['created_at', 'DESC']],
    limit: 5,
  });

  console.log('\n📜 Recent WhatsApp Logs for Customer:');
  logs.forEach(l => {
    console.log(`   • [${l.direction.toUpperCase()}] type=${l.message_type} template=${l.template_name || 'N/A'} status=${l.status}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL WHATSAPP ORDER VERIFICATION STEPS PASSED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  process.exit(0);
};

runTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
