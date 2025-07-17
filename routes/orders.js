const express = require('express');
const router = express.Router();
const { getCart, addItemToCart, updateCartItemQuantity, removeCartItem, clearCart } = require('../controllers/cartsContoller');
const { protect } = require('../middleware/authMiddleware');
const Cart = require('../models/carts'); // Your Cart/Order model

// Render cart page
router.get('/cart', async (req, res) => {
    // Simulate fetching cart based on user or session
    let cart = { items: [], totalPrice: 0 };
    if (req.user) {
        cart = await Cart.findOne({ userId: req.user._id });
    } else if (req.session && req.session.id) {
        cart = await Cart.findOne({ sessionId: req.session.id });
    }
    cart = cart || { items: [], totalPrice: 0 }; // Ensure cart is not null

    res.render('cart', { title: 'Your Cart', cart, user: req.user });
});

// Handle adding item to cart
router.post('/cart/add', addItemToCart);

// Handle updating item quantity
router.put('/cart/update/:productId', updateCartItemQuantity); // This assumes method-override

// Handle removing item
router.delete('/cart/remove/:productId', removeCartItem); // This assumes method-override

// Handle clearing cart
router.delete('/cart/clear', clearCart); // This assumes method-override

// Render checkout page
router.get('/checkout', async (req, res) => {
    // Simulate fetching cart for checkout
    let cart = { items: [], totalPrice: 0 };
    if (req.user) {
        cart = await Cart.findOne({ userId: req.user._id });
    } else if (req.session && req.session.id) {
        cart = await Cart.findOne({ sessionId: req.session.id });
    }
    cart = cart || { items: [], totalPrice: 0 };

    res.render('checkout', { title: 'Checkout', cart, user: req.user });
});

// Handle placing order (this would be in an orderController, but for simplicity, linking here)
router.post('/orders', async (req, res) => {
    // This is a placeholder for your order creation logic
    // In a real app, you'd move this to an orderController
    console.log('Order placed simulation:', req.body);
    // After placing order, you'd clear the cart and redirect
    res.redirect('/order-confirmation'); // Redirect to a confirmation page
});

router.get('/order-confirmation', (req, res) => {
    res.render('order_confirmation', { title: 'Order Confirmation', message: 'Your order has been placed successfully!' });
});


module.exports = router;