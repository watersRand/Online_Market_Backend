// controllers/productController.js

const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');
const { invalidateCache } = require('../controllers/cacheController');
const { getIo } = require('../config/socket');

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
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Vendor account not associated. Cannot create product.');
        } else {
            req.flash('error', 'You must have an associated vendor account to create products.');
            return res.redirect('/dashboard'); // Or a vendor setup page
        }
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
    await invalidateCache('products:/api/products*');

    if (product) {
        const io = getIo();
        if (io) {
            io.emit('newProductAdded', {
                productId: product._id,
                name: product.name,
                price: product.price,
                category: product.category,
                vendorId: product.vendor,
                message: `New product "${product.name}" added to the catalog.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'newProductAdded' for product: ${product._id}`);
        }

        if (req.originalUrl.startsWith('/api/')) {
            res.status(201).json(product);
        } else {
            req.flash('success', `Product "${product.name}" created successfully!`);
            res.redirect('/products'); // Redirect to product list
        }
    } else {
        res.status(400);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Invalid product data');
        } else {
            req.flash('error', 'Failed to create product. Please check your input.');
            res.redirect('/products/create'); // Redirect back to create form
        }
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
    await invalidateCache([
        `products:/api/products/${productId}`,
        'products:/api/products*'
    ]);

    const io = getIo();
    if (io) {
        io.emit('productUpdate', {
            productId: updatedProduct._id,
            name: updatedProduct.name,
            price: updatedProduct.price,
            stock: updatedProduct.countInStock,
            message: `Product "${updatedProduct.name}" has been updated.`,
            timestamp: new Date()
        });
        if (updatedProduct.countInStock === 0) {
            io.emit('productOutOfStock', {
                productId: updatedProduct._id,
                name: updatedProduct.name,
                message: `Product "${updatedProduct.name}" is now out of stock!`,
                timestamp: new Date()
            });
        }
        console.log(`Socket.IO: Emitted 'productUpdate' for product: ${updatedProduct._id}`);
    }

    if (req.originalUrl.startsWith('/api/')) {
        res.json(updatedProduct);
    } else {
        req.flash('success', `Product "${updatedProduct.name}" updated successfully!`);
        res.redirect(`/products/${updatedProduct._id}`); // Redirect to product detail page
    }
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
    await invalidateCache([
        `products:/api/products/${productId}`,
        'products:/api/products*'
    ]);

    const io = getIo();
    if (io) {
        io.emit('productDeleted', {
            productId: productId,
            name: product.name,
            message: `Product "${product.name}" has been deleted.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'productDeleted' for product: ${productId}`);
    }

    if (req.originalUrl.startsWith('/api/')) {
        res.json({ message: 'Product removed successfully' });
    } else {
        req.flash('success', `Product "${product.name}" deleted successfully.`);
        res.redirect('/products'); // Redirect to product list
    }
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

    res.json(products); // Always return JSON for this API endpoint
});

// @desc    Get single product by ID
// @route   GET /products/:id (for views) or /api/products/:id (for API)
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id)
        .populate('vendor', 'name')
        .populate('user', 'name');

    if (product) {
        if (req.originalUrl.startsWith('/api/')) {
            res.json(product);
        } else {
            // This case is handled in viewRoutes.js directly rendering the EJS.
            // This function might not be directly called for EJS rendering,
            // but if it were, you'd render here.
            res.render('products/product', { title: product.name, product, user: req.user });
        }
    } else {
        res.status(404);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Product not found');
        } else {
            req.flash('error', 'Product not found.');
            res.redirect('/products');
        }
    }
});


module.exports = {
    createProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    getProductById
};