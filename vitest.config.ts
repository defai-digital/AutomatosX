import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,      // 60 seconds per test (increased for slow async tests)
    hookTimeout: 60000,       // 60 seconds for hooks
    teardownTimeout: 10000,   // 10 seconds for teardown

    // TypeScript type-checking in watch mode (immediate feedback for test authors)
    typecheck: {
      enabled: false,         // Disabled by default (use test:typecheck script for explicit checks)
      tsconfig: './tsconfig.json',
      include: ['tests/**/*.test.ts'],
      checker: 'tsc'
    },

    // Process pool configuration for native module safety
    // CRITICAL: Using 'forks' instead of 'threads' to prevent segfaults
    // with better-sqlite3 and sqlite-vec native modules during cleanup.
    // Worker threads share native module state, causing race conditions
    // when multiple threads terminate simultaneously.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,         // Isolate each test file in separate process
        minForks: 1,
        maxForks: 4,           // Limit concurrent forks to prevent memory issues
      }
    },

    // File parallelism and resource limits
    fileParallelism: true,
    maxConcurrency: 4,         // Max 4 tests running concurrently

    // Auto-cleanup for mocks and timers
    clearMocks: true,          // Auto-clear mocks after each test
    mockReset: true,           // Reset mock state after each test
    restoreMocks: true,        // Restore original implementations after each test
    unstubEnvs: true,          // Restore environment variables after each test
    unstubGlobals: true,       // Restore global objects after each test

    // Memory monitoring
    logHeapUsage: true,        // Log memory usage

    // Global setup and teardown
    setupFiles: ['./vitest.setup.ts'],
    globalTeardown: './vitest.global-teardown.ts',

    env: {
      // Always use mock providers in tests
      AX_MOCK_PROVIDERS: 'true'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tmp/',
        'tests/',
        '**/*.config.*',
        '**/*.d.ts'
      ]
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.automatosx']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './tests')
    }
  }
});
