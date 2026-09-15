'use strict';

/**
 * Product Master Abstraction / Lookup Service
 * Allows searching and comparing ordered products against product master catalog.
 */

// Dynamic / configured catalog
const PRODUCT_MASTER_CATALOG = [];

/**
 * Lookup product master by SKU
 * @param {string} sku
 * @returns {object|null}
 */
const getBySku = (sku) => {
  if (!sku) return null;
  const normalizedSku = sku.trim().toUpperCase();
  const found = PRODUCT_MASTER_CATALOG.find((p) => p.sku.toUpperCase() === normalizedSku);
  if (found) return found;

  return null;
};

/**
 * Search products by query string
 * @param {string} query
 * @returns {Array}
 */
const searchProducts = (query) => {
  if (!query) return PRODUCT_MASTER_CATALOG;
  const q = query.toLowerCase();
  return PRODUCT_MASTER_CATALOG.filter(
    (p) =>
      p.sku.toLowerCase().includes(q) ||
      p.product_name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
  );
};

module.exports = {
  getBySku,
  searchProducts,
  PRODUCT_MASTER_CATALOG,
};
