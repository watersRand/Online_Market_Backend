// const { Server } = require('socket.io');
// const { createAdapter } = require('@socket.io/redis-adapter');
// const Redis = require('ioredis');
// const dotenv = require('dotenv');

// dotenv.config();

// let io; // Global Socket.IO instance

// const initSocket = (httpServer) => {
//     if (io) {
//         return io; // Already initialized
//     }

//     io = new Server(httpServer, {
//         cors: {
//             origin: process.env.CLIENT_URL || 'http://localhost:3000', // Your frontend URL
//             methods: ['GET', 'POST'],
//             credentials: true,
//         },
//     });

//     // Redis adapter for scaling
//     const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
//     const subClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

//     // Handle Redis connection errors for the adapter clients
//     pubClient.on('error', (err) => console.error('Socket.IO Redis pubClient error:', err));
//     subClient.on('error', (err) => console.error('Socket.IO Redis subClient error:', err));

//     io.adapter(createAdapter(pubClient, subClient));

//     // Socket.IO connection handling
//     io.on('connection', (socket) => {
//         console.log(`Socket connected: ${socket.id}`);

//         // --- User Authentication/Identification for Socket ---
//         // This is a crucial step: Link the socket to a user ID.
//         // You would typically send a JWT from the client to authenticate the WebSocket.
//         // For simplicity, let's assume a 'userId' is sent on connection or after a login event.
//         // In a real app, you'd verify a JWT here and store the user ID.
//         const userId = socket.handshake.query.userId || socket.handshake.auth.userId; // Example
//         if (userId) {
//             // Join a room named after the user's ID
//             socket.join(userId);
//             console.log(`Socket ${socket.id} joined room for user: ${userId}`);
//         } else {
//             // Handle unauthenticated sockets, maybe disconnect them or put in a 'guest' room
//             console.warn(`Unauthenticated socket ${socket.id} connected.`);
//             // socket.disconnect(true);
//         }
//         // --- End User Identification ---

//         socket.on('disconnect', () => {
//             console.log(`Socket disconnected: ${socket.id}`);
//         });

//         // You can also listen for messages from the client here if needed
//         // socket.on('clientMessage', (data) => {
//         //     console.log('Message from client:', data);
//         // });
//     });

//     return io;
// };

// const getIo = () => {
//     if (!io) {
//         throw new Error('Socket.IO not initialized. Call initSocket(httpServer) first.');
//     }
//     return io;
// };

// module.exports = { initSocket, getIo };