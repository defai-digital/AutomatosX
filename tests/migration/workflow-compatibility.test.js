import { mkdirSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { dispatch, parseWorkflowCommandInput, } from '../../packages/cli/src/workflow-adapter.js';
const COMMAND_CASES = [
    { commandId: 'ship', args: ['--scope', 'checkout', '--issue', 'AX-1'] },
    { commandId: 'architect', args: ['--request', 'Design auth service', '--constraints', 'low-risk rollout'] },
    { commandId: 'audit', args: ['--scope', 'src/core', '--depth', 'deep'] },
    { commandId: 'qa', args: ['--target', 'checkout', '--url', 'https://localhost:3000', '--scenario', 'smoke'] },
    { commandId: 'release', args: ['--releaseVersion', '14.0.0', '--target', 'production'] },
];
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `workflow-compat-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
describe('v14 migration workflow compatibility', () => {
    const tempDirs = [];
    afterEach(async () => {
        await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
    });
    it('preserves preview artifact contract for all five workflow commands', async () => {
        for (const commandCase of COMMAND_CASES) {
            const tempDir = createTempDir();
            tempDirs.push(tempDir);
            const input = parseWorkflowCommandInput(commandCase.commandId, [...commandCase.args, '--dry-run', '--output-dir', tempDir], 'claude');
            input.traceContext = { parentTraceId: `${commandCase.commandId}-preview-trace` };
            const result = await dispatch(input);
            expect(result.success).toBe(true);
            expect(result.traceId).toBe(`${commandCase.commandId}-preview-trace`);
            await expectWorkflowArtifacts(result.manifestPath, result.summaryPath, result.artifactPaths, {
                commandId: commandCase.commandId,
                status: 'preview',
                traceId: `${commandCase.commandId}-preview-trace`,
            });
        }
    });
    it('preserves dispatched artifact contract for all five workflow commands', async () => {
        for (const commandCase of COMMAND_CASES) {
            const tempDir = createTempDir();
            tempDirs.push(tempDir);
            const input = parseWorkflowCommandInput(commandCase.commandId, [...commandCase.args, '--output-dir', tempDir], 'claude');
            input.traceContext = { parentTraceId: `${commandCase.commandId}-dispatch-trace` };
            const result = await dispatch(input, {
                runtimeDispatcher: async (payload) => ({
                    success: true,
                    traceId: payload.traceId,
                    outputDir: tempDir,
                    manifestPath: join(tempDir, 'manifest.json'),
                    summaryPath: join(tempDir, 'summary.json'),
                    artifactPaths: [],
                }),
            });
            expect(result.success).toBe(true);
            expect(result.traceId).toBe(`${commandCase.commandId}-dispatch-trace`);
            await expectWorkflowArtifacts(result.manifestPath, result.summaryPath, result.artifactPaths, {
                commandId: commandCase.commandId,
                status: 'dispatched',
                traceId: `${commandCase.commandId}-dispatch-trace`,
            });
        }
    });
    it('preserves failed artifact contract for all five workflow commands', async () => {
        for (const commandCase of COMMAND_CASES) {
            const tempDir = createTempDir();
            tempDirs.push(tempDir);
            const input = parseWorkflowCommandInput(commandCase.commandId, [...commandCase.args, '--output-dir', tempDir], 'claude');
            input.traceContext = { parentTraceId: `${commandCase.commandId}-failed-trace` };
            const result = await dispatch(input, {
                runtimeDispatcher: async (payload) => ({
                    success: false,
                    traceId: payload.traceId,
                    outputDir: tempDir,
                    manifestPath: join(tempDir, 'manifest.json'),
                    summaryPath: join(tempDir, 'summary.json'),
                    artifactPaths: [],
                    errorCode: 'workflow_runtime_failed',
                    errorMessage: 'simulated runtime failure',
                }),
            });
            expect(result.success).toBe(false);
            expect(result.traceId).toBe(`${commandCase.commandId}-failed-trace`);
            expect(result.errorCode).toBe('workflow_runtime_failed');
            expect(result.errorMessage).toBe('simulated runtime failure');
            await expectWorkflowArtifacts(result.manifestPath, result.summaryPath, result.artifactPaths, {
                commandId: commandCase.commandId,
                status: 'failed',
                traceId: `${commandCase.commandId}-failed-trace`,
                error: 'simulated runtime failure',
            });
        }
    });
});
async function expectWorkflowArtifacts(manifestPath, summaryPath, artifactPaths, expected) {
    expect(manifestPath).toBeDefined();
    expect(summaryPath).toBeDefined();
    expect(artifactPaths).toBeDefined();
    expect((artifactPaths ?? []).length).toBeGreaterThan(0);
    const manifest = JSON.parse(await readFile(manifestPath ?? '', 'utf8'));
    const summary = JSON.parse(await readFile(summaryPath ?? '', 'utf8'));
    expect(manifest.workflow?.id).toBe(expected.commandId);
    expect(summary.workflow).toBe(expected.commandId);
    expect(manifest.traceId).toBe(expected.traceId);
    expect(summary.traceId).toBe(expected.traceId);
    expect(manifest.status).toBe(expected.status);
    expect(summary.status).toBe(expected.status);
    if (expected.error !== undefined) {
        expect(manifest.error).toBe(expected.error);
        expect(summary.error).toBe(expected.error);
    }
    for (const artifactPath of artifactPaths ?? []) {
        const artifact = await readFile(artifactPath, 'utf8');
        expect(artifact).toContain(`- Trace ID: ${expected.traceId}`);
        expect(artifact).toContain(`- Status: ${expected.status}`);
    }
}
