const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getSuperAdminDashboard, getVendorAdminDashboard } = require('../controllers/adminController');
const { cacheResponse } = require('../controllers/cacheController')


// Super Admin Dashboard Analytics
router.get('/dashboard/super', protect, authorize(['admin']), cacheResponse('admin', 300), getSuperAdminDashboard);

// Vendor Admin Dashboard Analytics
router.get('/dashboard/vendor', protect, authorize(['vendorAdmin']), cacheResponse('admin', 300), getVendorAdminDashboard);

module.exports = router;