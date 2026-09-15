'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { sequelize, Order, Customer, Warranty, WarrantyEvent, OrderEvent, WhatsAppOutbox } = require('../../models');
const whatsappOutboxQueue = require('../whatsappOutboxQueue');
const { generateActivationToken, verifyActivationToken } = require('../warrantyTokenService');
const logger = require('../../config/logger');
const { AppError } = require('../../utils/errors');

class DeliveryEventOrchestrator {
  /**
   * FEATURE 15: Handle Order Dispatched Event
   * Triggered when an order transitions from CONFIRMED -> DISPATCHED for the first time.
   * Enqueues dispatch WhatsApp message with stable idempotency key order_dispatched_<orderId>.
   */
  static async handleOrderDispatched(order, options = {}) {
    if (!order || !order.id) {
      throw new Error('Order is required for dispatch event orchestration');
    }

    const recipientPhone = order.customer_phone || order.customer?.whatsapp_number || order.customer?.phone;
    if (!recipientPhone) {
      logger.warn(`[ORDER_DISPATCHED] No valid phone found for Order #${order.order_number}`);
      return { success: false, reason: 'NO_RECIPIENT_PHONE' };
    }

    const idempotencyKey = `order_dispatched_${order.id}`;

    // Record ORDER_DISPATCHED event
    await OrderEvent.create({
      order_id: order.id,
      customer_id: order.customer_id,
      event_type: 'ORDER_DISPATCHED',
      source: options.source || 'shipping_upload',
      actor: options.actor || 'SYSTEM',
      before_state: order.workflow_state,
      after_state: 'DISPATCHED',
      correlation_id: `ORD-${order.order_number}-DISPATCH`,
      metadata: {
        tracking_number: order.tracking_number,
        shipping_partner: order.shipping_partner,
      },
    }, { transaction: options.transaction });

    // Enqueue Dispatch WhatsApp message
    const outboxItem = await whatsappOutboxQueue.enqueue(
      {
        order_id: order.id,
        customer_id: order.customer_id,
        recipient_phone: recipientPhone,
        template_name: 'order_dispatched',
        payload: {
          customer_name: order.customer_name || 'Customer',
          order_number: order.order_number,
          tracking_number: order.tracking_number || 'Available soon',
          shipping_partner: order.shipping_partner || 'Standard Courier',
        },
        idempotency_key: idempotencyKey,
      },
      { transaction: options.transaction }
    );

    return { success: true, outboxItem };
  }

  /**
   * FEATURE 16: Handle Order Delivered Event
   * Triggered when an order transitions to DELIVERED for the first time.
   * Invokes 4 independent consumers:
   * 1. Delivery WhatsApp message
   * 2. Installation Guide workflow
   * 3. Warranty Creation
   * 4. Warranty Claim outreach
   */
  static async handleOrderDelivered(order, options = {}) {
    if (!order || !order.id) {
      throw new Error('Order is required for delivery event orchestration');
    }

    const correlationId = `ORD-${order.order_number}-DELIVERED`;
    logger.info(`[ORDER_DELIVERED] Orchestrating delivery events for Order #${order.order_number} (${correlationId})`);

    // Create exactly ONE ORDER_DELIVERED event
    await OrderEvent.create({
      order_id: order.id,
      customer_id: order.customer_id,
      event_type: 'ORDER_DELIVERED',
      source: options.source || 'shipping_upload',
      actor: options.actor || 'SYSTEM',
      before_state: order.workflow_state,
      after_state: 'DELIVERED',
      correlation_id: correlationId,
      metadata: {
        delivered_at: order.delivered_at || new Date(),
        tracking_number: order.tracking_number,
      },
    }, { transaction: options.transaction });

    // Independent Consumer 1: Delivery WhatsApp message
    const deliveryMsg = await this.consumerDeliveryWhatsApp(order, options);

    // Independent Consumer 2: Installation Guide (Feature 17)
    const installMsg = await this.consumerInstallationGuide(order, options);

    // Independent Consumer 3 & 4: Warranty Creation & Warranty Claim (Feature 18)
    const warrantyResult = await this.consumerWarrantyCreationAndClaim(order, options);

    return {
      success: true,
      deliveryMsg,
      installMsg,
      warrantyResult,
      warranty: warrantyResult?.warranty,
    };
  }

