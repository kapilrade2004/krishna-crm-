'use strict';

const whatsappAuditService = require('../services/whatsappAuditService');
const logger = require('../config/logger');

exports.getSummary = async (req, res) => {
  try {
    const summary = await whatsappAuditService.getAuditSummary(req.query);
    return res.json({ success: true, data: summary });
  } catch (err) {
    logger.error('Error fetching WhatsApp audit summary:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getDailyReport = async (req, res) => {
  try {
    const report = await whatsappAuditService.getDailyMessageReport(req.query);
    return res.json({ success: true, data: report });
  } catch (err) {
    logger.error('Error fetching WhatsApp daily report:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCostByTemplate = async (req, res) => {
  try {
    const report = await whatsappAuditService.getCostByTemplate(req.query);
    return res.json({ success: true, data: report });
  } catch (err) {
    logger.error('Error fetching cost by template:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCostByBatch = async (req, res) => {
  try {
    const report = await whatsappAuditService.getCostByBatch(req.query);
    return res.json({ success: true, data: report });
  } catch (err) {
    logger.error('Error fetching cost by batch:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const result = await whatsappAuditService.getMessageList(req.query);
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Error fetching WhatsApp audit messages:', err);
    return res.json({
      success: true,
      data: {
        total: 0,
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 20,
        total_pages: 0,
        messages: [],
      },
    });
  }
};

exports.getMessageDetail = async (req, res) => {
  try {
    const result = await whatsappAuditService.getMessageDetail(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Message log not found' });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Error fetching message details:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFailureAnalytics = async (req, res) => {
  try {
    const result = await whatsappAuditService.getFailureAnalytics(req.query);
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Error fetching failure analytics:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRetryAnalytics = async (req, res) => {
  try {
    const result = await whatsappAuditService.getRetryAnalytics(req.query);
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('Error fetching retry analytics:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.exportCsv = async (req, res) => {
  try {
    const csvData = await whatsappAuditService.exportAuditReport(req.query);
    const filename = `whatsapp_audit_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvData);
  } catch (err) {
    logger.error('Error exporting WhatsApp audit CSV:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.emailTotalReport = async (req, res) => {
  try {
    const emailService = require('../services/emailService');
    const recipient = req.body?.recipient || process.env.ALERT_RECIPIENT_EMAIL || 'uidaniel69@gmail.com';
    const result = await emailService.sendTotalWhatsAppReport(recipient);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }
    return res.json({
      success: true,
      message: `Total report email dispatched to ${recipient}`,
      messageId: result.messageId,
    });
  } catch (err) {
    logger.error('Error emailing WhatsApp total report:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

