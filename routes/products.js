const express = require('express');
const router = express.Router();
const { getProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, authorize, populateVendor } = require('../middleware/authMiddleware');
const Product = require('../models/Product'); // For rendering
const Vendor = require('../models/vendor'); // For product form


router.get('/products', async (req, res) => { // Removed populateVendor if it's redundant
    let query = {};
    const keyword = req.query.keyword || '';
    if (keyword) {
        query.name = { $regex: keyword, $options: 'i' };
    }

    // If user is a vendor, filter by their vendor ID
    // Now req.user.roles is a string
    if (req.user && req.user.roles === 'Vendor' && req.user.vendor) {
        query.vendor = req.user.vendor._id;
    }

    const products = await Product.find(query).populate('vendor', 'name').populate('user', 'name');
    const productsWithNames = products.map(p => ({
        ...p.toObject(),
        vendorName: p.vendor ? p.vendor.name : 'N/A',
        userName: p.user ? p.user.name : 'N/A'
    }));

    res.render('products/products', {
        title: 'Products',
        products: productsWithNames,
        page: 1,
        pages: 1,
        keyword,
        user: req.user, // req.user now has full roles (as string) and vendor data
        isVendorAdmin: req.user && req.user.roles === 'Vendor' // Check role string directly
    });
});


// Render product creation form
router.get('/products/create', protect, authorize('Admin', 'vendor'), async (req, res) => {
    let vendors = [];
    let selectedVendorId = null;

    if (req.user.roles.includes('Admin')) {
        vendors = await Vendor.find({});
    }
    if (req.user.roles.includes('vendor') && req.user.vendor) {
        selectedVendorId = req.user.vendor.toString();
    }
    res.render('products/product_new', { title: 'Create Product', product: null, vendors, selectedVendorId, user: req.user });
});

// Handle product creation
router.post('/products', protect, authorize('Admin', 'vendor'), createProduct);

// Render product edit form
router.get('/products/edit/:id', protect, authorize('Admin', 'vendor'), async (req, res) => {
    const product = await Product.findById(req.params.id).populate('vendor');
    if (!product) {
        return res.status(404).render('error', { title: 'Product Not Found', message: 'Product not found.' });
    }

    const isSuperAdmin = req.user.roles.includes('Admin');
    const isOwningVendorAdmin = req.user.roles.includes('vendor') &&
        req.user.vendor && product.vendor && product.vendor._id.toString() === req.user.vendor._id.toString();

    if (!isSuperAdmin && !isOwningVendorAdmin) {
        return res.status(403).render('error', { title: 'Unauthorized', message: 'Not authorized to edit this product.' });
    }

    let vendors = [];
    if (isSuperAdmin) {
        vendors = await Vendor.find({});
    }
    res.render('products/product_edit', { title: `Edit ${product.name}`, product, vendors, user: req.user });
});

// Handle product update
router.put('/products/:id', protect, authorize('Admin', 'vendor'), updateProduct);

// Render single product details
router.get('/products/:id', async (req, res) => {
    const product = await Product.findById(req.params.id).populate('vendor', 'name').populate('user', 'name');
    if (!product) {
        return res.status(404).render('error', { title: 'Product Not Found', message: 'Product not found.' });
    }
    const productWithNames = {
        ...product.toObject(),
        vendorName: product.vendor ? product.vendor.name : 'N/A',
        userName: product.user ? product.user.name : 'N/A'
    };
    res.render('products/product_details', { title: product.name, product: productWithNames, user: req.user });
});

// Handle product deletion
router.delete('/products/:id', protect, authorize('Admin'), deleteProduct);

module.exports = router;