  /**
   * Consumer 1: Delivery WhatsApp message
   */
  static async consumerDeliveryWhatsApp(order, options = {}) {
    const recipientPhone = order.customer_phone || order.customer?.whatsapp_number || order.customer?.phone;
    if (!recipientPhone) return null;

    return await whatsappOutboxQueue.enqueue(
      {
        order_id: order.id,
        customer_id: order.customer_id,
        recipient_phone: recipientPhone,
        template_name: 'order_deliverd',
        payload: {
          customer_name: order.customer_name || 'Customer',
          order_number: order.order_number,
          product_name: order.product_name,
        },
        idempotency_key: `order_delivery_${order.id}`,
      },
      { transaction: options.transaction }
    );
  }

  /**
   * Consumer 2: Installation Guide (Feature 17)
   */
  static async consumerInstallationGuide(order, options = {}) {
    const recipientPhone = order.customer_phone || order.customer?.whatsapp_number || order.customer?.phone;
    if (!recipientPhone) return null;

    return await whatsappOutboxQueue.enqueue(
      {
        order_id: order.id,
        customer_id: order.customer_id,
        recipient_phone: recipientPhone,
        template_name: 'installation_guide',
        payload: {
          customer_name: order.customer_name || 'Customer',
          order_number: order.order_number,
          product_name: order.product_name,
        },
        idempotency_key: `installation_guide_${order.id}`,
      },
      { transaction: options.transaction }
    );
  }

  /**
   * Consumer 3 & 4: Warranty Creation & Warranty Claim (Feature 18)
   */
  static async consumerWarrantyCreationAndClaim(order, options = {}) {
    const tx = options.transaction;

    // 1. Create Warranty record if not already existing
    let warranty = await Warranty.findOne({
      where: { order_id: order.id },
      transaction: tx,
    });

    const now = new Date();
    const purchaseDate = order.order_date ? new Date(order.order_date) : now;
    const deliveredAt = order.delivered_at || now;
    const startDate = new Date(deliveredAt);
    const endDate = new Date(deliveredAt);
    endDate.setFullYear(endDate.getFullYear() + 1); // 1-year default warranty

    if (!warranty) {
      const year = now.getFullYear();
      const cleanOrderNum = (order.order_number || String(Date.now())).replace(/[^a-zA-Z0-9]/g, '').slice(-6);
      const warrantyNum = `WAR-${year}-${cleanOrderNum}-${Math.floor(1000 + Math.random() * 9000)}`;

      warranty = await Warranty.create(
        {
          id: uuidv4(),
          warranty_number: warrantyNum,
          customer_id: order.customer_id,
          order_id: order.id,
          product_name_snapshot: order.product_name || 'AquaBeat Purifier',
          brand_snapshot: 'AquaBeat',
          model_snapshot: order.product_sku || 'AKUA-GEN',
          marketplace: order.channel || order.marketplace || 'direct',
          purchase_date: purchaseDate,
          delivered_at: deliveredAt,
          warranty_start_date: startDate,
          warranty_end_date: endDate,
          status: 'PENDING_VERIFICATION',
          verification_status: 'PENDING',
          registration_source: 'DELIVERY_ORCHESTRATION',
        },
        { transaction: tx }
      );
    }

    // 2. Generate signed activation token & URL
    const token = generateActivationToken(warranty, 30);
    const baseUrl = process.env.WARRANTY_SITE_URL || 'https://akuabeat.com';
    const activationUrl = `${baseUrl}/warranty/activate/${token}`;

    const recipientPhone = order.customer_phone || order.customer?.whatsapp_number || order.customer?.phone;
    if (!recipientPhone) {
      return { warranty, outboxItem: null };
    }

    // 3. Enqueue warranty_claim with STABLE IDEMPOTENCY KEY warranty_claim_<warrantyId>
    const idempotencyKey = `warranty_claim_${warranty.id}`;

    const outboxItem = await whatsappOutboxQueue.enqueue(
      {
        order_id: order.id,
        customer_id: order.customer_id,
        recipient_phone: recipientPhone,
        template_name: 'warranty_claim',
        payload: {
          customer_name: order.customer_name || 'Customer',
          order_number: order.order_number,
          product_name: order.product_name,
          warranty_number: warranty.warranty_number,
          activation_url: activationUrl,
        },
        idempotency_key: idempotencyKey,
      },
      { transaction: tx }
    );

    return { warranty, activationUrl, outboxItem };
  }

