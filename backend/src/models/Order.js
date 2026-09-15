'use strict';

const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Order extends Model {}

Order.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    order_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    marketplace_order_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    marketplace: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'direct',
    },
    channel: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Channel identification e.g. amazon_channel_1, amazon_channel_2, amazon_channel_3, flipkart, indiamart, direct',
    },
    customer_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      references: { model: 'customers', key: 'id' },
    },
    customer_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Recipient / customer name prior to official delivery registration',
    },
    customer_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Recipient contact phone / WhatsApp number prior to official delivery registration',
    },
    customer_email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Recipient email prior to official delivery registration',
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending',
    },
    // Order processing flow status (per mindmap)
    flow_stage: {
      type: DataTypes.STRING(50),
      defaultValue: 'ask_images',
    },
    images_provided: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // CR1 — reason stored when images are rejected during verification
    image_rejection_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    product_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    product_sku: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    discount_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    shipping_charge: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    // Shipping details
    shipping_partner: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    tracking_number: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    shipping_address: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    delivery_pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    estimated_delivery_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Maps to latest-delivery-date from Amazon Excel (BLUE highlighted)',
    },
    // Amazon client Excel — highlighted BLUE columns
    latest_ship_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Amazon: latest-ship-date (BLUE highlighted)',
    },
    earliest_delivery_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Amazon: earliest-delivery-date (BLUE highlighted)',
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    dispatched_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // WhatsApp communications
    whatsapp_confirmation_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    whatsapp_dispatch_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    whatsapp_delivery_sent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // Internal
    assigned_to: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    internal_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    customer_feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    feedback_rating: {
      type: DataTypes.TINYINT,
      allowNull: true,
      validate: { min: 1, max: 5 },
    },
    // CR7 — satisfaction outcome + resolution tracking (no ticketing module in Phase 1)
    feedback_status: {
      type: DataTypes.ENUM('not_collected', 'happy', 'unhappy', 'escalated', 'resolved'),
      defaultValue: 'not_collected',
    },
    feedback_issue_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Resolution notes when customer is unhappy',
    },
    // Manual Order Verification & Communication tracking
    verification_status: {
      type: DataTypes.ENUM(
        'pending_verification',
        'screenshot_requested',
        'image_received',
        'verification_in_review',
        'sku_matched',
        'sku_mismatched',
        'image_unreadable',
        'product_not_found',
        'pending_confirmation',
        'confirmed',
        'cancelled',
        'verification_exception',
        'call_representative_requested'
      ),
      defaultValue: 'pending_verification',
    },
    verified_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verification_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    confirmation_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    customer_confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Screenshot Workflow & 15-Minute Timer
    screenshot_requested_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    screenshot_received_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    second_message_due_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    second_message_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    confirmation_message_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    final_confirmation_due_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Configurable deadline for customer to respond to Message 2 (order_confirmation013)',
    },
    delivered_message_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // WhatsApp Workflow Synchronization (Section 27)
    workflow_state: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'PENDING_VERIFICATION',
    },
    whatsapp_batch_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: 'Reference to WhatsAppBatch.id / batch_id',
    },
    screenshot_deadline_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Explicit 15-minute deadline for customer screenshot (mirrors second_message_due_at)',
    },
    matched_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp when CRM operator matched the customer screenshot (mirrors verified_at)',
    },
    matched_by: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: 'User ID of operator who verified the image',
    },
    final_confirmation_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp Message 2 (order_confirmation013) was sent (mirrors second_message_sent_at)',
    },
    customer_cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp customer clicked Cancel Order on WhatsApp',
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Timestamp order was marked cancelled',
    },
    cancel_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Reason for order cancellation',
    },
    message_1_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Outbound Message 1 (order_verification_interactive) WhatsApp message ID',
    },
    screenshot_message_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Outbound screenshot_from_customer WhatsApp message ID',
    },
    message_2_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Outbound Message 2 (order_confirmation013) WhatsApp message ID',
    },
    final_confirmation_message_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Outbound order_confirmation WhatsApp message ID',
    },
    cancelled_message_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Outbound order_cancelled WhatsApp message ID',
    },
    // CSV import metadata
    import_batch_id: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },
    raw_csv_data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    order_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    indexes: [
      { fields: ['order_number'] },
      { fields: ['marketplace_order_id'] },
      { fields: ['marketplace'] },
      { fields: ['customer_id'] },
      { fields: ['status'] },
      { fields: ['flow_stage'] },
      { fields: ['verification_status'] },
      { fields: ['verified_by'] },
      { fields: ['assigned_to'] },
      { fields: ['import_batch_id'] },
      { fields: ['order_date'] },
      { fields: ['delivery_pincode'] },
      { fields: ['feedback_status'] },
      // High-concurrency composite indexes
      { fields: ['marketplace', 'marketplace_order_id'] },
      { fields: ['status', 'created_at'] },
      { fields: ['verification_status', 'second_message_due_at'] },
      { fields: ['verification_status', 'final_confirmation_due_at'] },
      { fields: ['customer_id', 'created_at'] },
      { fields: ['status', 'order_date'] },
    ],
  }
);

module.exports = Order;
