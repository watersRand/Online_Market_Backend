// routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const { protect, authorize, populateVendor } = require('../middleware/authMiddleware');
const { getSuperAdminDashboardData, getVendorAdminDashboardData } = require('../controllers/adminController'); // Import the new controller functions

// Render Super Admin Dashboard
router.get('/dashboard/super', protect, authorize('Admin'), async (req, res, next) => {
    try {
        const dashboardData = await getSuperAdminDashboardData();
        res.render('admin/super_admin_dashboard', {
            title: 'Super Admin Dashboard',
            dashboardData: dashboardData,
            user: req.user,
            message: req.flash('success'),
            error: req.flash('error'),
            info: req.flash('info')
        });
    } catch (error) {
        next(error); // Pass error to error handling middleware
    }
});

// Render Vendor Admin Dashboard
router.get('/dashboard/vendor', protect, authorize('Vendor'), populateVendor, async (req, res, next) => {
    if (!req.user.vendor) {
        req.flash('error', 'You are not assigned to a vendor.');
        return res.status(403).redirect('/dashboard'); // Redirect to a generic dashboard or home
    }
    try {
        const dashboardData = await getVendorAdminDashboardData(req.user.vendor._id);
        res.render('admin/vendor_admin_dashboard', {
            title: `Vendor Dashboard - ${dashboardData.vendorName}`,
            dashboardData: dashboardData,
            user: req.user,
            message: req.flash('success'),
            error: req.flash('error'),
            info: req.flash('info')
        });
    } catch (error) {
        next(error); // Pass error to error handling middleware
    }
});

module.exports = router;