  /**
   * FEATURE 19 & 20: Warranty Website Activation & Message
   * Verifies signed token, updates warranty to ACTIVE in a transaction,
   * records WarrantyEvent, and enqueues warranty_activated exactly once.
   */
  static async activateWarranty({ token, formData = {}, actor = 'customer_website' }) {
    if (!token) {
      throw new AppError('Activation token is required', 400);
    }

    // 1. Validate Token
    const verification = verifyActivationToken(token);
    if (!verification.valid) {
      throw new AppError(`Invalid or expired activation token: ${verification.reason}`, 400);
    }

    const { wid, oid } = verification.payload;

    return await sequelize.transaction(async (t) => {
      // 2. Lock Warranty row
      const warranty = await Warranty.findByPk(wid, {
        lock: t.LOCK.UPDATE,
        transaction: t,
        include: [{ model: Customer, as: 'customer' }],
      });

      if (!warranty) {
        throw new AppError(`Warranty record ${wid} not found`, 404);
      }

      // Idempotency: If already active
      if (warranty.status === 'ACTIVE') {
        logger.info(`[WARRANTY IDEMPOTENT] Warranty #${warranty.warranty_number} is already ACTIVE.`);
        return {
          success: true,
          idempotent: true,
          warranty,
          message: 'Warranty is already active.',
        };
      }

      const now = new Date();
      const oneYearLater = new Date(now);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      // 3. Update warranty to ACTIVE
      await warranty.update(
        {
          status: 'ACTIVE',
          verification_status: 'VERIFIED',
          activated_at: now,
          warranty_start_at: now,
          warranty_end_at: oneYearLater,
          warranty_start_date: now,
          warranty_end_date: oneYearLater,
          serial_number: formData.serial_number || warranty.serial_number,
          terms_accepted: true,
        },
        { transaction: t }
      );

      // 4. Create WarrantyEvent
      await WarrantyEvent.create(
        {
          warranty_id: warranty.id,
          event_type: 'WARRANTY_ACTIVATED',
          from_status: warranty.status || 'PENDING_VERIFICATION',
          to_status: 'ACTIVE',
          source_type: 'CUSTOMER',
          title: 'Warranty Activated by Customer',
          description: `Warranty ${warranty.warranty_number} activated via customer website.`,
          metadata: {
            formData,
            activated_at: now.toISOString(),
            actor: actor || 'customer',
          },
        },
        { transaction: t }
      );

      // 5. FEATURE 20: Atomically enqueue warranty_activated message with key warranty_activated_<warrantyId>
      const customerPhone = warranty.customer?.phone || warranty.customer?.whatsapp_number;
      if (customerPhone) {
        await whatsappOutboxQueue.enqueue(
          {
            order_id: warranty.order_id,
            customer_id: warranty.customer_id,
            recipient_phone: customerPhone,
            template_name: 'warranty_activated',
            payload: {
              customer_name: warranty.customer?.name || 'Customer',
              warranty_number: warranty.warranty_number,
              product_name: warranty.product_name_snapshot,
              warranty_end_date: oneYearLater.toISOString().split('T')[0],
            },
            idempotency_key: `warranty_activated_${warranty.id}`,
          },
          { transaction: t }
        );
      }

      logger.info(`🎉 [WARRANTY ACTIVATED] Warranty #${warranty.warranty_number} activated successfully. Outbox queued.`);

      return {
        success: true,
        warranty,
        activated_at: now,
        warranty_end_date: oneYearLater,
      };
    });
  }
}

module.exports = DeliveryEventOrchestrator;
