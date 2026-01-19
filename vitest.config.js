import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({
    plugins: [tsconfigPaths({ root: __dirname })],
    resolve: {
        alias: {
            '@defai.digital/contracts': resolve(__dirname, 'packages/contracts/src/index.ts'),
            '@defai.digital/workflow-engine': resolve(__dirname, 'packages/core/workflow-engine/src/index.ts'),
            '@defai.digital/routing-engine': resolve(__dirname, 'packages/core/routing-engine/src/index.ts'),
            '@defai.digital/memory-domain': resolve(__dirname, 'packages/core/memory-domain/src/index.ts'),
            '@defai.digital/trace-domain': resolve(__dirname, 'packages/core/trace-domain/src/index.ts'),
            '@defai.digital/agent-domain': resolve(__dirname, 'packages/core/agent-domain/src/index.ts'),
            '@defai.digital/session-domain': resolve(__dirname, 'packages/core/session-domain/src/index.ts'),
            '@defai.digital/token-budget': resolve(__dirname, 'packages/core/token-budget/src/index.ts'),
            '@defai.digital/config-domain': resolve(__dirname, 'packages/core/config-domain/src/index.ts'),
            '@defai.digital/sqlite-adapter': resolve(__dirname, 'packages/adapters/sqlite/src/index.ts'),
            '@defai.digital/provider-adapters': resolve(__dirname, 'packages/adapters/providers/src/index.ts'),
            '@defai.digital/provider-detection': resolve(__dirname, 'packages/adapters/provider-detection/src/index.ts'),
            '@defai.digital/cli': resolve(__dirname, 'packages/cli/src/index.ts'),
            '@defai.digital/mcp-server': resolve(__dirname, 'packages/mcp-server/src/index.ts'),
            '@defai.digital/cross-cutting': resolve(__dirname, 'packages/core/cross-cutting/src/index.ts'),
            '@defai.digital/provider-domain': resolve(__dirname, 'packages/core/provider-domain/src/index.ts'),
            '@defai.digital/guard': resolve(__dirname, 'packages/guard/src/index.ts'),
            '@defai.digital/agent-execution': resolve(__dirname, 'packages/core/agent-execution/src/index.ts'),
            '@defai.digital/context-domain': resolve(__dirname, 'packages/core/context-domain/src/index.ts'),
            '@defai.digital/iterate-domain': resolve(__dirname, 'packages/core/iterate-domain/src/index.ts'),
            '@defai.digital/ability-domain': resolve(__dirname, 'packages/core/ability-domain/src/index.ts'),
            '@defai.digital/analysis-domain': resolve(__dirname, 'packages/core/analysis-domain/src/index.ts'),
            '@defai.digital/review-domain': resolve(__dirname, 'packages/core/review-domain/src/index.ts'),
            '@defai.digital/resilience-domain': resolve(__dirname, 'packages/core/resilience-domain/src/index.ts'),
            '@defai.digital/mcp-runtime': resolve(__dirname, 'packages/core/mcp-runtime/src/index.ts'),
            '@defai.digital/contracts/resilience/v1': resolve(__dirname, 'packages/contracts/src/resilience/v1/index.ts'),
            '@defai.digital/contracts/resilience/v1/index.js': resolve(__dirname, 'packages/contracts/src/resilience/v1/index.ts'),
            '@defai.digital/agent-parallel': resolve(__dirname, 'packages/core/agent-parallel/src/index.ts'),
            '@defai.digital/semantic-context': resolve(__dirname, 'packages/core/semantic-context/src/index.ts'),
            '@defai.digital/mcp-ecosystem': resolve(__dirname, 'packages/core/mcp-ecosystem/src/index.ts'),
            '@defai.digital/autonomous-loop': resolve(__dirname, 'packages/core/autonomous-loop/src/index.ts'),
            '@defai.digital/research-domain': resolve(__dirname, 'packages/core/research-domain/src/index.ts'),
            '@defai.digital/feedback-domain': resolve(__dirname, 'packages/core/feedback-domain/src/index.ts'),
            '@defai.digital/discussion-domain': resolve(__dirname, 'packages/core/discussion-domain/src/index.ts'),
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