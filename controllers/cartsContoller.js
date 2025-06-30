// controllers/cartController.js
const Cart = require('../models/carts');
const Product = require('../models/Product'); // Assuming you have a Product model
const asyncHandler = require('express-async-handler'); // For error handling
const session = require('express-session');


// Helper to get or create a cart based on user or session
const getOrCreateCart = async (req) => {
    let cart;
    let newCartData = {};

    if (req.user) { // Authenticated user
        cart = await Cart.findOne({ userId: req.user });
        newCartData.userId = req.user;
    } else { // Anonymous user
        // req.session.id is automatically managed by express-session
        const sessionId = req.session.id;
        cart = await Cart.findOne({ sessionId: sessionId });
        newCartData.sessionId = sessionId;
    }

    if (!cart) {
        cart = new Cart(newCartData);
        try {
            await cart.save();
        } catch (error) {
            // Handle potential race condition if two requests try to create the same cart concurrently
            if (error.code === 11000) { // Duplicate key error (e.g., unique userId/sessionId constraint)
                console.warn('Race condition detected creating cart, retrying find...');
                // Retry finding the cart, as it might have been created by another concurrent request
                if (req.user) {
                    cart = await Cart.findOne({ userId: req.user });
                } else {
                    cart = await Cart.findOne({ sessionId: req.session.id });
                }
                if (!cart) {
                    // If still no cart, something went wrong, re-throw or handle appropriately
                    throw new Error('Failed to retrieve or create cart after race condition.');
                }
            } else {
                throw error; // Re-throw other errors
            }
        }
    }
    return cart;
};

// @desc    Get user/session cart
// @route   GET /api/cart
// @access  Public/Private (depending on implementation)
exports.getCart = asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req);
    res.status(200).json({ success: true, data: cart });
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Public/Private
exports.addItemToCart = asyncHandler(async (req, res) => {
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }
    if (product.stock < quantity) {
        res.status(400);
        throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
    }

    const cart = await getOrCreateCart(req);

    const existingItemIndex = cart.items.findIndex(item =>
        item.productId.toString() === productId
        // Add checks for product options here if applicable, e.g., item.size === size
    );

    if (existingItemIndex > -1) {
        // Item exists, update quantity
        const existingItem = cart.items[existingItemIndex];
        if (product.stock < (existingItem.quantity + quantity)) {
            res.status(400);
            throw new Error(`Adding ${quantity} exceeds stock. Max you can add: ${product.stock - existingItem.quantity}`);
        }
        existingItem.quantity += quantity;
    } else {
        // New item, add to cart
        cart.items.push({
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity: quantity,
            imageUrl: product.imageUrl,
            user: req.user,
            // Store image for display
        });
    }

    await cart.save(); // This will trigger pre-save hook for totalPrice
    res.status(200).json({ success: true, data: cart, sessionId: req.sessionId, user: req.user }); // Send session ID if newly generated
});

// @desc    Update item quantity in cart
// @route   PUT /api/cart/update/:productId
// @access  Public/Private
exports.updateCartItemQuantity = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (quantity < 0) {
        res.status(400);
        throw new Error('Quantity cannot be negative');
    }

    const cart = await getOrCreateCart(req);

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (itemIndex === -1) {
        res.status(404);
        throw new Error('Item not found in cart');
    }

    if (quantity === 0) {
        cart.items.splice(itemIndex, 1); // Remove item if quantity is 0
    } else {
        const product = await Product.findById(productId);
        if (!product) {
            res.status(404);
            throw new Error('Product not found in system (but was in cart)'); // Should not happen often
        }
        if (product.stock < quantity) {
            res.status(400);
            throw new Error(`Cannot set quantity to ${quantity}. Only ${product.stock} available.`);
        }
        cart.items[itemIndex].quantity = quantity;
    }

    await cart.save();
    res.status(200).json({ success: true, data: cart });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:productId
// @access  Public/Private
exports.removeCartItem = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    const cart = await getOrCreateCart(req);

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item.productId.toString() !== productId);

    if (cart.items.length === initialLength) {
        res.status(404);
        throw new Error('Item not found in cart');
    }

    await cart.save();
    res.status(200).json({ success: true, data: cart });
});

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Public/Private
exports.clearCart = asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req);
    cart.items = [];
    await cart.save();
    res.status(200).json({ success: true, data: cart });
});