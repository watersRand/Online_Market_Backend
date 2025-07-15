// controllers/cartController.js
const Cart = require('../models/carts');
const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');
// const session = require('express-session'); // session is already handled by middleware in server.js
const { invalidateCache } = require('./cacheController'); // Correct path
const { getIo } = require('../config/socket'); // Import the getIo function

// Helper to get or create a cart based on user or session
const getOrCreateCart = async (req) => {
    let cart;
    let query = {};

    if (req.user) { // Authenticated user
        query.userId = req.user._id; // Assuming req.user is the user object/ID
    } else { // Anonymous user
        const sessionId = req.session.id; // req.session.id is automatically managed by express-session
        if (!sessionId) {
            // This case should ideally be caught by session middleware, but good to have a fallback
            throw new Error('Session ID not found. Ensure session middleware is configured correctly.');
        }
        query.sessionId = sessionId;
    }

    cart = await Cart.findOne(query);

    if (!cart) {
        // If cart doesn't exist, create it with the appropriate identifier
        cart = new Cart(query); // query already contains userId or sessionId
        try {
            await cart.save();
            // Invalidate relevant cache keys after creating a new cart
            // Note: req.params.id might not be available here, focus on broader cache invalidation
            await invalidateCache([
                'carts:/api/cart', // For the current user/session cart view
                'carts:/api/carts*' // For any aggregated cart lists (if they exist)
            ]);
            console.log(`New cart created for ${req.user ? 'user ' + req.user._id : 'session ' + query.sessionId}`);
        } catch (error) {
            // Handle potential race condition for unique userId/sessionId constraints
            if (error.code === 11000) { // Duplicate key error
                console.warn('Race condition detected creating cart, retrying find...');
                // Retry finding the cart if it was created by a concurrent request
                cart = await Cart.findOne(query);
                if (!cart) {
                    // If still no cart after retry, something is genuinely wrong
                    throw new Error('Failed to retrieve or create cart after race condition.');
                }
            } else {
                // Re-throw other errors
                throw error;
            }
        }
    }
    return cart;
};

// Helper function to emit cart updates via Socket.IO
const emitCartUpdate = (cart, io) => {
    if (!io) return;

    // Emit to specific user if authenticated
    if (cart.userId) {
        io.to(`user:${cart.userId.toString()}`).emit('cartUpdated', {
            cartId: cart._id,
            items: cart.items,
            totalPrice: cart.totalPrice,
            message: 'Your cart has been updated.'
        });
    }
    // Emit to specific session if anonymous (for multi-tab sync, less critical for cross-device)
    else if (cart.sessionId) {
        // You'd need a way to map sessionId to a Socket.IO room, often done on client connect
        // For simplicity, we might not emit to session ID directly unless the client joins a specific room on connect
        // based on their session ID. This part often needs careful client-side implementation.
        // For now, let's focus on authenticated users or broader notifications.
        // If frontend subscribes to a room like `session:${sessionId}`, then uncomment below:
        // io.to(`session:${cart.sessionId}`).emit('cartUpdated', { ... });
    }

    // Optionally, emit a general cart activity update to admin dashboard
    io.to('admin_dashboard').emit('adminCartActivity', {
        cartId: cart._id,
        userId: cart.userId ? cart.userId.toString() : 'anonymous',
        action: 'cart_modified',
        timestamp: new Date()
    });
};

