'use strict';

const path = require('path');
if (!process.env.DB_DIALECT) {
  process.env.DB_DIALECT = 'sqlite';
}

const {
  User,
  ProductReview,
  AccountingRecord,
  ChequeCollection,
  AdCampaignMetric,
  KeywordMetric,
  ReturnClaim,
  Order,
} = require('../models');

async function seedRoleWorkspacesData() {
  console.log('🌱 Seeding sample operational records for the 7 business role workspaces...');

  // 1. Fetch key actors
  const sushil = await User.findOne({ where: { email: 'sushil@akuabeat.com' } });
  const sanjay = await User.findOne({ where: { email: 'sanjay.accountant@leretailproject.com' } });
  const riya = await User.findOne({ where: { email: 'riya.accountant@leretailproject.com' } });
  const manoj = await User.findOne({ where: { email: 'manoj.delivery@krishnacrm.com' } });
  const naushad = await User.findOne({ where: { email: 'smallbusiness.ecs@gmail.com' } });
  const bharat = await User.findOne({ where: { email: 'bharat.manager@nityamenterprises.com' } });
  const shruti = await User.findOne({ where: { email: 'shruti.ecom@nityamenterprises.com' } });
  const priya = await User.findOne({ where: { email: 'priya.ecom@nityamenterprises.com' } });
  const yash = await User.findOne({ where: { email: 'yash.telecaller@nityamenterprises.com' } });
  const admin = await User.findOne({ where: { email: 'admin@krishnacrm.com' } });

  const adminId = admin ? admin.id : (sushil ? sushil.id : null);
  const sushilId = sushil ? sushil.id : adminId;
  const sanjayId = sanjay ? sanjay.id : adminId;
  const riyaId = riya ? riya.id : adminId;
  const manojId = manoj ? manoj.id : adminId;
  const shrutiId = shruti ? shruti.id : adminId;

  // 2. Seed Product Reviews (Role 1 Reviewer & Role 2 Telecaller)
  const sampleReviews = [
    {
      product_name: 'AkuaBeat Copper Alkaline RO Water Purifier',
      product_sku: 'PUR-AKUA-COP',
      marketplace: 'amazon',
      customer_name: 'Rajesh Sharma',
      customer_phone: '9820112233',
      product_rating: 5,
      seller_rating: 5,
      review_title: 'Exceptional Water Taste & Fast Installation',
      review_text: 'The alkaline taste is very smooth and TDS reduction from 850 to 80 was verified by technician. Great service!',
      status: 'verified_genuine',
      verified_by: sushilId,
      verified_at: new Date(),
    },
    {
      product_name: 'AkuaBeat RO Pre-Filter Sediment Cartridge 5 Micron',
      product_sku: 'PUR-SED-02',
      marketplace: 'amazon',
      customer_name: 'Pooja Verma',
      customer_phone: '9876543210',
      product_rating: 5,
      seller_rating: 4,
      review_title: 'Original filter quality, fits perfectly in Kent housing',
      review_text: 'Replaced my old clogged filter. Good build and zero leaks.',
      status: 'pending_verification',
    },
    {
      product_name: '100 GPD RO Membrane High TDS 2500 PPM',
      product_sku: 'PUR-MEM-75',
      marketplace: 'flipkart',
      customer_name: 'Amit Patel',
      customer_phone: '9123456789',
      product_rating: 1,
      seller_rating: 1,
      review_title: 'Fake product received, completely damaged box',
      review_text: 'Seal was open and product seemed used. Demanding full refund immediately.',
      status: 'flagged_suspicious',
      notes: 'Competitor bot pattern identified. Telecaller call initiated to verify genuine purchase invoice.',
    },
    {
      product_name: 'Stainless Steel UV Chamber Kit 11W',
      product_sku: 'UV-CHAM-01',
      marketplace: 'amazon',
      customer_name: 'Sunil Mehta',
      customer_phone: '9845012345',
      product_rating: 4,
      seller_rating: 5,
      review_title: 'Sturdy chamber, good ballast included',
      review_text: 'Works fine with my existing purifier. Installation instructions could be improved.',
      status: 'pending_verification',
    },
    {
      product_name: 'Alkaline Mineral Cartridge with pH Booster',
      product_sku: 'MIN-CAR-04',
      marketplace: 'website',
      customer_name: 'Kavita Joshi',
      customer_phone: '9765432109',
      product_rating: 5,
      seller_rating: 5,
      review_title: 'Noticeable energy and pH balance improvement',
      review_text: 'Tested pH with liquid drops and it came to 8.5. Highly recommended!',
      status: 'verified_genuine',
      verified_by: sushilId,
      verified_at: new Date(),
    },
  ];

  for (const r of sampleReviews) {
    await ProductReview.findOrCreate({
      where: { product_name: r.product_name, customer_name: r.customer_name },
      defaults: r,
    });
  }
  console.log('✅ Seeded sample Product Reviews');

  // 3. Seed Accounting Records (Role 3 Accountant)
  const todayStr = new Date().toISOString().split('T')[0];
  const sampleAccounting = [
    {
      record_type: 'tally_entry',
      voucher_number: 'VCH-TL-2026-089',
      date: todayStr,
      party_name: 'Kent RO Systems Ltd',
      category: 'Vendor PO Inward',
      debit_amount: 145000.0,
      credit_amount: 0.0,
      reconciled: true,
      portal_name: 'Tally',
      remarks: 'Inward entry for 500 pcs RO Membrane batch #KNT-902',
      created_by: sanjayId,
    },
    {
      record_type: 'stock_reconciliation',
      voucher_number: 'STK-AUD-0829',
      date: todayStr,
      party_name: 'Main Bhiwandi Warehouse',
      category: 'Stock Audit',
      stock_sku: 'PUR-AKUA-COP',
      physical_quantity: 142,
      book_quantity: 145,
      discrepancy_quantity: -3,
      reconciled: false,
      portal_name: 'Tally',
      remarks: '3 units under investigation in dispatch holding area.',
      created_by: sanjayId,
    },
    {
      record_type: 'mybillbook_invoice',
      voucher_number: 'MBB-INV-4410',
      date: todayStr,
      party_name: 'Apex Water Solutions (B2B Distributor)',
      category: 'Customer Sales Billing',
      debit_amount: 0.0,
      credit_amount: 68400.0,
      reconciled: true,
      portal_name: 'MyBillBook',
      remarks: 'Invoice generated and dispatched with E-Way Bill #2910482910',
      created_by: riyaId,
    },
    {
      record_type: 'banking_deposit',
      voucher_number: 'BNK-DEP-9921',
      date: todayStr,
      party_name: 'HDFC Current Account (Krishna Ent)',
      category: 'Cheque & Cash Deposit',
      debit_amount: 0.0,
      credit_amount: 45000.0,
      reconciled: true,
      portal_name: 'Bank',
      remarks: 'Counter deposit of cheques cleared from Manoj field collection',
      created_by: riyaId,
    },
  ];

  for (const a of sampleAccounting) {
    await AccountingRecord.findOrCreate({
      where: { voucher_number: a.voucher_number },
      defaults: a,
    });
  }
  console.log('✅ Seeded sample Accounting Records');

  // 4. Seed Cheque Collections (Role 6 Delivery Boy & Role 3 Accountant)
  const sampleCheques = [
    {
      customer_name: 'Suresh Singhania (Singhania Enterprises)',
      customer_phone: '9820055443',
      cheque_number: '782910',
      bank_name: 'HDFC Bank',
      amount: 25000.0,
      cheque_date: todayStr,
      status: 'submitted_to_office',
      assigned_to: manojId,
      collected_at: new Date(Date.now() - 3 * 3600 * 1000),
      notes: 'Handed over at office desk to Riya for verification and deposit.',
    },
    {
      customer_name: 'Vijay Deshmukh (Aqua Pure Solutions)',
      customer_phone: '9819123456',
      cheque_number: '341029',
      bank_name: 'State Bank of India',
      amount: 18500.0,
      cheque_date: todayStr,
      status: 'verified_by_accountant',
      assigned_to: manojId,
      verified_by: riyaId,
      collected_at: new Date(Date.now() - 24 * 3600 * 1000),
      verified_at: new Date(Date.now() - 2 * 3600 * 1000),
      notes: 'Cheque verified and batched for today bank deposit.',
    },
    {
      customer_name: 'Omkar Water Services',
      customer_phone: '9920192837',
      cheque_number: '110294',
      bank_name: 'ICICI Bank',
      amount: 12000.0,
      cheque_date: todayStr,
      status: 'assigned_pickup',
      assigned_to: manojId,
      notes: 'Scheduled for pickup between 3 PM and 5 PM at Dadar West.',
    },
  ];

  for (const c of sampleCheques) {
    await ChequeCollection.findOrCreate({
      where: { cheque_number: c.cheque_number },
      defaults: c,
    });
  }
  console.log('✅ Seeded sample Cheque Collections');

  // 5. Seed Ad Campaigns & Keywords (Role 4 SPN & Ads Manager)
  const sampleCampaigns = [
    {
      campaign_name: 'AkuaBeat_RO_Exact_HighIntent',
      marketplace: 'amazon',
      campaign_type: 'exact',
      budget_daily: 2500.0,
      spend: 2150.0,
      sales: 9800.0,
      orders_count: 7,
      impressions: 14200,
      clicks: 340,
      ctr_percent: 2.39,
      acos_percent: 21.9,
      roas: 4.56,
      status: 'active',
      bid_status: 'Optimal',
      recommendation: 'Increase budget by ₹500 to capture evening traffic.',
    },
    {
      campaign_name: 'AkuaBeat_Auto_Discovery_Broad',
      marketplace: 'amazon',
      campaign_type: 'auto',
      budget_daily: 1200.0,
      spend: 1180.0,
      sales: 3200.0,
      orders_count: 2,
      impressions: 28400,
      clicks: 410,
      ctr_percent: 1.44,
      acos_percent: 36.8,
      roas: 2.71,
      status: 'active',
      bid_status: 'High Waste',
      recommendation: 'Prune non-converting search terms and add to negative keywords.',
    },
    {
      campaign_name: 'Filters_Accessories_Flipkart_PPC',
      marketplace: 'flipkart',
      campaign_type: 'exact',
      budget_daily: 1000.0,
      spend: 850.0,
      sales: 3900.0,
      orders_count: 4,
      impressions: 9800,
      clicks: 220,
      ctr_percent: 2.24,
      acos_percent: 21.8,
      roas: 4.59,
      status: 'active',
      bid_status: 'Optimal',
    },
  ];

  for (const camp of sampleCampaigns) {
    await AdCampaignMetric.findOrCreate({
      where: { campaign_name: camp.campaign_name },
      defaults: camp,
    });
  }

  const sampleKeywords = [
    {
      keyword: 'alkaline ro water purifier',
      campaign_name: 'AkuaBeat_RO_Exact_HighIntent',
      match_type: 'exact',
      impressions: 4800,
      clicks: 140,
      spend: 840.0,
      sales: 4200.0,
      orders: 3,
      current_bid: 6.2,
      suggested_bid: 5.8,
      conversion_rate: 2.14,
      is_negative: false,
    },
    {
      keyword: 'best ro membrane for borewell water',
      campaign_name: 'AkuaBeat_Auto_Discovery_Broad',
      match_type: 'exact',
      impressions: 3100,
      clicks: 95,
      spend: 480.0,
      sales: 2400.0,
      orders: 2,
      current_bid: 5.1,
      suggested_bid: 4.9,
      conversion_rate: 2.1,
      is_migrated_from_auto: true,
    },
    {
      keyword: 'free water filter pdf download',
      campaign_name: 'AkuaBeat_Auto_Discovery_Broad',
      match_type: 'negative',
      impressions: 890,
      clicks: 42,
      spend: 180.0,
      sales: 0.0,
      orders: 0,
      current_bid: 0.0,
      suggested_bid: 0.0,
      conversion_rate: 0.0,
      is_negative: true,
    },
  ];

  for (const kw of sampleKeywords) {
    await KeywordMetric.findOrCreate({
      where: { keyword: kw.keyword, campaign_name: kw.campaign_name },
      defaults: kw,
    });
  }
  console.log('✅ Seeded sample Ad Campaigns and Keywords');

  // 6. Seed Amazon Returns & 60-Day Claims (Role 7 E-Commerce Executive)
  const sampleReturns = [
    {
      marketplace: 'amazon',
      return_order_number: 'AMZ-RET-402-9918231',
      product_sku: 'PUR-AKUA-COP',
      product_name: 'AkuaBeat Copper Alkaline RO Water Purifier',
      quantity: 1,
      return_date: todayStr,
      reason: 'Customer cancelled during transit',
      customer_calling_status: 'customer_satisfied_resolved',
      product_condition: 'good_usable',
      oms_guru_putaway: true,
      claim_type: 'none',
      claim_status: 'not_eligible',
      handled_by: shrutiId,
      notes: 'Intact factory seal verified. Re-stocked in good inventory.',
    },
    {
      marketplace: 'amazon',
      return_order_number: 'AMZ-RET-404-1182736',
      product_sku: 'PUR-MEM-75',
      product_name: '100 GPD RO Membrane High TDS',
      quantity: 2,
      return_date: todayStr,
      reason: 'Damaged packaging in courier transit',
      customer_calling_status: 'return_mandatory',
      product_condition: 'damaged_scrap',
      oms_guru_putaway: false,
      claim_type: 'channel_damage_claim',
      claim_status: 'submitted',
      claim_amount: 3200.0,
      handled_by: shrutiId,
      notes: 'Filed claim with Amazon Seller Support with box unboxing video.',
    },
    {
      marketplace: 'amazon',
      return_order_number: 'AMZ-RET-401-0029182',
      product_sku: 'PUR-SED-02',
      product_name: 'Sediment Pre-Filter 5 Micron Pack of 4',
      quantity: 1,
      return_date: new Date(Date.now() - 55 * 24 * 3600 * 1000).toISOString().split('T')[0],
      reason: 'Customer return not received at warehouse within 60 days',
      customer_calling_status: 'unreachable',
      product_condition: 'damaged_scrap',
      oms_guru_putaway: false,
      claim_type: '60_day_return_claim',
      claim_status: 'in_review',
      claim_amount: 1450.0,
      handled_by: shrutiId,
      notes: '60-day reimbursement claim filed under Amazon SAFE-T policy.',
    },
  ];

  for (const ret of sampleReturns) {
    await ReturnClaim.findOrCreate({
      where: { return_order_number: ret.return_order_number },
      defaults: ret,
    });
  }
  console.log('✅ Seeded sample Returns & Claims');

  console.log('🎉 All sample operational role workspace records successfully seeded!');
}

if (require.main === module) {
  seedRoleWorkspacesData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedRoleWorkspacesData };
