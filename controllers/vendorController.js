const asyncHandler = require('express-async-handler');
const Vendor = require('../models/vendor');
const User = require('../models/User');
const { invalidateCache } = require('../controllers/cacheController')


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
    if (owner.vendor) { // Check if the user is already assigned as an owner of another vendor
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
    await invalidateCache('vendors:/api/vendors*');


    // Link the user to this newly created vendor
    owner.vendor = createdVendor._id;
    await owner.save(); // Don't forget to save the user update

    res.status(201).json(createdVendor);
});

// @desc    Get all vendors
// @route   GET /api/vendors
// @access  Private/Admin
const getVendors = asyncHandler(async (req, res) => {
    const vendors = await Vendor.find({}).populate('owner', 'name email');
    res.json(vendors);
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

    res.json(vendor);
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

    vendor.name = name || vendor.name;
    vendor.description = description || vendor.description;

    if (ownerId && ownerId.toString() !== vendor.owner.toString()) {
        const newOwner = await User.findById(ownerId);
        if (!newOwner) {
            res.status(404);
            throw new Error('New owner user not found.');
        }
        if (newOwner.vendor && newOwner.vendor.toString() !== vendor._id.toString()) {
            res.status(400);
            throw new Error('New owner is already assigned to another vendor.');
        }

        // Unlink old owner if exists
        const oldOwner = await User.findById(vendor.owner);
        if (oldOwner) {
            oldOwner.vendor = undefined;
            await oldOwner.save();
        }

        // Link new owner
        newOwner.vendor = vendor._id;
        await newOwner.save();
        vendor.owner = ownerId;
    }


    const updatedVendor = await vendor.save();
    await invalidateCache([
        `vendors:/api/vendors/${req.params.id}`, // Specific product by ID
        'vendors:/api/vendors*'                  // All product list views
    ]);

    res.json(updatedVendor);
});

// @desc    Delete a vendor
// @route   DELETE /api/vendors/:id
// @access  Private/Admin
const deleteVendor = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
        res.status(404);
        throw new Error('Vendor not found.');
    }

    // Unlink the owner user if they exist
    const owner = await User.findById(vendor.owner);
    if (owner) {
        owner.vendor = undefined;
        await owner.save();
    }

    // You might also want to handle products associated with this vendor (e.g., delete them, mark them inactive)
    // await Product.deleteMany({ vendor: vendor._id });

    await Vendor.deleteOne({ _id: vendor._id });
    await invalidateCache([
        `vendors:/api/vendors/${req.params.id}`, // Specific product by ID
        'vendors:/api/vendors*'                  // All product list views
    ]);

    res.json({ message: 'Vendor removed' });
});


module.exports = {
    createVendor,
    getVendors,
    getVendorById,
    updateVendor,
    deleteVendor,
};