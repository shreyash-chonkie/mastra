import dotenv from 'dotenv';

import { defineConfig } from 'vitest/config';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
