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
    // console.log('Inside populateVendor. req.user:', req.user); // Debugging
    // console.log('req.user.roles type:', typeof req.user.roles); // Debugging
    // console.log('req.user.roles value:', req.user.roles); // Debugging

    // Ensure req.user exists and has an _id
    if (req.user && req.user._id) {
        // Fetch the full user object including populated vendor.
        // This ensures req.user.vendor is a full object, not just an ID.
        const fullUser = await User.findById(req.user._id).populate('vendor');

        if (fullUser) {
            // Overwrite req.user with the fully populated user object
            req.user = fullUser;

            // Now, check if the user has the 'Vendor' role (assuming roles is a string or array of strings)
            // AND if a vendor is associated and populated.
            // If req.user.roles is a string, check directly. If it's an array, use .includes().
            const userHasVendorRole = Array.isArray(req.user.roles)
                ? req.user.roles.includes('vendor')
                : req.user.roles === 'vendor';

            if (userHasVendorRole && req.user.vendor) {
                // console.log('populateVendor: User is a Vendor with populated vendor:', req.user.vendor.name); // Debugging
            }
        }
    }
    next();
};
module.exports = { protect, authorize, populateVendor };