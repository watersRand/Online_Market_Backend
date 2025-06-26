// models/userModel.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    roles: {
        type: String,
        enum: ['Vendor', 'Delivery', 'Customer', 'Admin'],
        default: 'Customer'
    },
    isDeliveryPerson: { // NEW FIELD FOR DELIVERY PERSONNEL
        type: Boolean,
        required: true,
        default: false,
    },
    vendor: { // NEW: For Vendor Admins, links to the Vendor they manage
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: false, // Not all users are vendor admins
        unique: true, // A vendor can only have one primary owner/admin assigned this way
        sparse: true, // Allows multiple documents to have null for this field
    },
    phoneNumber: { // Assuming added in Phase 6
        type: String,
        unique: true,
        sparse: true,
    },

});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;