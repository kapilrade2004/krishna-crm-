'use strict';

require('dotenv').config();

const sendVerif = async () => {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const apiUrl = process.env.WHATSAPP_API_URL;
  const senderNumber = process.env.WHATSAPP_SENDER_NUMBER;
  const recipient = '917768868525';

  const payload = {
    from: senderNumber,
    to: recipient,
    type: 'template',
    templateName: 'order_verification_interactive',
    components: {
      body: {
        params: ['Valued Customer', 'ORD-933347', 'AquaBeat Water Purifier Premier', 'AKU-WTR-PREM-01']
      }
    }
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log(`Status: ${res.status}`);
  console.log(`Response:`, JSON.stringify(data, null, 2));
};

sendVerif();
