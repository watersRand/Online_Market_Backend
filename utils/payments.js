
const Order = require('../models/carts'); // From Phase 3
const Payment = require('../models/payments');
const { initiateSTKPush, querySTKPushStatus } = require('../middleware/payments');
const { generateDigitalReceipt } = require('./receipts'); // We'll create this

// @desc    Initiate M-Pesa STK Push for an order
// @route   POST /api/payments/initiate-stk
// @access  Private (User)
const initiateStk = async (req, res) => {
    const { orderId, phoneNumber } = req.body; // phoneNumber should be from the user's input/profile

    if (!orderId || !phoneNumber) {
        return res.status(400).json({ message: 'Order ID and phone number are required.' });
    }

    // Basic phone number format check (e.g., 2547XXXXXXXX)
    if (!phoneNumber.match(/^2547[0-9]{8}$/)) {
        return res.status(400).json({ message: 'Invalid Safaricom phone number format. Use 2547XXXXXXXX.' });
    }

    try {
        const order = await Order.findById(orderId).populate('userId'); // Populate user for receipt details
        console.log(order)
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }

        // Ensure the order belongs to the authenticated user
        // if (order.userId._id.toString() !== req.user.id) {
        //     return res.status(403).json({ message: 'Not authorized to pay for this order.' });
        // }

        // Check if order is already paid or cancelled
        if (order.status === 'approved' || order.status === 'delivered' || order.status === 'cancelled') {
            return res.status(400).json({ message: `Order status is '${order.status}'. Cannot initiate payment.` });
        }

        const amount = order.totalAmount;
        const accountReference = order._id.toString(); // Use Order ID as reference
        const transactionDesc = `Payment for Order ${order._id}`;

        // Create a new Payment record with 'initiated' status
        const payment = new Payment({
            // user: req.user.id,
            order: orderId,
            amount: amount,
            phoneNumber: phoneNumber,
            status: 'initiated' // Mark as initiated, awaiting callback
        });
        await payment.save();

        const stkPushResponse = await initiateSTKPush(amount, phoneNumber, accountReference, transactionDesc);

        // Update payment record with STK Push response details
        payment.mpesaRequest = {
            MerchantRequestID: stkPushResponse.MerchantRequestID,
            CheckoutRequestID: stkPushResponse.CheckoutRequestID,
            ResponseCode: stkPushResponse.ResponseCode,
            ResponseDescription: stkPushResponse.ResponseDescription,
            CustomerMessage: stkPushResponse.CustomerMessage
        };
        await payment.save();

        if (stkPushResponse.ResponseCode === '0') {
            res.status(200).json({
                message: 'STK Push initiated successfully. Please check your phone for the M-Pesa prompt.',
                checkoutRequestId: stkPushResponse.CheckoutRequestID,
                paymentId: payment._id
            });
        } else {
            // M-Pesa API returned an error, not necessarily user cancellation
            payment.status = 'failed';
            await payment.save();
            res.status(400).json({
                message: `M-Pesa STK Push failed to initiate: ${stkPushResponse.ResponseDescription}`,
                checkoutRequestId: stkPushResponse.CheckoutRequestID,
                responseCode: stkPushResponse.ResponseCode
            });
        }

    } catch (error) {
        console.error('Error in initiate-stk:', error);
        console.log(error)
        res.status(500).json({ message: 'Server error initiating M-Pesa payment.' });
    }
};


