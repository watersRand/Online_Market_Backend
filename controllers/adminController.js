const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/carts'); // Assuming Order model is 'carts'
const Complaint = require('../models/complaints');
const Delivery = require('../models/delivery');

// @desc    Get dashboard analytics for Super Admin
// @route   GET /api/admin/dashboard/super
// @access  Private/Admin
const getSuperAdminDashboard = asyncHandler(async (req, res) => {
    // Total Users
    const totalUsers = await User.countDocuments({});
    // Total Products
    const totalProducts = await Product.countDocuments({});
    // Total Orders & Sales Volume
    const totalOrders = await Order.countDocuments({});
    const totalSalesResult = await Order.aggregate([
        { $match: { status: { $in: ['approved', 'processing', 'shipped', 'delivered', 'completed'] } } }, // Added 'completed'
        { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } },
    ]);
    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

    // Order Status Distribution
    const orderStatusDistribution = await Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Complaint Statistics
    const complaintStats = await Complaint.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Recent Orders (e.g., last 5)
    const recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name email'); // Populate 'user' not 'userId' based on common Mongoose schemas

    // Top Selling Products (example: by quantity sold)
    const topSellingProducts = await Order.aggregate([
        { $unwind: '$items' },
        { $match: { status: { $in: ['approved', 'processing', 'shipped', 'delivered', 'completed'] } } }, // Added 'completed'
        {
            $group: {
                _id: '$items.product',
                totalQuantitySold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
            }
        },
        { $sort: { totalQuantitySold: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'products', // The collection name
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: '$productDetails' },
        {
            $project: {
                _id: 0,
                product: '$productDetails.name',
                category: '$productDetails.category',
                totalQuantitySold: 1,
                totalRevenue: 1
            }
        }
    ]);

    // Delivery Status Distribution
    const deliveryStatusDistribution = await Delivery.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const dashboardData = {
        totalUsers,
        totalProducts,
        totalOrders,
        totalSales,
        orderStatusDistribution,
        complaintStats,
        recentOrders,
        topSellingProducts,
        deliveryStatusDistribution
    };

    // Emit initial dashboard data to the requesting admin's socket or to the admin dashboard room


    res.json(dashboardData);
});

// @desc    Get dashboard analytics for Vendor Admin
// @route   GET /api/admin/dashboard/vendor
// @access  Private/VendorAdmin
const getVendorAdminDashboard = asyncHandler(async (req, res) => {
    // req.user.vendor is populated from authMiddleware
    const vendorId = req.user.vendor._id;

    if (!vendorId) {
        res.status(400);
        throw new Error('User is not assigned to a vendor.');
    }

    // Total Products by this Vendor
    const totalVendorProducts = await Product.countDocuments({ vendor: vendorId });

    // Total Orders & Sales Volume for this Vendor's products
    const vendorSalesPipeline = [
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'productInfo'
            }
        },
        { $unwind: '$productInfo' },
        { $match: { 'productInfo.vendor': vendorId, status: { $in: ['approved', 'processing', 'shipped', 'delivered', 'completed'] } } }, // Added 'completed'
        {
            $group: {
                _id: null,
                totalOrders: { $addToSet: '$_id' }, // Count unique orders
                totalSales: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
            }
        },
    ];
    const vendorSalesResult = await Order.aggregate(vendorSalesPipeline);
    const totalVendorOrders = vendorSalesResult.length > 0 ? vendorSalesResult[0].totalOrders.length : 0;
    const totalVendorSales = vendorSalesResult.length > 0 ? vendorSalesResult[0].totalSales : 0;

    // Order Status Distribution for this Vendor's products
    const vendorOrderStatusDistribution = await Order.aggregate([
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'productInfo'
            }
        },
        { $unwind: '$productInfo' },
        { $match: { 'productInfo.vendor': vendorId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Complaints related to this Vendor
    const vendorComplaintStats = await Complaint.aggregate([
        { $match: { vendor: vendorId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Top Selling Products for this Vendor
    const topSellingVendorProducts = await Order.aggregate([
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.product',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: '$productDetails' },
        { $match: { 'productDetails.vendor': vendorId, status: { $in: ['approved', 'processing', 'shipped', 'delivered', 'completed'] } } }, // Added 'completed'
        {
            $group: {
                _id: '$items.product',
                totalQuantitySold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
            }
        },
        { $sort: { totalQuantitySold: -1 } },
        { $limit: 5 },
        {
            $project: {
                _id: 0,
                product: '$productDetails.name',
                category: '$productDetails.category',
                totalQuantitySold: 1,
                totalRevenue: 1
            }
        }
    ]);

    const dashboardData = {
        vendorName: req.user.vendor.name,
        totalVendorProducts,
        totalVendorOrders,
        totalVendorSales,
        vendorOrderStatusDistribution,
        vendorComplaintStats,
        topSellingVendorProducts
    };

    res.json(dashboardData);
});

module.exports = {
    getSuperAdminDashboard,
    getVendorAdminDashboard,
};