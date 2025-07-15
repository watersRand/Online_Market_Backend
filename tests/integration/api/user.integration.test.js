// tests/integration/api/user.integration.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { startServer } = require('../../../server'); // Your Express app instance
const User = require('../../../models/User'); // Your Mongoose model

describe('User API Integration Tests', () => {
    // We don't need beforeAll/afterAll for DB connection here
    // because globalSetup/Teardown handle it for all integration tests.

    beforeEach(async () => {
        // Clear user collection before each test
        await User.deleteMany({});
    });

    test('POST /users should create a new user', async () => {
        const userData = { name: 'Integration User', email: 'integration@example.com', password: 'password123' };
        const res = await request(startServer)
            .post('/users')
            .send(userData)
            .expect(201); // Expect HTTP 201 Created

        expect(res.body).toHaveProperty('_id');
        expect(res.body.name).toBe(userData.name);
        expect(res.body.email).toBe(userData.email);

        // Verify user exists in the actual MongoDB
        const userInDb = await User.findById(res.body._id);
        expect(userInDb).toBeDefined();
        expect(userInDb.email).toBe(userData.email);
    });

    test('GET /users/:id should retrieve an existing user', async () => {
        const userData = { name: 'Existing User', email: 'existing@example.com', password: 'password123' };
        const existingUser = await new User(userData).save(); // Save directly to actual DB for setup

        const res = await request(startServer)
            .get(`/users/${existingUser._id}`)
            .expect(200);

        expect(res.body._id).toBe(existingUser._id.toString());
        expect(res.body.name).toBe(existingUser.name);
    });

    test('GET /users/:id should return 404 for non-existent user', async () => {
        const nonExistentId = new mongoose.Types.ObjectId(); // Create a valid but non-existent ID
        await request(startServer)
            .get(`/users/${nonExistentId}`)
            .expect(404);
    });
});