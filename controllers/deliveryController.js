const asyncHandler = require('express-async-handler');
const Delivery = require('../models/delivery');
const Order = require('../models/carts'); // Corrected to Order model
const User = require('../models/User'); // To check if user is a delivery person


// @desc    Assign an order to a delivery person
// @route   POST /api/deliveries/assign
// @access  Private/Admin
const assignDelivery = asyncHandler(async (req, res) => {
    const { orderId, deliveryPersonId } = req.body;

    if (!orderId || !deliveryPersonId) {
        res.status(400);
        throw new Error('Order ID and Delivery Person ID are required.');
    }

    const order = await Order.findById(orderId).populate('user'); // Populate user to get customer ID for notifications
    if (!order) {
        res.status(404);
        throw new Error('Order not found.');
    }

    // Ensure order is in a state ready for delivery assignment (e.g., 'approved' or 'processing')
    if (order.status !== 'approved' && order.status !== 'processing' && order.status !== 'payment-pending') {
        res.status(400);
        throw new Error(`Order status is '${order.status}'. Only 'approved' or 'processing' orders can be assigned.`);
    }

    const deliveryPerson = await User.findById(deliveryPersonId);
    if (!deliveryPerson || !deliveryPerson.isDeliveryPerson) { // Assuming isDeliveryPerson field on User model
        res.status(400);
        throw new Error('Invalid delivery person ID or user is not a designated delivery person.');
    }

    // Check if a delivery already exists for this order
    const existingDelivery = await Delivery.findOne({ order: orderId });
    if (existingDelivery) {
        res.status(400);
        throw new Error('This order has already been assigned for delivery.');
    }

    const delivery = new Delivery({
        order: orderId,
        deliveryPerson: deliveryPersonId,
        status: 'assigned', // Default status upon assignment
        // Add other fields like estimatedDeliveryTime, etc. if your model supports it
    });

    const createdDelivery = await delivery.save();

    // Optionally update the order status as well
    order.status = 'assigned-for-delivery';
    order.delivery = createdDelivery._id; // Link delivery to order
    await order.save();

    res.redirect('/api/deliveries/deliveries');
});

// @desc    Update delivery status
// @route   PUT /api/deliveries/:id/status
// @access  Private/DeliveryPerson or Admin
const updateDeliveryStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes, currentLocation } = req.body; // Added currentLocation

    if (!status) {
        res.status(400);
        throw new Error('Delivery status is required.');
    }

    const delivery = await Delivery.findById(id)
        .populate('order', 'user status shippingAddress') // Populate order to get user (customer) and status
        .populate('deliveryPerson', 'name'); // Populate delivery person for notifications

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found.');
    }

    // Authorization check: Only the assigned delivery person or an admin can update
    const reqUser = await User.findById(req.user.id); // Get full user object for roles
    const isAuthorized = (delivery.deliveryPerson && delivery.deliveryPerson._id.toString() === reqUser._id.toString()) || reqUser.isAdmin;

    if (!isAuthorized) {
        res.status(403);
        throw new Error('Not authorized to update this delivery status.');
    }

    // Prevent updates if delivery is already in a final state
    const finalStatuses = ['delivered', 'failed', 'cancelled'];
    if (finalStatuses.includes(delivery.status)) {
        res.status(400);
        throw new Error(`Cannot update delivery status from final state: '${delivery.status}'.`);
    }

    const oldStatus = delivery.status; // Store old status for notifications

    delivery.status = status;
    if (notes) {
        delivery.notes = notes;
    }
    if (currentLocation) { // Update current location if provided
        delivery.currentLocation = currentLocation;
    }

    // Update deliveredAt timestamp if status becomes 'delivered'
    if (status === 'delivered' && !delivery.deliveredAt) {
        delivery.deliveredAt = new Date();
    }

    const updatedDelivery = await delivery.save();

    // Update associated order's status based on delivery status
    if (delivery.order) {
        let orderStatusChanged = false;
        if (status === 'delivered' && delivery.order.status !== 'completed') {
            delivery.order.status = 'completed';
            orderStatusChanged = true;
        } else if (status === 'cancelled' && delivery.order.status !== 'cancelled') {
            delivery.order.status = 'cancelled';
            orderStatusChanged = true;
        } else if (status === 'failed' && delivery.order.status !== 'failed') {
            delivery.order.status = 'failed';
            orderStatusChanged = true;
        } else if (status === 'out-for-delivery' && delivery.order.status !== 'out-for-delivery') {
            delivery.order.status = 'out-for-delivery';
            orderStatusChanged = true;
        }
        // Add more mappings if needed

        if (orderStatusChanged) {
            await delivery.order.save();

        }
    }

    res.redirect('/api/deliveries/my-deliveries');
});

