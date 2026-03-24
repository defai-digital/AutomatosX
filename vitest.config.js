import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
/**
 * Vite plugin to mark all `node:*` built-in specifiers as external.
 * This is necessary for newer Node built-ins like `node:sqlite` that Vite
 * doesn't recognise in its built-in list and therefore tries to bundle.
 */
function nodeBuiltinsPlugin() {
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
        alias: {
            'node:sqlite': resolve(__dirname, 'tests/support/node-sqlite-shim.ts'),
            '@defai.digital/contracts': resolve(__dirname, 'packages/contracts/src/index.ts'),
            '@defai.digital/mcp-server': resolve(__dirname, 'packages/mcp-server/src/index.ts'),
            '@defai.digital/monitoring': resolve(__dirname, 'packages/monitoring/src/index.ts'),
            '@defai.digital/shared-runtime': resolve(__dirname, 'packages/shared-runtime/src/index.ts'),
            '@defai.digital/state-store': resolve(__dirname, 'packages/state-store/src/index.ts'),
            '@defai.digital/trace-store': resolve(__dirname, 'packages/trace-store/src/index.ts'),
            '@defai.digital/workflow-engine': resolve(__dirname, 'packages/workflow-engine/src/index.ts'),
        },
    },
});
