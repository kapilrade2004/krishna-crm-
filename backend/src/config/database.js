'use strict';

const fs = require('fs');
const path = require('path');

// Proactively load .env from candidate paths if not yet in process.env
const envCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'krishna-CRM-Backend/.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}
require('dotenv').config();

const { Sequelize } = require('sequelize');
const logger = require('./logger');

const DB_DIALECT = process.env.DB_DIALECT || 'mysql';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_NAME = process.env.DB_NAME || 'krisha_crm_db';
const DB_USER = process.env.DB_USER || 'krisha_crm_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'krisha_crm-app@20260819';
const DB_STORAGE = process.env.DB_STORAGE;
const NODE_ENV = process.env.NODE_ENV || 'development';

const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// Architecture Rule:
// STRICT MYSQL ENFORCEMENT: SQLite is completely forbidden across all environments (local, dev, test, production).
// Everything strictly connects to MySQL.

let sequelize;

if (process.env.MYSQL_URL || process.env.DATABASE_URL) {
  const connectionString = process.env.MYSQL_URL || process.env.DATABASE_URL;
  logger.info(`Connecting to MySQL database via connection URL...`);
  sequelize = new Sequelize(connectionString, {
    dialect: 'mysql',
    logging: NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 50,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
    dialectOptions: {
      charset: 'utf8mb4',
      connectTimeout: 60000,
      ...(NODE_ENV === 'production' && process.env.DB_SSL !== 'false' && {
        ssl: { rejectUnauthorized: false },
      }),
    },
  });
} else {
  const isLocalWindows = process.platform === 'win32';
  const effectiveHost = (isLocalWindows && DB_HOST === '13.203.39.243' && !process.env.FORCE_REMOTE_DB) ? 'localhost' : (DB_HOST || 'localhost');
  logger.info(`Connecting to MySQL database (${DB_NAME || 'krisha_crm_db'}@${effectiveHost}:${DB_PORT || 3306})...`);
  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: effectiveHost,
    port: parseInt(DB_PORT, 10) || 3306,
    dialect: 'mysql',
    logging: NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 50,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 60000,
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
    dialectOptions: {
      charset: 'utf8mb4',
      connectTimeout: 60000,
      ...(NODE_ENV === 'production' && process.env.DB_SSL !== 'false' && {
        ssl: { rejectUnauthorized: false },
      }),
    },
  });
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info(`Database connection (${sequelize.getDialect()}) established successfully.`);
  } catch (error) {
    const isDeployed = isProduction || Boolean(process.env.RENDER || process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.APP_NAME);
    console.error('\n==================================================');
    console.error(isDeployed ? 'PRODUCTION DATABASE CONNECTION FAILED' : 'DATABASE CONNECTION FAILED');
    console.error(`Unable to connect to MySQL database: ${error.message}`);
    console.error('==================================================\n');
    logger.error('Database connection failed:', error);
    throw error;
  }
};

module.exports = { sequelize, connectDB };

