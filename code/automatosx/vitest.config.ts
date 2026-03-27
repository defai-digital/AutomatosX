import { defineConfig, type Plugin } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Vite plugin to mark all `node:*` built-in specifiers as external.
 * This is necessary for newer Node built-ins like `node:sqlite` that Vite
 * doesn't recognise in its built-in list and therefore tries to bundle.
 */
function nodeBuiltinsPlugin(): Plugin {
  return {
    name: 'node-builtins-external',
    enforce: 'pre',
    resolveId(id) {
      if (id.startsWith('node:')) {
        // Return the id with a special marker so Vite treats it as external
        return { id, external: true };
      }
      if (id === 'sqlite') {
        return { id: 'node:sqlite', external: true };
      }
    },
  };
}

export default defineConfig({
  plugins: [nodeBuiltinsPlugin()],
  test: {
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
  },
  resolve: {
    alias: [
      {
        find: '@defai.digital/shared-runtime/bridge',
        replacement: resolve(__dirname, 'packages/shared-runtime/src/runtime-public-bridge-exports.ts'),
      },
      {
        find: '@defai.digital/shared-runtime/governance',
        replacement: resolve(__dirname, 'packages/shared-runtime/src/runtime-public-governance-exports.ts'),
      },
      {
        find: '@defai.digital/shared-runtime/catalog',
        replacement: resolve(__dirname, 'packages/shared-runtime/src/runtime-public-catalog-exports.ts'),
      },
      {
        find: '@defai.digital/shared-runtime',
        replacement: resolve(__dirname, 'packages/shared-runtime/src/index.ts'),
      },
      {
        find: '@defai.digital/contracts',
        replacement: resolve(__dirname, 'packages/contracts/src/index.ts'),
      },
      {
        find: '@defai.digital/mcp-server',
        replacement: resolve(__dirname, 'packages/mcp-server/src/index.ts'),
      },
      {
        find: '@defai.digital/monitoring',
        replacement: resolve(__dirname, 'packages/monitoring/src/index.ts'),
      },
      {
        find: '@defai.digital/state-store',
        replacement: resolve(__dirname, 'packages/state-store/src/index.ts'),
      },
      {
        find: '@defai.digital/trace-store',
        replacement: resolve(__dirname, 'packages/trace-store/src/index.ts'),
      },
      {
        find: '@defai.digital/workflow-engine',
        replacement: resolve(__dirname, 'packages/workflow-engine/src/index.ts'),
      },
      {
        find: 'node:sqlite',
        replacement: resolve(__dirname, 'tests/support/node-sqlite-shim.ts'),
      },
    ],
  },
});
