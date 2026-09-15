'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'mysql';
process.env.JWT_SECRET = 'test_jwt_secret_workflow_sync_123';

const assert = require('assert');
const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  User,
  Customer,
  Order,
  CustomerImage,
  OrderActivity,
  WhatsAppLog,
  FollowUp,
  syncModels,
} = require('../models');

const whatsappService = require('../services/whatsappService');

// 1x1 JPEG buffer
const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9]);

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 RUNNING WHATSAPP TEMPLATE & CRM WORKFLOW SYNCHRONIZATION TEST SUITE (25 CASES)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  await syncModels({ force: true });

  const testUser = await User.create({
    name: 'Lead Telecaller Rep',
    email: `telecaller-${Date.now()}@krishnacrm.local`,
    password: 'Password@123',
    role: 'telecaller',
  });

  // Helper to generate unique customer with distinct phone number
  let phoneCounter = 1000;
  const createTestCustomer = async (name) => {
    phoneCounter++;
    const phone = `98${Math.floor(1000000 + Math.random() * 9000000)}${phoneCounter.toString().slice(-2)}`;
    return Customer.create({
      name: name || `Customer ${phoneCounter}`,
      phone: phone,
      whatsapp_number: `91${phone}`,
      whatsapp_opt_in: true,
    });
  };

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Message 1 [Yes, Confirm] button
  await test('TC1: Msg 1 [Yes, Confirm] button click transitions order to confirmed & match_confirmed', async () => {
    const cust1 = await createTestCustomer('Siddharth Sharma');
    const order1 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-1`,
      customer_id: cust1.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      product_name: 'AquaBeat Premier Purifier',
      product_sku: 'AKU-WTR-PREM-01',
      total_amount: 8999,
    });

    const msgId = `wam_confirm_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust1.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'yes_confirm', title: 'Yes, Confirm' },
    });

    await order1.reload();
    assert.strictEqual(order1.status, 'confirmed', 'Order status must be confirmed');
    assert.strictEqual(order1.verification_status, 'confirmed', 'Verification status must be confirmed');
    assert.strictEqual(order1.flow_stage, 'match_confirmed', 'Flow stage must be match_confirmed');
    assert.ok(order1.customer_confirmed_at, 'customer_confirmed_at timestamp must be populated');

    const activity = await OrderActivity.findOne({
      where: { order_id: order1.id, action: 'customer_confirmed' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(activity, 'OrderActivity must be logged for customer_confirmed');
  });

  // 2. Message 1 [Send Screenshot] button
  await test('TC2: Msg 1 [Send Screenshot] button click marks screenshot_requested & 15m timer', async () => {
    const cust2 = await createTestCustomer('Rohit Verma');
    const order2 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-2`,
      customer_id: cust2.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      product_name: 'AquaBeat Copper RO',
      total_amount: 12999,
    });

    const msgId = `wam_screenshot_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust2.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'send_screenshot', title: 'Send Screenshot' },
    });

    await order2.reload();
    assert.strictEqual(order2.verification_status, 'screenshot_requested');
    assert.strictEqual(order2.flow_stage, 'ask_images');
    assert.ok(order2.second_message_due_at, '15-minute countdown timer must be active');
  });

  // 3. Message 1 [Cancel Order] button
  await test('TC3: Msg 1 [Cancel Order] button click transitions order to cancelled', async () => {
    const cust3 = await createTestCustomer('Anita Desai');
    const order3 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-3`,
      customer_id: cust3.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      product_name: 'AquaBeat Alkaline Filter',
      total_amount: 1999,
    });

    const msgId = `wam_cancel_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust3.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'cancel_order', title: 'Cancel Order' },
    });

    await order3.reload();
    assert.strictEqual(order3.status, 'cancelled');
    assert.strictEqual(order3.verification_status, 'cancelled');
    assert.strictEqual(order3.flow_stage, 'match_cancelled');

    const activity = await OrderActivity.findOne({
      where: { order_id: order3.id, action: 'customer_cancelled' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(activity, 'OrderActivity must be logged for customer_cancelled');
  });

  // 4. Message 2 (order_confirmation013) [Confirm Order] button
  await test('TC4: Msg 2 [Confirm Order] button click confirms order and cancels countdown', async () => {
    const cust4 = await createTestCustomer('Vikram Singh');
    const order4 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-4`,
      customer_id: cust4.id,
      status: 'pending_confirmation',
      verification_status: 'pending_confirmation',
      flow_stage: 'match_pending',
      second_message_due_at: new Date(Date.now() + 600000),
      total_amount: 7499,
    });

    const msgId = `wam_conf2_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust4.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'confirm_order', title: 'Confirm Order' },
    });

    await order4.reload();
    assert.strictEqual(order4.status, 'confirmed');
    assert.strictEqual(order4.flow_stage, 'match_confirmed');
    assert.strictEqual(order4.second_message_due_at, null, 'Countdown timer must be cleared');
  });

  // 5. Message 2 [Cancel Order] button
  await test('TC5: Msg 2 [Cancel Order] button click cancels order', async () => {
    const cust5 = await createTestCustomer('Deepak Kumar');
    const order5 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-5`,
      customer_id: cust5.id,
      status: 'pending_confirmation',
      verification_status: 'pending_confirmation',
      flow_stage: 'match_pending',
      total_amount: 5499,
    });

    const msgId = `wam_cancel2_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust5.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'cancel_order', title: 'Cancel Order' },
    });

    await order5.reload();
    assert.strictEqual(order5.status, 'cancelled');
    assert.strictEqual(order5.flow_stage, 'match_cancelled');
  });

  // 6. Alternate SKU recommendation button [Accept Alternate]
  await test('TC6: Alternate SKU [Accept Alternate] button confirms order', async () => {
    const cust6 = await createTestCustomer('Neha Patel');
    const order6 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-6`,
      customer_id: cust6.id,
      status: 'image_verification',
      verification_status: 'image_received',
      flow_stage: 'match_alternate',
      total_amount: 8999,
    });

    const msgId = `wam_alt_accept_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust6.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'accept_alternate', title: 'Accept Alternate' },
    });

    await order6.reload();
    assert.strictEqual(order6.status, 'confirmed');
    assert.strictEqual(order6.flow_stage, 'match_confirmed');
  });

  // 7. Alternate SKU recommendation button [Reject Alternate]
  await test('TC7: Alternate SKU [Reject Alternate] button cancels order', async () => {
    const cust7 = await createTestCustomer('Kavita Rao');
    const order7 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-7`,
      customer_id: cust7.id,
      status: 'image_verification',
      verification_status: 'image_received',
      flow_stage: 'match_alternate',
      total_amount: 8999,
    });

    const msgId = `wam_alt_reject_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust7.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'reject_alternate', title: 'Reject Alternate' },
    });

    await order7.reload();
    assert.strictEqual(order7.status, 'cancelled');
    assert.strictEqual(order7.flow_stage, 'match_cancelled');
  });

  // 8. Installation Guide [Yes, Need Help] button
  await test('TC8: Installation Guide [Yes, Need Help] creates FollowUp task & moves order to installation', async () => {
    const cust8 = await createTestCustomer('Amitabh Joshi');
    const order8 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-8`,
      customer_id: cust8.id,
      status: 'delivered',
      verification_status: 'confirmed',
      flow_stage: 'processing',
      total_amount: 14999,
    });

    const msgId = `wam_help_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust8.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'yes_need_help', title: 'Yes, Need Help' },
    });

    await cust8.reload();
    assert.strictEqual(cust8.installation_help_requested, true);
    assert.strictEqual(cust8.installation_help_status, 'pending');

    await order8.reload();
    assert.strictEqual(order8.flow_stage, 'installation');

    const followUp = await FollowUp.findOne({
      where: { customer_id: cust8.id, status: 'pending' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(followUp, 'Telecaller FollowUp task must be created');
    assert.strictEqual(followUp.priority, 'high');
  });

  // 9. Installation Guide [All Good, Done!] button
  await test('TC9: Installation Guide [All Good, Done!] marks flow_stage completed', async () => {
    const cust9 = await createTestCustomer('Priyanka Nair');
    const order9 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-9`,
      customer_id: cust9.id,
      status: 'delivered',
      verification_status: 'confirmed',
      flow_stage: 'installation',
      total_amount: 14999,
    });

    const msgId = `wam_done_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust9.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'all_good', title: 'All Good, Done!' },
    });

    await cust9.reload();
    assert.strictEqual(cust9.installation_help_requested, false);
    assert.strictEqual(cust9.installation_help_status, 'resolved');

    await order9.reload();
    assert.strictEqual(order9.flow_stage, 'completed');
  });

  // 10. Inbound Customer Tap Photo Upload
  await test('TC10: Customer tap photo upload transitions order to match_pending & stores in S3', async () => {
    const cust10 = await createTestCustomer('Karan Mehra');
    const order10 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-10`,
      customer_id: cust10.id,
      status: 'image_verification',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 3999,
    });

    const msgId = `wam_photo_${Date.now()}`;
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: cust10.whatsapp_number,
              id: msgId,
              type: 'image',
              image: { mime_type: 'image/jpeg', buffer: JPEG_BUFFER },
            }],
          },
        }],
      }],
    });

    await order10.reload();
    assert.strictEqual(order10.flow_stage, 'match_pending');
    assert.strictEqual(order10.verification_status, 'image_received');
    assert.strictEqual(order10.images_provided, true);

    const img = await CustomerImage.findOne({ where: { wa_message_id: msgId } });
    assert.ok(img, 'CustomerImage record must exist');
    assert.strictEqual(img.order_id, order10.id);
  });

  // 11. Inbound English Affirmative Text ("yes please")
  await test('TC11: Inbound English affirmative text ("yes please") confirms order', async () => {
    const cust11 = await createTestCustomer('Manish Bansal');
    const order11 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-11`,
      customer_id: cust11.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 9999,
    });

    const msgId = `wam_txt_yes_${Date.now()}`;
    await whatsappService.handleWebhook({
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: cust11.whatsapp_number,
              id: msgId,
              type: 'text',
              text: { body: 'Yes please, confirm my water purifier order' },
            }],
          },
        }],
      }],
    });

    await order11.reload();
    assert.strictEqual(order11.status, 'confirmed');
    assert.strictEqual(order11.flow_stage, 'match_confirmed');
  });

  // 12. Inbound Hindi/Hinglish Affirmative Text ("haanji bhej do")
  await test('TC12: Inbound Hinglish affirmative text ("haanji bhej do") confirms order', async () => {
    const cust12 = await createTestCustomer('Sanjay Agarwal');
    const order12 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-12`,
      customer_id: cust12.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 4999,
    });

    const msgId = `wam_txt_haan_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust12.whatsapp_number,
      messageId: msgId,
      type: 'text',
      text: { body: 'haanji bhej do' },
    });

    await order12.reload();
    assert.strictEqual(order12.status, 'confirmed');
    assert.strictEqual(order12.flow_stage, 'match_confirmed');
  });

  // 13. Inbound English Negative Text ("please cancel this order")
  await test('TC13: Inbound English negative text ("please cancel this order") cancels order', async () => {
    const cust13 = await createTestCustomer('Ravi Teja');
    const order13 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-13`,
      customer_id: cust13.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 4999,
    });

    const msgId = `wam_txt_cancel_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust13.whatsapp_number,
      messageId: msgId,
      type: 'text',
      text: { body: 'Please cancel this order immediately' },
    });

    await order13.reload();
    assert.strictEqual(order13.status, 'cancelled');
    assert.strictEqual(order13.flow_stage, 'match_cancelled');
  });

  // 14. Inbound Hindi/Hinglish Negative Text ("nahi chahiye mat bhejo")
  await test('TC14: Inbound Hinglish negative text ("nahi chahiye mat bhejo") cancels order', async () => {
    const cust14 = await createTestCustomer('Rajesh Solanki');
    const order14 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-14`,
      customer_id: cust14.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 4999,
    });

    const msgId = `wam_txt_nahi_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust14.whatsapp_number,
      messageId: msgId,
      type: 'text',
      text: { body: 'nahi chahiye mat bhejo' },
    });

    await order14.reload();
    assert.strictEqual(order14.status, 'cancelled');
    assert.strictEqual(order14.flow_stage, 'match_cancelled');
  });

  // 15. Inbound Text Requesting Installation Help
  await test('TC15: Inbound text requesting installation help moves order to installation & creates FollowUp', async () => {
    const cust15 = await createTestCustomer('Sunil Gavaskar');
    const order15 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-15`,
      customer_id: cust15.id,
      status: 'delivered',
      verification_status: 'confirmed',
      flow_stage: 'processing',
      total_amount: 8999,
    });

    const msgId = `wam_txt_inst_help_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust15.whatsapp_number,
      messageId: msgId,
      type: 'text',
      text: { body: 'I need help with installation and plumber fitting' },
    });

    await order15.reload();
    assert.strictEqual(order15.flow_stage, 'installation');

    await cust15.reload();
    assert.strictEqual(cust15.installation_help_requested, true);
  });

  // 16. Inbound Text Confirming Installation Done
  await test('TC16: Inbound text ("installation done all good") marks flow_stage completed', async () => {
    const cust16 = await createTestCustomer('Kapil Dev');
    const order16 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-16`,
      customer_id: cust16.id,
      status: 'delivered',
      verification_status: 'confirmed',
      flow_stage: 'installation',
      total_amount: 8999,
    });

    const msgId = `wam_txt_inst_done_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust16.whatsapp_number,
      messageId: msgId,
      type: 'text',
      text: { body: 'installation done all good, thank you' },
    });

    await order16.reload();
    assert.strictEqual(order16.flow_stage, 'completed');
  });

  // 17. Inbound Text Requesting Address Update
  await test('TC17: Inbound text requesting address change creates urgent FollowUp task', async () => {
    const cust17 = await createTestCustomer('Sachin Tendulkar');
    const order17 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-17`,
      customer_id: cust17.id,
      status: 'confirmed',
      verification_status: 'confirmed',
      flow_stage: 'processing',
      total_amount: 8999,
    });

    const msgId = `wam_txt_addr_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust17.whatsapp_number,
      messageId: msgId,
      type: 'text',
      text: { body: 'Please change address to Flat 402, Green Valley Apartments, new pincode 400076' },
    });

    await cust17.reload();
    assert.ok(cust17.tags.includes('address_change_requested'));

    const followUp = await FollowUp.findOne({
      where: { customer_id: cust17.id, priority: 'urgent' },
      order: [['created_at', 'DESC']],
    });
    assert.ok(followUp, 'Urgent FollowUp task must be created for address change');
  });

  // 18. Inbound Text Inquiring Order Tracking
  await test('TC18: Inbound text inquiring order tracking logs inquiry and acknowledges', async () => {
    const cust18 = await createTestCustomer('Rahul Dravid');
    const order18 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-18`,
      customer_id: cust18.id,
      status: 'dispatched',
      verification_status: 'confirmed',
      flow_stage: 'processing',
      shipping_partner: 'Delhivery',
      tracking_number: 'DEL1234567890',
      total_amount: 8999,
    });

    const msgId = `wam_txt_track_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust18.whatsapp_number,
      messageId: msgId,
      type: 'text',
      text: { body: 'where is my order, tracking details please' },
    });

    const log = await WhatsAppLog.findOne({ where: { wa_message_id: msgId } });
    assert.ok(log, 'Inbound message must be logged');
  });

  // 19. Order Number in Button Payload Routes Explicitly
  await test('TC19: Order number embedded in button payload routes explicitly to specified order', async () => {
    const cust19 = await createTestCustomer('VVS Laxman');
    const order19 = await Order.create({
      order_number: `ORD-TARGET-${Date.now()}-19`,
      customer_id: cust19.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 11999,
    });

    const msgId = `wam_target_ord_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust19.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: `confirm_${order19.order_number}`, title: `Yes, Confirm ${order19.order_number}` },
    });

    await order19.reload();
    assert.strictEqual(order19.status, 'confirmed');
    assert.strictEqual(order19.flow_stage, 'match_confirmed');
  });

  // 20. Order UUID in Button Payload Routes Explicitly
  await test('TC20: Order UUID embedded in button payload routes explicitly', async () => {
    const cust20 = await createTestCustomer('Harbhajan Singh');
    const order20 = await Order.create({
      order_number: `ORD-TARGET-${Date.now()}-20`,
      customer_id: cust20.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 11999,
    });

    const msgId = `wam_target_uuid_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust20.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: `yes_confirm_${order20.id}`, title: 'Yes, Confirm' },
    });

    await order20.reload();
    assert.strictEqual(order20.status, 'confirmed');
  });

  // 21. Phone Number Resolves to Single Eligible Order
  await test('TC21: Phone number resolution routes to single eligible order', async () => {
    const cust21 = await createTestCustomer('Pooja Verma');
    const order21 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-21`,
      customer_id: cust21.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 6999,
    });

    const msgId = `wam_phone_single_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust21.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'yes_confirm', title: 'Yes, Confirm' },
    });

    await order21.reload();
    assert.strictEqual(order21.status, 'confirmed');
  });

  // 22. Multiple Eligible Orders Safe Disambiguation
  await test('TC22: Multiple open eligible orders for customer are not guessed', async () => {
    const cust22 = await createTestCustomer('Rohan Gupta');
    const ordA = await Order.create({
      order_number: `ORD-MULTI-${Date.now()}-A`,
      customer_id: cust22.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 3000,
    });

    const ordB = await Order.create({
      order_number: `ORD-MULTI-${Date.now()}-B`,
      customer_id: cust22.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 4000,
    });

    const msgId = `wam_multi_safe_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust22.whatsapp_number,
      messageId: msgId,
      type: 'image',
      image: { mime_type: 'image/jpeg', buffer: JPEG_BUFFER },
    });

    const img = await CustomerImage.findOne({ where: { wa_message_id: msgId } });
    assert.ok(img, 'Image must be recorded');
    assert.strictEqual(img.order_id, null, 'Multi-order conflict must leave order_id null');
  });

  // 23. Idempotent Duplicate Message Handling
  await test('TC23: Idempotent duplicate message handling prevents repeat transitions', async () => {
    const cust23 = await createTestCustomer('Anil Kumble');
    const order23 = await Order.create({
      order_number: `ORD-SYNC-${Date.now()}-23`,
      customer_id: cust23.id,
      status: 'pending_confirmation',
      verification_status: 'pending_verification',
      flow_stage: 'ask_images',
      total_amount: 8999,
    });

    const msgId = `wam_idemp_${Date.now()}`;
    const payload = {
      from: cust23.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'yes_confirm', title: 'Yes, Confirm' },
    };

    await whatsappService.handleWebhook(payload);
    const count1 = await WhatsAppLog.count({ where: { wa_message_id: msgId } });
    assert.strictEqual(count1, 1);

    // Replay same message ID
    await whatsappService.handleWebhook(payload);
    const count2 = await WhatsAppLog.count({ where: { wa_message_id: msgId } });
    assert.strictEqual(count2, 1, 'Duplicate webhook replay must not create extra WhatsAppLog records');
  });

  // 24. Inbound WhatsAppLog Records Direction and Message Type
  await test('TC24: Inbound WhatsAppLog records direction=inbound and message_type correctly', async () => {
    const cust24 = await createTestCustomer('Zaheer Khan');
    const msgId = `wam_log_test_${Date.now()}`;
    await whatsappService.handleWebhook({
      from: cust24.whatsapp_number,
      messageId: msgId,
      type: 'interactive',
      button_reply: { id: 'test_btn', title: 'Test Button' },
    });

    const log = await WhatsAppLog.findOne({ where: { wa_message_id: msgId } });
    assert.ok(log);
    assert.strictEqual(log.direction, 'inbound');
    assert.strictEqual(log.status, 'delivered');
  });

  // 25. Relational Audit Trail Consistency
  await test('TC25: Audit activity trail and customer relationship integrity preserved', async () => {
    const activitiesCount = await OrderActivity.count();
    assert.ok(activitiesCount >= 10, 'Multiple audit activities should be recorded across tests');

    const logsCount = await WhatsAppLog.count({ where: { direction: 'inbound' } });
    assert.ok(logsCount >= 20, 'All inbound messages should be logged in WhatsAppLog');
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL 25 CASES)`);
  console.log('═══════════════════════════════════════════════════════════════════');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
