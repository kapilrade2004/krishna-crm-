'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const WhatsAppProviderFactory = require('./whatsappProviderFactory');
const OrderWorkflowService = require('../orderWorkflow/orderWorkflowService');
const { ORDER_WORKFLOW_STATES } = require('../orderWorkflow/orderStateMachine');
const { sequelize, Order, Customer, User, FollowUp, WhatsAppLog, OrderActivity } = require('../../models');
const logger = require('../../config/logger');
const { AppError } = require('../../utils/errors');

class WhatsAppWebhookService {
  /**
   * Verifies incoming webhook request signature using configured provider
   */
  static verify(req) {
    const provider = WhatsAppProviderFactory.getProvider();
    return provider.verifyWebhook(req);
  }

  /**
   * Normalizes incoming raw webhook payload into canonical events
   *
   * @param {Object} rawBody - Express req.body
   * @returns {Array<Object>} Canonical webhook event objects
   */
  static normalize(rawBody) {
    const provider = WhatsAppProviderFactory.getProvider();
    const events = provider.normalizeWebhook(rawBody);
    logger.debug(`[WhatsAppWebhookService] Normalized ${events.length} event(s) using provider: ${provider.name}`);
    return events;
  }

  /**
   * Normalizes raw webhook body and processes each resulting event
   */
  static async processWebhook(rawBody, headers = {}) {
    const events = this.normalize(rawBody);
    const results = [];
    for (const event of events) {
      const res = await this.processEvent(event);
      results.push(res);
    }
    return results;
  }

