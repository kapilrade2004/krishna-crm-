'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  WhatsAppLog,
  WhatsAppOutbox,
  WhatsAppBatch,
  CsvImportBatch,
  Customer,
  Order,
  SystemSetting,
} = require('../models');
const emergencyPauseService = require('./emergencyPauseService');
const logger = require('../config/logger');

// ─── IST Date Utilities (UTC+05:30) ──────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30 in milliseconds

/**
 * Returns Date objects representing the start and end of an IST period in UTC.
 */
function resolveIstDateRange(preset, customStart, customEnd) {
  const nowUtc = new Date();
  const nowIst = new Date(nowUtc.getTime() + IST_OFFSET_MS);

  // Helper to construct UTC Date from IST year, month (0-based), day, hr, min, sec, ms
  const istToUtc = (year, month, day, hour = 0, minute = 0, second = 0, ms = 0) => {
    // Treat as UTC then subtract offset
    const utcTimestamp = Date.UTC(year, month, day, hour, minute, second, ms) - IST_OFFSET_MS;
    return new Date(utcTimestamp);
  };

  const y = nowIst.getUTCFullYear();
  const m = nowIst.getUTCMonth();
  const d = nowIst.getUTCDate();

  switch ((preset || '').toUpperCase()) {
    case 'TODAY':
      return {
        startDate: istToUtc(y, m, d, 0, 0, 0, 0),
        endDate: istToUtc(y, m, d, 23, 59, 59, 999),
        label: 'Today',
      };

    case 'YESTERDAY':
      return {
        startDate: istToUtc(y, m, d - 1, 0, 0, 0, 0),
        endDate: istToUtc(y, m, d - 1, 23, 59, 59, 999),
        label: 'Yesterday',
      };

    case 'LAST_7_DAYS':
      return {
        startDate: istToUtc(y, m, d - 6, 0, 0, 0, 0),
        endDate: istToUtc(y, m, d, 23, 59, 59, 999),
        label: 'Last 7 Days',
      };

    case 'LAST_30_DAYS':
      return {
        startDate: istToUtc(y, m, d - 29, 0, 0, 0, 0),
        endDate: istToUtc(y, m, d, 23, 59, 59, 999),
        label: 'Last 30 Days',
      };

    case 'THIS_MONTH':
      return {
        startDate: istToUtc(y, m, 1, 0, 0, 0, 0),
        endDate: istToUtc(y, m, d, 23, 59, 59, 999),
        label: 'This Month',
      };

    case 'LAST_MONTH': {
      const prevMonthLastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return {
        startDate: istToUtc(y, m - 1, 1, 0, 0, 0, 0),
        endDate: istToUtc(y, m - 1, prevMonthLastDay, 23, 59, 59, 999),
        label: 'Last Month',
      };
    }

    case 'CUSTOM':
    default:
      if (customStart && customEnd) {
        const [sy, sm, sd] = customStart.split('-').map(Number);
        const [ey, em, ed] = customEnd.split('-').map(Number);
        return {
          startDate: istToUtc(sy, sm - 1, sd, 0, 0, 0, 0),
          endDate: istToUtc(ey, em - 1, ed, 23, 59, 59, 999),
          label: `${customStart} to ${customEnd}`,
        };
      }
      // Fallback: Last 30 Days
      return {
        startDate: istToUtc(y, m, d - 29, 0, 0, 0, 0),
        endDate: istToUtc(y, m, d, 23, 59, 59, 999),
        label: 'Last 30 Days',
      };
  }
}

/**
 * Returns SQL expression for converting UTC datetime to IST Date string (YYYY-MM-DD)
 */
function getIstDateSql(columnName = 'sent_at') {
  const isMySQL = sequelize.getDialect() === 'mysql';
  if (isMySQL) {
    return `DATE(CONVERT_TZ(COALESCE(${columnName}, created_at), '+00:00', '+05:30'))`;
  }
  // SQLite fallback
  return `DATE(DATETIME(COALESCE(${columnName}, created_at), '+330 minutes'))`;
}

/**
 * Get active estimated cost rate per message from system_settings
 */
