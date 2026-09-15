'use strict';

const { AccountingRecord, ChequeCollection, User, Order } = require('../models');
const { AppError } = require('../utils/errors');
const { Op } = require('sequelize');

/**
 * Get accounting records with filtering
 */
exports.getRecords = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 25,
      record_type,
      portal_name,
      reconciled,
      date,
      search,
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};

    if (record_type && record_type !== 'all') {
      where.record_type = record_type;
    }
    if (portal_name && portal_name !== 'all') {
      where.portal_name = portal_name;
    }
    if (reconciled !== undefined && reconciled !== 'all') {
      where.reconciled = reconciled === 'true';
    }
    if (date) {
      where.date = date;
    }
    if (search) {
      where[Op.or] = [
        { voucher_number: { [Op.like]: `%${search}%` } },
        { party_name: { [Op.like]: `%${search}%` } },
        { stock_sku: { [Op.like]: `%${search}%` } },
        { remarks: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await AccountingRecord.findAndCountAll({
      where,
      limit: parseInt(limit, 10),
      offset,
      order: [['date', 'DESC'], ['created_at', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] },
      ],
    });

    // Summary aggregates
    const totalDebit = await AccountingRecord.sum('debit_amount', { where }) || 0;
    const totalCredit = await AccountingRecord.sum('credit_amount', { where }) || 0;
    const pendingStockAudits = await AccountingRecord.count({
      where: { record_type: 'stock_reconciliation', reconciled: false },
    });

    res.status(200).json({
      status: 'success',
      data: {
        records: rows,
        pagination: {
          total: count,
          page: parseInt(page, 10),
          pages: Math.ceil(count / parseInt(limit, 10)),
          limit: parseInt(limit, 10),
        },
        summary: {
          totalDebit,
          totalCredit,
          netBalance: totalCredit - totalDebit,
          pendingStockAudits,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create accounting entry
 */
exports.createRecord = async (req, res, next) => {
  try {
    const {
      record_type,
      voucher_number,
      date = new Date().toISOString().split('T')[0],
      party_name,
      category,
      debit_amount = 0,
      credit_amount = 0,
      stock_sku,
      physical_quantity,
      book_quantity,
      portal_name = 'Tally',
      remarks,
    } = req.body;

    if (!record_type) {
      return next(new AppError('Record type is required', 400));
    }

    let discrepancy_quantity = null;
    let reconciled = false;
    if (record_type === 'stock_reconciliation') {
      const phys = parseInt(physical_quantity || 0, 10);
      const book = parseInt(book_quantity || 0, 10);
      discrepancy_quantity = phys - book;
      reconciled = discrepancy_quantity === 0;
    }

    const record = await AccountingRecord.create({
      record_type,
      voucher_number,
      date,
      party_name,
      category,
      debit_amount: parseFloat(debit_amount) || 0,
      credit_amount: parseFloat(credit_amount) || 0,
      stock_sku,
      physical_quantity,
      book_quantity,
      discrepancy_quantity,
      reconciled,
      portal_name,
      remarks,
      created_by: req.user.id,
    });

    res.status(201).json({
      status: 'success',
      data: { record },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Cheque Collections queue (Accountant view)
 */
exports.getCheques = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { customer_name: { [Op.like]: `%${search}%` } },
        { cheque_number: { [Op.like]: `%${search}%` } },
        { bank_name: { [Op.like]: `%${search}%` } },
      ];
    }

    const cheques = await ChequeCollection.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [
        { model: User, as: 'assignedUser', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'verifier', attributes: ['id', 'name', 'email'] },
        { model: Order, as: 'order', attributes: ['id', 'order_number', 'total_amount'] },
      ],
    });

    res.status(200).json({
      status: 'success',
      data: { cheques },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify / Deposit Cheque (Accountant action)
 */
exports.verifyCheque = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const cheque = await ChequeCollection.findByPk(id);
    if (!cheque) {
      return next(new AppError('Cheque collection record not found', 404));
    }

    cheque.status = status || 'verified_by_accountant';
    cheque.verified_by = req.user.id;
    cheque.verified_at = new Date();
    if (notes) cheque.notes = notes;
    await cheque.save();

    res.status(200).json({
      status: 'success',
      data: { cheque },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Daily Status Report (DSR) Summary for Accountants
 */
exports.getDsrSummary = async (req, res, next) => {
  try {
    const today = req.query.date || new Date().toISOString().split('T')[0];

    const todayRecords = await AccountingRecord.findAll({
      where: { date: today },
    });

    const pendingCheques = await ChequeCollection.count({
      where: { status: 'submitted_to_office' },
    });

    const stockMismatches = await AccountingRecord.count({
      where: {
        record_type: 'stock_reconciliation',
        reconciled: false,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        date: today,
        recordCount: todayRecords.length,
        totalDebit: todayRecords.reduce((s, r) => s + parseFloat(r.debit_amount || 0), 0),
        totalCredit: todayRecords.reduce((s, r) => s + parseFloat(r.credit_amount || 0), 0),
        pendingCheques,
        stockMismatches,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reset all Accounting Records & Cheque Collections (Super Admin Only)
 */
exports.resetAccountingData = async (req, res, next) => {
  try {
    const userRole = (req.user?.role || '').toLowerCase().trim();
    if (!['admin', 'super_admin', 'super admin'].includes(userRole)) {
      return next(new AppError('Access denied: Only Super Admin can reset accounting data.', 403));
    }

    await AccountingRecord.destroy({ where: {} });
    if (ChequeCollection) {
      await ChequeCollection.destroy({ where: {} });
    }

    res.status(200).json({
      status: 'success',
      message: 'All accounting ledgers, vouchers, and cheque collections have been reset.',
    });
  } catch (err) {
    next(err);
  }
};
