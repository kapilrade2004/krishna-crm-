'use strict';

const fs   = require('fs');
const csv  = require('csv-parser');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { sequelize, Order, Customer, CsvImportBatch } = require('../models');
const whatsappService = require('./whatsappService');
const whatsappOutboxQueue = require('./whatsappOutboxQueue');
const logger = require('../config/logger');

// ─── Marketplace column field maps ────────────────────────────────────────────
// Universal Master Field Map (Includes 100% of Amazon, Flipkart, IndiaMart, Akuabeat Website, Shopify, & Standard Excel fields)
const UNIVERSAL_FIELD_MAP = {
  order_id: [
    'order-id', 'Order ID', 'order_id', 'orderId', 'amazon-order-id', 'Amazon Order ID',
    'Order Id', 'merchant-order-id', 'order id', 'order-item-id', 'Order Item ID', 'order_item_id',
    'orderItemId', 'OrderItemId', 'FSN', 'fsn', 'Inquiry No', 'Inquiry ID', 'Lead ID', 'Query ID',
    'inquiry_no', 'id', 'ID', 'Order Number', 'Order No', 'Invoice No', 'Bill No', 'Order #',
    'order_no', 'Order_Number', 'orderNumber'
  ],
  order_date: [
    'purchase-date', 'Purchase Date', 'purchaseDate', 'order_date', 'orderDate', 'Order Date',
    'payments-date', 'Date', 'date', 'Invoice Date', 'Order Created Date', 'Inquiry Date', 'Lead Date',
    'Query Date', 'Date & Time', 'Created At', 'created_at', 'Order_Date', 'order date', 'Order_Time'
  ],
  customer_name: [
    'buyer-name', 'recipient-name', 'buyerName', 'recipientName', 'Buyer Name', 'Customer Name',
    'recipient name', 'buyer name', 'Name', 'Customer', 'customer_name', 'customerName',
    'Recipient Name', 'Buyer', 'Contact Person', 'Sender Name', 'Client Name', 'Customer_Name',
    'Billing Name', 'Shipping Name', 'Full Name', 'Name of Customer', 'Customer_Full_Name'
  ],
  phone: [
    'buyer-phone-number', 'buyerPhone', 'bill-phone-no', 'buyer-phone', 'Phone', 'Mobile',
    'Phone Number', 'Contact Number', 'buyer phone', 'phone', 'phone_number', 'phoneNumber',
    'Customer Contact Number', 'Customer Phone', 'Sender Mobile', 'Sender Phone', 'Mobile Number',
    'Billing Phone', 'Contact No', 'Mobile No', 'Telephone', 'Tel', 'Phone No', 'Customer_Phone',
    'Mobile_Number', 'Contact_Number', 'WhatsApp Number', 'whatsapp_number', 'WhatsApp'
  ],
  ship_phone: [
    'ship-phone-number', 'shipPhone', 'ship-phone', 'Shipping Phone', 'ship phone number',
    'Shipping Mobile', 'Delivery Phone', 'Recipient Phone', 'Ship Phone', 'ship_phone',
    'Shipping_Phone', 'Delivery_Phone'
  ],
  product_sku: [
    'sku', 'SKU', 'merchant-sku', 'merchantSku', 'ASIN', 'asin', 'Item SKU', 'Seller SKU',
    'FSN', 'fsn', 'product_sku', 'productSku', 'Item Code', 'Product Code', 'Item SKU / Code',
    'Model Number', 'Model No', 'Barcode', 'Product_SKU', 'Item_SKU', 'SKU_Code'
  ],
  product_name: [
    'product-name', 'item-name', 'productName', 'itemName', 'Product Name', 'Item Name',
    'Title', 'Product Title', 'item name', 'product name', 'Item Description', 'Product',
    'Item', 'Product / Service Name', 'Requirement', 'Subject', 'Description', 'Product Description',
    'Product_Name', 'Item_Name', 'Product_Title'
  ],
  quantity: [
    'quantity-purchased', 'quantityPurchased', 'quantity', 'Quantity', 'Qty', 'item-quantity',
    'Quantity Purchased', 'Item Quantity', 'item_quantity', 'itemQuantity', 'Order Quantity',
    'Count', 'Units', 'No of Items', 'Order_Quantity', 'Qty_Purchased'
  ],
  unit_price: [
    'item-price', 'itemPrice', 'Item Price', 'unit-price', 'unitPrice', 'Unit Price',
    'Price', 'price', 'Selling Price', 'selling_price', 'Rate', 'Unit Rate', 'Cost per item',
    'Unit_Price', 'Item_Price', 'Selling_Price'
  ],
  total_amount: [
    'item-price', 'itemPrice', 'item-total', 'itemTotal', 'Total', 'Order Total',
    'Total Amount', 'Item Total', 'principal', 'Final Settlement Amount', 'total_amount',
    'totalAmount', 'Net Amount', 'Invoice Amount', 'Value', 'Estimated Value', 'Amount',
    'Grand Total', 'Gross Amount', 'Total (INR)', 'Order Value', 'Total_Amount', 'Order_Total',
    'Net_Amount', 'Final_Amount'
  ],
  latest_ship_date: [
    'latest-ship-date', 'latestShipDate', 'Latest Ship Date', 'Ship By Date', 'ship-by-date',
    'latest ship date', 'Ship By', 'Ship Date', 'Latest_Ship_Date', 'Dispatch_By'
  ],
  earliest_delivery_date: [
    'earliest-delivery-date', 'earliestDeliveryDate', 'Earliest Delivery Date', 'delivery-start-date',
    'earliest delivery date', 'Delivery Start Date', 'Earliest_Delivery_Date'
  ],
  latest_delivery_date: [
    'latest-delivery-date', 'latestDeliveryDate', 'Latest Delivery Date', 'Deliver By Date',
    'delivery-end-date', 'latest delivery date', 'Expected Delivery Date', 'Deliver By', 'Latest_Delivery_Date'
  ],
  address_line1: [
    'ship-address-1', 'shipAddress1', 'Address 1', 'shipping-address-1', 'ship address 1',
    'Address Line 1', 'Delivery Address', 'address_line1', 'addressLine1', 'Address',
    'Delivery Address Line 1', 'Shipping Address', 'Sender Address', 'Location', 'Street Address',
    'Shipping_Address_1', 'Address_1', 'Address_Line_1'
  ],
  address_line2: [
    'ship-address-2', 'shipAddress2', 'Address 2', 'shipping-address-2', 'ship address 2',
    'Address Line 2', 'address_line2', 'addressLine2', 'Delivery Address Line 2', 'Apartment', 'Suite',
    'Shipping_Address_2', 'Address_2', 'Address_Line_2'
  ],
  city: [
    'ship-city', 'shipCity', 'City', 'shipping-city', 'ship city', 'Delivery City',
    'city', 'Shipping City', 'Sender City', 'Town', 'District', 'Shipping_City', 'Delivery_City'
  ],
  state: [
    'ship-state', 'shipState', 'State', 'shipping-state', 'ship state', 'Delivery State',
    'state', 'Shipping State', 'Sender State', 'Province', 'Region', 'Shipping_State', 'Delivery_State'
  ],
  pincode: [
    'ship-postal-code', 'shipPostalCode', 'Pincode', 'shipping-zip', 'ship-zip',
    'Postal Code', 'Pin Code', 'ZIP', 'pincode', 'Postal code', 'pin_code', 'pinCode',
    'Delivery Pincode', 'Sender Pincode', 'PIN', 'Zip Code', 'Shipping_Pincode', 'Postal_Code', 'Pin_Code'
  ],
  email: [
    'buyer-email', 'buyerEmail', 'Email', 'buyer-email-opt-out', 'Customer Email',
    'email', 'Buyer Email', 'Email ID', 'Sender Email', 'Email Address', 'Customer Email ID',
    'Customer_Email', 'Buyer_Email', 'Email_Address'
  ],
  tracking_number: [
    'tracking-number', 'trackingNumber', 'Tracking Number', 'AWB', 'awb-number',
    'Tracking ID', 'tracking number', 'tracking_number', 'tracking_id', 'trackingId',
    'Shipment Tracking ID', 'Tracking Id', 'Waybill', 'AWB No', 'Docket Number', 'Docket No',
    'Tracking_Number', 'AWB_Number', 'AWB_No', 'Tracking_ID'
  ],
  shipping_partner: [
    'carrier-name', 'carrierName', 'Carrier', 'shipping-service', 'carrier name',
    'Courier', 'Shipping Partner', 'Logistics Partner', 'shipping_partner', 'shippingPartner',
    'Delivery Partner', 'courier', 'Logistics', 'Transporter', 'Shipping_Partner', 'Carrier_Name'
  ],
};