async function getEstimatedRate() {
  try {
    const setting = await SystemSetting.findOne({
      where: { key: 'WHATSAPP_ESTIMATED_RATE_PER_MESSAGE' },
    });
    if (setting && !isNaN(parseFloat(setting.value))) {
      return parseFloat(setting.value);
    }
  } catch (_) {}
  return 0.35; // Default ₹0.35 in India (Vasify AOC Utility Rate)
}

// ─── 1. Summary Metrics ───────────────────────────────────────────────────────

/**
 * High-level audit summary KPIs for the selected filters
 */
async function getAuditSummary({ preset, startDate: customStart, endDate: customEnd, template, batchId }) {
  const { startDate, endDate, label } = resolveIstDateRange(preset, customStart, customEnd);
  const estimatedRate = await getEstimatedRate();

  const whereLog = {
    [Op.or]: [
      { sent_at: { [Op.between]: [startDate, endDate] } },
      {
        sent_at: null,
        created_at: { [Op.between]: [startDate, endDate] },
      },
    ],
  };

  if (template) whereLog.template_name = template;
  if (batchId) whereLog.batch_id = batchId;

  // Query counts grouped by status on whatsapp_logs
  const logCounts = await WhatsAppLog.findAll({
    where: whereLog,
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('estimated_cost')), 'total_estimated_cost'],
      [sequelize.fn('SUM', sequelize.col('actual_cost')), 'total_actual_cost'],
      [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('phone_number'))), 'unique_recipients'],
    ],
    group: ['status'],
    raw: true,
  });

  let sentOnly = 0;
  let deliveredCount = 0;
  let readCount = 0;
  let failedCount = 0;
  let queuedCount = 0;
  let pausedCount = 0;
  let totalEstimatedCost = 0;
  let totalActualCost = 0;
  let hasActualCostRecords = false;

  for (const row of logCounts) {
    const count = parseInt(row.count, 10) || 0;
    const estCost = parseFloat(row.total_estimated_cost) || 0;
    const actCost = row.total_actual_cost !== null ? parseFloat(row.total_actual_cost) : null;

    totalEstimatedCost += estCost;
    if (actCost !== null && actCost > 0) {
      totalActualCost += actCost;
      hasActualCostRecords = true;
    }

    switch (row.status) {
      case 'sent':
        sentOnly += count;
        break;
      case 'delivered':
        deliveredCount += count;
        break;
      case 'read':
        readCount += count;
        break;
      case 'failed':
        failedCount += count;
        break;
      case 'queued':
        queuedCount += count;
        break;
      case 'paused':
        pausedCount += count;
        break;
      default:
        break;
    }
  }

  // Total confirmed dispatched = SENT + DELIVERED + READ
  const totalSent = sentOnly + deliveredCount + readCount;

  // Fallback estimation if logs lacked estimated_cost column values
  if (totalEstimatedCost === 0 && totalSent > 0) {
    totalEstimatedCost = Number((totalSent * estimatedRate).toFixed(2));
  }

  // Also inspect whatsapp_outbox for real-time queue states (pending, processing, cancelled)
  const whereOutbox = {
    created_at: { [Op.between]: [startDate, endDate] },
  };
  if (batchId) whereOutbox.batch_id = batchId;
  if (template) whereOutbox.template_name = template;

  const outboxCounts = await WhatsAppOutbox.findAll({
    where: whereOutbox,
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['status'],
    raw: true,
  }).catch(() => []);

  let pendingCount = 0;
  let processingCount = 0;
  let cancelledCount = 0;

  for (const row of outboxCounts) {
    const count = parseInt(row.count, 10) || 0;
    if (row.status === 'pending') pendingCount += count;
    else if (row.status === 'processing') processingCount += count;
    else if (row.status === 'cancelled') cancelledCount += count;
    else if (row.status === 'paused') pausedCount += count;
  }

  // Distinct phone count across the range
  const uniqueRecipients = await WhatsAppLog.count({
    where: whereLog,
    distinct: true,
    col: 'phone_number',
  }).catch(() => 0);

  // Delivery & Read rates
  const deliveryRate = totalSent > 0 ? Number(((deliveredCount + readCount) / totalSent * 100).toFixed(1)) : 0;
  const readRate = totalSent > 0 ? Number((readCount / totalSent * 100).toFixed(1)) : 0;
  const totalAttempted = totalSent + failedCount;
  const failureRate = totalAttempted > 0 ? Number((failedCount / totalAttempted * 100).toFixed(1)) : 0;

  // Authoritative kill switch status
  const sendingStatus = await emergencyPauseService.getSendingStatus();

  return {
    period: {
      preset: preset || 'LAST_30_DAYS',
      start_date_ist: startDate.toISOString(),
      end_date_ist: endDate.toISOString(),
      start_date_utc: startDate.toISOString(),
      end_date_utc: endDate.toISOString(),
      timezone: 'Asia/Kolkata (IST)',
      label,
    },
    date_range: {
      preset: preset || 'LAST_30_DAYS',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      label,
    },
    system_status: {
      whatsapp_sending_enabled: sendingStatus.whatsapp_sending_enabled,
      status_text: sendingStatus.status,
      paused_at: sendingStatus.paused_at,
      paused_by: sendingStatus.paused_by,
      pause_reason: sendingStatus.reason,
    },
    metrics: {
      total_messages_processed: totalSent + failedCount + queuedCount + pendingCount + processingCount,
      total_sent: totalSent,
      sent_awaiting_delivery: sentOnly,
      delivered: deliveredCount,
      delivered_count: deliveredCount,
      read: readCount,
      read_count: readCount,
      failed: failedCount,
      failed_count: failedCount,
      queued: queuedCount,
      queued_count: queuedCount,
      pending: pendingCount,
      pending_count: pendingCount,
      processing: processingCount,
      processing_count: processingCount,
      paused: pausedCount,
      paused_count: pausedCount,
      cancelled: cancelledCount,
      cancelled_count: cancelledCount,
      total_unique_recipients: uniqueRecipients,
      delivery_rate_pct: deliveryRate,
      delivery_rate_percent: deliveryRate,
      read_rate_pct: readRate,
      read_rate_percent: readRate,
      failure_rate_pct: failureRate,
      failure_rate_percent: failureRate,
    },
    costs: {
      estimated_cost_inr: Number(totalEstimatedCost.toFixed(2)),
      actual_cost_inr: hasActualCostRecords ? Number(totalActualCost.toFixed(2)) : null,
      actual_cost_display: hasActualCostRecords ? `₹${Number(totalActualCost.toFixed(2)).toFixed(2)}` : 'UNAVAILABLE',
      currency: 'INR',
      per_message_rate_estimated: estimatedRate,
      cost_status_note: hasActualCostRecords
        ? 'Derived from recorded provider invoices'
        : 'Actual cost is unavailable from Meta API response/webhooks. Billed post-paid via Meta Business Manager.',
    },
    cost: {
      estimated_rate_per_message: estimatedRate,
      total_estimated_cost: Number(totalEstimatedCost.toFixed(2)),
      total_actual_cost: hasActualCostRecords ? Number(totalActualCost.toFixed(2)) : null,
      actual_cost_status: hasActualCostRecords ? 'VERIFIED' : 'UNAVAILABLE',
      actual_cost_note: hasActualCostRecords
        ? 'Derived from recorded provider invoices'
        : 'Actual cost is unavailable from Meta API response/webhooks. Billed post-paid via Meta Business Manager.',
      currency: 'INR',
      provider_balance: {
        amount: null,
        status: 'BALANCE UNAVAILABLE',
        note: 'Meta WhatsApp Cloud API operates on post-paid credit lines. Real-time balance queries are not supported by the Meta Graph API.',
      },
    },
    provider_account: {
      provider_name: 'Vasify AOC / Meta WhatsApp Cloud API',
      account_status: 'ACTIVE',
      balance_amount: null,
      balance_currency: 'INR',
      balance_display: 'BALANCE UNAVAILABLE',
      balance_note: 'Meta WhatsApp Cloud API operates on post-paid credit lines. Real-time balance queries are not supported by the Meta Graph API.',
    },
  };
}

