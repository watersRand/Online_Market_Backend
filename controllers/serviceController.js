// controllers/productController.js

const Service = require('../models/services');
const asyncHandler = require('express-async-handler');


//Create services
// Register new service
const registerService = asyncHandler(async (req, res) => {
    const { name, description, price, category } = req.body;

    const service = await Service.create({
        name,
        description,
        price,
        category
    });

    await invalidateCache('services:/api/services*');

    if (service) {
        res.status(201).json({
            _id: service._id,
            name: service.name,
            price: service.price,

        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});
// Fetch all products
const getServices = asyncHandler(async (req, res) => {
    const services = await Service.find({});
    res.json(services);
});

// Fetch single product
const getServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findById(req.params.id);

    if (service) {
        res.json(service);
    } else {
        res.status(404);
        throw new Error('Service not found');
    }
});

//Delete single product
const deleteServiceById = asyncHandler(async (req, res) => {
    const service = await Service.findByIdAndDelete(req.params.id);
    await invalidateCache([
        `services:/api/services/${req.params.id}`, // Specific product by ID
        'services:/api/services*'                  // All product list views
    ]);


    if (service) {
        res.json('Sucess');
    } else {
        res.status(404);
        throw new Error('Service not found');
    }
});

//Update a single product
const updateServiceById = (async (req, res) => {
    const { name, description, price, category, stock, imageUrl } = req.body;

    // Find the product by ID
    let service = await Service.findById(req.params.id);

    if (!service) {
        res.status(404);
        throw new Error('Product not found');
    }

    // Update all fields (even if some are the same)
    service.name = name || service.name; // Provide fallback to existing data if not provided
    service.description = description || service.description;
    service.price = price || service.price;
    service.category = category || service.category;
    service.stock = stock || service.stock;
    service.imageUrl = imageUrl || service.imageUrl;

    const updatedService = await service.save(); // .save() will run pre-save hooks (like updatedAt)
    await invalidateCache([
        `services:/api/services/${req.params.id}`, // Specific product by ID
        'services:/api/services*'                  // All product list views
    ]);

    res.status(200).json({
        success: true,
        data: updatedService
    });
});

module.exports = { registerService, getServices, getServiceById, deleteServiceById, updateServiceById };