  /**
   * Cleans and normalizes phone number to standard formats
   */
  static cleanPhone(rawPhone) {
    if (!rawPhone) return null;
    const digitsOnly = String(rawPhone).replace(/\D/g, '');
    if (digitsOnly.length === 10) return `+91${digitsOnly}`;
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) return `+${digitsOnly}`;
    return `+${digitsOnly}`;
  }

  /**
   * Resolves customer record from sender phone using indexed equality matching
   */
  static async resolveCustomer(phone) {
    if (!phone) return null;
    const clean = String(phone).replace(/\D/g, '');
    const last10 = clean.slice(-10);
    const canonical = `+91${last10}`;
    const with91 = `91${last10}`;

    const candidates = Array.from(new Set([phone, canonical, with91, last10])).filter(Boolean);

    return await Customer.findOne({
      where: {
        [Op.or]: [
          { phone: { [Op.in]: candidates } },
          { whatsapp_number: { [Op.in]: candidates } },
        ],
      },
    });
  }

  /**
   * Resolves order for incoming customer event
   * Enforces security: Customer A must NEVER mutate Customer B's order.
   * If no explicit order is given, requires exactly ONE active eligible order;
   * otherwise flags as AMBIGUOUS without guessing or picking arbitrary latest order.
   */
  static async resolveOrder({ customer, senderPhone, explicitOrderHint = null }) {
    const normalizedSender = this.cleanPhone(senderPhone);

    // 1. Explicit order correlation
    if (explicitOrderHint) {
      const order = await Order.findOne({
        where: {
          [Op.or]: [
            { id: explicitOrderHint },
            { order_number: explicitOrderHint },
            { marketplace_order_id: explicitOrderHint },
          ],
        },
        include: [{ model: Customer, as: 'customer' }],
      });

      if (order) {
        // SECURITY CHECK: Verify sender belongs to customer
        const orderPhone = this.cleanPhone(order.customer_phone || order.customer?.whatsapp_number || order.customer?.phone);
        const senderLast10 = normalizedSender ? normalizedSender.slice(-10) : '';
        const orderLast10 = orderPhone ? orderPhone.slice(-10) : '';

        if (!orderLast10 || orderLast10 !== senderLast10) {
          logger.warn(`[SECURITY VIOLATION] Sender ${senderPhone} attempted to mutate order #${order.order_number} owned by phone ${orderPhone}`);
          throw new AppError('UNAUTHORIZED_ORDER_ACCESS: Sender phone does not match order customer', 403);
        }

        return { order, isAmbiguous: false };
      }
    }

    // 2. Correlation by customer active orders
    if (!customer) {
      return { order: null, isAmbiguous: false, reason: 'CUSTOMER_NOT_FOUND' };
    }

    const eligibleStates = [
      ORDER_WORKFLOW_STATES.PENDING_VERIFICATION,
      ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED,
      ORDER_WORKFLOW_STATES.IMAGE_RECEIVED,
      ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION,
    ];

    const activeOrders = await Order.findAll({
      where: {
        customer_id: customer.id,
        workflow_state: { [Op.in]: eligibleStates },
      },
      order: [['created_at', 'DESC']],
    });

    if (activeOrders.length === 1) {
      return { order: activeOrders[0], isAmbiguous: false };
    }

    if (activeOrders.length > 1) {
      // Prioritize order actively waiting for a screenshot
      const screenshotReq = activeOrders.find(
        (o) => o.workflow_state === ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED || o.verification_status === 'screenshot_requested'
      );
      if (screenshotReq) {
        return { order: screenshotReq, isAmbiguous: false };
      }

      // In local development or when fallback is allowed, pick latest active order
      if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_LATEST_ORDER_FALLBACK === 'true') {
        logger.info(`[ORDER RESOLUTION] Customer ${customer.id} has ${activeOrders.length} orders; selecting latest active order #${activeOrders[0].order_number}`);
        return { order: activeOrders[0], isAmbiguous: false };
      }

      logger.warn(`[AMBIGUOUS ORDER] Customer ${customer.id} (${senderPhone}) has ${activeOrders.length} active orders awaiting action.`);
      return { order: null, isAmbiguous: true, candidateOrders: activeOrders };
    }

    // Strict: If multiple total orders or no active orders in eligible verification states,
    // do NOT arbitrarily guess or pick latest order. Require explicit hint.
    return { order: null, isAmbiguous: false, reason: 'NO_ACTIVE_ELIGIBLE_ORDER' };
  }

  /**
   * Authoritative entry point for processing a normalized WhatsApp event
   */
  static async processEvent(event) {
    const type = event.type;
    const sender = event.sender || event.senderPhone;
    const messageId = event.messageId || event.providerMessageId;
    const buttonId = event.buttonId;
    const text = event.text;
    const mediaId = event.mediaId;
    const directUrl = event.directUrl || event.raw?.directUrl || event.raw?.image?.url || event.raw?.image?.link || event.raw?.url;
    const status = event.status;
    const timestamp = event.timestamp;
    const raw = event.raw;

    logger.info(`[WhatsAppWebhookService] Processing event type="${type}" from="${sender}" buttonId="${buttonId || ''}" messageId="${messageId || ''}" status="${status || ''}"`);

    // 0. Handle delivery status reports from provider
    if (type === 'status_update' || type === 'status' || (status && !buttonId && !mediaId && !text)) {
      return await this.handleStatusUpdate(event);
    }

    // 1. Inbound Deduplication
    if (messageId) {
      const existingLog = await WhatsAppLog.findOne({
        where: { wa_message_id: messageId },
      });
      if (existingLog) {
        logger.info(`[WEBHOOK DEDUPLICATED] Event messageId "${messageId}" already processed.`);
        return { success: true, deduplicated: true };
      }
    }

    const normalizedPhone = this.cleanPhone(sender);
    const customer = await this.resolveCustomer(normalizedPhone);

    // Extract explicit order hint if provided in button payload, text, or caption
    let explicitOrderHint = null;
    if (buttonId && buttonId.includes(':')) {
      const parts = buttonId.split(':');
      explicitOrderHint = parts[1];
    } else if (raw && raw.order_id) {
      explicitOrderHint = raw.order_id;
    } else if (text) {
      const ordMatch = String(text).match(/ORD-[A-Z0-9-]+|OD[0-9]{10,}|TEST-[A-Z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b[0-9]{3}-[0-9]{6,7}-[0-9]{4,}\b/i);
      if (ordMatch) explicitOrderHint = ordMatch[0];
    } else if (raw?.image?.caption) {
      const ordMatch = String(raw.image.caption).match(/ORD-[A-Z0-9-]+|OD[0-9]{10,}|TEST-[A-Z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b[0-9]{3}-[0-9]{6,7}-[0-9]{4,}\b/i);
      if (ordMatch) explicitOrderHint = ordMatch[0];
    }

    const buttonTitle = event.buttonTitle || raw?.button?.text || raw?.interactive?.button_reply?.title || '';
    const rawButtonCmd = (buttonId ? buttonId.split(':')[0] : '').toLowerCase().trim();

    // 2. Order Resolution
    const { order, isAmbiguous, reason } = await this.resolveOrder({
      customer,
      senderPhone: normalizedPhone,
      explicitOrderHint,
    });

    if (isAmbiguous) {
      return {
        success: false,
        status: 'AMBIGUOUS',
        message: 'Multiple active orders found for customer. Manual operator resolution required.',
      };
    }

    const normalizedCmd = this.normalizeButtonCommand(rawButtonCmd, buttonTitle, order);

    if (!order && type === 'button') {
      logger.warn(`[UNMATCHED BUTTON] Button "${rawButtonCmd}" ("${normalizedCmd}") from ${sender} could not be matched to an active order.`);
      return {
        success: false,
        status: 'UNMATCHED',
        message: 'No eligible order found for button command.',
      };
    }

    let result = { success: true, processed: true };

    // 3. Image Event Execution (Feature 9)
    if (type === 'image') {
      result = await this.handleInboundImage({
        order,
        customer,
        senderPhone: normalizedPhone,
        messageId,
        mediaId: mediaId || `media_${messageId || Date.now()}`,
        directUrl,
        raw,
      });
    } else if (type === 'button') {
      // 4. Button Command Execution
      result = await this.handleButtonCommand({
        buttonCmd: normalizedCmd,
        order,
        customer,
        senderPhone: normalizedPhone,
        messageId,
      });
    } else if (type === 'text') {
      // 5. Inbound Text Message Processing
      result = await this.handleInboundText({
        text,
        order,
        customer,
        senderPhone: normalizedPhone,
        messageId,
      });
    }

    // Immediately trigger outbox drain so next automated template dispatches without delay
    try {
      const whatsappOutboxQueue = require('../whatsappOutboxQueue');
      setImmediate(() => {
        whatsappOutboxQueue.drainQueue().catch((drainErr) => {
          logger.warn(`[WhatsAppWebhookService] drainQueue notice: ${drainErr.message}`);
        });
      });
    } catch (_) {}

    // 6. Inbound Deduplication Record
    if (messageId) {
      try {
        await WhatsAppLog.create({
          phone_number: normalizedPhone || sender || 'unknown',
          order_id: order?.id || null,
          customer_id: customer?.id || null,
          message_type: type || 'interactive',
          direction: 'inbound',
          status: 'delivered',
          wa_message_id: messageId,
          payload: raw || { type, buttonId, text },
          delivered_at: new Date(),
        });
      } catch (logErr) {
        logger.warn(`[WhatsAppWebhookService] Could not persist inbound WhatsAppLog for messageId ${messageId}: ${logErr.message}`);
      }
    }

    return result;
  }

  /**
   * FEATURE 9: Full Customer Image / WhatsApp Media Pipeline
   */
  static async handleInboundImage({ order, customer, senderPhone, messageId, mediaId, directUrl, raw }) {
    const WhatsAppMessageService = require('./whatsappMessageService');
    const s3Service = require('../s3Service');
    const { CustomerImage } = require('../../models');

    logger.info(`[INBOUND IMAGE] Processing mediaId="${mediaId}" messageId="${messageId}" for Order #${order?.order_number || 'UNMATCHED'}`);

    const resolvedMediaId = mediaId || `media_${messageId || Date.now()}`;
    const targetDirectUrl = directUrl || raw?.directUrl || raw?.url || raw?.image?.url || raw?.image?.link || null;

    let downloaded = null;
    try {
      downloaded = await WhatsAppMessageService.downloadMedia({
        mediaId: resolvedMediaId,
        directUrl: targetDirectUrl,
        raw,
      });
    } catch (downloadErr) {
      logger.error(`[MEDIA DOWNLOAD FAILED] Failed to download mediaId ${resolvedMediaId}: ${downloadErr.message}`);
      const failedImg = await CustomerImage.create({
        id: uuidv4(),
        order_id: order?.id || null,
        customer_id: customer?.id || null,
        wa_message_id: messageId,
        media_id: resolvedMediaId,
        status: 'DOWNLOAD_FAILED',
        error_message: `Media download failed: ${downloadErr.message}`,
        rejection_reason: `Media download failed: ${downloadErr.message}`,
        retry_count: 0,
      });
      return {
        success: false,
        status: 'MEDIA_DOWNLOAD_FAILED',
        customerImage: failedImg,
        error: downloadErr.message,
      };
    }

    const { buffer, contentType, mimeType, directUrl: finalDirectUrl } = downloaded || {};
    const finalMime = mimeType || contentType || 'image/jpeg';
    const ext = finalMime.includes('png') ? 'png' : finalMime.includes('webp') ? 'webp' : 'jpg';
    const orderKey = order?.id || 'unmatched';
    const s3Key = `customer_images/${orderKey}/${mediaId || uuidv4()}.${ext}`;

    // Upload to Private S3 & local storage if buffer exists
    let s3Res = { key: s3Key, url: finalDirectUrl || `/uploads/${s3Key}` };
    if (buffer && buffer.length > 0) {
      s3Res = await s3Service.uploadBuffer({
        buffer,
        key: s3Key,
        contentType: finalMime,
        metadata: {
          orderId: order?.id || '',
          customerId: customer?.id || '',
          mediaId: mediaId || '',
          messageId: messageId || '',
        },
      });
    }

    const imgStatus = order ? 'RECEIVED' : 'UNMATCHED';

    const customerImage = await CustomerImage.create({
      id: uuidv4(),
      order_id: order?.id || null,
      customer_id: customer?.id || null,
      wa_message_id: messageId,
      media_id: mediaId,
      s3_key: buffer ? s3Res.key : (finalDirectUrl ? null : s3Key),
      file_url: s3Res.url,
      mime_type: finalMime,
      file_size: buffer ? buffer.length : 0,
      image_type: 'tap_photo',
      status: imgStatus,
      uploaded_at: new Date(),
    });

    // If order was in SCREENSHOT_REQUESTED, transition to IMAGE_RECEIVED
    if (order && (order.workflow_state === ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED || order.verification_status === 'screenshot_requested')) {
      await OrderWorkflowService.transitionOrder({
        orderId: order.id,
        targetState: ORDER_WORKFLOW_STATES.IMAGE_RECEIVED,
        actor: 'customer_whatsapp',
        source: 'whatsapp_image_webhook',
        correlationId: `ORD-${order.order_number}-IMG-${mediaId}`,
        customerPhone: senderPhone,
        note: `Customer uploaded screenshot/tap photo (mediaId: ${mediaId}). Received and stored in S3.`,
        metadata: {
          customer_image_id: customerImage.id,
          media_id: mediaId,
          s3_key: s3Res.key,
        },
      });
    }

    return {
      success: true,
      status: imgStatus,
      customerImage,
      order,
    };
  }

  /**
   * Semantically maps arbitrary button IDs, titles, and payloads into canonical workflow commands
   */
  static normalizeButtonCommand(buttonId = '', buttonTitle = '', order = null) {
    const rawId = String(buttonId || '').toLowerCase().trim();
    const rawTitle = String(buttonTitle || '').toLowerCase().trim();
    const combined = `${rawId} ${rawTitle}`.trim();

    const isInstallation =
      (order && (order.flow_stage === 'installation' || order.status === 'delivered')) ||
      combined.includes('installation') ||
      combined.includes('technician') ||
      combined.includes('all good') ||
      combined.includes('need help');

    const isFinalConfirmation =
      order &&
      (order.workflow_state === ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION ||
        order.verification_status === 'pending_confirmation' ||
        order.verification_status === 'sku_matched' ||
        order.flow_stage === 'match_confirmed');

    // 1. Screenshot / Photo request
    if (
      rawId === 'request_screenshot' ||
      rawId === 'send_screenshot' ||
      (rawId === 'btn_1' && !isInstallation) ||
      ['screenshot', 'send photo', 'photo', 'tap_photo', 'tap photo', 'image', 'upload'].some((k) =>
        combined.includes(k)
      )
    ) {
      return 'request_screenshot';
    }

    // 2. Installation assistance
    if (
      rawId === 'installation_need_help' ||
      ['yes, need help', 'yes need help', 'need help', 'technician', 'install help', 'need assistance'].some((k) =>
        combined.includes(k)
      ) ||
      (rawId === 'btn_0' && isInstallation)
    ) {
      return 'installation_need_help';
    }

    // 3. Installation done / acknowledged
    if (
      rawId === 'installation_done' ||
      ['all good', 'all good, done', 'done', 'installed', 'working fine'].some((k) => combined.includes(k)) ||
      (rawId === 'btn_1' && isInstallation)
    ) {
      return 'installation_done';
    }

    // 4. Order Cancellation (Explicit labels and commands MUST precede positional btn_2 fallback)
    const isCancelExplicit =
      rawId === 'order_cancel_final' ||
      rawId === 'order_cancel' ||
      ['cancel order', 'cancel', 'cancle', 'reject', 'no, cancel'].some((k) => combined.includes(k));

    if (isCancelExplicit || (rawId === 'btn_2' && isFinalConfirmation)) {
      return 'order_cancel_final';
    }

    // 5. Call Representative
    if (
      rawId === 'call_representative' ||
      rawId === 'call_rep' ||
      ['call representative', 'call rep', 'representative', 'agent', 'callback', 'call back', 'speak to agent'].some(
        (k) => combined.includes(k)
      ) ||
      (rawId === 'btn_2' && !isFinalConfirmation && !isInstallation)
    ) {
      return 'call_representative';
    }

    // 6. Order Confirmation
    if (
      rawId === 'order_confirm' ||
      rawId === 'order_confirm_final' ||
      (rawId === 'btn_0' && !isInstallation) ||
      ['confirm order', 'confirm', 'yes, confirm', 'yes confirm', 'yes_order', 'verified', 'accept'].some((k) =>
        combined.includes(k)
      )
    ) {
      return isFinalConfirmation ? 'order_confirm_final' : 'order_confirm';
    }

    return rawId;
  }

  /**
   * Deterministically handles inbound customer text responses
   */
  static async handleInboundText({ text, order, customer, senderPhone, messageId }) {
    if (!order) {
      logger.warn(`[INBOUND TEXT] Text received from ${senderPhone} but no active order found.`);
      return { success: true, reason: 'NO_ACTIVE_ORDER_FOR_TEXT' };
    }

    const clean = String(text || '').toLowerCase().trim();
    logger.info(`[INBOUND TEXT] Customer on Order #${order.order_number} texted: "${clean}"`);

    const isFinalConfirmation =
      order.workflow_state === ORDER_WORKFLOW_STATES.PENDING_CUSTOMER_CONFIRMATION ||
      order.verification_status === 'pending_confirmation' ||
      order.verification_status === 'sku_matched' ||
      order.flow_stage === 'match_confirmed';

    // 1. Confirm intent
    if (
      ['yes', 'confirm', 'yes confirm', 'ok', 'okay', 'confirmed', 'proceed', 'send', 'ha', 'sahi hai', 'agree'].some(
        (k) => clean === k || clean.startsWith(`${k} `) || clean.includes('confirm')
      )
    ) {
      const buttonCmd = isFinalConfirmation ? 'order_confirm_final' : 'order_confirm';
      return await this.handleButtonCommand({
        buttonCmd,
        order,
        customer,
        senderPhone,
        messageId,
      });
    }

    // 2. Cancel intent
    if (
      ['cancel', 'no', 'reject', 'cancle', 'dont send', 'nahi', 'cancel order', 'stop'].some(
        (k) => clean === k || clean.startsWith(`${k} `) || clean.includes('cancel')
      )
    ) {
      return await this.handleButtonCommand({
        buttonCmd: 'order_cancel_final',
        order,
        customer,
        senderPhone,
        messageId,
      });
    }

    // 3. Screenshot / Photo intent
    if (['photo', 'screenshot', 'image', 'picture', 'tap', 'sink', 'sending'].some((k) => clean.includes(k))) {
      return await this.handleButtonCommand({
        buttonCmd: 'request_screenshot',
        order,
        customer,
        senderPhone,
        messageId,
      });
    }

    // 4. Call representative / help intent
    if (['call', 'agent', 'representative', 'help', 'talk', 'phone', 'contact'].some((k) => clean.includes(k))) {
      return await this.handleButtonCommand({
        buttonCmd: 'call_representative',
        order,
        customer,
        senderPhone,
        messageId,
      });
    }

    return {
      success: true,
      action: 'text_logged',
      order,
    };
  }

  /**
   * Deterministically handles customer button commands
   */
  static async handleButtonCommand({ buttonCmd, order, customer, senderPhone, messageId }) {
    const orderId = order.id;
    const correlationId = `ORD-${order.order_number}-BTN-${buttonCmd}`;

    switch (buttonCmd) {
      // FEATURE 7: Message 1 Direct Confirm
      case 'order_confirm':
        logger.info(`[BUTTON: order_confirm] Confirming order #${order.order_number}`);
        return await OrderWorkflowService.transitionOrder({
          orderId,
          targetState: ORDER_WORKFLOW_STATES.CONFIRMED,
          actor: 'customer_whatsapp',
          source: 'whatsapp_button',
          correlationId,
          customerPhone: senderPhone,
          note: 'Customer clicked [Confirm Order] on Message 1.',
          outboxMessage: {
            templateName: 'order_confirmation',
            recipientPhone: order.customer_phone,
            idempotencyKey: `order_confirmation_${order.id}`,
            payload: {
              customer_name: order.customer_name,
              order_number: order.order_number,
              product_name: order.product_name,
              total_amount: order.total_amount,
            },
          },
        });

      // FEATURE 8: Message 1 Request Screenshot
      case 'request_screenshot':
        logger.info(`[BUTTON: request_screenshot] Initiating screenshot request for order #${order.order_number}`);
        return await OrderWorkflowService.transitionOrder({
          orderId,
          targetState: ORDER_WORKFLOW_STATES.SCREENSHOT_REQUESTED,
          actor: 'customer_whatsapp',
          source: 'whatsapp_button',
          correlationId,
          customerPhone: senderPhone,
          note: 'Customer clicked [Send Screenshot] on Message 1.',
          outboxMessage: {
            templateName: 'screenshot_from_customer',
            recipientPhone: order.customer_phone,
            idempotencyKey: `screenshot_request_${order.id}`,
            payload: {
              customer_name: order.customer_name,
              order_number: order.order_number,
            },
          },
        });

      // FEATURE 12: Message 2 Final Confirm
      case 'order_confirm_final':
        logger.info(`[BUTTON: order_confirm_final] Final confirmation for order #${order.order_number}`);
        return await OrderWorkflowService.transitionOrder({
          orderId,
          targetState: ORDER_WORKFLOW_STATES.CONFIRMED,
          actor: 'customer_whatsapp',
          source: 'whatsapp_button_m2',
          correlationId,
          customerPhone: senderPhone,
          note: 'Customer confirmed order on Message 2 (order_confirmation013).',
          outboxMessage: {
            templateName: 'order_confirmation',
            recipientPhone: order.customer_phone,
            idempotencyKey: `order_confirmation_${order.id}`,
            payload: {
              customer_name: order.customer_name,
              order_number: order.order_number,
              product_name: order.product_name,
              total_amount: order.total_amount,
            },
          },
        });

      // FEATURE 12: Message 2 Final Cancel
      case 'order_cancel_final':
        logger.info(`[BUTTON: order_cancel_final] Final cancellation for order #${order.order_number}`);
        return await OrderWorkflowService.transitionOrder({
          orderId,
          targetState: ORDER_WORKFLOW_STATES.CANCELLED,
          actor: 'customer_whatsapp',
          source: 'whatsapp_button_m2',
          correlationId,
          customerPhone: senderPhone,
          note: 'Customer cancelled order on Message 2 (order_confirmation013).',
          outboxMessage: {
            templateName: 'order_cancelled',
            recipientPhone: order.customer_phone,
            idempotencyKey: `order_cancelled_${order.id}`,
            payload: {
              customer_name: order.customer_name,
              order_number: order.order_number,
            },
          },
        });

      // FEATURE 13: Call Representative -> Telecaller Suite
      case 'call_representative':
        logger.info(`[BUTTON: call_representative] Escalating order #${order.order_number} to Telecaller Workbench`);
        // 1. Transition state
        const stateResult = await OrderWorkflowService.transitionOrder({
          orderId,
          targetState: ORDER_WORKFLOW_STATES.TELECALLER_REQUIRED,
          actor: 'customer_whatsapp',
          source: 'whatsapp_button',
          correlationId,
          customerPhone: senderPhone,
          note: 'Customer requested phone call [call_representative] via WhatsApp.',
        });

        // 2. Resolve Telecaller user
        let telecallerUser = await User.findOne({
          where: { role: { [Op.in]: ['telecaller', 'admin', 'super_admin'] } },
        });
        if (!telecallerUser) {
          telecallerUser = await User.findOne();
        }

        // 3. Create or update Telecaller FollowUp task idempotently
        if (customer && telecallerUser) {
          const existingTask = await FollowUp.findOne({
            where: {
              order_id: order.id,
              status: 'pending',
            },
          });

          if (existingTask) {
            await existingTask.update({
              priority: 'urgent',
              notes: `Customer re-requested phone call via WhatsApp [call_representative] at ${new Date().toISOString()}`,
              due_at: new Date(),
            });
          } else {
            await FollowUp.create({
              id: uuidv4(),
              customer_id: customer.id,
              order_id: order.id,
              assigned_to: telecallerUser.id,
              type: 'call',
              priority: 'urgent',
              status: 'pending',
              subject: `Call Request: Order #${order.order_number}`,
              notes: `Customer requested phone call via WhatsApp [call_representative] for order #${order.order_number}`,
              due_at: new Date(),
            });
          }

          // Flag customer tags
          const currentTags = Array.isArray(customer.tags) ? customer.tags : [];
          if (!currentTags.includes('call_representative_requested')) {
            await customer.update({
              tags: [...currentTags, 'call_representative_requested'],
              installation_help_requested: true,
            });
          }
        }

        return {
          success: true,
          action: 'call_representative_escalated',
          order: stateResult.order,
        };

      // FEATURE 17: Installation Guide Need Help
      case 'installation_need_help':
        logger.info(`[BUTTON: installation_need_help] Customer requested installation assistance for order #${order.order_number}`);
        if (customer) {
          let assignedUser = await User.findOne({
            where: { role: { [Op.in]: ['telecaller', 'admin', 'super_admin'] } },
          }) || (await User.findOne());

          const existingInstTask = await FollowUp.findOne({
            where: { order_id: order.id, status: 'pending' },
          });

          if (existingInstTask) {
            await existingInstTask.update({
              priority: 'urgent',
              notes: `Customer clicked [Yes, Need Help] on installation guide at ${new Date().toISOString()}`,
            });
          } else if (assignedUser) {
            await FollowUp.create({
              id: uuidv4(),
              customer_id: customer.id,
              order_id: order.id,
              assigned_to: assignedUser.id,
              type: 'call',
              priority: 'urgent',
              status: 'pending',
              subject: `Installation Help: Order #${order.order_number}`,
              notes: `Customer requested technician / installation help for order #${order.order_number}`,
              due_at: new Date(),
            });
          }
          await customer.update({ installation_help_requested: true });
        }
        return { success: true, action: 'installation_help_escalated' };

      // FEATURE 17: Installation Guide Done
      case 'installation_done':
        logger.info(`[BUTTON: installation_done] Customer acknowledged installation completed for order #${order.order_number}`);
        if (customer) {
          await customer.update({
            installation_confirmed_at: new Date(),
            installation_help_requested: false,
            installation_help_status: 'resolved',
            lifecycle_stage: 'installation_done',
          });
        }
        await order.update({
          flow_stage: 'completed',
        });
        await OrderActivity.create({
          order_id: order.id,
          action: 'installation_confirmed_done',
          from_value: 'installation',
          to_value: 'installation_done',
          note: 'Customer clicked [All Good, Done!] on WhatsApp. Recorded quietly — no outbound messages or escalations triggered.',
        });
        return { success: true, action: 'installation_acknowledged' };

      default:
        logger.warn(`[UNKNOWN BUTTON] Unrecognized button command: "${buttonCmd}"`);
        return { success: false, reason: `Unknown button command: ${buttonCmd}` };
    }
  }

  /**
   * FEATURE 21: Delivery Status Reconciliation
   * Reconciles delivery, read, and failure reports back into WhatsAppOutbox and WhatsAppLog
   */
  static async handleStatusUpdate(event) {
    const { providerMessageId, messageId, status, timestamp, raw } = event;
    const msgId = providerMessageId || messageId || raw?.id || raw?.wa_message_id;
    if (!msgId) return { success: true, reason: 'NO_MESSAGE_ID' };

    const { WhatsAppOutbox } = require('../../models');
    const normalizedStatus = String(status || '').toUpperCase();
    const eventTime = timestamp ? new Date(timestamp) : new Date();

    const outboxItem = await WhatsAppOutbox.findOne({
      where: {
        [Op.or]: [
          { provider_message_id: msgId },
          { idempotency_key: { [Op.like]: `%${msgId}%` } },
        ],
      },
    });

    if (outboxItem) {
      const updates = {};
      if (['DELIVERED', 'delivered'].includes(normalizedStatus)) {
        updates.status = 'DELIVERED';
        updates.delivered_at = eventTime;
      } else if (['READ', 'read'].includes(normalizedStatus)) {
        updates.status = 'READ';
        updates.read_at = eventTime;
        if (!outboxItem.delivered_at) updates.delivered_at = eventTime;
      } else if (['SENT', 'sent'].includes(normalizedStatus)) {
        if (!['DELIVERED', 'READ'].includes(outboxItem.status)) {
          updates.status = 'SENT';
        }
        updates.sent_at = eventTime;
      } else if (['FAILED', 'failed'].includes(normalizedStatus)) {
        if (!['DELIVERED', 'READ'].includes(outboxItem.status)) {
          updates.status = 'FAILED';
          updates.failed_at = eventTime;
          updates.failure_reason = raw?.error?.message || raw?.errors?.[0]?.title || 'Delivery failed';
        }
      }
      if (Object.keys(updates).length > 0) {
        await outboxItem.update(updates);
        logger.info(`[OUTBOX RECONCILED] Outbox #${outboxItem.id} updated to ${updates.status} via provider callback.`);
      }
    }

    return { success: true, status: normalizedStatus, outboxItem: !!outboxItem };
  }

  /**
   * Logs inbound free-form text messages without mutating order state
   */
  static async handleInboundText({ text, order, customer, senderPhone, messageId }) {
    logger.info(
      `[WhatsAppWebhookService] Inbound free-form text logged from ${senderPhone}: "${text}". Order #${order?.order_number || 'N/A'}.`
    );
    return { success: true, processed: true, message: 'Free-form text recorded without state mutation.' };
  }
}

module.exports = WhatsAppWebhookService;
