const express = require('express');
const router = express.Router();
const { registerUser, authUser, getUserProfile, deleteUserProfile, updateUserById, logoutUser } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User'); // For user_update_form to get users
const Vendor = require('../models/vendor'); // For user_update_form to get vendors

// Render login form
router.get('/login', (req, res) => {
    res.render('users/login', { title: 'Login' });
});

// Handle login submission (POST to API endpoint)
router.post('/login', authUser); // This will handle the API call

// Render registration form
router.get('/register', (req, res) => {
    res.render('users/register', { title: 'Register' });
});

// Handle registration submission (POST to API endpoint)
router.post('/register', registerUser); // This will handle the API call

// Render user profile page
router.get('/profile', protect, async (req, res) => {
    // In a real app, you'd fetch the user profile from DB here
    // For stub, req.user is already populated by 'protect' middleware
    const userProfile = req.user;
    res.render('users/profile', { title: 'My Profile', user: req.user, userProfile });
});

// Handle profile update (PUT to API endpoint)
router.put('/profile', protect, updateUserById); // This assumes method-override

// Handle profile deletion (DELETE to API endpoint)
router.delete('/profile', protect, deleteUserProfile); // This assumes method-override

// Handle logout
router.get('/logout', logoutUser);

// Admin-specific routes for user management
router.get('/admin/users', protect, async (req, res) => {
    // In a real app, you'd fetch all users from DB
    const users = await User.find({}).populate('vendor', 'name'); // Simulate fetching users
    res.render('users/lists', { title: 'Manage Users', users, user: req.user });
});

router.get('/admin/users/edit/:id', protect, async (req, res) => {
    // Simulate fetching a user by ID
    const userToEdit = await User.findById(req.params.id).populate('vendor', 'name');
    const vendors = await Vendor.find({}); // Fetch all vendors for assignment dropdown

    if (!userToEdit) {
        return res.status(404).render('error', { title: 'User Not Found', message: 'User not found.' });
    }
    res.render('users/update', { title: 'Edit User', userToEdit, loggedInUser: req.user, vendors });
});

router.put('/admin/users/:id', protect, updateUserById); // This assumes method-override
router.delete('/admin/users/:id', protect, deleteUserProfile); // This assumes method-override


module.exports = router;