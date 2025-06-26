const User = require('../models/User');
const Notification = require('../models/notification');
const redisPubSubClient = require('../config/redis'); // Your Redis Pub/Sub client
const { getIo } = require('../config/socket'); // NEW: Import Socket.IO instance

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
const emitInAppNotification = async (payload) => {
    const io = getIo(); // Get the initialized Socket.IO instance

    if (!io) {
        console.warn('Socket.IO not initialized. Real-time notification will not be sent.');
        return;
    }

    try {
        // Emit the notification to a specific user's room (or ID)
        // Ensure your Socket.IO connection handling assigns users to rooms or maps user IDs to socket IDs
        io.to(payload.userId).emit('notification', payload);
        console.log(`Emitted in-app notification to Socket.IO for user: ${payload.userId}`);
    } catch (error) {
        console.error('Error emitting in-app notification via Socket.IO:', error);
    }
};

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
const triggerNotifications = async (userId, message, type, referenceId = null, phoneNumber = null) => {
    try {
        // 1. Create persistent notification in DB
        const notification = await createNotification(userId, message, type, referenceId);

        // 2. Emit for real-time in-app
        await emitInAppNotification({
            userId: userId.toString(),
            message,
            type,
            referenceId: referenceId ? referenceId.toString() : null,
            notificationId: notification._id.toString(),
            createdAt: notification.createdAt.toISOString()
        });

        // 3. Send SMS (if phone number provided or fetched)
        if (!phoneNumber) {
            const user = await User.findById(userId).select('phone');
            if (user && user.phone) {
                phoneNumber = user.phone;
            }
        }
        if (phoneNumber) {
            await sendSMSNotification(phoneNumber, message);
        }

    } catch (error) {
        console.error('Failed to trigger all notifications:', error);
    }
};

module.exports = {
    triggerNotifications,
    createNotification,
    emitInAppNotification, // Export for testing
    sendSMSNotification
};