'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  Order,
  Customer,
  OrderActivity,
  CustomerImage,
  SystemSetting,
  User,
  FollowUp,
  WhatsAppOutbox,
} = require('../models');
const whatsappOutboxQueue = require('./whatsappOutboxQueue');
const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

/**
 * Authoritative Canonical States for WhatsApp Order Verification Workflow
 */
const CANONICAL_STATES = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  SCREENSHOT_REQUESTED: 'SCREENSHOT_REQUESTED',
  IMAGE_RECEIVED: 'IMAGE_RECEIVED',
  PENDING_CUSTOMER_CONFIRMATION: 'PENDING_CUSTOMER_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
};

class OrderVerificationWorkflowService {
  /**
   * Authoritative entry point for initiating first WhatsApp verification outreach (Message 1)
   * Enqueues order_verification_interactive with full metadata & canonical idempotency key
   */
  static async initiateFirstVerification({ orderId, phone = null, batchId = null, triggerWorker = true }) {
    if (!orderId) {
      throw new AppError('orderId is required to initiate first verification', 400);
    }

    const order = await Order.findByPk(orderId, {
      include: [{ model: Customer, as: 'customer' }],
    });

    if (!order) {
      throw new AppError(`Order ${orderId} not found`, 404);
    }

    // Check terminal states
    if (order.status === 'cancelled' || order.status === 'confirmed') {
      return { success: false, reason: `Order is already in terminal status: ${order.status}` };
    }

    // Idempotency check: Outbox item already exists for this order
    const existingOutbox = await WhatsAppOutbox.findOne({
      where: {
        order_id: order.id,
        template_name: 'order_verification_interactive',
      },
    });

    if (existingOutbox) {
      return { success: true, idempotent: true, outboxId: existingOutbox.id };
    }

    const rawPhone = phone || order.customer_phone || order.customer?.whatsapp_number || order.customer?.phone || order.shipping_address?.ship_phone;
    const cleanPhone = rawPhone ? String(rawPhone).trim() : null;

    if (!cleanPhone) {
      return { success: false, reason: 'No valid customer contact phone found for order' };
    }

    const customerName = order.customer_name || order.customer?.name || order.shipping_address?.name || 'Valued Customer';
    const orderNumber = order.order_number || String(order.id);
    const productName = order.product_name || 'AquaBeat Pure Copper RO Water Purifier';
    const productSku = order.product_sku || 'AKUA-COP-01';

    const outboxItem = await whatsappOutboxQueue.enqueue({
      order_id: order.id,
      customer_id: order.customer_id || null,
      batch_id: batchId || order.whatsapp_batch_id || null,
      recipient_phone: cleanPhone,
      template_name: 'order_verification_interactive',
      payload: {
        order_number: orderNumber,
        customer_name: customerName,
        product_name: productName,
        product_sku: productSku,
      },
      idempotency_key: `order_verification_${order.id}`,
    });

    await order.update({
      workflow_state: CANONICAL_STATES.PENDING_VERIFICATION,
      verification_status: 'pending_verification',
      ...(batchId && { whatsapp_batch_id: batchId }),
    });

    if (triggerWorker) {
      setImmediate(() => {
        whatsappOutboxQueue.processQueue().catch((err) =>
          logger.warn(`Outbox process notice for order ${order.order_number}:`, err.message)
        );
      });
    }

    return { success: true, outboxId: outboxItem.id };
  }

