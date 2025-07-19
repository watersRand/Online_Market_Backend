// controllers/productController.js

const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');


// @desc    Create a new product
// @route   POST /products (for views) or /api/products (for API)
// @access  Private (Vendor/Admin)
const createProduct = asyncHandler(async (req, res) => {
    const { name, description, price, category, countInStock, image } = req.body;

    // Assuming req.user is populated by 'protect' middleware
    // and req.user.roles is a string (e.g., 'Vendor', 'Admin')
    // and req.user.vendor is populated if the user is a vendor.

    // Basic authorization check
    if (req.user.roles !== 'Vendor' && req.user.roles !== 'Admin') {
        res.status(403);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Not authorized to create products.');
        } else {
            req.flash('error', 'You are not authorized to create products.');
            return res.redirect('/products'); // Redirect to product list
        }
    }

    // If user is a vendor, ensure they are associated with a vendor
    if (req.user.roles === 'Vendor' && !req.user.vendor) {
        res.status(400);

        req.flash('error', 'You must have an associated vendor account to create products.');
        return res.redirect('/'); // Or a vendor setup page
    }

    const product = await Product.create({
        name,
        description,
        price,
        category,
        countInStock,
        image,
        user: req.user._id, // User who added the product
        vendor: req.user.roles === 'Vendor' ? req.user.vendor._id : null, // Assign vendor if user is a vendor
    });


    if (product) {
        res.redirect('/api/products/products'); // Redirect to product list

    } else {
        res.status(400);
        req.flash('error', 'Failed to create product. Please check your input.');
        res.redirect('/api/products/products/create'); // Redirect back to create form
    }

});

// @desc    Update a product
// @route   PUT /products/:id (for views) or /api/products/:id (for API)
// @access  Private (Vendor/Admin)
const updateProduct = asyncHandler(async (req, res) => {
    const { name, description, price, category, countInStock, image } = req.body;
    const productId = req.params.id;

    let product = await Product.findById(productId);

    if (!product) {
        res.status(404);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Product not found');
        } else {
            req.flash('error', 'Product not found for update.');
            return res.redirect('/products');
        }
    }

    // Authorization: Only the product's vendor or an admin can update
    const isAuthorized = (req.user.roles === 'Admin') ||
        (req.user.roles === 'Vendor' && req.user.vendor && product.vendor &&
            req.user.vendor._id.toString() === product.vendor.toString());

    if (!isAuthorized) {
        res.status(403);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Not authorized to update this product.');
        } else {
            req.flash('error', 'You are not authorized to update this product.');
            return res.redirect('/products');
        }
    }

    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price || product.price;
    product.category = category || product.category;
    product.countInStock = countInStock !== undefined ? countInStock : product.countInStock;
    product.image = image || product.image;

    const updatedProduct = await product.save();




    req.flash('success', `Product "${updatedProduct.name}" updated successfully!`);
    res.redirect(`/api/products/products/${updatedProduct._id}`); // Redirect to product detail page
});

// @desc    Delete a product
// @route   DELETE /products/:id (for views) or /api/products/:id (for API)
// @access  Private (Vendor/Admin)
const deleteProduct = asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
        res.status(404);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Product not found');
        } else {
            req.flash('error', 'Product not found for deletion.');
            return res.redirect('/products');
        }
    }

    // Authorization: Only the product's vendor or an admin can delete
    const isAuthorized = (req.user.roles === 'Admin') ||
        (req.user.roles === 'Vendor' && req.user.vendor && product.vendor &&
            req.user.vendor._id.toString() === product.vendor.toString());

    if (!isAuthorized) {
        res.status(403);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Not authorized to delete this product.');
        } else {
            req.flash('error', 'You are not authorized to delete this product.');
            return res.redirect('/products');
        }
    }

    await Product.deleteOne({ _id: productId });



    res.redirect('/api/products/products'); // Redirect to product list

});

// @desc    Get all products
// @route   GET /products (for views) or /api/products (for API)
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    let query = {};
    const keyword = req.query.keyword || '';

    if (keyword) {
        query.name = { $regex: keyword, $options: 'i' };
    }

    // This function is for API, so it doesn't render EJS directly.
    // The viewRoutes.js will call Product.find() and then render.
    const products = await Product.find(query).populate('vendor', 'name').populate('user', 'name');
    res.render('products/product_list', { // For view calls, render EJS
        title: 'All Products',
        products: products,
        user: req.user, // Pass req.user to the template
        message: req.flash('success'),
        error: req.flash('error'),
        info: req.flash('info')
    });
});

// @desc    Get single product by ID
// @route   GET /products/:id (for views) or /api/products/:id (for API)
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
        .populate('vendor', 'name')
        .populate('user', 'name');

    if (product) {

        res.render('/api/products/products', { title: product.name, product, user: req.user });

    } else {
        res.status(404);

        req.flash('error', 'Product not found.');
        res.redirect('/api/products/products');

    }
});


module.exports = {
    createProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getProductById
};