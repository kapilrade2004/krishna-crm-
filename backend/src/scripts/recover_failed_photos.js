'use strict';

require('dotenv').config();
const { Customer, Order, CustomerImage, OrderActivity, sequelize } = require('../models');
const { downloadAndSaveMedia } = require('../services/whatsappService');
const logger = require('../config/logger');

const failedPhotos = [
  {
    phone: '919160743347',
    name: 'H~~',
    url: 'https://omni-whtaspp-media.s3.ap-south-1.amazonaws.com/935795409610516/whatsapp/WA_647140041819452_1788705632319',
    timestamp: new Date(1788705632829),
  },
  {
    phone: '917768868525',
    name: 'Mohish Narkhede',
    url: 'https://omni-whtaspp-media.s3.ap-south-1.amazonaws.com/935795409610516/whatsapp/WA_647140041819452_1788711038990',
    timestamp: new Date(1788711039038),
  },
  {
    phone: '917768868525',
    name: 'Mohish Narkhede',
    url: 'https://omni-whtaspp-media.s3.ap-south-1.amazonaws.com/935795409610516/whatsapp/WA_647140041819452_1788711063483',
    timestamp: new Date(1788711063548),
  },
  {
    phone: '919492105566',
    name: 'Junnuri Bobby',
    url: 'https://omni-whtaspp-media.s3.ap-south-1.amazonaws.com/935795409610516/whatsapp/WA_647140041819452_1788711179595',
    timestamp: new Date(1788711180013),
  },
  {
    phone: '919492105566',
    name: 'Junnuri Bobby',
    url: 'https://omni-whtaspp-media.s3.ap-south-1.amazonaws.com/935795409610516/whatsapp/WA_647140041819452_1788711192727',
    timestamp: new Date(1788711192956),
  },
];

async function recover() {
  console.log('🔄 Connecting to database and recovering failed customer images...');
  await sequelize.authenticate();

  for (const item of failedPhotos) {
    const clean = item.phone.replace(/\D/g, '');
    const last10 = clean.slice(-10);
    const variants = [clean, `+${clean}`, last10, `+91${last10}`, `91${last10}`];

    // Find customer & order
    const { Op } = require('sequelize');
    const customer = await Customer.findOne({
      where: {
        [Op.or]: [
          { whatsapp_number: { [Op.in]: variants } },
          { phone: { [Op.in]: variants } },
        ],
      },
    });

    let order = null;
    if (customer) {
      order = await Order.findOne({
        where: { customer_id: customer.id },
        order: [['created_at', 'DESC']],
      });
    }

    console.log(`Processing image for ${item.name} (${item.phone}). Customer found: ${!!customer}, Order found: ${order?.order_number || 'None'}`);

    try {
      const { s3Key, fileUrl, mimeType, fileSize } = await downloadAndSaveMedia({ url: item.url });

      const img = await CustomerImage.create({
        order_id: order?.id || null,
        customer_id: customer?.id || null,
        s3_key: s3Key || null,
        file_url: fileUrl || item.url,
        mime_type: mimeType || 'image/jpeg',
        file_size: fileSize || null,
        image_type: 'tap_photo',
        status: 'received',
        uploaded_at: item.timestamp,
      });

      if (order) {
        await order.update({
          status: order.status === 'confirmed' ? order.status : 'image_verification',
          verification_status: 'image_received',
          images_provided: true,
          screenshot_received_at: item.timestamp,
          flow_stage: 'match_pending',
        });

        await OrderActivity.create({
          order_id: order.id,
          action: 'customer_image_received',
          from_value: 'pending_verification',
          to_value: 'image_received',
          note: 'Customer sent product screenshot/tap photo via WhatsApp (Recovered from webhook log).',
          metadata: { customer_image_id: img.id, file_url: fileUrl },
        });
      }

      console.log(`✅ Successfully saved image for ${item.name}! ID: ${img.id}`);
    } catch (e) {
      console.error(`❌ Failed to download/save image for ${item.name}:`, e.message);
    }
  }

  console.log('🎉 Image recovery complete!');
  process.exit(0);
}

if (require.main === module) {
  recover().catch((err) => {
    console.error('Fatal recovery error:', err);
    process.exit(1);
  });
}

module.exports = { recover };
