// tests/setup.ts
// Jest setup file for test environment configuration

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3001';

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error logging for debugging
    error: console.error,
};

// Global test timeout
jest.setTimeout(10000);

// Mock fetch globally
global.fetch = jest.fn();

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
}); 