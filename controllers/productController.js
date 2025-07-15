const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Vendor = require('../models/vendor'); // Import Vendor model
const User = require('../models/User'); // Assuming User model has roles
const { invalidateCache } = require('../controllers/cacheController');
const { getIo } = require('../config/socket'); // Import getIo to access Socket.IO

// Helper to determine if a user has a specific role
const hasRole = (user, role) => user && user.roles && user.roles.includes(role);

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin or VendorAdmin
const createProduct = asyncHandler(async (req, res) => {
    const { name, price, description, category, countInStock, vendorId } = req.body;

    const reqUser = await User.findById(req.user._id); // Assuming req.user contains the user ID
    if (!reqUser) {
        res.status(401);
        throw new Error('User not found.');
    }

    let assignedVendorId;

    // Authorization logic for product creation
    if (hasRole(reqUser, 'Admin')) { // Check if user is a Super Admin
        if (!vendorId) {
            res.status(400);
            throw new Error('Admin must specify vendorId in the request body when creating a product.');
        }
        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            res.status(404);
            throw new Error('Specified vendor not found.');
        }
        assignedVendorId = vendorId;
    } else if (hasRole(reqUser, 'vendor')) { // Check if user is a Vendor Admin
        if (!reqUser.vendor) {
            res.status(403);
            throw new Error('Vendor account not linked to a vendor. Please contact support.');
        }
        // Vendor admins can only create products for their own vendor
        if (vendorId && vendorId.toString() !== reqUser.vendor.toString()) {
            res.status(403);
            throw new Error('Vendor can only create products for their assigned vendor.');
        }
        assignedVendorId = reqUser.vendor;
    } else {
        res.status(403);
        throw new Error('Not authorized to create products.');
    }

    const product = new Product({
        user: reqUser._id, // User who created it
        vendor: assignedVendorId, // Assign to determined vendor
        name,
        price,
        description,
        category,
        countInStock,
    });

    const createdProduct = await product.save();
    await invalidateCache(['products:/api/products*', `products:/api/products/${createdProduct._id}`]); // Invalidate specific and all products cache

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Notify admins about new product creation
        io.to('admin_dashboard').emit('newProductAdded', {
            productId: createdProduct._id,
            name: createdProduct.name,
            vendorId: createdProduct.vendor,
            creatorId: createdProduct.user,
            message: `New product "${createdProduct.name}" added.`,
            timestamp: new Date()
        });
        // You could also notify the specific vendor's dashboard if they have one
        if (createdProduct.vendor) {
            io.to(`vendor_dashboard:${createdProduct.vendor.toString()}`).emit('productAdded', {
                productId: createdProduct._id,
                name: createdProduct.name,
                message: `Your new product "${createdProduct.name}" is live!`,
                timestamp: new Date()
            });
        }
    }

    res.status(201).json(createdProduct);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin or VendorAdmin
