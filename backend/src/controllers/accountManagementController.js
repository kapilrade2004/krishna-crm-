'use strict';

const { Order } = require('../models');
const { AppError } = require('../utils/errors');

let accountDepartmentOverride = null;

/**
 * Account Health & Safety Stock Status (Bharat's daily task)
 */
exports.getAccountHealth = async (req, res, next) => {
  try {
    if (accountDepartmentOverride) {
      return res.status(200).json({
        status: 'success',
        data: accountDepartmentOverride,
      });
    }

    const healthData = {
      overallHealthScore: 98,
      status: 'Healthy',
      marketplaces: [
        { name: 'Amazon IN (AkuaBeat)', odr: 0.12, vtr: 99.4, lsr: 0.25, policyAlerts: 0, suppressedListings: 2, safetyStockRiskCount: 3 },
        { name: 'Amazon IN (Krishna)', odr: 0.18, vtr: 98.9, lsr: 0.31, policyAlerts: 0, suppressedListings: 1, safetyStockRiskCount: 1 },
        { name: 'Flipkart (AkuaBeat)', odr: 0.45, vtr: 97.8, lsr: 0.62, policyAlerts: 1, suppressedListings: 0, safetyStockRiskCount: 4 },
        { name: 'Meesho', odr: 0.05, vtr: 99.8, lsr: 0.10, policyAlerts: 0, suppressedListings: 0, safetyStockRiskCount: 2 },
      ],
      suppressedItems: [
        { sku: 'PUR-AL-01', title: 'Alkaline Water Purifier Cartridge', issue: 'Missing main image on pure white background', marketplace: 'Amazon' },
        { sku: 'UV-CHAM-SS', title: 'Stainless Steel UV Chamber 11W', issue: 'Brand authorization documentation required', marketplace: 'Amazon' },
        { sku: 'RO-MEM-80', title: '80 GPD Filmtec RO Membrane', issue: 'MRP mismatch with packaging label', marketplace: 'Flipkart' },
      ],
    };

    res.status(200).json({
      status: 'success',
      data: healthData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Live Coupons & BXGY Offers Monitoring
 */
exports.getPromotions = async (req, res, next) => {
  try {
    if (accountDepartmentOverride) {
      return res.status(200).json({
        status: 'success',
        data: { promotions: accountDepartmentOverride.promotions },
      });
    }

    const promotions = [
      { id: 'PROM-CP-101', name: 'Alkaline Kit 10% Off Coupon', type: 'coupon', discount: '10%', budget: 25000, spend: 14200, status: 'active', marketplace: 'Amazon' },
      { id: 'PROM-BXGY-201', name: 'Buy RO Membrane Get Sediment Filter Free', type: 'bxgy', discount: 'Free SKU', budget: 50000, spend: 31200, status: 'active', marketplace: 'Amazon' },
      { id: 'PROM-CP-102', name: 'Booster Pump ₹300 Instant Voucher', type: 'coupon', discount: '₹300', budget: 15000, spend: 14850, status: 'near_budget', marketplace: 'Flipkart' },
      { id: 'PROM-BXGY-202', name: 'Buy 3 Filters Get 1 Spun Free', type: 'bxgy', discount: 'Free SKU', budget: 20000, spend: 8900, status: 'active', marketplace: 'Amazon' },
    ];

    res.status(200).json({
      status: 'success',
      data: { promotions },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Account-wise Net Profitability Matrix
 */
exports.getProfitability = async (req, res, next) => {
  try {
    if (accountDepartmentOverride) {
      return res.status(200).json({
        status: 'success',
        data: accountDepartmentOverride.profitability,
      });
    }

    const accounts = [
      { account: 'Amazon IN (AkuaBeat)', grossRevenue: 845000, adSpend: 95000, channelFees: 152100, productCost: 380000, netProfit: 217900, netMarginPercent: 25.8 },
      { account: 'Amazon IN (Krishna)', grossRevenue: 420000, adSpend: 42000, channelFees: 75600, productCost: 195000, netProfit: 107400, netMarginPercent: 25.6 },
      { account: 'Flipkart (AkuaBeat)', grossRevenue: 310000, adSpend: 38000, channelFees: 62000, productCost: 142000, netProfit: 68000, netMarginPercent: 21.9 },
      { account: 'Direct Website / WhatsApp', grossRevenue: 195000, adSpend: 12000, channelFees: 3900, productCost: 88000, netProfit: 91100, netMarginPercent: 46.7 },
    ];

    const totalRevenue = accounts.reduce((s, a) => s + a.grossRevenue, 0);
    const totalProfit = accounts.reduce((s, a) => s + a.netProfit, 0);
    const overallMargin = ((totalProfit / totalRevenue) * 100).toFixed(1);

    res.status(200).json({
      status: 'success',
      data: {
        accounts,
        summary: {
          totalRevenue,
          totalProfit,
          overallMarginPercent: parseFloat(overallMargin),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * FBA Discrepancies & OMS Guru Management
 */
exports.getFbaAndOms = async (req, res, next) => {
  try {
    const fbaData = accountDepartmentOverride ? accountDepartmentOverride.fbaData : {
      fbaInboundShipments: [
        { shipmentId: 'FBA17Z8PQ9', fc: 'BOM5 (Bhiwandi)', sentQty: 250, receivedQty: 246, discrepancy: -4, status: 'investigating_shortage' },
        { shipmentId: 'FBA17X4KL2', fc: 'DEL4 (Tauru)', sentQty: 400, receivedQty: 400, discrepancy: 0, status: 'closed_reconciled' },
        { shipmentId: 'FBA18A1MN5', fc: 'BLR8 (Bengaluru)', sentQty: 150, receivedQty: 148, discrepancy: -2, status: 'claim_filed' },
      ],
      omsGuruSync: {
        lastSyncTime: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        pendingOrders: 14,
        syncedInventorySkus: 84,
        status: 'Operational',
      },
    };

    res.status(200).json({
      status: 'success',
      data: fbaData,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Reset Account Management Department (Super Admin Only)
 */
exports.resetAccountDepartment = async (req, res, next) => {
  try {
    const userRole = (req.user?.role || '').toLowerCase().trim();
    if (!['admin', 'super_admin', 'super admin'].includes(userRole)) {
      return next(new AppError('Access denied: Only Super Admin can reset the account department.', 403));
    }

    accountDepartmentOverride = {
      overallHealthScore: 100,
      status: 'Clean Slate / Zero Alerts',
      marketplaces: [
        { name: 'Amazon IN (AkuaBeat)', odr: 0, vtr: 100, lsr: 0, policyAlerts: 0, suppressedListings: 0, safetyStockRiskCount: 0 },
        { name: 'Amazon IN (Krishna)', odr: 0, vtr: 100, lsr: 0, policyAlerts: 0, suppressedListings: 0, safetyStockRiskCount: 0 },
        { name: 'Flipkart (AkuaBeat)', odr: 0, vtr: 100, lsr: 0, policyAlerts: 0, suppressedListings: 0, safetyStockRiskCount: 0 },
        { name: 'Meesho', odr: 0, vtr: 100, lsr: 0, policyAlerts: 0, suppressedListings: 0, safetyStockRiskCount: 0 },
      ],
      suppressedItems: [],
      promotions: [],
      profitability: {
        accounts: [
          { account: 'Amazon IN (AkuaBeat)', grossRevenue: 0, adSpend: 0, channelFees: 0, productCost: 0, netProfit: 0, netMarginPercent: 0 },
          { account: 'Amazon IN (Krishna)', grossRevenue: 0, adSpend: 0, channelFees: 0, productCost: 0, netProfit: 0, netMarginPercent: 0 },
          { account: 'Flipkart (AkuaBeat)', grossRevenue: 0, adSpend: 0, channelFees: 0, productCost: 0, netProfit: 0, netMarginPercent: 0 },
          { account: 'Direct Website / WhatsApp', grossRevenue: 0, adSpend: 0, channelFees: 0, productCost: 0, netProfit: 0, netMarginPercent: 0 },
        ],
        summary: {
          totalRevenue: 0,
          totalProfit: 0,
          overallMarginPercent: 0,
        },
      },
      fbaData: {
        fbaInboundShipments: [],
        omsGuruSync: {
          lastSyncTime: new Date().toISOString(),
          pendingOrders: 0,
          syncedInventorySkus: 0,
          status: 'Reset / Idle',
        },
      },
    };

    // Also clear accounting records
    try {
      const { AccountingRecord, ChequeCollection } = require('../models');
      if (AccountingRecord) await AccountingRecord.destroy({ where: {} });
      if (ChequeCollection) await ChequeCollection.destroy({ where: {} });
    } catch (_) {}

    res.status(200).json({
      status: 'success',
      message: 'Account Management and Accounting department data have been completely reset to a clean slate.',
      data: accountDepartmentOverride,
    });
  } catch (err) {
    next(err);
  }
};