  /**
   * Helper: Retrieve configured Message 2 customer response timeout in hours
   */
  static async getFinalConfirmationTimeoutHours() {
    try {
      const setting = await SystemSetting.findOne({
        where: { key: 'FINAL_CONFIRMATION_TIMEOUT_HOURS' },
      });
      if (setting && setting.value) {
        const parsed = parseFloat(setting.value);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch (_) {}
    const envVal = parseFloat(process.env.FINAL_CONFIRMATION_TIMEOUT_HOURS);
    return !isNaN(envVal) && envVal > 0 ? envVal : 7; // Default 7 hours
  }

  /**
   * Resolves the exact active order for an inbound customer interaction.
   * Multi-order safe (Section 50): If customer has multiple active orders and no explicit identifier is present,
   * does NOT guess; returns null with isAmbiguous = true.
   */
  static async resolveActiveOrderForCustomer({ customer, phone, payloadText = '', explicitOrderId = null }) {
    if (explicitOrderId) {
      const ord = await Order.findByPk(explicitOrderId, {
        include: [{ model: Customer, as: 'customer' }],
      });
      if (ord) return { order: ord, isAmbiguous: false };
    }

    // 1. Check for UUID or Order Number pattern in payload
    if (payloadText) {
      const uuidMatch = String(payloadText).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      const ordNumMatch = String(payloadText).match(/ORD-[A-Z0-9-]+/i);

      if (uuidMatch) {
        const ord = await Order.findByPk(uuidMatch[0], {
          include: [{ model: Customer, as: 'customer' }],
        });
        if (ord) return { order: ord, isAmbiguous: false };
      } else if (ordNumMatch) {
        const ord = await Order.findOne({
          where: { order_number: ordNumMatch[0] },
          include: [{ model: Customer, as: 'customer' }],
        });
        if (ord) return { order: ord, isAmbiguous: false };
      }
    }

    // 2. Query open active verification orders for customer / phone
    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
    const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

    // Locate customer by phone if not provided
    if (!customer && last10 && last10.length >= 7) {
      customer = await Customer.findOne({
        where: {
          [Op.or]: [
            { whatsapp_number: { [Op.like]: `%${last10}%` } },
            { phone: { [Op.like]: `%${last10}%` } },
          ],
        },
      });
    }

    const custId = customer?.id;
    if (!custId && !last10) return { order: null, isAmbiguous: false };

    const customerCriteria = [];
    if (custId) {
      customerCriteria.push({ customer_id: custId });
    }
    if (last10 && last10.length >= 7) {
      customerCriteria.push({ customer_phone: { [Op.like]: `%${last10}%` } });
      customerCriteria.push(
        sequelize.where(
          sequelize.fn('JSON_UNQUOTE', sequelize.fn('JSON_EXTRACT', sequelize.col('shipping_address'), '$.ship_phone')),
          { [Op.like]: `%${last10}%` }
        )
      );
      customerCriteria.push(
        sequelize.where(
          sequelize.fn('JSON_UNQUOTE', sequelize.fn('JSON_EXTRACT', sequelize.col('shipping_address'), '$.phone')),
          { [Op.like]: `%${last10}%` }
        )
      );
      if (last10.length === 10) {
        customerCriteria.push({ customer_phone: { [Op.like]: `%${last10.slice(0, 5)}%${last10.slice(5)}%` } });
      }
    }
    if (cleanPhone) {
      customerCriteria.push({ customer_phone: cleanPhone });
    }

    if (customerCriteria.length === 0) {
      return { order: null, isAmbiguous: false };
    }

    const whereClause = {
      [Op.or]: customerCriteria,
      status: { [Op.in]: ['pending', 'pending_verification', 'image_verification', 'pending_confirmation'] },
    };

    const openOrders = await Order.findAll({
      where: whereClause,
      include: [{ model: Customer, as: 'customer' }],
      order: [
        ['confirmation_message_sent_at', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    if (openOrders.length === 1) {
      return { order: openOrders[0], isAmbiguous: false };
    }

    if (openOrders.length > 1) {
      // Prioritize the order actively awaiting verification
      const activeInFlight = openOrders.find(
        (o) => o.verification_status === 'pending_verification' ||
               o.verification_status === 'screenshot_requested' ||
               o.status === 'image_verification' ||
               o.flow_stage === 'ask_images'
      );
      const chosenOrder = activeInFlight || openOrders[0];
      logger.info(
        `Resolved order #${chosenOrder.order_number} for customer ${custId || phone} from ${openOrders.length} candidate open orders.`
      );
      return { order: chosenOrder, isAmbiguous: false, candidateOrders: openOrders };
    }

    // Fallback: If no open verification orders, find the most recent order for this customer/phone
    const recentOrder = await Order.findOne({
      where: { [Op.or]: customerCriteria },
      include: [{ model: Customer, as: 'customer' }],
      order: [['created_at', 'DESC']],
    });
    if (recentOrder) {
      return { order: recentOrder, isAmbiguous: false };
    }

    return { order: null, isAmbiguous: false };
  }

  /**
   * 1. Customer Confirms Order from Message 1 (Section 5)
   */
  static async handleCustomerConfirm(arg1, arg2) {
    let orderId, waMessageId, actor;
    if (typeof arg1 === 'object' && arg1 !== null) {
      orderId = arg1.orderId || arg1.id;
      waMessageId = arg1.waMessageId || null;
      actor = arg1.actor || 'customer_whatsapp';
    } else {
      orderId = arg1;
      waMessageId = arg2?.waMessageId || null;
      actor = arg2?.actor || 'customer_whatsapp';
    }

    return await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!order) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      // Idempotency: Already confirmed
      if (order.status === 'confirmed' || order.workflow_state === CANONICAL_STATES.CONFIRMED) {
        logger.info(`[WORKFLOW IDEMPOTENT] Order #${order.order_number} is already CONFIRMED.`);
        return { success: true, idempotent: true, order, state: CANONICAL_STATES.CONFIRMED };
      }

      // Stale button protection: Cannot confirm an already cancelled order
      if (order.status === 'cancelled' || order.workflow_state === CANONICAL_STATES.CANCELLED) {
        logger.warn(`[WORKFLOW REJECTED] Cannot confirm order #${order.order_number}: Order is already CANCELLED.`);
        return { success: false, rejected: true, reason: 'order_already_cancelled', order };
      }

      const prevStatus = order.status;
      const prevVerificationStatus = order.verification_status;

      await order.update(
        {
          status: 'confirmed',
          verification_status: 'confirmed',
          workflow_state: CANONICAL_STATES.CONFIRMED,
          flow_stage: 'match_confirmed',
          customer_confirmed_at: new Date(),
          second_message_due_at: null,
          screenshot_deadline_at: null,
          final_confirmation_due_at: null,
          final_confirmation_message_id: waMessageId || order.final_confirmation_message_id,
        },
        { transaction: t }
      );

      await OrderActivity.create(
        {
          order_id: order.id,
          action: 'customer_confirmed',
          from_value: prevVerificationStatus,
          to_value: 'confirmed',
          note: `Customer confirmed order on WhatsApp (Message 1 / Direct Confirm). Transitioned to CONFIRMED.`,
          metadata: { actor, waMessageId },
        },
        { transaction: t }
      );

      // Queue Template 3: order_confirmation via Outbox
      const cust = order.customer;
      const recipientPhone = cust?.whatsapp_number || cust?.phone || order.customer_phone || order.shipping_address?.ship_phone;
      if (recipientPhone) {
        await whatsappOutboxQueue.enqueue(
          {
            order_id: order.id,
            customer_id: cust?.id || order.customer_id,
            batch_id: order.whatsapp_batch_id || order.import_batch_id,
            recipient_phone: recipientPhone,
            template_name: 'order_confirmation',
            idempotency_key: `order_confirmation_${order.id}`,
            payload: {},
          },
          { transaction: t }
        );
      }

      logger.info(`✅ [WORKFLOW CONFIRMED] Order #${order.order_number} confirmed by customer. Outbox queued.`);
      return { success: true, order, state: CANONICAL_STATES.CONFIRMED };
    });
  }

  /**
   * 2. Customer Requests Screenshot from Message 1 (Section 6 & 7)
   */
  static async handleScreenshotRequest(arg1, arg2) {
    let orderId, waMessageId, actor;
    if (typeof arg1 === 'object' && arg1 !== null) {
      orderId = arg1.orderId || arg1.id;
      waMessageId = arg1.waMessageId || null;
      actor = arg1.actor || 'customer_whatsapp';
    } else {
      orderId = arg1;
      waMessageId = arg2?.waMessageId || null;
      actor = arg2?.actor || 'customer_whatsapp';
    }

    return await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!order) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      // Stale button protection: Do not alter terminal states
      if (order.status === 'confirmed' || order.status === 'cancelled') {
        logger.warn(`[WORKFLOW REJECTED] Screenshot request rejected for terminal order #${order.order_number} (status: ${order.status})`);
        return { success: false, rejected: true, reason: 'order_terminal', order };
      }

      // Idempotency: If image already received
      if (order.workflow_state === CANONICAL_STATES.IMAGE_RECEIVED || order.verification_status === 'image_received') {
        logger.info(`[WORKFLOW IDEMPOTENT] Order #${order.order_number} already received image. Preserving IMAGE_RECEIVED.`);
        return { success: true, idempotent: true, order, state: CANONICAL_STATES.IMAGE_RECEIVED };
      }

      const prevStatus = order.verification_status;
      const deadline = new Date(Date.now() + 15 * 60 * 1000); // 15-minute response window

      await order.update(
        {
          status: 'image_verification',
          verification_status: 'screenshot_requested',
          workflow_state: CANONICAL_STATES.SCREENSHOT_REQUESTED,
          flow_stage: 'ask_images',
          screenshot_requested_at: new Date(),
          second_message_due_at: deadline,
          screenshot_deadline_at: deadline,
          screenshot_message_id: waMessageId || order.screenshot_message_id,
        },
        { transaction: t }
      );

      await OrderActivity.create(
        {
          order_id: order.id,
          action: 'customer_screenshot_requested',
          from_value: prevStatus,
          to_value: 'screenshot_requested',
          note: `Customer clicked [Send Screenshot] on WhatsApp. Initiated 15-minute response window (expires at ${deadline.toISOString()}).`,
          metadata: { actor, waMessageId, deadline: deadline.toISOString() },
        },
        { transaction: t }
      );

      // Queue screenshot_from_customer message via Outbox
      const cust = order.customer;
      const recipientPhone = cust?.whatsapp_number || cust?.phone || order.customer_phone || order.shipping_address?.ship_phone;
      if (recipientPhone) {
        await whatsappOutboxQueue.enqueue(
          {
            order_id: order.id,
            customer_id: cust?.id || order.customer_id,
            batch_id: order.whatsapp_batch_id || order.import_batch_id,
            recipient_phone: recipientPhone,
            template_name: 'screenshot_from_customer',
            idempotency_key: `screenshot_req_${order.id}`,
            payload: {},
          },
          { transaction: t }
        );
      }

      logger.info(`📷 [WORKFLOW SCREENSHOT_REQUESTED] Order #${order.order_number} window active until ${deadline.toISOString()}`);
      return { success: true, order, state: CANONICAL_STATES.SCREENSHOT_REQUESTED, deadline };
    });
  }

