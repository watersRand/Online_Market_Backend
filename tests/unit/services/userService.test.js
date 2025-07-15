// tests/unit/services/userService.test.js
const mongoose = require('mongoose');
const Mockgoose = require('mockgoose').Mockgoose;
const { createUser, findUserByEmail } = require('../models/user.test');
const User = require('../../../models/User'); // Assume Mongoose User model


describe('UserService Unit Tests', () => {
    let mockgoose;

    beforeAll(async () => {
        // Initialize Mockgoose and connect Mongoose to it
        mockgoose = new Mockgoose(mongoose);
        await mockgoose.prepareStorage();
        await mongoose.connect('mongodb://localhost/mock-db', { useNewUrlParser: true, useUnifiedTopology: true });
    });

    afterEach(async () => {
        // Clear the mock database after each test to ensure isolation
        await User.deleteMany({});
    });

    afterAll(async () => {
        // Disconnect Mongoose from Mockgoose
        await mongoose.disconnect();
    });

    test('should create a new user successfully', async () => {
        const userData = { name: 'Unit Test User', email: 'unit@example.com', password: 'password123' };
        const user = await createUser(userData);

        expect(user).toBeDefined();
        expect(user.name).toBe(userData.name);
        expect(user.email).toBe(userData.email);

        // Verify it was saved in the mock DB
        const foundUser = await User.findById(user._id);
        expect(foundUser).toBeDefined();
        expect(foundUser.email).toBe(userData.email);
    });

    test('should find a user by email', async () => {
        const userData = { name: 'Search User', email: 'search@example.com', password: 'password123' };
        await new User(userData).save(); // Save directly to mock DB for setup

        const foundUser = await findUserByEmail('search@example.com');
        expect(foundUser).toBeDefined();
        expect(foundUser.name).toBe('Search User');
    });

    test('should return null if user not found by email', async () => {
        const foundUser = await findUserByEmail('nonexistent@example.com');
        expect(foundUser).toBeNull();
    });
});