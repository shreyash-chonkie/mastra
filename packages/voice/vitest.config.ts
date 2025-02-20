import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['src/**/*.d.ts', 'dist/**', 'node_modules/**'],
    },
    testTimeout: 10000,
    setupFiles: ['src/test/setup.ts'],
    watchExclude: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
});
