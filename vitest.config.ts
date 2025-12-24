import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths({ root: __dirname })],
  resolve: {
    alias: {
      '@automatosx/contracts': resolve(
        __dirname,
        'packages/contracts/src/index.ts'
      ),
      '@automatosx/workflow-engine': resolve(
        __dirname,
        'packages/core/workflow-engine/src/index.ts'
      ),
      '@automatosx/routing-engine': resolve(
        __dirname,
        'packages/core/routing-engine/src/index.ts'
      ),
      '@automatosx/memory-domain': resolve(
        __dirname,
        'packages/core/memory-domain/src/index.ts'
      ),
      '@automatosx/trace-domain': resolve(
        __dirname,
        'packages/core/trace-domain/src/index.ts'
      ),
      '@automatosx/agent-domain': resolve(
        __dirname,
        'packages/core/agent-domain/src/index.ts'
      ),
      '@automatosx/session-domain': resolve(
        __dirname,
        'packages/core/session-domain/src/index.ts'
      ),
      '@automatosx/token-budget': resolve(
        __dirname,
        'packages/core/token-budget/src/index.ts'
      ),
      '@automatosx/config-domain': resolve(
        __dirname,
        'packages/core/config-domain/src/index.ts'
      ),
      '@automatosx/sqlite-adapter': resolve(
        __dirname,
        'packages/adapters/sqlite/src/index.ts'
      ),
      '@automatosx/provider-adapters': resolve(
        __dirname,
        'packages/adapters/providers/src/index.ts'
      ),
      '@automatosx/provider-detection': resolve(
        __dirname,
        'packages/adapters/provider-detection/src/index.ts'
      ),
      '@automatosx/cli': resolve(
        __dirname,
        'packages/cli/src/index.ts'
      ),
      '@automatosx/mcp-server': resolve(
        __dirname,
        'packages/mcp-server/src/index.ts'
      ),
      '@automatosx/cross-cutting': resolve(
        __dirname,
        'packages/core/cross-cutting/src/index.ts'
      ),
      '@automatosx/provider-domain': resolve(
        __dirname,
        'packages/core/provider-domain/src/index.ts'
      ),
      '@automatosx/guard': resolve(
        __dirname,
        'packages/guard/src/index.ts'
      ),
      '@automatosx/agent-execution': resolve(
        __dirname,
        'packages/core/agent-execution/src/index.ts'
      ),
      '@automatosx/context-domain': resolve(
        __dirname,
        'packages/core/context-domain/src/index.ts'
      ),
      '@automatosx/iterate-domain': resolve(
        __dirname,
        'packages/core/iterate-domain/src/index.ts'
      ),
      '@automatosx/ability-domain': resolve(
        __dirname,
        'packages/core/ability-domain/src/index.ts'
      ),
      '@automatosx/analysis-domain': resolve(
        __dirname,
        'packages/core/analysis-domain/src/index.ts'
      ),
      '@automatosx/review-domain': resolve(
        __dirname,
        'packages/core/review-domain/src/index.ts'
      ),
      '@automatosx/resilience-domain': resolve(
        __dirname,
        'packages/core/resilience-domain/src/index.ts'
      ),
      '@automatosx/mcp-runtime': resolve(
        __dirname,
        'packages/core/mcp-runtime/src/index.ts'
      ),
      '@automatosx/contracts/resilience/v1': resolve(
        __dirname,
        'packages/contracts/src/resilience/v1/index.ts'
      ),
      '@automatosx/contracts/resilience/v1/index.js': resolve(
        __dirname,
        'packages/contracts/src/resilience/v1/index.ts'
      ),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
    },
    typecheck: {
      enabled: false,
    },
  },
});
