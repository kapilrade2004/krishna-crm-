'use strict';


require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const logger = require('./logger');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
} = process.env;

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

const run = async () => {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: parseInt(DB_PORT, 10),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  });

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [applied] = await conn.execute('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      logger.info(`  ⏭  Skipping (already applied): ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    logger.info(`  ▶  Applying: ${file}`);

    try {
      await conn.query(sql);
      await conn.execute(
        'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
        [file]
      );
      logger.info(`  ✅ Applied: ${file}`);
      ran++;
    } catch (err) {
      logger.error(`  ❌ Failed on ${file}: ${err.message}`);
      await conn.end();
      process.exit(1);
    }
  }

  await conn.end();

  if (ran === 0) {
    logger.info('Database is already up to date.');
  } else {
    logger.info(`Migration complete. ${ran} file(s) applied.`);
  }
};

module.exports = { runMigrations: run };

if (require.main === module) {
  run().catch((err) => {
    logger.error('Migration runner error:', err);
    process.exit(1);
  });
}
