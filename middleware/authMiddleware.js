// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    // 1. Check for token in Authorization header (for API requests)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('Token found in Authorization header.');
        } catch (error) {
            console.error('Error parsing token from header:', error);
            res.status(401);
            throw new Error('Not authorized, token format invalid');
        }
    }

    // 2. If no token in header, check for token in cookies (for web app requests)
    if (!token && req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
        console.log('Token found in JWT cookie.');
    }

    // 3. If a token was found (either in header or cookie)
    if (token) {
        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('JWT Decoded:', decoded);



            // If User schema's 'roles' is a String enum (as per our previous discussion):
            req.user = await User.findById(decoded.id).select('-password').populate('vendor'); // Only populate vendor if it's a ref

            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found');
            }

            console.log('User attached to req:', req.user.email, 'Roles:', req.user.roles);
            next(); // Proceed to the next middleware/route handler
        } catch (error) {
            console.error('Token verification failed:', error.message);
            // Clear invalid token cookie if it exists
            if (req.cookies && req.cookies.jwt) {
                res.clearCookie('jwt');
            }
            res.status(401);
            throw new Error('Not authorized, token failed or expired');
        }
    } else {
        // If no token was found in headers or cookies
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});


// Updated authorize middleware to accept an array of required roles
const authorize = (requiredRoles = []) => {
    return async (req, res, next) => {
        if (!req.user) {
            res.status(401);
            throw new Error('Not authenticated, no user found');
        }

        const userRole = req.user.roles; // This will be a string like 'Admin', 'Vendor', etc.

        let hasPermission = false;
        if (requiredRoles.length === 0) {
            hasPermission = true;
        } else {
            // Check if the user's single role matches any of the required roles
            hasPermission = requiredRoles.includes(userRole); // Direct string comparison
        }

        if (!hasPermission) {
            res.status(403);
            throw new Error('Not authorized to access this route');
        }

        next();
    };
};
// Middleware to populate req.user.vendor if user is a vendor admin
const populateVendor = async (req, res, next) => {
    // This check now relies on req.user having the 'vendor' role and the vendor field itself
    // req.user.roles should now be populated correctly as an array of objects
    if (req.user && req.user.roles.some(role => role.name === 'Vendor') && req.user.vendor) {
        // Since populate('vendor') is already done in 'protect', this might not be strictly necessary
        // unless you need to refresh the vendor data or if 'protect' doesn't always populate it.
        // For simplicity, if protect populates it, you might not need this line:
        // const fullUser = await User.findById(req.user._id).populate('vendor');
        // if (fullUser) {
        //     req.user.vendor = fullUser.vendor;
        // }
    }
    next();
};
module.exports = { protect, authorize, populateVendor };