// controllers/serviceController.js // Corrected file name based on your module.exports
const Service = require('../models/services');
const asyncHandler = require('express-async-handler');
const { invalidateCache } = require('../controllers/cacheController'); // Assuming this path is correct
const { getIo } = require('../config/socket'); // Import getIo to access Socket.IO

// @desc    Register new service
// @route   POST /api/services
// @access  Private/Admin (assuming only admins can register services)
const registerService = asyncHandler(async (req, res) => {
    const { name, description, price, category } = req.body;

    const service = await Service.create({
        name,
        description,
        price,
        category
    });

    await invalidateCache([
        'services:/api/services*', // Invalidate cache for all services list
        `services:/api/services/${service._id}` // Invalidate cache for the specific new service
    ]);

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Notify admins about the new service
        io.to('admin_dashboard').emit('newServiceRegistered', {
            serviceId: service._id,
            name: service.name,
            price: service.price,
            category: service.category,
            message: `New service "${service.name}" (${service.category}) has been registered.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'newServiceRegistered' for service ID: ${service._id}`);
    }

    if (service) {
        res.status(201).json({
            _id: service._id,
            name: service.name,
            price: service.price,
            description: service.description,
            category: service.category,
        });
    } else {
        res.status(400);
        throw new Error('Invalid service data provided.');
    }
});

// @desc    Fetch all services
// @route   GET /api/services
// @access  Public
const getServices = asyncHandler(async (req, res) => {
    const services = await Service.find({});
    // No Socket.IO emission needed for a read operation unless you're implementing
    // real-time search filters, which is more complex.
    res.json(services);
});

// @desc    Fetch single service by ID
// @route   GET /api/services/:id
// @access  Public
const getServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id);

    if (service) {
        res.json(service);
    } else {
        res.status(404);
        throw new Error('Service not found');
    }
});

// @desc    Delete single service by ID
// @route   DELETE /api/services/:id
// @access  Private/Admin
const deleteServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findByIdAndDelete(req.params.id);

    await invalidateCache([
        `services:/api/services/${req.params.id}`, // Specific service by ID
        'services:/api/services*' // All services list views
    ]);

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Notify admins about the service deletion
        io.to('admin_dashboard').emit('serviceDeleted', {
            serviceId: req.params.id,
            name: service ? service.name : 'Unknown Service', // Use name if found before deletion
            message: `Service ID ${req.params.id} has been deleted.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'serviceDeleted' for service ID: ${req.params.id}`);

        // Potentially notify clients on general service listing pages
        io.emit('serviceRemovedFromCatalog', {
            serviceId: req.params.id,
            name: service ? service.name : 'Unknown Service',
            message: `Service "${service ? service.name : 'an item'}" is no longer available.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'serviceRemovedFromCatalog' for service ID: ${req.params.id}`);
    }

    if (service) {
        res.json({ message: 'Service removed successfully' });
    } else {
        res.status(404);
        throw new Error('Service not found');
    }
});

// @desc    Update a single service
// @route   PUT /api/services/:id
// @access  Private/Admin
const updateServiceById = asyncHandler(async (req, res) => {
    const { name, description, price, category } = req.body; // Removed 'stock' and 'imageUrl' if not part of your Service model

    // Find the service by ID
    let service = await Service.findById(req.params.id);

    if (!service) {
        res.status(404);
        throw new Error('Service not found');
    }

    // Update all fields (only if provided in req.body)
    service.name = name !== undefined ? name : service.name;
    service.description = description !== undefined ? description : service.description;
    service.price = price !== undefined ? price : service.price;
    service.category = category !== undefined ? category : service.category;
    // service.stock = stock !== undefined ? stock : service.stock; // Uncomment if your Service model has a 'stock' field
    // service.imageUrl = imageUrl !== undefined ? imageUrl : service.imageUrl; // Uncomment if your Service model has an 'imageUrl' field

    const updatedService = await service.save(); // .save() will run pre-save hooks (like updatedAt)

    await invalidateCache([
        `services:/api/services/${req.params.id}`, // Specific service by ID
        'services:/api/services*' // All services list views
    ]);

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Emit to clients on the specific service detail page
        io.to(`service:${updatedService._id.toString()}`).emit('serviceUpdated', {
            serviceId: updatedService._id,
            name: updatedService.name,
            description: updatedService.description,
            price: updatedService.price,
            category: updatedService.category,
            // imageUrl: updatedService.imageUrl, // Uncomment if applicable
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'serviceUpdated' for service ID: ${updatedService._id}`);

        // Notify admins about the service update
        io.to('admin_dashboard').emit('adminServiceUpdate', {
            serviceId: updatedService._id,
            name: updatedService.name,
            message: `Service "${updatedService.name}" has been updated.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'adminServiceUpdate' for service ID: ${updatedService._id}`);
    }

    res.status(200).json({
        success: true,
        data: updatedService
    });
});

module.exports = { registerService, getServices, getServiceById, deleteServiceById, updateServiceById };