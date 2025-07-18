const express = require('express');
const router = express.Router();
const { getCart, addItemToCart, updateCartItemQuantity, removeCartItem, clearCart } = require('../controllers/cartsContoller');
const { protect } = require('../middleware/authMiddleware');
const Cart = require('../models/carts'); // Your Cart/Order model

// Render cart page
router.get('/cart', protect, getCart)


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
    res.redirect('/api/orders/order-confirm'); // Redirect to a confirmation page
});

router.get('/orders-confirm/:id', protect, async (req, res) => {
    const orderId = req.params.id;

    try {
        const order = await Order.findById(orderId)
            .populate('user', 'name email') // Populate the user who placed the order
            .populate('items.productId', 'name price imageUrl'); // Populate product details within items

        if (!order) {
            req.flash('error', 'Order not found.');
            return res.status(404).redirect('/orders'); // Redirect to general orders list
        }

        // Authorization check: Ensure the order belongs to the logged-in user or the user is an Admin
        if (order.user._id.toString() !== req.user._id.toString() && req.user.roles !== 'Admin') {
            req.flash('error', 'You are not authorized to view this order.');
            return res.status(403).redirect('/orders'); // Redirect to general orders list
        }

        res.render('order_confirmation', {
            title: 'Order Confirmation',
            message: 'Your order has been placed successfully!', // This message can be dynamic or static
            order: order, // Pass the fetched and populated order object
            user: req.user // Pass user for header/layout
        });

    } catch (error) {
        console.error('Error fetching order for confirmation:', error);
        // If it's a CastError (invalid ID format), redirect more gracefully
        if (error.name === 'CastError') {
            req.flash('error', 'Invalid Order ID format.');
            return res.status(400).redirect('/orders');
        }
        req.flash('error', 'Failed to load order confirmation. Please try again.');
        res.status(500).redirect('/orders'); // Redirect to orders list on server error
    }
});

module.exports = router;