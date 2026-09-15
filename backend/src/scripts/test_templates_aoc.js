'use strict';

require('dotenv').config();

const testTemplateNames = async () => {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const apiUrl = process.env.WHATSAPP_API_URL;
  const senderNumber = process.env.WHATSAPP_SENDER_NUMBER;
  const recipient = '917768868525';

  const candidates = [
    'order_confirmation01.0',
    'order_confirmation01_0',
    'order_confirmation_01.0',
    'order_confirmation_01_0',
    'order_confirmation_1.0',
    'order_confirmation_1_0',
    'order_confirmation01',
    'order_confirmation1',
    'order_verification_interactive',
    'order_verification',
    'order_cancelled',
    'order_canceled',
    'order_dispatched',
    'product_verification',
  ];

  for (const tName of candidates) {
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          from: senderNumber,
          to: recipient,
          type: 'template',
          templateName: tName,
          components: {
            body: {
              params: ['Valued Customer', 'ORD-933347', 'AquaBeat Purifier', 'AKU-WTR-PREM-01', '1', '2499']
            }
          }
        })
      });
      const data = await res.json();
      console.log(`[${res.status}] Template: "${tName}" -> ${data.error ? data.message : 'SUCCESS: ' + data.message}`);
    } catch (e) {
      console.log(`[ERROR] Template: "${tName}" -> ${e.message}`);
    }
  }
};

testTemplateNames();
