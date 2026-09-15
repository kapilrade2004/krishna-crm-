'use strict';

require('dotenv').config();
const { WhatsAppLog, WhatsAppOutbox, Order, Customer, sequelize } = require('../models');
const emergency = require('../services/emergencyPauseService');

(async () => {
  try {
    // 1. Check system settings
    let settings = [];
    try {
      const [res] = await sequelize.query("SELECT * FROM system_settings WHERE setting_key LIKE '%WHATSAPP%'");
      settings = res;
    } catch (e) {
      console.log('Query settings err:', e.message);
    }
    console.log('=== SYSTEM SETTINGS ===');
    console.log(JSON.stringify(settings, null, 2));

    // 2. Check emergency pause status
    try {
      const isEnabled = await emergency.isWhatsAppSendingEnabled();
      console.log('=== EMERGENCY PAUSE SERVICE ===');
      console.log('isWhatsAppSendingEnabled:', isEnabled);
    } catch (e) {
      console.log('Emergency pause check err:', e.message);
    }

    // 3. Last 15 WhatsApp logs
    const logs = await WhatsAppLog.findAll({
      order: [['created_at', 'DESC']],
      limit: 15,
    });
    console.log('=== LAST 15 WHATSAPP LOGS ===');
    console.log(JSON.stringify(logs.map(l => ({
      id: l.id,
      direction: l.direction,
      phone: l.phone_number,
      type: l.message_type,
      template: l.template_name,
      status: l.status,
      error: l.error_message,
      wa_id: l.wa_message_id,
      payload: l.payload,
      created_at: l.created_at,
      sent_at: l.sent_at,
      failed_at: l.failed_at
    })), null, 2));

    // 4. Check outbox
    const outboxCount = await WhatsAppOutbox.count();
    const pendingOutbox = await WhatsAppOutbox.findAll({
      where: { status: 'pending' },
      limit: 5,
    });
    console.log('=== OUTBOX ===');
    console.log('Total Outbox entries:', outboxCount);
    console.log('Pending Outbox entries:', JSON.stringify(pendingOutbox, null, 2));

  } catch (err) {
    console.error('Diagnostic error:', err);
  } finally {
    process.exit(0);
  }
})();
