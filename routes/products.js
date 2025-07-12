const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
} = require('../controllers/productController');
const { cacheResponse } = require('../controllers/cacheController')
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
    .get(cacheResponse('products', 300), getProducts) // Keep public or protect as needed by your app
    .post(protect, authorize(['admin', 'vendor']), createProduct); // Updated authorize

router.route('/:id')
    .get(cacheResponse('products', 300), getProductById) // Keep public or protect as needed by your app
    .put(protect, authorize(['admin', 'vendorAdmin']), updateProduct) // Updated authorize
    .delete(protect, authorize(['admin']), deleteProduct); // Still only Super Admin can delete

module.exports = router;