// ─── 2. Daily Message Report (IST Grouped) ───────────────────────────────────

/**
 * Server-side aggregated daily breakdown in IST (+05:30)
 */
async function getDailyMessageReport({ preset, startDate: customStart, endDate: customEnd, template, batchId }) {
  const { startDate, endDate, label } = resolveIstDateRange(preset, customStart, customEnd);
  const estimatedRate = await getEstimatedRate();
  const istDateExpr = getIstDateSql('sent_at');

  const whereLog = {
    [Op.or]: [
      { sent_at: { [Op.between]: [startDate, endDate] } },
      {
        sent_at: null,
        created_at: { [Op.between]: [startDate, endDate] },
      },
    ],
  };

  if (template) whereLog.template_name = template;
  if (batchId) whereLog.batch_id = batchId;

  // SQL aggregation grouped by IST date and status
  const rows = await WhatsAppLog.findAll({
    where: whereLog,
    attributes: [
      [sequelize.literal(istDateExpr), 'report_date'],
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'status_count'],
      [sequelize.fn('SUM', sequelize.col('estimated_cost')), 'est_cost'],
      [sequelize.fn('SUM', sequelize.col('actual_cost')), 'act_cost'],
    ],
    group: [sequelize.literal(istDateExpr), 'status'],
    order: [[sequelize.literal(istDateExpr), 'ASC']],
    raw: true,
  });

  // Group by date in memory for clean presentation
  const dateMap = new Map();

  for (const row of rows) {
    const d = row.report_date;
    if (!d) continue;
    if (!dateMap.has(d)) {
      dateMap.set(d, {
        date: d,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        queued: 0,
        paused: 0,
        total_sent: 0,
        estimated_cost: 0,
        actual_cost: null,
        has_actual_cost: false,
      });
    }

    const entry = dateMap.get(d);
    const count = parseInt(row.status_count, 10) || 0;
    const est = parseFloat(row.est_cost) || 0;
    const act = row.act_cost !== null ? parseFloat(row.act_cost) : null;

    entry.estimated_cost += est;
    if (act !== null && act > 0) {
      entry.actual_cost = (entry.actual_cost || 0) + act;
      entry.has_actual_cost = true;
    }

    if (row.status === 'sent') {
      entry.sent += count;
      entry.total_sent += count;
    } else if (row.status === 'delivered') {
      entry.delivered += count;
      entry.total_sent += count;
    } else if (row.status === 'read') {
      entry.read += count;
      entry.total_sent += count;
    } else if (row.status === 'failed') {
      entry.failed += count;
    } else if (row.status === 'queued') {
      entry.queued += count;
    } else if (row.status === 'paused') {
      entry.paused += count;
    }
  }

  // Format list and calculate cost fallbacks
  const dailyData = Array.from(dateMap.values()).map(item => {
    const finalEst = item.estimated_cost > 0
      ? Number(item.estimated_cost.toFixed(2))
      : Number((item.total_sent * estimatedRate).toFixed(2));
    const finalAct = item.has_actual_cost ? Number(item.actual_cost.toFixed(2)) : null;

    return {
      date: item.date,
      total_sent: item.total_sent,
      sent_awaiting_delivery: item.sent,
      delivered: item.delivered,
      read: item.read,
      failed: item.failed,
      queued: item.queued,
      paused: item.paused,
      estimated_cost: finalEst,
      actual_cost: finalAct,
      actual_cost_display: finalAct !== null ? `₹${finalAct.toFixed(2)}` : 'UNAVAILABLE',
      delivery_rate: item.total_sent > 0 ? Number(((item.delivered + item.read) / item.total_sent * 100).toFixed(1)) : 0,
      read_rate: item.total_sent > 0 ? Number((item.read / item.total_sent * 100).toFixed(1)) : 0,
    };
  });

  return {
    label,
    days_count: dailyData.length,
    daily_report: dailyData,
  };
}

