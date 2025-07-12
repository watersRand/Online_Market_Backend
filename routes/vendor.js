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
const { cacheResponse } = require('../controllers/cacheController')


// Super Admin only routes for Vendor management
router.route('/')
    .post(protect, authorize(['admin']), createVendor)
    .get(protect, authorize(['admin']), cacheResponse('vendors', 300), getVendors);

router.route('/:id')
    .get(protect, authorize(['admin']), getVendorById)
    .put(protect, authorize(['admin']), updateVendor)
    .delete(protect, authorize(['admin']), cacheResponse('vendors', 300), deleteVendor);

module.exports = router;