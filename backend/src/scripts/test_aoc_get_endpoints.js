'use strict';

require('dotenv').config();

const exploreAoc = async () => {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const baseUrl = 'https://api.aoc-portal.com/v1/whatsapp';

  const endpoints = [
    '/messages',
    '/chats',
    '/inbox',
    '/history',
    '/contacts',
    '/webhook',
    '/webhooks',
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}?from=919930386406&phone=917768868525`, {
        method: 'GET',
        headers: { 'apikey': apiKey }
      });
      const data = await res.json().catch(() => null);
      console.log(`[${res.status}] GET ${ep} ->`, data ? JSON.stringify(data).slice(0, 150) : res.statusText);
    } catch (e) {
      console.log(`[ERR] GET ${ep} ->`, e.message);
    }
  }
};

exploreAoc();
