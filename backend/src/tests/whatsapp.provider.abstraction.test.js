'use strict';

const assert = require('assert');
const WhatsAppProviderFactory = require('../services/whatsapp/whatsappProviderFactory');
const AocProvider = require('../services/whatsapp/providers/aocProvider');
const MetaProvider = require('../services/whatsapp/providers/metaProvider');

async function runFeature2AcceptanceTests() {
  console.log('🧪 RUNNING FEATURE 2 ACCEPTANCE TESTS: WhatsApp Provider Abstraction\n');

  // Test 1: Provider selection strictly comes from WHATSAPP_PROVIDER env
  console.log('1. Verifying WHATSAPP_PROVIDER=aoc resolves AocProvider...');
  process.env.WHATSAPP_PROVIDER = 'aoc';
  WhatsAppProviderFactory.reset();
  const aocProvider = WhatsAppProviderFactory.getProvider();
  assert(aocProvider instanceof AocProvider, 'Must be an instance of AocProvider');
  assert.strictEqual(aocProvider.name, 'aoc');
  console.log('   ✓ AocProvider correctly selected via configuration.');

  console.log('2. Verifying WHATSAPP_PROVIDER=meta resolves MetaProvider...');
  process.env.WHATSAPP_PROVIDER = 'meta';
  WhatsAppProviderFactory.reset();
  const metaProvider = WhatsAppProviderFactory.getProvider();
  assert(metaProvider instanceof MetaProvider, 'Must be an instance of MetaProvider');
  assert.strictEqual(metaProvider.name, 'meta');
  console.log('   ✓ MetaProvider correctly selected via configuration.');

  // Test 2: Inbound AOC media ID must use AOC media retrieval
  console.log('3. Verifying AOC media retrieval implementation with WHATSAPP_PROVIDER=aoc...');
  process.env.WHATSAPP_PROVIDER = 'aoc';
  WhatsAppProviderFactory.reset();
  const provider = WhatsAppProviderFactory.getProvider();

  let aocMediaCalled = false;
  // Monkey-patch fetch to intercept AOC call and verify AOC endpoint is hit
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    const urlStr = String(url);
    if (urlStr.includes('aoc-portal.com') || urlStr.includes('media/mock_aoc_media_123')) {
      aocMediaCalled = true;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        arrayBuffer: async () => Buffer.from('fake-image-bytes'),
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    const mediaResult = await provider.downloadMedia({ mediaId: 'mock_aoc_media_123' });
    assert.strictEqual(aocMediaCalled, true, 'AOC endpoint must be called');
    assert.strictEqual(mediaResult.provider, 'aoc');
    assert.strictEqual(mediaResult.mimeType, 'image/jpeg');
    console.log('   ✓ AOC media retrieval implementation strictly invoked.');
  } finally {
    global.fetch = originalFetch;
  }

  // Test 3: Unsupported provider rejection
  console.log('4. Verifying invalid WHATSAPP_PROVIDER configuration throws...');
  process.env.WHATSAPP_PROVIDER = 'invalid_gateway';
  WhatsAppProviderFactory.reset();
  assert.throws(
    () => {
      WhatsAppProviderFactory.getProvider();
    },
    /Unsupported WHATSAPP_PROVIDER configuration/
  );
  console.log('   ✓ Invalid WHATSAPP_PROVIDER correctly rejected.');

  // Test 4: Webhook normalization parity
  console.log('5. Verifying button webhook normalization on AOC provider...');
  process.env.WHATSAPP_PROVIDER = 'aoc';
  WhatsAppProviderFactory.reset();
  const activeAoc = WhatsAppProviderFactory.getProvider();
  const mockAocWebhook = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: 'wamid.test.123',
                  from: '919876543210',
                  type: 'interactive',
                  interactive: {
                    button_reply: {
                      id: 'order_confirm',
                      title: 'Confirm Order',
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const normalized = activeAoc.normalizeWebhook(mockAocWebhook);
  assert.strictEqual(normalized.length, 1);
  assert.strictEqual(normalized[0].type, 'button');
  assert.strictEqual(normalized[0].buttonId, 'order_confirm');
  assert.strictEqual(normalized[0].senderPhone, '9876543210');
  console.log('   ✓ Webhook normalization parsed canonical button event.');

  console.log('\n🎉 ALL FEATURE 2 ACCEPTANCE TESTS PASSED (100% SUCCESS)\n');
}

runFeature2AcceptanceTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
