const asyncHandler = require('express-async-handler');
const Delivery = require('../models/delivery');
const Order = require('../models/carts'); // Assuming 'orders' is your Order model, not 'carts' if it's the final order.
const User = require('../models/User'); // To check if user is a delivery person
const { invalidateCache } = require('../controllers/cacheController');
const { getIo } = require('../config/socket'); // Import getIo to access Socket.IO

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
    await invalidateCache('deliveries:/api/deliveries*');

    // Optionally update the order status as well
    order.status = 'assigned-for-delivery';
    order.delivery = createdDelivery._id; // Link delivery to order
    await order.save();
    await invalidateCache(`orders:/api/orders/${orderId}`); // Invalidate order cache

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // 1. Notify the assigned delivery person
        io.to(`user:${deliveryPersonId.toString()}`).emit('newDeliveryAssignment', {
            deliveryId: createdDelivery._id,
            orderId: order._id,
            customerInfo: { name: order.user.name, address: order.shippingAddress }, // Assuming order.user is populated
            message: `New delivery assigned: Order #${order._id} to ${order.shippingAddress.street}, ${order.shippingAddress.city}.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'newDeliveryAssignment' to delivery person: ${deliveryPersonId}`);

        // 2. Notify the customer of the order (assuming order.user is the customer ID)
        if (order.user) {
            io.to(`user:${order.user._id.toString()}`).emit('orderDeliveryStatusUpdate', {
                orderId: order._id,
                deliveryId: createdDelivery._id,
                status: createdDelivery.status,
                message: `Your order #${order._id} has been assigned for delivery.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'orderDeliveryStatusUpdate' to customer: ${order.user._id}`);
        }

        // 3. Notify the admin dashboard
        io.to('admin_dashboard').emit('newDeliveryAssignmentAdmin', {
            deliveryId: createdDelivery._id,
            orderId: order._id,
            deliveryPersonName: deliveryPerson.name,
            customerName: order.user ? order.user.name : 'N/A',
            status: createdDelivery.status,
            message: `Order #${order._id} assigned to ${deliveryPerson.name}.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'newDeliveryAssignmentAdmin' for admin dashboard.`);
    }

    res.status(201).json(createdDelivery);
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
    await invalidateCache([
        `deliveries:/api/deliveries/${id}`,
        'deliveries:/api/deliveries*'
    ]);

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
            await invalidateCache(`orders:/api/orders/${delivery.order._id}`);

            // Notify customer and order room about order status change
            const io = getIo();
            if (io && delivery.order.user) {
                io.to(`user:${delivery.order.user.toString()}`).emit('orderStatusUpdate', {
                    orderId: delivery.order._id,
                    newStatus: delivery.order.status,
                    message: `Your order #${delivery.order._id} status changed to: **${delivery.order.status}**`,
                    timestamp: new Date()
                });
                io.to(`order:${delivery.order._id.toString()}`).emit('orderStatusUpdate', {
                    orderId: delivery.order._id,
                    newStatus: delivery.order.status,
                    message: `Order #${delivery.order._id} status changed to: **${delivery.order.status}**`,
                    timestamp: new Date()
                });
            }
        }
    }


    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // 1. Notify the customer of the order
        if (updatedDelivery.order && updatedDelivery.order.user) { // Ensure customer user exists
            io.to(`user:${updatedDelivery.order.user._id.toString()}`).emit('orderDeliveryStatusUpdate', {
                orderId: updatedDelivery.order._id,
                deliveryId: updatedDelivery._id,
                status: updatedDelivery.status,
                currentLocation: updatedDelivery.currentLocation,
                message: `Your order #${updatedDelivery.order._id} is now **${updatedDelivery.status}**.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'orderDeliveryStatusUpdate' to customer: ${updatedDelivery.order.user._id}`);
        }

        // 2. Notify clients viewing the specific order page (if such a room exists)
        if (updatedDelivery.order) {
            io.to(`order:${updatedDelivery.order._id.toString()}`).emit('deliveryUpdateForOrder', {
                orderId: updatedDelivery.order._id,
                deliveryId: updatedDelivery._id,
                status: updatedDelivery.status,
                currentLocation: updatedDelivery.currentLocation,
                message: `Delivery for order #${updatedDelivery.order._id} is now ${updatedDelivery.status}.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'deliveryUpdateForOrder' for order room: ${updatedDelivery.order._id}`);
        }

        // 3. Notify the assigned delivery person (if a separate dashboard for them, or their user room)
        if (updatedDelivery.deliveryPerson) {
            io.to(`user:${updatedDelivery.deliveryPerson._id.toString()}`).emit('deliveryStatusChangedForYou', {
                deliveryId: updatedDelivery._id,
                orderId: updatedDelivery.order ? updatedDelivery.order._id : 'N/A',
                newStatus: updatedDelivery.status,
                message: `Delivery #${updatedDelivery._id} status updated to: ${updatedDelivery.status}`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'deliveryStatusChangedForYou' to delivery person: ${updatedDelivery.deliveryPerson._id}`);
        }
        // If you have a specific room for all delivery personnel to monitor each other's updates:
        // io.to('delivery_personnel_dashboard').emit('deliveryStatusUpdateGlobal', { /* data */ });


        // 4. Notify the admin dashboard
        io.to('admin_dashboard').emit('deliveryStatusChangedAdmin', {
            deliveryId: updatedDelivery._id,
            orderId: updatedDelivery.order ? updatedDelivery.order._id : 'N/A',
            customerName: updatedDelivery.order && updatedDelivery.order.user ? updatedDelivery.order.user.name : 'N/A',
            deliveryPersonName: updatedDelivery.deliveryPerson ? updatedDelivery.deliveryPerson.name : 'N/A',
            oldStatus: oldStatus,
            newStatus: updatedDelivery.status,
            currentLocation: updatedDelivery.currentLocation,
            message: `Delivery #${updatedDelivery._id} for Order #${updatedDelivery.order ? updatedDelivery.order._id : 'N/A'} changed from ${oldStatus} to ${updatedDelivery.status}.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'deliveryStatusChangedAdmin' for admin dashboard.`);
    }

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
        .populate('order', 'totalAmount status shippingAddress.city user') // Also populate 'user' from order for customer info
        .populate('deliveryPerson', 'name email');

    res.json(deliveries);
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
        .populate('order', 'totalAmount status shippingAddress.city user') // Get order user for customer details
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
    const reqUser = await User.findById(req.user.id); // Get full user object for roles
    const isOrderOwner = delivery.order && delivery.order.user && delivery.order.user.toString() === reqUser._id.toString();
    const isDeliveryPerson = delivery.deliveryPerson && delivery.deliveryPerson._id.toString() === reqUser._id.toString();
    const isAdmin = reqUser.isAdmin; // Assuming isAdmin field on User model

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