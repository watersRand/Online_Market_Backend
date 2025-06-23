// controllers/productController.js

const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');


//Create products
// Register new product
const registerProduct = asyncHandler(async (req, res) => {
    const { name, description, price, countInStock } = req.body;

    const product = await Product.create({
        name,
        description,
        price,
        countInStock
    });

    if (product) {
        res.status(201).json({
            _id: product._id,
            name: product.name,
            price: product.price,
            countInStock: product.countInStock,

        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});
// Fetch all products
const getProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({});
    res.json(products);
});

// Fetch single product
const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        res.json(product);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

module.exports = { registerProduct, getProducts, getProductById };