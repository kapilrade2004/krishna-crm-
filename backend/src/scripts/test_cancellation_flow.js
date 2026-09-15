'use strict';

require('dotenv').config();
const { sequelize, Order, Customer, CustomerImage, OrderActivity, WhatsAppLog } = require('../models');
const whatsappService = require('../services/whatsappService');

const runTest = async () => {
  await sequelize.authenticate();

  const testPhoneFull = '+919930386406';
  const customer = await Customer.findOne({ where: { whatsapp_number: testPhoneFull } });

  const order = await Order.create({
    order_number: `TEST-CANCEL-${Date.now().toString().slice(-4)}`,
    customer_id: customer.id,
    product_name: 'AquaBeat Water Purifier Premier',
    product_sku: 'AKU-WTR-PREM-01',
    quantity: 1,
    unit_price: 2499,
    total_amount: 2499,
    status: 'pending_confirmation',
    verification_status: 'sku_matched',
    payment_status: 'cod',
    marketplace: 'website',
  });

  console.log(`Created order for cancel test: #${order.order_number}`);

  // Simulate customer clicking Cancel Order
  const mockButtonCancelPayload = {
    channel: 'whatsapp',
    messages: [
      {
        from: testPhoneFull,
        id: `wamid.TEST_CANCEL_BTN_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: {
            id: `cancel_order_${order.id}`,
            title: 'Cancel Order',
          },
        },
      },
    ],
  };

  await whatsappService.handleWebhook(mockButtonCancelPayload);

  await order.reload();
  console.log(`Order status after cancel click: status='${order.status}', verification_status='${order.verification_status}'`);

  const lastLog = await WhatsAppLog.findOne({
    where: { order_id: order.id, direction: 'outbound' },
    order: [['created_at', 'DESC']],
  });
  console.log(`Outbound template sent: ${lastLog?.template_name || 'N/A'}`);

  if (order.status === 'cancelled' && lastLog?.template_name === 'order_cancelled') {
    console.log('✅ Cancellation flow verified successfully!');
  } else {
    console.error('❌ Cancellation flow verification failed.');
  }

  process.exit(0);
};

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
