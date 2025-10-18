import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,      // 30 seconds per test (increased for integration tests)
    hookTimeout: 30000,       // 30 seconds for hooks
    teardownTimeout: 10000,   // 10 seconds for teardown

    // Thread pool configuration to prevent memory exhaustion
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,         // Isolate each test file for better stability
        minThreads: 1,
        maxThreads: 4,         // Limit concurrent threads to prevent memory issues
        useAtomics: true       // Better performance with worker threads
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
      AUTOMATOSX_MOCK_PROVIDERS: 'true'
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
