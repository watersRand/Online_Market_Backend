const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    createComplaint,
    getAllComplaints,
    getVendorComplaints,
    getMyComplaints,
    getComplaintById,
    updateComplaint,
} = require('../controllers/complaintController');

// User creates a complaint
router.post('/', protect, createComplaint);

// Get all complaints (Super Admin)
router.get('/', protect, authorize(['admin']), getAllComplaints);

// Get complaints for a vendor (Vendor Admin)
router.get('/vendor', protect, authorize(['vendorAdmin']), getVendorComplaints);

// Get complaints by the logged-in user
router.get('/my-complaints', protect, getMyComplaints);

// Get a single complaint by ID (User who filed, Vendor Admin, or Super Admin)
router.get('/:id', protect, getComplaintById);

// Update complaint status/response/assignment (Super Admin or relevant Vendor Admin)
router.put('/:id', protect, authorize(['admin', 'vendorAdmin']), updateComplaint);


module.exports = router;