const redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();


// Create a Redis client instance
const client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379' // Use env var for URL
});

client.on('connect', () => {
    console.log('Redis: Connection initiated...'); // This fires when it starts connecting
});

client.on('ready', () => {
    console.log('Redis: Client is ready to use! ✅'); // This fires when connection is fully established
});

client.on('error', (err) => {
    console.error('Redis: Client Error -', err);
    // Important: Handle Redis connection errors gracefully.
    // For production, consider robust logging and potential application-level alerts.
});

// IMPORTANT: Do NOT call client.connect() here.
// It will be called once in server.js.

module.exports = client; // Export the client instance