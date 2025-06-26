const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    createVendor,
    getVendors,
    getVendorById,
    updateVendor,
    deleteVendor,
} = require('../controllers/vendorController');

// Super Admin only routes for Vendor management
router.route('/')
    .post(protect, authorize(['admin']), createVendor)
    .get(protect, authorize(['admin']), getVendors);

router.route('/:id')
    .get(protect, authorize(['admin']), getVendorById)
    .put(protect, authorize(['admin']), updateVendor)
    .delete(protect, authorize(['admin']), deleteVendor);

module.exports = router;