// ─── 3. Cost by Template ──────────────────────────────────────────────────────

/**
 * Breakdown of messages and costs grouped by template name
 */
async function getCostByTemplate({ preset, startDate: customStart, endDate: customEnd }) {
  const { startDate, endDate } = resolveIstDateRange(preset, customStart, customEnd);
  const estimatedRate = await getEstimatedRate();

  const rows = await WhatsAppLog.findAll({
    where: {
      [Op.or]: [
        { sent_at: { [Op.between]: [startDate, endDate] } },
        {
          sent_at: null,
          created_at: { [Op.between]: [startDate, endDate] },
        },
      ],
    },
    attributes: [
      'template_name',
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('estimated_cost')), 'est_cost'],
      [sequelize.fn('SUM', sequelize.col('actual_cost')), 'act_cost'],
    ],
    group: ['template_name', 'status'],
    raw: true,
  });

  const templateMap = new Map();

  for (const row of rows) {
    const tpl = row.template_name || '(Custom Text / Interactive)';
    if (!templateMap.has(tpl)) {
      templateMap.set(tpl, {
        template_name: tpl,
        total_sent: 0,
        sent_awaiting_delivery: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        queued: 0,
        estimated_cost: 0,
        actual_cost: null,
        has_actual_cost: false,
      });
    }

    const entry = templateMap.get(tpl);
    const count = parseInt(row.count, 10) || 0;
    const est = parseFloat(row.est_cost) || 0;
    const act = row.act_cost !== null ? parseFloat(row.act_cost) : null;

    entry.estimated_cost += est;
    if (act !== null && act > 0) {
      entry.actual_cost = (entry.actual_cost || 0) + act;
      entry.has_actual_cost = true;
    }

    if (row.status === 'sent') {
      entry.sent_awaiting_delivery += count;
      entry.total_sent += count;
    } else if (row.status === 'delivered') {
      entry.delivered += count;
      entry.total_sent += count;
    } else if (row.status === 'read') {
      entry.read += count;
      entry.total_sent += count;
    } else if (row.status === 'failed') {
      entry.failed += count;
    } else if (row.status === 'queued') {
      entry.queued += count;
    }
  }

  const templates = Array.from(templateMap.values()).map(t => {
    const est = t.estimated_cost > 0 ? Number(t.estimated_cost.toFixed(2)) : Number((t.total_sent * estimatedRate).toFixed(2));
    const act = t.has_actual_cost ? Number(t.actual_cost.toFixed(2)) : null;

    return {
      template_name: t.template_name,
      total_sent: t.total_sent,
      sent_awaiting_delivery: t.sent_awaiting_delivery,
      delivered: t.delivered,
      read: t.read,
      failed: t.failed,
      queued: t.queued,
      delivery_rate: t.total_sent > 0 ? Number(((t.delivered + t.read) / t.total_sent * 100).toFixed(1)) : 0,
      read_rate: t.total_sent > 0 ? Number((t.read / t.total_sent * 100).toFixed(1)) : 0,
      estimated_cost: est,
      actual_cost: act,
      actual_cost_display: act !== null ? `₹${act.toFixed(2)}` : 'UNAVAILABLE',
    };
  });

  templates.sort((a, b) => b.total_sent - a.total_sent);

  return {
    template_count: templates.length,
    templates,
  };
}

