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
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const vendorRoutes = require('./routes/vendor');
const adminRoutes = require('./routes/admin');
const complaintRoutes = require('./routes/complaints');

const http = require('http'); // Import http module
const { client } = require('./config/redis'); // Import the Redis client instance directly
const { initSocket } = require('./config/socket'); // Assuming this exists and needs `httpServer`

dotenv.config();

const app = express();

// Create an HTTP server from your Express app
const httpServer = http.createServer(app);

// Initialize Socket.IO with the HTTP server (assuming initSocket expects httpServer)
initSocket(httpServer);

// Global Middlewares
app.use(express.json()); // For parsing application/json
app.use(cookieParser()); // For parsing cookies

// Configure express-session BEFORE CORS if `credentials: true` is used in CORS
const session = require('express-session');
const MongoStore = require('connect-mongo');

app.use(session({
    secret: process.env.SESSION_SECRET || 'your_super_secret_key', // **CRITICAL: Change in Production!** Use a strong, random string.
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
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
    origin: process.env.FRONTEND_URL || '*', // Specify your React app's origin(s) for production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true // Allow cookies to be sent (essential for sessions)
}));

// API Routes
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

// Error Handling Middleware (must be after all routes)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Centralized server startup function
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        console.log('Database Connected Successfully! ✅');

        // // Connect to Redis
        // await client.connect();
        // console.log('Redis Connected Successfully! 🚀');

        // Start the HTTP server (which Express app is attached to)
        httpServer.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });

    } catch (error) {
        console.error('Server failed to start:', error.message);
        process.exit(1); // Exit process with failure
    }
};

// Call the function to start the server
startServer();