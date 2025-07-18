const express = require('express');
const router = express.Router();
const { createComplaint, getAllComplaints, getVendorComplaints, getMyComplaints, getComplaintById, updateComplaint } = require('../controllers/complaintController');
const { protect, authorize } = require('../middleware/authMiddleware');
const Complaint = require('../models/complaints'); // For rendering
const Order = require('../models/carts'); // Your Order model (named Cart)
const Vendor = require('../models/vendor'); // For complaint form to select vendor
const User = require('../models/User'); // For complaint form to select assignedTo users

// Render all complaints (Admin only)
router.get('/complaints', protect, authorize('Admin'), getAllComplaints);

// Render vendor-specific complaints (Vendor Admin only)
router.get('/complaints/vendor', protect, authorize('vendor'), getVendorComplaints);

// Render logged-in user's complaints
router.get('/complaints/my-complaints', protect, getMyComplaints);

// Render file complaint form
router.get('/complaints/:id', protect, getComplaintById);


// Handle complaint update
router.put('/complaints/:id', protect, authorize('Admin', 'vendor'), updateComplaint);

module.exports = router;