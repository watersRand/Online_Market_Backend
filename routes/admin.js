const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { getSuperAdminDashboard, getVendorAdminDashboard } = require('../controllers/adminController');

// Super Admin Dashboard Analytics
router.get('/dashboard/super', protect, authorize(['admin']), getSuperAdminDashboard);

// Vendor Admin Dashboard Analytics
router.get('/dashboard/vendor', protect, authorize(['vendorAdmin']), getVendorAdminDashboard);

module.exports = router;