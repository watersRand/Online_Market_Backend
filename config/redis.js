const redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();


// Create a Redis client instance
const client = async () => {
    try {
        await redis.createClient({
            username: 'default',
            password: process.env.REDIS_PASSWORD,
            socket: {
                host: process.env.REDIS_URL,
            }
        });

    }
    catch (error) {
        console.error(error)
    }



}
async function setCache(key, value, expirySeconds = 3600) {
    // In node-redis v4.x+, use SET with EX option
    await client.set(key, JSON.stringify(value), { EX: expirySeconds });
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