// ─── 4. Cost by Batch ─────────────────────────────────────────────────────────

/**
 * Breakdown of batches, order ranges, customer counts, and costs
 */
async function getCostByBatch({ preset, startDate: customStart, endDate: customEnd, page = 1, limit = 20 }) {
  try {
    const { startDate, endDate } = resolveIstDateRange(preset, customStart, customEnd);
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const { count, rows } = await WhatsAppBatch.findAndCountAll({
      where: {
        created_at: { [Op.between]: [startDate, endDate] },
      },
      include: [
        {
          model: CsvImportBatch,
          as: 'importBatch',
          attributes: ['id', 'filename', 'created_at'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
      limit: take,
      offset,
    });

    const batches = (rows || []).map(b => ({
      id: b.id,
      batch_id: b.batch_id,
      batch_index: b.batch_index,
      total_batches: b.total_batches,
      customer_count: b.customer_count,
      message_count: b.message_count,
      order_range: b.order_range_start && b.order_range_end ? `${b.order_range_start} - ${b.order_range_end}` : 'N/A',
      status: b.status,
      sent_count: b.sent_count || 0,
      failed_count: b.failed_count || 0,
      cancelled_count: b.cancelled_count || 0,
      paused_count: b.paused_count || 0,
      estimated_cost: parseFloat(b.estimated_cost) || 0,
      actual_cost: b.actual_cost !== null ? parseFloat(b.actual_cost) : null,
      actual_cost_display: b.actual_cost !== null ? `₹${parseFloat(b.actual_cost).toFixed(2)}` : 'UNAVAILABLE',
      import_filename: b.importBatch?.filename || 'Direct Upload',
      created_at: b.createdAt || b.created_at,
      confirmed_at: b.confirmed_at,
      started_at: b.started_at,
      completed_at: b.completed_at,
    }));

    return {
      total_batches: count || 0,
      page: parseInt(page, 10),
      limit: take,
      total_pages: Math.ceil((count || 0) / take),
      batches,
    };
  } catch (err) {
    logger.error('Error in getCostByBatch:', err);
    return {
      total_batches: 0,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      total_pages: 0,
      batches: [],
    };
  }
}

// ─── 5. Message Audit List & Search ───────────────────────────────────────────

/**
 * Paginated and searchable message-level audit log
 */
async function getMessageList({
  page = 1,
  limit = 25,
  search = '',
  status = '',
  template = '',
  batchId = '',
  preset,
  startDate: customStart,
  endDate: customEnd,
  sort = 'created_at',
  order = 'DESC',
}) {
  try {
    const { startDate, endDate } = resolveIstDateRange(preset, customStart, customEnd);
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where = {
      [Op.or]: [
        { sent_at: { [Op.between]: [startDate, endDate] } },
        {
          sent_at: null,
          created_at: { [Op.between]: [startDate, endDate] },
        },
      ],
    };

    if (status) where.status = status;
    if (template) where.template_name = template;
    if (batchId) where.batch_id = batchId;

    // Search filter
    if (search && search.trim()) {
      const q = search.trim();
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { phone_number: { [Op.like]: `%${q}%` } },
            { wa_message_id: { [Op.like]: `%${q}%` } },
            { template_name: { [Op.like]: `%${q}%` } },
            { '$customer.name$': { [Op.like]: `%${q}%` } },
            { '$order.order_number$': { [Op.like]: `%${q}%` } },
          ],
        },
      ];
    }

    const allowedSortCols = ['created_at', 'sent_at', 'delivered_at', 'read_at', 'status', 'phone_number'];
    const safeSort = allowedSortCols.includes(sort) ? sort : 'created_at';
    const safeOrder = (order || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows } = await WhatsAppLog.findAndCountAll({
      where,
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'phone', 'city'],
          required: false,
        },
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'order_number', 'status', 'total_amount'],
          required: false,
        },
        {
          model: WhatsAppBatch,
          as: 'batch',
          attributes: ['id', 'batch_id', 'status'],
          required: false,
        },
      ],
      order: [[safeSort, safeOrder]],
      limit: take,
      offset,
    });

    const messages = (rows || []).map(m => ({
      id: m.id,
      wa_message_id: m.wa_message_id,
      phone_number: m.phone_number,
      direction: m.direction,
      message_type: m.message_type,
      template_name: m.template_name,
      status: m.status,
      created_at: m.createdAt || m.created_at,
      sent_at: m.sent_at,
      delivered_at: m.delivered_at,
      read_at: m.read_at,
      failed_at: m.failed_at,
      retry_count: m.retry_count || 0,
      estimated_cost: parseFloat(m.estimated_cost) || 0,
      actual_cost: m.actual_cost !== null ? parseFloat(m.actual_cost) : null,
      actual_cost_display: m.actual_cost !== null ? `₹${parseFloat(m.actual_cost).toFixed(2)}` : 'UNAVAILABLE',
      error_message: m.error_message,
      customer: m.customer ? {
        id: m.customer.id,
        name: m.customer.name || 'Unnamed',
        phone: m.customer.phone,
        city: m.customer.city,
      } : null,
      order: m.order ? {
        id: m.order.id,
        order_number: m.order.order_number,
        status: m.order.status,
        total_amount: m.order.total_amount,
      } : null,
      batch: m.batch ? {
        id: m.batch.id,
        batch_id: m.batch.batch_id,
        status: m.batch.status,
      } : null,
    }));

    return {
      total: count || 0,
      page: parseInt(page, 10),
      limit: take,
      total_pages: Math.ceil((count || 0) / take),
      messages,
    };
  } catch (err) {
    logger.error('Error in getMessageList:', err);
    return {
      total: 0,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 25,
      total_pages: 0,
      messages: [],
    };
  }
}

