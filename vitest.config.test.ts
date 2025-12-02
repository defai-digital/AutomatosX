import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/config.test.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        isolate: true,
        minThreads: 1,
        maxThreads: 1,
        useAtomics: true
      }
    },
    fileParallelism: false,
    maxConcurrency: 1,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    logHeapUsage: true,
    coverage: {
      enabled: false
    }
  },
  resolve: {
    alias: {
      '@': './src',
      '@tests': './tests'
    }
  }
});