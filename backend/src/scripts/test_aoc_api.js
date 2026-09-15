'use strict';

require('dotenv').config();

const testAoc = async () => {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const apiUrl = process.env.WHATSAPP_API_URL;
  const senderNumber = process.env.WHATSAPP_SENDER_NUMBER; // 919930386406
  const recipient = '917768868525'; // 7768868525

  console.log(`API URL: ${apiUrl}`);
  console.log(`API Key: ${apiKey?.slice(0, 5)}...`);
  console.log(`Sender: ${senderNumber}`);
  console.log(`Recipient: ${recipient}\n`);

  // Let's test template payloads
  const payloads = [
    {
      name: 'Variant 1: AOC standard params array',
      body: {
        from: senderNumber,
        to: recipient,
        type: 'template',
        templateName: 'order_confirmation01.0',
        components: {
          body: {
            params: ['Valued Customer', 'ORD-933347', 'AquaBeat Purifier', 'AKU-WTR-PREM-01', '1', '2499']
          }
        }
      }
    },
    {
      name: 'Variant 2: AOC without dot in template name or order_confirmation01',
      body: {
        from: senderNumber,
        to: recipient,
        type: 'template',
        templateName: 'order_confirmation01',
        components: {
          body: {
            params: ['Valued Customer', 'ORD-933347', 'AquaBeat Purifier', 'AKU-WTR-PREM-01', '1', '2499']
          }
        }
      }
    },
    {
      name: 'Variant 3: AOC template with language code',
      body: {
        from: senderNumber,
        to: recipient,
        type: 'template',
        template: {
          name: 'order_confirmation01.0',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: 'Valued Customer' },
                { type: 'text', text: 'ORD-933347' },
                { type: 'text', text: 'AquaBeat Purifier' },
                { type: 'text', text: 'AKU-WTR-PREM-01' },
                { type: 'text', text: '1' },
                { type: 'text', text: '2499' }
              ]
            }
          ]
        }
      }
    },
    {
      name: 'Variant 4: AOC order_confirmation (3 params)',
      body: {
        from: senderNumber,
        to: recipient,
        type: 'template',
        templateName: 'order_confirmation',
        components: {
          body: {
            params: ['Valued Customer', 'ORD-933347', 'AquaBeat Purifier']
          }
        }
      }
    },
    {
      name: 'Variant 5: AOC order_verification_interactive',
      body: {
        from: senderNumber,
        to: recipient,
        type: 'template',
        templateName: 'order_verification_interactive',
        components: {
          body: {
            params: ['Valued Customer', 'ORD-933347', 'AquaBeat Purifier', 'AKU-WTR-PREM-01']
          }
        }
      }
    },
    {
      name: 'Variant 6: AOC sendText / session message',
      body: {
        from: senderNumber,
        to: recipient,
        type: 'text',
        text: {
          body: 'Hello! This is a verification test message from Krishna CRM.'
        }
      }
    }
  ];

  for (const p of payloads) {
    console.log(`\n── Testing: ${p.name} ──`);
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify(p.body)
      });
      const data = await res.json();
      console.log(`Status: ${res.status}`);
      console.log(`Response:`, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(`Error:`, e.message);
    }
  }
};

testAoc();
