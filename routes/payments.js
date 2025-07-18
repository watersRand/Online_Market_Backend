const express = require('express');
const router = express.Router();
const { initiateStk, mpesaCallback, checkoutRequestId, getAllPayments, getUserPayments } = require('../utils/payments');
const { protect, authorize } = require('../middleware/authMiddleware');
const Payment = require('../models/payments'); // For rendering
const Order = require('../models/carts'); // For populating order details in payment view

// Render user's payments list
router.get('/my-payments', protect, async (req, res) => {
    const payments = await Payment.find({ user: req.user._id })
        .populate('order', 'totalAmount status')
        .sort({ createdAt: -1 });
    res.render('payments/mypayments', { title: 'My Payments', payments, user: req.user });
});

// Render all payments list (Admin only)
router.get('/', protect, authorize('Admin'), async (req, res) => {
    const payments = await Payment.find({})
        .populate('user', 'name email')
        .populate(`order`, 'totalAmount status')
        .sort({ createdAt: -1 });
    res.render('payments/allpayments', { title: 'All Payments', payments, user: req.user });
});

// Render single payment details
router.get('/:id', protect, async (req, res) => {
    const payment = await Payment.findById(req.params.id)
        .populate('user', 'name email')
        .populate('order', 'totalAmount status shippingAddress'); // Populate shippingAddress for detail view

    if (!payment) {
        return res.status(404).render('error', { title: 'Payment Not Found', message: 'Payment record not found.' });
    }

    // Authorization: User who made payment or Admin
    const isOwner = payment.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.isAdmin;

    if (!isOwner && !isAdmin) {
        return res.status(403).render('error', { title: 'Unauthorized', message: 'Not authorized to view this payment.' });
    }

    res.render('payments/detailpayments', { title: `Payment #${payment._id}`, payment, user: req.user });
});

// Initiate M-Pesa STK Push
router.post('/initiate-stk', protect, initiateStk);

// M-Pesa Daraja Callback URL (Public endpoint, no authentication)
router.post('/mpesa-callback', mpesaCallback);

// Query STK Push Status
router.get('/status/:checkoutRequestId', protect, checkoutRequestId);

module.exports = router;