const FIELD_MAPS = {
  amazon: UNIVERSAL_FIELD_MAP,
  flipkart: UNIVERSAL_FIELD_MAP,
  indiamart: UNIVERSAL_FIELD_MAP,
  akuabeat_website: UNIVERSAL_FIELD_MAP,
  website: UNIVERSAL_FIELD_MAP,
  direct: UNIVERSAL_FIELD_MAP,
  other: UNIVERSAL_FIELD_MAP,
};

// ─── Delivery CSV column map ───────────────────────────────────────────────────
const DELIVERY_FIELD_MAP = {
  order_id:        ['order-id', 'order id', 'Order ID', 'Order Id', 'order_id', 'orderId', 'amazon-order-id', 'order_number', 'Order Number', 'Order No'],
  delivered_date:  ['delivery-date', 'delivered-date', 'Delivery Date', 'Delivered Date', 'actual-delivery-date', 'delivered_date', 'deliveredDate', 'Delivered At', 'delivered_at'],
  tracking_number: ['tracking-number', 'Tracking Number', 'tracking_number', 'trackingNumber', 'AWB', 'awb-number', 'carrier-tracking-number', 'Tracking ID', 'AWB Number', 'Docket No', 'Waybill'],
  carrier:         ['carrier-name', 'Carrier Name', 'carrier', 'Courier', 'shipping-carrier', 'shipping_partner', 'Shipping Partner', 'Logistics Partner', 'Courier Name'],
};

