'use strict';

require('dotenv').config();
const { Order, Customer, User } = require('../models');
const jwt = require('jsonwebtoken');

const run = async () => {
  const admin = await User.findOne({ where: { role: 'admin' } });
  const token = jwt.sign({ id: admin.id, role: admin.role, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const customer = await Customer.findOne({ where: { phone: '7768868525' } });
  const order = await Order.findOne({
    where: { customer_id: customer.id },
    order: [['created_at', 'DESC']],
  });

  console.log(`Testing POST /api/orders/${order.id}/request-new-image via HTTP...`);
  const res = await fetch(`http://localhost:5000/api/orders/${order.id}/request-new-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reason: 'Please share a clearer image of your product' }),
  });

  const data = await res.json();
  console.log(`HTTP Status: ${res.status}`);
  console.log('Response:', JSON.stringify(data, null, 2));
  process.exit(0);
};

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
