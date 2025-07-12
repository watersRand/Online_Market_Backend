const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Notification = require('../models/notification');
const asyncHandler = require('express-async-handler');
const { cacheResponse } = require('../controllers/cacheController')
const { triggerNotifications } = require('../utils/notificationService')



router.post('/', protect, triggerNotifications)
// @desc    Get logged in user's notifications
// @route   GET /api/notifications
// @access  Private
router.get('/', protect, cacheResponse('notifications', 300), asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.user })
        .sort({ createdAt: -1 })
        .limit(50); // Limit to recent notifications

    res.json(notifications);
}));

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
router.put('/:id/read', protect, asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
        res.status(404);
        throw new Error('Notification not found');
    }

    // Ensure user owns the notification or is admin
    if (notification.user.toString() !== req.user.toString() && !req.user.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to mark this notification as read');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.json({ message: 'Notification marked as read', notification });
}));


module.exports = router;