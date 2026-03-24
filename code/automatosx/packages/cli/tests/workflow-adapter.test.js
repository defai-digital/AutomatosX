import { mkdirSync } from 'node:fs';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildWorkflowInput, dispatch, parseWorkflowCommandInput, preview, validateWorkflowInput, } from '../src/workflow-adapter.js';
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `workflow-adapter-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
describe('workflow adapter', () => {
    let tempDir;
    beforeEach(() => {
        tempDir = createTempDir();
    });
    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });
    it('builds command-specific previews', async () => {
        const commandInputs = [
            { id: 'ship', args: ['--scope', 'checkout', '--issue', 'AX-1'] },
            { id: 'architect', args: ['--request', 'Auth redesign'] },
            { id: 'audit', args: ['--scope', 'src/core', '--depth', 'deep'] },
            { id: 'qa', args: ['--target', 'checkout', '--url', 'https://localhost:3000'] },
            { id: 'release', args: ['--releaseVersion', '1.2.0', '--commits', 'a..b'] },
        ];
        for (const commandInput of commandInputs) {
            const input = parseWorkflowCommandInput(commandInput.id, commandInput.args);
            const commandPreview = await preview(input);
            expect(commandPreview.workflowId).toBe(commandInput.id);
            expect(commandPreview.artifactNames.length).toBeGreaterThan(0);
            expect(commandPreview.traceId).toMatch(/[0-9a-f-]{20,}/);
        }
    });
    it('validates required input values for architect', () => {
        const input = parseWorkflowCommandInput('architect', []);
        expect(validateWorkflowInput(input)).toBe('A request or input is required for architect');
    });
    it('builds runtime payloads for all five workflow commands', async () => {
        const ids = [
            'ship',
            'architect',
            'audit',
            'qa',
            'release',
        ];
        for (const commandId of ids) {
            const input = parseWorkflowCommandInput(commandId, ['--output-dir', tempDir], 'claude');
            const payload = buildWorkflowInput(input);
            expect(payload.workflowId).toBe(commandId);
            expect(payload.workflowName.length).toBeGreaterThan(0);
            expect(payload.options.outputDir).toBe(tempDir);
            expect(payload.options.provider).toBe('claude');
        }
    });
    it('returns preview status artifacts for all five workflow commands when --dry-run is set', async () => {
        const ids = [
            'ship',
            'architect',
            'audit',
            'qa',
            'release',
        ];
        for (const commandId of ids) {
            const input = parseWorkflowCommandInput(commandId, ['--output-dir', tempDir, '--dry-run'], 'claude');
            const result = await dispatch(input);
            expect(result.success).toBe(true);
            expect(result.manifestPath).toMatch(/manifest\.json$/);
            expect(result.summaryPath).toMatch(/summary\.json$/);
            const manifestPath = result.manifestPath ?? '';
            const summaryPath = result.summaryPath ?? '';
            const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
            const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
            expect(manifest.status).toBe('preview');
            expect(summary.status).toBe('preview');
            expect(manifest.workflow?.id).toBe(commandId);
        }
    });
    it('does not call runtime dispatch on dry-run', async () => {
        const input = parseWorkflowCommandInput('release', ['--output-dir', tempDir, '--dry-run'], 'claude');
        let called = 0;
        const result = await dispatch(input, {
            runtimeDispatcher: async () => {
                called += 1;
                return {
                    success: true,
                    traceId: input.traceContext?.parentTraceId ?? 'unused',
                    outputDir: tempDir,
                    manifestPath: join(tempDir, 'manifest.json'),
                    summaryPath: join(tempDir, 'summary.json'),
                };
            },
        });
        expect(result.success).toBe(true);
        expect(called).toBe(0);
    });
    it('propagates provided trace context through dispatch artifact updates', async () => {
        const input = parseWorkflowCommandInput('qa', ['target-service', '--url', 'https://localhost:3000', '--output-dir', tempDir], 'claude');
        input.traceContext = { parentTraceId: 'trace-parent-123' };
        const result = await dispatch(input, {
            runtimeDispatcher: async (payload) => {
                expect(payload.traceId).toBe('trace-parent-123');
                return {
                    success: true,
                    traceId: payload.traceId,
                    outputDir: tempDir,
                    manifestPath: join(tempDir, 'manifest.json'),
                    summaryPath: join(tempDir, 'summary.json'),
                };
            },
        });
        expect(result.success).toBe(true);
        expect(result.traceId).toBe('trace-parent-123');
    });
    it('does not implicitly reuse preview trace ids during dispatch', async () => {
        const input = parseWorkflowCommandInput('ship', ['--scope', 'checkout', '--output-dir', tempDir], 'claude');
        const commandPreview = await preview(input);
        const result = await dispatch(input, {
            runtimeDispatcher: async (payload) => ({
                success: true,
                traceId: payload.traceId,
                outputDir: tempDir,
                manifestPath: join(tempDir, 'manifest.json'),
                summaryPath: join(tempDir, 'summary.json'),
            }),
        });
        expect(result.success).toBe(true);
        expect(result.traceId).not.toBe(commandPreview.traceId);
    });
    it('returns success when dispatch uses a custom runtime dispatcher', async () => {
        const input = parseWorkflowCommandInput('qa', ['target-service', '--url', 'https://localhost:3000', '--output-dir', tempDir]);
        const runtimeDispatchedPath = join(tempDir, 'runtime-dispatched.txt');
        const result = await dispatch(input, {
            runtimeDispatcher: async (payload) => {
                await writeFile(runtimeDispatchedPath, `trace=${payload.traceId}`, 'utf8');
                return {
                    success: true,
                    traceId: payload.traceId,
                    outputDir: tempDir,
                    manifestPath: join(tempDir, 'manifest.json'),
                    summaryPath: join(tempDir, 'summary.json'),
                };
            },
        });
        expect(result.success).toBe(true);
        const runtimePayload = await readFile(runtimeDispatchedPath, 'utf8');
        expect(runtimePayload).toContain('trace=');
    });
});
