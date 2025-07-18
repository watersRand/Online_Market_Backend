// controllers/authController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const { invalidateCache } = require('../controllers/cacheController');
const { getIo } = require('../config/socket'); // Import getIo to access Socket.IO

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
            return res.redirect('/register'); // Redirect back to registration form
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
    await invalidateCache('auth:/api/auth*');

    if (user) {
        const io = getIo(); // Get the Socket.IO instance
        if (io) {
            // Notify admin dashboard about new user registration
            io.to('admin_dashboard').emit('newUserRegistered', {
                userId: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                message: `New user "${user.name}" (${user.email}) has registered.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'newUserRegistered' for admin dashboard.`);

            io.to(`user:${user._id.toString()}`).emit('welcomeMessage', {
                message: `Welcome, ${user.name}! Your account has been successfully created.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'welcomeMessage' to new user: ${user._id}`);
        }

        // --- IMPORTANT: Conditional Redirection/JSON Response ---
        if (req.originalUrl.startsWith('/api/')) {
            // For API requests, send JSON response with token
            res.status(201).json({
                _id: user._id,
                name: user.name,
                email: user.email,
                token: generateToken(user._id), // Generate token for API response
                roles: user.roles, // Include roles in API response
            });
        } else {
            // For view-based submission, redirect to login page with a success message
            req.flash('success', 'Registration successful! Please log in with your new account.');
            res.redirect('/login');
        }

    } else {
        res.status(400);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Invalid user data'); // For API, throw error
        } else {
            req.flash('error', 'Registration failed: Invalid user data provided.');
            res.redirect('/api/users/register'); // Redirect back to registration form
        }
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
            secure: false, // Use secure cookies in production
            sameSite: 'strict', // Adjust as needed: 'strict', 'lax', 'none'
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        req.flash('success', `Welcome back, ${user.name}!`);
        res.redirect('/'); // Redirect to dashboard or another appropriate page

        if (req.originalUrl.startsWith('/api/')) {
            // For API requests, send JSON response
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                roles: user.roles,
                isDeliveryPerson: user.isDeliveryPerson,
                vendor: user.vendor,
                message: 'Login successful!',
            });
        } else {
            // For view-based submission, redirect to dashboard or home page
            req.flash('success', `Welcome back, ${user.name}!`);
            res.redirect('/'); // Redirect to dashboard or another appropriate page
        }

    } else {
        res.status(401);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Invalid email or password'); // For API, throw error
        } else {
            req.flash('error', 'Login failed: Invalid email or password.');
            res.redirect('/login'); // Redirect back to login form
        }
    }
});

