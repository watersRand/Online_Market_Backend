const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
    },
    owner: { // The user who is the primary vendor admin for this vendor
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // A user can only own one vendor
    },
    // You could also add other fields like address, contact info, etc.
}, {
    timestamps: true,
});

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor;