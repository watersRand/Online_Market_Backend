// server.js 

const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();

connectDB();

const app = express();

app.use(express.json());
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

app.use('/api/users', authRoutes);
app.use('/api/products', productRoutes);
app.get('/', (req, res) => {
    res.send('Hello Modesta from Taby')
})

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server running on port ${PORT}`));