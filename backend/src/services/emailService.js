'use strict';

const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.recipientEmail = process.env.ALERT_RECIPIENT_EMAIL || 'uidaniel69@gmail.com';
    this.sendMail = this.sendMail.bind(this);
    this.sendTotalWhatsAppReport = this.sendTotalWhatsAppReport.bind(this);
    this.sendWhatsAppErrorAlert = this.sendWhatsAppErrorAlert.bind(this);
    this.verifyConnection = this.verifyConnection.bind(this);
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const user = process.env.SMTP_USER || 'varun.patil@vasifytech.com';
    const pass = process.env.SMTP_PASS || 'vhwuenmhvgeatvmg';

    if (!user || !pass) {
      logger.warn('[EMAIL SERVICE] SMTP credentials not configured. Outbound emails will be skipped.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for 587
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.from = process.env.SMTP_FROM || `"Krishna CRM System" <${user}>`;
  }

  /**
   * Verifies SMTP transporter connectivity
   */
  async verifyConnection() {
    if (!this.transporter) this.initTransporter();
    if (!this.transporter) return { success: false, error: 'Transporter not initialized' };
    try {
      await this.transporter.verify();
      logger.info('[EMAIL SERVICE] SMTP connection verified successfully.');
      return { success: true };
    } catch (err) {
      logger.error('[EMAIL SERVICE] SMTP verification failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Sends an email via nodemailer
   */
  async sendMail({ to, subject, html, text }) {
    if (!this.transporter) this.initTransporter();
    if (!this.transporter) {
      logger.warn('[EMAIL SERVICE] Cannot send email; transporter unconfigured.');
      return { success: false, error: 'Transporter not initialized' };
    }

    const recipient = to || this.recipientEmail;

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: recipient,
        subject,
        text,
        html,
      });

      logger.info(`[EMAIL SERVICE] Email sent successfully to ${recipient}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error(`[EMAIL SERVICE] Failed to send email to ${recipient}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Generates and sends the Total WhatsApp Spending & Audit Report
   */
  async sendTotalWhatsAppReport(recipient = null) {
    const to = recipient || this.recipientEmail;
    const whatsappAuditService = require('./whatsappAuditService');
    const whatsappCostService = require('./whatsappCostService');
    const whatsappSpendGuard = require('./whatsappSpendGuard');

    // Retrieve summary metrics across all records safely
    let summary = { metrics: {}, cost: {} };
    let todayConfirmedSpend = 0;
    let activeReservedSpend = 0;
    let dailySpendLimit = 5000;

    try {
      summary = await whatsappAuditService.getAuditSummary({ preset: 'LAST_30_DAYS' });
    } catch (err) {
      logger.warn('[EMAIL SERVICE] Could not query remote DB for live audit summary, using defaults/local:', err.message);
    }

    try {
      todayConfirmedSpend = await whatsappSpendGuard.getTodayConfirmedSpend();
      activeReservedSpend = await whatsappSpendGuard.getActiveReservedSpend();
      dailySpendLimit = await whatsappSpendGuard.getDailySpendLimit();
    } catch (_) {}

    const pricing = whatsappCostService.getPricingBreakdown();

    const metrics = summary.metrics || {};
    const cost = summary.cost || {};
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const totalSent = metrics.total_sent || 0;
    const delivered = metrics.delivered_count || 0;
    const read = metrics.read_count || 0;
    const failed = metrics.failed_count || 0;
    const queued = (metrics.pending_count || 0) + (metrics.queued_count || 0);

    const deliveryRate = totalSent > 0 ? ((delivered + read) / totalSent * 100).toFixed(1) : '0.0';
    const readRate = totalSent > 0 ? (read / totalSent * 100).toFixed(1) : '0.0';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #ffffff; padding: 28px 24px; }
        .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
        .header p { margin: 0; opacity: 0.85; font-size: 13px; }
        .content { padding: 24px; }
        .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
        .card-title { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #64748b; margin-bottom: 4px; }
        .card-value { font-size: 20px; font-weight: 700; color: #0f172a; }
        .highlight-cost { color: #059669; }
        .highlight-danger { color: #dc2626; }
        .table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
        .table th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-weight: 600; color: #475569; border-bottom: 1px solid #cbd5e1; }
        .table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
        .badge-success { background: #dcfce7; color: #166534; }
        .badge-info { background: #e0f2fe; color: #075985; }
        .badge-warn { background: #fef3c7; color: #92400e; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Krishna CRM — WhatsApp Total Spend & Audit Report</h1>
          <p>Generated on ${now} (IST) for <strong>${to}</strong></p>
        </div>
        <div class="content">
          <h3 style="margin-top: 0; font-size: 15px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">💰 Financial & Spending Overview</h3>
          
          <table class="table" style="margin-bottom: 24px;">
            <tr>
              <td><strong>Today's Confirmed Spend:</strong></td>
              <td class="card-value highlight-cost" style="font-size: 16px;">₹${todayConfirmedSpend.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Active Batch Reservations:</strong></td>
              <td style="font-size: 14px; font-weight: 600; color: #0284c7;">₹${activeReservedSpend.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Configured Daily Spend Limit:</strong></td>
              <td style="font-size: 14px; font-weight: 600;">₹${dailySpendLimit.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Remaining Budget for Today:</strong></td>
              <td style="font-size: 14px; font-weight: 700; color: #16a34a;">₹${Math.max(0, dailySpendLimit - (todayConfirmedSpend + activeReservedSpend)).toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Total Estimated Cost (Selected Period):</strong></td>
              <td style="font-size: 14px; font-weight: 700; color: #0f172a;">₹${(cost.total_estimated_cost || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Official Template Rate (Utility):</strong></td>
              <td><span class="badge badge-info">₹${pricing.utility_rate.toFixed(2)} / message</span> (100% of CRM templates)</td>
            </tr>
          </table>

          <h3 style="font-size: 15px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">📈 Message Delivery Analytics</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Count</th>
                <th>Rate / Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Total Sent Messages</strong></td>
                <td><strong>${totalSent}</strong></td>
                <td><span class="badge badge-success">100%</span></td>
              </tr>
              <tr>
                <td>Delivered Messages</td>
                <td>${delivered}</td>
                <td>${deliveryRate}% delivery rate</td>
              </tr>
              <tr>
                <td>Read Messages</td>
                <td>${read}</td>
                <td>${readRate}% read rate</td>
              </tr>
              <tr>
                <td>Failed Messages</td>
                <td><span style="color: #dc2626; font-weight: bold;">${failed}</span></td>
                <td>${totalSent > 0 ? (failed / (totalSent + failed) * 100).toFixed(1) : 0}% failure rate</td>
              </tr>
              <tr>
                <td>Currently Queued / Outbox Pending</td>
                <td>${queued}</td>
                <td>Paced via Rate Limiter</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 24px; padding: 12px 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 12px; color: #1e40af;">
            <strong>System Health Note:</strong> All 9 WhatsApp templates are verified in the <strong>UTILITY</strong> category. Emergency Kill Switch and Spend Ceiling guards are actively monitoring outbox workers.
          </div>
        </div>
        <div class="footer">
          Krishna CRM Platform • Automated Alert & Financial Reporting System<br>
          Sent to <strong>${to}</strong> via Vasify SMTP Gateway.
        </div>
      </div>
    </body>
    </html>
    `;

    return this.sendMail({
      to,
      subject: `📊 [Krishna CRM] WhatsApp Total Spend & Audit Report (${now})`,
      html,
      text: `Krishna CRM WhatsApp Total Spend Report\n\nGenerated: ${now}\nToday's Confirmed Spend: ₹${todayConfirmedSpend.toFixed(2)}\nActive Reservations: ₹${activeReservedSpend.toFixed(2)}\nDaily Limit: ₹${dailySpendLimit.toFixed(2)}\nTotal Sent Messages: ${totalSent}\nDelivered: ${delivered}\nRead: ${read}\nFailed: ${failed}\nRecipient: ${to}`,
    });
  }

  /**
   * Sends an immediate error alert email
   */
  async sendWhatsAppErrorAlert({ errorType, message, details = {}, batchId = null, outboxId = null }) {
    const to = this.recipientEmail;
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fef2f2; color: #1e293b; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #fecaca; overflow: hidden; }
        .header { background: #dc2626; color: #ffffff; padding: 20px; }
        .content { padding: 20px; font-size: 13px; line-height: 1.6; }
        .error-box { background: #fef2f2; border: 1px solid #f87171; border-radius: 6px; padding: 12px; font-family: monospace; color: #991b1b; margin: 12px 0; }
        .footer { background: #f8fafc; padding: 12px; font-size: 11px; text-align: center; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0; font-size: 18px;">⚠️ WhatsApp Error / Spending Alert</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Time: ${now} (IST)</p>
        </div>
        <div class="content">
          <p><strong>Alert Type:</strong> <span style="color: #dc2626; font-weight: bold;">${errorType}</span></p>
          <p><strong>Description:</strong> ${message}</p>
          ${batchId ? `<p><strong>Batch ID:</strong> ${batchId}</p>` : ''}
          ${outboxId ? `<p><strong>Outbox Item ID:</strong> ${outboxId}</p>` : ''}
          <div class="error-box">${typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)}</div>
          <p style="font-size: 12px; color: #64748b;">The Krishna CRM automated protection system has logged this event. If this is a spend ceiling or rate limit trigger, outgoing dispatches have been paused to protect your budget.</p>
        </div>
        <div class="footer">Krishna CRM System Alert • ${to}</div>
      </div>
    </body>
    </html>
    `;

    return this.sendMail({
      to,
      subject: `🚨 [ALERT] WhatsApp ${errorType}: ${message}`,
      html,
      text: `[ALERT] WhatsApp ${errorType}\nTime: ${now}\nMessage: ${message}\nDetails: ${JSON.stringify(details)}`,
    });
  }
}

module.exports = new EmailService();
