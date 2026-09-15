'use strict';

const CanonicalOrderDTO = require('./canonicalOrderDTO');

// Field alias dictionary covering Amazon, Flipkart, IndiaMART, Website/Shopify, Direct, and custom templates
const FIELD_ALIASES = {
  external_order_id: [
    'order-id', 'order id', 'order_id', 'orderid', 'amazon-order-id', 'amazon order id',
    'order no', 'order number', 'order_no', 'order_number', 'orderno', 'ordernumber',
    'invoice no', 'invoice_no', 'bill no', 'order #', 'merchant-order-id', 'inquiry no',
    'inquiry id', 'lead id', 'query id', 'inquiry_no', 'fsn', 'id', 'order id.', 'order no.', 'order#',
    'order item id', 'order_item_id', 'orderitemid', 'tracking id', 'tracking_id', 'reference no',
    'ref no', 'lead_id', 'query_id', 'inq_id', 'po number', 'po_number', 'name'
  ],
  order_date: [
    'purchase-date', 'purchase date', 'purchasedate', 'order_date', 'orderdate', 'order date',
    'payments-date', 'date', 'invoice date', 'order created date', 'inquiry date', 'lead date',
    'query date', 'date & time', 'created at', 'created_at', 'order_time', 'paid at', 'paid_at',
    'created_at', 'lead_date', 'inquiry_date'
  ],
  customer_name: [
    'buyer-name', 'recipient-name', 'buyername', 'recipientname', 'buyer name', 'customer name',
    'recipient name', 'name', 'customer', 'customer_name', 'customername', 'buyer',
    'contact person', 'sender name', 'client name', 'billing name', 'shipping name', 'full name',
    'buyer name.', 'customer name.', 'sender', 'sender_name', 'client', 'contact_name', 'billing_name',
    'shipping_name'
  ],
  customer_phone: [
    'buyer-phone-number', 'buyerphone', 'bill-phone-no', 'buyer-phone', 'phone', 'mobile',
    'phone number', 'contact number', 'buyer phone', 'phone_number', 'phonenumber',
    'customer contact number', 'customer phone', 'sender mobile', 'sender phone', 'mobile number',
    'billing phone', 'contact no', 'mobile no', 'mobile no.', 'telephone', 'tel', 'phone no', 'phone no.',
    'contact no.', 'mob no', 'mob no.', 'mob', 'customer_phone', 'whatsapp number', 'whatsapp_number',
    'whatsapp', 'ship-phone-number', 'shipphone', 'delivery phone', 'contact', 'cell',
    'shipping phone', 'shipping_phone', 'billing_phone', 'sender_mobile', 'sender_phone', 'mobile_no'
  ],
  customer_email: [
    'buyer-email', 'buyeremail', 'email', 'e-mail', 'customer email', 'customer_email',
    'billing email', 'sender email', 'contact email', 'shipping email', 'sender_email',
    'billing_email', 'shipping_email'
  ],
  product_name: [
    'product-name', 'item-name', 'productname', 'itemname', 'product name', 'item name',
    'title', 'product title', 'item description', 'product', 'item', 'product / service name',
    'requirement', 'subject', 'description', 'product description', 'item_name', 'lineitem name',
    'lineitem_name', 'product_title', 'product / service', 'item_description'
  ],
  product_sku: [
    'sku', 'merchant-sku', 'merchantsku', 'asin', 'item sku', 'seller sku', 'fsn',
    'product_sku', 'productsku', 'item code', 'product code', 'item sku / code',
    'model number', 'model no', 'barcode', 'sku_code', 'lineitem sku', 'lineitem_sku',
    'item_code', 'product_code'
  ],
  quantity: [
    'quantity-purchased', 'quantitypurchased', 'quantity', 'qty', 'item-quantity',
    'quantity purchased', 'item quantity', 'item_quantity', 'order quantity', 'count',
    'units', 'no of items', 'qty_purchased', 'lineitem quantity', 'lineitem_quantity'
  ],
  unit_price: [
    'item-price', 'itemprice', 'item price', 'unit-price', 'unitprice', 'unit price',
    'price', 'selling price', 'selling_price', 'rate', 'unit rate', 'cost per item',
    'lineitem price', 'lineitem_price', 'unit_rate'
  ],
  total_amount: [
    'item-price', 'itemprice', 'item-total', 'itemtotal', 'total', 'order total',
    'total amount', 'item total', 'principal', 'final settlement amount', 'total_amount',
    'net amount', 'invoice amount', 'grand total', 'gross amount', 'total (inr)', 'order value',
    'amount', 'value', 'order_total', 'total_value', 'subtotal'
  ],
  latest_ship_date: [
    'latest-ship-date', 'latestshipdate', 'latest ship date', 'ship by date', 'ship-by-date',
    'ship by', 'ship date', 'dispatch_by', 'ship_date'
  ],
  earliest_delivery_date: [
    'earliest-delivery-date', 'earliestdeliverydate', 'earliest delivery date',
    'delivery-start-date', 'delivery start date', 'delivery_start_date'
  ],
  estimated_delivery_date: [
    'latest-delivery-date', 'latestdeliverydate', 'latest delivery date', 'deliver by date',
    'delivery-end-date', 'expected delivery date', 'deliver by', 'estimated delivery date',
    'delivery_date', 'expected_delivery_date'
  ],
  address_line1: [
    'ship-address-1', 'shipaddress1', 'address 1', 'shipping-address-1', 'ship address 1',
    'address line 1', 'delivery address', 'address_line1', 'addressline1', 'address',
    'delivery address line 1', 'shipping address', 'street address', 'location', 'sender address',
    'shipping address 1', 'billing address 1', 'street', 'sender_address', 'shipping_street'
  ],
  address_line2: [
    'ship-address-2', 'shipaddress2', 'address 2', 'shipping-address-2', 'ship address 2',
    'address line 2', 'address_line2', 'delivery address line 2', 'apartment', 'suite',
    'shipping address 2', 'billing address 2', 'shipping_address_2'
  ],
  city: [
    'ship-city', 'shipcity', 'city', 'shipping-city', 'ship city', 'delivery city',
    'shipping city', 'town', 'district', 'sender city', 'billing city', 'shipping_city',
    'sender_city'
  ],
  state: [
    'ship-state', 'shipstate', 'state', 'shipping-state', 'ship state', 'delivery state',
    'shipping state', 'province', 'region', 'sender state', 'billing state', 'shipping_state',
    'sender_state'
  ],
  postal_code: [
    'ship-postal-code', 'shippostalcode', 'postal code', 'postal-code', 'pincode', 'pin code',
    'zip', 'zipcode', 'zip code', 'delivery pincode', 'shipping pincode', 'ship-postalcode',
    'sender pincode', 'shipping zip', 'billing zip', 'sender_pincode', 'shipping_zip'
  ],
  country: [
    'ship-country', 'shipcountry', 'country', 'shipping-country', 'ship country', 'country code'
  ],
};

