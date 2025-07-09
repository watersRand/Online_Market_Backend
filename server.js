// server.js 

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services')
const orderRoutes = require('./routes/orders')
const productRoutes = require('./routes/products');
const deliveryRoutes = require('./routes/deliverys')
const paymentRoutes = require('./routes/payments')
const notificationRoutes = require('./routes/notification')
const cookieParser = require("cookie-parser");
const { notFound, errorHandler } = require('./middleware/errorMiddleware');


const vendorRoutes = require('./routes/vendor');
const adminRoutes = require('./routes/admin');
const complaintRoutes = require('./routes/complaints');


const http = require('http'); // NEW: Import http module
const redisPubSubClient = require('./config/redis'); // Redis client for Pub/Sub (optional, but good to ensure connected)
const { initSocket } = require('./config/socket');

dotenv.config();
redisPubSubClient; // Ensure Redis client starts connection

connectDB();

const app = express();

// Create an HTTP server from your Express app
const httpServer = http.createServer(app);

// Initialize Socket.IO with the HTTP server
initSocket(httpServer); // Pass the httpServer to Socket.IO


app.use(express.json());
app.use(cookieParser())
const session = require('express-session');
const MongoStore = require('connect-mongo');


// --- Configure express-session ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_super_secret_key', // A secret string for signing the session ID cookie.
    // CHANGE THIS IN PRODUCTION! Use a strong, random string.
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
        // secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
        sameSite: 'lax', // Protect against CSRF attacks, 'strict' or 'none' (with secure: true)
    }
}));

// Option 3: Allow specific origin, methods, and headers (more granular)
app.use(cors({
    origin: '*', // Your React app's origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true // Allow cookies to be sent (if you use session cookies or HttpOnly JWT cookies)
}));

app.use('/api/users', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/payments', paymentRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/orders', orderRoutes)
app.use('/api/notifications', notificationRoutes);

// NEW ADMIN AND COMPLAINT ROUTES
app.use('/api/vendors', vendorRoutes); // For Super Admin to manage vendors
app.use('/api/admin', adminRoutes);     // For admin dashboards and analytics
app.use('/api/complaints', complaintRoutes); // For complaint handling

app.get('/', (req, res) => {
    res.send('Hello Modesta from Dorothy')
})

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server running on port ${PORT}`));