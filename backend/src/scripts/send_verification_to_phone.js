'use strict';

require('dotenv').config();
const { sequelize, Customer, Order } = require('../models');
const whatsappService = require('../services/whatsappService');

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database.\n');

    const phone = '7768868525';
    const fullPhone = '+917768868525';

    // 1. Find or create customer
    let customer = await Customer.findOne({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { phone },
          { phone: fullPhone },
          { whatsapp_number: fullPhone },
          { whatsapp_number: phone },
        ],
      },
    });

    if (!customer) {
      customer = await Customer.create({
        name: 'Valued Customer',
        phone,
        whatsapp_number: fullPhone,
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        whatsapp_opt_in: true,
      });
      console.log(`👤 Created Customer: ${customer.name} (${customer.whatsapp_number})`);
    } else {
      console.log(`👤 Found Existing Customer: ${customer.name} (${customer.whatsapp_number})`);
    }

    // 2. Find or create order
    let order = await Order.findOne({
      where: { customer_id: customer.id },
      order: [['created_at', 'DESC']],
    });

    if (!order) {
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      order = await Order.create({
        order_number: orderNumber,
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
      console.log(`📦 Created Order: #${order.order_number}`);
    } else {
      console.log(`📦 Using Order: #${order.order_number}`);
    }

    // Reload with customer
    await order.reload({ include: [{ model: Customer, as: 'customer' }] });

    console.log(`\n📤 Sending verification message (order_confirmation01.0) to ${fullPhone}...`);
    const result = await whatsappService.sendProductVerificationTemplate(order);

    console.log('\n✅ Result:', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error sending verification message:', err);
    process.exit(1);
  }
};

run();
