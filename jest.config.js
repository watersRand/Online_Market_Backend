// jest.config.js
module.exports = {
    // Use 'node' for backend tests
    testEnvironment: 'node',
    // Look for test files in 'tests' directory with specific suffixes
    testMatch: [
        '**/tests/unit/**/*.test.js',
        '**/tests/integration/**/*.integration.test.js'
    ],
    // Collect code coverage
    collectCoverage: true,
    coverageDirectory: 'coverage',
    // Exclude specific files from coverage (e.g., config, test files themselves)
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/tests/',
        '/config/',
        '/server.js' // Your main server file might not need coverage
    ],
    // Global setup/teardown for tests, especially integration tests
    globalSetup: './tests/setup.js',
    globalTeardown: './tests/teardown.js',
    // Time out after 30 seconds for tests that involve external services
    testTimeout: 30000,
};