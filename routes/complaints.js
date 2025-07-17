const express = require('express');
const router = express.Router();
const { createComplaint, getAllComplaints, getVendorComplaints, getMyComplaints, getComplaintById, updateComplaint } = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/authMiddleware');
const Complaint = require('../models/complaints'); // For rendering
const Order = require('../models/carts'); // Your Order model (named Cart)
const Vendor = require('../models/vendor'); // For complaint form to select vendor
const User = require('../models/User'); // For complaint form to select assignedTo users

// Render all complaints (Admin only)
router.get('/complaints', protect, authorize('Admin'), async (req, res) => {
    const complaints = await Complaint.find({})
        .populate('user', 'name email')
        .populate('vendor', 'name')
        .populate('order', 'totalAmount status')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });
    res.render('complaint_list', { title: 'All Complaints', complaints, user: req.user });
});

// Render vendor-specific complaints (Vendor Admin only)
router.get('/complaints/vendor', protect, authorize('vendor'), async (req, res) => {
    const complaints = await Complaint.find({ vendor: req.user.vendor._id })
        .populate('user', 'name email')
        .populate('order', 'totalAmount status')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });
    res.render('complaint_list', { title: 'My Vendor Complaints', complaints, user: req.user, isVendorComplaints: true });
});

// Render logged-in user's complaints
router.get('/complaints/my-complaints', protect, async (req, res) => {
    const complaints = await Complaint.find({ user: req.user._id })
        .populate('vendor', 'name')
        .populate('order', 'totalAmount status')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });
    res.render('complaint_list', { title: 'My Filed Complaints', complaints, user: req.user, isMyComplaints: true });
});

// Render file complaint form
router.get('/complaints/file', protect, async (req, res) => {
    const orders = await Order.find({ user: req.user._id }); // Only show user's own orders
    const vendors = await Vendor.find({}); // Show all vendors
    res.render('complaint_form', { title: 'File Complaint', orders, vendors, user: req.user });
});

// Handle complaint creation
router.post('/complaints', protect, createComplaint);

// Render single complaint details
router.get('/complaints/:id', protect, async (req, res) => {
    const complaint = await Complaint.findById(req.params.id)
        .populate('user', 'name email')
        .populate('vendor', 'name')
        .populate('order', 'totalAmount status')
        .populate('assignedTo', 'name email');

    if (!complaint) {
        return res.status(404).render('error', { title: 'Complaint Not Found', message: 'Complaint not found.' });
    }

    // Authorization check (same as in controller)
    const isOwner = complaint.user._id.toString() === req.user._id.toString();
    const isVendorAdminForComplaint = req.user.vendor && complaint.vendor && complaint.vendor._id.toString() === req.user.vendor._id.toString();
    const isAdmin = req.user.isAdmin;

    if (!isOwner && !isVendorAdminForComplaint && !isAdmin) {
        return res.status(403).render('error', { title: 'Unauthorized', message: 'Not authorized to view this complaint.' });
    }

    let assignedToUsers = [];
    if (isAdmin) {
        // Fetch users with Admin, Support, or DeliveryPerson roles for assignment dropdown
        assignedToUsers = await User.find({
            $or: [
                { roles: 'Admin' },
                { roles: 'support' }, // Assuming a 'support' role
                { isDeliveryPerson: true }
            ]
        });
    }

    res.render('complaint_detail', { title: `Complaint #${complaint._id}`, complaint, user: req.user, assignedToUsers });
});

// Handle complaint update
router.put('/complaints/:id', protect, authorize('Admin', 'vendor'), updateComplaint);

module.exports = router;