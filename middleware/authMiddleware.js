// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');


const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check if token exists in cookies
    if (req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user to the request object (without password)
        req.user = await User.findById(decoded.id).select('-password');

        next();
    } catch (error) {
        console.error(error);
        res.status(401);
        throw new Error('Not authorized, token failed');
    }
});

//Updated authorize middleware to accept an array of required roles
// e.g., authorize(['admin']), authorize(['deliveryPerson']), authorize(['admin', 'deliveryPerson'])
const authorize = (requiredRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401); // Unauthorized (should have been caught by 'protect' already)
            throw new Error('Not authenticated, no user found');
        }

        let hasPermission = false;
        if (requiredRoles.length === 0) { // If no roles are specified, just needs to be authenticated
            hasPermission = true;
        } else {
            if (requiredRoles.includes('admin') && req.user.isAdmin) {
                hasPermission = true;
            }
            if (requiredRoles.includes('deliveryPerson') && req.user.isDeliveryPerson) {
                hasPermission = true;
            }
            // Add more role checks here if you introduce other boolean roles
        }

        if (!hasPermission) {
            res.status(403); // Forbidden
            throw new Error('Not authorized to access this route');
        }

        next();
    };
};


module.exports = { protect, authorize };