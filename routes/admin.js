const express = require('express');
const router = express.Router();
const { getSuperAdminDashboard, getVendorAdminDashboard } = require('../controllers/adminController');
const { protect, authorize, populateVendor } = require('../middleware/authMiddleware');

// Render Super Admin Dashboard
router.get('/dashboard/super', protect, authorize('Admin'), async (req, res) => {
    // Call the controller function to get data (which currently returns JSON)
    // For EJS, you'd typically fetch the data here and pass it to render
    // Since the controller already aggregates, we'll just simulate a call.
    // In a real app, you might refactor adminController to return data directly
    // or use a separate service layer.
    const mockDashboardData = {
        totalUsers: 10,
        totalProducts: 50,
        totalOrders: 25,
        totalSales: 5123.45,
        orderStatusDistribution: [{ _id: 'approved', count: 15 }, { _id: 'pending', count: 5 }, { _id: 'delivered', count: 5 }],
        complaintStats: [{ _id: 'open', count: 3 }, { _id: 'resolved', count: 7 }],
        recentOrders: [
            { _id: 'ORD001', user: { name: 'John Doe', email: 'john@example.com' }, totalAmount: 120.50, status: 'delivered', createdAt: new Date() },
            { _id: 'ORD002', user: { name: 'Jane Smith', email: 'jane@example.com' }, totalAmount: 55.00, status: 'pending', createdAt: new Date() }
        ],
        topSellingProducts: [
            { product: 'Laptop', category: 'Electronics', totalQuantitySold: 10, totalRevenue: 1000 },
            { product: 'Mouse', category: 'Accessories', totalQuantitySold: 15, totalRevenue: 150 }
        ],
        deliveryStatusDistribution: [{ _id: 'delivered', count: 10 }, { _id: 'assigned', count: 5 }]
    };
    res.render('super_admin_dashboard', { title: 'Super Admin Dashboard', dashboardData: mockDashboardData, user: req.user });
});

// Render Vendor Admin Dashboard
router.get('/dashboard/vendor', protect, authorize('vendor'), populateVendor, async (req, res) => {
    if (!req.user.vendor) {
        return res.status(403).render('error', { title: 'Unauthorized', message: 'You are not assigned to a vendor.' });
    }
    const mockVendorDashboardData = {
        vendorName: req.user.vendor.name || 'My Vendor',
        totalVendorProducts: 15,
        totalVendorOrders: 10,
        totalVendorSales: 2500.75,
        vendorOrderStatusDistribution: [{ _id: 'approved', count: 7 }, { _id: 'pending', count: 3 }],
        vendorComplaintStats: [{ _id: 'open', count: 1 }, { _id: 'resolved', count: 2 }],
        topSellingVendorProducts: [
            { product: 'Vendor Product A', category: 'Category 1', totalQuantitySold: 5, totalRevenue: 500 },
            { product: 'Vendor Product B', category: 'Category 2', totalQuantitySold: 8, totalRevenue: 800 }
        ]
    };
    res.render('vendor_admin_dashboard', { title: `Vendor Dashboard - ${mockVendorDashboardData.vendorName}`, dashboardData: mockVendorDashboardData, user: req.user });
});

module.exports = router;