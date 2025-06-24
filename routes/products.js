// routes/productRoutes.js

const express = require('express');
const { getProducts, getProductById, registerProduct, deleteProductById, updateProductById } = require('../controllers/productController');
const { authorize } = require('../middleware/authMiddleware')
const router = express.Router();

router.post('/', authorize([Admin]), registerProduct)
    .post('/id', authorize([Admin]), deleteProductById)
    .post('/id', authorize([Admin]), updateProductById)

router.get('/', getProducts)
    .get('/:id', getProductById);


module.exports = router;