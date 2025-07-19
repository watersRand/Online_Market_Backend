const asyncHandler = require('express-async-handler');
const Vendor = require('../models/vendor');
const User = require('../models/User');



// @desc    Create a new vendor
// @route   POST /api/vendors
// @access  Private/Admin
const createVendor = asyncHandler(async (req, res) => {
    const { name, description, ownerId } = req.body;

    if (!name || !ownerId) {
        res.status(400);
        throw new Error('Vendor name and owner ID are required.');
    }

    // Check if ownerId points to an existing user and if that user is not already an owner of another vendor
    const owner = await User.findById(ownerId);
    if (!owner) {
        res.status(404);
        throw new Error('Owner user not found.');
    }
    // Check if the user is already assigned as an owner of *another* vendor (not the one being created/updated)
    if (owner.vendor && owner.vendor.toString() !== req.body.vendorId) { // Added req.body.vendorId check for robustness
        res.status(400);
        throw new Error('This user is already an owner of another vendor.');
    }

    const vendorExists = await Vendor.findOne({ name });
    if (vendorExists) {
        res.status(400);
        throw new Error('Vendor with this name already exists.');
    }

    const vendor = new Vendor({
        name,
        description,
        owner: ownerId,
    });

    const createdVendor = await vendor.save();



    // Link the user to this newly created vendor
    owner.vendor = createdVendor._id;
    // Potentially assign a 'vendor' role to the user if they don't have it already
    if (!owner.roles.includes('vendor')) {
        owner.roles.push('vendor');
    }
    await owner.save(); // Don't forget to save the user update



    res.redirect('/api/admin/dashboor/super');
});

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private/Admin
const getVendors = asyncHandler(async (req, res) => {
    const vendors = await Vendor.find({}).populate('owner', 'name email');
    res.render('vendors/vendors', { // For view calls, render EJS
        title: 'All Vendors',
        vendors: vendors,
        user: req.user, // Pass req.user to the template
        message: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
    });
});

// @desc    Get vendor by ID
// @route   GET /api/vendors/:id
// @access  Private/Admin
const getVendorById = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id).populate('owner', 'name email');

    if (!vendor) {
        res.status(404);
        throw new Error('Vendor not found.');
    }

    res.render('vendors/vendor_details', { // For view calls, render EJS
        title: vendor.name,
        vendor: vendor,
        user: req.user, // Pass req.user to the template
        message: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
    });
});

// @desc    Update vendor (e.g., name, description, or even change owner)
// @route   PUT /api/vendors/:id
// @access  Private/Admin
const updateVendor = asyncHandler(async (req, res) => {
    const { name, description, ownerId } = req.body;
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
        res.status(404);
        throw new Error('Vendor not found.');
    }

    const oldOwnerId = vendor.owner ? vendor.owner.toString() : null; // Store old owner ID

    vendor.name = name !== undefined ? name : vendor.name;
    vendor.description = description !== undefined ? description : vendor.description;

    let oldOwnerUser = null;
    let newOwnerUser = null;

    // Handle owner change
    if (ownerId && ownerId.toString() !== oldOwnerId) {
        newOwnerUser = await User.findById(ownerId);
        if (!newOwnerUser) {
            res.status(404);
            throw new Error('New owner user not found.');
        }
        // Check if new owner is already assigned to another vendor (but not this current one)
        if (newOwnerUser.vendor && newOwnerUser.vendor.toString() !== vendor._id.toString()) {
            res.status(400);
            throw new Error('New owner is already assigned to another vendor.');
        }

        // Unlink old owner if exists
        if (oldOwnerId) {
            oldOwnerUser = await User.findById(oldOwnerId);
            if (oldOwnerUser) {
                oldOwnerUser.vendor = undefined;
                // Optionally remove 'vendor' role if no other vendors are associated
                oldOwnerUser.roles = oldOwnerUser.roles.filter(role => role !== 'vendor');
                await oldOwnerUser.save();
            }
        }

        // Link new owner
        newOwnerUser.vendor = vendor._id;
        if (!newOwnerUser.roles.includes('vendor')) {
            newOwnerUser.roles.push('vendor');
        }
        await newOwnerUser.save();
        vendor.owner = ownerId; // Update vendor's owner field
    }

    const updatedVendor = await vendor.save();
    res.redirect('/api/admin/dashboor/super');
})

// @desc    Delete a vendor
// @route   DELETE /api/vendors/:id
// @access  Private/Admin
const deleteVendor = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
        res.status(404);
        throw new Error('Vendor not found.');
    }

    // Store owner and vendor ID for notifications before deletion
    const oldOwnerId = vendor.owner ? vendor.owner.toString() : null;
    const vendorIdToDelete = vendor._id.toString();

    // Unlink the owner user if they exist
    const owner = await User.findById(vendor.owner);
    if (owner) {
        owner.vendor = undefined;
        // Remove 'vendor' role if they are no longer associated with any vendor
        owner.roles = owner.roles.filter(role => role !== 'vendor');
        await owner.save();
    }

    // You might also want to handle products associated with this vendor (e.g., delete them, mark them inactive)
    // await Product.updateMany({ vendor: vendor._id }, { isActive: false }); // Example: mark products inactive
    // OR: await Product.deleteMany({ vendor: vendor._id }); // Example: delete all products

    await Vendor.deleteOne({ _id: vendor._id });



    res.redirect('/api/admin/dashboor/super');

});


module.exports = {
    createVendor,
    getVendors,
    getVendorById,
    updateVendor,
    deleteVendor,
};