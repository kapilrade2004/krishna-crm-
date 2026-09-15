'use strict';

const { Order, sequelize } = require('../models');
const logger = require('../config/logger');

const SKU_CATALOG = [
  { name: 'Aqua RO 2000 Premier Purifier', sku: 'AKUA-RO-2000' },
  { name: 'Non-Electric Water Purifier',   sku: 'AKUA-NE-1000' },
  { name: 'Water Purifier Body Cover',     sku: 'AKUA-COV-500' },
  { name: 'Food Grade Pipe (10m Roll)',    sku: 'AKUA-PIPE-FG10' },
  { name: 'Copper Mineral RO System',      sku: 'AKUA-COPPER-RO' },
  { name: 'Alkaline UV+UF Purifier',       sku: 'AKUA-ALK-UV' },
  { name: 'Complete Filter Sediment Kit',  sku: 'AKUA-FLT-KIT' },
  { name: '75 GPD RO Membrane Cartridge',  sku: 'AKUA-MEM-75G' },
  { name: 'Water Flow Meter Sensor',       sku: 'AKUA-FLOW-MTR' },
  { name: 'Heavy Duty Brass Tap Connector',sku: 'AKUA-TAP-BRS' },
];

async function seedProductSkus() {
  try {
    await sequelize.authenticate();
    logger.info('Connected to DB for product SKU seeding.');

    const orders = await Order.findAll();
    logger.info(`Found ${orders.length} order records.`);

    let updatedCount = 0;
    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i];
      let assignedSku = ord.product_sku;
      let productName = ord.product_name || 'Aqua RO 2000 Premier Purifier';

      if (!assignedSku || assignedSku === 'N/A' || assignedSku === '') {
        // Find matching SKU from catalog or assign round-robin from catalog based on index
        const catalogItem = SKU_CATALOG[i % SKU_CATALOG.length];
        assignedSku = catalogItem.sku;
        if (!ord.product_name) {
          productName = catalogItem.name;
        }
      }

      await ord.update({
        product_sku: assignedSku,
        product_name: productName,
      });
      updatedCount++;
    }

    logger.info(`✅ Successfully updated ${updatedCount} orders with product SKU IDs.`);
  } catch (err) {
    logger.error('Error seeding product SKUs:', err);
  }
}

if (require.main === module) {
  seedProductSkus().then(() => process.exit(0));
}

module.exports = seedProductSkus;
