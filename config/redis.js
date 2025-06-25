const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

// Use a distinct name for the client that will be used for Node.js internal pub/sub logic,
// especially if socket.io-redis creates its own connections.
// For socket.io-redis adapter, it's often better to just pass the host/port
// or let it create its own ioredis instances.
const redisPubSubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisPubSubClient.on('connect', () => {
    console.log('Connected to Redis for Pub/Sub!');
});

redisPubSubClient.on('error', (err) => {
    console.error('Redis Pub/Sub connection error:', err);
});

module.exports = redisPubSubClient;