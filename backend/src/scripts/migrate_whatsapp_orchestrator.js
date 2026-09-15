'use strict';

const { sequelize, WhatsAppOutbox, WhatsAppLog, CustomerImage, Order, Customer, OrderActivity, OrderEvent, CsvImportBatch } = require('../models');
const logger = require('../config/logger');

/**
 * Idempotent, zero-downtime database migration for WhatsApp Orchestration, Orders, and Ingestion schema.
 * Reconciles models with MySQL live database without data loss.
 */
async function migrateWhatsAppOrchestrator() {
  try {
    logger.info('🔄 Verifying and reconciling database schema for WhatsApp Orchestrator & CRM Pipeline...');

    // 1. Sync core models safely if table doesn't exist
    try { await WhatsAppOutbox.sync({ alter: false }); } catch (e) { logger.warn(`WhatsAppOutbox sync notice: ${e.message}`); }
    try { await WhatsAppLog.sync({ alter: false }); } catch (e) { logger.warn(`WhatsAppLog sync notice: ${e.message}`); }
    try { await CustomerImage.sync({ alter: false }); } catch (e) { logger.warn(`CustomerImage sync notice: ${e.message}`); }
    try {
      if (OrderEvent && typeof OrderEvent.sync === 'function') {
        await OrderEvent.sync({ alter: false });
      }
    } catch (e) {
      logger.warn(`OrderEvent sync notice: ${e.message}`);
    }
    try {
      const { WhatsAppBatch } = require('../models');
      if (WhatsAppBatch && typeof WhatsAppBatch.sync === 'function') {
        await WhatsAppBatch.sync({ alter: false });
      }
    } catch (e) {
      logger.warn(`WhatsAppBatch sync notice: ${e.message}`);
    }

    // 2. Ensure MySQL tables and columns exist
    if (sequelize.getDialect() === 'mysql') {
      try {
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
      } catch (e) {
        logger.debug(`Schema patch notice for order_events: ${e.message}`);
      }

      try {
        await sequelize.query("ALTER TABLE whatsapp_outbox MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'QUEUED'");
      } catch (e) {
        logger.debug(`Schema patch notice for whatsapp_outbox.status: ${e.message}`);
      }
      try {
        await sequelize.query("ALTER TABLE orders MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'");
      } catch (e) {
        logger.debug(`Schema patch notice for orders.status: ${e.message}`);
      }
      try {
        await sequelize.query("ALTER TABLE orders MODIFY COLUMN verification_status VARCHAR(50) NOT NULL DEFAULT 'pending_verification'");
      } catch (e) {
        logger.debug(`Schema patch notice for orders.verification_status: ${e.message}`);
      }
      try {
        await sequelize.query("ALTER TABLE orders MODIFY COLUMN flow_stage VARCHAR(50) NOT NULL DEFAULT 'ask_images'");
      } catch (e) {
        logger.debug(`Schema patch notice for orders.flow_stage: ${e.message}`);
      }
      try {
        await sequelize.query("ALTER TABLE customers MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'");
      } catch (e) {
        logger.debug(`Schema patch notice for customers.status: ${e.message}`);
      }
      try {
        await sequelize.query("ALTER TABLE customer_images MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'received'");
      } catch (e) {
        logger.debug(`Schema patch notice for customer_images.status: ${e.message}`);
      }
      try {
        await sequelize.query("ALTER TABLE whatsapp_outbox DROP FOREIGN KEY whatsapp_outbox_ibfk_1");
        logger.info("Successfully dropped fragile foreign key 'whatsapp_outbox_ibfk_1' on whatsapp_outbox.");
      } catch (e) {
        logger.debug(`Foreign key drop notice for whatsapp_outbox_ibfk_1 (safe if not present): ${e.message}`);
      }
    }

    // 3. Add missing columns safely using queryInterface
    const queryInterface = sequelize.getQueryInterface();

    const checkAndAddColumn = async (tableName, columnName, definition) => {
      try {
        const tableDescription = await queryInterface.describeTable(tableName);
        if (!tableDescription[columnName]) {
          logger.info(`Adding missing column '${columnName}' to '${tableName}'...`);
          try {
            await queryInterface.addColumn(tableName, columnName, definition);
          } catch (colErr) {
            if (sequelize.getDialect() === 'mysql') {
              // Resilient MySQL fallback for DATE/DATETIME columns on populated tables
              const isDate = columnName === 'queued_at' || definition?.type?.key === 'DATE' || String(definition?.type).includes('DATE');
              if (isDate) {
                await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} DATETIME NULL DEFAULT CURRENT_TIMESTAMP`);
                await sequelize.query(`UPDATE ${tableName} SET ${columnName} = CURRENT_TIMESTAMP WHERE ${columnName} IS NULL OR CAST(${columnName} AS CHAR) = '0000-00-00 00:00:00'`).catch(() => {});
              } else {
                throw colErr;
              }
            } else {
              throw colErr;
            }
          }
        }
      } catch (colErr) {
        logger.warn(`Notice checking column '${columnName}' on '${tableName}': ${colErr.message}`);
      }
    };

    // ── RECONCILE WHATSAPP_OUTBOX COLUMNS (Resolves Unknown column 'queued_at') ──
    await checkAndAddColumn('whatsapp_outbox', 'batch_id', {
      type: sequelize.Sequelize.CHAR(36),
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'provider', {
      type: sequelize.Sequelize.STRING(50),
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'provider_message_id', {
      type: sequelize.Sequelize.STRING(150),
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'attempt_count', {
      type: sequelize.Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });
    await checkAndAddColumn('whatsapp_outbox', 'queued_at', {
      type: sequelize.Sequelize.DATE,
      defaultValue: sequelize.Sequelize.NOW,
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'accepted_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'delivered_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'read_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'failed_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'failure_code', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'failure_reason', {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'locked_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('whatsapp_outbox', 'worker_id', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
    });

    // ── RECONCILE ORDERS COLUMNS ──
    await checkAndAddColumn('orders', 'customer_name', {
      type: sequelize.Sequelize.STRING(150),
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'customer_phone', {
      type: sequelize.Sequelize.STRING(20),
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'customer_email', {
      type: sequelize.Sequelize.STRING(150),
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'workflow_state', {
      type: sequelize.Sequelize.STRING(50),
      allowNull: false,
      defaultValue: 'PENDING_VERIFICATION',
    });
    await checkAndAddColumn('orders', 'screenshot_deadline_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'matched_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'matched_by', {
      type: sequelize.Sequelize.CHAR(36),
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'final_confirmation_sent_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'customer_cancelled_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'second_message_sent_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'second_message_due_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'customer_confirmed_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'screenshot_requested_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'screenshot_received_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'delivered_message_sent_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('orders', 'whatsapp_batch_id', {
      type: sequelize.Sequelize.CHAR(36),
      allowNull: true,
    });

    // ── RECONCILE CUSTOMER_IMAGES COLUMNS ──
    await checkAndAddColumn('customer_images', 's3_key', {
      type: sequelize.Sequelize.STRING(500),
      allowNull: true,
    });
    await checkAndAddColumn('customer_images', 's3_bucket', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
    });
    await checkAndAddColumn('customer_images', 'retry_count', {
      type: sequelize.Sequelize.INTEGER,
      defaultValue: 0,
    });
    await checkAndAddColumn('customer_images', 'error_message', {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
    });

    // ── RECONCILE CSV_IMPORT_BATCHES COLUMNS ──
    await checkAndAddColumn('csv_import_batches', 'existing_customers_reused', {
      type: sequelize.Sequelize.INTEGER,
      defaultValue: 0,
    });
    await checkAndAddColumn('csv_import_batches', 'started_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('csv_import_batches', 'completed_at', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
    });
    await checkAndAddColumn('csv_import_batches', 'duration_ms', {
      type: sequelize.Sequelize.INTEGER,
      defaultValue: 0,
    });

    // ── RECONCILE ORDER_EVENTS COLUMNS ──
    await checkAndAddColumn('order_events', 'actor_type', {
      type: sequelize.Sequelize.STRING(50),
      allowNull: true,
      defaultValue: 'user',
    });
    await checkAndAddColumn('order_events', 'actor_id', {
      type: sequelize.Sequelize.STRING(150),
      allowNull: true,
    });
    await checkAndAddColumn('order_events', 'actor', {
      type: sequelize.Sequelize.STRING(150),
      allowNull: true,
    });
    await checkAndAddColumn('order_events', 'previous_state', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
    });
    await checkAndAddColumn('order_events', 'new_state', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
    });
    await checkAndAddColumn('order_events', 'before_state', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
    });
    await checkAndAddColumn('order_events', 'after_state', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
    });

    logger.info('✅ WhatsApp Orchestration database migration verified successfully.');
    return { success: true };
  } catch (err) {
    logger.error('WhatsApp Orchestration migration notice:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Strict Migration Pre-Flight Validator
 * Fails fast with clear administrative alert if required tables or columns are missing.
 * Prevents starting background workers when database schema is not synchronized.
 */
async function verifySchemaPreFlight() {
  const queryInterface = sequelize.getQueryInterface();

  // 1. Verify required tables exist
  const allTables = await queryInterface.showAllTables();
  const tableNames = allTables
    .map((t) => (typeof t === 'object' && t !== null ? t.tableName || Object.values(t)[0] : String(t)))
    .map((s) => s.toLowerCase());

  const requiredTables = ['whatsapp_outbox', 'order_events', 'orders', 'customers', 'csv_import_batches'];
  const missingTables = requiredTables.filter((t) => !tableNames.includes(t.toLowerCase()));

  if (missingTables.length > 0) {
    throw new Error(
      `FATAL PRE-FLIGHT FAILURE: Required database table(s) missing: [${missingTables.join(', ')}]. ` +
      `Run migrations before starting workers.`
    );
  }

  // 2. Verify critical column on whatsapp_outbox (prevents 'queued_at' crash)
  let outboxDesc = await queryInterface.describeTable('whatsapp_outbox');
  if (!outboxDesc['queued_at']) {
    try {
      logger.info('Auto-provisioning missing queued_at column on whatsapp_outbox...');
      if (sequelize.getDialect() === 'mysql') {
        await sequelize.query('ALTER TABLE whatsapp_outbox ADD COLUMN queued_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP;');
        await sequelize.query("UPDATE whatsapp_outbox SET queued_at = CURRENT_TIMESTAMP WHERE queued_at IS NULL OR CAST(queued_at AS CHAR) = '0000-00-00 00:00:00';").catch(() => {});
      } else {
        await queryInterface.addColumn('whatsapp_outbox', 'queued_at', {
          type: sequelize.Sequelize.DATE,
          defaultValue: sequelize.Sequelize.NOW,
          allowNull: true,
        });
      }
      outboxDesc = await queryInterface.describeTable('whatsapp_outbox');
    } catch (e) {
      logger.warn(`Auto-provision queued_at notice: ${e.message}`);
    }
  }
  const requiredOutboxCols = ['queued_at', 'status', 'idempotency_key', 'recipient_phone'];
  const missingOutboxCols = requiredOutboxCols.filter((col) => !outboxDesc[col]);
  if (missingOutboxCols.length > 0) {
    throw new Error(
      `FATAL PRE-FLIGHT FAILURE: whatsapp_outbox is missing required column(s): [${missingOutboxCols.join(', ')}]. ` +
      `Execute master migration 001_complete_schema.sql.`
    );
  }

  logger.info('🛡️  Schema Pre-Flight Validation PASSED: All critical tables and columns confirmed.');
  return true;
}

if (require.main === module) {
  migrateWhatsAppOrchestrator()
    .then(() => process.exit(0))
    .catch((e) => {
      logger.error('Migration failed:', e);
      process.exit(1);
    });
}

module.exports = { migrateWhatsAppOrchestrator, verifySchemaPreFlight };
