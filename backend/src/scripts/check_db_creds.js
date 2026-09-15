'use strict';
const mysql = require('mysql2/promise');

const creds = [
  { host: 'localhost', user: 'chilled_coffee_user', password: 'chilled_coffee-app@20260727' },
  { host: '13.203.39.243', user: 'icit_user', password: 'icit-app@20260629' },
];

async function check() {
  for (const c of creds) {
    try {
      const conn = await mysql.createConnection({ host: c.host, user: c.user, password: c.password });
      const [dbs] = await conn.query('SHOW DATABASES');
      console.log(`✅ MATCH SUCCESS: host=${c.host}, user=${c.user}`);
      console.log('   Databases:', dbs.map(d => Object.values(d)[0]));
      await conn.end();
    } catch (e) {
      console.log(`❌ Failed: host=${c.host}, user=${c.user} -> ${e.message}`);
    }
  }
}

check();
