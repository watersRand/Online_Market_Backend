const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Vendor = require('../models/vendor'); // Import Vendor model
const User = require('../models/User')
const { invalidateCache } = require('../controllers/cacheController')


// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin or VendorAdmin
const createProduct = asyncHandler(async (req, res) => {
    const { name, price, description, category, countInStock, vendorId } = req.body;

    const controll = await User.findById(req.user).populate()

    // Determine vendor based on user role
    if (controll.roles == 'Admin') {
        // If super admin, they must specify the vendorId in the request body
        if (!req.body.vendorId) {
            res.status(400);
            throw new Error('Admin must specify vendorId when creating a product.');
        }
        const vendor = await Vendor.findById(req.body.vendorId);
        if (!vendor) {
            res.status(404);
            throw new Error('Specified vendor not found.');
        }

    } else {
        res.status(403);
        throw new Error('Not authorized to create products without a vendor assigned.');
    }

    const product = new Product({
        user: req.user, // User who created it (can be admin or vendor admin)
        vendor: vendorId, // Assign to vendor
        name,
        price,
        description,
        category,
        countInStock,
    });

    const createdProduct = await product.save();
    await invalidateCache('products:/api/products*');
    res.status(201).json(createdProduct);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin or VendorAdmin
const updateProduct = asyncHandler(async (req, res) => {
    const { name, price, description, category, countInStock } = req.body;
    const controll = await User.findById(req.user).populate()

    const product = await Product.findById(req.params.id);

    if (product) {
        // Authorization: Only Super Admin or the owning Vendor Admin can update
        if (!controll.roles == 'Admin' && (!controll.roles == 'vendor' || product.vendor.toString() !== req.user.vendor._id.toString())) {
            res.status(403);
            throw new Error('Not authorized to update this product.');
        }

        product.name = name || product.name;
        product.price = price || product.price;
        product.description = description || product.description;
        product.category = category || product.category;
        product.countInStock = countInStock !== undefined ? countInStock : product.countInStock;

        const updatedProduct = await product.save();

        await invalidateCache([
            `products:/api/products/${req.params.id}`, // Specific product by ID
            'products:/api/products*'                  // All product list views
        ]);
        res.json(updatedProduct);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        // Only Super Admin can delete products (for stricter control)
        if (!req.user.isAdmin) {
            res.status(403);
            throw new Error('Not authorized to delete products.');
        }
        await Product.deleteOne({ _id: product._id });

        await invalidateCache([
            `products:/api/products/${req.params.id}`, // Specific product by ID
            'products:/api/products*'                  // All product list views
        ]);
        res.json({ message: 'Product removed' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// Add other existing methods like getProducts, getProductById
// Note: You might want to filter getProducts by vendor for vendor admins if they need a list of their own products.
// For example:
const getProducts = asyncHandler(async (req, res) => {
    const pageSize = 10;
    const page = Number(req.query.pageNumber) || 1;
    const keyword = req.query.keyword
        ? {
            name: {
                $regex: req.query.keyword,
                $options: 'i',
            },
        }
        : {};

    let query = { ...keyword };

    // If the user is a vendor admin, only show products from their vendor
    if (req.user && req.user.vendor) {
        query.vendor = req.user.vendor._id;
    }

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({ products, page, pages: Math.ceil(count / pageSize) });
});


const getProductById = asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (product) {
        res.json(product);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});


module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
};