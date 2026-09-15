'use strict';

const AocProvider = require('./providers/aocProvider');
const MetaProvider = require('./providers/metaProvider');
const logger = require('../../config/logger');

let cachedProviderInstance = null;
let currentConfiguredProviderName = null;

class WhatsAppProviderFactory {
  /**
   * Resolves and returns the configured WhatsApp provider instance.
   * STRICT ENFORCEMENT: Selection comes exclusively from process.env.WHATSAPP_PROVIDER.
   * Default fallback is 'aoc' if unspecified.
   *
   * @param {Object} [overrideConfig] - Optional explicit options
   * @returns {AocProvider|MetaProvider}
   */
  static getProvider(overrideConfig = {}) {
    const providerName = (
      overrideConfig.provider ||
      process.env.WHATSAPP_PROVIDER ||
      'aoc'
    ).toLowerCase().trim();

    // Cache provider instance if config hasn't changed
    if (cachedProviderInstance && currentConfiguredProviderName === providerName && !Object.keys(overrideConfig).length) {
      return cachedProviderInstance;
    }

    let instance;
    switch (providerName) {
      case 'aoc':
        instance = new AocProvider(overrideConfig);
        break;

      case 'meta':
        instance = new MetaProvider(overrideConfig);
        break;

      default:
        throw new Error(
          `Unsupported WHATSAPP_PROVIDER configuration: "${providerName}". Must be "aoc" or "meta".`
        );
    }

    if (!Object.keys(overrideConfig).length) {
      cachedProviderInstance = instance;
      currentConfiguredProviderName = providerName;
    }

    logger.debug(`[WhatsApp Provider Factory] Initialized active provider: ${providerName.toUpperCase()}`);
    return instance;
  }

  /**
   * Clear cache (useful in tests when flipping env vars)
   */
  static reset() {
    cachedProviderInstance = null;
    currentConfiguredProviderName = null;
  }
}

module.exports = WhatsAppProviderFactory;
