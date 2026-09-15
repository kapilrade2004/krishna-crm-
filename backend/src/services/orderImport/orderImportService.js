'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { sequelize, Order, Customer, OrderEvent, WhatsAppOutbox, CsvImportBatch } = require('../../models');
const FileParser = require('./fileParser');
const { ChannelAdapterFactory } = require('./channelAdapters');
const OrderValidator = require('./orderValidator');
const whatsappOutboxQueue = require('../whatsappOutboxQueue');
const logger = require('../../config/logger');

class OrderImportService {
  /**
   * Pre-flight schema validation to verify that database connection and required
   * tables exist before attempting any row processing.
   * If any table is missing, fails early with a clear administrative diagnostic.
   */
  static async preflightCheck() {
    // 1. Connection check
    try {
      await sequelize.authenticate();
    } catch (authErr) {
      throw new Error(`Database connection failed: ${authErr.message}`);
    }

    // 2. Required tables check
    const requiredTables = ['orders', 'customers', 'csv_import_batches', 'order_events', 'whatsapp_outbox'];
    let existingTables = [];
    try {
      const allTables = await sequelize.getQueryInterface().showAllTables();
      existingTables = allTables
        .map((t) => (typeof t === 'object' && t !== null ? t.tableName || Object.values(t)[0] : String(t)))
        .map((s) => s.toLowerCase());
    } catch (tableErr) {
      logger.warn(`[OrderImportService] Table introspection warning: ${tableErr.message}`);
    }

    if (existingTables.length > 0) {
      let missingTables = requiredTables.filter((req) => !existingTables.includes(req.toLowerCase()));
      
      // Auto-heal auxiliary tables if missing
      if (missingTables.includes('order_events')) {
        try {
          if (OrderEvent && typeof OrderEvent.sync === 'function') {
            await OrderEvent.sync({ alter: false });
          }
        } catch (syncErr) {
          logger.warn(`[OrderImportService] OrderEvent sync notice: ${syncErr.message}`);
        }
        try {
          if (sequelize.getDialect() === 'mysql') {
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS order_events (
                id CHAR(36) NOT NULL PRIMARY KEY,
                order_id CHAR(36) NOT NULL,
                customer_id CHAR(36) NULL,
                event_type VARCHAR(100) NOT NULL,
                source VARCHAR(100) NOT NULL DEFAULT 'system',
                actor_type VARCHAR(50) NOT NULL DEFAULT 'user',
                actor_id VARCHAR(150) NULL,
                actor VARCHAR(150) NULL,
                previous_state VARCHAR(100) NULL,
                before_state VARCHAR(100) NULL,
                new_state VARCHAR(100) NULL,
                after_state VARCHAR(100) NULL,
                correlation_id VARCHAR(150) NULL,
                metadata JSON NULL,
                timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_order_events_order_id (order_id),
                INDEX idx_order_events_customer_id (customer_id),
                INDEX idx_order_events_event_type (event_type),
                INDEX idx_order_events_correlation_id (correlation_id),
                INDEX idx_order_events_created_at (created_at)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);
          }
        } catch (rawErr) {
          logger.warn(`[OrderImportService] order_events raw create fallback: ${rawErr.message}`);
        }
      }

      if (missingTables.includes('whatsapp_outbox')) {
        try {
          if (WhatsAppOutbox && typeof WhatsAppOutbox.sync === 'function') {
            await WhatsAppOutbox.sync({ alter: false });
          }
        } catch (syncErr) {
          logger.warn(`[OrderImportService] WhatsAppOutbox sync notice: ${syncErr.message}`);
        }
      }

      // Re-inspect tables after auto-heal
      try {
        const recheckTables = await sequelize.getQueryInterface().showAllTables();
        existingTables = recheckTables
          .map((t) => (typeof t === 'object' && t !== null ? t.tableName || Object.values(t)[0] : String(t)))
          .map((s) => s.toLowerCase());
      } catch (_) {}

      missingTables = requiredTables.filter((req) => !existingTables.includes(req.toLowerCase()));
      if (missingTables.length > 0) {
        throw new Error(
          `Database schema version incompatible with importer. Missing required table(s): ${missingTables.join(
            ', '
          )}. Contact system administrator.`
        );
      }
    }

    // 3. Required models check
    if (!Order || !Customer || !OrderEvent) {
      throw new Error('Database schema version incompatible with importer. Model mappings are incomplete.');
    }
  }

