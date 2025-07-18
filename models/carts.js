// models/Cart.js
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // Reference to your Product model
        required: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    imageUrl: {
        type: String // Optional: store a thumbnail image URL
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'approved', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    }
}, { _id: false }); // Do not generate an _id for subdocuments if not needed

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to your User model (optional, for authenticated users)
        // REMOVE 'required: true' from here
        sparse: true, // Allows multiple documents to have a null userId (for anonymous carts)
        unique: true // Ensure a user only has one cart
    },
    sessionId: { // For anonymous users or guest carts
        type: String,
        // REMOVE 'required: true' from here
        unique: true, // Ensure unique session IDs for cart management
        sparse: true // Allows null values but enforces uniqueness for non-null values
    },
    items: [cartItemSchema], // Array of cart items
    totalPrice: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to update `updatedAt` and `totalPrice` before saving
cartSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    this.totalPrice = this.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    next();
});

// Ensure that either userId OR sessionId (but not both or neither) is present
// This hook will now work correctly because Mongoose's built-in 'required' validation
// won't fire first.
cartSchema.pre('validate', function (next) {
    // Check if both are present OR if both are absent
    if ((this.userId && this.sessionId) || (!this.userId && !this.sessionId)) {
        // If both or neither, it's an error
        next(new Error('A cart must be associated with either a userId or a sessionId, but not both or neither.'));
    } else {
        // If exactly one is present, it's valid
        next();
    }
});

module.exports = mongoose.model('Cart', cartSchema);