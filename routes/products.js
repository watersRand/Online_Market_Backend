// routes/productRoutes.js

const express = require('express');
const { getProducts, getProductById, registerProduct } = require('../controllers/productController');

const router = express.Router();

router.post('/', registerProduct);

router.get('/', getProducts)
    .get('/:id', getProductById);


module.exports = router;