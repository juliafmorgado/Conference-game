/**
 * Jest test setup file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.CONFIGMAP_PATH = '/tmp/test-configmap';
process.env.WATCH_CONFIG_CHANGES = 'false';
process.env.CONTENT_CACHE_TIMEOUT = '1000';

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});