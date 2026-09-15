'use strict';

const { Order, Customer, ChequeCollection, User } = require('../models');
const { AppError } = require('../utils/errors');
const { Op } = require('sequelize');

/**
 * Get Delivery Run-Sheet (Manoj's parcel deliveries)
 */
exports.getRunSheet = async (req, res, next) => {
  try {
    const { status = 'all', date } = req.query;
    const where = {};

    // Filter by assigned to logged-in user unless super admin/manager
    const role = (req.user.role || '').toLowerCase().trim();
    if (role === 'delivery_boy' || role === 'delivery boy') {
      where[Op.or] = [
        { assigned_to: req.user.id },
        { assigned_to: null }, // unassigned local delivery pool
      ];
    }

    if (status !== 'all') {
      where.flow_stage = status;
    }

    const orders = await Order.findAll({
      where,
      limit: 50,
      order: [['created_at', 'DESC']],
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'address', 'city', 'pincode'] },
      ],
    });

    const pendingDeliveries = orders.filter(o => o.flow_stage !== 'delivered').length;
    const deliveredCount = orders.filter(o => o.flow_stage === 'delivered').length;

    res.status(200).json({
      status: 'success',
      data: {
        deliveries: orders,
        stats: {
          totalAssigned: orders.length,
          pendingDeliveries,
          deliveredCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update Delivery Status (Delivered / Failed / Rescheduled)
 */
exports.updateDeliveryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, proof_url } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    order.flow_stage = status; // e.g. 'delivered', 'failed', 'out_for_delivery'
    if (notes) order.notes = (order.notes ? order.notes + '\n' : '') + `[Delivery Note]: ${notes}`;
    await order.save();

    res.status(200).json({
      status: 'success',
      data: { order },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Cheque Collections assigned to or collected by Delivery Boy
 */
exports.getMyCheques = async (req, res, next) => {
  try {
    const cheques = await ChequeCollection.findAll({
      where: { assigned_to: req.user.id },
      order: [['created_at', 'DESC']],
      include: [
        { model: Order, as: 'order', attributes: ['id', 'order_number', 'total_amount'] },
      ],
    });

    const totalCollected = cheques
      .filter(c => c.status === 'collected' || c.status === 'submitted_to_office' || c.status === 'verified_by_accountant')
      .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

    res.status(200).json({
      status: 'success',
      data: {
        cheques,
        stats: {
          totalCount: cheques.length,
          totalCollected,
          pendingOfficeSubmission: cheques.filter(c => c.status === 'collected').length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Record New Cheque Collection (Manoj logs cheque on the field)
 */
exports.collectCheque = async (req, res, next) => {
  try {
    const {
      customer_name,
      customer_phone,
      order_id,
      cheque_number,
      bank_name,
      amount,
      cheque_date = new Date().toISOString().split('T')[0],
      photo_url,
      notes,
    } = req.body;

    if (!customer_name || !cheque_number || !bank_name || !amount) {
      return next(new AppError('Customer name, cheque number, bank name and amount are required', 400));
    }

    const cheque = await ChequeCollection.create({
      customer_name,
      customer_phone,
      order_id,
      cheque_number,
      bank_name,
      amount: parseFloat(amount),
      cheque_date,
      photo_url,
      status: 'collected',
      assigned_to: req.user.id,
      collected_at: new Date(),
      notes,
    });

    res.status(201).json({
      status: 'success',
      message: 'Cheque collected and recorded successfully.',
      data: { cheque },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Submit Cheques to Office (handover to Riya / Sanjay)
 */
exports.submitChequesToOffice = async (req, res, next) => {
  try {
    const { cheque_ids } = req.body;
    if (!Array.isArray(cheque_ids) || cheque_ids.length === 0) {
      return next(new AppError('Please provide an array of cheque IDs to submit to office', 400));
    }

    await ChequeCollection.update(
      { status: 'submitted_to_office' },
      {
        where: {
          id: { [Op.in]: cheque_ids },
          assigned_to: req.user.id,
        },
      }
    );

    res.status(200).json({
      status: 'success',
      message: `${cheque_ids.length} cheque(s) marked as submitted to office.`,
    });
  } catch (err) {
    next(err);
  }
};
