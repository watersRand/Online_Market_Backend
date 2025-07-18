// controllers/cartController.js
const Cart = require('../models/carts');
const Product = require('../models/Product');
const asyncHandler = require('express-async-handler');


// Helper to get or create a cart based on user or session (with merging)
const getOrCreateCart = async (req) => {
    let cart;
    let userCart = null;
    let sessionCart = null;
    // REMOVED: const io = getIo(); // Socket.IO instance for potential notifications

    console.log('\n--- DEBUG: getOrCreateCart START ---');
    console.log('req.user (ID):', req.user ? req.user._id : 'Not authenticated');
    console.log('req.session.id:', req.session ? req.session.id : 'No session');

    // 1. Try to find a cart for the authenticated user
    if (req.user && req.user._id) {
        userCart = await Cart.findOne({ userId: req.user._id });
        console.log('User Cart found:', userCart ? userCart._id : 'None');
    }

    // 2. Try to find a cart for the current session
    const sessionId = req.session.id;
    if (sessionId) {
        sessionCart = await Cart.findOne({ sessionId: sessionId });
        console.log('Session Cart found:', sessionCart ? sessionCart._id : 'None');
    }

    // 3. Handle merging scenarios
    if (userCart && sessionCart) {
        // Scenario A: Both user cart and session cart exist
        // Merge session cart items into user cart, then delete session cart
        console.log('Merging session cart into user cart...');
        userCart.items = userCart.items.concat(sessionCart.items);
        // Deduplicate items if necessary (e.g., same product added twice)
        const itemMap = new Map();
        userCart.items.forEach(item => {
            const key = item.productId.toString();
            if (itemMap.has(key)) {
                itemMap.get(key).quantity += item.quantity;
            } else {
                itemMap.set(key, item);
            }
        });
        userCart.items = Array.from(itemMap.values());

        await userCart.save();
        await Cart.deleteOne({ _id: sessionCart._id }); // Delete the old session cart

        console.log('Session cart merged and deleted. User cart updated.');

        cart = userCart;

    } else if (userCart) {
        // Scenario B: Only user cart exists (user is logged in, no anonymous cart or it was already merged)
        console.log('Using existing user cart.');
        cart = userCart;

    } else if (sessionCart) {
        // Scenario C: Only session cart exists (anonymous user, or logged-in user with no previous user cart)
        // Assign userId to this cart if the user is now logged in
        console.log('Using existing session cart.');
        if (req.user && req.user._id) {
            sessionCart.userId = req.user._id;
            sessionCart.sessionId = undefined; // Remove sessionId as it's now a user cart
            await sessionCart.save();

            console.log('Session cart converted to user cart.');

        }
        cart = sessionCart;

    } else {
        // Scenario D: No cart exists at all, create a new one
        console.log('No existing cart found, creating a new one.');
        const newCartData = {};
        if (req.user && req.user._id) {
            newCartData.userId = req.user._id;
        } else {
            if (!sessionId) {
                console.error('ERROR: Session ID not found when trying to create new anonymous cart.');
                throw new Error('Session ID not found. Ensure session middleware is configured correctly.');
            }
            newCartData.sessionId = sessionId;
        }
        cart = new Cart(newCartData);

        try {
            await cart.save();

            console.log(`New cart created successfully! ID: ${cart._id}, for ${req.user ? 'user ' + req.user._id : 'session ' + newCartData.sessionId}`);
        } catch (error) {
            if (error.code === 11000) {
                console.warn('Race condition detected creating cart, retrying find...');
                if (req.user && req.user._id) {
                    cart = await Cart.findOne({ userId: req.user._id });
                } else {
                    cart = await Cart.findOne({ sessionId: sessionId });
                }
                if (!cart) {
                    console.error('ERROR: Failed to retrieve or create cart after race condition retry.');
                    throw new Error('Failed to retrieve or create cart after race condition.');
                }
                console.log('Cart found after race condition retry:', cart._id);
            } else {
                console.error('ERROR: Error saving new cart:', error);
                throw error;
            }
        }
    }
    console.log('--- DEBUG: getOrCreateCart END. Returning cart ID:', cart._id, '---');
    return cart;
};



