const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    phoneNumber: { // The phone number that initiates the M-Pesa transaction
        type: String,
        required: true
    },
    mpesaRequest: { // Details sent to Daraja for STK Push
        MerchantRequestID: { type: String },
        CheckoutRequestID: { type: String, unique: true, sparse: true }, // Unique ID for the transaction request
        ResponseCode: { type: String },
        ResponseDescription: { type: String },
        CustomerMessage: { type: String }
    },
    mpesaCallback: { // Details received from Daraja callback
        ResultCode: { type: String },
        ResultDesc: { type: String },
        MpesaReceiptNumber: { type: String },
        TransactionDate: { type: Date },
        PhoneNumber: { type: String }, // M-Pesa phone number
        Amount: { type: Number },
        // ... other relevant callback fields you might want to store
        RawCallbackData: { type: mongoose.Schema.Types.Mixed } // Store the entire raw callback for debugging/auditing
    },
    status: {
        type: String,
        enum: ['pending', 'initiated', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    transactionType: {
        type: String,
        enum: ['STK_PUSH', 'B2C', 'C2B'], // Only STK_PUSH for now
        default: 'STK_PUSH'
    },
    initiatedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    }
}, { timestamps: true }); // Mongoose adds createdAt and updatedAt

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;