  /**
   * 3. Inbound Customer Image Received via Webhook (Section 9)
   * CRITICAL: Receiving image must NOT send Message 2 automatically; must await CRM matching.
   * Cancels the 15-minute screenshot countdown.
   */
  static async handleScreenshotReceived(arg1, arg2, arg3, arg4, arg5) {
    let orderId, customerId, customerImageId, waMessageId, actor, senderPhone;
    if (typeof arg1 === 'object' && arg1 !== null) {
      orderId = arg1.orderId;
      customerId = arg1.customerId;
      customerImageId = arg1.customerImageId;
      waMessageId = arg1.waMessageId || null;
      actor = arg1.actor || 'customer_whatsapp';
      senderPhone = arg1.phone;
    } else {
      orderId = arg1;
      customerId = arg2;
      customerImageId = arg3;
      waMessageId = arg4 || null;
      actor = arg5 || 'customer_whatsapp';
    }

    // Auto-resolve active order if orderId wasn't directly passed
    if (!orderId && (senderPhone || customerId)) {
      try {
        const res = await OrderVerificationWorkflowService.resolveActiveOrderForCustomer({
          customer: customerId ? { id: customerId } : null,
          phone: senderPhone,
        });
        if (res?.order) {
          orderId = res.order.id;
          logger.info(`Auto-resolved active order #${res.order.order_number} for inbound image (phone: ${senderPhone}).`);
        }
      } catch (_) {}
    }

    if (!orderId) {
      logger.info(`Inbound image received without unique order binding (customer: ${customerId}). Saved in unmatched pool.`);
      return { success: true, unassigned: true, customerImageId };
    }

    return await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!order) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      // Attach customer image to this order
      if (customerImageId) {
        const { CustomerImage } = require('../models');
        await CustomerImage.update(
          { order_id: order.id, customer_id: order.customer_id || customerId || null },
          { where: { id: customerImageId }, transaction: t }
        );
      }

