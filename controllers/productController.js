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

//Delete single product
const deleteProductById = asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (product) {
        res.json('Sucess');
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

//Update a single product
const updateProductById = (async (req, res) => {
    const { name, description, price, category, stock, imageUrl } = req.body;

    // Find the product by ID
    let product = await Product.findById(req.params.id);

    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    // Update all fields (even if some are the same)
    product.name = name || product.name; // Provide fallback to existing data if not provided
    product.description = description || product.description;
    product.price = price || product.price;
    product.category = category || product.category;
    product.stock = stock || product.stock;
    product.imageUrl = imageUrl || product.imageUrl;

    const updatedProduct = await product.save(); // .save() will run pre-save hooks (like updatedAt)

    res.status(200).json({
        success: true,
        data: updatedProduct
    });
});

module.exports = { registerProduct, getProducts, getProductById, deleteProductById, updateProductById };