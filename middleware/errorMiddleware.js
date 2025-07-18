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
    // Log the error for server-side debugging
    console.error(`ERROR: ${err.message}`);
    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack); // Log stack trace only in development
    }

    // --- IMPORTANT: Render the EJS error page ---
    // Pass the error details to the EJS template
    res.render('error', { // Assuming your error page is at views/error.ejs
        title: `Error ${statusCode}`, // Title for the page
        message: err.message, // The error message
        // Only include stack trace in development for security/readability
        error: process.env.NODE_ENV === 'development' ? err.stack : null,
        user: req.user || { _id: null, name: 'Guest', roles: 'Customer' } // Pass user for header/layout
    });
};

module.exports = {
    notFound,
    errorHandler,
};