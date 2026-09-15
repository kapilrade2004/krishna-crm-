'use strict';

const { Op } = require('sequelize');
const { FollowUp, Customer } = require('../models');
const whatsappService = require('./whatsappService');
const logger = require('../config/logger');

const INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const LOOKAHEAD_MS = 60 * 60 * 1000; // remind 60 min before due

let timer = null;

const runJob = async () => {
  // Check Global WhatsApp Sending Kill Switch before scanning follow-ups
  const { isWhatsAppSendingEnabled } = require('./emergencyPauseService');
  if (!(await isWhatsAppSendingEnabled())) {
    logger.debug('Reminder job: Global WhatsApp sending is paused. Skipping tick.');
    return;
  }

  const now = new Date();
  const lookahead = new Date(now.getTime() + LOOKAHEAD_MS);

  try {
    const pending = await FollowUp.findAll({
      where: {
        status: { [Op.in]: ['pending', 'in_progress'] },
        due_at: { [Op.between]: [now, lookahead] },
        reminder_sent: false,
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'whatsapp_number', 'whatsapp_opt_in'],
        },
      ],
      limit: 50, // safety cap per run
    });

    if (pending.length === 0) return;

    logger.info(`Reminder job: ${pending.length} follow-up(s) due within 60 min.`);

    for (const fu of pending) {
      try {
        // Send automated WhatsApp reminder to customer
        const phone = fu.customer?.whatsapp_number || fu.customer?.phone;
        if (phone) {
          await whatsappService.sendFollowUp({
            phone,
            customerName: fu.customer.name,
            subject: fu.subject,
            orderId: fu.order_id,
            customerId: fu.customer_id,
          });
        }

        await fu.update({ reminder_sent: true });
        logger.debug(`Reminder sent for follow-up ${fu.id} (${fu.subject})`);
      } catch (err) {
        // Log per-item failures without stopping the batch
        logger.warn(`Reminder failed for follow-up ${fu.id}: ${err.message}`);
      }
    }
  } catch (err) {
    logger.error('Follow-up reminder job error:', err);
  }
};

const start = () => {
  if (timer) return; // already running
  logger.info('Follow-up reminder job started (interval: 30 min).');
  // Run once immediately on startup, then on interval
  runJob();
  timer = setInterval(runJob, INTERVAL_MS);
};

const stop = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Follow-up reminder job stopped.');
  }
};

module.exports = { start, stop, runJob };
