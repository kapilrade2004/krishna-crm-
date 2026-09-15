'use strict';

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const { LOG_LEVEL = 'info', LOG_DIR = 'logs', NODE_ENV } = process.env;

const { combine, timestamp, printf, colorize, errors, json } = format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack }) =>
    stack ? `${ts} ${level}: ${message}\n${stack}` : `${ts} ${level}: ${message}`
  )
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = createLogger({
  level: LOG_LEVEL,
  format: NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    ...(NODE_ENV === 'production'
      ? [
          new transports.DailyRotateFile({
            dirname: path.join(process.cwd(), LOG_DIR),
            filename: 'app-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
          }),
          new transports.DailyRotateFile({
            level: 'error',
            dirname: path.join(process.cwd(), LOG_DIR),
            filename: 'error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
          }),
        ]
      : []),
  ],
  exitOnError: false,
});

module.exports = logger;