// ─── Universal Shipping Bulk Upload column map (Transit & Delivery) ───────────
const SHIPPING_FIELD_MAP = {
  order_id: [
    'order-id', 'order id', 'Order ID', 'Order Id', 'order_id', 'orderId', 'amazon-order-id',
    'Amazon Order ID', 'merchant-order-id', 'order_number', 'Order Number', 'Order No',
    'order_no', 'Invoice No', 'Bill No', 'Order #', 'Order_Number', 'id', 'ID', 'Reference ID', 'Ref No', 'orderId'
  ],
  tracking_number: [
    'tracking-number', 'trackingNumber', 'Tracking Number', 'AWB', 'awb-number', 'AWB Number',
    'Tracking ID', 'tracking number', 'tracking_number', 'tracking_id', 'trackingId',
    'Shipment Tracking ID', 'Tracking Id', 'Waybill', 'AWB No', 'Docket Number', 'Docket No',
    'Tracking_Number', 'AWB_Number', 'AWB_No', 'Tracking_ID', 'Consignment No', 'Consignment Number',
    'hawb', 'HAWB', 'Airway Bill', 'Airway Bill No', 'awb_code', 'AWB Code',
    'AWB Tracking Number', 'awb_tracking_number', 'AWB / Tracking Number', 'Tracking / AWB',
    'AWB / Tracking', 'AWB Tracking No', 'Consignment_Number', 'TrackingNo'
  ],
  carrier: [
    'carrier-name', 'carrierName', 'Carrier Name', 'Carrier', 'shipping-service', 'carrier name',
    'Courier', 'Shipping Partner', 'Logistics Partner', 'shipping_partner', 'shippingPartner',
    'Delivery Partner', 'courier', 'Logistics', 'Transporter', 'Shipping_Partner', 'Carrier_Name',
    'Courier Name', 'courier_name', 'Courier Partner'
  ],
  status: [
    'status', 'Status', 'Shipment Status', 'shipment_status', 'Order Status', 'order_status',
    'Delivery Status', 'delivery_status', 'Current Status', 'current_status', 'Tracking Status',
    'tracking_status', 'State', 'Shipment State'
  ],
  dispatched_date: [
    'dispatched_at', 'dispatched-at', 'Dispatched At', 'ship-date', 'Ship Date', 'Shipped Date',
    'shipped_date', 'Pickup Date', 'pickup_date', 'Dispatch Date', 'dispatched_date', 'Dispatched Date',
    'latest-ship-date', 'Latest Ship Date', 'Dispatch Time'
  ],
  delivered_date: [
    'delivered_at', 'delivered-at', 'Delivered At', 'delivery-date', 'delivered-date', 'Delivery Date',
    'Delivered Date', 'actual-delivery-date', 'delivered_date', 'deliveredDate', 'Actual Delivery Date',
    'Delivery Time', 'Delivered Time'
  ],
  customer_name: [
    'customer_name', 'Customer Name', 'recipient-name', 'Recipient Name', 'buyer-name', 'Buyer Name',
    'Name', 'Customer', 'Consignee Name', 'Consignee', 'buyerName', 'recipientName'
  ],
  customer_phone: [
    'customer_phone', 'Customer Phone', 'phone', 'Phone', 'Mobile', 'Mobile Number',
    'buyer-phone-number', 'ship-phone-number', 'Contact Number', 'Consignee Phone', 'Consignee Mobile',
    'Customer_Phone', 'Phone Number'
  ],
  pincode: [
    'pincode', 'Pincode', 'Pin Code', 'ship-postal-code', 'Postal Code', 'ZIP', 'Delivery Pincode',
    'Destination Pincode', 'Dest Pincode', 'postal_code', 'Postal_Code'
  ],
  city: [
    'city', 'City', 'ship-city', 'Delivery City', 'Destination City', 'Town'
  ],
  state: [
    'state', 'State', 'ship-state', 'Delivery State', 'Destination State', 'Province'
  ],
  address: [
    'address', 'Address', 'ship-address-1', 'shipping-address-1', 'Delivery Address', 'Address Line 1'
  ],
  product_name: [
    'product_name', 'Product Name', 'item-name', 'Product', 'Item Name', 'Description'
  ],
  total_amount: [
    'total_amount', 'Total Amount', 'item-price', 'Amount', 'Order Total', 'Net Amount'
  ],
};

/**
 * Classify shipping status from raw CSV column value, dates, and tracking presence
 */
const parseShippingStatus = (rawStatus, hasDeliveredDate, hasTrackingNumber) => {
  if (!rawStatus || !String(rawStatus).trim()) {
    if (hasDeliveredDate) return 'delivered';
    if (hasTrackingNumber) return 'dispatched';
    return 'dispatched';
  }
  const s = String(rawStatus).trim().toLowerCase();

  // 1. Check for Delivered (explicitly avoid "out for delivery")
  if (
    !s.includes('out for delivery') &&
    !s.includes('out_for_delivery') &&
    (s.includes('deliver') || s.includes('complete') || s.includes('success') || s.includes('received by'))
  ) {
    return 'delivered';
  }

  // 2. Check for In Transit / Shipped / Dispatched / OFD
  if (
    s.includes('transit') ||
    s.includes('ship') ||
    s.includes('dispatch') ||
    s.includes('pickup') ||
    s.includes('picked') ||
    s.includes('out for delivery') ||
    s.includes('out_for_delivery') ||
    s.includes('ofd') ||
    s.includes('way') ||
    s.includes('manifest') ||
    s.includes('booked') ||
    s.includes('hub')
  ) {
    return 'dispatched';
  }

  // 3. Check for Returned / RTO / Undelivered
  if (
    s.includes('rto') ||
    s.includes('return') ||
    s.includes('undelivered') ||
    s.includes('fail') ||
    s.includes('reject')
  ) {
    return 'returned';
  }

  // 4. Check for Cancelled
  if (s.includes('cancel')) {
    return 'cancelled';
  }

  if (hasDeliveredDate) return 'delivered';
  return 'dispatched';
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a column header key:
 * - strip BOM
 * - convert camelCase to snake_case (e.g. orderId -> order_id)
 * - collapse spaces/dashes/dots/underscores
 * - lower-case
 */
const normaliseKey = (k) => {
  if (k === null || k === undefined) return '';
  return String(k)
    .replace(/^\uFEFF/, '')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[\s\-_.]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

/**
 * Build a normalised lookup map from a raw CSV row object.
 * Returns { normalisedKey → originalValue }
 */
const buildRowLookup = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const norm = normaliseKey(k);
    if (norm) out[norm] = v;
  }
  return out;
};

/**
 * Extract a value from a CSV row using candidate column names.
 * Falls back to normalised key matching (handles camelCase, spaces, dashes, BOM).
 */
const extractField = (row, candidates, lookupCache = null) => {
  if (!candidates || !candidates.length) return null;
  const lookup = lookupCache || buildRowLookup(row);

  for (const key of candidates) {
    // 1. Direct exact key match
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
    // 2. Normalised key match
    const norm = normaliseKey(key);
    if (lookup[norm] !== undefined && lookup[norm] !== null && String(lookup[norm]).trim() !== '') {
      return String(lookup[norm]).trim();
    }
  }
  return null;
};

/**
 * Clean & sanitize phone numbers:
 * - Splits multi-phone numbers (separated by comma, slash, or pipe)
 * - Strips trailing .0 from Excel numbers
 * - Strips non-digit chars (preserving leading + if valid)
 * - Truncates to max 20 characters for database VARCHAR(20)
 * - Returns null if invalid or shorter than 7 digits
 */
