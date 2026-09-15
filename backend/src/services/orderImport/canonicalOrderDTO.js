'use strict';

/**
 * Canonical Order Data Transfer Object (DTO).
 * Every order source (Amazon, Flipkart, IndiaMART, Website, Direct, CSV, XLSX, TSV)
 * converges into this normalized structure before validation and database persistence.
 */
class CanonicalOrderDTO {
  constructor(data = {}) {
    this.channel = (data.channel || 'direct').toLowerCase().trim();
    this.external_order_id = data.external_order_id ? String(data.external_order_id).trim() : null;
    this.order_number = data.order_number ? String(data.order_number).trim() : this.external_order_id;
    this.customer_name = data.customer_name ? String(data.customer_name).trim() : 'Valued Customer';
    this.customer_phone = data.customer_phone ? String(data.customer_phone).trim() : null;
    this.customer_email = data.customer_email ? String(data.customer_email).trim() : null;
    this.product_name = data.product_name ? String(data.product_name).trim() : 'Standard Product';
    this.product_sku = data.product_sku ? String(data.product_sku).trim() : 'GEN-SKU';
    this.quantity = Math.max(1, parseInt(data.quantity, 10) || 1);
    this.unit_price = data.unit_price != null && !isNaN(Number(data.unit_price)) ? Number(data.unit_price) : null;
    this.total_amount = data.total_amount != null && !isNaN(Number(data.total_amount)) ? Number(data.total_amount) : (this.unit_price ? this.unit_price * this.quantity : 0);
    this.order_date = data.order_date ? new Date(data.order_date) : new Date();
    this.shipping_address = data.shipping_address || null;
    this.delivery_pincode = data.delivery_pincode ? String(data.delivery_pincode).trim() : null;
    this.latest_ship_date = data.latest_ship_date ? new Date(data.latest_ship_date) : null;
    this.earliest_delivery_date = data.earliest_delivery_date ? new Date(data.earliest_delivery_date) : null;
    this.estimated_delivery_date = data.estimated_delivery_date ? new Date(data.estimated_delivery_date) : null;
    this.raw_data = data.raw_data || {};
  }

  toJSON() {
    return {
      channel: this.channel,
      external_order_id: this.external_order_id,
      order_number: this.order_number,
      customer_name: this.customer_name,
      customer_phone: this.customer_phone,
      customer_email: this.customer_email,
      product_name: this.product_name,
      product_sku: this.product_sku,
      quantity: this.quantity,
      unit_price: this.unit_price,
      total_amount: this.total_amount,
      order_date: this.order_date,
      shipping_address: this.shipping_address,
      delivery_pincode: this.delivery_pincode,
      latest_ship_date: this.latest_ship_date,
      earliest_delivery_date: this.earliest_delivery_date,
      estimated_delivery_date: this.estimated_delivery_date,
      raw_data: this.raw_data,
    };
  }
}

module.exports = CanonicalOrderDTO;
