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
const { cacheResponse } = require('../controllers/cacheController')


// User creates a complaint
router.post('/', protect, createComplaint);

// Get all complaints (Super Admin)
router.get('/', protect, authorize(['admin']), cacheResponse('complaints', 300), getAllComplaints);

// Get complaints for a vendor (Vendor Admin)
router.get('/vendor', protect, authorize(['vendorAdmin']), cacheResponse('complaints', 300), getVendorComplaints);

// Get complaints by the logged-in user
router.get('/my-complaints', protect, cacheResponse('complaints', 300), getMyComplaints);

// Get a single complaint by ID (User who filed, Vendor Admin, or Super Admin)
router.get('/:id', protect, cacheResponse('complaints', 300), getComplaintById);

// Update complaint status/response/assignment (Super Admin or relevant Vendor Admin)
router.put('/:id', protect, authorize(['admin', 'vendorAdmin']), updateComplaint);


module.exports = router;