// @desc    Get user/session cart
// @route   GET /cart (for views) or /api/cart (for API - but will render EJS)
// @access  Public/Private (depending on authentication)
exports.getCart = asyncHandler(async (req, res) => {
    console.log('\n--- DEBUG: getCart Controller START ---');
    const cart = await getOrCreateCart(req);

    // This populate is needed for cart-view-ejs to display product details
    await cart.populate({
        path: 'items.productId',
        select: 'name price imageUrl countInStock'
    });
    console.log('DEBUG: Cart after populate:', JSON.stringify(cart.toObject(), null, 2)); // Log populated cart

    res.render('shoppingcart', {
        title: 'Your Shopping Cart',
        cart: cart,
        user: req.user
    });
    console.log('--- DEBUG: getCart Controller END ---');
});

// @desc    Add item to cart
// @route   POST /cart/add (for views) or /api/cart/add (for API)
// @access  Public/Private
exports.addItemToCart = asyncHandler(async (req, res) => {
    const { productId, quantity = 1 } = req.body; // quantity here is the amount being added

    console.log('\n--- DEBUG: addItemToCart Controller START ---');
    console.log('Request Body:', req.body);

    const product = await Product.findById(productId);
    if (!product) {
        res.status(404);

        req.flash('error', 'Product not found. Cannot add to cart.');
        return res.redirect('/api/products/products');

    }

    const cart = await getOrCreateCart(req);
    console.log('Cart retrieved/created for addItemToCart. ID:', cart._id);

    const existingItemIndex = cart.items.findIndex(item =>
        item.productId.toString() === productId
    );

    let newQuantity = quantity; // newQuantity is initialized with the ADDED quantity
    if (existingItemIndex > -1) {
        const existingItem = cart.items[existingItemIndex];
        newQuantity = existingItem.quantity + quantity; // newQuantity becomes the TOTAL desired quantity in cart

        // --- AGGRESSIVE DEBUGGING LOGS ---
        console.log('\n--- DEBUG: addItemToCart Stock Check ---');
        console.log('Product ID:', productId);
        console.log('Product Name:', product.name);
        console.log('Product countInStock:', product.countInStock);
        console.log('Existing item quantity in cart:', existingItem.quantity);
        console.log('Quantity being added (req.body.quantity):', quantity);
        console.log('Calculated new TOTAL quantity in cart (existing + added):', newQuantity);
        console.log('Condition: product.countInStock < newQuantity ->', product.countInStock < newQuantity);
        console.log('--------------------------------------\n');
        // --- END AGGRESSIVE DEBUGGING LOGS ---

        if (product.countInStock < newQuantity) { // This is line 122
            res.status(400);
            const remainingStock = product.countInStock - existingItem.quantity;
            const errorMessage = `Cannot add ${quantity} units. Total cart quantity (${newQuantity}) would exceed available stock (${product.countInStock}). You can add up to ${remainingStock} more units.`;

            req.flash('error', errorMessage);
            return res.redirect('/api/orders/cart');

        }
        existingItem.quantity = newQuantity;
    } else {
        if (product.countInStock < quantity) {
            res.status(400);

            req.flash('error', `Not enough stock for "${product.name}". Available: ${product.countInStock}.`);
            return res.redirect('/api/products/products');

        }
        cart.items.push({
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity: quantity,
            imageUrl: product.imageUrl,
        });
    }

    await cart.save();
    console.log('Cart saved after addItemToCart. Cart ID:', cart._id);



    req.flash('success', `"${product.name}" added to cart!`);
    res.redirect('/api/orders/cart');

    console.log('--- DEBUG: addItemToCart Controller END ---');
});