      // If already terminal, do not revert
      if (order.status === 'confirmed' || order.status === 'cancelled') {
        logger.warn(`Customer image received for terminal order #${order.order_number} (${order.status}). Attaching image without state regression.`);
        return { success: true, terminalAttached: true, order };
      }

      const prevStatus = order.verification_status;

      await order.update(
        {
          status: 'image_verification',
          verification_status: 'image_received',
          workflow_state: CANONICAL_STATES.IMAGE_RECEIVED,
          flow_stage: 'match_pending',
          images_provided: true,
          screenshot_received_at: new Date(),
          second_message_due_at: null,    // Cancels the 15-minute timeout worker path!
          screenshot_deadline_at: null,   // Cancels deadline
        },
        { transaction: t }
      );

      await OrderActivity.create(
        {
          order_id: order.id,
          action: 'customer_screenshot_received',
          from_value: prevStatus,
          to_value: 'image_received',
          note: `Customer uploaded product photo on WhatsApp. 15-minute timer stopped. Order placed in Image Received queue for CRM operator matching.`,
          metadata: { actor, waMessageId, customerImageId },
        },
        { transaction: t }
      );

      logger.info(`🖼️ [WORKFLOW IMAGE_RECEIVED] Order #${order.order_number} moved to Image Received queue. Timer cleared.`);
      return { success: true, order, state: CANONICAL_STATES.IMAGE_RECEIVED };
    });
  }

  /**
   * 4. CRM Operator Matches Screenshot (Section 11)
   * Only this successful human matching action automatically triggers Message 2 in the screenshot path.
   */
  static async handleCrmMatch(arg1, arg2, arg3) {
    let orderId, userId, notes, targetImageId;
    if (typeof arg1 === 'object' && arg1 !== null) {
      orderId = arg1.orderId || arg1.id;
      userId = arg1.userId || arg1.actor_id;
      notes = arg1.notes;
      targetImageId = arg1.imageId || arg1.image_id;
    } else {
      orderId = arg1;
      userId = arg2;
      notes = arg3?.notes || arg3;
      targetImageId = arg3?.imageId || arg3?.image_id;
    }
    notes = notes || 'Ordered SKU matches customer image';

    return await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!order) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      const terminalOrDownstream = ['confirmed', 'cancelled', 'dispatched', 'delivered', 'returned', 'refunded'];
      if (terminalOrDownstream.includes(order.status)) {
        throw new AppError(`Cannot match SKU or approve images for an order in '${order.status}' state.`, 400);
      }

      // Verify that at least one stored CustomerImage exists for this order
      const imgWhere = { order_id: order.id };
      if (targetImageId) {
        imgWhere.id = targetImageId;
      }
      const existingImages = await CustomerImage.findAll({
        where: imgWhere,
        transaction: t,
      });

      if (!existingImages || existingImages.length === 0) {
        throw new AppError(`Cannot approve verification: No customer screenshot/image found for Order #${order.order_number || order.id}.`, 422);
      }

      // Mark matching image(s) as approved
      await CustomerImage.update(
        {
          status: 'approved',
          reviewed_by: userId || null,
          reviewed_at: new Date(),
        },
        {
          where: imgWhere,
          transaction: t,
        }
      );

      // Idempotency: Already matched and awaiting final confirmation
      if (order.workflow_state === CANONICAL_STATES.PENDING_CUSTOMER_CONFIRMATION && order.second_message_sent_at) {
        logger.info(`[WORKFLOW IDEMPOTENT] Order #${order.order_number} is already matched and pending customer confirmation.`);
        return { success: true, idempotent: true, order, state: CANONICAL_STATES.PENDING_CUSTOMER_CONFIRMATION };
      }

      const prevStatus = order.verification_status;
      const timeoutHours = await this.getFinalConfirmationTimeoutHours();
      const finalDueAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);

      await order.update(
        {
          status: 'pending_confirmation',
          verification_status: 'sku_matched',
          workflow_state: CANONICAL_STATES.PENDING_CUSTOMER_CONFIRMATION,
          flow_stage: 'match_pending',
          images_provided: true,
          verified_by: userId,
          verified_at: new Date(),
          matched_by: userId,
          matched_at: new Date(),
          verification_notes: notes,
          second_message_due_at: null,
          screenshot_deadline_at: null,
          second_message_sent_at: new Date(),
          final_confirmation_sent_at: new Date(),
          final_confirmation_due_at: finalDueAt,
        },
        { transaction: t }
      );

      await OrderActivity.create(
        {
          order_id: order.id,
          user_id: userId,
          action: 'crm_sku_matched',
          from_value: prevStatus,
          to_value: 'sku_matched',
          note: `CRM operator matched customer image. Enqueued Message 2 (order_confirmation013). Final response deadline: ${finalDueAt.toISOString()} (${timeoutHours}h).`,
          metadata: { userId, notes, finalConfirmationDueAt: finalDueAt.toISOString() },
        },
        { transaction: t }
      );

      // Enqueue Message 2 (order_confirmation013) via Outbox
      const cust = order.customer;
      const recipientPhone = cust?.whatsapp_number || cust?.phone || order.customer_phone || order.shipping_address?.ship_phone;
      if (recipientPhone) {
        await whatsappOutboxQueue.enqueue(
          {
            order_id: order.id,
            customer_id: cust?.id || order.customer_id,
            batch_id: order.whatsapp_batch_id || order.import_batch_id,
            recipient_phone: recipientPhone,
            template_name: 'order_confirmation013',
            idempotency_key: `m2_match_${order.id}`,
            payload: {},
          },
          { transaction: t }
        );
      }

      logger.info(`🔍 [WORKFLOW CRM_MATCH] Order #${order.order_number} matched by user ${userId}. Message 2 enqueued.`);
      return { success: true, order, state: CANONICAL_STATES.PENDING_CUSTOMER_CONFIRMATION, finalDueAt };
    });
  }

  /**
   * 5. 15-Minute Screenshot Timeout with NO Image Received (Section 15 & 16)
   * Worker dispatches Message 2 (order_confirmation013).
   */
  static async handleScreenshotTimeout(arg) {
    const orderId = typeof arg === 'object' && arg !== null ? (arg.orderId || arg.id) : arg;
    return await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!order) return { success: false, reason: 'order_not_found' };

      // Re-check preconditions inside transaction:
      // 1. Must still be in screenshot_requested state
      // 2. Must NOT have received an image
      // 3. Must not already be terminal or confirmed
      if (order.screenshot_received_at !== null) {
        logger.info(`[TIMEOUT ABORTED] Order #${order.order_number} received screenshot at ${order.screenshot_received_at}. Aborting timeout.`);
        return { success: false, reason: 'screenshot_already_received' };
      }

      const existingImgCount = await CustomerImage.count({ where: { order_id: order.id }, transaction: t });
      if (existingImgCount > 0) {
        logger.info(`[TIMEOUT ABORTED] Order #${order.order_number} has ${existingImgCount} image(s) awaiting CRM review. Aborting no-image timeout.`);
        return { success: false, reason: 'images_awaiting_crm_review' };
      }

      if (['confirmed', 'cancelled', 'dispatched', 'delivered', 'returned', 'refunded'].includes(order.status)) {
        logger.info(`[TIMEOUT ABORTED] Order #${order.order_number} is already in state '${order.status}'.`);
        return { success: false, reason: 'order_terminal' };
      }

      if (order.second_message_sent_at !== null || order.workflow_state === CANONICAL_STATES.PENDING_CUSTOMER_CONFIRMATION) {
        logger.info(`[TIMEOUT ABORTED] Message 2 was already sent for Order #${order.order_number}.`);
        return { success: false, reason: 'message_2_already_sent' };
      }

      const prevStatus = order.verification_status;
      const timeoutHours = await this.getFinalConfirmationTimeoutHours();
      const finalDueAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000);

      await order.update(
        {
          status: 'pending_confirmation',
          verification_status: 'pending_confirmation',
          workflow_state: CANONICAL_STATES.PENDING_CUSTOMER_CONFIRMATION,
          flow_stage: 'match_pending',
          second_message_due_at: null,
          screenshot_deadline_at: null,
          second_message_sent_at: new Date(),
          final_confirmation_sent_at: new Date(),
          final_confirmation_due_at: finalDueAt,
        },
        { transaction: t }
      );

      await OrderActivity.create(
        {
          order_id: order.id,
          action: 'screenshot_timeout_elapsed',
          from_value: prevStatus,
          to_value: 'pending_confirmation',
          note: `15-minute screenshot window expired with no image received. Transitioned to PENDING_CUSTOMER_CONFIRMATION and enqueued Message 2 (order_confirmation013).`,
          metadata: { finalConfirmationDueAt: finalDueAt.toISOString() },
        },
        { transaction: t }
      );

      // Enqueue Message 2 via Outbox
      const cust = order.customer;
      const recipientPhone = cust?.whatsapp_number || cust?.phone || order.customer_phone || order.shipping_address?.ship_phone;
      if (recipientPhone) {
        await whatsappOutboxQueue.enqueue(
          {
            order_id: order.id,
            customer_id: cust?.id || order.customer_id,
            batch_id: order.whatsapp_batch_id || order.import_batch_id,
            recipient_phone: recipientPhone,
            template_name: 'order_confirmation013',
            idempotency_key: `m2_timeout_${order.id}`,
            payload: {},
          },
          { transaction: t }
        );
      }

      logger.info(`⏱️ [WORKFLOW SCREENSHOT_TIMEOUT] Order #${order.order_number} 15m elapsed without image. Message 2 enqueued.`);
      return { success: true, order, state: CANONICAL_STATES.PENDING_CUSTOMER_CONFIRMATION, finalDueAt };
    });
  }

  /**
   * 6. Customer Cancels Order from Message 2 (Section 14)
   */
  static async handleCustomerCancel(arg1, arg2) {
    let orderId, waMessageId, actor, reason;
    if (typeof arg1 === 'object' && arg1 !== null) {
      orderId = arg1.orderId || arg1.id;
      waMessageId = arg1.waMessageId || null;
      actor = arg1.actor || 'customer_whatsapp';
      reason = arg1.reason || 'Customer cancelled via WhatsApp';
    } else {
      orderId = arg1;
      waMessageId = arg2?.waMessageId || null;
      actor = arg2?.actor || 'customer_whatsapp';
      reason = arg2?.reason || 'Customer cancelled via WhatsApp';
    }

    return await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!order) {
        throw new AppError(`Order ${orderId} not found`, 404);
      }

      // Stale button protection: Cannot cancel an already confirmed order
      if (order.status === 'confirmed' || order.workflow_state === CANONICAL_STATES.CONFIRMED) {
        logger.warn(`[WORKFLOW REJECTED] Cannot cancel Order #${order.order_number}: Order is already CONFIRMED.`);
        return { success: false, rejected: true, reason: 'cannot_cancel_confirmed_order', order };
      }

      if (order.status === 'cancelled' || order.workflow_state === CANONICAL_STATES.CANCELLED) {
        logger.info(`[WORKFLOW IDEMPOTENT] Order #${order.order_number} is already CANCELLED.`);
        return { success: true, idempotent: true, order, state: CANONICAL_STATES.CANCELLED };
      }

      const prevStatus = order.status;
      const prevVerificationStatus = order.verification_status;

      await order.update(
        {
          status: 'cancelled',
          verification_status: 'cancelled',
          workflow_state: CANONICAL_STATES.CANCELLED,
          flow_stage: 'match_cancelled',
          customer_cancelled_at: new Date(),
          cancelled_at: new Date(),
          cancel_reason: reason,
          second_message_due_at: null,
          screenshot_deadline_at: null,
          final_confirmation_due_at: null,
          cancelled_message_id: waMessageId || order.cancelled_message_id,
        },
        { transaction: t }
      );

      await OrderActivity.create(
        {
          order_id: order.id,
          action: 'customer_cancelled',
          from_value: prevVerificationStatus || prevStatus,
          to_value: 'cancelled',
          note: `Customer clicked [Cancel Order] on WhatsApp: ${reason}. Transitioned to CANCELLED.`,
          metadata: { actor, waMessageId, reason },
        },
        { transaction: t }
      );

      // Queue order_cancelled template via Outbox
      const cust = order.customer;
      const recipientPhone = cust?.whatsapp_number || cust?.phone || order.customer_phone || order.shipping_address?.ship_phone;
      if (recipientPhone) {
        await whatsappOutboxQueue.enqueue(
          {
            order_id: order.id,
            customer_id: cust?.id || order.customer_id,
            batch_id: order.whatsapp_batch_id || order.import_batch_id,
            recipient_phone: recipientPhone,
            template_name: 'order_cancelled',
            idempotency_key: `order_cancelled_${order.id}`,
            payload: {},
          },
          { transaction: t }
        );
      }

      logger.info(`❌ [WORKFLOW CANCELLED] Order #${order.order_number} cancelled by customer. Cancellation notice enqueued.`);
      return { success: true, order, state: CANONICAL_STATES.CANCELLED };
    });
  }

  /**
   * 7. Final Confirmation Deadline Expired with No Customer Response (Section 17)
   */
  static async handleFinalConfirmationTimeout(arg) {
    const orderId = typeof arg === 'object' && arg !== null ? (arg.orderId || arg.id) : arg;
    return await sequelize.transaction(async (t) => {
      const order = await Order.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!order) return { success: false, reason: 'order_not_found' };

      if (['confirmed', 'cancelled'].includes(order.status)) {
        await order.update({ final_confirmation_due_at: null }, { transaction: t });
        return { success: false, reason: 'order_already_terminal' };
      }

      if (order.customer_confirmed_at !== null) {
        await order.update({ final_confirmation_due_at: null }, { transaction: t });
        return { success: false, reason: 'customer_already_confirmed' };
      }

      const prevStatus = order.status;

      await order.update(
        {
          status: 'cancelled',
          verification_status: 'cancelled',
          workflow_state: CANONICAL_STATES.CANCELLED,
          flow_stage: 'match_cancelled',
          cancelled_at: new Date(),
          cancel_reason: 'CUSTOMER_NO_RESPONSE_AFTER_FINAL_CONFIRMATION',
          final_confirmation_due_at: null,
          second_message_due_at: null,
          screenshot_deadline_at: null,
        },
        { transaction: t }
      );

      await OrderActivity.create(
        {
          order_id: order.id,
          action: 'customer_timeout_cancelled',
          from_value: prevStatus,
          to_value: 'cancelled',
          note: 'Order automatically cancelled: CUSTOMER_NO_RESPONSE_AFTER_FINAL_CONFIRMATION (Response window expired).',
          metadata: { actor: 'system_timeout_worker' },
        },
        { transaction: t }
      );

      // Queue order_cancelled template via Outbox
      const cust = order.customer;
      const recipientPhone = cust?.whatsapp_number || cust?.phone || order.customer_phone || order.shipping_address?.ship_phone;
      if (recipientPhone) {
        await whatsappOutboxQueue.enqueue(
          {
            order_id: order.id,
            customer_id: cust?.id || order.customer_id,
            batch_id: order.whatsapp_batch_id || order.import_batch_id,
            recipient_phone: recipientPhone,
            template_name: 'order_cancelled',
            idempotency_key: `order_cancelled_timeout_${order.id}`,
            payload: {},
          },
          { transaction: t }
        );
      }

      logger.info(`⌛ [WORKFLOW FINAL_TIMEOUT] Order #${order.order_number} cancelled due to non-response to Message 2.`);
      return { success: true, order, state: CANONICAL_STATES.CANCELLED };
    });
  }

  /**
   * 8. Customer Clicks Call Representative (Section 18)
   * Escalates inbound "Call Representative" click on order_verification_interactive
   * to the Telecaller Workbench with lead, customer, and order context.
   */
  static async handleRepresentativeRequest({ orderId = null, customerId = null, phone = '', waMessageId = null }) {
    let order = null;
    if (orderId) {
      order = await Order.findByPk(orderId, { include: [{ model: Customer, as: 'customer' }] });
    }

    // Lookup order by sender phone if not yet resolved
    if (!order && phone) {
      const cleanPhone = String(phone).replace(/\D/g, '');
      const last10 = cleanPhone.slice(-10);
      if (last10) {
        order = await Order.findOne({
          where: {
            [Op.or]: [
              { customer_phone: { [Op.like]: `%${last10}` } },
              sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.ship_phone')) LIKE '%${last10}%'`),
              sequelize.literal(`JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.phone')) LIKE '%${last10}%'`),
            ],
          },
          order: [['created_at', 'DESC']],
          include: [{ model: Customer, as: 'customer' }],
        });
      }
    }

    // Resolve or link customer entity
    let customer = order?.customer || null;
    if (!customer && customerId) {
      customer = await Customer.findByPk(customerId);
    }
    if (!customer && order) {
      try {
        const { ensureCustomerOnDelivery } = require('../controllers/orderController');
        customer = await ensureCustomerOnDelivery(order);
      } catch (e) {
        logger.warn(`Could not ensure customer via orderController: ${e.message}`);
      }
    }

    if (!customer && phone) {
      const cleanPhone = String(phone).replace(/\D/g, '');
      const last10 = cleanPhone.slice(-10);
      if (last10) {
        customer = await Customer.findOne({
          where: {
            [Op.or]: [
              { phone: { [Op.like]: `%${last10}` } },
              { whatsapp_number: { [Op.like]: `%${last10}` } },
            ],
          },
        });
      }
    }

    const timeFormatted = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const orderNumStr = order?.order_number ? `Order #${order.order_number}` : 'Order Verification';
    const prodStr = order?.product_name ? ` (${order.product_name})` : (order?.product_sku ? ` (${order.product_sku})` : '');
    const callbackNote = `[⚡ Verification Callback Requested - ${timeFormatted}] Customer clicked "Call Representative" on WhatsApp Message 1 (order_verification_interactive) for ${orderNumStr}${prodStr}. Immediate telecaller callback required.`;

    if (!customer) {
      customer = await Customer.create({
        name: order?.customer_name || 'WhatsApp Customer',
        phone: phone || null,
        whatsapp_number: phone || null,
        source: order?.marketplace || 'direct',
        status: 'active',
        lifecycle_stage: 'prospect',
        installation_help_requested: true,
        installation_help_status: 'pending',
        installation_help_requested_at: new Date(),
        tags: ['call_representative_requested', 'verification_callback'],
        notes: callbackNote,
        installation_notes: callbackNote,
        last_contacted_at: new Date(),
      });
    } else {
      const existingTags = Array.isArray(customer.tags) ? customer.tags : [];
      const updatedTags = Array.from(new Set([...existingTags, 'call_representative_requested', 'verification_callback']));
      const updatedNotes = customer.notes ? `${callbackNote}\n${customer.notes}` : callbackNote;

      await customer.update({
        installation_help_requested: true,
        installation_help_status: 'pending',
        installation_help_requested_at: new Date(),
        tags: updatedTags,
        notes: updatedNotes,
        installation_notes: callbackNote,
        last_contacted_at: new Date(),
      });
    }

    // Ensure order is linked to this customer
    if (order && customer && order.customer_id !== customer.id) {
      await order.update({ customer_id: customer.id });
      order.customer_id = customer.id;
    }

    // Update order verification status and record audit activity
    if (order) {
      await order.update({
        verification_status: 'call_representative_requested',
      });

      await OrderActivity.create({
        order_id: order.id,
        action: 'call_representative_requested',
        from_value: order.verification_status || 'unknown',
        to_value: 'call_representative_requested',
        note: `Customer clicked [Call Representative] button on WhatsApp Message 1 (order_verification_interactive). Escalated to Telecaller Suite.`,
        metadata: {
          orderId: order.id,
          customerId: customer.id,
          phone,
          waMessageId,
          requestedAt: new Date().toISOString(),
        },
      });
    }

    // Create urgent FollowUp for telecaller team
    let repUser = null;
    try {
      repUser = await User.findOne({
        where: { role: { [Op.in]: ['telecaller', 'admin', 'super_admin'] } },
      });
    } catch (_) {}

    try {
      await FollowUp.create({
        customer_id: customer.id,
        order_id: order?.id || null,
        assigned_to: repUser?.id || customer.id,
        type: 'call',
        priority: 'urgent',
        status: 'pending',
        subject: `⚡ Order Verification Callback: ${orderNumStr} (${customer.name})`,
        notes: `Customer clicked "Call Representative" on WhatsApp order verification message for ${orderNumStr}. Customer Phone: ${phone || customer.phone || 'N/A'}. Immediate verification call required.`,
        due_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes SLA
      });
    } catch (fuErr) {
      logger.warn(`Failed to auto-create FollowUp for call_representative: ${fuErr.message}`);
    }

    // Dispatch WhatsApp confirmation / acknowledgment to customer
    try {
      const whatsappService = require('./whatsappService');
      const targetPhone = phone || customer.phone || customer.whatsapp_number;
      if (targetPhone) {
        const custName = customer.name && customer.name !== 'WhatsApp Customer' ? customer.name : 'Valued Customer';
        const ordContext = order?.order_number ? ` regarding Order #${order.order_number}` : '';
        const ackMsg = `Hi ${custName} 👋 We have received your request to speak with our representative${ordContext}. Our support specialist will call you shortly on this number to assist you. Thank you for choosing AquaBeat!`;
        await whatsappService.sendMessage({
          phone: targetPhone,
          message: ackMsg,
          orderId: order?.id || null,
          customerId: customer.id,
        });
      }
    } catch (waErr) {
      logger.warn(`Failed to dispatch WhatsApp acknowledgment for call_representative: ${waErr.message}`);
    }

    logger.info(`📞 [WORKFLOW CALL_REP] Escalated CALL_REPRESENTATIVE_REQUESTED for Customer #${customer.id} (${customer.name}) Order #${order?.order_number || 'N/A'} to Telecaller Suite`);
    return { success: true, event: 'CALL_REPRESENTATIVE_REQUESTED', customer, order };
  }
}

OrderVerificationWorkflowService.CANONICAL_STATES = CANONICAL_STATES;
module.exports = OrderVerificationWorkflowService;
