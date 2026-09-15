'use strict';

require('dotenv').config();
const { Order, Customer } = require('../models');
const whatsappService = require('../services/whatsappService');

const run = async () => {
  const phone = '+917768868525';
  
  // Simulate the inbound WhatsApp webhook payload for image upload
  const mockImagePayload = {
    channel: 'whatsapp',
    messages: [
      {
        from: phone,
        id: `wamid.AOC_IMG_${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000).toString(),
        type: 'image',
        image: {
          id: `media_test_${Date.now()}`,
          mime_type: 'image/jpeg',
          url: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&auto=format&fit=crop&q=60',
          caption: 'Product screenshot from customer',
        },
      },
    ],
  };

  console.log(`Processing inbound WhatsApp image webhook from ${phone}...`);
  await whatsappService.handleWebhook(mockImagePayload);

  const customer = await Customer.findOne({ where: { phone: '7768868525' } });
  const order = await Order.findOne({
    where: { customer_id: customer.id },
    order: [['created_at', 'DESC']],
    include: ['customerImages'],
  });

  console.log(`✅ Order #${order.order_number} Status: ${order.status}`);
  console.log(`✅ Verification Status: ${order.verification_status}`);
  console.log(`📷 Attached Images Count: ${order.customerImages?.length || 0}`);
  if (order.customerImages?.length) {
    console.log(`🖼️ Latest Image URL: ${order.customerImages[0].file_url}`);
  }

  process.exit(0);
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
