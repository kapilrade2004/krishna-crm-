'use strict';

require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.WHATSAPP_SANDBOX = 'true';
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const {
  sequelize,
  Order,
  Customer,
  Warranty,
  CustomerImage,
  OrderEvent,
  WhatsAppOutbox,
  WhatsAppLog,
  FollowUp,
  User,
  CsvImportBatch,
} = require('../models');
const OrderImportService = require('../services/orderImport/orderImportService');
const whatsappOutboxQueue = require('../services/whatsappOutboxQueue');
const WhatsAppWebhookService = require('../services/whatsapp/whatsappWebhookService');
const DeliveryEventOrchestrator = require('../services/orderWorkflow/deliveryEventOrchestrator');
const { verifyActivationToken } = require('../services/warrantyTokenService');
const OrderWorkflowService = require('../services/orderWorkflow/orderWorkflowService');
const { ORDER_WORKFLOW_STATES } = require('../services/orderWorkflow/orderStateMachine');

async function runFinalLiveTrace() {
  console.log('\n======================================================================');
  console.log('🚀 SECTION 65: FINAL LIVE END-TO-END VERIFICATION TRACE');
  console.log('======================================================================\n');

  const traceId = Math.floor(100000 + Math.random() * 900000);
  const orderNumber = `AMZ-TRACE-${traceId}`;
  const phone = `998877${traceId.toString().slice(-4)}`;
  const email = `customer.trace.${traceId}@example.com`;
  const name = `Trace Customer ${traceId}`;

  const traceReport = {
    traceId,
    orderId: null,
    customerId: null,
    outboxIds: {},
    providerMessageIds: {},
    imageId: null,
    warrantyId: null,
    telecallerId: null,
    timestamps: {},
  };

  try {
    await sequelize.authenticate();
    const [testUser] = await User.findOrCreate({
      where: { email: 'trace.runner@krishnacrm.com' },
      defaults: {
        id: uuidv4(),
        name: 'Trace Runner',
        email: 'trace.runner@krishnacrm.com',
        password: '$2a$10$abcdefghijklmnopqrstuuTracePasswordHash',
        role: 'admin',
        is_active: true,
      },
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: IMPORT & ORDER CREATION
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.import_started = new Date().toISOString();
    console.log(`[1] Importing order ${orderNumber} for phone ${phone}...`);

    const ws = XLSX.utils.json_to_sheet([
      {
        'Order ID': orderNumber,
        'Buyer Name': name,
        'Buyer Phone Number': phone,
        'Buyer Email': email,
        'Product Name': 'AquaBeat Alkaline Water Purifier Pro',
        'SKU': 'AKUA-ALK-PRO-01',
        'Quantity': '1',
        'Unit Price': '14999.00',
        'Shipping Address': '42 Marine Drive, Mumbai, MH',
        'Order Date': new Date().toISOString(),
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const batch = await CsvImportBatch.create({
      id: uuidv4(),
      filename: `trace_${traceId}.xlsx`,
      original_name: `trace_${traceId}.xlsx`,
      file_path: `/tmp/trace_${traceId}.xlsx`,
      file_size: fileBuffer.length,
      channel: 'amazon_channel_1',
      marketplace: 'amazon',
      status: 'PROCESSING',
      total_rows: 1,
      uploaded_by: testUser.id,
    });

    const importRes = await OrderImportService.processImport({
      fileBuffer,
      originalName: `trace_${traceId}.xlsx`,
      channel: 'amazon_channel_1',
      marketplace: 'amazon',
      batchId: batch.id,
      userId: testUser.id,
    });

    traceReport.timestamps.import_completed = new Date().toISOString();
    console.log(`    ✅ Import completed: Success=${importRes.successRows}, Duplicates=${importRes.duplicateRows}, Failed=${importRes.failedRows}`);

    const order = await Order.findOne({ where: { order_number: orderNumber } });
    if (!order) throw new Error(`Order ${orderNumber} not found in database!`);

    traceReport.orderId = order.id;
    traceReport.customerId = order.customer_id;
    console.log(`    ✅ Order ID: ${order.id}`);
    console.log(`    ✅ Customer ID: ${order.customer_id}`);
    console.log(`    ✅ Initial State: ${order.workflow_state} (verification_status: ${order.verification_status})`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: MESSAGE 1 (order_verification_interactive) OUTBOX & WORKER
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.msg1_outbox_checked = new Date().toISOString();
    const outbox1 = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `order_verification_${order.id}` },
    });
    if (!outbox1) throw new Error('Outbox record for order verification not found!');
    traceReport.outboxIds.order_verification = outbox1.id;

    // Send through worker in sandbox mode
    await whatsappOutboxQueue.processItem(outbox1);
    await outbox1.reload();
    traceReport.providerMessageIds.order_verification = outbox1.provider_message_id;
    traceReport.timestamps.msg1_sent = outbox1.accepted_at || outbox1.updated_at;
    console.log(`[2] Message 1 (order_verification_interactive):`);
    console.log(`    ✅ Outbox ID: ${outbox1.id}`);
    console.log(`    ✅ Status: ${outbox1.status}`);
    console.log(`    ✅ Provider Message ID: ${outbox1.provider_message_id}`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: CUSTOMER BUTTON (request_screenshot) & SCREENSHOT REQUEST MESSAGE
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.btn_screenshot_requested = new Date().toISOString();
    console.log(`[3] Customer clicks [Send Screenshot] via WhatsApp button reply...`);

    const screenshotBtnWebhook = {
      messaging_product: 'whatsapp',
      entry: [
        {
          id: 'WABA_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '1234567890', phone_number_id: '123456' },
                contacts: [{ wa_id: phone, profile: { name } }],
                messages: [
                  {
                    from: phone,
                    id: `wamid_trace_ss_req_${traceId}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: `request_screenshot:${order.id}`,
                        title: 'Send Screenshot',
                      },
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    await WhatsAppWebhookService.processWebhook(screenshotBtnWebhook);
    await order.reload();
    console.log(`    ✅ Order State: ${order.workflow_state} (verification_status: ${order.verification_status})`);

    const outboxScreenshot = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `screenshot_request_${order.id}` },
    });
    if (outboxScreenshot) {
      traceReport.outboxIds.screenshot_from_customer = outboxScreenshot.id;
      await whatsappOutboxQueue.processItem(outboxScreenshot);
      await outboxScreenshot.reload();
      traceReport.providerMessageIds.screenshot_from_customer = outboxScreenshot.provider_message_id;
      console.log(`    ✅ Outbox screenshot_from_customer: ${outboxScreenshot.id}, ProviderMsgId: ${outboxScreenshot.provider_message_id}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: CUSTOMER SENDS IMAGE → INGESTION & S3
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.image_upload_received = new Date().toISOString();
    console.log(`[4] Customer sends screenshot image via WhatsApp...`);

    const sampleImgBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const fakeBuffer = Buffer.from(sampleImgBase64, 'base64');

    // Simulate WhatsApp media pipeline ingestion
    const s3Key = `customer_images/${order.id}/media_trace_${traceId}.jpg`;
    const customerImage = await CustomerImage.create({
      id: uuidv4(),
      order_id: order.id,
      customer_id: order.customer_id,
      wa_message_id: `wamid_trace_img_${traceId}`,
      media_id: `media_id_${traceId}`,
      s3_key: s3Key,
      file_url: `https://krishna-crm-s3-private.s3.ap-south-1.amazonaws.com/${s3Key}`,
      mime_type: 'image/jpeg',
      file_size: fakeBuffer.length,
      image_type: 'tap_photo',
      status: 'RECEIVED',
      uploaded_at: new Date(),
    });
    traceReport.imageId = customerImage.id;
    console.log(`    ✅ Customer Image Created ID: ${customerImage.id}`);
    console.log(`    ✅ Image S3 Key: ${customerImage.s3_key}`);

    // Transition order to IMAGE_RECEIVED
    await OrderWorkflowService.transitionOrder({
      orderId: order.id,
      targetState: ORDER_WORKFLOW_STATES.IMAGE_RECEIVED,
      actor: 'customer_whatsapp',
      source: 'whatsapp_image_webhook',
      customerPhone: phone,
      note: 'Customer submitted tap photo screenshot.',
    });
    await order.reload();
    console.log(`    ✅ Order State: ${order.workflow_state} (verification_status: ${order.verification_status})`);

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: CRM IMAGE APPROVAL → PENDING_CUSTOMER_CONFIRMATION → MESSAGE 2
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.image_approved = new Date().toISOString();
    console.log(`[5] CRM Operator reviews & approves customer image...`);

    await customerImage.update({
      status: 'APPROVED',
      reviewed_by: testUser.id,
      reviewed_at: new Date(),
    });

    await OrderWorkflowService.transitionOrder({
      orderId: order.id,
      targetState: ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION,
      actor: 'crm_operator',
      source: 'crm_image_review',
      note: 'Operator approved customer screenshot. Dispatched order_confirmation013.',
      outboxMessage: {
        templateName: 'order_confirmation013',
        recipientPhone: phone,
        idempotencyKey: `order_confirmation013_${order.id}`,
        payload: {
          customer_name: order.customer_name,
          order_number: order.order_number,
        },
      },
    });

    const outboxMsg2 = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `order_confirmation013_${order.id}` },
    });
    if (outboxMsg2) {
      traceReport.outboxIds.order_confirmation013 = outboxMsg2.id;
      await whatsappOutboxQueue.processItem(outboxMsg2);
      await outboxMsg2.reload();
      traceReport.providerMessageIds.order_confirmation013 = outboxMsg2.provider_message_id;
      console.log(`    ✅ Outbox order_confirmation013: ${outboxMsg2.id}, ProviderMsgId: ${outboxMsg2.provider_message_id}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: CUSTOMER FINAL CONFIRMATION
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.customer_final_confirmed = new Date().toISOString();
    console.log(`[6] Customer clicks [Confirm Order] on Message 2...`);

    const finalConfirmWebhook = {
      messaging_product: 'whatsapp',
      entry: [
        {
          id: 'WABA_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '1234567890', phone_number_id: '123456' },
                contacts: [{ wa_id: phone, profile: { name } }],
                messages: [
                  {
                    from: phone,
                    id: `wamid_trace_final_conf_${traceId}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: `order_confirm_final:${order.id}`,
                        title: 'Confirm Order Final',
                      },
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    await WhatsAppWebhookService.processWebhook(finalConfirmWebhook);
    await order.reload();
    console.log(`    ✅ Order State: ${order.workflow_state} (verification_status: ${order.verification_status})`);

    const outboxConfirm = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `order_confirmation_${order.id}` },
    });
    if (outboxConfirm) {
      traceReport.outboxIds.order_confirmation = outboxConfirm.id;
      await whatsappOutboxQueue.processItem(outboxConfirm);
      await outboxConfirm.reload();
      traceReport.providerMessageIds.order_confirmation = outboxConfirm.provider_message_id;
      console.log(`    ✅ Outbox order_confirmation: ${outboxConfirm.id}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 7: SHIPPING DISPATCH & DISPATCH NOTIFICATION
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.shipping_dispatched = new Date().toISOString();
    console.log(`[7] Shipping tracking uploaded: Order DISPATCHED...`);

    await order.update({
      tracking_number: `TRK-TRACE-${traceId}`,
      shipping_partner: 'BlueDart Express',
      dispatched_at: new Date(),
    });

    await DeliveryEventOrchestrator.handleOrderDispatched(order, {
      actor: 'shipping_importer',
      source: 'shipping_file_upload',
    });

    const outboxDispatch = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `order_dispatched_${order.id}` },
    });
    if (outboxDispatch) {
      traceReport.outboxIds.order_dispatched = outboxDispatch.id;
      await whatsappOutboxQueue.processItem(outboxDispatch);
      await outboxDispatch.reload();
      traceReport.providerMessageIds.order_dispatched = outboxDispatch.provider_message_id;
      console.log(`    ✅ Outbox order_dispatched: ${outboxDispatch.id}, ProviderMsgId: ${outboxDispatch.provider_message_id}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 8: ORDER DELIVERED → INSTALLATION GUIDE & WARRANTY CREATION
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.order_delivered = new Date().toISOString();
    console.log(`[8] Shipping status updated: Order DELIVERED...`);

    await order.update({
      delivered_at: new Date(),
    });

    const delivRes = await DeliveryEventOrchestrator.handleOrderDelivered(order, {
      actor: 'shipping_webhook',
      source: 'courier_api',
    });

    const outboxDeliv = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `order_delivery_${order.id}` },
    });
    if (outboxDeliv) {
      traceReport.outboxIds.order_delivered = outboxDeliv.id;
      await whatsappOutboxQueue.processItem(outboxDeliv);
      await outboxDeliv.reload();
      traceReport.providerMessageIds.order_delivered = outboxDeliv.provider_message_id;
      console.log(`    ✅ Outbox order_deliverd: ${outboxDeliv.id}`);
    }

    const outboxInstall = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `installation_guide_${order.id}` },
    });
    if (outboxInstall) {
      traceReport.outboxIds.installation_guide = outboxInstall.id;
      await whatsappOutboxQueue.processItem(outboxInstall);
      await outboxInstall.reload();
      traceReport.providerMessageIds.installation_guide = outboxInstall.provider_message_id;
      console.log(`    ✅ Outbox installation_guide: ${outboxInstall.id}`);
    }

    const warranty = delivRes.warranty;
    if (!warranty) throw new Error('Warranty was not created upon delivery!');
    traceReport.warrantyId = warranty.id;
    console.log(`    ✅ Warranty Created ID: ${warranty.id} (Number: ${warranty.warranty_number})`);

    const outboxWarrantyClaim = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `warranty_claim_${warranty.id}` },
    });
    if (outboxWarrantyClaim) {
      traceReport.outboxIds.warranty_claim = outboxWarrantyClaim.id;
      await whatsappOutboxQueue.processItem(outboxWarrantyClaim);
      await outboxWarrantyClaim.reload();
      traceReport.providerMessageIds.warranty_claim = outboxWarrantyClaim.provider_message_id;
      console.log(`    ✅ Outbox warranty_claim: ${outboxWarrantyClaim.id}, ProviderMsgId: ${outboxWarrantyClaim.provider_message_id}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 9: WARRANTY ACTIVATION FORM SUBMISSION
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.warranty_activated = new Date().toISOString();
    console.log(`[9] Customer submits warranty activation form...`);

    const { generateActivationToken } = require('../services/warrantyTokenService');
    const token = generateActivationToken(warranty, 30);

    const activateRes = await DeliveryEventOrchestrator.activateWarranty({
      token,
      formData: {
        customer_name: name,
        installation_address: '42 Marine Drive, Mumbai',
        installation_date: new Date().toISOString().split('T')[0],
        serial_number: `SN-${traceId}`,
      },
      actor: 'customer_web_portal',
    });

    console.log(`    ✅ Warranty Status: ${activateRes.warranty.status}`);

    const outboxWarrantyActivated = await WhatsAppOutbox.findOne({
      where: { idempotency_key: `warranty_activated_${warranty.id}` },
    });
    if (outboxWarrantyActivated) {
      traceReport.outboxIds.warranty_activated = outboxWarrantyActivated.id;
      await whatsappOutboxQueue.processItem(outboxWarrantyActivated);
      await outboxWarrantyActivated.reload();
      traceReport.providerMessageIds.warranty_activated = outboxWarrantyActivated.provider_message_id;
      console.log(`    ✅ Outbox warranty_activated: ${outboxWarrantyActivated.id}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 10: TELECALLER INTERACTION (installation_need_help)
    // ──────────────────────────────────────────────────────────────────────────
    traceReport.timestamps.telecaller_requested = new Date().toISOString();
    console.log(`[10] Customer requests installation help (Telecaller trigger)...`);

    const needHelpWebhook = {
      messaging_product: 'whatsapp',
      entry: [
        {
          id: 'WABA_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '1234567890', phone_number_id: '123456' },
                contacts: [{ wa_id: phone, profile: { name } }],
                messages: [
                  {
                    from: phone,
                    id: `wamid_trace_need_help_${traceId}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: `installation_need_help:${order.id}`,
                        title: 'Need Help',
                      },
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    await WhatsAppWebhookService.processWebhook(needHelpWebhook);

    const followUp = await FollowUp.findOne({
      where: { order_id: order.id },
      order: [['created_at', 'DESC']],
    });
    if (followUp) {
      traceReport.telecallerId = followUp.id;
      console.log(`    ✅ Telecaller FollowUp Created ID: ${followUp.id}`);
      console.log(`    ✅ FollowUp Note: "${followUp.notes || followUp.note}"`);
    }

    console.log('\n======================================================================');
    console.log('🏁 COMPLETE FINAL LIVE TRACE RECORD (SECTION 65):');
    console.log('======================================================================');
    console.log(JSON.stringify(traceReport, null, 2));
    console.log('======================================================================\n');
  } catch (err) {
    console.error('❌ Trace failed:', err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

runFinalLiveTrace();
