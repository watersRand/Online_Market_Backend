const redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();


// Create a Redis client instance
const client = async () => {
    try {
        await redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379' // Use env var for URL
        });

    }
    catch (error) {
        console.error(error)
    }



}
async function setCache(key, value, expirySeconds = 3600) {
    await client.setex(key, expirySeconds, JSON.stringify(value));
}

async function getCache(key) {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
}

async function deleteCache(key) {
    await client.del(key);
}

module.exports = { setCache, getCache, deleteCache, client };

// module.exports = client; // Export the client instance