  /**
   * Universal Order Import Pipeline
   * Supports .xlsx, .xls, .csv, .tsv across all channels (Amazon 1/2/3, Flipkart, IndiaMART, Website, Direct).
   *
   * Single Responsibility:
   * FILE -> PARSE -> NORMALIZE -> VALIDATE -> RESOLVE CUSTOMER -> CREATE ORDER -> AUDIT EVENT -> OUTBOX ENQUEUE
   *
   * @param {Object} params
   * @param {string} [params.filePath]
   * @param {Buffer} [params.buffer]
   * @param {string} [params.originalName]
   * @param {string} [params.channel]
   * @param {string} [params.actorId]
   * @param {string} [params.batchId]
   * @param {boolean} [params.enqueueVerification=false]
   * @returns {Promise<{
   *   success: boolean,
   *   status: string,
   *   total: number,
   *   importedCount: number,
   *   skippedCount: number,
   *   invalidCount: number,
   *   existingCustomersReused: number,
   *   importedOrders: Array<Object>,
   *   duplicates: Array<Object>,
   *   invalidEntries: Array<Object>
   * }>}
   */
  static async importOrders({
    filePath = null,
    buffer = null,
    originalName = '',
    channel = null,
    actorId = 'SYSTEM',
    batchId = null,
    enqueueVerification = false,
  }) {
    // 1. Mandatory pre-flight schema verification
    await this.preflightCheck();

    // 2. Parse file into raw row objects
    const rawRows = await FileParser.parse({ filePath, buffer, originalName });
    if (!rawRows || rawRows.length === 0) {
      throw new Error('No data rows found in the uploaded file.');
    }

    // 3. Select channel adapter (or auto-detect)
    const adapter = ChannelAdapterFactory.getAdapter(channel, rawRows[0]);
    logger.info(
      `[OrderImportService] Processing ${rawRows.length} rows for channel: ${channel} (Adapter: ${adapter.channelName})`
    );

    // 4. Adapt and validate all rows into CanonicalOrderDTOs
    const validatedEntries = [];
    const invalidEntries = [];

    rawRows.forEach((row, index) => {
      const rowIndex = index + 1;
      const dto = adapter.adaptRow(row);
      const validation = OrderValidator.validate(dto, rowIndex);

      if (validation.isValid) {
        validatedEntries.push({ rowIndex, dto: validation.dto });
      } else {
        invalidEntries.push({
          row: rowIndex,
          rowIndex,
          errors: validation.errors,
          structuredErrors: validation.structuredErrors,
          raw: row,
        });
      }
    });

    const importedOrders = [];
    const duplicates = [];
    const rowFailures = [];
    let existingCustomersReused = 0;

    // 5. Process validated rows in isolated per-row transactions with chunking (100 rows per chunk)
    // Partial failure rule: 1 bad row must never roll back valid rows.
    const CHUNK_SIZE = 100;
    for (let c = 0; c < validatedEntries.length; c += CHUNK_SIZE) {
      const chunk = validatedEntries.slice(c, c + CHUNK_SIZE);

      for (const entry of chunk) {
        const { rowIndex, dto } = entry;

        try {
          const rowResult = await sequelize.transaction(async (t) => {
            // A. Resolve or create Customer (Deterministic exact match, no fuzzy LIKE)
            let customer = null;
            let wasCustomerReused = false;

            // Determine canonical marketplace & channel
            let targetMarketplace = 'direct';
            const cleanChannel = String(dto.channel || channel || '').toLowerCase().trim();
            if (cleanChannel.includes('amazon')) targetMarketplace = 'amazon';
            else if (cleanChannel.includes('flipkart')) targetMarketplace = 'flipkart';
            else if (cleanChannel.includes('indiamart')) targetMarketplace = 'indiamart';
            else if (cleanChannel.includes('website') || cleanChannel.includes('shopify') || cleanChannel.includes('akuabeat')) targetMarketplace = 'akuabeat_website';
            else if (cleanChannel.includes('direct')) targetMarketplace = 'direct';
            else targetMarketplace = 'other';

            const targetChannel = dto.channel || channel || targetMarketplace;
            const validSource = ['amazon', 'flipkart', 'indiamart', 'akuabeat_website', 'website', 'direct'].includes(targetMarketplace)
              ? targetMarketplace
              : 'other';

            if (dto.customer_phone) {
              const cleanDigits = dto.customer_phone.replace(/\D/g, '');
              const last10 = cleanDigits.slice(-10);
              const canonicalPhone = `+91${last10}`;
              const with91 = `91${last10}`;

              const phoneCandidates = Array.from(
                new Set([dto.customer_phone, canonicalPhone, with91, last10])
              ).filter(Boolean);

              const matchConditions = [
                { phone: { [Op.in]: phoneCandidates } },
                { whatsapp_number: { [Op.in]: phoneCandidates } },
              ];

              if (dto.customer_email && String(dto.customer_email).trim() !== '') {
                matchConditions.push({ email: String(dto.customer_email).trim().toLowerCase() });
              }

              customer = await Customer.findOne({
                where: { [Op.or]: matchConditions },
                transaction: t,
              });

              if (customer) {
                wasCustomerReused = true;
              } else {
                customer = await Customer.create(
                  {
                    id: uuidv4(),
                    name: dto.customer_name || 'Valued Customer',
                    phone: canonicalPhone, // Always store canonical +91XXXXXXXXXX
                    whatsapp_number: canonicalPhone,
                    email: dto.customer_email || null,
                    address_line1: dto.shipping_address?.address_line1 || null,
                    address_line2: dto.shipping_address?.address_line2 || null,
                    city: dto.shipping_address?.city || null,
                    state: dto.shipping_address?.state || null,
                    pincode: dto.delivery_pincode || dto.shipping_address?.postal_code || null,
                    source: validSource,
                  },
                  { transaction: t }
                );
              }
            } else if (dto.customer_email) {
              customer = await Customer.findOne({
                where: { email: dto.customer_email },
                transaction: t,
              });
              if (customer) {
                wasCustomerReused = true;
              } else {
                customer = await Customer.create(
                  {
                    id: uuidv4(),
                    name: dto.customer_name || 'Valued Customer',
                    phone: null,
                    whatsapp_number: null,
                    email: dto.customer_email,
                    address_line1: dto.shipping_address?.address_line1 || null,
                    address_line2: dto.shipping_address?.address_line2 || null,
                    city: dto.shipping_address?.city || null,
                    state: dto.shipping_address?.state || null,
                    pincode: dto.delivery_pincode || dto.shipping_address?.postal_code || null,
                    source: validSource,
                  },
                  { transaction: t }
                );
              }
            } else if (dto.customer_name && dto.customer_name !== 'Valued Customer') {
              customer = await Customer.create(
                {
                  id: uuidv4(),
                  name: dto.customer_name,
                  phone: null,
                  whatsapp_number: null,
                  email: null,
                  address_line1: dto.shipping_address?.address_line1 || null,
                  address_line2: dto.shipping_address?.address_line2 || null,
                  city: dto.shipping_address?.city || null,
                  state: dto.shipping_address?.state || null,
                  pincode: dto.delivery_pincode || dto.shipping_address?.postal_code || null,
                  source: validSource,
                },
                { transaction: t }
              );
            }

            // B. Deterministic Order Identity & Deduplication Check
            const duplicateConditions = [];
            if (dto.external_order_id) {
              duplicateConditions.push({ marketplace_order_id: dto.external_order_id });
            }
            if (dto.order_number) {
              duplicateConditions.push({ order_number: dto.order_number });
            }

            let existingOrder = null;
            if (duplicateConditions.length > 0) {
              existingOrder = await Order.findOne({
                where: { [Op.or]: duplicateConditions },
                transaction: t,
              });
            }

            if (existingOrder) {
              return {
                isDuplicate: true,
                customerReused: wasCustomerReused,
                rowIndex,
                order_number: dto.order_number,
                external_order_id: dto.external_order_id,
                existing_id: existingOrder.id,
              };
            }

            // C. Create canonical Order (pending verification if phone exists, else verification exception for staff review)
            const orderId = uuidv4();
            const orderNumber = dto.order_number || dto.external_order_id || `ORD-${orderId.substring(0, 8)}`;
            const correlationId = `ORD-${orderNumber}`;
            const hasPhone = Boolean(dto.customer_phone);

            const newOrder = await Order.create(
              {
                id: orderId,
                order_number: orderNumber,
                marketplace_order_id: dto.external_order_id || orderNumber,
                marketplace: targetMarketplace,
                channel: targetChannel,
                customer_id: customer ? customer.id : null,
                customer_name: dto.customer_name,
                customer_phone: dto.customer_phone,
                customer_email: dto.customer_email,
                import_batch_id: batchId || null,
                product_name: dto.product_name,
                product_sku: dto.product_sku,
                quantity: dto.quantity,
                unit_price: dto.unit_price,
                total_amount: dto.total_amount,
                shipping_address: dto.shipping_address,
                delivery_pincode: dto.delivery_pincode,
                latest_ship_date: dto.latest_ship_date,
                earliest_delivery_date: dto.earliest_delivery_date,
                estimated_delivery_date: dto.estimated_delivery_date,
                status: 'pending',
                verification_status: hasPhone ? 'pending_verification' : 'verification_exception',
                workflow_state: hasPhone ? 'PENDING_VERIFICATION' : 'EXCEPTION',
              },
              { transaction: t }
            );

            // D. Create canonical OrderEvent for durable audit trail
            await OrderEvent.create(
              {
                id: uuidv4(),
                order_id: newOrder.id,
                customer_id: customer ? customer.id : null,
                event_type: 'ORDER_IMPORTED',
                source: 'universal_order_import',
                actor_type: 'user',
                actor_id: actorId,
                actor: actorId,
                previous_state: null,
                before_state: null,
                new_state: hasPhone ? 'PENDING_VERIFICATION' : 'EXCEPTION',
                after_state: hasPhone ? 'PENDING_VERIFICATION' : 'EXCEPTION',
                correlation_id: correlationId,
                timestamp: new Date(),
                metadata: {
                  channel: targetChannel,
                  marketplace: targetMarketplace,
                  order_number: orderNumber,
                  quantity: dto.quantity,
                  total_amount: dto.total_amount,
                  batch_id: batchId || null,
                  customer_reused: wasCustomerReused,
                  phone_provided: hasPhone,
                },
              },
              { transaction: t }
            );

            // E. Create first verification event in durable WhatsApp Outbox (Atomically inside transaction)
            const targetPhone = dto.customer_phone || customer?.whatsapp_number || customer?.phone;
            if (enqueueVerification && targetPhone) {
              const idempotencyKey = `order_verification_${newOrder.id}`;
              await whatsappOutboxQueue.enqueue(
                {
                  order_id: newOrder.id,
                  customer_id: customer ? customer.id : null,
                  recipient_phone: targetPhone,
                  template_name: 'order_verification_interactive',
                  payload: {
                    customer_name: dto.customer_name || customer?.name || 'Valued Customer',
                    order_number: orderNumber,
                    product_name: dto.product_name,
                    product_sku: dto.product_sku,
                    total_amount: dto.total_amount,
                  },
                  idempotency_key: idempotencyKey,
                },
                { transaction: t }
              );
            }

            return { isDuplicate: false, customerReused: wasCustomerReused, order: newOrder };
          });

          if (rowResult.isDuplicate) {
            duplicates.push(rowResult);
          } else {
            importedOrders.push(rowResult.order);
            if (rowResult.customerReused) {
              existingCustomersReused++;
            }
          }
        } catch (rowErr) {
          logger.error(`[OrderImportService] Row ${rowIndex} database persistence failure: ${rowErr.message}`);
          rowFailures.push({
            row: rowIndex,
            rowIndex,
            errors: [rowErr.message],
            structuredErrors: [
              {
                field: 'database',
                problem: 'Row persistence failed',
                value: dto.order_number || dto.external_order_id,
                reason: rowErr.message,
              },
            ],
            raw: dto.raw_data,
          });
        }
      }
    }

    const allFailures = [...invalidEntries, ...rowFailures];
    const totalCount = rawRows.length;
    const importedCount = importedOrders.length;
    const duplicateCount = duplicates.length;
    const failureCount = allFailures.length;

    let finalStatus = 'completed';
    if (importedCount === 0 && (failureCount > 0 || duplicateCount === 0)) {
      finalStatus = 'failed';
    } else if (failureCount > 0) {
      finalStatus = 'partial';
    } else {
      finalStatus = 'completed';
    }

    if (batchId) {
      try {
        const errorLog = allFailures.map((f) => ({
          row: f.rowNumber || f.row,
          rowIndex: f.rowIndex,
          field: f.errors?.[0]?.field || f.field || 'validation',
          error: f.errors?.map((e) => e.message || e.reason).join('; ') || f.error || f.reason || 'Validation error',
          errors: f.errors?.map((e) => e.message || e.reason) || [f.error || f.reason],
        }));

        await CsvImportBatch.update(
          {
            status: finalStatus.toLowerCase(),
            total_rows: totalCount,
            processed_rows: totalCount,
            success_rows: importedCount,
            duplicate_rows: duplicateCount,
            failed_rows: failureCount,
            existing_customers_reused: existingCustomersReused,
            error_log: errorLog,
            processed_at: new Date(),
            completed_at: new Date(),
          },
          { where: { id: batchId } }
        );
      } catch (batchUpdateErr) {
        logger.warn(`[OrderImportService] CsvImportBatch update notice: ${batchUpdateErr.message}`);
      }
    }

    // Prepare WhatsApp batches for manual operator review & approval (max 100 per batch)
    if (batchId && importedCount > 0) {
      try {
        const WhatsAppBatchService = require('../whatsappBatchService');
        await WhatsAppBatchService.createBatchesForImport(batchId);
        logger.info(`[OrderImportService] Created WhatsApp batches for import batch ${batchId}`);
      } catch (batchErr) {
        logger.warn(`[OrderImportService] Automatic batch creation notice: ${batchErr.message}`);
      }
    }

    return {
      success: finalStatus !== 'failed',
      status: finalStatus,
      total: totalCount,
      importedCount,
      skippedCount: duplicateCount,
      invalidCount: failureCount,
      existingCustomersReused,
      // Compatibility aliases
      totalRows: totalCount,
      successRows: importedCount,
      duplicateRows: duplicateCount,
      failedRows: failureCount,
      importedOrders,
      duplicates,
      invalidEntries: allFailures,
    };
  }

  /**
   * Compatibility alias for processImport
   */
  static async processImport(params) {
    return await this.importOrders({
      filePath: params.filePath,
      buffer: params.fileBuffer || params.buffer,
      originalName: params.originalName,
      channel: params.channel,
      actorId: params.userId || params.actorId || 'SYSTEM',
      batchId: params.batchId,
      enqueueVerification: params.enqueueVerification === true,
    });
  }
}

module.exports = OrderImportService;
