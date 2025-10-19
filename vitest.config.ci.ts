/**
 * Vitest Configuration for CI Environments
 *
 * Optimized for GitHub Actions and other CI platforms with limited resources.
 *
 * Key optimizations:
 * - Reduced thread pool size (2-4 threads for CI)
 * - Shorter timeouts to fail fast
 * - Disabled coverage for speed
 * - Verbose reporting for better CI logs
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  },
  test: {
    globals: true,
    environment: 'node',

    // CI-specific pool configuration
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 2,
        maxThreads: 4, // Limit for CI environments (2 core machines)
        useAtomics: true,
      },
    },

    // Shorter timeouts for CI - fail fast
    testTimeout: 10000,     // 10s (vs 30s default)
    hookTimeout: 10000,     // 10s (vs 30s default)
    teardownTimeout: 5000,  // 5s (vs 10s default)

    // Disable file watching in CI
    watch: false,

    // Process isolation for consistency
    isolate: true,

    // Memory optimization
    maxConcurrency: 4,      // Limit concurrent test files

    // CI-friendly reporting
    reporters: ['verbose'],

    // Disable coverage in CI for speed
    // (can be enabled separately if needed)
    coverage: {
      enabled: false,
    },

    // Global setup/teardown (optional, only if files exist)
    // globalSetup: './tests/setup/global-setup.ts',
    // globalTeardown: './tests/setup/global-teardown.ts',

    // Automatic cleanup
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,

    // Include/exclude patterns
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      '.automatosx',
      'automatosx',
      'coverage',
      '**/*.d.ts',
      'tests/setup/**',
      'tests/helpers/**',
    ],

    // Setup files (use existing vitest.setup.ts)
    setupFiles: ['./vitest.setup.ts'],
  },
});
