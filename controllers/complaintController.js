const asyncHandler = require('express-async-handler');
const Complaint = require('../models/complaints');
const User = require('../models/User');
const Order = require('../models/carts'); // For validating order if provided
const Vendor = require('../models/vendor'); // For validating vendor if provided
const { invalidateCache } = require('../controllers/cacheController');
const { getIo } = require('../config/socket'); // Import getIo to access Socket.IO

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
    await invalidateCache('complaints:/api/complaints*');

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // 1. Notify Super Admin Dashboard
        io.to('admin_dashboard').emit('newComplaint', {
            complaintId: createdComplaint._id,
            userId: user._id,
            userName: user.name,
            subject: createdComplaint.subject,
            description: createdComplaint.description,
            status: createdComplaint.status,
            vendorName: vendorName,
            orderId: orderId,
            message: `New complaint filed by ${user.name}: "${createdComplaint.subject}".`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'newComplaint' to admin dashboard.`);

        // 2. Notify Vendor Admin Dashboard (if vendorId is provided)
        if (vendorId) {
            io.to(`vendor_dashboard:${vendorId.toString()}`).emit('newVendorComplaint', {
                complaintId: createdComplaint._id,
                userId: user._id,
                userName: user.name,
                subject: createdComplaint.subject,
                description: createdComplaint.description,
                status: createdComplaint.status,
                orderId: orderId,
                message: `New complaint received for your vendor by ${user.name}: "${createdComplaint.subject}".`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'newVendorComplaint' to vendor dashboard: ${vendorId}`);
        }

        // 3. Notify the User who filed the complaint
        io.to(`user:${user._id.toString()}`).emit('complaintConfirmation', {
            complaintId: createdComplaint._id,
            subject: createdComplaint.subject,
            status: createdComplaint.status,
            message: `Your complaint ("${createdComplaint.subject}") has been submitted successfully. We will get back to you soon.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'complaintConfirmation' to user: ${user._id}`);
    }

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
    // Ensure req.user._id and req.user.vendor._id are being compared as strings if they are ObjectIds
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
    const complaint = await Complaint.findById(req.params.id)
        .populate('user', 'name email') // Populate user to notify customer
        .populate('vendor', 'name') // Populate vendor to notify vendor admin
        .populate('assignedTo', 'name email'); // Populate assignedTo to notify them

    if (!complaint) {
        res.status(404);
        throw new Error('Complaint not found.');
    }

    const oldStatus = complaint.status; // Store old status for notification

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
    const oldAssignedTo = complaint.assignedTo ? complaint.assignedTo._id.toString() : null;
    if (assignedTo) {
        const assignedUser = await User.findById(assignedTo);
        // You might want to restrict assignment to users with specific roles (e.g., support, admin)
        // Ensure the assigned user is not the same as the one already assigned to avoid unnecessary notifications
        if (!assignedUser || (!assignedUser.roles.includes('admin') && !assignedUser.roles.includes('support') && !assignedUser.isDeliveryPerson)) { // Example roles for assignment
            res.status(400);
            throw new Error('Invalid user to assign complaint to (must be Admin/Support/Delivery Person).');
        }
        complaint.assignedTo = assignedTo;
    }


    if (status) complaint.status = status;
    if (response) complaint.response = response;

    const updatedComplaint = await complaint.save();
    await invalidateCache([
        `complaints:/api/complaints/${req.params.id}`,
        'complaints:/api/complaints*'
    ]);

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // 1. Notify Super Admin Dashboard
        io.to('admin_dashboard').emit('complaintUpdated', {
            complaintId: updatedComplaint._id,
            userId: updatedComplaint.user._id,
            userName: updatedComplaint.user.name,
            subject: updatedComplaint.subject,
            oldStatus: oldStatus,
            newStatus: updatedComplaint.status,
            response: updatedComplaint.response,
            assignedToName: updatedComplaint.assignedTo ? updatedComplaint.assignedTo.name : null,
            message: `Complaint #${updatedComplaint._id} (${updatedComplaint.subject}) updated. Status: ${oldStatus} -> ${updatedComplaint.status}.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'complaintUpdated' to admin dashboard.`);

        // 2. Notify Vendor Admin Dashboard (if a vendor is associated)
        if (updatedComplaint.vendor) {
            io.to(`vendor_dashboard:${updatedComplaint.vendor._id.toString()}`).emit('vendorComplaintUpdated', {
                complaintId: updatedComplaint._id,
                userId: updatedComplaint.user._id,
                userName: updatedComplaint.user.name,
                subject: updatedComplaint.subject,
                oldStatus: oldStatus,
                newStatus: updatedComplaint.status,
                response: updatedComplaint.response,
                assignedToName: updatedComplaint.assignedTo ? updatedComplaint.assignedTo.name : null,
                message: `Complaint for your vendor (${updatedComplaint.subject}) updated. Status: ${oldStatus} -> ${updatedComplaint.status}.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'vendorComplaintUpdated' to vendor dashboard: ${updatedComplaint.vendor._id}`);
        }

        // 3. Notify the User who filed the complaint
        io.to(`user:${updatedComplaint.user._id.toString()}`).emit('yourComplaintUpdated', {
            complaintId: updatedComplaint._id,
            subject: updatedComplaint.subject,
            oldStatus: oldStatus,
            newStatus: updatedComplaint.status,
            response: updatedComplaint.response,
            message: `Your complaint ("${updatedComplaint.subject}") status changed to: **${updatedComplaint.status}**.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'yourComplaintUpdated' to user: ${updatedComplaint.user._id}`);

        // 4. Notify the newly assigned user (if assignment changed)
        const newAssignedTo = updatedComplaint.assignedTo ? updatedComplaint.assignedTo._id.toString() : null;
        if (newAssignedTo && newAssignedTo !== oldAssignedTo) {
            io.to(`user:${newAssignedTo}`).emit('complaintAssignedToYou', {
                complaintId: updatedComplaint._id,
                subject: updatedComplaint.subject,
                userWhoFiled: updatedComplaint.user.name,
                status: updatedComplaint.status,
                message: `A new complaint ("${updatedComplaint.subject}") has been assigned to you.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'complaintAssignedToYou' to assigned user: ${newAssignedTo}`);
        }
    }

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