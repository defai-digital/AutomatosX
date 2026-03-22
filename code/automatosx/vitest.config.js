import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
    test: {
        environment: 'node',
        include: [
            'packages/**/*.test.ts',
            'tests/**/*.test.ts',
        ],
    },
    resolve: {
        alias: {
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
