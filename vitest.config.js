import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
export default defineConfig({
    resolve: {
        alias: {
            '@automatosx/contracts': resolve(__dirname, 'packages/contracts/src/index.ts'),
            '@automatosx/workflow-engine': resolve(__dirname, 'packages/core/workflow-engine/src/index.ts'),
            '@automatosx/routing-engine': resolve(__dirname, 'packages/core/routing-engine/src/index.ts'),
            '@automatosx/memory-domain': resolve(__dirname, 'packages/core/memory-domain/src/index.ts'),
            '@automatosx/trace-domain': resolve(__dirname, 'packages/core/trace-domain/src/index.ts'),
            '@automatosx/sqlite-adapter': resolve(__dirname, 'packages/adapters/sqlite/src/index.ts'),
            '@automatosx/provider-adapters': resolve(__dirname, 'packages/adapters/providers/src/index.ts'),
            '@automatosx/cli': resolve(__dirname, 'packages/cli/src/index.ts'),
            '@automatosx/mcp-server': resolve(__dirname, 'packages/mcp-server/src/index.ts'),
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
//# sourceMappingURL=vitest.config.js.map