// ─── 6. Message Detail Inspection ─────────────────────────────────────────────

async function getMessageDetail(id) {
  const log = await WhatsAppLog.findByPk(id, {
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'phone', 'whatsapp_number', 'city', 'state'],
      },
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'order_number', 'status', 'total_amount', 'shipping_address'],
      },
      {
        model: WhatsAppBatch,
        as: 'batch',
      },
    ],
  });

  if (!log) return null;

  // Also check if there is an outbox record for this order/phone
  let outbox = null;
  if (log.order_id) {
    outbox = await WhatsAppOutbox.findOne({
      where: { order_id: log.order_id, template_name: log.template_name || { [Op.ne]: null } },
      order: [['created_at', 'DESC']],
    });
  }

  return {
    log,
    outbox,
  };
}

// ─── 7. Failure Analytics ─────────────────────────────────────────────────────

/**
 * Categorized error breakdown from real logged failure reasons
 */
async function getFailureAnalytics({ preset, startDate: customStart, endDate: customEnd }) {
  const { startDate, endDate } = resolveIstDateRange(preset, customStart, customEnd);

  const failedLogs = await WhatsAppLog.findAll({
    where: {
      status: 'failed',
      [Op.or]: [
        { failed_at: { [Op.between]: [startDate, endDate] } },
        { created_at: { [Op.between]: [startDate, endDate] } },
      ],
    },
    attributes: ['id', 'phone_number', 'template_name', 'error_message', 'created_at', 'failed_at'],
    raw: true,
  });

  const categoryMap = {
    'Invalid Phone / Unregistered': 0,
    'Rate Limit / Throttle (429)': 0,
    'Template / Parameter Mismatch': 0,
    'Emergency Kill Switch (Paused)': 0,
    'Insufficient Credit / Payment Required': 0,
    'Network / Timeout / Connection': 0,
    'Carrier / Other Error': 0,
  };

  const reasonList = [];

  for (const log of failedLogs) {
    const err = (log.error_message || '').toLowerCase();
    let category = 'Carrier / Other Error';

    if (err.includes('phone') || err.includes('recipient') || err.includes('131026') || err.includes('131030') || err.includes('not a valid')) {
      category = 'Invalid Phone / Unregistered';
    } else if (err.includes('rate limit') || err.includes('429') || err.includes('throttle') || err.includes('130429') || err.includes('too many')) {
      category = 'Rate Limit / Throttle (429)';
    } else if (err.includes('template') || err.includes('param') || err.includes('132000') || err.includes('132001') || err.includes('component')) {
      category = 'Template / Parameter Mismatch';
    } else if (err.includes('kill switch') || err.includes('pause') || err.includes('emergency')) {
      category = 'Emergency Kill Switch (Paused)';
    } else if (err.includes('credit') || err.includes('balance') || err.includes('payment') || err.includes('131042')) {
      category = 'Insufficient Credit / Payment Required';
    } else if (err.includes('timeout') || err.includes('econnreset') || err.includes('socket') || err.includes('network')) {
      category = 'Network / Timeout / Connection';
    }

    categoryMap[category] = (categoryMap[category] || 0) + 1;
    if (reasonList.length < 50 && log.error_message) {
      reasonList.push({
        id: log.id,
        phone: log.phone_number,
        template: log.template_name,
        error: log.error_message,
        category,
        timestamp: log.failed_at || log.created_at,
      });
    }
  }

  const breakdown = Object.entries(categoryMap).map(([category, count]) => ({
    category,
    count,
    percentage: failedLogs.length > 0 ? Number((count / failedLogs.length * 100).toFixed(1)) : 0,
  }));

  breakdown.sort((a, b) => b.count - a.count);

  return {
    total_failures: failedLogs.length,
    breakdown,
    recent_failure_samples: reasonList,
  };
}

