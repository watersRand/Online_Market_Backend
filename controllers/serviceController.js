// controllers/serviceController.js // Corrected file name based on your module.exports
const Service = require('../models/services');
const asyncHandler = require('express-async-handler');



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


    if (service) {
        res.redirect('/api/serices/services')
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
    res.redirect('/api/serives/services')
});

// @desc    Fetch single service by ID
// @route   GET /api/services/:id
// @access  Public
const getServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id);

    if (service) {
        res.redirect('/api/services/service_detail');
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




    if (service) {
        res.redirect('/api/services/services')
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




    res.redirect('/api/services/services')
});

module.exports = { registerService, getServices, getServiceById, deleteServiceById, updateServiceById };