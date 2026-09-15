'use strict';

const { ProductReview, Order, Customer, User } = require('../models');
const { AppError } = require('../utils/errors');
const { Op } = require('sequelize');

/**
 * Get product reviews with filters, pagination and stats
 */
exports.getReviews = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      status,
      marketplace,
      search,
      product_sku,
      rating,
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};

    if (status && status !== 'all') {
      where.status = status;
    }
    if (marketplace && marketplace !== 'all') {
      where.marketplace = marketplace;
    }
    if (product_sku) {
      where.product_sku = product_sku;
    }
    if (rating) {
      where.product_rating = parseInt(rating, 10);
    }
    if (search) {
      where[Op.or] = [
        { product_name: { [Op.like]: `%${search}%` } },
        { customer_name: { [Op.like]: `%${search}%` } },
        { customer_phone: { [Op.like]: `%${search}%` } },
        { review_text: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ProductReview.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'verifier', attributes: ['id', 'name', 'email'] },
      ],
    });

    // Compute stats
    const totalReviews = await ProductReview.count();
    const verifiedCount = await ProductReview.count({ where: { status: 'verified_genuine' } });
    const pendingCount = await ProductReview.count({ where: { status: 'pending_verification' } });
    const flaggedCount = await ProductReview.count({ where: { status: 'flagged_suspicious' } });

    // Today's reviews audited (Sushil's daily quota: 10 products)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const auditedToday = await ProductReview.count({
      where: {
        verified_at: { [Op.gte]: todayStart },
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        reviews: rows || [],
        pagination: {
          total: count || 0,
          page: parseInt(page, 10),
          pages: Math.ceil((count || 0) / parseInt(limit, 10)),
          limit: parseInt(limit, 10),
        },
        stats: {
          totalReviews: totalReviews || 0,
          verifiedCount: verifiedCount || 0,
          pendingCount: pendingCount || 0,
          flaggedCount: flaggedCount || 0,
          auditedToday: auditedToday || 0,
          dailyQuotaTarget: 10,
        },
      },
    });
  } catch (err) {
    const logger = require('../config/logger');
    logger.error('Error fetching product reviews:', err);
    return res.status(200).json({
      status: 'success',
      data: {
        reviews: [],
        pagination: { total: 0, page: 1, pages: 0, limit: parseInt(req.query.limit || 25, 10) },
        stats: {
          totalReviews: 0,
          verifiedCount: 0,
          pendingCount: 0,
          flaggedCount: 0,
          auditedToday: 0,
          dailyQuotaTarget: 10,
        },
      },
    });
  }
};

/**
 * Add a review (Reviewer or Telecaller rating collection)
 */
exports.createReview = async (req, res, next) => {
  try {
    const {
      order_id,
      customer_id,
      customer_name,
      customer_phone,
      marketplace = 'amazon',
      product_sku,
      product_name,
      product_rating,
      seller_rating,
      review_title,
      review_text,
      screenshot_url,
      notes,
    } = req.body;

    if (!product_name) {
      return next(new AppError('Product name is required', 400));
    }

    const review = await ProductReview.create({
      order_id,
      customer_id,
      customer_name,
      customer_phone,
      marketplace,
      product_sku,
      product_name,
      product_rating,
      seller_rating,
      review_title,
      review_text,
      screenshot_url,
      notes,
      status: 'pending_verification',
    });

    res.status(201).json({
      status: 'success',
      data: { review },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify or Moderate a Review (verify_genuine, flag_suspicious, reject_fake)
 */
exports.moderateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const review = await ProductReview.findByPk(id);
    if (!review) {
      return next(new AppError('Review not found', 404));
    }

    review.status = status || review.status;
    if (notes) review.notes = notes;
    review.verified_by = req.user.id;
    review.verified_at = new Date();
    await review.save();

    res.status(200).json({
      status: 'success',
      data: { review },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete / archive a review (Reviewer permission)
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await ProductReview.findByPk(id);
    if (!review) {
      return next(new AppError('Review not found', 404));
    }

    review.status = 'deleted';
    await review.save();
    await review.destroy(); // Soft delete via paranoid

    res.status(200).json({
      status: 'success',
      message: 'Review successfully removed.',
    });
  } catch (err) {
    next(err);
  }
};
