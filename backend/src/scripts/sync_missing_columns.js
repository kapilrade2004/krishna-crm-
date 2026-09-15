'use strict';

require('dotenv').config({ override: false });
const models = require('../models');
const { sequelize } = require('../config/database');

async function syncMissingColumns() {
  console.log('🔄 Checking database tables for missing model columns...');
  const isSQLite = sequelize.getDialect() === 'sqlite';

  const allModels = [
    models.User,
    models.Customer,
    models.Order,
    models.OrderEvent,
    models.FollowUp,
    models.Task,
    models.CsvImportBatch,
    models.WhatsAppLog,
    models.ManualCallLog,
    models.CustomerImage,
    models.ShippingPartner,
    models.PincodeServiceability,
    models.Employee,
    models.EmployeeDocument,
    models.Role,
    models.Permission,
    models.RolePermission,
    models.UserPermission,
    models.DailyTask,
    models.DailyTaskHistory,
    models.DailyActivity,
    models.DailyActivityHistory,
    models.EmployeeAuditEvent,
    models.EmployeeAuditDailySummary,
    models.Warranty,
    models.WarrantyDocument,
    models.WarrantyServiceRequest,
    models.WarrantyEvent,
    models.WarrantyReturn,
    models.WarrantyMessage,
    models.WhatsAppOutbox,
    models.WhatsAppBatch,
    models.WhatsAppRateLimitEvent,
    models.LoginHistory,
    models.UserAuditLog,
    models.AccessTemplate,
    models.AccessRequest,
    models.PayrollProfile,
    models.PayrollRecord,
    models.BiometricDevice,
    models.EmployeeBiometricMapping,
    models.BiometricPunchEvent,
    models.AttendanceShift,
    models.AttendanceDay,
    models.AttendanceSegment,
    models.AttendanceCorrection,
    models.IntegrationSyncState,
    models.AttendanceAuditLog,
    models.ProductReview,
    models.SystemSetting,
    models.AccountingRecord,
    models.ChequeCollection,
    models.AdCampaignMetric,
    models.KeywordMetric,
    models.ReturnClaim,
    models.ResetAuditLog,
  ];

  for (const model of allModels) {
    if (!model || !model.tableName || !model.rawAttributes) continue;

    try {
      let existingCols = [];
      if (isSQLite) {
        const [rows] = await sequelize.query(`PRAGMA table_info(${model.tableName})`);
        existingCols = rows.map((r) => r.name);
      } else {
        const tableInfo = await sequelize.getQueryInterface().describeTable(model.tableName);
        existingCols = Object.keys(tableInfo);
      }

      if (existingCols.length === 0) {
        await model.sync();
        console.log(`  ✅ Table '${model.tableName}' synced.`);
        continue;
      }

      for (const [attrName, attrDef] of Object.entries(model.rawAttributes)) {
        const colName = attrDef.field || attrName;
        if (!existingCols.includes(colName)) {
          console.log(`➕ Adding missing column '${colName}' to table '${model.tableName}'...`);
          try {
            if (isSQLite) {
              await sequelize.query(`ALTER TABLE ${model.tableName} ADD COLUMN ${colName} TEXT`);
            } else {
              try {
                await sequelize.getQueryInterface().addColumn(model.tableName, colName, {
                  type: attrDef.type,
                  allowNull: colName === 'queued_at' ? true : (attrDef.allowNull !== false),
                  defaultValue: attrDef.defaultValue,
                });
              } catch (addErr) {
                const isDate = colName === 'queued_at' || attrDef?.type?.key === 'DATE' || String(attrDef?.type).includes('DATE');
                if (isDate) {
                  await sequelize.query(`ALTER TABLE ${model.tableName} ADD COLUMN ${colName} DATETIME NULL DEFAULT CURRENT_TIMESTAMP`);
                  await sequelize.query(`UPDATE ${model.tableName} SET ${colName} = CURRENT_TIMESTAMP WHERE ${colName} IS NULL OR CAST(${colName} AS CHAR) = '0000-00-00 00:00:00'`).catch(() => {});
                } else {
                  throw addErr;
                }
              }
            }
            console.log(`  ✅ Added column '${colName}' successfully.`);
          } catch (colErr) {
            console.warn(`  ⚠️ Could not add '${colName}' to '${model.tableName}': ${colErr.message}`);
          }
        }
      }
    } catch (err) {
      console.warn(`Notice for table ${model?.tableName}: ${err.message}`);
      try {
        await model.sync();
      } catch (syncErr) {
        console.warn(`  ⚠️ Could not sync '${model?.tableName}': ${syncErr.message}`);
      }
    }
  }

  // Ensure critical MySQL ENUM columns are up-to-date with model definitions
  if (!isSQLite) {
    try {
      await sequelize.query(
        "ALTER TABLE orders MODIFY COLUMN verification_status ENUM('pending_verification', 'screenshot_requested', 'image_received', 'verification_in_review', 'sku_matched', 'sku_mismatched', 'image_unreadable', 'product_not_found', 'pending_confirmation', 'confirmed', 'cancelled', 'verification_exception', 'call_representative_requested') NOT NULL DEFAULT 'pending_verification'"
      );
    } catch (e) {
      console.warn(`  ⚠️ Could not update verification_status ENUM on orders: ${e.message}`);
    }

    try {
      await sequelize.query(
        "ALTER TABLE orders MODIFY COLUMN customer_id CHAR(36) NULL"
      );
      console.log('  ✅ orders.customer_id relaxed to NULL for pre-delivery lifecycle.');
    } catch (e) {
      console.warn(`  ⚠️ Could not alter customer_id on orders: ${e.message}`);
    }

    // Guarantee whatsapp_batches table exists independently of FK constraints
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_batches (
          id CHAR(36) NOT NULL,
          batch_id VARCHAR(64) NOT NULL,
          import_batch_id CHAR(36) NULL,
          batch_index INT NOT NULL DEFAULT 1,
          total_batches INT NOT NULL DEFAULT 1,
          customer_count INT NOT NULL DEFAULT 0,
          message_count INT NOT NULL DEFAULT 0,
          order_range_start VARCHAR(100) NULL,
          order_range_end VARCHAR(100) NULL,
          status ENUM('CREATED','READY','AWAITING_CONFIRMATION','QUEUED','PROCESSING','COMPLETED','PARTIALLY_FAILED','FAILED','PAUSED','CANCELLED') NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
          estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          actual_cost DECIMAL(10,2) NULL,
          reserved_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          estimated_duration_seconds INT NOT NULL DEFAULT 0,
          estimated_duration_text VARCHAR(100) NULL,
          sent_count INT NOT NULL DEFAULT 0,
          failed_count INT NOT NULL DEFAULT 0,
          cancelled_count INT NOT NULL DEFAULT 0,
          paused_count INT NOT NULL DEFAULT 0,
          confirmed_by CHAR(36) NULL,
          confirmed_at DATETIME NULL,
          started_at DATETIME NULL,
          completed_at DATETIME NULL,
          idempotency_key VARCHAR(150) NULL,
          metadata JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_wb_batch_id (batch_id),
          UNIQUE KEY uk_wb_idempotency_key (idempotency_key),
          KEY idx_wb_import_batch (import_batch_id),
          KEY idx_wb_status (status),
          KEY idx_wb_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('  ✅ Table whatsapp_batches verified/created successfully.');
    } catch (e) {
      console.warn(`  ⚠️ Could not ensure whatsapp_batches table: ${e.message}`);
    }
  }

  console.log('✅ Missing columns check completed.');
}

if (require.main === module) {
  syncMissingColumns()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Column sync failed:', err);
      process.exit(1);
    });
}

module.exports = syncMissingColumns;