// @desc    Get user/session cart
// @route   GET /api/cart
// @access  Public/Private (depending on authentication)
exports.getCart = asyncHandler(async (req, res) => {
    const cart = await getOrCreateCart(req);
    // No cache invalidation needed for GET, but response can be cached
    // Cache key for this specific cart should ideally be handled by a caching middleware
    res.status(200).json({ success: true, data: cart });
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Public/Private
exports.addItemToCart = asyncHandler(async (req, res) => {
    const { productId, quantity = 1 } = req.body;

    // 1. Validate Product Existence
    const product = await Product.findById(productId);
    if (!product) {
        res.status(404);
        throw new Error('Product not found.');
    }

    // 2. Get or Create Cart
    const cart = await getOrCreateCart(req);

    // 3. Check for existing item and stock
    const existingItemIndex = cart.items.findIndex(item =>
        item.productId.toString() === productId
        // Add checks for product options (color, size, etc.) here if applicable
        // e.g., && item.color === color && item.size === size
    );

    let newQuantity = quantity;
    if (existingItemIndex > -1) {
        // Item exists, update quantity
        const existingItem = cart.items[existingItemIndex];
        newQuantity = existingItem.quantity + quantity;
        if (product.stock < newQuantity) {
            res.status(400);
            throw new Error(`Adding ${quantity} exceeds stock. Max you can add: ${product.stock - existingItem.quantity}. Available: ${product.stock}`);
        }
        existingItem.quantity = newQuantity;
    } else {
        // New item, add to cart
        if (product.stock < quantity) {
            res.status(400);
            throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock}`);
        }
        cart.items.push({
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity: quantity,
            imageUrl: product.imageUrl, // Storing image for display purposes
            // Add other product attributes if needed (e.g., color, size)
        });
    }

    // 4. Save Cart
    await cart.save(); // This will trigger pre-save hook for totalPrice calculation

    // 5. Invalidate Caches
    await invalidateCache([
        `carts:/api/cart/${cart._id}`, // Specific cart by ID (if you have such an endpoint)
        `carts:/api/cart?${req.user ? `userId=${req.user._id}` : `sessionId=${req.session.id}`}`, // User/session specific cart
        'carts:/api/carts*' // All carts list (if exists)
    ]);

    // 6. Emit Socket.IO Update
    const io = getIo();
    emitCartUpdate(cart, io);

    // 7. Send Response
    res.status(200).json({ success: true, data: cart });
});

// @desc    Update item quantity in cart
// @route   PUT /api/cart/update/:productId
// @access  Public/Private
exports.updateCartItemQuantity = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body; // Target quantity after update

    if (quantity < 0) {
        res.status(400);
        throw new Error('Quantity cannot be negative.');
    }

    // 1. Get or Create Cart
    const cart = await getOrCreateCart(req);

    // 2. Find Item in Cart
    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (itemIndex === -1) {
        res.status(404);
        throw new Error('Item not found in cart.');
    }

    // 3. Handle Quantity = 0 (Remove Item)
    if (quantity === 0) {
        cart.items.splice(itemIndex, 1); // Remove item
    } else {
        // 4. Validate Stock for New Quantity
        const product = await Product.findById(productId);
        if (!product) {
            res.status(404);
            throw new Error('Product not found in system (item was in cart, but product disappeared).');
        }
        if (product.stock < quantity) {
            res.status(400);
            throw new Error(`Cannot set quantity to ${quantity}. Only ${product.stock} available for ${product.name}.`);
        }
        cart.items[itemIndex].quantity = quantity;
    }

    // 5. Save Cart
    await cart.save();

    // 6. Invalidate Caches
    await invalidateCache([
        `carts:/api/cart/${cart._id}`, // Specific cart by ID
        `carts:/api/cart?${req.user ? `userId=${req.user._id}` : `sessionId=${req.session.id}`}`, // User/session specific cart
        'carts:/api/carts*' // All carts list
    ]);

    // 7. Emit Socket.IO Update
    const io = getIo();
    emitCartUpdate(cart, io);

    // 8. Send Response
    res.status(200).json({ success: true, data: cart });
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove/:productId
// @access  Public/Private
exports.removeCartItem = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    // 1. Get or Create Cart
    const cart = await getOrCreateCart(req);

    // 2. Filter out the item
    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item.productId.toString() !== productId);

    if (cart.items.length === initialLength) {
        res.status(404);
        throw new Error('Item not found in cart.');
    }

    // 3. Save Cart
    await cart.save();

    // 4. Invalidate Caches
    await invalidateCache([
        `carts:/api/cart/${cart._id}`,
        `carts:/api/cart?${req.user ? `userId=${req.user._id}` : `sessionId=${req.session.id}`}`,
        'carts:/api/carts*'
    ]);

    // 5. Emit Socket.IO Update
    const io = getIo();
    emitCartUpdate(cart, io);

    // 6. Send Response
    res.status(200).json({ success: true, data: cart });
});

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Public/Private
exports.clearCart = asyncHandler(async (req, res) => {
    // 1. Get or Create Cart
    const cart = await getOrCreateCart(req);

    // 2. Clear items
    cart.items = [];

    // 3. Save Cart
    await cart.save();

    // 4. Invalidate Caches
    await invalidateCache([
        `carts:/api/cart/${cart._id}`,
        `carts:/api/cart?${req.user ? `userId=${req.user._id}` : `sessionId=${req.session.id}`}`,
        'carts:/api/carts*'
    ]);

    // 5. Emit Socket.IO Update
    const io = getIo();
    emitCartUpdate(cart, io);

    // 6. Send Response
    res.status(200).json({ success: true, data: cart });
});