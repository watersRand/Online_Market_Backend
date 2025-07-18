const express = require('express');
const router = express.Router();
const { createVendor, getVendors, getVendorById, updateVendor, deleteVendor } = require('../controllers/vendorController');
const { protect, authorize } = require('../middleware/authMiddleware');
const Vendor = require('../models/vendor'); // For rendering
const User = require('../models/User'); // For vendor form to select owner

// Render vendor list (Admin only)
router.get('/vendors', protect, authorize('Admin'), async (req, res) => {
    const vendors = await Vendor.find({}).populate('owner', 'name email');
    res.render('vendors/vendors', { title: 'Manage Vendors', vendors, user: req.user });
});

// Render vendor creation form (Admin only)
router.get('/vendors/create', protect, authorize('Admin'), async (req, res) => {
    // Fetch users who are not already owners of a vendor
    const availableUsers = await User.find({ vendor: { $exists: false } });
    res.render('vendors/vendors_new', { title: 'Create Vendor', vendor: null, users: availableUsers, user: req.user });
});

// Handle vendor creation
router.post('/vendors', protect, authorize('Admin'), createVendor);

// Render vendor edit form (Admin only)
router.get('/vendors/edit/:id', protect, authorize('Admin'), async (req, res) => {
    const vendor = await Vendor.findById(req.params.id).populate('owner', 'name email');
    if (!vendor) {
        return res.status(404).render('error', { title: 'Vendor Not Found', message: 'Vendor not found.' });
    }
    // Fetch users who are not already owners of a vendor, or are the current owner of this vendor
    const availableUsers = await User.find({
        $or: [
            { vendor: { $exists: false } },
            { _id: vendor.owner }
        ]
    });
    res.render('vendors/vendors_edit', { title: `Edit ${vendor.name}`, vendor, users: availableUsers, user: req.user });
});

// Handle vendor update
router.put('/vendors/:id', protect, authorize('Admin'), updateVendor);

// Render single vendor details (Admin only)
router.get('/vendors/:id', protect, authorize('Admin'), async (req, res) => {
    const vendor = await Vendor.findById(req.params.id).populate('owner', 'name email');
    if (!vendor) {
        return res.status(404).render('error', { title: 'Vendor Not Found', message: 'Vendor not found.' });
    }
    res.render('vendors/vendor_details', { title: vendor.name, vendor, user: req.user });
});

// Handle vendor deletion
router.delete('/vendors/:id', protect, authorize('Admin'), deleteVendor);

module.exports = router;