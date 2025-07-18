// controllers/authController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');


// Helper to generate JWT token (for API responses or direct login)
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register new user
// @route   POST /register (for views) or /api/users/register (for API)
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, phoneNumber, roles, isDeliveryPerson } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400); // Bad request
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('User already exists'); // For API, throw error to be caught by errorHandler
        } else {
            // For view-based submission, use flash message and redirect back to register
            req.flash('error', 'Registration failed: User with this email already exists.');
            return res.redirect('/api/users/register'); // Redirect back to registration form
        }
    }

    // Ensure roles is a string and defaults to 'Customer' if not provided or invalid
    const userRole = roles && ['Vendor', 'Delivery', 'Customer', 'Admin'].includes(roles) ? roles : 'Customer';

    const user = await User.create({
        name,
        email,
        password,
        phoneNumber,
        roles: userRole, // Use the determined single role string
        isDeliveryPerson: isDeliveryPerson || false // Default to false if not provided
    });


    if (user) {


        req.flash('success', 'Registration successful! Please log in with your new account.');
        res.redirect('/api/users/login');

    } else {
        res.status(400);
        req.flash('error', 'Registration failed: Invalid user data provided.');
        res.redirect('/api/users/register'); // Redirect back to registration form
    }
});

// @desc    Authenticate user & get token
// @route   POST /login (for views) or /api/users/login (for API)
// @access  Public
const authUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        // Set JWT token as an HTTP-only cookie
        res.cookie('jwt', generateToken(user._id), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: 'strict', // Adjust as needed: 'strict', 'lax', 'none'
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        req.flash('success', `Welcome back, ${user.name}!`);
        res.redirect('/'); // Redirect to dashboard or another appropriate page

    } else {
        res.status(401);
        req.flash('error', 'Login failed: Invalid email or password.');
        res.redirect('/api/users/login'); // Redirect back to login form
    }
});

// @desc    Get user profile
// @route   GET /profile (for views) or /api/users/profile (for API)
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    // req.user.id is populated by 'protect' middleware
    const user = await User.findById(req.user.id);

    if (user) {
        res.render('users/profile', { title: 'My Profile', user: req.user, userProfile: user });
    } else {
        res.status(404);

        req.flash('error', 'User profile not found.');
        res.redirect('/api/users/login'); // Or redirect to login

    }
});

// @desc    Delete user profile
// @route   DELETE /profile (for views) or /api/users/:id (for API)
// @access  Private/Admin
const deleteUserProfile = asyncHandler(async (req, res) => {
    const userIdToDelete = req.params.id || req.user.id;

    const userToDelete = await User.findById(userIdToDelete);

    if (!userToDelete) {
        res.status(404);
        req.flash('error', 'User to delete not found.');
        return res.redirect('/api/users/login'); // Or wherever appropriate
    }

    // Authorization: Only the user themselves or an admin can delete the profile
    if (userToDelete._id.toString() !== req.user.id.toString() && req.user.roles !== 'Admin') {
        res.status(403);
        req.flash('error', 'You are not authorized to delete this user.');
        return res.redirect('/admin/users'); // Or wherever appropriate
    }

    // Important: Disassociate vendor if this user was a vendor owner
    if (userToDelete.roles === 'Vendor' && userToDelete.vendor) {
        const Vendor = require('../models/vendor'); // Import Vendor model here to avoid circular dependency
        await Vendor.findOneAndUpdate({ owner: userToDelete._id }, { $unset: { owner: 1 } });
    }

    await User.deleteOne({ _id: userIdToDelete });



    req.flash('success', 'User removed successfully.');
    if (req.user.id.toString() === userIdToDelete.toString()) {
        // If self-deletion, clear cookie and redirect to login
        res.clearCookie('jwt'); // Assuming JWT cookie is named 'jwt'
        if (req.session) {
            req.session.destroy();
        }
        res.redirect('/api/users/login');
    } else {
        // If admin deleted another user, redirect to user list
        res.redirect('/admin/users');
    }
});

// @desc    Update a single user profile (by logged-in user or admin)
// @route   PUT /profile (for views) or /api/users/:id (for API)
// @access  Private/Admin
const updateUserById = asyncHandler(async (req, res) => {
    const userIdToUpdate = req.params.id || req.user.id;

    const { name, email, phoneNumber, roles, isDeliveryPerson } = req.body;

    let user = await User.findById(userIdToUpdate);

    if (!user) {
        res.status(404);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('User not found');
        } else {
            req.flash('error', 'User not found for update.');
            return res.redirect('/admin/users'); // Or back to profile
        }
    }

    // Authorization: Only the user themselves or an admin can update
    if (user._id.toString() !== req.user.id.toString() && req.user.roles !== 'Admin') {
        res.status(403);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Not authorized to update this user profile.');
        } else {
            req.flash('error', 'You are not authorized to update this user.');
            return res.redirect('/api/users/profile'); // Or back to admin list
        }
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.phoneNumber = phoneNumber || user.phoneNumber;

    // Only admins can update roles and isDeliveryPerson
    if (req.user.roles === 'Admin') {
        if (roles && ['Vendor', 'Delivery', 'Customer', 'Admin'].includes(roles)) {
            user.roles = roles;
        }
        if (typeof isDeliveryPerson === 'boolean') {
            user.isDeliveryPerson = isDeliveryPerson;
        }
    }

    const updatedUser = await user.save();



    req.flash('success', 'Profile updated successfully!');
    // Redirect based on who updated it
    if (req.user.id.toString() === userIdToUpdate.toString()) {
        res.redirect('/api/users/profile'); // Redirect to own profile
    } else {
        res.redirect('/admin/users'); // Redirect to admin user list
    }
});

// @desc    Logout user
// @route   GET /logout (for views) or /api/users/logout (for API)
// @access  Private
const logoutUser = asyncHandler(async (req, res) => {

    res.cookie('jwt', '', { // Clear the 'jwt' cookie
        httpOnly: true,
        expires: new Date(0), // Set expiry to past date
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', // Or 'lax'
    });

    req.flash('success', 'You have been logged out.');
    res.redirect('/api/users/login'); // Redirect to login page after logout
});


module.exports = { registerUser, authUser, getUserProfile, deleteUserProfile, updateUserById, logoutUser };