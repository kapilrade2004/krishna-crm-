'use strict';
const mysql = require('mysql2/promise');

async function createDb() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'chilled_coffee_user',
      password: 'chilled_coffee-app@20260727',
    });
    await conn.query('CREATE DATABASE IF NOT EXISTS krishna_crm');
    console.log('✅ Database krishna_crm created/verified on localhost!');
    await conn.end();
  } catch (e) {
    console.log('❌ Create db on localhost failed:', e.message);
  }

  try {
    const conn = await mysql.createConnection({
      host: '13.203.39.243',
      user: 'icit_user',
      password: 'icit-app@20260629',
    });
    const [dbs] = await conn.query('SHOW DATABASES');
    console.log('✅ Connected to remote 13.203.39.243! Databases:', dbs.map(d => Object.values(d)[0]));
    await conn.end();
  } catch (e) {
    console.log('❌ Remote 13.203.39.243 failed:', e.message);
  }
}

createDb();
