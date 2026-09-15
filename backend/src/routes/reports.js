'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Reports — accessible to admin, manager, ceo
router.get('/sales',     authorize('admin', 'manager', 'ceo'), ctrl.getSalesReport);
router.get('/customers', authorize('admin', 'manager', 'ceo'), ctrl.getCustomerReport);
router.get('/team',      authorize('admin', 'manager', 'ceo'), ctrl.getTeamReport);
router.get('/follow-ups', authorize('admin', 'manager', 'ceo'), ctrl.getFollowUpReport);

// CSV / Excel / PDF exports — same access level
router.get('/export/orders',    authorize('admin', 'manager', 'ceo'), ctrl.exportOrders);
router.get('/export/customers', authorize('admin', 'manager', 'ceo'), ctrl.exportCustomers);
router.get('/export/team',      authorize('admin', 'manager', 'ceo'), ctrl.exportTeam);

module.exports = router;
