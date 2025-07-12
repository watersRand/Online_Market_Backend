// cacheMiddleware.js (or wherever your cacheData and clearCache are)

const redisClient = require('../config/redis'); // Import the directly exported client

/**
 * Global caching middleware for GET requests.
 * It caches responses based on the request URL.
 *
 * @param {string} entityPrefix - A prefix to identify the entity type (e.g., 'products', 'services').
 * @param {number} expireTime - Time in seconds for the cache to expire (default: 3600 seconds = 1 hour).
 * @returns {Function} Express middleware.
 */
const cacheResponse = (entityPrefix, expireTime = 3600) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Create a unique cache key based on the entity prefix and the full original URL
        // Example: 'products:/api/products?page=1' or 'services:/api/services/123'
        const cacheKey = `${entityPrefix}:${req.originalUrl}`;

        try {
            const cachedData = await redisClient.get(cacheKey);

            if (cachedData) {
                console.log(`Cache hit for ${cacheKey} 🚀`);
                // Send cached data and return
                return res.status(200).json(JSON.parse(cachedData));
            }

            console.log(`Cache miss for ${cacheKey} 🕵️`);

            // Override res.json to intercept the response and cache it before sending
            res.originalJson = res.json;
            res.json = function (data) {
                redisClient.setEx(cacheKey, expireTime, JSON.stringify(data))
                    .catch(err => console.error(`Redis cache set error for ${cacheKey}:`, err));
                // Call the original json function to send the response to the client
                return res.originalJson(data);
            };

            next(); // Proceed to the actual route handler to get the data
        } catch (err) {
            console.error(`Cache middleware error for ${cacheKey}:`, err);
            // If there's an error with Redis, don't break the request.
            // Just bypass caching and proceed to the next middleware/route handler.
            next();
        }
    };
};

/**
 * Global helper function to clear cache entries.
 * Useful after POST, PUT, DELETE operations.
 *
 * @param {string|string[]} patterns - A single Redis key pattern (e.g., 'products:*') or an array of patterns to clear.
 * Uses glob-style patterns with `*` for wildcards.
 */
const invalidateCache = async (patterns) => {
    // Ensure patterns is an array for consistent processing
    const patternArray = Array.isArray(patterns) ? patterns : [patterns];

    try {
        for (const pattern of patternArray) {
            // Using SCAN for production to avoid blocking for large datasets
            // For simplicity, we'll stick to KEYS here but recommend SCAN for large caches
            const keys = await redisClient.keys(pattern);

            if (keys.length > 0) {
                console.log(`Clearing ${keys.length} cache keys matching pattern: ${pattern} 🧹`);
                await redisClient.del(keys); // `del` command accepts multiple keys
            } else {
                console.log(`No cache keys found to clear for pattern: ${pattern}`);
            }
        }
    } catch (err) {
        console.error('Error invalidating cache:', err);
    }
};

module.exports = {
    cacheResponse,
    invalidateCache,
};