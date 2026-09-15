'use strict';

const { AdCampaignMetric, KeywordMetric } = require('../models');
const { AppError } = require('../utils/errors');
const { Op } = require('sequelize');

/**
 * Get PPC campaigns with metrics
 */
exports.getCampaigns = async (req, res, next) => {
  try {
    const { marketplace, campaign_type, status } = req.query;
    const where = {};
    if (marketplace && marketplace !== 'all') where.marketplace = marketplace;
    if (campaign_type && campaign_type !== 'all') where.campaign_type = campaign_type;
    if (status && status !== 'all') where.status = status;

    const campaigns = await AdCampaignMetric.findAll({
      where,
      order: [['spend', 'DESC']],
    });

    const totalSpend = campaigns.reduce((acc, c) => acc + parseFloat(c.spend || 0), 0);
    const totalSales = campaigns.reduce((acc, c) => acc + parseFloat(c.sales || 0), 0);
    const totalImpressions = campaigns.reduce((acc, c) => acc + (c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + (c.clicks || 0), 0);
    const blendedRoas = totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : '0.00';
    const blendedAcos = totalSales > 0 ? ((totalSpend / totalSales) * 100).toFixed(1) : '0.0';

    res.status(200).json({
      status: 'success',
      data: {
        campaigns,
        overview: {
          totalSpend,
          totalSales,
          totalImpressions,
          totalClicks,
          blendedRoas: parseFloat(blendedRoas),
          blendedAcos: parseFloat(blendedAcos),
          activeCampaigns: campaigns.filter(c => c.status === 'active').length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update Campaign Budget and status
 */
exports.updateCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { budget_daily, status, recommendation } = req.body;

    const campaign = await AdCampaignMetric.findByPk(id);
    if (!campaign) {
      return next(new AppError('Campaign not found', 404));
    }

    if (budget_daily !== undefined) campaign.budget_daily = parseFloat(budget_daily);
    if (status) campaign.status = status;
    if (recommendation) campaign.recommendation = recommendation;
    await campaign.save();

    res.status(200).json({
      status: 'success',
      data: { campaign },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Keywords and Bid Benchmarks
 */
exports.getKeywords = async (req, res, next) => {
  try {
    const { match_type, is_negative, search } = req.query;
    const where = {};
    if (match_type && match_type !== 'all') where.match_type = match_type;
    if (is_negative !== undefined && is_negative !== 'all') where.is_negative = is_negative === 'true';
    if (search) where.keyword = { [Op.like]: `%${search}%` };

    const keywords = await KeywordMetric.findAll({
      where,
      order: [['spend', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      data: { keywords },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Auto-to-Exact Keyword Migration Action
 */
exports.migrateAutoToExact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const keyword = await KeywordMetric.findByPk(id);
    if (!keyword) {
      return next(new AppError('Keyword not found', 404));
    }

    keyword.is_migrated_from_auto = true;
    keyword.match_type = 'exact';
    await keyword.save();

    res.status(200).json({
      status: 'success',
      message: `Keyword '${keyword.keyword}' migrated to Exact match campaign.`,
      data: { keyword },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Flag keyword as negative
 */
exports.flagNegative = async (req, res, next) => {
  try {
    const { id } = req.params;
    const keyword = await KeywordMetric.findByPk(id);
    if (!keyword) {
      return next(new AppError('Keyword not found', 404));
    }

    keyword.is_negative = true;
    keyword.match_type = 'negative';
    await keyword.save();

    res.status(200).json({
      status: 'success',
      message: `Keyword '${keyword.keyword}' added to negative targeting list.`,
      data: { keyword },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Bottom 10 SKUs (Naushad's daily task)
 */
exports.getBottom10Skus = async (req, res, next) => {
  try {
    // Return mock or calculated bottom 10 SKUs with impression turnaround plan
    const bottom10 = [
      { sku: 'PUR-CT-01', name: 'Alkaline Copper Carbon Filter', impressions: 142, clicks: 3, orders: 0, roas: 0.0, action: 'Revise main image and add exact match keywords' },
      { sku: 'PUR-SED-02', name: 'Spun Sediment Pre-Filter 5 Micron', impressions: 210, clicks: 5, orders: 1, roas: 0.8, action: 'Target long-tail filter cartridge terms' },
      { sku: 'PUR-MEM-75', name: '75 GPD RO Membrane High TDS', impressions: 320, clicks: 8, orders: 1, roas: 1.1, action: 'Increase bid by 15% to compete with top 4 positions' },
      { sku: 'UV-CHAM-01', name: 'Stainless Steel UV Chamber Kit', impressions: 412, clicks: 9, orders: 0, roas: 0.0, action: 'Add negative keywords to prune generic UV searches' },
      { sku: 'PMP-100-BO', name: '100 GPD Booster Pump Diaphragm', impressions: 450, clicks: 12, orders: 1, roas: 1.2, action: 'Check competitor price master and offer coupon' },
      { sku: 'MIN-CAR-04', name: 'Mineralizer Cartridge with pH Booster', impressions: 512, clicks: 14, orders: 2, roas: 1.4, action: 'Create sponsored brand video campaign' },
      { sku: 'FR-450-KIT', name: 'Flow Restrictor 450cc Quick Fit', impressions: 580, clicks: 11, orders: 1, roas: 0.9, action: 'Bundle with sediment filter as BXGY offer' },
      { sku: 'SMPS-24-PW', name: 'SMPS 24V 2.5A Power Adapter', impressions: 620, clicks: 18, orders: 2, roas: 1.3, action: 'Optimize title for Kent & Aquaguard compatibility' },
      { sku: 'TDS-MET-DG', name: 'Digital TDS Meter Water Tester', impressions: 690, clicks: 22, orders: 3, roas: 1.5, action: 'Promote as add-on under ₹299 deal' },
      { sku: 'VAL-SOL-01', name: 'Solenoid Valve 24V Brass Fitting', impressions: 720, clicks: 19, orders: 2, roas: 1.2, action: 'Improve bullet points and add installation graphic' },
    ];

    res.status(200).json({
      status: 'success',
      data: { skus: bottom10 },
    });
  } catch (err) {
    next(err);
  }
};