/**
 * Base Channel Adapter
 */
class BaseChannelAdapter {
  constructor(channelName = 'direct') {
    this.channelName = channelName || 'direct';
  }

  /**
   * Finds the value in raw row using aliases
   */
  findValue(row, fieldKey) {
    if (!row || typeof row !== 'object') return null;
    const aliases = FIELD_ALIASES[fieldKey] || [];
    const cleanStr = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    const normalizedKeys = Object.keys(row).reduce((acc, key) => {
      const c = cleanStr(key);
      if (c) acc[c] = row[key];
      return acc;
    }, {});

    // Try exact alias matches first
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '') {
        return row[alias];
      }
      const strippedAlias = cleanStr(alias);
      if (normalizedKeys[strippedAlias] !== undefined && normalizedKeys[strippedAlias] !== null && String(normalizedKeys[strippedAlias]).trim() !== '') {
        return normalizedKeys[strippedAlias];
      }
    }
    return null;
  }

  /**
   * Normalizes Indian and International phone numbers to +91XXXXXXXXXX or standard E.164
   */
  normalizePhone(rawPhone) {
    if (!rawPhone) return null;
    let clean = String(rawPhone).trim().replace(/[^\d+]/g, '');
    if (!clean) return null;

    if (clean.startsWith('+')) {
      const digits = clean.slice(1);
      if (digits.length === 10) return `+91${digits}`;
      return clean;
    }

    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      return `+${digitsOnly}`;
    }
    if (digitsOnly.length > 10) {
      const last10 = digitsOnly.slice(-10);
      return `+91${last10}`;
    }
    if (digitsOnly.length >= 7) {
      return `+91${digitsOnly}`;
    }
    return digitsOnly.length > 0 ? `+${digitsOnly}` : null;
  }

  /**
   * Parses various date formats
   */
  parseDate(rawDate) {
    if (!rawDate) return null;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) return rawDate;

    // Excel serial number handling
    if (typeof rawDate === 'number' && rawDate > 20000 && rawDate < 60000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      return new Date(excelEpoch.getTime() + rawDate * 86400000);
    }

    const str = String(rawDate).trim();
    // Try DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const d = new Date(Date.UTC(year, month, day));
      if (!isNaN(d.getTime())) return d;
    }

    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Parses numeric monetary amounts
   */
  parseNumber(rawNum) {
    if (rawNum == null) return null;
    if (typeof rawNum === 'number') return isNaN(rawNum) ? null : rawNum;
    const clean = String(rawNum).replace(/[^\d.-]/g, '');
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  }

  /**
   * Adapts a single raw row to CanonicalOrderDTO
   */
  adaptRow(row) {
    let externalOrderId = this.findValue(row, 'external_order_id');
    // Intelligent order id extraction: if header was 'Name' with leading # (Shopify), treat as order id
    if (!externalOrderId && row['Name'] && (String(row['Name']).startsWith('#') || /^\d+$/.test(String(row['Name']).trim()))) {
      externalOrderId = row['Name'];
    }

    const customerPhone = this.normalizePhone(this.findValue(row, 'customer_phone'));
    let customerName = this.findValue(row, 'customer_name');
    if (!customerName || (customerName === externalOrderId && row['Buyer Name'])) {
      customerName = row['Buyer Name'] || row['Recipient Name'] || 'Valued Customer';
    }
    const customerEmail = this.findValue(row, 'customer_email');
    const productName = this.findValue(row, 'product_name') || 'Product';
    const productSku = this.findValue(row, 'product_sku') || 'DEFAULT-SKU';
    const quantity = parseInt(this.findValue(row, 'quantity'), 10) || 1;
    const unitPrice = this.parseNumber(this.findValue(row, 'unit_price'));
    const totalAmount = this.parseNumber(this.findValue(row, 'total_amount')) || (unitPrice ? unitPrice * quantity : 0);
    const orderDate = this.parseDate(this.findValue(row, 'order_date')) || new Date();

    const addressLine1 = this.findValue(row, 'address_line1');
    const addressLine2 = this.findValue(row, 'address_line2');
    const city = this.findValue(row, 'city');
    const state = this.findValue(row, 'state');
    const postalCode = this.findValue(row, 'postal_code');
    const country = this.findValue(row, 'country') || 'India';

    const shippingAddress = {
      address_line1: addressLine1 || '',
      address_line2: addressLine2 || '',
      city: city || '',
      state: state || '',
      postal_code: postalCode || '',
      country: country || 'India',
    };

    const latestShipDate = this.parseDate(this.findValue(row, 'latest_ship_date'));
    const earliestDeliveryDate = this.parseDate(this.findValue(row, 'earliest_delivery_date'));
    const estimatedDeliveryDate = this.parseDate(this.findValue(row, 'estimated_delivery_date'));

    const cleanOrderNumber = externalOrderId ? String(externalOrderId).trim() : null;

    return new CanonicalOrderDTO({
      channel: this.channelName,
      external_order_id: cleanOrderNumber,
      order_number: cleanOrderNumber,
      customer_name: String(customerName || 'Valued Customer').trim(),
      customer_phone: customerPhone,
      customer_email: customerEmail ? String(customerEmail).trim() : null,
      product_name: String(productName).trim(),
      product_sku: String(productSku).trim(),
      quantity: quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
      order_date: orderDate,
      shipping_address: shippingAddress,
      delivery_pincode: postalCode ? String(postalCode).trim() : null,
      latest_ship_date: latestShipDate,
      earliest_delivery_date: earliestDeliveryDate,
      estimated_delivery_date: estimatedDeliveryDate,
      raw_data: row,
    });
  }
}

