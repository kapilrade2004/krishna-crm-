'use strict';

require('dotenv').config();
const { connectDB, sequelize } = require('../config/database');
const { Order, OrderActivity, CustomerImage, FollowUp, WhatsAppLog, Customer, syncModels } = require('../models');
const logger = require('../config/logger');

const clearOrders = async () => {
  await connectDB();
  await syncModels({ force: false });

  logger.info('🧹 Clearing all orders and order-related records...');

  const count = await Order.count();

  // Delete dependent records
  await sequelize.query('DELETE FROM order_activities;');
  await sequelize.query('DELETE FROM customer_images;');
  await sequelize.query("DELETE FROM follow_ups WHERE order_id IS NOT NULL;");
  await sequelize.query("DELETE FROM whatsapp_logs WHERE order_id IS NOT NULL;");
  await sequelize.query('DELETE FROM orders;');

  // Reset customer order counters
  await Customer.update({ total_orders: 0, total_revenue: 0 }, { where: {} });

  logger.info(`✅ Successfully cleared ${count} order(s) and associated records.`);
  process.exit(0);
};

clearOrders().catch((err) => {
  logger.error('Clear orders script failed:', err);
  process.exit(1);
});