// @desc    Update item quantity in cart
// @route   PUT /cart/update/:productId (for views) or /api/cart/update/:productId (for API)
// @access  Public/Private
exports.updateCartItemQuantity = asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body; // quantity here is the TARGET quantity

    console.log('\n--- DEBUG: updateCartItemQuantity Controller START ---');
    console.log('Request Params:', req.params, 'Request Body:', req.body);

    if (quantity < 0) {
        res.status(400);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Quantity cannot be negative.');
        } else {
            req.flash('error', 'Quantity cannot be negative.');
            return res.redirect('/cart');
        }
    }

    const cart = await getOrCreateCart(req);
    console.log('Cart retrieved/created for updateCartItemQuantity. ID:', cart._id);

    const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (itemIndex === -1) {
        res.status(404);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Item not found in cart.');
        } else {
            req.flash('error', 'Item not found in cart.');
            return res.redirect('/cart');
        }
    }

    if (quantity === 0) {
        cart.items.splice(itemIndex, 1);
        console.log('DEBUG: Item quantity set to 0, removing item from cart.');
    } else {
        const product = await Product.findById(productId);
        if (!product) {
            res.status(404);

            req.flash('error', 'Product associated with cart item not found.');
            return res.redirect('/api/orders/cart');

        }
        // Validate stock for the TARGET quantity
        console.log('DEBUG: Product stock:', product.countInStock, 'Target quantity:', quantity);
        if (product.countInStock < quantity) {
            res.status(400);
            const errorMessage = `Cannot set quantity to ${quantity}. Only ${product.countInStock} available for ${product.name}.`;

            req.flash('error', errorMessage);
            return res.redirect('/api/orders/cart');
        }

        cart.items[itemIndex].quantity = quantity;
    }

    console.log('DEBUG: Cart items before save:', JSON.stringify(cart.items.toObject(), null, 2));
    await cart.save();
    console.log('DEBUG: Cart saved successfully after updateCartItemQuantity. Cart ID:', cart._id);



    req.flash('success', 'Cart item quantity updated.');
    res.redirect('/api/orders/cart');

    console.log('--- DEBUG: updateCartItemQuantity Controller END ---');
});

// @desc    Remove item from cart
// @route   DELETE /cart/remove/:productId (for views) or /api/cart/remove/:productId (for API)
// @access  Public/Private
exports.removeCartItem = asyncHandler(async (req, res) => {
    const { productId } = req.params;

    console.log('\n--- DEBUG: removeCartItem Controller START ---');
    console.log('Request Params:', req.params);

    const cart = await getOrCreateCart(req);
    console.log('Cart retrieved/created for removeCartItem. ID:', cart._id);

    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item.productId.toString() !== productId);

    if (cart.items.length === initialLength) {
        res.status(404);

        req.flash('error', 'Item not found in cart.');
        return res.redirect('/api/orders/cart');
    }


    console.log('DEBUG: Cart items before save (after filter):', JSON.stringify(cart.items.toObject(), null, 2));
    await cart.save();
    console.log('DEBUG: Cart saved successfully after removeCartItem. Cart ID:', cart._id);



    req.flash('success', 'Item removed from cart.');
    res.redirect('/api/orders/cart');

    console.log('--- DEBUG: removeCartItem Controller END ---');
});

// @desc    Clear cart
// @route   POST /cart/clear (for views) or /api/cart/clear (for API)
// @access  Public/Private
exports.clearCart = asyncHandler(async (req, res) => {
    console.log('\n--- DEBUG: clearCart Controller START ---');
    const cart = await getOrCreateCart(req);
    console.log('Cart retrieved/created for clearCart. ID:', cart._id);

    if (cart.items.length === 0) {

        req.flash('info', 'Your cart is already empty.');
        return res.redirect('/api/orders/cart');

    }

    cart.items = [];

    console.log('DEBUG: Cart items before save (after clear):', JSON.stringify(cart.items.toObject(), null, 2));
    await cart.save();
    console.log('DEBUG: Cart saved successfully after clearCart. Cart ID:', cart._id);



    // REMOVED: const io = getIo();
    // REMOVED: emitCartUpdate(cart, io);


    req.flash('success', 'Your cart has been cleared.');
    res.redirect('/api/orders/cart');

    console.log('--- DEBUG: clearCart Controller END ---');
});