// ─── 8. Retry Analytics ───────────────────────────────────────────────────────

/**
 * Analysis of retry attempts, recovered messages, and exhausted limits
 */
async function getRetryAnalytics({ preset, startDate: customStart, endDate: customEnd }) {
  const { startDate, endDate } = resolveIstDateRange(preset, customStart, customEnd);

  // Analyze from outbox
  const outboxItems = await WhatsAppOutbox.findAll({
    where: {
      created_at: { [Op.between]: [startDate, endDate] },
      attempts: { [Op.gt]: 0 },
    },
    attributes: ['id', 'status', 'attempts', 'max_attempts'],
    raw: true,
  });

  let totalRetried = 0;
  let successfulAfterRetry = 0;
  let exhaustedRetries = 0;
  let pendingRetry = 0;

  for (const item of outboxItems) {
    if (item.attempts > 1) totalRetried++;
    if (item.status === 'sent') successfulAfterRetry++;
    else if (item.status === 'failed' && item.attempts >= item.max_attempts) exhaustedRetries++;
    else if (item.status === 'pending' || item.status === 'processing') pendingRetry++;
  }

  return {
    total_messages_with_retries: totalRetried,
    successful_after_retry: successfulAfterRetry,
    exhausted_max_retries: exhaustedRetries,
    pending_retry: pendingRetry,
    recovery_rate: totalRetried > 0 ? Number((successfulAfterRetry / totalRetried * 100).toFixed(1)) : 0,
  };
}