// @desc    Get user profile
// @route   GET /profile (for views) or /api/users/profile (for API)
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
    // req.user.id is populated by 'protect' middleware
    const user = await User.findById(req.user.id);

    if (user) {
        if (req.originalUrl.startsWith('/api/')) {
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                roles: user.roles,
                isDeliveryPerson: user.isDeliveryPerson,
                vendor: user.vendor
            });
        } else {
            // For view-based request, render the profile page
            res.render('users/profile', { title: 'My Profile', user: req.user, userProfile: user });
        }
    } else {
        res.status(404);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('User not found');
        } else {
            req.flash('error', 'User profile not found.');
            res.redirect('/'); // Or redirect to login
        }
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
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('User not found.');
        } else {
            req.flash('error', 'User to delete not found.');
            return res.redirect('/admin/users'); // Or wherever appropriate
        }
    }

    // Authorization: Only the user themselves or an admin can delete the profile
    // Assuming req.user.isAdmin is set by auth middleware for admin users
    if (userToDelete._id.toString() !== req.user.id.toString() && req.user.roles !== 'Admin') { // Use roles string
        res.status(403);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Not authorized to delete this user profile.');
        } else {
            req.flash('error', 'You are not authorized to delete this user.');
            return res.redirect('/admin/users'); // Or wherever appropriate
        }
    }

    // Important: Disassociate vendor if this user was a vendor owner
    // Use string comparison for roles
    if (userToDelete.roles === 'Vendor' && userToDelete.vendor) {
        const Vendor = require('../models/vendor'); // Import Vendor model here to avoid circular dependency
        await Vendor.findOneAndUpdate({ owner: userToDelete._id }, { $unset: { owner: 1 } });
    }

    await User.deleteOne({ _id: userIdToDelete });
    await invalidateCache([
        `auth:/api/auth/${userIdToDelete}`,
        'auth:/api/auth*'
    ]);

    const io = getIo();
    if (io) {
        io.to('admin_dashboard').emit('userDeleted', {
            userId: userIdToDelete,
            name: userToDelete.name,
            email: userToDelete.email,
            message: `User "${userToDelete.name}" (${userToDelete.email}) has been deleted.`,
            timestamp: new Date()
        });
        io.to(`user:${userIdToDelete.toString()}`).emit('accountDeleted', {
            message: `Your account has been deleted. You will be logged out.`,
            timestamp: new Date()
        });
    }

    if (req.originalUrl.startsWith('/api/')) {
        // For API requests
        res.status(200).json({ message: 'User removed successfully.' });
    } else {
        // For view-based submission
        req.flash('success', 'User removed successfully.');
        if (req.user.id.toString() === userIdToDelete.toString()) {
            // If self-deletion, clear cookie and redirect to login
            res.clearCookie('jwt'); // Assuming JWT cookie is named 'jwt'
            if (req.session) {
                req.session.destroy();
            }
            res.redirect('/login');
        } else {
            // If admin deleted another user, redirect to user list
            res.redirect('/admin/users');
        }
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
    if (user._id.toString() !== req.user.id.toString() && req.user.roles !== 'Admin') { // Use roles string
        res.status(403);
        if (req.originalUrl.startsWith('/api/')) {
            throw new Error('Not authorized to update this user profile.');
        } else {
            req.flash('error', 'You are not authorized to update this user.');
            return res.redirect('/profile'); // Or back to admin list
        }
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.phoneNumber = phoneNumber || user.phoneNumber;

    // Only admins can update roles and isDeliveryPerson
    if (req.user.roles === 'Admin') { // Use roles string
        if (roles && ['Vendor', 'Delivery', 'Customer', 'Admin'].includes(roles)) {
            user.roles = roles;
        }
        if (typeof isDeliveryPerson === 'boolean') {
            user.isDeliveryPerson = isDeliveryPerson;
        }
    }

    const updatedUser = await user.save();
    await invalidateCache([
        `auth:/api/auth/${updatedUser._id}`,
        'auth:/api/auth*'
    ]);

    const io = getIo();
    if (io) {
        io.to('admin_dashboard').emit('userUpdated', {
            userId: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            roles: updatedUser.roles,
            message: `User "${updatedUser.name}" (${updatedUser.email}) profile updated.`,
            timestamp: new Date()
        });
        io.to(`user:${updatedUser._id.toString()}`).emit('profileUpdated', {
            userId: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            message: `Your profile details have been updated.`,
            timestamp: new Date()
        });
    }

    if (req.originalUrl.startsWith('/api/')) {
        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } else {
        req.flash('success', 'Profile updated successfully!');
        // Redirect based on who updated it
        if (req.user.id.toString() === userIdToUpdate.toString()) {
            res.redirect('/profile'); // Redirect to own profile
        } else {
            res.redirect('/admin/users'); // Redirect to admin user list
        }
    }
});

// @desc    Logout user
// @route   GET /logout (for views) or /api/users/logout (for API)
// @access  Private
const logoutUser = asyncHandler(async (req, res) => {
    const io = getIo();
    const userId = req.user ? req.user.id : null;

    if (userId && io) {
        io.to(`user:${userId.toString()}`).emit('loggedOut', {
            message: 'You have been successfully logged out.',
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'loggedOut' to user: ${userId}`);
    }

    res.cookie('jwt', '', { // Clear the 'jwt' cookie
        httpOnly: true,
        expires: new Date(0), // Set expiry to past date
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', // Or 'lax'
    });

    if (req.originalUrl.startsWith('/api/')) {
        res.status(200).json({ message: 'Logged out successfully' });
    } else {
        req.flash('success', 'You have been logged out.');
        res.redirect('/login'); // Redirect to login page after logout
    }
});


module.exports = { registerUser, authUser, getUserProfile, deleteUserProfile, updateUserById, logoutUser };