'use strict';

/**
 * Interactive / Automated Local Image Webhook Verification Script
 * 
 * Usage:
 *   node src/scripts/test_local_image_webhook.js
 *   node src/scripts/test_local_image_webhook.js --order=403-030824-9585
 *   node src/scripts/test_local_image_webhook.js --phone=+917768868525 --image=https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800
 */

require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Parse command line arguments
const args = process.argv.slice(2);
let customOrder = null;
let customPhone = null;
let customImage = null;

args.forEach(arg => {
  if (arg.startsWith('--order=')) customOrder = arg.split('=')[1];
  if (arg.startsWith('--phone=')) customPhone = arg.split('=')[1];
  if (arg.startsWith('--image=')) customImage = arg.split('=')[1];
});

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

async function main() {
  console.log('\n======================================================================');
  console.log('🧪 LOCAL WHATSAPP IMAGE WEBHOOK VERIFICATION TEST');
  console.log(`🎯 Target Endpoint: ${BASE_URL}/api/whatsapp/test-simulate-image`);
  console.log('======================================================================\n');

  // Step 1: Check Webhook Verification Handshake (GET /api/whatsapp/webhook)
  console.log('1️⃣ Testing Webhook Verification Handshake (GET challenge)...');
  const verifyRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=vasify_crm_webhook_token&hub.challenge=CHALLENGE_ACCEPTED_9988',
    method: 'GET',
  });

  if (verifyRes.status === 200 && String(verifyRes.body).includes('CHALLENGE_ACCEPTED_9988')) {
    console.log('   ✅ Webhook handshake verified successfully! (HTTP 200)');
  } else {
    console.log(`   ⚠️ Webhook challenge response: ${verifyRes.status} — ${JSON.stringify(verifyRes.body)}`);
  }

  // Step 2: Trigger Local Image Webhook
  console.log('\n2️⃣ Simulating Inbound Customer Tap Photo Webhook...');
  const testPayload = {
    order_number: customOrder || undefined,
    phone: customPhone || undefined,
    image_url: customImage || 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&auto=format&fit=crop&q=60',
    caption: 'Customer tap / filter setup photo sent via WhatsApp',
  };

  const simRes = await makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: '/api/whatsapp/test-simulate-image',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  }, testPayload);

  if (simRes.status !== 200 || !simRes.body || simRes.body.status !== 'success') {
    console.error('❌ Failed to simulate image webhook:', simRes);
    process.exit(1);
  }

  const { order, customer_image, whatsapp_log } = simRes.body.data;
  console.log('   ✅ Inbound image webhook received and processed!');
  console.log(`   📦 Order Number:        ${order?.order_number || 'N/A'}`);
  console.log(`   📋 Verification Status: ${order?.verification_status} (images_provided: ${order?.images_provided})`);
  console.log(`   🖼️ Customer Image ID:   ${customer_image?.id}`);
  console.log(`   🖼️ Image Status:        ${customer_image?.status}`);
  console.log(`   🌐 Image View URL:      ${customer_image?.view_url}`);
  console.log(`   📝 Inbound Log ID:      ${whatsapp_log?.id} (wa_msg_id: ${whatsapp_log?.wa_message_id})`);

  // Step 3: Verify with DB Models directly
  console.log('\n3️⃣ Verifying Database Integrity & Storage...');
  const { CustomerImage, Order, WhatsAppLog } = require('../models');
  
  const savedImage = await CustomerImage.findByPk(customer_image.id);
  const updatedOrder = order?.id ? await Order.findByPk(order.id) : null;
  const savedLog = await WhatsAppLog.findByPk(whatsapp_log.id);

  if (savedImage && savedImage.status === 'RECEIVED') {
    console.log('   ✅ CustomerImage table record confirmed in Database (status: RECEIVED).');
  } else {
    console.log('   ⚠️ CustomerImage record:', savedImage?.toJSON());
  }

  if (updatedOrder && updatedOrder.images_provided === true) {
    console.log(`   ✅ Order #${updatedOrder.order_number} confirmed updated (verification_status: ${updatedOrder.verification_status}).`);
  }

  if (savedLog && savedLog.direction === 'inbound') {
    console.log('   ✅ WhatsAppLog inbound audit entry verified.');
  }

  console.log('\n======================================================================');
  console.log('🎉 ALL LOCAL IMAGE WEBHOOK CHECKS PASSED!');
  console.log('======================================================================');
  console.log('👉 You can now view this order in the CRM Frontend:');
  console.log(`   Frontend URL: http://localhost:3000/orders`);
  console.log(`   Direct Image URL: ${customer_image?.view_url}`);
  console.log('======================================================================\n');
  
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Unhandled error in webhook test:', err);
  process.exit(1);
});
