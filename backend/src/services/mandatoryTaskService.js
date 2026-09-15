'use strict';

const { Op } = require('sequelize');
const { DailyActivity, DailyActivityHistory, User } = require('../models');
const logger = require('../config/logger');

/**
 * Enterprise Roster Mandatory Routine Specifications
 * Mapped by email / role / designation directly from company operating specification.
 */
const MANDATORY_TASK_CATALOG = {
  // ── SUSHIL (Reviewer) ────────────────────────────────────────────────────────
  'sushil@akuabeat.com': [
    {
      title: 'Review 10 products',
      description: 'Review and evaluate at least 10 products for quality feedback, customer satisfaction, and rating compliance.',
      category: 'Reviews & Ratings',
      priority: 'high',
      estimated_hours: 2.0,
      frequency: 'daily',
    },
    {
      title: 'Add 3 reviews',
      description: 'Add 3 verified customer feedback/product reviews with detailed product use-case notes.',
      category: 'Reviews & Ratings',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Delete product reviews',
      description: 'Review reported or flagged reviews; remove invalid, abusive, or fake product reviews from the platform.',
      category: 'Reviews & Ratings',
      priority: 'medium',
      estimated_hours: 0.5,
      frequency: 'daily',
    },
  ],

  // ── YASH (Telecaller) ────────────────────────────────────────────────────────
  'yash.telecaller@nityamenterprises.com': [
    {
      title: 'Amazon Easyship Calling – Product & Seller Rating Collection',
      description: 'Call all customers from the Amazon Easyship calling list. Collect their Product Rating and Seller Rating. Update ratings in CRM after every successful call. Record all feedback screenshots shared. Update call status for unanswered or unreachable numbers with reason.',
      category: 'Customer Calling',
      priority: 'urgent',
      estimated_hours: 4.5,
      frequency: 'daily',
    },
    {
      title: 'Review Verification',
      description: 'Verify all reviews received from customers. Check whether each review is genuine, valid, and properly documented in the CRM.',
      category: 'Verification',
      priority: 'high',
      estimated_hours: 2.5,
      frequency: 'daily',
    },
  ],

  // ── MEENAKSHI (Telecaller) ───────────────────────────────────────────────────
  'meenakshi.telecaller@nityamenterprises.com': [
    {
      title: 'Confirmation Calling',
      description: 'Download the daily Easy orders report and review all orders. Make confirmation calls to customers and confirm order requirements. Check whether requested product is compatible/suitable for customer. If not compatible, explain and cancel. If compatible, customize according to customer requirements. Maintain 95%+ success rate. Send customized labels to Packing Team. Update calling, confirmation, cancellation, customization, and label status in CRM.',
      category: 'Order Confirmation',
      priority: 'urgent',
      estimated_hours: 3.5,
      frequency: 'daily',
    },
    {
      title: 'Amazon Easyship Calling – Product & Seller Rating Collection',
      description: 'Call all customers from the Amazon Easyship calling list. Collect Product Rating and Seller Rating. Update ratings in CRM after every call. Record feedback screenshots.',
      category: 'Customer Calling',
      priority: 'high',
      estimated_hours: 3.0,
      frequency: 'daily',
    },
    {
      title: 'Review Verification',
      description: 'Verify all customer reviews received. Confirm legitimacy and valid rating submissions in system.',
      category: 'Verification',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Monthly Cancellation Report',
      description: 'Prepare monthly cancellation report for all cancelled orders. Calculate, analyze and track monthly cancellation rate.',
      category: 'Reporting',
      priority: 'medium',
      estimated_hours: 1.5,
      frequency: 'monthly',
    },
  ],

  // ── SANJAY (Accountant) ─────────────────────────────────────────────────────
  'sanjay.accountant@leretailproject.com': [
    {
      title: 'TALLY ENTRY',
      description: 'Complete daily entry of all purchase, sales, receipt, and payment vouchers into Tally accounting system.',
      category: 'Accounting & Tally',
      priority: 'high',
      estimated_hours: 2.0,
      frequency: 'daily',
    },
    {
      title: 'DAILY STOCK IN AND OUT TO BE UPDATE IN TALLY',
      description: 'Reconcile and update daily inward goods receipt and outward dispatches in Tally stock registers.',
      category: 'Stock Management',
      priority: 'urgent',
      estimated_hours: 1.5,
      frequency: 'daily',
    },
    {
      title: 'PURCHASE TO BE CHECKED',
      description: 'Verify vendor purchase bills against warehouse delivery receipts, rates, and purchase orders.',
      category: 'Purchase Verification',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'LEDGER TO BE MAINTAIN',
      description: 'Review, balance, and maintain party, vendor, tax, and overhead ledgers in accounting software.',
      category: 'Accounting & Tally',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'STOCK AUDIT',
      description: 'Perform physical stock audit and verify zero discrepancy against book inventory.',
      category: 'Stock Audit',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'daily',
    },
    {
      title: 'INVOICING IN MYBILLBOOK',
      description: 'Generate, cross-verify, and reconcile customer invoices and dispatch bills in MyBillBook.',
      category: 'Invoicing',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
  ],

  // ── RIYA (Accountant) ───────────────────────────────────────────────────────
  'riya.accountant@leretailproject.com': [
    {
      title: 'PURCHASE RECEIVING IN MYBILLBOOK',
      description: 'Log and process all received purchase consignments in MyBillBook with exact quantities.',
      category: 'Accounting',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'STOCK TO BE CHECK WITH INVOICE',
      description: 'Cross-examine physical carton units against supplier tax invoice line items.',
      category: 'Stock',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'ISSUING STOCK',
      description: 'Issue authorized inventory for channel orders and warehouse packing orders.',
      category: 'Stock',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'TAKING SALES RETURN DAILY',
      description: 'Accept, verify condition, and record daily customer sales returns in ledger.',
      category: 'Returns & Stock',
      priority: 'urgent',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'STOCK SHOULD BE TALLY WITH PHYSICAL STOCK',
      description: 'Daily reconciliation between system recorded inventory and physical floor count.',
      category: 'Audit',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'daily',
    },
    {
      title: 'PAYMENT TO BE RECEIVE IN MYBILL BOOK',
      description: 'Record and reconcile customer payments, bank transfers, and gateway settlements in MyBillBook.',
      category: 'Payments',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'BANKING TO BE GIVEN DAILY',
      description: 'Prepare daily banking deposit slips, cash tallies, and submit bank reconciliation to management.',
      category: 'Banking',
      priority: 'medium',
      estimated_hours: 0.5,
      frequency: 'daily',
    },
    {
      title: 'STOCK DELIVERY TO PARTY MANAGING WITH MANOJ',
      description: 'Coordinate stock deliveries, customer dispatches, and documentation with delivery boy Manoj.',
      category: 'Logistics Coordination',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'SALES INVOICING TO BE CHECKED',
      description: 'Audit sales invoices for rate accuracy, GST calculation, discounts, and dispatch addresses.',
      category: 'Invoicing',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'WEEKLY STOCK RECO WITH MYBILLBOOK',
      description: 'Weekly comprehensive stock balance reconciliation between physical godown and MyBillBook.',
      category: 'Reconciliation',
      priority: 'high',
      estimated_hours: 2.0,
      frequency: 'weekly',
    },
    {
      title: 'DP LESS FILE MAINTAIN',
      description: 'Maintain and update dealer price (DP less) file and authorized discount sheets.',
      category: 'Documentation',
      priority: 'low',
      estimated_hours: 0.5,
      frequency: 'daily',
    },
    {
      title: 'ALL FILING TO BE DONE PURCHASE, SALES EXPENSE OF ALL COMPANY',
      description: 'Physical & digital archiving of purchase bills, sales bills, and operational expense receipts.',
      category: 'Filing & Records',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'PO OF PUREIT, KENT, USHA',
      description: 'Prepare and track purchase orders for major brand units (Pureit, Kent, Usha) with suppliers.',
      category: 'Purchase Orders',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'DSR TO BE MAINTAIN',
      description: 'Prepare and maintain Daily Sales Report (DSR) tracking units sold, revenue, and pending dispatches.',
      category: 'Daily Sales Report',
      priority: 'high',
      estimated_hours: 0.5,
      frequency: 'daily',
    },
    {
      title: 'STOCK TO BE ARRANGE PROPERLY WITH SAME NAME LIKE PIPE COUNTER, MFM, TAP ETC',
      description: 'Supervise organized warehousing of parts by exact product naming: Pipe Counter, MFM, Tap, etc.',
      category: 'Warehouse',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'COUNTER SALE TECHNICIAN REPORT TO BE MAINTAIN',
      description: 'Maintain daily report of counter sales, technician parts issued, and returned warranty components.',
      category: 'Service Reports',
      priority: 'medium',
      estimated_hours: 0.5,
      frequency: 'daily',
    },
    {
      title: 'STOCK TO BE UPDATED IN MYBILLBOOK',
      description: 'Ensure end-of-day stock counts and closing balances are fully updated in MyBillBook.',
      category: 'Stock',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
  ],

  // ── NAUSHAD (SPN & ADs Manager) ──────────────────────────────────────────────
  'smallbusiness.ecs@gmail.com': [
    {
      title: 'Traffic Growth',
      description: 'Analyze SKU impressions. Identify which SKUs have low impressions and why. Document actions taken to boost traffic. Monitor keyword trends over last 30 days.',
      category: 'Advertising & SPN',
      priority: 'urgent',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Keyword Management',
      description: 'Review new keywords added this month. Move converting search terms from Auto to Exact campaigns. Add negative keywords to stop wasted spend. Identify top 10 converting keywords.',
      category: 'Advertising & SPN',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Bid Optimization',
      description: 'Review campaigns with bid increases/reductions. Compare bids against Amazon suggested benchmarks and adjust for maximum ROI.',
      category: 'Advertising & SPN',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'monthly',
    },
    {
      title: 'Budget Allocation',
      description: 'Determine which products deserve increased ad budget versus which are wasting spend. Reallocate budgets dynamically.',
      category: 'Advertising & SPN',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Listing Improvement Coordination',
      description: 'Identify products with low CTR. Specify required listing changes (titles, bullets, hero images) and share recommendations with account management.',
      category: 'Listing & Content',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Weekly Sales Trend',
      description: 'Analyze weekly sales performance by campaign and channel. Detect growth or decline patterns.',
      category: 'Analytics',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'weekly',
    },
    {
      title: 'Bottom 10 SKUs',
      description: 'Identify 10 lowest-performing SKUs. Review ad coverage, pricing, search rank, and customer ratings.',
      category: 'Performance',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Review Rating File',
      description: 'Analyze ratings and negative reviews across all ad campaigns to pinpoint recurring quality and messaging issues.',
      category: 'Ratings & Analytics',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'monthly',
    },
    {
      title: 'Zikhara',
      description: 'Review and update Zikhara-related tasks, campaigns, and listing performance.',
      category: 'Brand Management',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'New Product Research',
      description: 'Research potential new products, market demand, competition, pricing, and revenue opportunities.',
      category: 'R&D & Market Research',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'daily',
    },
  ],

  // ── BHARAT (Senior Account Manager) ──────────────────────────────────────────
  'bharat.manager@nityamenterprises.com': [
    {
      title: 'Inventory & Account Health Check',
      description: 'Check inventory levels and overall account health across all marketplaces. Identify low-stock, suppressed listings, or policy warnings and take corrective action.',
      category: 'Account Management',
      priority: 'urgent',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Coupon Activation Check',
      description: 'Verify that all planned promotion coupons are active, valid, and showing live on marketplaces.',
      category: 'Promotions',
      priority: 'high',
      estimated_hours: 0.5,
      frequency: 'daily',
    },
    {
      title: 'BXGY Monitoring',
      description: 'Check and monitor Buy X Get Y (BXGY) offers across accounts. Verify offer activation, eligibility, and pricing.',
      category: 'Promotions',
      priority: 'medium',
      estimated_hours: 0.5,
      frequency: 'daily',
    },
    {
      title: 'Team Performance & Meeting Analysis',
      description: 'Analyze team performance, review task completion, discuss key issues in meetings, and align priorities.',
      category: 'Leadership & Review',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'QC Checking',
      description: 'Conduct quality checks on products, listings, data, and assigned work to ensure accuracy and zero defects.',
      category: 'Quality Control',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Advertisement Account Monitoring',
      description: 'Monitor advertisements across all accounts including campaign status, spend, and ROAS performance.',
      category: 'Advertising',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'SPN Coordination & Meeting Follow-up',
      description: 'Coordinate with SPN teams, attend meetings, address pending blockers, and enforce resolutions.',
      category: 'SPN Coordination',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Purchase Order Management',
      description: 'Prepare, review, and track purchase orders. Ensure accurate quantities and follow up on pending POs.',
      category: 'Procurement',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Inventory Checking',
      description: 'Regularly monitor inventory levels, identify low-stock or out-of-stock items, and update replenishment plans.',
      category: 'Inventory',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'FBA Reports',
      description: 'Review weekly FBA reports, verify inbound tracking data, identify discrepancies, and share reconciliation.',
      category: 'FBA Logistics',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'weekly',
    },
    {
      title: 'Sales Trend Analysis',
      description: 'Analyze weekly sales performance, identify growth/decline trends, and highlight actionable insights.',
      category: 'Analytics',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'weekly',
    },
    {
      title: 'Account-wise Profitability Analysis',
      description: 'Analyze net profitability for all accounts individually by reviewing sales, commissions, ad spend, and cost of goods.',
      category: 'Finance & Profitability',
      priority: 'urgent',
      estimated_hours: 2.0,
      frequency: 'weekly',
    },
    {
      title: 'Common Name File',
      description: 'Review and update standard product common naming master file monthly.',
      category: 'Catalog Master',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'monthly',
    },
    {
      title: 'Price Master',
      description: 'Review and update the Price Master monthly. Verify prices across marketplaces and ensure pricing accuracy.',
      category: 'Pricing Master',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'monthly',
    },
    {
      title: 'MTR Reports',
      description: 'Download Monthly Tax Reports (MTR) on regular schedule and share with accounting team.',
      category: 'Tax & Compliance',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'monthly',
    },
    {
      title: 'OMS Guru Management',
      description: 'Handle daily activities in OMS Guru; monitor orders and processing statuses.',
      category: 'OMS Operations',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'PO Quality Check',
      description: 'Conduct final quality check on incoming purchase order shipments.',
      category: 'Quality Control',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'R&D – New Product Development',
      description: 'Research and identify new product development opportunities and design improvements.',
      category: 'R&D',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Product Research',
      description: 'Conduct market, competitor, demand, and pricing research to identify potential new opportunities.',
      category: 'Market Research',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
  ],

  // ── MANOJ (Delivery Boy) ─────────────────────────────────────────────────────
  'manoj.delivery@krishnacrm.com': [
    {
      title: 'Delivery',
      description: 'Complete all assigned customer deliveries on time. Ensure the product or document is delivered to the verified customer with proof of delivery.',
      category: 'Delivery & Logistics',
      priority: 'urgent',
      estimated_hours: 4.0,
      frequency: 'daily',
    },
    {
      title: 'Office Work',
      description: 'Handle assigned daily office and warehouse operational work (sorting, staging, parcel movement).',
      category: 'Office Work',
      priority: 'medium',
      estimated_hours: 2.0,
      frequency: 'daily',
    },
    {
      title: 'Cheque Collection',
      description: 'Visit clients/parties for assigned cheque collections. Verify cheque details (payee name, amount, date, signature). Update collection status in CRM. Submit collected cheques to office accounts and maintain proper receipt records.',
      category: 'Cheque Collection',
      priority: 'urgent',
      estimated_hours: 2.0,
      frequency: 'daily',
    },
  ],

  // ── SHRUTI (E-Commerce Executive) ────────────────────────────────────────────
  'shruti.ecom@nityamenterprises.com': [
    {
      title: 'Amazon Returns Entry',
      description: 'Enter all Amazon return details into tracking Excel. Record return order ID, product details, customer details, and return date. Verify return information and report discrepancies.',
      category: 'Returns Processing',
      priority: 'urgent',
      estimated_hours: 1.5,
      frequency: 'daily',
    },
    {
      title: 'OMS Guru Putaway',
      description: 'Perform putaway entries in OMS Guru for all received products. Verify product, quantity, SKU, and condition before putaway.',
      category: 'Warehouse Putaway',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'daily',
    },
    {
      title: 'Returns Claim',
      description: 'Process claims for eligible Amazon returns (damaged/missing items). Verify condition, submit claim within SLA timeline, and track claim status.',
      category: 'Claims Management',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: '60-Days Claim',
      description: 'Identify returns eligible for 60-day claims. Raise claims within applicable timeline and maintain records.',
      category: 'Claims Management',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Damage Report',
      description: 'Inspect returned items for physical or functional damage. Record exact damage details with item photos in Damage Report.',
      category: 'Quality & Inspection',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Good Inventory Report',
      description: 'Prepare report of good/usable inventory received from returns. Update inventory status in OMS.',
      category: 'Inventory',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Other Product Received Report',
      description: 'Record products received that do not match expected order details. Capture product name, quantity, customer, and tag as discrepancy.',
      category: 'Discrepancy Reporting',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Returns Calling',
      description: 'Download daily return report. Call customer to understand issue in detail. Check whether issue can be resolved with spare part / troubleshooting without return. Cancel return request only after customer confirms satisfaction.',
      category: 'Customer Calling',
      priority: 'urgent',
      estimated_hours: 2.0,
      frequency: 'daily',
    },
  ],

  // ── FAIJAL (E-Commerce Executive) ────────────────────────────────────────────
  'faijal.ecom@nityamenterprises.com': [
    {
      title: 'Confirmation Calling',
      description: 'Download daily orders report. Call customers to verify order details, compatibility, and address. Maintain 95%+ confirmation rate. Dispatch labels to packing team.',
      category: 'Order Confirmation',
      priority: 'urgent',
      estimated_hours: 3.5,
      frequency: 'daily',
    },
    {
      title: 'Monthly Cancellation Report',
      description: 'Prepare monthly cancellation report for all cancelled orders. Track cancel rate across marketplaces.',
      category: 'Reporting',
      priority: 'medium',
      estimated_hours: 1.5,
      frequency: 'monthly',
    },
    {
      title: 'Product Listing',
      description: 'Create and update product listings across marketplaces with accurate title, bullets, search terms, and pricing.',
      category: 'Catalog & Listings',
      priority: 'high',
      estimated_hours: 2.5,
      frequency: 'daily',
    },
    {
      title: 'Product Infographics',
      description: 'Design and upload high-conversion product infographics highlighting key features, dimensions, and installation diagrams.',
      category: 'Design & Graphics',
      priority: 'high',
      estimated_hours: 2.0,
      frequency: 'daily',
    },
  ],

  // ── PRIYA (E-Commerce Executive) ─────────────────────────────────────────────
  'priya.ecom@nityamenterprises.com': [
    {
      title: 'Portal Login & Morning Screenshots',
      description: 'Log into all ecommerce channel portals and Remote Desktop. Verify portals are accessible. Take morning portal screenshots and share in designated group.',
      category: 'Operations',
      priority: 'urgent',
      estimated_hours: 0.5,
      frequency: 'daily',
    },
    {
      title: 'Channel Order Processing',
      description: 'Process all channel orders after 1:20 PM accurately. After completion, take screenshots and share in group at 1:59 PM.',
      category: 'Order Processing',
      priority: 'urgent',
      estimated_hours: 1.5,
      frequency: 'daily',
    },
    {
      title: 'Channel Reports & Pivot Tables',
      description: 'Download reports from Flex, Flipkart, and Easyship. Prepare required pivot tables and share in designated group.',
      category: 'Reporting',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'FBA Shipment & Packing',
      description: 'Create FBA shipments as per requirements. Complete packing process and verify shipment details before dispatch.',
      category: 'FBA Logistics',
      priority: 'high',
      estimated_hours: 2.0,
      frequency: 'weekly',
    },
    {
      title: 'FBA File & FC Management',
      description: 'Maintain FBA master file with complete records of all Fulfillment Centers (FCs). Update shipment records.',
      category: 'FBA Logistics',
      priority: 'medium',
      estimated_hours: 1.5,
      frequency: 'weekly',
    },
    {
      title: 'Amazon Inventory Management',
      description: 'Check inventory in Amazon portal. Monitor Enhance Listing, Closed Inventory, and Replenish Inventory. Take corrective action.',
      category: 'Inventory',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Weekly Purchase Order (PO)',
      description: 'Prepare weekly PO for all products based on sales velocity and stock. Share with team.',
      category: 'Procurement',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'weekly',
    },
    {
      title: 'Monthly Sales vs. Returns Report',
      description: 'Prepare Sales vs Returns report on 15th of every month. Analyze differences and share with management.',
      category: 'Reporting',
      priority: 'high',
      estimated_hours: 2.0,
      frequency: 'monthly',
    },
    {
      title: 'AkuaBeat & Lyle Calling Master File',
      description: 'Verify and maintain AkuaBeat & Lyle Calling Master file on 15th of every month.',
      category: 'Calling Master',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'monthly',
    },
    {
      title: 'OMSGuru Invoice Issues',
      description: 'Check and resolve invoice-related issues in OMSGuru. Coordinate with team and close discrepancies.',
      category: 'Invoicing & OMS',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Returns & Channel Claims',
      description: 'Maintain returns records in Excel. File claims for eligible returns across all channels. Send usable units to Packing Room.',
      category: 'Claims & Returns',
      priority: 'high',
      estimated_hours: 1.5,
      frequency: 'daily',
    },
    {
      title: 'OMSGuru Return Putaway',
      description: 'Complete putaway process for all returned products in OMSGuru.',
      category: 'Warehouse Putaway',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: '60-Day Return Claims',
      description: 'Identify returns eligible for 60-day claims and file within applicable timeline.',
      category: 'Claims Management',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Packing Support',
      description: 'Provide packing coverage if Packing Person is on leave to ensure zero shipment delays.',
      category: 'Warehouse Operations',
      priority: 'medium',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Employee Work Monitoring',
      description: 'Check and monitor daily work of employees. Verify whether assigned tasks are completed on time.',
      category: 'Operations Supervision',
      priority: 'urgent',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'Product Quality Checking',
      description: 'Check product quality upon receiving. Identify damaged, defective, or incorrect products.',
      category: 'Quality Control',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'FBA Removal & Discrepancy SKU Checking',
      description: 'Regularly inspect FBA Removal SKUs and reconcile FBA inventory discrepancies.',
      category: 'FBA Logistics',
      priority: 'high',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
    {
      title: 'IndiaMart & Amazon Queries',
      description: 'Check all incoming IndiaMART queries, consume leads promptly, and respond to Amazon customer buyer messages.',
      category: 'Lead & Query Response',
      priority: 'urgent',
      estimated_hours: 1.0,
      frequency: 'daily',
    },
  ],
};

/**
 * Assign mandatory tasks to a specific user for a given date
 * @param {User} user - User record instance
 * @param {string} targetDate - YYYY-MM-DD
 * @param {string} assignerUserId - User ID of creator / admin
 */
exports.syncUserMandatoryTasks = async (user, targetDate = null, assignerUserId = null) => {
  if (!user) return { created: 0, existing: 0 };

  const dateStr = targetDate || new Date().toISOString().split('T')[0];
  const userEmail = (user.email || '').toLowerCase().trim();

  const taskTemplates = MANDATORY_TASK_CATALOG[userEmail] || [];
  if (taskTemplates.length === 0) {
    return { created: 0, existing: 0 };
  }

  let adminId = assignerUserId;
  if (!adminId) {
    const admin = await User.findOne({ where: { role: { [Op.in]: ['admin', 'super_admin'] } } });
    adminId = admin ? admin.id : user.id;
  }

  let createdCount = 0;
  let existingCount = 0;

  for (const tpl of taskTemplates) {
    // Check if task with exact title already exists for this user on this date
    const existing = await DailyActivity.findOne({
      where: {
        assigned_to: user.id,
        scheduled_date: dateStr,
        title: tpl.title,
      },
    });

    if (existing) {
      existingCount++;
      continue;
    }

    const newActivity = await DailyActivity.create({
      title: tpl.title,
      description: tpl.description,
      category: tpl.category || 'General',
      priority: tpl.priority || 'medium',
      scheduled_date: dateStr,
      due_date: dateStr,
      estimated_hours: tpl.estimated_hours || 1.0,
      actual_hours: 0.0,
      status: 'ASSIGNED',
      assigned_by: adminId,
      assigned_to: user.id,
      shift_duration: 24,
    });

    await DailyActivityHistory.create({
      activity_id: newActivity.id,
      actor_id: adminId,
      event_type: 'ACTIVITY_ASSIGNED',
      old_status: null,
      new_status: 'ASSIGNED',
      notes: `Mandatory routine assigned for ${user.name} (${dateStr}) per enterprise job specification.`,
    });

    createdCount++;
  }

  logger.info(`Mandatory Tasks Sync for ${user.name} (${user.email}): ${createdCount} created, ${existingCount} already present.`);
  return { created: createdCount, existing: existingCount };
};

/**
 * Batch sync mandatory daily tasks across all active staff users
 * @param {string} targetDate - YYYY-MM-DD
 */
exports.syncAllMandatoryTasks = async (targetDate = null) => {
  const dateStr = targetDate || new Date().toISOString().split('T')[0];
  const allUsers = await User.findAll({ where: { is_active: true } });

  let totalCreated = 0;
  let totalExisting = 0;
  const userResults = [];

  for (const u of allUsers) {
    const res = await exports.syncUserMandatoryTasks(u, dateStr);
    totalCreated += res.created;
    totalExisting += res.existing;
    if (res.created > 0 || res.existing > 0) {
      userResults.push({
        userName: u.name,
        email: u.email,
        created: res.created,
        existing: res.existing,
      });
    }
  }

  return {
    scheduled_date: dateStr,
    totalCreated,
    totalExisting,
    usersProcessed: userResults.length,
    details: userResults,
  };
};

module.exports = exports;
