'use strict';

class OrderValidator {
  /**
   * Validates a CanonicalOrderDTO before database persistence.
   *
   * @param {import('./canonicalOrderDTO')} dto
   * @param {number} [rowIndex=1]
   * @returns {{ isValid: boolean, errors: string[], structuredErrors: Array<{ field: string, problem: string, value: any, reason: string }>, dto: import('./canonicalOrderDTO') }}
   */
  static validate(dto, rowIndex = 1) {
    const errors = [];
    const structuredErrors = [];

    if (!dto) {
      const err = {
        field: 'general',
        problem: 'Empty record',
        value: null,
        reason: 'Order data object is empty or undefined',
      };
      return {
        isValid: false,
        errors: [err.reason],
        structuredErrors: [err],
        dto: null,
      };
    }

    // 1. Order Number check
    if (!dto.order_number || String(dto.order_number).trim() === '') {
      if (dto.external_order_id && String(dto.external_order_id).trim() !== '') {
        dto.order_number = String(dto.external_order_id).trim();
      } else {
        const err = {
          field: 'order_number',
          problem: 'Missing order identifier',
          value: dto.order_number,
          reason: 'Order row is missing order_number or external_order_id',
        };
        errors.push(err.reason);
        structuredErrors.push(err);
      }
    }

    // 2. Customer Phone check (if provided, must be >= 10 digits; if omitted, allow exception review)
    if (dto.customer_phone) {
      const digitsOnly = String(dto.customer_phone).replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        const err = {
          field: 'customer_phone',
          problem: 'Invalid phone number format',
          value: dto.customer_phone,
          reason: `Phone number "${dto.customer_phone}" contains fewer than 10 digits`,
        };
        errors.push(err.reason);
        structuredErrors.push(err);
      }
    } else {
      structuredErrors.push({
        field: 'customer_phone',
        problem: 'Missing phone',
        value: null,
        reason: 'Customer phone number omitted in marketplace report; flagged for exception review',
      });
      dto.customer_phone = null;
    }

    // 3. Customer Email normalization (prevent Sequelize validation error on invalid emails)
    if (dto.customer_email) {
      const emailStr = String(dto.customer_email).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailStr)) {
        dto.customer_email = null;
      } else {
        dto.customer_email = emailStr.toLowerCase();
      }
    } else {
      dto.customer_email = null;
    }

    // 4. Product details fallback
    if (!dto.product_name && !dto.product_sku) {
      dto.product_name = 'Standard Product';
      dto.product_sku = 'DEFAULT-SKU';
    } else if (!dto.product_name) {
      dto.product_name = dto.product_sku;
    } else if (!dto.product_sku) {
      dto.product_sku = 'DEFAULT-SKU';
    }

    // 5. Quantity normalization
    if (dto.quantity === undefined || dto.quantity === null || isNaN(dto.quantity) || dto.quantity <= 0) {
      dto.quantity = 1;
    }

    // 6. Customer name normalization
    if (!dto.customer_name || String(dto.customer_name).trim() === '') {
      dto.customer_name = 'Valued Customer';
    }

    return {
      isValid: errors.length === 0,
      errors,
      structuredErrors,
      dto,
    };
  }
}

module.exports = OrderValidator;