class AmazonAdapter extends BaseChannelAdapter {
  constructor(channelName = 'amazon') {
    super(channelName || 'amazon');
  }
}

class FlipkartAdapter extends BaseChannelAdapter {
  constructor(channelName = 'flipkart') {
    super(channelName || 'flipkart');
  }
}

class IndiaMartAdapter extends BaseChannelAdapter {
  constructor(channelName = 'indiamart') {
    super(channelName || 'indiamart');
  }
}

class WebsiteAdapter extends BaseChannelAdapter {
  constructor(channelName = 'akuabeat_website') {
    super(channelName || 'akuabeat_website');
  }
}

class DirectAdapter extends BaseChannelAdapter {
  constructor(channelName = 'direct') {
    super(channelName || 'direct');
  }
}

class ChannelAdapterFactory {
  static getAdapter(channel = '', sampleRow = {}) {
    const ch = (channel || '').toLowerCase().trim();
    if (ch.includes('amazon')) return new AmazonAdapter(channel || 'amazon');
    if (ch.includes('flipkart')) return new FlipkartAdapter(channel || 'flipkart');
    if (ch.includes('indiamart')) return new IndiaMartAdapter(channel || 'indiamart');
    if (ch.includes('website') || ch.includes('shopify') || ch.includes('akuabeat')) return new WebsiteAdapter(channel || 'akuabeat_website');

    // Auto-detect based on row column keys
    if (sampleRow && typeof sampleRow === 'object') {
      const keys = Object.keys(sampleRow).map((k) => k.toLowerCase());
      if (keys.some((k) => k.includes('amazon') || k === 'order-id' || k === 'asin')) {
        return new AmazonAdapter(channel || 'amazon');
      }
      if (keys.some((k) => k.includes('flipkart') || k === 'fsn')) {
        return new FlipkartAdapter(channel || 'flipkart');
      }
      if (keys.some((k) => k.includes('query id') || k.includes('inquiry no') || k.includes('sender mobile'))) {
        return new IndiaMartAdapter(channel || 'indiamart');
      }
    }

    return new DirectAdapter(channel || 'direct');
  }
}

module.exports = {
  BaseChannelAdapter,
  AmazonAdapter,
  FlipkartAdapter,
  IndiaMartAdapter,
  WebsiteAdapter,
  DirectAdapter,
  ChannelAdapterFactory,
};
