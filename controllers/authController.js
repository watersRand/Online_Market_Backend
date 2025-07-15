// controllers/authController.js

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const asyncHandler = require('express-async-handler');
const { invalidateCache } = require('../controllers/cacheController');
const { getIo } = require('../config/socket'); // Import getIo to access Socket.IO

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// Register new user
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, phoneNumber, roles, isDeliveryPerson } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // Ensure roles array exists and 'customer' is a default if not specified
    const userRoles = roles && Array.isArray(roles) && roles.length > 0 ? roles : ['customer'];

    const user = await User.create({
        name,
        email,
        password,
        phoneNumber,
        roles: userRoles, // Use the determined roles
        isDeliveryPerson: isDeliveryPerson || false // Default to false if not provided
    });
    await invalidateCache('auth:/api/auth*');

    if (user) {
        const io = getIo(); // Get the Socket.IO instance
        if (io) {
            // Notify admin dashboard about new user registration
            io.to('admin_dashboard').emit('newUserRegistered', {
                userId: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                message: `New user "${user.name}" (${user.email}) has registered.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'newUserRegistered' for admin dashboard.`);

            // Optionally, notify the new user in their own room if they connect immediately
            // This assumes the client will join 'user:[userId]' room upon successful login/registration.
            io.to(`user:${user._id.toString()}`).emit('welcomeMessage', {
                message: `Welcome, ${user.name}! Your account has been successfully created.`,
                timestamp: new Date()
            });
            console.log(`Socket.IO: Emitted 'welcomeMessage' to new user: ${user._id}`);
        }

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id),
            // roles: user.roles, // You might want to include roles in the response
        });
        // res.session = user // This line seems to be for session-based auth, typically not mixed with JWT
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// Authenticate user & get token
const authUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        // You might want to include roles and isDeliveryPerson in the login response
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber, // Include phone number
            roles: user.roles, // Include user roles
            isDeliveryPerson: user.isDeliveryPerson, // Include delivery person status
            token: generateToken(user._id),
        });
        // Frontend should now join specific rooms based on roles/ID after successful authentication
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// Get user profile
const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id); // Access user ID from req.user (set by auth middleware)

    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber, // Use phoneNumber from model
            roles: user.roles, // Include roles
            isDeliveryPerson: user.isDeliveryPerson, // Include delivery status
            vendor: user.vendor // Include vendor ID if associated
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// Delete user profile
const deleteUserProfile = asyncHandler(async (req, res) => {
    // Ensure the ID being deleted is the authenticated user's ID or if an admin is deleting
    // If only self-deletion, req.params.id is not used, it's req.user.id
    // If admin can delete any user, then req.params.id is used, and req.user.isAdmin check is needed
    const userIdToDelete = req.params.id || req.user.id; // Use param if provided, else logged-in user

    const userToDelete = await User.findById(userIdToDelete);

    if (!userToDelete) {
        res.status(404);
        throw new Error('User not found.');
    }

    // Authorization: Only the user themselves or an admin can delete the profile
    if (userToDelete._id.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to delete this user profile.');
    }

    // Important: Disassociate vendor if this user was a vendor owner
    if (userToDelete.roles.includes('vendor') && userToDelete.vendor) {
        // Assuming your Vendor model handles the owner field
        const Vendor = require('../models/vendor'); // Import Vendor model if not already
        await Vendor.findOneAndUpdate({ owner: userToDelete._id }, { $unset: { owner: 1 } });
        // Or handle disassociation in a pre-remove hook on User model
    }

    // You might also want to handle orders, complaints, etc., associated with this user
    // e.g., mark them as from a 'deleted_user' or reassign.

    await User.deleteOne({ _id: userIdToDelete }); // Use deleteOne with criteria
    await invalidateCache([
        `auth:/api/auth/${userIdToDelete}`,
        'auth:/api/auth*'
    ]);

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Notify admin dashboard about user deletion
        io.to('admin_dashboard').emit('userDeleted', {
            userId: userIdToDelete,
            name: userToDelete.name,
            email: userToDelete.email,
            message: `User "${userToDelete.name}" (${userToDelete.email}) has been deleted.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'userDeleted' for admin dashboard.`);

        // If the deleted user was currently online, notify their specific socket room to disconnect/logout
        io.to(`user:${userIdToDelete.toString()}`).emit('accountDeleted', {
            message: `Your account has been deleted. You will be logged out.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'accountDeleted' to deleted user: ${userIdToDelete}`);
    }

    // If deleting own profile, destroy session/clear token
    if (req.user.id.toString() === userIdToDelete.toString()) {
        res.clearCookie('token'); // Clear the JWT cookie if you're using it
        if (req.session) {
            req.session.destroy(); // Destroy session if using sessions
        }
        res.json({ message: 'Your profile has been successfully deleted and you are logged out.' });
    } else {
        res.json({ message: 'User removed successfully.' });
    }
});

// Update a single user profile (by logged-in user or admin)
const updateUserById = asyncHandler(async (req, res) => {
    // If an admin is updating another user, req.params.id will be the user to update.
    // Otherwise, it's the logged-in user updating their own profile.
    const userIdToUpdate = req.params.id || req.user.id; // Correctly get the ID to update

    const { name, email, phoneNumber, roles, isDeliveryPerson } = req.body;

    let user = await User.findById(userIdToUpdate); // Find by userIdToUpdate, not req.user

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Authorization: Only the user themselves or an admin can update
    // Admin can update roles and isDeliveryPerson, regular users cannot.
    if (user._id.toString() !== req.user.id.toString() && !req.user.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to update this user profile.');
    }

    // Regular users can only update their name, email, phoneNumber
    user.name = name || user.name;
    user.email = email || user.email;
    user.phoneNumber = phoneNumber || user.phoneNumber; // Corrected field name

    // Only admins can update roles and isDeliveryPerson
    if (req.user.isAdmin) {
        if (roles) {
            user.roles = roles;
        }
        if (typeof isDeliveryPerson === 'boolean') {
            user.isDeliveryPerson = isDeliveryPerson;
        }
        // Admin can also change a user's vendor association if needed
        // if (vendorId) user.vendor = vendorId;
    }

    const updatedUser = await user.save();
    await invalidateCache([
        `auth:/api/auth/${updatedUser._id}`, // Use updatedUser._id for specific cache
        'auth:/api/auth*'
    ]);

    const io = getIo(); // Get the Socket.IO instance
    if (io) {
        // Notify admin dashboard about user update
        io.to('admin_dashboard').emit('userUpdated', {
            userId: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            roles: updatedUser.roles,
            message: `User "${updatedUser.name}" (${updatedUser.email}) profile updated.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'userUpdated' for admin dashboard.`);

        // Notify the specific user if they are online and it's their profile
        io.to(`user:${updatedUser._id.toString()}`).emit('profileUpdated', {
            userId: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            message: `Your profile details have been updated.`,
            timestamp: new Date()
        });
        console.log(`Socket.IO: Emitted 'profileUpdated' to user: ${updatedUser._id}`);
    }

    res.status(200).json({
        success: true,
        data: updatedUser
    });
});

const logoutUser = asyncHandler(async (req, res) => {
    const io = getIo(); // Get the Socket.IO instance
    const userId = req.user ? req.user.id : null; // Get user ID from authenticated request

    if (userId && io) {
        // Notify the specific user's socket room about logout (optional, but good for immediate UI feedback)
        io.to(`user:${userId.toString()}`).emit('loggedOut', {
            message: 'You have been successfully logged out.',
            timestamp: new Date()
        });
        // Disconnect their socket from the user-specific room
        // Note: Socket.IO typically manages room leaves on disconnect, but this is explicit.
        // A direct socket.disconnect() is usually better handled on the client side upon receiving 'loggedOut'.
        // However, if you want to force it server-side:
        // You'd need to track socket IDs per user, which is more complex.
        // For now, emitting 'loggedOut' is sufficient.
        console.log(`Socket.IO: Emitted 'loggedOut' to user: ${userId}`);
    }

    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000), // Expire immediately (10 seconds from now)
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
    });
    res.status(200).json({ message: 'Logged out successfully' });
});


module.exports = { registerUser, authUser, getUserProfile, deleteUserProfile, updateUserById, logoutUser };