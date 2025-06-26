const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: { // e.g., 'order_status', 'delivery_update', 'promo', 'account_alert'
        type: String,
        required: true
    },
    referenceId: { // Optional: ID of the related order, delivery, etc.
        type: mongoose.Schema.Types.ObjectId,
        // No 'ref' here as it can refer to multiple models, or you can add conditional refs
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    }
}, { timestamps: true });

// Index for efficient querying by user and read status
notificationSchema.index({ user: 1, isRead: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;