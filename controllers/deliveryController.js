const asyncHandler = require('express-async-handler');
const Delivery = require('../models/delivery');
const Order = require('../models/carts');
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

    const order = await Order.findById(orderId);
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
    if (!deliveryPerson || !deliveryPerson.isDeliveryPerson) {
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
    });

    const createdDelivery = await delivery.save();

    // Optionally update the order status as well
    order.status = 'assigned-for-delivery';
    await order.save();

    res.status(201).json(createdDelivery);
});

// @desc    Update delivery status
// @route   PUT /api/deliveries/:id/status
// @access  Private/DeliveryPerson or Admin
const updateDeliveryStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
        res.status(400);
        throw new Error('Delivery status is required.');
    }

    const delivery = await Delivery.findById(id).populate('order'); // Populate order to update its status
    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found.');
    }

    // Authorization check: Only the assigned delivery person or an admin can update
    if (delivery.deliveryPerson.toString() !== req.user.id && !req.user.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to update this delivery status.');
    }

    // Prevent updates if delivery is already delivered, failed, or cancelled
    const finalStatuses = ['delivered', 'failed', 'cancelled'];
    if (finalStatuses.includes(delivery.status)) {
        res.status(400);
        throw new Error(`Cannot update delivery status from final state: '${delivery.status}'.`);
    }

    delivery.status = status;
    if (notes) {
        delivery.notes = notes;
    }

    const updatedDelivery = await delivery.save(); // The pre/post hooks handle timestamps and order status

    res.json(updatedDelivery);
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
        .populate('order', 'totalAmount status shippingAddress.city') // Select relevant order fields
        .populate('deliveryPerson', 'name email'); // Select relevant delivery person fields

    res.json(deliveries);
});

// @desc    Get deliveries assigned to the logged-in delivery person
// @route   GET /api/deliveries/my-deliveries
// @access  Private/DeliveryPerson
const getMyDeliveries = asyncHandler(async (req, res) => {
    // Ensure the user is actually a delivery person (optional, authorize middleware handles this)
    if (!req.user.isDeliveryPerson && !req.user.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to view delivery assignments.');
    }

    const deliveries = await Delivery.find({ deliveryPerson: req.user.id })
        .populate('order', 'totalAmount status shippingAddress.city')
        .sort({ assignmentDate: -1 }); // Latest assignments first

    res.json(deliveries);
});

// @desc    Get single delivery details
// @route   GET /api/deliveries/:id
// @access  Private (Admin, DeliveryPerson, or Order User)
const getDeliveryById = asyncHandler(async (req, res) => {
    const delivery = await Delivery.findById(req.params.id)
        .populate('order', 'user totalAmount status shippingAddress.city shippingAddress.street') // Need order.user to check
        .populate('deliveryPerson', 'name email');

    if (!delivery) {
        res.status(404);
        throw new Error('Delivery not found.');
    }

    // Authorization check: Admin, assigned delivery person, or the user who placed the order
    const isOrderOwner = delivery.order && delivery.order.user && delivery.order.user.toString() === req.user.id;
    const isDeliveryPerson = delivery.deliveryPerson._id.toString() === req.user.id;
    const isAdmin = req.user.isAdmin;

    if (!isOrderOwner && !isDeliveryPerson && !isAdmin) {
        res.status(403);
        throw new Error('Not authorized to view this delivery.');
    }

    res.json(delivery);
});


module.exports = {
    assignDelivery,
    updateDeliveryStatus,
    getAllDeliveries,
    getMyDeliveries,
    getDeliveryById,
};