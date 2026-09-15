'use strict';

/**
 * Read-Only Database Health & Content Diagnostic Tool
 * 
 * Safely inspects connection health, pool state, table counts,
 * storage sizes, and recent content without requiring MySQL root or SUPER privileges.
 */

const { sequelize, User, Customer, Order, CsvImportBatch, Employee, WhatsAppOutbox } = require('../models');

async function runDbHealthCheck() {
  const startTime = Date.now();
  console.log('===============================================================');
  console.log('       KRISHNA-CRM DATABASE HEALTH & CONTENT DIAGNOSTIC        ');
  console.log('===============================================================\n');

  try {
    // 1. Connection Ping & Latency Check
    process.stdout.write('1. Testing database connectivity & round-trip latency... ');
    const pingStart = Date.now();
    await sequelize.authenticate();
    const pingLatency = Date.now() - pingStart;
    console.log(`✅ CONNECTED (${pingLatency} ms)`);

    // 2. Database & Server Metadata
    console.log('\n2. Database Metadata:');
    const [metaRows] = await sequelize.query('SELECT DATABASE() AS db_name, VERSION() AS mysql_version, NOW() AS server_time;');
    const meta = metaRows[0] || {};
    console.log(`   • Database Name  : ${meta.db_name}`);
    console.log(`   • MySQL Version  : ${meta.mysql_version}`);
    console.log(`   • Server Time    : ${meta.server_time}`);
    console.log(`   • Dialect        : ${sequelize.getDialect()}`);

    // Pool details
    const pool = sequelize.connectionManager.pool;
    if (pool) {
      console.log(`   • Connection Pool: Max ${pool.max || 'N/A'}, Min ${pool.min || 'N/A'}, Size: ${pool.size || 0}, Available: ${pool.available || 0}, Using: ${pool.using || 0}`);
    }

    // 3. Table Inventory & Storage Footprint (via standard information_schema)
    console.log('\n3. Table Row Counts & Approximate Storage Sizes:');
    const [tableSizes] = await sequelize.query(`
      SELECT 
        table_name AS tableName,
        table_rows AS approxRows,
        ROUND((data_length + index_length) / 1024 / 1024, 2) AS sizeMB
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY (data_length + index_length) DESC;
    `);

    if (tableSizes.length === 0) {
      console.log('   ⚠️ No tables found in current schema.');
    } else {
      console.log('   ------------------------------------------------------------');
      console.log('   Table Name                       | Est. Rows | Size (MB)   ');
      console.log('   ------------------------------------------------------------');
      tableSizes.forEach((t) => {
        const namePad = String(t.tableName).padEnd(32, ' ');
        const rowsPad = String(t.approxRows ?? '0').padStart(9, ' ');
        const sizePad = String(t.sizeMB ?? '0.00').padStart(9, ' ');
        console.log(`   ${namePad} | ${rowsPad} | ${sizePad} MB`);
      });
      console.log('   ------------------------------------------------------------');
    }

    // 4. Exact Content Counts for Core CRM Entities
    console.log('\n4. Exact Content Counts for Core Entities:');
    const counts = await Promise.allSettled([
      User.count().then(c => ({ entity: 'Users (Staff/Admins)', count: c })),
      Employee.count().then(c => ({ entity: 'Employees (Directory)', count: c })),
      Customer.count().then(c => ({ entity: 'Customers', count: c })),
      Order.count().then(c => ({ entity: 'Orders (Total)', count: c })),
      Order.count({ where: { verification_status: 'pending_verification' } }).then(c => ({ entity: '  ↳ Pending Verification', count: c })),
      Order.count({ where: { verification_status: 'verification_exception' } }).then(c => ({ entity: '  ↳ Verification Exceptions', count: c })),
      Order.count({ where: { status: 'confirmed' } }).then(c => ({ entity: '  ↳ Confirmed Orders', count: c })),
      CsvImportBatch.count().then(c => ({ entity: 'CSV/Excel Import Batches', count: c })),
      WhatsAppOutbox ? WhatsAppOutbox.count().then(c => ({ entity: 'WhatsApp Outbox Messages', count: c })) : Promise.resolve(null),
    ]);

    counts.forEach((res) => {
      if (res.status === 'fulfilled' && res.value) {
        console.log(`   • ${res.value.entity.padEnd(28, ' ')}: ${res.value.count}`);
      }
    });

    // 5. Recent Content Preview (Top 3 Orders & Batches)
    console.log('\n5. Recent Content Sample:');
    const recentOrders = await Order.findAll({
      attributes: ['order_number', 'marketplace', 'channel', 'customer_name', 'customer_phone', 'total_amount', 'status', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 3,
    });

    if (recentOrders.length === 0) {
      console.log('   (No orders recorded in database yet)');
    } else {
      console.log('   Latest 3 Orders:');
      recentOrders.forEach((o, i) => {
        console.log(`     [${i + 1}] Order #${o.order_number} | Channel: ${o.channel || o.marketplace} | Buyer: ${o.customer_name} | Phone: ${o.customer_phone || 'None'} | Amount: ₹${o.total_amount || 0} | Status: ${o.status}`);
      });
    }

    const recentBatches = await CsvImportBatch.findAll({
      attributes: ['id', 'filename', 'marketplace', 'channel', 'status', 'total_rows', 'success_rows', 'failed_rows', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 2,
    });
    if (recentBatches.length > 0) {
      console.log('\n   Latest 2 Import Batches:');
      recentBatches.forEach((b, i) => {
        console.log(`     [${i + 1}] File: ${b.filename} (${b.channel || b.marketplace}) | Status: ${b.status} | Total: ${b.total_rows} | Success: ${b.success_rows} | Failed: ${b.failed_rows}`);
      });
    }

    // 6. Final Health Summary
    const totalElapsed = Date.now() - startTime;
    console.log('\n===============================================================');
    console.log(`HEALTH STATUS: ✅ HEALTHY (Checked in ${totalElapsed} ms)`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('\n❌ DATABASE HEALTH CHECK FAILED:');
    console.error('Error Code   :', err.original?.code || err.name);
    console.error('Error Message:', err.message);
    if (err.original?.sqlMessage) {
      console.error('SQL Message  :', err.original.sqlMessage);
    }
  } finally {
    process.exit(0);
  }
}

runDbHealthCheck();
