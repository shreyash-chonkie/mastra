import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['commonjs.test.ts'],
    globalSetup: ['./setup.ts'],
  },
});
