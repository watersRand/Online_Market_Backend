const User = require('../models/User');
const mongoose = require('mongoose')
const Notification = require('../models/notification');


// Initialize Africa's Talking
const AfricasTalking = require('africastalking')({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
});
const sms = AfricasTalking.SMS;

// Redis channel name for internal Node.js Pub/Sub (if scaling)
// This channel is used by the socket.io-redis adapter and your custom messages
const REALTIME_CHANNEL = 'app_realtime_events';

/**
 * Creates and saves a notification to MongoDB.
 * (Same as before)
 */
const createNotification = async (userId, message, type, referenceId = null) => {
    try {
        const notification = new Notification({
            user: userId,
            message,
            type,
            referenceId,
        });
        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification in DB:', error);
        throw error;
    }
};

/**
 * Emits a real-time notification via Socket.IO.
 * This function handles broadcasting to the specific user's socket.
 * It also uses Redis Pub/Sub internally via socket.io-redis adapter for scaling.
 * @param {object} payload - The notification data to send.
 * @param {string} payload.userId - ID of the user for whom the notification is.
 * @param {string} payload.message - The message.
 * @param {string} payload.type - Type of notification.
 * @param {string} [payload.referenceId] - Optional: ID of the related entity.
 * @param {string} [payload.notificationId] - ID of the persistent notification.
 */


/**
 * Sends an SMS notification using Africa's Talking.
 * (Same as before)
 */
const sendSMSNotification = async (phoneNumber, message) => {
    try {
        if (!phoneNumber || !message) {
            console.warn('Skipping SMS: Phone number or message is missing.');
            return;
        }
        const response = await sms.send({
            to: phoneNumber,
            message: message,
            from: process.env.AT_SMS_SENDER_ID || 'AT_ShortCode'
        });
        console.log('SMS sent successfully:', response);
    } catch (error) {
        console.error('Error sending SMS notification:', error.response ? error.response.data : error.message);
    }
};

/**
 * Unified function to trigger all relevant notifications for an event.
 * @param {string} userId - The user ID to notify.
 * @param {string} message - The main message.
 * @param {string} type - Notification type.
 * @param {string} [referenceId] - Optional reference ID.
 * @param {string} [phoneNumber] - Optional phone number for SMS. If not provided, it will try to fetch from user.
 */
const triggerNotifications = async (req, res) => {
    let { userId, message, type, referenceId, phoneNumber } = req.body;

    // --- Input Validation and Sanitization ---
    if (!userId || !message || !type) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: userId, message, and type are mandatory.'
        });
    }

    // Validate userId as a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid userId provided.'
        });
    }

    // Sanitize referenceId if provided and validate it as an ObjectId
    if (referenceId) {
        // Trim any whitespace or unwanted characters (like the problematic trailing apostrophe)
        if (typeof referenceId === 'string') {
            referenceId = referenceId.trim().replace(/['"]/g, '');
        }

        if (!mongoose.Types.ObjectId.isValid(referenceId)) {
            console.warn(`Attempted to trigger notification with an invalid referenceId: "${req.body.referenceId}"`);
            // Decide if this should be a hard error (400) or just ignore the referenceId
            // For now, let's treat it as a warning and proceed without a referenceId.
            // If you *always* expect a valid referenceId, uncomment the return below.
            // return res.status(400).json({ success: false, message: 'Invalid referenceId provided.' });
            referenceId = null; // Set to null if invalid to prevent further casting errors
        }
    }


    try {
        let notification;
        try {
            // 1. Create persistent notification in DB
            // Ensure createNotification handles null/undefined referenceId gracefully
            notification = await createNotification(userId, message, type, referenceId);
        } catch (dbError) {
            console.error('Failed to create persistent notification in DB:', dbError);
            // Decide if this is a fatal error or if other notifications should still attempt to send
            return res.status(500).json({
                success: false,
                message: 'Failed to create persistent notification.',
                error: dbError.message
            });
        }





        // 3. Send SMS (if phone number provided or fetched)
        let actualPhoneNumber = phoneNumber; // Use a new variable to avoid reassigning original req.body.phoneNumber

        if (!actualPhoneNumber) {
            try {
                const user = await User.findById(userId).select('phone');
                if (user && user.phone) {
                    actualPhoneNumber = user.phone;
                }
            } catch (userFetchError) {
                console.error('Failed to fetch user phone number for SMS:', userFetchError);
                // Continue without SMS if phone number cannot be fetched
            }
        }

        if (actualPhoneNumber) {
            try {
                await sendSMSNotification(actualPhoneNumber, message);
            } catch (smsError) {
                console.error('Failed to send SMS notification:', smsError);
                // This is often not a critical failure, so we just log and continue.
            }
        }

        // Respond with success after all attempts
        res.status(200).json({
            success: true,
            message: 'Notification trigger process completed. Check logs for individual failures.',
            notificationId: notification._id.toString()
        });

    } catch (error) {
        // This catch block is primarily for unexpected errors, as most anticipated errors
        // are handled in their respective try-catch blocks or by early exits.
        console.error('An unexpected error occurred during notification triggering:', error);
        res.status(500).json({
            success: false,
            message: 'An unexpected internal server error occurred.',
            error: error.message
        });
    }
};

module.exports = {
    triggerNotifications,
    createNotification,
    sendSMSNotification
};