// @desc    Get all deliveries (for Admin/Manager dashboard)
// @route   GET /api/deliveries
// @access  Private/Admin
const getAllDeliveries = asyncHandler(async (req, res) => {
    // Add filtering and pagination if needed
    const { status, deliveryPersonId } = req.query;
    let filter = {};

    if (status) {
        filter.status = status;
    }
    if (deliveryPersonId) {
        filter.deliveryPerson = deliveryPersonId;
    }

    const deliveries = await Delivery.find(filter)
        .populate('order', 'totalPrice status shippingAddress.city user') // Also populate 'user' from order for customer info
        .populate('deliveryPerson', 'name email');

    res.render('deliveries/delivery_list', { // For view calls, render EJS
        title: 'All Deliveries',
        deliveries: deliveries,
        user: req.user, // Pass req.user to the template
        message: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
    });
});

// @desc    Get deliveries assigned to the logged-in delivery person
// @route   GET /api/deliveries/my-deliveries
// @access  Private/DeliveryPerson
const getMyDeliveries = asyncHandler(async (req, res) => {
    // Ensure the user is actually a delivery person (optional, authorize middleware handles this)
    const reqUser = await User.findById(req.user.id);
    if (!reqUser || !reqUser.isDeliveryPerson && !reqUser.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to view delivery assignments.');
    }

    const deliveries = await Delivery.find({ deliveryPerson: req.user.id })
        .populate('order', 'totalPrice status shippingAddress.city user') // Get order user for customer details
        .sort({ assignmentDate: -1 }); // Latest assignments first

    res.render('deliveries/my_deliveries_list', { // For view calls, render EJS
        title: 'My Deliveries',
        deliveries: deliveries,
        user: req.user, // Pass req.user to the template
        message: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
    });
});

// @desc    Get single delivery details
// @route   GET /api/deliveries/:id
// @access  Private (Admin, DeliveryPerson, or Order User)
const getDeliveryById = asyncHandler(async (req, res) => {
    const delivery = await Delivery.findById(req.params.id)
        .populate('order', 'user totalPrice status shippingAddress.city shippingAddress.street') // Need order.user to check
        .populate('deliveryPerson', 'name email');

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found.');
    }

    // Authorization check: Admin, assigned delivery person, or the user who placed the order
    const reqUser = await User.findById(req.user.id); // Get full user object for roles
    const isOrderOwner = delivery.order && delivery.order.user && delivery.order.user.toString() === reqUser._id.toString();
    const isDeliveryPerson = delivery.deliveryPerson && delivery.deliveryPerson._id.toString() === reqUser._id.toString();
    const isAdmin = reqUser.isAdmin; // Assuming isAdmin field on User model

    if (!isOrderOwner && !isDeliveryPerson && !isAdmin) {
        res.status(403);
        throw new Error('Not authorized to view this delivery.');
    }

    res.render('deliveries/delivery_detail', { // For view calls, render EJS
        title: `Delivery #${delivery._id}`,
        delivery: delivery,
        user: req.user, // Pass req.user to the template
        message: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
    });
});

module.exports = {
    assignDelivery,
    updateDeliveryStatus,
    getAllDeliveries,
    getMyDeliveries,
    getDeliveryById,
};