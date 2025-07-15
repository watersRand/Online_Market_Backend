const asyncHandler = require('express-async-handler');
const Vendor = require('../models/vendor');
const User = require('../models/User');
const { invalidateCache } = require('../controllers/cacheController')
const { getIo } = require('../config/socket'); // Import getIo to access Socket.IO


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
    await invalidateCache('vendors:/api/vendors*');


    // Link the user to this newly created vendor
    owner.vendor = createdVendor._id;
    // Potentially assign a 'vendor' role to the user if they don't have it already
    if (!owner.roles.includes('vendor')) {
        owner.roles.push('vendor');
    }
    await owner.save(); // Don't forget to save the user update

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Notify admins about the new vendor
        io.to('admin_dashboard').emit('newVendorCreated', {
            vendorId: createdVendor._id,
            name: createdVendor.name,
            ownerName: owner.name,
            message: `New vendor "${createdVendor.name}" created, owned by ${owner.name}.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'newVendorCreated' for admin dashboard.`);

        // Also, potentially notify the new owner if they are online and joined their user room
        io.to(`user:${owner._id.toString()}`).emit('vendorAssigned', {
            vendorId: createdVendor._id,
            name: createdVendor.name,
            message: `You have been assigned as the owner of "${createdVendor.name}"!`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'vendorAssigned' to new owner: ${owner._id}`);
    }

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
    await invalidateCache([
        `vendors:/api/vendors/${req.params.id}`,
        'vendors:/api/vendors*'
    ]);

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Notify admins about the vendor update
        io.to('admin_dashboard').emit('vendorUpdated', {
            vendorId: updatedVendor._id,
            name: updatedVendor.name,
            description: updatedVendor.description,
            ownerId: updatedVendor.owner,
            message: `Vendor "${updatedVendor.name}" has been updated.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'vendorUpdated' for admin dashboard.`);

        // If owner changed, notify affected users
        if (oldOwnerUser) {
            io.to(`user:${oldOwnerUser._id.toString()}`).emit('vendorUnassigned', {
                vendorId: vendor._id,
                name: vendor.name,
                message: `You are no longer the owner of "${vendor.name}".`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'vendorUnassigned' to old owner: ${oldOwnerUser._id}`);
        }
        if (newOwnerUser) {
            io.to(`user:${newOwnerUser._id.toString()}`).emit('vendorAssigned', {
                vendorId: updatedVendor._id,
                name: updatedVendor.name,
                message: `You have been assigned as the owner of "${updatedVendor.name}"!`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'vendorAssigned' to new owner: ${newOwnerUser._id}`);
        }

        // Potentially notify the vendor's own dashboard if they are currently online
        if (updatedVendor.owner) {
            io.to(`vendor_dashboard:${updatedVendor._id.toString()}`).emit('vendorDetailsUpdated', {
                vendorId: updatedVendor._id,
                name: updatedVendor.name,
                description: updatedVendor.description,
                message: `Your vendor details have been updated by an admin.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'vendorDetailsUpdated' for vendor dashboard: ${updatedVendor._id}`);
        }
    }

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
    await invalidateCache([
        `vendors:/api/vendors/${req.params.id}`,
        'vendors:/api/vendors*'
    ]);

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Notify admins about the vendor deletion
        io.to('admin_dashboard').emit('vendorDeleted', {
            vendorId: vendorIdToDelete,
            name: vendor.name,
            message: `Vendor "${vendor.name}" has been deleted.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'vendorDeleted' for admin dashboard.`);

        // Notify the old owner that their vendor was deleted
        if (oldOwnerId) {
            io.to(`user:${oldOwnerId}`).emit('vendorDeletedFromAccount', {
                vendorId: vendorIdToDelete,
                name: vendor.name,
                message: `The vendor "${vendor.name}" you owned has been deleted from the system.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'vendorDeletedFromAccount' to old owner: ${oldOwnerId}`);
        }

        // Potentially notify the vendor's own dashboard (if somehow it's still connected before deletion)
        io.to(`vendor_dashboard:${vendorIdToDelete}`).emit('vendorAccountDeleted', {
            vendorId: vendorIdToDelete,
            name: vendor.name,
            message: `Your vendor account "${vendor.name}" has been deleted.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'vendorAccountDeleted' to vendor dashboard: ${vendorIdToDelete}`);

        // If you had a general 'vendors_list' room for public
        // io.emit('vendorRemovedFromList', { vendorId: vendorIdToDelete, name: vendor.name });
    }

    res.json({ message: 'Vendor removed' });
});


module.exports = {
    createVendor,
    getVendors,
    getVendorById,
    updateVendor,
    deleteVendor,
};