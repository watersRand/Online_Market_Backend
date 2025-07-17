const express = require('express');
const router = express.Router();
const { assignDelivery, updateDeliveryStatus, getAllDeliveries, getMyDeliveries, getDeliveryById } = require('../controllers/deliveryController');
const { protect, authorize } = require('../middleware/authMiddleware');
const Delivery = require('../models/delivery'); // For rendering
const Order = require('../models/carts'); // Your Order model (named Cart here)
const User = require('../models/User'); // For delivery persons list

// Render all deliveries (Admin only)
router.get('/deliveries', protect, authorize('Admin'), async (req, res) => {
    const deliveries = await Delivery.find({})
        .populate('order', 'user totalAmount status shippingAddress.city')
        .populate({
            path: 'order',
            populate: { path: 'user', select: 'name' } // Populate user inside order
        })
        .populate('deliveryPerson', 'name email');
    res.render('delivery_list', { title: 'All Deliveries', deliveries, user: req.user, isMyDeliveries: false });
});

// Render my deliveries (Delivery Person only)
router.get('/deliveries/my-deliveries', protect, authorize('DeliveryPerson', 'Admin'), async (req, res) => {
    const deliveries = await Delivery.find({ deliveryPerson: req.user._id })
        .populate('order', 'user totalAmount status shippingAddress.city')
        .populate({
            path: 'order',
            populate: { path: 'user', select: 'name' }
        })
        .populate('deliveryPerson', 'name email');
    res.render('delivery_list', { title: 'My Deliveries', deliveries, user: req.user, isMyDeliveries: true });
});

// Render assign delivery form (Admin only)
router.get('/deliveries/assign', protect, authorize('Admin'), async (req, res) => {
    // Fetch orders that are 'approved', 'processing', 'payment-pending' and not yet assigned
    const orders = await Order.find({
        status: { $in: ['approved', 'processing', 'payment-pending'] },
        delivery: { $exists: false } // Only orders without an assigned delivery
    }).populate('user', 'name');

    // Fetch users who are designated as delivery persons
    const deliveryPersons = await User.find({ isDeliveryPerson: true });

    res.render('delivery_assign_form', { title: 'Assign Delivery', orders, deliveryPersons, user: req.user });
});

// Handle delivery assignment
router.post('/deliveries/assign', protect, authorize('Admin'), assignDelivery);

// Render single delivery details
router.get('/deliveries/:id', protect, async (req, res) => {
    const delivery = await Delivery.findById(req.params.id)
        .populate('order', 'user totalAmount status shippingAddress.city shippingAddress.street shippingAddress.zipCode shippingAddress.country')
        .populate({
            path: 'order',
            populate: { path: 'user', select: 'name' }
        })
        .populate('deliveryPerson', 'name email');

    if (!delivery) {
        return res.status(404).render('error', { title: 'Delivery Not Found', message: 'Delivery not found.' });
    }

    // Authorization check (same as in controller)
    const isOrderOwner = delivery.order && delivery.order.user && delivery.order.user._id.toString() === req.user._id.toString();
    const isDeliveryPerson = delivery.deliveryPerson && delivery.deliveryPerson._id.toString() === req.user._id.toString();
    const isAdmin = req.user.isAdmin;

    if (!isOrderOwner && !isDeliveryPerson && !isAdmin) {
        return res.status(403).render('error', { title: 'Unauthorized', message: 'Not authorized to view this delivery.' });
    }

    res.render('delivery_detail', { title: `Delivery for Order #${delivery.order ? delivery.order._id : 'N/A'}`, delivery, user: req.user });
});

// Handle delivery status update
router.put('/deliveries/:id/status', protect, authorize('DeliveryPerson', 'Admin'), updateDeliveryStatus);

module.exports = router;