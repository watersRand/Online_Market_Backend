// tests/teardown.js
const mongoose = require('mongoose');

module.exports = async () => {
    console.log('\n--- Global Test Teardown ---');

    // 1. Disconnect from MongoDB
    if (mongoose.connection.readyState === 1) { // Check if connected
        await mongoose.disconnect();
        console.log('Disconnected from Test MongoDB.');
    }

    // 2. Disconnect from Redis
    if (global.__REDIS_CLIENT__) {
        await global.__REDIS_CLIENT__.quit();
        console.log('Disconnected from Test Redis.');
    }

    // 3. Close Express/Socket.IO Server
    if (global.__TEST_SERVER__) {
        await new Promise(resolve => {
            global.__TEST_SERVER__.close(() => {
                console.log('Test server closed.');
                resolve();
            });
        });
    }

    console.log('--- Global Test Teardown Complete ---');
};