import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      'node_modules',
      '.next',
      'tests/e2e/**',
      // Pre-existing console.log-style test files (not vitest-compatible).
      'src/lib/__tests__/sessionWorkoutResolver.test.ts',
      'src/lib/__tests__/userFetchUtils.test.ts',
    ],
    setupFiles: ['src/test/vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