// ─── 9. CSV Export ────────────────────────────────────────────────────────────

/**
 * Streams formatted CSV string of audit records respecting current filters
 */
async function exportAuditReport({ preset, startDate: customStart, endDate: customEnd, status, template, batchId }) {
  const { startDate, endDate } = resolveIstDateRange(preset, customStart, customEnd);

  const where = {
    [Op.or]: [
      { sent_at: { [Op.between]: [startDate, endDate] } },
      {
        sent_at: null,
        created_at: { [Op.between]: [startDate, endDate] },
      },
    ],
  };

  if (status) where.status = status;
  if (template) where.template_name = template;
  if (batchId) where.batch_id = batchId;

  const logs = await WhatsAppLog.findAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['name', 'phone'] },
      { model: Order, as: 'order', attributes: ['order_number'] },
      { model: WhatsAppBatch, as: 'batch', attributes: ['batch_id'] },
    ],
    order: [['created_at', 'DESC']],
    limit: 10000, // Safe batch limit
  });

  const headers = [
    'Log ID',
    'Provider Message ID',
    'Customer Name',
    'Phone Number',
    'Order Number',
    'Batch ID',
    'Template Name',
    'Message Type',
    'Status',
    'Created At (UTC)',
    'Sent At (UTC)',
    'Delivered At (UTC)',
    'Read At (UTC)',
    'Failed At (UTC)',
    'Retry Count',
    'Estimated Cost (INR)',
    'Actual Cost (INR)',
    'Error Message',
  ];

  const toIsoStr = (d) => {
    if (!d) return '';
    if (d instanceof Date) return d.toISOString();
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? String(d) : dt.toISOString();
  };

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    // Prevent CSV formula injection
    if (/^[=+\-@]/.test(str)) {
      return `"'${str}"`;
    }
    return `"${str}"`;
  };

  const csvRows = [headers.join(',')];

  for (const l of logs) {
    const custName = l.customer ? l.customer.name : '';
    const ordNum = l.order?.order_number || '';
    const bId = l.batch?.batch_id || '';

    csvRows.push([
      escapeCsv(l.id),
      escapeCsv(l.wa_message_id || ''),
      escapeCsv(custName),
      escapeCsv(l.phone_number),
      escapeCsv(ordNum),
      escapeCsv(bId),
      escapeCsv(l.template_name || ''),
      escapeCsv(l.message_type),
      escapeCsv(l.status),
      escapeCsv(toIsoStr(l.created_at)),
      escapeCsv(toIsoStr(l.sent_at)),
      escapeCsv(toIsoStr(l.delivered_at)),
      escapeCsv(toIsoStr(l.read_at)),
      escapeCsv(toIsoStr(l.failed_at)),
      escapeCsv(l.retry_count),
      escapeCsv(l.estimated_cost),
      escapeCsv(l.actual_cost !== null ? l.actual_cost : 'UNAVAILABLE'),
      escapeCsv(l.error_message || ''),
    ].join(','));
  }

  // Prepend UTF-8 BOM for Microsoft Excel
  return '\uFEFF' + csvRows.join('\r\n');
}

module.exports = {
  resolveIstDateRange,
  getAuditSummary,
  getDailyMessageReport,
  getCostByTemplate,
  getCostByBatch,
  getMessageList,
  getMessageDetail,
  getFailureAnalytics,
  getRetryAnalytics,
  exportAuditReport,
};
