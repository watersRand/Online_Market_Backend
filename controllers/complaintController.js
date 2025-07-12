const asyncHandler = require('express-async-handler');
const Complaint = require('../models/complaints');
const User = require('../models/User');
const Order = require('../models/carts'); // For validating order if provided
const Vendor = require('../models/vendor'); // For validating vendor if provided
const { invalidateCache } = require('../controllers/cacheController')


// @desc    Create a new complaint
// @route   POST /api/complaints
// @access  Private/User
const createComplaint = asyncHandler(async (req, res) => {
    const { vendorId, orderId, subject, description } = req.body;
    console.log(req.user)
    if (!subject || !description) {
        res.status(400);
        throw new Error('Subject and description are required for a complaint.');
    }

    if (orderId) {
        const order = await Order.findById(orderId).populate();
        if (!order || order.userId !== req.user) { //Order should belong to user
            res.status(404);
            throw new Error('Order not found or does not belong to the user.');
        }
    }

    if (vendorId) {
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            res.status(404);
            throw new Error('Vendor not found.');
        }
    }

    const complaint = new Complaint({
        user: req.user,
        vendor: vendorId,
        order: orderId,
        subject,
        description,
        status: 'open',
    });

    const createdComplaint = await complaint.save();
    await invalidateCache('complaints:/api/complaints*');

    res.status(201).json(createdComplaint);
});

// @desc    Get all complaints (Super Admin only)
// @route   GET /api/complaints
// @access  Private/Admin
const getAllComplaints = asyncHandler(async (req, res) => {
    const complaints = await Complaint.find({})
        .populate('user', 'name email')
        .populate('vendor', 'name')
        .populate('order', 'totalAmount status')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });

    res.json(complaints);
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
        .populate('order', 'totalAmount status')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 });

    res.json(complaints);
});


// @desc    Get logged in user's complaints
// @route   GET /api/complaints/my-complaints
// @access  Private/User
const getMyComplaints = asyncHandler(async (req, res) => {
    const complaints = await Complaint.find({ user: req.user._id })
        .populate('vendor', 'name')
        .populate('order', 'totalAmount status')
        .sort({ createdAt: -1 });

    res.json(complaints);
});

// @desc    Get a single complaint by ID
// @route   GET /api/complaints/:id
// @access  Private (User/VendorAdmin/Admin)
const getComplaintById = asyncHandler(async (req, res) => {
    const complaint = await Complaint.findById(req.params.id)
        .populate('user', 'name email')
        .populate('vendor', 'name')
        .populate('order', 'totalAmount status')
        .populate('assignedTo', 'name email');

    if (!complaint) {
        res.status(404);
        throw new Error('Complaint not found.');
    }

    // Authorization: User who filed, Vendor Admin related to vendor, or Super Admin
    const isOwner = complaint.user._id.toString() === req.user._id.toString();
    const isVendorAdminForComplaint = req.user.vendor && complaint.vendor && complaint.vendor._id.toString() === req.user.vendor._id.toString();
    const isAdmin = req.user.isAdmin;

    if (!isOwner && !isVendorAdminForComplaint && !isAdmin) {
        res.status(403);
        throw new Error('Not authorized to view this complaint.');
    }

    res.json(complaint);
});


// @desc    Update complaint status/response/assignment (Admin/Vendor Admin)
// @route   PUT /api/complaints/:id
// @access  Private/Admin or VendorAdmin
const updateComplaint = asyncHandler(async (req, res) => {
    const { status, response, assignedTo } = req.body;
    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
        res.status(404);
        throw new Error('Complaint not found.');
    }

    // Authorization: Super Admin or Vendor Admin of the related vendor
    const isVendorAdminForComplaint = req.user.vendor && complaint.vendor && complaint.vendor._id.toString() === req.user.vendor._id.toString();
    const isAdmin = req.user.isAdmin;

    if (!isAdmin && !isVendorAdminForComplaint) {
        res.status(403);
        throw new Error('Not authorized to update this complaint.');
    }

    // Only Super Admin can assign a complaint
    if (assignedTo && !isAdmin) {
        res.status(403);
        throw new Error('Only Super Admins can assign complaints.');
    }
    if (assignedTo) {
        const assignedUser = await User.findById(assignedTo);
        // You might want to restrict assignment to users with specific roles (e.g., support, admin)
        if (!assignedUser || (!assignedUser.isAdmin && !assignedUser.isDeliveryPerson)) { // Example: can be assigned to admin or delivery person
            res.status(400);
            throw new Error('Invalid user to assign complaint to.');
        }
        complaint.assignedTo = assignedTo;
    }


    if (status) complaint.status = status;
    if (response) complaint.response = response;

    const updatedComplaint = await complaint.save();
    await invalidateCache([
        `complaints:/api/complaints/${req.params.id}`, // Specific product by ID
        'complaints:/api/complaints*'                  // All product list views
    ]);

    res.json(updatedComplaint);
});


module.exports = {
    createComplaint,
    getAllComplaints,
    getVendorComplaints,
    getMyComplaints,
    getComplaintById,
    updateComplaint,
};