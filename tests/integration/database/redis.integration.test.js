// tests/integration/database/redis.integration.test.js
// Access the Redis client set up in globalSetup
// const redisClient = global.__REDIS_CLIENT__;
let redisClient;

describe('Redis Integration Tests', () => {

    // Use beforeAll to ensure the global client is available before any tests run
    beforeAll(() => {
        // Assign the global client here, where we're guaranteed globalSetup has run
        redisClient = global.__REDIS_CLIENT__;
        if (!redisClient) {
            throw new Error('Redis client (global.__REDIS_CLIENT__) is not defined. Check globalSetup.js and Redis connection.');
        }
    });


    beforeEach(async () => {
        // Clear the specific test Redis database before each test
        await redisClient.flushdb();
    });

    test('should set and get a simple string key-value pair', async () => {
        await redisClient.set('testStringKey', 'Hello Redis');
        const value = await redisClient.get('testStringKey');
        expect(value).toBe('Hello Redis');
    });

    test('should set and get an object (JSON stringified)', async () => {
        const testObject = { id: 1, message: 'This is a test object' };
        await redisClient.set('testObjectKey', JSON.stringify(testObject));
        const retrieved = await redisClient.get('testObjectKey');
        expect(JSON.parse(retrieved)).toEqual(testObject);
    });

    test('should expire a key after specified time', async () => {
        await redisClient.setex('expiringKey', 1, 'ephemeralValue'); // 1 second expiry
        const valueBeforeExpiry = await redisClient.get('expiringKey');
        expect(valueBeforeExpiry).toBe('ephemeralValue');

        // Wait for more than 1 second
        await new Promise(resolve => setTimeout(resolve, 1500));

        const valueAfterExpiry = await redisClient.get('expiringKey');
        expect(valueAfterExpiry).toBeNull();
    });
});