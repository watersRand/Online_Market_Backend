// routes/orderRoutes.js

const express = require('express');
const { getCart, addItemToCart, updateCartItemQuantity, removeCartItem, clearCart } = require('../controllers/cartsContoller')
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();


router.post('/', addItemToCart)
    .put('/:id', protect, updateCartItemQuantity)
    .delete('/:id', protect, removeCartItem)
    .delete('/', clearCart);

module.exports = router;