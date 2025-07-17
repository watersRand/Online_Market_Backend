// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');


const protect = async (req, res, next) => { // Make it async
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch the full user object including roles and vendor (if applicable)
            req.user = await User.findById(decoded.id).populate('roles').populate('vendor');

            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found');
            }

            next();
        } catch (error) {
            console.error('Token verification error:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else { // Handle case where no token is provided in headers
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};


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