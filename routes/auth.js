// (routes/authRoutes.js

const express = require('express');
const { registerUser, authUser, getUserProfile, logoutUser, updateUserById } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.put('/update', protect, updateUserById)
router.get('/profile', protect, getUserProfile);
router.get('/logout', protect, logoutUser)

module.exports = router;