const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    user: { // The user who filed the complaint
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    vendor: { // The vendor the complaint is about (optional, if complaint is general)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: false, // Make this true if all complaints must be vendor-specific
    },
    order: { // Related order (optional)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: false,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed', 'rejected'],
        default: 'open',
    },
    assignedTo: { // Admin or specific team member assigned to handle it
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
    response: { // Admin's response to the complaint
        type: String,
        required: false,
    },
}, {
    timestamps: true,
});

const Complaint = mongoose.model('Complaint', complaintSchema);
module.exports = Complaint;