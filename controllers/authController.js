// controllers/authController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// Register new user
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const user = await User.create({
        name,
        email,
        password,
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
        res.session = user
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// Authenticate user & get token
const authUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// Get user profile
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// Get delete profile
const deleteUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndDelete(req.user._id);

    if (user) {
        res.json("Sucess");
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

//Update a single product
const updateUserById = (async (req, res) => {
    const { name, email, phone } = req.body;

    // Find the product by ID
    let user = await User.findByIdAndUpdate(req.params.id);

    if (!user) {
        res.status(404);
        throw new Error('Product not found');
    }

    // Update all fields (even if some are the same)
    user.name = name || user.name; // Provide fallback to existing data if not provided
    user.email = email || user.email
    user.phone = phone || user.phone


    const updatedUser = await user.save(); // .save() will run pre-save hooks (like updatedAt)

    res.status(200).json({
        success: true,
        data: updatedUser
    });
});

module.exports = { registerUser, authUser, getUserProfile, deleteUserProfile, updateUserById };