const cleanPhone = (val) => {
  if (!val) return null;
  let str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') return null;

  // Split multiple phone numbers (e.g., "9876543210 / 9123456780" or "9876543210, 9123456780")
  if (/[,\/;|]/.test(str)) {
    const parts = str.split(/[,\/;|]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) str = parts[0];
  }

  if (str.endsWith('.0')) str = str.slice(0, -2);
  str = str.replace(/[\s\-\(\)\'\"]/g, '');

  // Handle scientific notation e.g. 9.87654e+09
  if (/^\d+(\.\d+)?[eE]\+\d+$/.test(str)) {
    str = String(Math.round(Number(str)));
  }

  const cleaned = str.replace(/[^0-9+]/g, '');
  if (cleaned.length < 7) return null;
  return cleaned.substring(0, 20);
};

/**
 * Clean & sanitize currency/amounts:
 * - Strips currency symbols (₹, $, €, £, Rs.)
 * - Strips currency codes (INR, USD, etc.)
 * - Strips commas and extraneous whitespace
 * - Returns valid float number or null (prevents NaN in decimals)
 */
const cleanCurrency = (val) => {
  if (val === null || val === undefined) return null;
  let str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'free') return 0;
  str = str.replace(/[₹$€£]|INR|USD|Rs\.?|rs\.?/gi, '').replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
};

/**
 * Clean & sanitize postal codes / pincodes:
 * - Strips trailing .0 from Excel numbers
 * - Strips extraneous characters
 * - Truncates to max 10 characters for database VARCHAR(10)
 */
const cleanPincode = (val) => {
  if (!val) return null;
  let str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') return null;
  if (str.endsWith('.0')) str = str.slice(0, -2);
  str = str.replace(/[^0-9a-zA-Z]/g, '');
  return str ? str.substring(0, 10) : null;
};

/**
 * Sanitize email:
 * - Returns null for empty strings, 'N/A', or invalid format
 * - Prevents Sequelize validation errors
 */
const sanitizeEmail = (val) => {
  if (!val) return null;
  const str = String(val).trim().toLowerCase();
  if (!str || str === 'n/a' || str === 'null' || str === 'none' || str.includes('buyer-email-opt-out')) {
    return null;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str) ? str : null;
};

/**
 * Flexible Date parser:
 * - Supports ISO strings (2024-07-25, 2024-07-25T12:00:00Z)
 * - Supports Indian date formats (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)
 * - Supports Excel numeric dates (e.g. 45450)
 * - Returns valid Date or null
 */
const parseFlexibleDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    // Excel serial date (days since Dec 30 1899)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date;
  }
  const str = String(val).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') return null;

  // Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Format a date as YYYY-MM-DD for DATEONLY fields
 */
const formatDateOnly = (val) => {
  const d = parseFlexibleDate(val);
  if (!d) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Detect delimiter in text (CSV / TSV / Semicolon)
 */
const detectSeparator = (filePath) => {
  try {
    const buf = Buffer.alloc(4096);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, 4096, 0);
    fs.closeSync(fd);
    const text = buf.slice(0, bytesRead).toString('utf8');
    const firstLine = text.split(/\r?\n/)[0] || '';

    const tabs = (firstLine.match(/\t/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;

    if (tabs > commas && tabs > semicolons) return '\t';
    if (semicolons > commas && semicolons > tabs) return ';';
    return ',';
  } catch {
    return ',';
  }
};

/**
 * Parse a file — supports CSV, TSV, and Excel (.xlsx, .xls).
 * Always returns an array of plain objects with string keys.
 */
const parseFile = async (filePath) => {
  const ext = filePath.split('.').pop().toLowerCase();

  if (['xlsx', 'xls'].includes(ext)) {
    // Parse Excel with date formatting support
    const workbook = XLSX.readFile(filePath, { cellDates: true, raw: false, defval: '' });
    // Find first non-empty sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
    });
    return rows;
  }

  // Parse CSV / TSV / TXT
  const separator = detectSeparator(filePath);
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv({
        separator,
        trim: true,
        skipEmptyLines: true,
      }))
      .on('data', (row) => results.push(row))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

/**
 * Store sanitized highlighted/used fields in raw_csv_data
 */
const sanitiseRaw = (row, fieldMap, lookup) => {
  const keep = {};
  for (const [fieldName, candidates] of Object.entries(fieldMap)) {
    const val = extractField(row, candidates, lookup);
    if (val !== null) keep[fieldName] = val;
  }
  return keep;
};

