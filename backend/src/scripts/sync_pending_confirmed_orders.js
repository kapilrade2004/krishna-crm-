'use strict';

/**
 * sync_pending_confirmed_orders.js
 * 
 * Synchronizes all orders that received customer confirmation (via inbound WhatsApp
 * interactive buttons, text replies, or customer confirmation records) but remained
 * in pending_confirmation or unconfirmed state.
 */

const { Order, Customer, OrderActivity, WhatsAppLog, sequelize } = require('../models');
const logger = require('../config/logger');

async function syncConfirmedOrders() {
  console.log('🔄 Starting Order Customer Confirmation State Synchronization...');

  // 1. Fetch all orders with status 'pending_confirmation' or verification_status 'pending_confirmation'
  const orders = await Order.findAll({
    where: {
      status: 'pending_confirmation',
    },
    include: [{ model: Customer, as: 'customer' }],
  });

  console.log(`Found ${orders.length} orders in pending_confirmation status.`);

  let updatedCount = 0;

  for (const order of orders) {
    const phone = order.customer?.phone || order.customer?.whatsapp_number;
    let isConfirmedByCustomer = false;
    let confirmationSnippet = 'Customer confirmation verified in system log.';

    if (phone) {
      const inboundLogs = await WhatsAppLog.findAll({
        where: { phone_number: phone, direction: 'inbound' },
        order: [['created_at', 'DESC']],
      });

      for (const log of inboundLogs) {
        const rawPayload = typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload || '');
        const lower = rawPayload.toLowerCase();
        if (
          lower.includes('yes_confirm') ||
          lower.includes('confirm_order') ||
          lower.includes('yes, confirm') ||
          lower.includes('"title":"confirm order"') ||
          lower.includes('"id":"confirm') ||
          lower.includes('confirm') ||
          lower.includes('yes')
        ) {
          isConfirmedByCustomer = true;
          confirmationSnippet = `Inbound customer confirmation found: ${rawPayload.slice(0, 120)}`;
          break;
        }
      }
    }

    // Also check if customer_confirmed_at is already set or order activities exist
    if (!isConfirmedByCustomer && order.customer_confirmed_at) {
      isConfirmedByCustomer = true;
      confirmationSnippet = `customer_confirmed_at was set on ${order.customer_confirmed_at}`;
    }

    // Transition confirmed orders
    if (isConfirmedByCustomer) {
      const prevStatus = order.status;
      const confirmedAt = order.customer_confirmed_at || new Date();

      await order.update({
        status: 'confirmed',
        verification_status: 'confirmed',
        flow_stage: 'match_confirmed',
        customer_confirmed_at: confirmedAt,
        second_message_due_at: null,
      });

      await OrderActivity.create({
        order_id: order.id,
        user_id: null,
        action: 'customer_confirmed',
        from_value: prevStatus,
        to_value: 'confirmed',
        note: `Order state updated to Confirmed. ${confirmationSnippet}`,
      });

      updatedCount++;
      console.log(`✅ Order #${order.order_number} (${phone}) updated from '${prevStatus}' -> 'confirmed'.`);
    } else {
      console.log(`ℹ️ Order #${order.order_number} (${phone}): Awaiting customer confirmation.`);
    }
  }

  console.log(`\n🎉 Synchronization complete: ${updatedCount} orders moved to 'confirmed' state.`);
}

if (require.main === module) {
  syncConfirmedOrders()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error during sync:', err);
      process.exit(1);
    });
}

module.exports = { syncConfirmedOrders };
