import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest configuration.
 *
 * - Excludes the Playwright E2E specs (e2e/*.spec.ts) which otherwise match
 *   Vitest's default test glob and fail because @playwright/test's
 *   test.describe() cannot run outside the Playwright runner.
 * - Re-uses the @/ path alias from tsconfig.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'e2e'],
  },
});