// @desc    M-Pesa Daraja Callback URL
// @route   POST /api/payments/mpesa-callback
// @access  Public (Called by Safaricom) - NO AUTHENTICATION HERE
const mpesaCallback = async (req, res) => {
    // M-Pesa sends callback data in a specific structure
    const callbackData = req.body;
    console.log('M-Pesa Callback Received:', JSON.stringify(callbackData, null, 2));

    try {
        const {
            Body: {
                stkCallback: {
                    MerchantRequestID,
                    CheckoutRequestID,
                    ResultCode,
                    ResultDesc,
                    CallbackMetadata
                }
            }
        } = callbackData;

        let payment = await Payment.findOne({ 'mpesaRequest.CheckoutRequestID': CheckoutRequestID });

        if (!payment) {
            console.error(`M-Pesa Callback: No matching payment found for CheckoutRequestID: ${CheckoutRequestID}`);
            // Acknowledge the callback even if no payment is found to prevent retries
            return res.status(200).json({ message: 'Callback received, but no matching payment found.' });
        }

        payment.mpesaCallback.ResultCode = ResultCode;
        payment.mpesaCallback.ResultDesc = ResultDesc;
        payment.mpesaCallback.RawCallbackData = callbackData; // Store full raw data

        if (ResultCode === '0') { // Successful payment
            const MpesaReceiptNumber = CallbackMetadata.Item.find(item => item.Name === 'MpesaReceiptNumber').Value;
            const TransactionDate = CallbackMetadata.Item.find(item => item.Name === 'TransactionDate').Value;
            const PhoneNumber = CallbackMetadata.Item.find(item => item.Name === 'PhoneNumber').Value;
            const Amount = CallbackMetadata.Item.find(item => item.Name === 'Amount').Value;

            payment.status = 'completed';
            payment.completedAt = new Date();
            payment.mpesaCallback.MpesaReceiptNumber = MpesaReceiptNumber;
            payment.mpesaCallback.TransactionDate = moment(TransactionDate, 'YYYYMMDDHHmmss').toDate();
            payment.mpesaCallback.PhoneNumber = PhoneNumber;
            payment.mpesaCallback.Amount = Amount;

            // Update associated order status
            const order = await Order.findById(payment.order);
            if (order) {
                order.status = 'approved'; // Or 'processing', depending on your workflow
                await order.save();
                console.log(`Order ${order._id} status updated to 'approved'`);
                // Generate and send digital receipt
                await generateDigitalReceipt(order, payment);
            } else {
                console.warn(`M-Pesa Callback: Order ${payment.order} not found for payment ${payment._id}`);
            }

        } else { // Failed or cancelled payment
            payment.status = 'failed';
            console.log(`M-Pesa Payment failed for CheckoutRequestID ${CheckoutRequestID}: ${ResultDesc}`);
        }

        await payment.save();

        // Always respond with 200 OK to M-Pesa to acknowledge receipt of callback
        res.status(200).json({ message: 'Callback received and processed successfully.' });

    } catch (error) {
        console.error('Error processing M-Pesa callback:', error);
        // Log the full callback data for debugging if error occurs
        console.error('Raw callback data that caused error:', JSON.stringify(callbackData, null, 2));
        // Still respond with 200 OK to M-Pesa, but log the internal error
        res.status(200).json({ message: 'Internal server error processing callback.' });
    }
};


// @desc    Query STK Push Status (Optional)
// @route   GET /api/payments/status/:checkoutRequestId
// @access  Private (User owns payment or Admin)
const checkoutRequestId = async (req, res) => {
    const { checkoutRequestId } = req.params;

    try {
        let payment = await Payment.findOne({ 'mpesaRequest.CheckoutRequestID': checkoutRequestId });

        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found for this CheckoutRequestID.' });
        }

        // Ensure user is authorized to view this payment
        if (payment.user.toString() !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ message: 'Not authorized to view this payment status.' });
        }

        // If payment is already completed or failed, no need to query Daraja again
        if (payment.status === 'completed' || payment.status === 'failed') {
            return res.status(200).json({
                message: `Payment already ${payment.status}.`,
                paymentStatus: payment.status,
                mpesaDetails: payment.mpesaCallback
            });
        }

        const mpesaStatus = await querySTKPushStatus(checkoutRequestId);

        // Update payment record based on Daraja's latest status
        // Note: Daraja's query response is slightly different from callback
        payment.mpesaCallback.ResultCode = mpesaStatus.ResultCode;
        payment.mpesaCallback.ResultDesc = mpesaStatus.ResultDesc;
        payment.mpesaCallback.RawCallbackData = { ...payment.mpesaCallback.RawCallbackData, QueryResponse: mpesaStatus }; // Store query response as well

        if (mpesaStatus.ResultCode === '0') {
            // This is complex, as STK query doesn't give MpesaReceiptNumber directly
            // You'd typically only rely on callback for full success details.
            // For a 'success' status from query, you might indicate it's 'pending_confirmation' or similar
            // and still wait for actual callback for full receipt number.
            // For simplicity, let's just update the status description here.
            payment.status = 'pending_confirmation'; // Or a more specific status
            await payment.save();
            res.status(200).json({
                message: 'STK Push is still pending or completed. Waiting for final callback.',
                paymentStatus: payment.status,
                mpesaQueryDetails: mpesaStatus
            });
        } else if (mpesaStatus.ResultCode === '1032') { // User cancelled
            payment.status = 'cancelled';
            await payment.save();
            res.status(200).json({
                message: 'STK Push was cancelled by the user.',
                paymentStatus: payment.status,
                mpesaQueryDetails: mpesaStatus
            });
        } else {
            payment.status = 'failed';
            await payment.save();
            res.status(200).json({
                message: `STK Push query indicates failure: ${mpesaStatus.ResultDesc}`,
                paymentStatus: payment.status,
                mpesaQueryDetails: mpesaStatus
            });
        }

    } catch (error) {
        console.error('Error querying STK Push status:', error);
        res.status(500).json({ message: 'Server error querying M-Pesa payment status.' });
    }
};


// @desc    Get all payments (Admin only)
// @route   GET /api/payments
// @access  Private (Admin)
const getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find({})
            .populate('user', 'name email')
            .populate('order', 'totalAmount status');
        res.status(200).json(payments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching all payments.' });
    }
};

// @desc    Get user's payments
// @route   GET /api/payments/my-payments
// @access  Private (User)

const getUserPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ user: req.user.id })
            .populate('order', 'totalAmount status');
        res.status(200).json(payments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error fetching user payments.' });
    }
};


module.exports = { getAllPayments, getUserPayments, mpesaCallback, checkoutRequestId, initiateStk };