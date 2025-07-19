// controllers/adminController.js

const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/carts'); // Assuming 'Order' is your final order model
const Complaint = require('../models/complaints');
const Delivery = require('../models/delivery');
const Vendor = require('../models/vendor');

// Helper to calculate total sales from orders
const calculateTotalSales = (orders) => {
    return orders.reduce((acc, order) => acc + order.totalPrice, 0); // Assuming totalPrice is on the Order model
};

// Helper to get status distribution
const getStatusDistribution = (items, statusField = 'status') => {
    const distribution = {};
    items.forEach(item => {
        distribution[item[statusField]] = (distribution[item[statusField]] || 0) + 1;
    });
    return Object.keys(distribution).map(status => ({ _id: status, count: distribution[status] }));
};

// @desc    Get data for Super Admin Dashboard
// @access  Private/Admin (called internally by route)
const getSuperAdminDashboardData = asyncHandler(async () => {
    // Total Users
    const totalUsers = await User.countDocuments({});
    // Total Products
    const totalProducts = await Product.countDocuments({});
    // Total Vendors
    const totalVendors = await Vendor.countDocuments({});

    // Orders data
    const allOrders = await Order.find({});
    const totalOrders = allOrders.length;
    const totalSales = calculateTotalSales(allOrders);
    const orderStatusDistribution = getStatusDistribution(allOrders, 'status');

    // Complaints data
    const allComplaints = await Complaint.find({});
    const complaintStats = getStatusDistribution(allComplaints, 'status');

    // Deliveries data
    const allDeliveries = await Delivery.find({});
    const deliveryStatusDistribution = getStatusDistribution(allDeliveries, 'status');

    // Recent Orders (e.g., last 5) - populate user for display
    const recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name email');

    // Top Selling Products (requires aggregation)
    const topSellingProducts = await Order.aggregate([
        { $unwind: '$items' },
        // Match only orders that are considered "sold"
        { $match: { status: { $in: ['approved', 'processing', 'shipped', 'delivered', 'completed'] } } },
        {
            $group: {
                _id: '$items.productId', // Group by the actual product ID
                totalQuantitySold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
            }
        },
        { $sort: { totalQuantitySold: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'products', // The collection name for products
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: '$productDetails' }, // Unwind the productDetails array
        {
            $project: {
                _id: 0,
                productName: '$productDetails.name', // Use 'productName' to match EJS
                productCategory: '$productDetails.category', // Use 'productCategory' to match EJS
                totalQuantitySold: 1,
                totalRevenue: 1
            }
        }
    ]);

    return {
        totalUsers,
        totalProducts,
        totalOrders,
        totalSales,
        totalVendors,
        orderStatusDistribution,
        complaintStats,
        deliveryStatusDistribution,
        recentOrders,
        topSellingProducts
    };
});

// @desc    Get data for Vendor Admin Dashboard
// @access  Private/VendorAdmin (called internally by route)
const getVendorAdminDashboardData = asyncHandler(async (vendorId) => {
    if (!vendorId) {
        throw new Error('Vendor ID is required to fetch vendor dashboard data.');
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
        throw new Error('Vendor not found for dashboard.');
    }

    // Total Products by this Vendor
    const totalVendorProducts = await Product.countDocuments({ vendor: vendorId });

    // Total Orders & Sales Volume for this Vendor's products
    const vendorOrdersWithVendorItems = await Order.aggregate([
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products', // Assuming products collection
                localField: 'items.productId', // Match product ID in order item
                foreignField: '_id',
                as: 'productInfo'
            }
        },
        { $unwind: '$productInfo' },
        { $match: { 'productInfo.vendor': vendorId } },
        // Re-group by original order ID to get unique orders
        {
            $group: {
                _id: '$_id', // Group by original order ID
                status: { $first: '$status' }, // Keep original order status
                totalPrice: { $first: '$totalPrice' }, // Keep original order total price
                vendorSpecificTotal: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
            }
        },
        { $match: { status: { $in: ['approved', 'processing', 'shipped', 'delivered', 'completed'] } } }
    ]);

    const totalVendorOrders = vendorOrdersWithVendorItems.length;
    const totalVendorSales = vendorOrdersWithVendorItems.reduce((acc, order) => acc + order.vendorSpecificTotal, 0);

    // Order Status Distribution for this Vendor's products (based on orders that contain vendor's products)
    const vendorOrderStatusDistribution = getStatusDistribution(vendorOrdersWithVendorItems, 'status');

    // Complaints related to this Vendor
    const vendorComplaints = await Complaint.find({ vendor: vendorId });
    const vendorComplaintStats = getStatusDistribution(vendorComplaints, 'status');

    // Top Selling Products for this Vendor
    const topSellingVendorProducts = await Order.aggregate([
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.productId', // Match product ID in order item
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: '$productDetails' },
        // Match only products belonging to this vendor AND orders that are "sold"
        { $match: { 'productDetails.vendor': vendorId, status: { $in: ['approved', 'processing', 'shipped', 'delivered', 'completed'] } } },
        {
            $group: {
                _id: '$items.productId', // Group by the actual product ID
                totalQuantitySold: { $sum: '$items.quantity' },
                totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
                productName: { $first: '$productDetails.name' }, // Get product name from productDetails
                productCategory: { $first: '$productDetails.category' } // Get category from productDetails
            }
        },
        { $sort: { totalQuantitySold: -1 } },
        { $limit: 5 },
        {
            $project: {
                _id: 0,
                productName: 1,
                productCategory: 1,
                totalQuantitySold: 1,
                totalRevenue: 1
            }
        }
    ]);

    return {
        vendorName: vendor.name,
        totalVendorProducts,
        totalVendorOrders,
        totalVendorSales,
        vendorOrderStatusDistribution,
        vendorComplaintStats,
        topSellingVendorProducts
    };
});

// @desc    Get all users for management (Admin only)
// @access  Private/Admin
const getUsersManagementData = asyncHandler(async () => {
    const users = await User.find({})
        .select('-password') // Exclude password
        .populate('vendor', 'name'); // Populate vendor name if user is a vendor
    return users;
});

// @desc    Get all orders for management (Admin only)
// @access  Private/Admin
const getOrdersManagementData = asyncHandler(async () => {
    const orders = await Order.find({})
        .populate('userId', 'name email') // Populate user who placed the order
        .populate('items.productId', 'name image') // Populate product details for each item
        .sort({ createdAt: -1 });
    return orders;
});


module.exports = {
    getSuperAdminDashboardData,
    getVendorAdminDashboardData,
    getUsersManagementData, // Export new function
    getOrdersManagementData, // Export new function
};
