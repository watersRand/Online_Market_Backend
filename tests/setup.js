// tests/setup.js
const mongoose = require('mongoose');
const Redis = require('ioredis');
// Import the server components directly for test setup
const { app, httpServer, startServer } = require('../server');
// Assuming your socket.io instance might be exposed or can be accessed via httpServer
// const { io } = require('../config/socket'); // If initSocket returns the io instance

// Ensure environment is set for testing
process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || 4000; // Use a specific port for testing

module.exports = async () => {
    console.log('\n--- Global Test Setup ---');

    // 1. Connect to Test MongoDB
    const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/jest-test-db';
    try {
        // Ensure mongoose connection is ready before proceeding
        await mongoose.connect(mongoUri);
        console.log(`Connected to Test MongoDB: ${mongoUri}`);
    } catch (err) {
        console.error('Failed to connect to Test MongoDB:', err.message);
        // Log the full stack for better debugging during setup
        console.error(err);
        process.exit(1); // Exit if critical service is unavailable
    }

    // 2. Redis Connection Setup
    const redisUrl = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'; // Use DB 1 for testing
    let tempRedisClient;
    try {
        tempRedisClient = new Redis(redisUrl);
        await tempRedisClient.ping(); // Attempt to ping to verify connection immediately
        global.__REDIS_CLIENT__ = tempRedisClient; // Assign only on successful connection
        console.log(`✅ Connected to Test Redis: ${redisUrl}`);
    } catch (err) {
        console.error(`❌ Failed to connect to Test Redis at ${redisUrl}:`, err.message);
        if (tempRedisClient) {
            tempRedisClient.quit(); // Clean up if connection failed but client was created
        }
        throw new Error(`Failed to establish Redis connection for tests: ${err.message}`);
    }

    // 3. Start Express/Socket.IO Server
    // You only need to call startServer once to bring up the HTTP server and connections
    // Make sure `startServer` doesn't automatically call listen if it's imported,
    // or refactor it to return the server instance.
    // Given your `server.js` exports `httpServer`, you can use that directly.
    await new Promise(resolve => {
        // Prevent `startServer` from connecting to DB/Redis again if `tests/setup.js` already did it.
        // This is handled by the `if (process.env.NODE_ENV !== 'test')` guard in `server.js`
        // We just need to ensure the `httpServer` is listening.
        global.__TEST_SERVER__ = httpServer.listen(process.env.PORT, () => {
            console.log(`Test server listening on port ${process.env.PORT}`);
            resolve();
        });
    });

    console.log('--- Global Test Setup Complete ---');
};