// ─── Main: High-Performance processBatch ──────────────────────────────────────
const processBatch = async (batchId) => {
  const batch = await CsvImportBatch.findByPk(batchId);
  if (!batch) {
    logger.error(`CSV batch ${batchId} not found in database.`);
    return;
  }

  try {
    await batch.update({ status: 'processing' });

    let rows = [];
    try {
      rows = await parseFile(batch.file_path);
    } catch (parseErr) {
      logger.error(`File parse error for batch ${batchId}:`, parseErr);
      await batch.update({
        status: 'failed',
        error_log: [{ error: `File parse error: ${parseErr.message}` }],
        processed_at: new Date(),
      });
      return;
    }

    if (!rows || rows.length === 0) {
      await batch.update({
        status: 'completed',
        total_rows: 0,
        processed_rows: 0,
        success_rows: 0,
        failed_rows: 0,
        duplicate_rows: 0,
        processed_at: new Date(),
      });
      return;
    }

    await batch.update({ total_rows: rows.length, processed_rows: 0 });

    const fieldMap = FIELD_MAPS[batch.marketplace] || FIELD_MAPS.other;
    const errorLog = [];
    let successRows = 0;
    let failedRows = 0;
    let duplicateRows = 0;
    // Track all order IDs encountered in this upload to avoid intra-batch duplicates (multi-line orders or duplicate rows in CSV)
    const seenOrderIdsInUpload = new Set();

    // Process in chunks of 250 rows to maximize database throughput at scale
    const CHUNK_SIZE = 250;
    const totalRows = rows.length;

    for (let chunkStart = 0; chunkStart < totalRows; chunkStart += CHUNK_SIZE) {
      const chunk = rows.slice(chunkStart, chunkStart + CHUNK_SIZE);
      const rowLookups = chunk.map((r) => buildRowLookup(r));

      // 1. Extract and validate Order IDs for this chunk
      const parsedItems = [];
      const orderIdsInChunk = [];

      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j];
        const lookup = rowLookups[j];
        const rowNum = chunkStart + j + 2;

        let marketplaceOrderId = extractField(row, fieldMap.order_id, lookup);
        // Fallback check across generic candidates if primary failed
        if (!marketplaceOrderId) {
          marketplaceOrderId = extractField(row, FIELD_MAPS.other.order_id, lookup);
        }

        if (!marketplaceOrderId) {
          failedRows++;
          errorLog.push({ row: rowNum, error: 'Missing order ID — skipped.' });
          continue;
        }

        parsedItems.push({
          row,
          lookup,
          rowNum,
          marketplaceOrderId,
        });
        orderIdsInChunk.push(marketplaceOrderId);
      }

      if (parsedItems.length === 0) {
        // All rows in chunk failed basic order ID check
        await batch.update({
          processed_rows: Math.min(totalRows, chunkStart + chunk.length),
          success_rows: successRows,
          failed_rows: failedRows,
          duplicate_rows: duplicateRows,
        });
        continue;
      }

      // 2. Bulk check duplicates in a single query against DB (by marketplace_order_id and order_number)
      const orderPrefix = (batch.marketplace || 'dir').toUpperCase().substring(0, 3);
      const possibleOrderNumbers = orderIdsInChunk.map((id) => `${orderPrefix}-${id}`);
      const existingOrders = await Order.findAll({
        where: {
          [Op.or]: [
            { marketplace_order_id: { [Op.in]: orderIdsInChunk }, marketplace: batch.marketplace },
            { order_number: { [Op.in]: possibleOrderNumbers } },
          ],
        },
        attributes: ['marketplace_order_id', 'order_number'],
        raw: true,
      });
      const existingOrderIds = new Set();
      for (const o of existingOrders) {
        if (o.marketplace_order_id) existingOrderIds.add(o.marketplace_order_id);
        if (o.order_number) existingOrderIds.add(o.order_number);
      }

      // Filter out duplicate rows (either already in DB or seen earlier in this CSV upload)
      const validItemsToInsert = [];
      for (const item of parsedItems) {
        const itemOrderNum = `${orderPrefix}-${item.marketplaceOrderId}`;
        if (
          existingOrderIds.has(item.marketplaceOrderId) ||
          existingOrderIds.has(itemOrderNum) ||
          seenOrderIdsInUpload.has(item.marketplaceOrderId) ||
          seenOrderIdsInUpload.has(itemOrderNum)
        ) {
          duplicateRows++;
          continue;
        }
        seenOrderIdsInUpload.add(item.marketplaceOrderId);
        seenOrderIdsInUpload.add(itemOrderNum);
        validItemsToInsert.push(item);
      }

      if (validItemsToInsert.length === 0) {
        // All were duplicates
        await batch.update({
          processed_rows: Math.min(totalRows, chunkStart + chunk.length),
          success_rows: successRows,
          failed_rows: failedRows,
          duplicate_rows: duplicateRows,
        });
        continue;
      }

      // 3. Process Customers & Orders inside a single transaction for this chunk
      const t = await sequelize.transaction();
      try {
        // Collect customer phones to pre-lookup existing customers
        const chunkPhones = validItemsToInsert
          .map((item) => cleanPhone(extractField(item.row, fieldMap.phone, item.lookup) || extractField(item.row, fieldMap.ship_phone, item.lookup)))
          .filter(Boolean);

        const existingCustomers = chunkPhones.length > 0
          ? await Customer.findAll({
              where: { phone: { [Op.in]: chunkPhones } },
              transaction: t,
            })
          : [];

        const customerPhoneMap = new Map();
        for (const cust of existingCustomers) {
          if (cust.phone) customerPhoneMap.set(cust.phone, cust);
        }

        // Cache customer revenue/orders increments in memory to update efficiently
        const customerIncrements = new Map();

        for (const item of validItemsToInsert) {
          const { row, lookup, rowNum, marketplaceOrderId } = item;

          try {
            const rawCustomerName = extractField(row, fieldMap.customer_name, lookup) || 'Unknown Customer';
            const customerName = String(rawCustomerName).trim().substring(0, 150);
            const rawPhone = extractField(row, fieldMap.phone, lookup);
            const rawShipPhone = extractField(row, fieldMap.ship_phone, lookup);
            const phone = cleanPhone(rawPhone);
            const shipPhone = cleanPhone(rawShipPhone);
            const primaryPhone = phone || shipPhone;
            const email = sanitizeEmail(extractField(row, fieldMap.email, lookup));

            // Only link if this customer already officially exists in the database (e.g. repeat customer)
            const customer = primaryPhone ? customerPhoneMap.get(primaryPhone) : null;

            // Delivery & Order dates
            const latestShipDate = extractField(row, fieldMap.latest_ship_date, lookup);
            const earliestDeliveryDate = extractField(row, fieldMap.earliest_delivery_date, lookup);
            const latestDeliveryDate = extractField(row, fieldMap.latest_delivery_date, lookup);
            const rawOrderDate = extractField(row, fieldMap.order_date, lookup);

            const rawQty = extractField(row, fieldMap.quantity, lookup);
            const qty = Math.max(1, parseInt(String(rawQty || '1').replace(/\D/g, '') || '1', 10) || 1);
            const unitPrice = cleanCurrency(extractField(row, fieldMap.unit_price, lookup));
            const rawTotal = cleanCurrency(extractField(row, fieldMap.total_amount, lookup));
            const totalAmount = rawTotal !== null ? rawTotal : (unitPrice !== null ? unitPrice * qty : null);

            const orderNum = `${orderPrefix}-${marketplaceOrderId}`.substring(0, 100);
            const productName = (extractField(row, fieldMap.product_name, lookup) || '').trim().substring(0, 255) || null;
            const productSku = (extractField(row, fieldMap.product_sku, lookup) || '').trim().substring(0, 100) || null;
            const trackingNum = (extractField(row, fieldMap.tracking_number, lookup) || '').trim().substring(0, 150) || null;
            const shippingPartner = (extractField(row, fieldMap.shipping_partner, lookup) || '').trim().substring(0, 100) || null;
            const deliveryPincode = cleanPincode(extractField(row, fieldMap.pincode, lookup));

            await Order.create(
              {
                id: uuidv4(),
                order_number: orderNum,
                marketplace_order_id: String(marketplaceOrderId).substring(0, 150),
                marketplace: batch.marketplace,
                channel: batch.channel || batch.marketplace,
                customer_id: customer ? customer.id : null,
                customer_name: customerName,
                customer_phone: primaryPhone || null,
                customer_email: email || null,
                import_batch_id: batchId,
                product_name: productName,
                product_sku: productSku,
                quantity: qty,
                unit_price: unitPrice,
                total_amount: totalAmount,
                tracking_number: trackingNum,
                shipping_partner: shippingPartner,
                delivery_pincode: deliveryPincode,
                order_date: rawOrderDate ? formatDateOnly(rawOrderDate) : null,
                ...(latestShipDate && { latest_ship_date: parseFlexibleDate(latestShipDate) }),
                ...(earliestDeliveryDate && { earliest_delivery_date: parseFlexibleDate(earliestDeliveryDate) }),
                ...(latestDeliveryDate && { estimated_delivery_date: formatDateOnly(latestDeliveryDate) }),
                status: 'pending',
                flow_stage: 'ask_images',
                raw_csv_data: sanitiseRaw(row, fieldMap, lookup),
                shipping_address: {
                  name: customerName,
                  line1: extractField(row, fieldMap.address_line1, lookup),
                  line2: extractField(row, fieldMap.address_line2, lookup),
                  city: extractField(row, fieldMap.city, lookup),
                  state: extractField(row, fieldMap.state, lookup),
                  pincode: deliveryPincode,
                  ship_phone: shipPhone || null,
                },
              },
              { transaction: t }
            );

            // Accumulate customer stats only for existing registered customers
            if (customer && customer.id) {
              const curStats = customerIncrements.get(customer.id) || { orders: 0, revenue: 0, customer };
              curStats.orders += 1;
              if (totalAmount) curStats.revenue += totalAmount;
              customerIncrements.set(customer.id, curStats);
            }

            successRows++;
          } catch (rowErr) {
            failedRows++;
            const fieldErrors = Array.isArray(rowErr.errors) && rowErr.errors.length > 0
              ? rowErr.errors.map((e) => `${e.path || 'field'}: ${e.message}`).join(', ')
              : null;
            const detailedMsg = fieldErrors || rowErr.original?.sqlMessage || rowErr.message;
            errorLog.push({ row: rowNum, error: detailedMsg });
            logger.warn(`CSV batch ${batchId} row ${rowNum} failed: ${detailedMsg}`);
          }
        }

        // Apply accumulated customer increments in transaction
        for (const [, stats] of customerIncrements.entries()) {
          try {
            await stats.customer.increment('total_orders', { by: stats.orders, transaction: t });
            if (stats.revenue > 0) {
              await stats.customer.increment('total_revenue', { by: stats.revenue, transaction: t });
            }
          } catch (incErr) {
            logger.warn(`Customer increment notice for ${stats.customer.id}: ${incErr.message}`);
          }
        }

        await t.commit();
      } catch (chunkErr) {
        await t.rollback();
        logger.error(`Chunk error in batch ${batchId}:`, chunkErr);
        // Mark all items in this chunk as failed
        for (const item of validItemsToInsert) {
          failedRows++;
          errorLog.push({ row: item.rowNum, error: `Batch insert error: ${chunkErr.message}` });
        }
      }

      // Update progress in database after every chunk
      const processedSoFar = Math.min(totalRows, chunkStart + chunk.length);
      await batch.update({
        processed_rows: processedSoFar,
        success_rows: successRows,
        failed_rows: failedRows,
        duplicate_rows: duplicateRows,
        error_log: errorLog.slice(0, 100), // keep error log bounded
      });
    }

    // Automatically prepare and dispatch WhatsApp verification batches as soon as CSV rows are inserted
    if (successRows > 0) {
      try {
        const whatsappBatchService = require('./whatsappBatchService');
        const OrderVerificationWorkflowService = require('./orderVerificationWorkflowService');
        const whatsappOutboxQueue = require('./whatsappOutboxQueue');
        const { WhatsAppOutbox } = require('../models');

        let batchesDispatched = 0;
        try {
          const batchSummary = await whatsappBatchService.createBatchesForImport(batchId);
          logger.info(
            `[CSV SERVICE] Prepared ${batchSummary.total_batches} WhatsApp batch(es) for import ${batchId} ` +
            `(${batchSummary.eligible_for_whatsapp} eligible, ${batchSummary.excluded_records} excluded). Auto-dispatching batches immediately.`
          );

          if (batchSummary.batches && batchSummary.batches.length > 0) {
            for (const b of batchSummary.batches) {
              try {
                await whatsappBatchService.confirmAndDispatchBatch({
                  batchId: b.id,
                  userId: batch.uploaded_by || null,
                  triggerWorker: false,
                  autoDispatch: true,
                });
                batchesDispatched++;
                logger.info(`[CSV SERVICE] Auto-dispatched WhatsApp batch ${b.batch_id} for import ${batchId}`);
              } catch (dispatchErr) {
                logger.error(`[CSV SERVICE] Failed to auto-dispatch WhatsApp batch ${b.batch_id}:`, dispatchErr.message);
              }
            }
          }
        } catch (batchErr) {
          logger.error(`Error in batch creation/dispatch for import ${batchId}: ${batchErr.message}`);
        }

        // Safety guarantee: Ensure every eligible order from this import has verification initiated
        try {
          const unverifiedOrders = await Order.findAll({
            where: {
              import_batch_id: batchId,
              status: { [Op.in]: ['pending', 'pending_verification', 'new', 'unconfirmed'] },
              confirmation_message_sent_at: null,
            },
            attributes: ['id', 'order_number', 'customer_phone', 'customer_name', 'product_name', 'product_sku'],
          });

          for (const ord of unverifiedOrders) {
            try {
              const existingOutbox = await WhatsAppOutbox.findOne({
                where: {
                  order_id: ord.id,
                  template_name: 'order_verification_interactive',
                },
              });

              if (!existingOutbox) {
                await OrderVerificationWorkflowService.initiateFirstVerification({
                  orderId: ord.id,
                  triggerWorker: false,
                });
              }
            } catch (ordInitErr) {
              logger.debug(`Direct verification trigger note for order ${ord.id}: ${ordInitErr.message}`);
            }
          }
        } catch (unverifErr) {
          logger.warn(`Safety scan for unverified orders in batch ${batchId}: ${unverifErr.message}`);
        }

        // Actively drain the outbox queue immediately to dispatch all messages without delay
        logger.info(`[CSV SERVICE] Actively draining WhatsApp outbox queue for import ${batchId}...`);
        whatsappOutboxQueue.drainQueue().catch((dqErr) => {
          logger.error(`[CSV SERVICE] Outbox queue drain error for import ${batchId}:`, dqErr);
        });
      } catch (globalErr) {
        logger.error(`[CSV SERVICE] Error finalizing WhatsApp triggers for import ${batchId}:`, globalErr);
      }
    }

    // Determine final status
    const finalStatus =
      failedRows === totalRows && totalRows > 0
        ? 'failed'
        : failedRows > 0
        ? 'partial'
        : 'completed';

    await batch.update({
      status: finalStatus,
      total_rows: totalRows,
      processed_rows: totalRows,
      success_rows: successRows,
      failed_rows: failedRows,
      duplicate_rows: duplicateRows,
      error_log: errorLog,
      processed_at: new Date(),
    });

    logger.info(
      `CSV batch ${batchId} finished: ${successRows} ok, ${failedRows} failed, ${duplicateRows} duplicates, total ${totalRows} rows.`
    );

    return { successRows, failedRows, duplicateRows, total: totalRows };
  } catch (fatalErr) {
    logger.error(`Fatal uncaught error in CSV batch ${batchId}:`, fatalErr);
    try {
      await batch.update({
        status: 'failed',
        error_log: [{ error: `Fatal processing error: ${fatalErr.message}` }],
        processed_at: new Date(),
      });
    } catch (saveErr) {
      logger.error(`Failed to record batch failure state for ${batchId}:`, saveErr);
    }
  }
};

