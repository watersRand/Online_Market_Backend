// routes/productRoutes.js

const express = require('express');
const { getProducts, getProductById, registerProduct, deleteProductById, updateProductById } = require('../controllers/productController');
const { authorize } = require('../middleware/authMiddleware')
const { User } = require('../models/User')
const router = express.Router();

router.post('/', authorize([User]), registerProduct)
    .post('/id', authorize([User]), deleteProductById)
    .post('/id', authorize([User]), updateProductById)

router.get('/', getProducts)
    .get('/:id', getProductById);


module.exports = router;