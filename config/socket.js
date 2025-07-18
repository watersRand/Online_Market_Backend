const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
// const Redis = require('ioredis');
const { createClient } = require('ioredis');// Import createClient from 'redis' package
const dotenv = require('dotenv');
const Redis = require('ioredis');
dotenv.config();



// Store the io instance globally
let io;
let pubClient; // Declare globally for error handling outside initSocket
let subClient; // Declare globally for error handling outside initSocket

const initSocket = (httpServer) => {
    // Define your Redis connection options
    const redisOptions = {
        host: process.env.REDIS_HOST,
        password: process.env.REDIS_PASSWORD, // Use environment variable for password
        // Other options like `db`, `keyPrefix` etc.
    };

    // Create a new Redis client for publishing. Connection starts automatically.
    pubClient = new Redis(redisOptions);
    // Create another new Redis client for subscribing. Connection starts automatically.
    subClient = new Redis({ ...redisOptions }); // Clone options for a separate instance

    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || '*', // Your frontend URL
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Handle Redis connection errors for both clients
    pubClient.on('error', (err) => console.error('Redis PubClient Error:', err));
    subClient.on('error', (err) => console.error('Redis SubClient Error:', err));

    // Listen for the 'ready' event to ensure both clients are fully connected
    // before attempting to set up the adapter.
    let pubReady = false;
    let subReady = false;

    const setupAdapterIfReady = () => {
        if (pubReady && subReady) {
            const { createAdapter } = require('@socket.io/redis-adapter');
            io.adapter(createAdapter(pubClient, subClient));
            console.log('Socket.IO Redis adapter configured.');

            io.on('connection', (socket) => {
                console.log('A user connected:', socket.id);

                // Join room for specific users (for personal notifications)
                socket.on('joinUserRoom', (userId) => {
                    if (userId) {
                        socket.join(`user:${userId}`);
                        console.log(`Socket ${socket.id} joined room: user:${userId}`);
                    }
                });

                // Join room for Super Admin dashboard updates
                socket.on('joinAdminRoom', () => {
                    socket.join('admin_dashboard');
                    console.log(`Socket ${socket.id} joined admin_dashboard room.`);
                });

                // Join room for Vendor Admin dashboard updates
                socket.on('joinVendorRoom', (vendorId) => {
                    if (vendorId) {
                        socket.join(`vendor_dashboard:${vendorId}`);
                        console.log(`Socket ${socket.id} joined room: vendor_dashboard:${vendorId}`);
                    }
                });

                // Join room for specific orders (for customers tracking order status)
                socket.on('joinOrderRoom', (orderId) => {
                    if (orderId) {
                        socket.join(`order:${orderId}`);
                        console.log(`Socket ${socket.id} joined room: order:${orderId}`);
                    }
                });

                // Handle disconnection
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
};

const getIo = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initSocket(httpServer) first.');
    }
    return io;
};

module.exports = { initSocket, getIo, pubClient, subClient }; // Export clients for potential closing