// ─── Universal Shipping Bulk Upload (Dispatched/In-Transit & Delivered Progression) ───
const processShippingBulkUpload = async (filePath, options = {}) => {
  const rows = await parseFile(filePath);
  if (!rows.length) {
    return {
      total: 0,
      updatedInTransit: 0,
      updatedDelivered: 0,
      newlyCreated: 0,
      alreadyDelivered: 0,
      errors: [],
    };
  }

  logger.info(`Shipping Bulk Upload: Processing ${rows.length} rows (Partner: ${options.defaultShippingPartner || 'Auto'}, Channel: ${options.defaultChannel || 'Auto'})`);

  const results = {
    total: rows.length,
    updatedInTransit: 0,
    updatedDelivered: 0,
    newlyCreated: 0,
    alreadyDelivered: 0,
    errors: [],
  };

  const { ensureCustomerOnDelivery } = require('../controllers/orderController');
  const { OrderActivity } = require('../models');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const lookup = buildRowLookup(row);

    try {
      const orderId         = extractField(row, SHIPPING_FIELD_MAP.order_id, lookup);
      const trackingNumber  = extractField(row, SHIPPING_FIELD_MAP.tracking_number, lookup);
      const carrierRaw      = extractField(row, SHIPPING_FIELD_MAP.carrier, lookup);
      const rawStatus       = extractField(row, SHIPPING_FIELD_MAP.status, lookup);
      const dispatchedDate  = extractField(row, SHIPPING_FIELD_MAP.dispatched_date, lookup);
      const deliveredDate   = extractField(row, SHIPPING_FIELD_MAP.delivered_date, lookup);
      const customerName    = extractField(row, SHIPPING_FIELD_MAP.customer_name, lookup);
      const customerPhone   = extractField(row, SHIPPING_FIELD_MAP.customer_phone, lookup);
      const pincode         = extractField(row, SHIPPING_FIELD_MAP.pincode, lookup);
      const city            = extractField(row, SHIPPING_FIELD_MAP.city, lookup);
      const state           = extractField(row, SHIPPING_FIELD_MAP.state, lookup);
      const addressLine     = extractField(row, SHIPPING_FIELD_MAP.address, lookup);
      const productName     = extractField(row, SHIPPING_FIELD_MAP.product_name, lookup);
      const totalAmount     = extractField(row, SHIPPING_FIELD_MAP.total_amount, lookup);

      if (!orderId && !trackingNumber) {
        results.errors.push({ row: rowNum, error: 'Missing both Order ID and Tracking/AWB Number — skipped.' });
        continue;
      }

      const carrierName = carrierRaw || options.defaultShippingPartner || null;
      const targetStatus = parseShippingStatus(rawStatus, !!deliveredDate, !!trackingNumber);

      // ── Find matching order in CRM ─────────────────────────────────────────
      let order = null;

      if (orderId) {
        const cleanId = String(orderId).replace(/^#/, '').trim();
        order = await Order.findOne({
          where: {
            [Op.or]: [
              { order_number: orderId },
              { order_number: cleanId },
              { marketplace_order_id: orderId },
              { marketplace_order_id: cleanId },
            ],
          },
        });
      }

      if (!order && trackingNumber) {
        order = await Order.findOne({
          where: { tracking_number: String(trackingNumber).trim() },
        });
      }

      // ── Branch A: Existing Order in CRM ───────────────────────────────────
      if (order) {
        const prevStatus = order.status;

        // Gating: Shipping updates can only transition orders in 'confirmed' or 'dispatched' status
        if (!['confirmed', 'dispatched', 'delivered'].includes(order.status)) {
          results.errors.push({
            row: rowNum,
            error: `Order #${order.order_number} is in '${order.status}' status. Shipping updates can only be applied to confirmed or dispatched orders.`,
          });
          logger.warn(`Shipping Bulk Upload row ${rowNum}: Order #${order.order_number} status '${order.status}' cannot transition via shipping upload.`);
          continue;
        }

        if (targetStatus === 'delivered') {
          // If already delivered, protect idempotency
          if (order.status === 'delivered') {
            results.alreadyDelivered++;
            // Backfill tracking or partner if missing
            const backfill = {};
            if (trackingNumber && !order.tracking_number) backfill.tracking_number = trackingNumber;
            if (carrierName && !order.shipping_partner) backfill.shipping_partner = carrierName;
            if (Object.keys(backfill).length > 0) await order.update(backfill);
            continue;
          }

          // Advance to Delivered across the CRM
          const t = await sequelize.transaction();
          try {
            const parsedDelDate = deliveredDate ? parseFlexibleDate(deliveredDate) : new Date();
            await order.update({
              status:       'delivered',
              delivered_at: parsedDelDate || new Date(),
              flow_stage:   'installation',
              ...(trackingNumber && { tracking_number: trackingNumber }),
              ...(carrierName && { shipping_partner: carrierName }),
            }, { transaction: t });

            // Create/register Customer profile in CRM and link customer_id
            await ensureCustomerOnDelivery(order, t);

            await t.commit();
            results.updatedDelivered++;
            logger.info(`Shipping Bulk Upload: Order ${order.order_number} (${order.marketplace_order_id || 'N/A'}) transitioned to DELIVERED`);

            // Post-commit triggers
            if (options.userId) {
              try {
                await OrderActivity.create({
                  order_id: order.id,
                  user_id: options.userId,
                  action: 'status_changed',
                  from_value: prevStatus,
                  to_value: 'delivered',
                  note: 'Status updated to delivered via Shipping Bulk Upload.',
                });
              } catch (actErr) {
                logger.warn(`OrderActivity log notice: ${actErr.message}`);
              }
            }

            try {
              const DeliveryEventOrchestrator = require('./orderWorkflow/deliveryEventOrchestrator');
              await DeliveryEventOrchestrator.handleOrderDelivered(order, { actor: options.userId, source: 'shipping_bulk_upload' });
            } catch (orchErr) {
              logger.warn(`DeliveryEventOrchestrator notice for ${order.id}: ${orchErr.message}`);
            }
          } catch (err) {
            await t.rollback();
            throw err;
          }
        } else if (targetStatus === 'dispatched') {
          // Status is in transit / shipped
          if (order.status === 'delivered') {
            // Never regress an already delivered order back to transit
            results.alreadyDelivered++;
            continue;
          }

          const parsedShipDate = dispatchedDate ? parseFlexibleDate(dispatchedDate) : (order.dispatched_at || new Date());
          const updateFields = {
            status:        'dispatched',
            dispatched_at: parsedShipDate,
            ...(trackingNumber && { tracking_number: trackingNumber }),
            ...(carrierName && { shipping_partner: carrierName }),
          };

          await order.update(updateFields);
          results.updatedInTransit++;
          logger.info(`Shipping Bulk Upload: Order ${order.order_number} updated to IN_TRANSIT / DISPATCHED`);

          if (prevStatus !== 'dispatched') {
            try {
              const DeliveryEventOrchestrator = require('./orderWorkflow/deliveryEventOrchestrator');
              await DeliveryEventOrchestrator.handleOrderDispatched(order, { actor: options.userId, source: 'shipping_bulk_upload' });
            } catch (waErr) {
              logger.warn(`WhatsApp dispatch notification notice for ${order.id}: ${waErr.message}`);
            }
          }

          if (options.userId && prevStatus !== 'dispatched') {
            try {
              await OrderActivity.create({
                order_id: order.id,
                user_id: options.userId,
                action: 'status_changed',
                from_value: prevStatus,
                to_value: 'dispatched',
                note: 'Status marked as dispatched/in_transit via Shipping Bulk Upload.',
              });
            } catch (actErr) {
              logger.warn(`OrderActivity log notice: ${actErr.message}`);
            }
          }
        } else if (targetStatus === 'returned') {
          await order.update({ status: 'returned' });
          if (options.userId && prevStatus !== 'returned') {
            try {
              await OrderActivity.create({
                order_id: order.id,
                user_id: options.userId,
                action: 'status_changed',
                from_value: prevStatus,
                to_value: 'returned',
                note: 'Status updated to returned/RTO via Shipping Bulk Upload.',
              });
            } catch (actErr) {
              logger.warn(`OrderActivity log notice: ${actErr.message}`);
            }
          }
        }
      } else {
        // Branch B: Order does NOT exist in CRM (shipping upload cannot create new orders)
        results.errors.push({
          row: rowNum,
          error: `Order '${orderId || trackingNumber}' not found in CRM. Shipping details can only be applied to existing confirmed orders.`,
        });
        logger.warn(`Shipping Bulk Upload row ${rowNum}: Order '${orderId || trackingNumber}' not found in CRM.`);
      }
    } catch (err) {
      results.errors.push({ row: rowNum, error: err.message });
      logger.warn(`Shipping Bulk Upload row ${rowNum}: ${err.message}`);
    }
  }

  return results;
};

// Backward-compatible wrapper for Delivery CSV
const processDeliveryCsv = async (filePath) => {
  const uploadResult = await processShippingBulkUpload(filePath, {});
  return {
    matched: uploadResult.updatedDelivered,
    alreadyDelivered: uploadResult.alreadyDelivered,
    notFound: uploadResult.errors.length,
    errors: uploadResult.errors,
    total: uploadResult.total,
  };
};

module.exports = {
  processBatch,
  processDeliveryCsv,
  processShippingBulkUpload,
  parseShippingStatus,
  parseFile,
  parseFlexibleDate,
  cleanPhone,
  sanitizeEmail,
  FIELD_MAPS,
  UNIVERSAL_FIELD_MAP,
  SHIPPING_FIELD_MAP,
  DELIVERY_FIELD_MAP,
};


