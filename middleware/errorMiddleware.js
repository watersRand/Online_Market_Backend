// middleware/errorMiddleware.js

const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error); // Pass the error to the error handling middleware
};

const errorHandler = (err, req, res, next) => {
    // Determine the status code: if it's a 200 (OK) but an error occurred, set to 500 (Internal Server Error)
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    // --- Determine if the request is for an API endpoint or a view ---
    // Option 1: Check if the URL path starts with '/api'
    const isApiRequest = req.originalUrl.startsWith('/api/');

    if (isApiRequest) {
        // If it's an API request, send a JSON response
        res.json({
            message: err.message,
            stack: process.env.NODE_ENV === 'production' ? null : err.stack, // Stack trace only in development
        });
    } else {
        // If it's a regular page request, render the error.ejs template
        res.render('error', {
            title: `Error ${statusCode}`, // Title for the EJS page
            message: err.message, // Error message to display
            statusCode: statusCode, // HTTP status code
            stack: process.env.NODE_ENV === 'production' ? null : err.stack, // Stack trace for debugging in dev
            // You might also pass req.user if your layout depends on it
            user: res.locals.user || null // Ensure user is available if your layout needs it
        });
    }
};

module.exports = {
    notFound,
    errorHandler,
};