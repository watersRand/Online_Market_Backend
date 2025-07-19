// controllers/complaintController.js

const asyncHandler = require('express-async-handler');
const Complaint = require('../models/complaints');
const User = require('../models/User');
const Order = require('../models/carts'); // Corrected to Order model
const Vendor = require('../models/vendor'); // For validating vendor if provided



// @desc    Create a new complaint
// @route   POST /api/complaints
// @access  Private/User
const createComplaint = asyncHandler(async (req, res) => {
    const { vendorId, orderId, subject, description } = req.body;
    const user = req.user; // Authenticated user from middleware

    if (!subject || !description) {
        res.status(400);
        throw new Error('Subject and description are required for a complaint.');
    }

    // Validate order if provided
    if (orderId) {
        const order = await Order.findById(orderId);
        // Corrected check: order.user._id if populated, or order.user directly if it's just the ID
        // Assuming your Order model has a 'user' field that stores the customer's User ID
        if (!order || order.user.toString() !== user._id.toString()) {
            res.status(404);
            throw new Error('Order not found or does not belong to the user.');
        }
    }

    // Validate vendor if provided
    let vendorName = null;
    if (vendorId) {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            res.status(404);
            throw new Error('Vendor not found.');
        }
        vendorName = vendor.name;
    }

    const complaint = new Complaint({
        user: user._id, // Store the user's ID
        vendor: vendorId || null,
        order: orderId || null,
        subject,
        description,
        status: 'open', // Initial status
    });

    const createdComplaint = await complaint.save();



    res.redirect('/api/complaints/complaints/my-complaints');
});

// @desc    Get all complaints (Super Admin only)
// @route   GET /api/complaints
// @access  Private/Admin
const getAllComplaints = asyncHandler(async (req, res) => {
    const complaints = await Complaint.find({})
        .populate('user', 'name email')
        .populate('vendor', 'name')
        .populate('order', 'totalPrice status')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });
    res.render('complaints/complaint_list', { title: 'All Complaints', complaints, user: req.user });
});

// @desc    Get complaints for a specific vendor (Vendor Admin only)
// @route   GET /api/complaints/vendor
// @access  Private/VendorAdmin
const getVendorComplaints = asyncHandler(async (req, res) => {
    const vendorId = req.user.vendor._id; // Populated by authMiddleware

    if (!vendorId) {
        res.status(403);
        throw new Error('User is not a vendor admin or not assigned to a vendor.');
    }

    const complaints = await Complaint.find({ vendor: vendorId })
        .populate('user', 'name email')
        .populate('order', 'totalPrice status') // Corrected to totalPrice
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });

    res.render('complaints/complaint_list', { title: 'My Vendor Complaints', complaints, user: req.user, isVendorComplaints: true });
});

// @desc    Get logged in user's complaints
// @route   GET /api/complaints/my-complaints
// @access  Private/User
const getMyComplaints = asyncHandler(async (req, res) => {
    const complaints = await Complaint.find({ user: req.user._id })
        .populate('vendor', 'name')
        .populate('order', 'totalPrice status') // Corrected to totalPrice
        .sort({ createdAt: -1 });

    res.render('complaints/complaint_list', { title: 'My Filed Complaints', complaints, user: req.user, isMyComplaints: true });
});

// @desc    Get a single complaint by ID
// @route   GET /api/complaints/:id
// @access  Private (User/VendorAdmin/Admin)
const getComplaintById = asyncHandler(async (req, res) => {
    const complaint = await Complaint.findById(req.params.id)
        .populate('user', 'name email')
        .populate('vendor', 'name')
        .populate('order', 'totalPrice status')
        .populate('assignedTo', 'name email');

    if (!complaint) {
        res.status(404);
        throw new Error('Complaint not found.');
    }

    // Authorization: User who filed, Vendor Admin related to vendor, or Super Admin
    const isOwner = complaint.user && req.user && complaint.user._id.toString() === req.user._id.toString();
    const isVendorAdminForComplaint = req.user && req.user.vendor && complaint.vendor && complaint.vendor._id.toString() === req.user.vendor._id.toString();
    const isAdmin = req.user && req.user.roles === 'Admin';

    if (!isOwner && !isVendorAdminForComplaint && !isAdmin) {
        res.status(403);
        throw new Error('Not authorized to view this complaint.');
    }

    let assignedToUsers = [];
    if (isAdmin || isVendorAdminForComplaint) {
        assignedToUsers = await User.find({
            $or: [
                { roles: 'Admin' },
                { roles: 'Delivery' }
            ]
        }).select('name email');
    }

    res.render('complaints/complaint_detail', { title: `Complaint #${complaint._id}`, complaint, user: req.user, assignedToUsers });
});

// @desc    Update complaint status/response/assignment (Admin/Vendor Admin)
// @route   PUT /api/complaints/:id
// @access  Private/Admin or VendorAdmin
const updateComplaint = asyncHandler(async (req, res) => {
    const { status, response, assignedTo } = req.body;
    const complaint = await Complaint.findById(req.params.id)
        .populate('user', 'name email')
        .populate('vendor', 'name')
        .populate('assignedTo', 'name email');

    if (!complaint) {
        res.status(404);
        throw new Error('Complaint not found.');
    }

    const oldStatus = complaint.status;

    // Authorization: Super Admin or Vendor Admin of the related vendor
    const isVendorAdminForComplaint = req.user.vendor && complaint.vendor && complaint.vendor._id.toString() === req.user.vendor._id.toString();
    const isAdmin = req.user && req.user.roles.includes('Admin')

    if (!isAdmin && !isVendorAdminForComplaint) {
        res.status(403);
        throw new Error('Not authorized to update this complaint.');
    }

    // Only Super Admin can assign a complaint
    if (assignedTo && !isAdmin) {
        res.status(403);
        throw new Error('Only Super Admins can assign complaints.');
    }
    const oldAssignedTo = complaint.assignedTo ? complaint.assignedTo._id.toString() : null;
    if (assignedTo) {
        const assignedUser = await User.findById(assignedTo);
        if (!assignedUser || (!assignedUser.roles.includes('Admin') && !assignedUser.roles.includes('Support') && !assignedUser.isDeliveryPerson)) { // Example roles for assignment
            res.status(400);
            throw new Error('Invalid user to assign complaint to (must be Admin/Support/Delivery Person).');
        }
        complaint.assignedTo = assignedTo;
    }

    if (status) complaint.status = status;
    if (response) complaint.response = response;

    const updatedComplaint = await complaint.save();



    res.render('complaints/complaint_detail', { title: `Complaint #${complaint._id}`, complaint, user: req.user, assignedTo });
});

module.exports = {
    createComplaint,
    getAllComplaints,
    getVendorComplaints,
    getMyComplaints,
    getComplaintById,
    updateComplaint,
};