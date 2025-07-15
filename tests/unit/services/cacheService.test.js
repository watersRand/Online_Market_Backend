// tests/unit/services/cacheService.test.js
const { setCache, getCache, deleteCache } = require('../../../config/redis');
// const RedisMock = require('ioredis-mock');

// Jest mock for the ioredis module itself
jest.mock('ioredis', () => {
    // Ensure a new mock instance for each test run to prevent state leakage
    const RedisMock = require('ioredis-mock');
    return jest.fn(() => new RedisMock());
});

describe('CacheService Unit Tests', () => {
    let redisClientMock;

    beforeEach(() => {
        // Get the mocked Redis instance from the `jest.mock` call
        redisClientMock = new (require('ioredis'))();
        // Clear the mock Redis instance before each test
        redisClientMock.flushall();
    });

    test('should set a string value in cache', async () => {
        await setCache('myKey', 'myValue');
        const value = await redisClientMock.get('myKey');
        expect(value).toBe(JSON.stringify('myValue'));
    });

    test('should retrieve a string value from cache', async () => {
        await redisClientMock.set('myKey', JSON.stringify('myValue')); // Set via mock
        const value = await getCache('myKey'); // Retrieve via service
        expect(value).toBe('myValue');
    });

    test('should set and retrieve an object from cache', async () => {
        const data = { id: 1, name: 'Test Item' };
        await setCache('objectKey', data, 60);
        const retrievedData = await getCache('objectKey');
        expect(retrievedData).toEqual(data);
    });

    test('should return null for a non-existent key', async () => {
        const value = await getCache('nonExistentKey');
        expect(value).toBeNull();
    });

    test('should delete a key from cache', async () => {
        await redisClientMock.set('keyToDelete', 'value');
        await deleteCache('keyToDelete');
        const value = await redisClientMock.get('keyToDelete');
        expect(value).toBeNull();
    });
});