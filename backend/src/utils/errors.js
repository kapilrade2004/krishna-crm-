'use strict';

const logger = require('../config/logger');

// ─── Custom Error Class ───────────────────────────────────────────────────────
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors; // for validation error arrays
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Error Response Formatters ────────────────────────────────────────────────
const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
  return new AppError('Validation error', 422, errors);
};

const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors?.[0]?.path || 'field';
  return new AppError(`A record with this ${field} already exists.`, 409);
};

const handleSequelizeForeignKeyConstraintError = () =>
  new AppError('Referenced record does not exist.', 400);

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Your token has expired. Please log in again.', 401);

// ─── Global Error Handler ─────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Sequelize errors
  if (error.name === 'SequelizeValidationError') error = handleSequelizeValidationError(error);
  if (error.name === 'SequelizeUniqueConstraintError') error = handleSequelizeUniqueConstraintError(error);
  if (error.name === 'SequelizeForeignKeyConstraintError') error = handleSequelizeForeignKeyConstraintError();
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (error.name === 'MulterError') {
    const maxMb = process.env.MAX_FILE_SIZE_MB || '50';
    if (error.code === 'LIMIT_FILE_SIZE') {
      error = new AppError(`File is too large. Maximum allowed size is ${maxMb}MB.`, 400);
    } else {
      error = new AppError(`File upload error: ${error.message}`, 400);
    }
  }

  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  // Log server errors
  if (error.statusCode >= 500) {
    logger.error({
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
    });
  }

  const response = {
    status: error.status,
    message: error.message,
    ...(error.errors && { errors: error.errors }),
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
};

// ─── 404 Handler ──────────────────────────────────────────────────────────────
const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found.`, 404));
};

module.exports = { AppError, errorHandler, notFound };
