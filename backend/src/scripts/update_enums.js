'use strict';

require('dotenv').config();
const { sequelize } = require('../config/database');

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.query("ALTER TABLE whatsapp_logs MODIFY COLUMN message_type VARCHAR(50) DEFAULT 'template'");
    await sequelize.query("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'image_verification', 'pending_confirmation', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled', 'returned', 'refunded') NOT NULL DEFAULT 'pending'");
    console.log('✅ MySQL tables updated successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error updating tables:', err);
    process.exit(1);
  }
})();
