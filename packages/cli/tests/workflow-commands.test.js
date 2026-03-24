import { mkdirSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKFLOW_COMMAND_DEFINITIONS, architectCommand, auditCommand, getWorkflowCommandDefinition, helpCommand, qaCommand, releaseCommand, shipCommand, } from '../src/commands/index.js';
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `workflow-commands-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
function defaultOptions(overrides = {}) {
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
        ...overrides,
    };
}
describe('workflow commands', () => {
    const tempDirs = [];
    afterEach(async () => {
        await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
    });
    it('registers ship and architect as stable first-class workflow commands', () => {
        const commands = WORKFLOW_COMMAND_DEFINITIONS.map((definition) => definition.command);
        expect(commands).toContain('ship');
        expect(commands).toContain('architect');
        expect(commands).toContain('audit');
        expect(commands).toContain('qa');
        expect(commands).toContain('release');
        expect(WORKFLOW_COMMAND_DEFINITIONS.every((definition) => definition.stable)).toBe(true);
        expect(getWorkflowCommandDefinition('ship')).toMatchObject({
            command: 'ship',
            stable: true,
            handler: shipCommand,
        });
        expect(getWorkflowCommandDefinition('architect')).toMatchObject({
            command: 'architect',
            stable: true,
            handler: architectCommand,
        });
    });
    it('runs audit, qa, and release as first-class workflow commands with shared trace/artifact behavior', async () => {
        const commandCases = [
            {
                name: 'audit',
                handler: auditCommand,
                args: ['--scope', 'src/core'],
                traceId: 'audit-trace-001',
            },
            {
                name: 'qa',
                handler: qaCommand,
                args: ['--target', 'checkout', '--url', 'https://localhost:3000'],
                traceId: 'qa-trace-001',
            },
            {
                name: 'release',
                handler: releaseCommand,
                args: ['--release-version', '14.0.0'],
                traceId: 'release-trace-001',
            },
        ];
        for (const commandCase of commandCases) {
            const tempDir = createTempDir();
            tempDirs.push(tempDir);
            const result = await commandCase.handler(commandCase.args, defaultOptions({
                outputDir: tempDir,
                traceId: commandCase.traceId,
            }));
            expect(result.success).toBe(true);
            expect(result.message).toContain(`Workflow ${commandCase.name} dispatched with trace ${commandCase.traceId}`);
            const data = result.data;
            expect(data.traceId).toBe(commandCase.traceId);
            expect(data.workflow?.workflowId).toBe(commandCase.name);
            expect(data.workflow?.traceId).toBe(commandCase.traceId);
            const manifest = JSON.parse(await readFile(data.manifestPath ?? '', 'utf8'));
            expect(manifest.status).toBe('dispatched');
            expect(manifest.traceId).toBe(commandCase.traceId);
            expect(manifest.workflow?.id).toBe(commandCase.name);
        }
    });
    it('returns workflow-first help and quickstart content', async () => {
        const result = await helpCommand([], defaultOptions());
        expect(result.success).toBe(true);
        expect(result.message).toContain('Workflow-first default surface');
        expect(result.message).toContain('ax ship');
        expect(result.message).toContain('ax architect');
        expect(result.message).toContain('ax audit');
        expect(result.message).toContain('ax qa');
        expect(result.message).toContain('ax release');
        expect(result.message).toContain('ax setup');
        expect(result.message).toContain('ax init');
        expect(result.message).toContain('ax list');
        expect(result.message).toContain('ax trace');
        expect(result.message).toContain('ax discuss');
        expect(result.message).toContain('ax agent');
        expect(result.message).toContain('ax mcp');
        expect(result.message).toContain('ax session');
        expect(result.message).toContain('ax review');
        const data = result.data;
        expect(data.workflowFirst).toBe(true);
        expect(data.quickstart).toContain('Use --dry-run');
        expect(data.commands?.map((entry) => entry.command)).toEqual(expect.arrayContaining([
            'ship',
            'architect',
            'audit',
            'qa',
            'release',
            'setup',
            'init',
            'list',
            'trace',
            'discuss',
            'agent',
            'mcp',
            'session',
            'review',
        ]));
        expect(data.commands?.every((entry) => entry.stable)).toBe(true);
    });
    it('runs ship dry-run through dispatch and writes preview artifacts', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const result = await shipCommand(['--scope', 'checkout'], defaultOptions({
            dryRun: true,
            outputDir: tempDir,
            traceId: 'ship-trace-001',
        }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('Dry-run completed for ship');
        const data = result.data;
        expect(data.traceId).toBe('ship-trace-001');
        expect(data.workflow?.traceId).toBe('ship-trace-001');
        const manifest = JSON.parse(await readFile(data.manifestPath ?? '', 'utf8'));
        const summary = JSON.parse(await readFile(data.summaryPath ?? '', 'utf8'));
        expect(manifest.status).toBe('preview');
        expect(summary.status).toBe('preview');
        expect(manifest.traceId).toBe('ship-trace-001');
        expect(summary.traceId).toBe('ship-trace-001');
    });
    it('runs architect through the shared adapter and returns dispatched artifacts with trace propagation', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const result = await architectCommand(['--request', 'Design auth system'], defaultOptions({
            outputDir: tempDir,
            traceId: 'architect-trace-001',
        }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('Workflow architect dispatched with trace architect-trace-001');
        const data = result.data;
        expect(data.traceId).toBe('architect-trace-001');
        expect(data.workflow?.traceId).toBe('architect-trace-001');
        expect(data.workflow?.workflowId).toBe('architect');
        const manifest = JSON.parse(await readFile(data.manifestPath ?? '', 'utf8'));
        expect(manifest.status).toBe('dispatched');
        expect(manifest.traceId).toBe('architect-trace-001');
        expect(manifest.workflow?.id).toBe('architect');
    });
});
