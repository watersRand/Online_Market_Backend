// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');


// This middleware verifies the token on subsequent requests
const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // console.log(decoded)
            req.user = decoded.id; // Attach user ID from token to request

            next();
        } catch (error) {
            console.error('Token verification error:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};
// Updated authorize middleware to accept an array of required roles
// e.g., authorize(['admin']), authorize(['deliveryPerson']), authorize(['vendorAdmin'])
const authorize = (requiredRoles = []) => {
    return async (req, res, next) => {
        if (!req.user) {
            res.status(401); // Unauthorized (should have been caught by 'protect' already)
            throw new Error('Not authenticated, no user found');
        }
        const controll = await User.findById(req.user).populate('roles')
        let hasPermission = false;
        if (requiredRoles.length === 0) { // If no roles are specified, just needs to be authenticated
            hasPermission = true;
        } else {
            if (requiredRoles.includes('admin') && controll.roles == 'Admin') {
                hasPermission = true;
            }
            if (requiredRoles.includes('deliveryPerson') && controll.roles == 'Delivery') {
                hasPermission = true;
            }
            if (requiredRoles.includes('vendorAdmin') && controll.roles == 'Vendor') { // User has a vendor assigned (meaning they are a vendor admin)
                hasPermission = true;
            }
        }

        if (!hasPermission) {
            res.status(403); // Forbidden
            throw new Error('Not authorized to access this route');
        }

        next();
    };
};



module.exports = { protect, authorize };