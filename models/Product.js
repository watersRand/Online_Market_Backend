const mongoose = require('mongoose');

const productSchema = mongoose.Schema({
    user: { // The user who created the product (can be admin or vendor admin) - keeping it for now
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    vendor: { // NEW: The vendor this product belongs to
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: false,
    },
    description: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        enum: ['Electronics', 'Beauty', 'Food and Drinks', 'Fruits'],
        required: true,
    },
    price: {
        type: Number,
        required: true,
        default: 0,
    },
    countInStock: {
        type: Number,
        required: true,
        default: 0,
    },
    review: {
        required: false,
        type: String
    }

}, {
    timestamps: true,
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;