const updateProduct = asyncHandler(async (req, res) => {
    const { name, price, description, category, countInStock } = req.body;

    const reqUser = await User.findById(req.user._id); // Assuming req.user contains the user ID
    if (!reqUser) {
        res.status(401);
        throw new Error('User not found.');
    }

    const product = await Product.findById(req.params.id);

    if (product) {
        // Authorization: Only Super Admin or the owning Vendor Admin can update
        const isSuperAdmin = hasRole(reqUser, 'Admin');
        const isOwningVendorAdmin = hasRole(reqUser, 'vendor') &&
            reqUser.vendor &&
            product.vendor.toString() === reqUser.vendor.toString();

        if (!isSuperAdmin && !isOwningVendorAdmin) {
            res.status(403);
            throw new Error('Not authorized to update this product.');
        }

        // Store old stock for comparison
        const oldStock = product.countInStock;

        product.name = name !== undefined ? name : product.name;
        product.price = price !== undefined ? price : product.price;
        product.description = description !== undefined ? description : product.description;
        product.category = category !== undefined ? category : product.category;
        product.countInStock = countInStock !== undefined ? countInStock : product.countInStock;

        const updatedProduct = await product.save();

        await invalidateCache([
            `products:/api/products/${req.params.id}`, // Specific product by ID
            'products:/api/products*' // All product list views
        ]);

        const io = getIo();
        if (io) {
            // Emit to clients on the specific product page and general product lists
            io.to(`product:${updatedProduct._id.toString()}`).emit('productUpdate', {
                productId: updatedProduct._id,
                name: updatedProduct.name,
                price: updatedProduct.price,
                stock: updatedProduct.countInStock,
                available: updatedProduct.countInStock > 0,
                description: updatedProduct.description,
                category: updatedProduct.category,
                imageUrl: updatedProduct.image, // Assuming product has an image field
                timestamp: new Date()
            });
            console.log(`Emitted productUpdate for product: ${updatedProduct.name} (${updatedProduct._id})`);

            // If stock changed and is now low, alert admins/vendor
            const newStock = updatedProduct.countInStock;
            const lowStockThreshold = 10; // Define your threshold

            if (oldStock > lowStockThreshold && newStock <= lowStockThreshold) {
                // Alert if stock crossed the threshold from above
                io.to('admin_dashboard').emit('adminAlert', {
                    type: 'low_stock_critical',
                    productId: updatedProduct._id,
                    name: updatedProduct.name,
                    stock: newStock,
                    message: `CRITICAL LOW STOCK: ${updatedProduct.name} has only ${newStock} units left!`,
                    timestamp: new Date()
                });
                if (updatedProduct.vendor) {
                    io.to(`vendor_dashboard:${updatedProduct.vendor.toString()}`).emit('vendorAlert', {
                        type: 'low_stock_critical',
                        productId: updatedProduct._id,
                        name: updatedProduct.name,
                        stock: newStock,
                        message: `URGENT: ${updatedProduct.name} in your store has only ${newStock} units left!`,
                        timestamp: new Date()
                    });
                }
                console.log(`Emitted low stock alert for product: ${updatedProduct.name}`);
            } else if (newStock <= lowStockThreshold && newStock > 0) {
                // Regular low stock alert if it's already low but not critical new threshold
                io.to('admin_dashboard').emit('adminAlert', {
                    type: 'low_stock',
                    productId: updatedProduct._id,
                    name: updatedProduct.name,
                    stock: newStock,
                    message: `Low stock: ${updatedProduct.name} has ${newStock} units left.`,
                    timestamp: new Date()
                });
                if (updatedProduct.vendor) {
                    io.to(`vendor_dashboard:${updatedProduct.vendor.toString()}`).emit('vendorAlert', {
                        type: 'low_stock',
                        productId: updatedProduct._id,
                        name: updatedProduct.name,
                        stock: newStock,
                        message: `Low stock: ${updatedProduct.name} has ${newStock} units left.`,
                        timestamp: new Date()
                    });
                }
            } else if (newStock === 0) {
                // Out of stock alert
                io.to('admin_dashboard').emit('adminAlert', {
                    type: 'out_of_stock',
                    productId: updatedProduct._id,
                    name: updatedProduct.name,
                    stock: newStock,
                    message: `OUT OF STOCK: ${updatedProduct.name} is now out of stock!`,
                    timestamp: new Date()
                });
                if (updatedProduct.vendor) {
                    io.to(`vendor_dashboard:${updatedProduct.vendor.toString()}`).emit('vendorAlert', {
                        type: 'out_of_stock',
                        productId: updatedProduct._id,
                        name: updatedProduct.name,
                        stock: newStock,
                        message: `OUT OF STOCK: Your product ${updatedProduct.name} is now out of stock!`,
                        timestamp: new Date()
                    });
                }
                io.to(`product:${updatedProduct._id.toString()}`).emit('productOutOfStock', {
                    productId: updatedProduct._id,
                    name: updatedProduct.name,
                    timestamp: new Date()
                });
                console.log(`Emitted out of stock alert for product: ${updatedProduct.name}`);
            }
        }

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

    const reqUser = await User.findById(req.user._id);
    if (!reqUser) {
        res.status(401);
        throw new Error('User not found.');
    }

    if (product) {
        // Only Super Admin can delete products (for stricter control)
        if (!hasRole(reqUser, 'Admin')) {
            res.status(403);
            throw new Error('Not authorized to delete products.');
        }

        await Product.deleteOne({ _id: product._id });

        await invalidateCache([
            `products:/api/products/${req.params.id}`, // Specific product by ID
            'products:/api/products*' // All product list views
        ]);

        const io = getIo();
        if (io) {
            // Notify admins and potentially clients (e.g., if on a product list page)
            io.to('admin_dashboard').emit('productDeleted', {
                productId: product._id,
                name: product.name,
                message: `Product "${product.name}" has been deleted.`,
                timestamp: new Date()
            });
            // If clients are on a general products list and need live updates
            io.emit('productRemovedFromCatalog', {
                productId: product._id,
                name: product.name,
                message: `Product "${product.name}" is no longer available.`,
                timestamp: new Date()
            });
            console.log(`Emitted product deleted event for product: ${product.name}`);
        }

        res.json({ message: 'Product removed' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
});

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
    const pageSize = Number(req.query.pageSize) || 10; // Default page size
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
    // Assuming req.user is populated with vendor details or at least vendor ID
    if (req.user && req.user._id) { // Ensure user is authenticated
        const loggedInUser = await User.findById(req.user._id).populate('vendor');
        if (loggedInUser && hasRole(loggedInUser, 'vendor') && loggedInUser.vendor) {
            query.vendor = loggedInUser.vendor._id;
            console.log(`Filtering products for vendor: ${loggedInUser.vendor._id}`);
        }
    }

    const count = await Product.countDocuments(query);
    const products = await Product.find(query)
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({ products, page, pages: Math.ceil(count / pageSize) });
});


// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
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