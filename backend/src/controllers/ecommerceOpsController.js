'use strict';

const { ReturnClaim, Order, User } = require('../models');
const { AppError } = require('../utils/errors');
const { Op } = require('sequelize');

/**
 * 1:20 PM Order Cutoff Processing Workbench
 */
exports.getCutoffOrders = async (req, res, next) => {
  try {
    const orders = await Order.findAll({
      where: {
        flow_stage: { [Op.in]: ['pending', 'processing', 'customization_confirmed'] },
      },
      limit: 100,
      order: [['created_at', 'ASC']],
    });

    const now = new Date();
    const cutoffTime = new Date();
    cutoffTime.setHours(13, 20, 0, 0); // 1:20 PM

    const finalScreenshotTime = new Date();
    finalScreenshotTime.setHours(13, 59, 0, 0); // 1:59 PM

    res.status(200).json({
      status: 'success',
      data: {
        orders,
        timing: {
          currentTime: now.toISOString(),
          cutoffTime: cutoffTime.toISOString(),
          finalScreenshotTime: finalScreenshotTime.toISOString(),
          isPastCutoff: now > cutoffTime,
          isPastScreenshotTime: now > finalScreenshotTime,
        },
        stats: {
          pendingProcessingCount: orders.length,
          amazonOrders: orders.filter(o => (o.channel || '').toLowerCase().includes('amazon')).length,
          flipkartOrders: orders.filter(o => (o.channel || '').toLowerCase().includes('flipkart')).length,
          directOrders: orders.filter(o => !(o.channel || '').toLowerCase().includes('amazon') && !(o.channel || '').toLowerCase().includes('flipkart')).length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Amazon Returns & 60-Day Claims list
 */
exports.getReturnsAndClaims = async (req, res, next) => {
  try {
    const { condition, claim_status, search } = req.query;
    const where = {};

    if (condition && condition !== 'all') where.product_condition = condition;
    if (claim_status && claim_status !== 'all') where.claim_status = claim_status;
    if (search) {
      where[Op.or] = [
        { return_order_number: { [Op.like]: `%${search}%` } },
        { product_sku: { [Op.like]: `%${search}%` } },
        { product_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const returns = await ReturnClaim.findAll({
      where,
      order: [['return_date', 'DESC'], ['created_at', 'DESC']],
      include: [
        { model: User, as: 'handler', attributes: ['id', 'name', 'email'] },
      ],
    });

    const totalDamage = returns.filter(r => r.product_condition === 'damaged_scrap').length;
    const totalGood = returns.filter(r => r.product_condition === 'good_usable').length;
    const pendingPutaway = returns.filter(r => !r.oms_guru_putaway).length;
    const pendingClaims = returns.filter(r => r.claim_status === 'submitted' || r.claim_status === 'in_review').length;

    res.status(200).json({
      status: 'success',
      data: {
        returns,
        stats: {
          totalReturns: returns.length,
          totalGood,
          totalDamage,
          pendingPutaway,
          pendingClaims,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Record New Amazon Return Package (Shruti's return entry)
 */
exports.createReturnEntry = async (req, res, next) => {
  try {
    const {
      marketplace = 'amazon',
      return_order_number,
      product_sku,
      product_name,
      quantity = 1,
      return_date = new Date().toISOString().split('T')[0],
      reason,
      customer_calling_status = 'pending_call',
      product_condition = 'pending_inspection',
      claim_type = 'none',
      notes,
    } = req.body;

    if (!return_order_number || !product_sku || !product_name) {
      return next(new AppError('Return order number, SKU, and product name are required', 400));
    }

    const returnClaim = await ReturnClaim.create({
      marketplace,
      return_order_number,
      product_sku,
      product_name,
      quantity: parseInt(quantity, 10) || 1,
      return_date,
      reason,
      customer_calling_status,
      product_condition,
      oms_guru_putaway: false,
      claim_type,
      claim_status: claim_type !== 'none' ? 'draft' : 'not_eligible',
      handled_by: req.user.id,
      notes,
    });

    res.status(201).json({
      status: 'success',
      data: { returnClaim },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update Putaway Status in OMS Guru
 */
exports.updatePutaway = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { product_condition, oms_guru_putaway } = req.body;

    const returnItem = await ReturnClaim.findByPk(id);
    if (!returnItem) {
      return next(new AppError('Return record not found', 404));
    }

    if (product_condition) returnItem.product_condition = product_condition;
    if (oms_guru_putaway !== undefined) returnItem.oms_guru_putaway = oms_guru_putaway;
    await returnItem.save();

    res.status(200).json({
      status: 'success',
      data: { returnItem },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * File / Update 60-Day Claim or Damage Claim
 */
exports.fileClaim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { claim_type, claim_amount, claim_status } = req.body;

    const returnItem = await ReturnClaim.findByPk(id);
    if (!returnItem) {
      return next(new AppError('Return record not found', 404));
    }

    if (claim_type) returnItem.claim_type = claim_type;
    if (claim_amount !== undefined) returnItem.claim_amount = parseFloat(claim_amount);
    returnItem.claim_status = claim_status || 'submitted';
    await returnItem.save();

    res.status(200).json({
      status: 'success',
      data: { returnItem },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get FBA Shipments & FC Files queue (Priya's daily task)
 */
exports.getFbaShipments = async (req, res, next) => {
  try {
    const fbaShipments = [
      { id: 'FBA-SHIP-101', fcCode: 'BOM5', shipmentName: 'AkuaBeat Alkaline RO Restock', unitsPlanned: 200, unitsPacked: 200, status: 'ready_for_dispatch', labelGenerated: true },
      { id: 'FBA-SHIP-102', fcCode: 'DEL4', shipmentName: 'Sediment Filters Bulk Pack', unitsPlanned: 350, unitsPacked: 180, status: 'packing_in_progress', labelGenerated: false },
      { id: 'FBA-SHIP-103', fcCode: 'BLR8', shipmentName: 'Booster Pump & Adapter Kit', unitsPlanned: 100, unitsPacked: 0, status: 'planned', labelGenerated: false },
    ];

    res.status(200).json({
      status: 'success',
      data: { fbaShipments },
    });
  } catch (err) {
    next(err);
  }
};
