// server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db'); // For MongoDB connection
const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const orderRoutes = require('./routes/orders');
const productRoutes = require('./routes/products');
const deliveryRoutes = require('./routes/deliverys');
const paymentRoutes = require('./routes/payments');
const notificationRoutes = require('./routes/notification');
const cookieParser = require("cookie-parser");
const session = require('express-session'); // Moved up for clarity
const MongoStore = require('connect-mongo'); // Moved up for clarity

const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const vendorRoutes = require('./routes/vendor');
const adminRoutes = require('./routes/admin');
const complaintRoutes = require('./routes/complaints');

const http = require('http');
// Importing the Redis client and Socket.IO initializer directly
const { client } = require('./config/redis'); // Renamed for clarity
const { initSocket, getIo } = require('./config/socket'); // Import initSocket and getIo


dotenv.config();

const app = express();

// Create an HTTP server from your Express app
const httpServer = http.createServer(app);

// Initialize Socket.IO with the HTTP server
// Ensure initSocket handles potential errors or returns the io instance if needed
initSocket(httpServer);

// --- Global Middlewares ---

// Body Parser and Cookie Parser
app.use(express.json()); // For parsing application/json requests
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(cookieParser()); // For parsing cookies

// Session Configuration (BEFORE CORS if `credentials: true` is used)
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_strong_fallback_secret_for_dev_only_please_change_this', // ⚠️ CRITICAL: Change in Production!
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something is stored
    store: MongoStore.create({ // Use a persistent store for production
        mongoUrl: process.env.MONGO_URI, // Your MongoDB connection string
        collectionName: 'sessions', // Name of the collection to store sessions
        ttl: 14 * 24 * 60 * 60, // Session TTL (time to live) in seconds (e.g., 14 days)
        autoRemove: 'interval', // Auto-remove expired sessions
        autoRemoveInterval: 10 // Interval in minutes to check for expired sessions
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day in milliseconds
        httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' with secure:true for cross-site, 'lax' for same-site
    }
}));

// CORS Configuration
app.use(cors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*', // Support multiple origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Include OPTIONS for pre-flight requests
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // Added X-Requested-With
    credentials: true // Allow cookies to be sent (essential for sessions)
}));

// --- API Routes ---
app.use('/api/users', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/complaints', complaintRoutes);

// Root route for server health check
app.get('/', (req, res) => {
    res.send('Hello Modesta from Dorothy! Server is running.');
});

// --- Error Handling Middleware (must be after all routes) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Centralized server startup function
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        console.log('Database Connected Successfully! ✅');

        // Connect to Redis
        await client(); // Use the renamed client
        console.log('Redis Connected Successfully! 🚀');

        // This function will set up the Redis adapter and event listeners
        initSocket(httpServer);
        console.log('Socket.IO Initialized! ⚡');


        // Start the HTTP server (which Express app is attached to)
        httpServer.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });

    } catch (error) {
        console.error('Server failed to start:', error.message);
        // It's good practice to log the full error stack in development/staging
        if (process.env.NODE_ENV !== 'production') {
            console.error(error);
        }
        process.exit(1); // Exit process with failure
    }
};

// Export the startServer function and httpServer for testing purposes
module.exports = { startServer, httpServer, app, getIo };

// Call the function to start the server if not being imported for testing
if (process.env.NODE_ENV !== 'test') {
    startServer();
}