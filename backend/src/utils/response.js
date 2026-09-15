'use strict';

/**
 * Standard API response helpers
 */

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = { status: 'success', message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

const sendCreated = (res, data = null, message = 'Created successfully') =>
  sendSuccess(res, data, message, 201);

const sendPaginated = (res, data, pagination, extra = {}) => {
  return res.status(200).json({
    status: 'success',
    data,
    pagination: {
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1,
    },
    ...(extra && typeof extra === 'object' ? extra : {}),
  });
};

/**
 * Parse and validate pagination query params
 */
const getPagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Build Sequelize order array from query: ?sort=created_at:desc,name:asc
 */
const getOrder = (query, allowedFields = []) => {
  if (!query.sort) return [['created_at', 'DESC']];
  return query.sort.split(',').reduce((acc, part) => {
    const [field, dir] = part.trim().split(':');
    if (allowedFields.length === 0 || allowedFields.includes(field)) {
      acc.push([field, (dir || 'ASC').toUpperCase()]);
    }
    return acc;
  }, []);
};

const sendError = (res, message = 'An error occurred', statusCode = 500, error = null) => {
  return res.status(statusCode).json({
    status: 'error',
    success: false,
    message,
    ...(error ? { error } : {}),
  });
};

module.exports = { sendSuccess, sendCreated, sendPaginated, sendError, getPagination, getOrder };
