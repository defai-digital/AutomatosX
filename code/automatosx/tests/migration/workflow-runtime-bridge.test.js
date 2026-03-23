import { mkdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { dispatch, parseWorkflowCommandInput } from '../../packages/cli/src/workflow-adapter.js';
import { runCommand } from '../../packages/cli/src/commands/run.js';
const COMMAND_CASES = [
    { commandId: 'ship', args: ['--scope', 'checkout'] },
    { commandId: 'architect', args: ['--request', 'Design auth system'] },
    { commandId: 'audit', args: ['--scope', 'src/core'] },
    { commandId: 'qa', args: ['--target', 'checkout', '--url', 'https://localhost:3000'] },
    { commandId: 'release', args: ['--releaseVersion', '14.0.0'] },
];
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `workflow-runtime-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
function defaultOptions() {
    return {
        help: false,
        version: false,
        verbose: false,
        format: 'text',
        workflowDir: undefined,
        workflowId: undefined,
        traceId: undefined,
        limit: undefined,
        input: undefined,
        iterate: false,
        maxIterations: undefined,
        maxTime: undefined,
        noContext: false,
        category: undefined,
        tags: undefined,
        agent: undefined,
        task: undefined,
        core: undefined,
        maxTokens: undefined,
        refresh: undefined,
        compact: false,
        team: undefined,
        provider: 'claude',
        outputDir: undefined,
        dryRun: false,
        quiet: false,
    };
}
describe('v14 workflow runtime bridge', () => {
    const tempDirs = [];
    afterEach(async () => {
        await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
    });
    it('runs real workflow definitions through runCommand', async () => {
        for (const commandCase of COMMAND_CASES) {
            const result = await runCommand([commandCase.commandId], defaultOptions());
            expect(result.success).toBe(true);
            expect(result.message).toContain(`Workflow "${commandCase.commandId}" completed successfully.`);
            const data = result.data;
            expect(data.output?.content).toContain('Prompt:');
            expect(data.output?.provider).toBe('claude');
            expect(data.output?.model).toBe('v14-runtime-bridge');
            expect(data.output?.status).toBeUndefined();
        }
    });
    it('preserves workflowId in trace input when the workflow is selected via --workflow-id', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const result = await runCommand([], {
            ...defaultOptions(),
            workflowId: 'ship',
            outputDir: tempDir,
        });
        expect(result.success).toBe(true);
        const data = result.data;
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const trace = await runtime.getTrace(data.traceId ?? '');
        expect(trace?.input).toMatchObject({
            workflowId: 'ship',
        });
    });
    it('dispatches all five workflow commands through the runtime bridge and writes dispatched artifacts', async () => {
        for (const commandCase of COMMAND_CASES) {
            const tempDir = createTempDir();
            tempDirs.push(tempDir);
            const input = parseWorkflowCommandInput(commandCase.commandId, [...commandCase.args, '--output-dir', tempDir], 'claude');
            input.traceContext = { parentTraceId: `${commandCase.commandId}-runtime-trace` };
            const result = await dispatch(input);
            expect(result.success).toBe(true);
            expect(result.traceId).toBe(`${commandCase.commandId}-runtime-trace`);
            const manifest = JSON.parse(await readFile(result.manifestPath ?? '', 'utf8'));
            const summary = JSON.parse(await readFile(result.summaryPath ?? '', 'utf8'));
            expect(manifest.status).toBe('dispatched');
            expect(summary.status).toBe('dispatched');
            expect(manifest.traceId).toBe(`${commandCase.commandId}-runtime-trace`);
            expect(summary.traceId).toBe(`${commandCase.commandId}-runtime-trace`);
        }
    });
    it('runs prompt, tool, and discuss steps through the production-shaped executor path', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await writeFile(join(tempDir, 'full-runtime.json'), JSON.stringify({
            workflowId: 'full-runtime',
            name: 'Full Runtime Workflow',
            version: '1.0.0',
            steps: [
                {
                    stepId: 'prompt-step',
                    type: 'prompt',
                    config: {
                        prompt: 'Inspect migration scope.',
                    },
                },
                {
                    stepId: 'tool-step',
                    type: 'tool',
                    config: {
                        toolName: 'lint',
                        toolInput: {
                            target: 'packages/cli',
                        },
                    },
                },
                {
                    stepId: 'discuss-step',
                    type: 'discuss',
                    config: {
                        prompt: 'Compare rollout options.',
                        providers: ['claude', 'openai'],
                        pattern: 'synthesis',
                    },
                },
            ],
        }, null, 2), 'utf8');
        const result = await runCommand(['full-runtime'], {
            ...defaultOptions(),
            workflowDir: tempDir,
        });
        expect(result.success).toBe(true);
        const data = result.data;
        expect(data.steps).toMatchObject([
            { stepId: 'prompt-step', success: true },
            { stepId: 'tool-step', success: true },
            { stepId: 'discuss-step', success: true },
        ]);
        expect(data.output).toMatchObject({
            type: 'discuss',
            participatingProviders: ['claude', 'openai'],
        });
        expect(data.output?.synthesis).toContain('Compare rollout options.');
    });
});
