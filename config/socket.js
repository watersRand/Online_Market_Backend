// config/socket.js

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis'); // Correct: Use ioredis
const dotenv = require('dotenv');
dotenv.config(); // Ensure dotenv is loaded here

// Store the io instance globally
let io;
let pubClient;
let subClient;

const initSocket = (httpServer) => {
    // --- AGGRESSIVE DEBUGGING FOR REDIS CONNECTION ---
    const redisHost = process.env.REDIS_URL; // This is actually your full host string
    const redisPort = process.env.REDIS_PORT;
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisTls = process.env.NODE_ENV === 'production'; // Assume TLS in production

    console.log('\n--- DEBUG: Socket.IO Redis Connection Attempt ---');
    console.log('REDIS_URL (from env):', redisHost);
    console.log('REDIS_PORT (from env):', redisPort);
    console.log('REDIS_PASSWORD (from env):', redisPassword ? 'Loaded' : 'Not Loaded');
    console.log('NODE_ENV:', process.env.NODE_ENV, 'TLS Enabled:', redisTls);

    // Construct the full Redis URL for ioredis
    // ioredis prefers a URL string for complex connections (like Redis Cloud)
    // Format: redis[s]://[[username][:password]@][host][:port][/db-number]
    const fullRedisConnectionString = `rediss://default:${redisPassword}@${redisHost}:${redisPort}`; // Use 'rediss' for TLS/SSL
    console.log('Constructed Full Redis Connection String for ioredis:', fullRedisConnectionString);

    // Create Redis clients using the full connection string
    // ioredis automatically handles parsing the URL for host, port, password, TLS
    pubClient = new Redis(fullRedisConnectionString);
    subClient = new Redis(fullRedisConnectionString); // Sub client needs its own connection

    // Handle Redis connection errors for both clients
    pubClient.on('error', (err) => console.error('Redis PubClient Error:', err));
    subClient.on('error', (err) => console.error('Redis SubClient Error:', err));

    // Socket.IO Server Configuration
    io = new Server(httpServer, {
        cors: {
            // Dynamically set origin for EJS-based apps
            origin: (origin, callback) => {
                const allowedOrigins = [
                    `http://localhost:${process.env.PORT || 8080}`, // Local dev
                ];
                if (process.env.YOUR_APP_DOMAIN) {
                    allowedOrigins.push(`https://${process.env.YOUR_APP_DOMAIN}`); // Production domain
                }

                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    console.warn(`Socket.IO: Blocked origin: ${origin}`);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Listen for the 'ready' event to ensure both clients are fully connected
    let pubReady = false;
    let subReady = false;

    const setupAdapterIfReady = () => {
        if (pubReady && subReady) {
            io.adapter(createAdapter(pubClient, subClient));
            console.log('Socket.IO Redis adapter configured.');

            // --- Socket.IO Connection Handlers (no change needed here) ---
            io.on('connection', (socket) => {
                console.log('A user connected:', socket.id);

                socket.on('joinUserRoom', (userId) => {
                    if (userId) { socket.join(`user:${userId}`); console.log(`Socket ${socket.id} joined room: user:${userId}`); }
                });
                socket.on('joinAdminRoom', () => {
                    socket.join('admin_dashboard'); console.log(`Socket ${socket.id} joined admin_dashboard room.`);
                });
                socket.on('joinVendorRoom', (vendorId) => {
                    if (vendorId) { socket.join(`vendor_dashboard:${vendorId}`); console.log(`Socket ${socket.id} joined room: vendor_dashboard:${vendorId}`); }
                });
                socket.on('joinOrderRoom', (orderId) => {
                    if (orderId) { socket.join(`order:${orderId}`); console.log(`Socket ${socket.id} joined room: order:${orderId}`); }
                });
                socket.on('disconnect', () => {
                    console.log('User disconnected:', socket.id);
                });
            });
            console.log('Socket.IO initialized and listening for connections.');
        }
    };

    pubClient.on('ready', () => {
        pubReady = true;
        console.log('Redis PubClient connected and ready. 🚀');
        setupAdapterIfReady();
    });

    subClient.on('ready', () => {
        subReady = true;
        console.log('Redis SubClient connected and ready. 🚀');
        setupAdapterIfReady();
    });

    pubClient.on('end', () => console.log('Redis PubClient connection closed.'));
    subClient.on('end', () => console.log('Redis SubClient connection closed.'));

    console.log('--- DEBUG: Socket.IO initSocket END ---');
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initSocket(httpServer) first.');
    }
    return io;
};

module.exports = { initSocket, getIo, pubClient, subClient };