'use strict';

require('dotenv').config();
const { Order, Customer } = require('../models');
const whatsappService = require('../services/whatsappService');

const run = async () => {
  const customer = await Customer.findOne({ where: { phone: '7768868525' } });
  const order = await Order.findOne({
    where: { customer_id: customer.id },
    order: [['created_at', 'DESC']],
    include: ['customer'],
  });

  console.log(`Testing requestNewImage with Order #${order.order_number}...`);
  const res = await whatsappService.sendOrderVerificationInteractive(order);
  console.log(`✅ Result:`, res);
  process.exit(0);
};

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
