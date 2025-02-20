// This file runs before all tests
import { afterAll, afterEach, beforeAll } from 'vitest';

// Add any global setup/teardown here
beforeAll(() => {
  // Setup any test environment variables
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clean up after each test
  // For example, clear any mocks
});

afterAll(() => {
  // Global cleanup after all tests
});
