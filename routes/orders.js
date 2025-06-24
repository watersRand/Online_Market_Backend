// routes/orderRoutes.js

const express = require('express');
const { getOrCreateCart, getCart, addItemToCart, updateCartItemQuantity, removeCartItem, clearCart } = require('../controllers/cartsContoller')
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/:id', protect, getOrCreateCart)
    .put('/', protect, addItemToCart)
    .put('/:id', protect, updateCartItemQuantity)
    .delete('/:id', protect, removeCartItem)
    .delete('/', clearCart);
router.get('/:id', protect, getOrderById);

module.exports = router;