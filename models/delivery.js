const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        unique: true // An order should only have one active delivery assignment
    },
    deliveryPerson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'assigned', 'out-for-delivery', 'delivered', 'failed', 'cancelled'],
        default: 'assigned' // Assuming it's 'assigned' once created
    },
    assignmentDate: {
        type: Date,
        default: Date.now
    },
    pickedUpAt: {
        type: Date
    },
    deliveredAt: {
        type: Date
    },
    notes: { // Any notes from delivery person or admin
        type: String
    }
}, { timestamps: true });

// Pre-save hook to ensure status transitions are valid (optional but good practice)
deliverySchema.pre('save', function (next) {
    if (this.isModified('status')) {
        const oldStatus = this._originalStatus || this.status; // Get old status
        const newStatus = this.status;

        const validTransitions = {
            'pending': ['assigned', 'cancelled'],
            'assigned': ['out-for-delivery', 'failed', 'cancelled'],
            'out-for-delivery': ['delivered', 'failed', 'cancelled'],
            'delivered': [], // No transitions after delivered
            'failed': [],    // No transitions after failed
            'cancelled': []  // No transitions after cancelled
        };

        if (validTransitions[oldStatus] && !validTransitions[oldStatus].includes(newStatus)) {
            return next(new Error(`Invalid delivery status transition from '${oldStatus}' to '${newStatus}'.`));
        }

        // Set timestamps based on status
        if (newStatus === 'out-for-delivery' && !this.pickedUpAt) {
            this.pickedUpAt = new Date();
        } else if (newStatus === 'delivered' && !this.deliveredAt) {
            this.deliveredAt = new Date();
        }
    }
    next();
});

// Post-save hook to update order status (if needed)
deliverySchema.post('save', async function (doc, next) {
    const Order = mongoose.model('Order'); // Get Order model to avoid circular dependency

    if (doc.isModified('status')) {
        const order = await Order.findById(doc.order);
        if (order) {
            let newOrderStatus = order.status; // Default to current order status

            if (doc.status === 'assigned' && order.status === 'approved') { // Only update if order is not already being delivered
                newOrderStatus = 'assigned-for-delivery';
            } else if (doc.status === 'out-for-delivery') {
                newOrderStatus = 'out-for-delivery';
            } else if (doc.status === 'delivered') {
                newOrderStatus = 'delivered';
            } else if (doc.status === 'failed' || doc.status === 'cancelled') {
                // If delivery fails/cancelled, maybe set order to 'delivery-issue' or revert to 'approved'
                // This logic depends on your business rules. For now, let's keep it simple.
                if (order.status !== 'delivered') { // Don't revert if already delivered
                    newOrderStatus = 'delivery-failed'; // Custom status
                }
            }

            if (order.status !== newOrderStatus) {
                order.status = newOrderStatus;
                await order.save();
                console.log(`Order ${order._id} status updated to: ${newOrderStatus} due to delivery status change.`);
            }
        }
    }
    next();
});


const Delivery = mongoose.model('Delivery', deliverySchema);
module.exports = Delivery;