import { existsSync, mkdirSync } from 'node:fs';
import { readFile, rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { doctorCommand, discussCommand, initCommand, listCommand, setupCommand, traceCommand, } from '../src/commands/index.js';
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `retained-commands-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
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
describe('retained high-value commands', () => {
    const tempDirs = [];
    afterEach(async () => {
        delete process.env.AUTOMATOSX_AVAILABLE_CLIENTS;
        delete process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS;
        await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
    });
    it('bootstraps local workspace state with setup', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        process.env.AUTOMATOSX_AVAILABLE_CLIENTS = 'claude,gemini,codex';
        const result = await setupCommand([], defaultOptions({ outputDir: tempDir }));
        expect(result.success).toBe(true);
        const config = JSON.parse(await readFile(join(tempDir, '.automatosx', 'config.json'), 'utf8'));
        expect(config.workflowArtifactDir).toBe('.automatosx/workflows');
        expect(config.runtimeStoreDir).toBe('.automatosx/runtime');
        expect(result.message).toContain('Detected provider clients: claude, gemini, codex');
        const environment = JSON.parse(await readFile(join(tempDir, '.automatosx', 'environment.json'), 'utf8'));
        expect(environment.mcp?.command).toBe('ax');
        expect(environment.mcp?.args).toEqual(['mcp', 'serve']);
        expect(environment.providers).toEqual(expect.arrayContaining([
            expect.objectContaining({ providerId: 'claude', installed: true }),
            expect.objectContaining({ providerId: 'gemini', installed: true }),
            expect.objectContaining({ providerId: 'codex', installed: true }),
        ]));
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const agents = await runtime.listAgents();
        const policies = await runtime.listPolicies();
        expect(agents.map((agent) => agent.agentId)).toEqual([
            'architect',
            'bug-hunter',
            'quality',
            'release-manager',
        ]);
        expect(policies.map((policy) => policy.policyId)).toContain('workflow-artifact-contract');
    });
    it('creates project context and provider integration metadata with init', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';
        const result = await initCommand([], defaultOptions({ outputDir: tempDir }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('provider integration files');
        expect(await readFile(join(tempDir, 'AX.md'), 'utf8')).toContain('AutomatosX v14');
        expect(await readFile(join(tempDir, '.automatosx', 'context', 'conventions.md'), 'utf8')).toContain('Conventions');
        expect(await readFile(join(tempDir, '.automatosx', 'context', 'rules.md'), 'utf8')).toContain('Prefer first-class workflow commands');
        const mcpConfig = JSON.parse(await readFile(join(tempDir, '.automatosx', 'mcp.json'), 'utf8'));
        expect(mcpConfig.tools).toContain('workflow.run');
        expect(mcpConfig.tools).toContain('trace.list');
        expect(mcpConfig.transport).toBe('stdio');
        expect(mcpConfig.command).toBe('ax');
        expect(mcpConfig.args).toEqual(['mcp', 'serve']);
        const claudeMcp = JSON.parse(await readFile(join(tempDir, '.mcp.json'), 'utf8'));
        expect(claudeMcp.mcpServers?.automatosx?.command).toBe('ax');
        expect(claudeMcp.mcpServers?.automatosx?.args).toEqual(['mcp', 'serve']);
        const claudeSettings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf8'));
        expect(claudeSettings.permissions?.allow).toContain('mcp__automatosx__*');
        expect(Object.keys(claudeSettings.hooks ?? {})).toEqual(expect.arrayContaining(['SessionStart', 'SessionEnd']));
        expect(existsSync(join(tempDir, '.claude', 'hooks', 'session-start.sh'))).toBe(true);
        expect(existsSync(join(tempDir, '.claude', 'hooks', 'session-end.sh'))).toBe(true);
        const cursorConfig = JSON.parse(await readFile(join(tempDir, '.cursor', 'mcp.json'), 'utf8'));
        expect(cursorConfig.mcpServers?.automatosx?.command).toBe('ax');
        expect(cursorConfig.mcpServers?.automatosx?.args).toEqual(['mcp', 'serve']);
        const geminiConfig = JSON.parse(await readFile(join(tempDir, '.gemini', 'settings.json'), 'utf8'));
        expect(geminiConfig.mcpServers?.automatosx?.command).toBe('ax');
        expect(geminiConfig.mcpServers?.automatosx?.transport).toBe('stdio');
        const grokConfig = JSON.parse(await readFile(join(tempDir, '.ax-grok', 'settings.json'), 'utf8'));
        expect(grokConfig.mcpServers?.automatosx?.command).toBe('ax');
        expect(grokConfig.mcpServers?.automatosx?.transport).toBe('stdio');
        const codexSnippet = await readFile(join(tempDir, '.automatosx', 'providers', 'codex.config.toml'), 'utf8');
        expect(codexSnippet).toContain('[mcp_servers.automatosx]');
        expect(codexSnippet).toContain('command = "ax"');
        const providerSummary = JSON.parse(await readFile(join(tempDir, '.automatosx', 'providers.json'), 'utf8'));
        expect(providerSummary.providers?.every((provider) => provider.installed && provider.enabled)).toBe(true);
    });
    it('supports selectively skipping provider registration during init', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';
        const result = await initCommand(['--skip-mcp'], defaultOptions({ outputDir: tempDir }));
        expect(result.success).toBe(true);
        expect(existsSync(join(tempDir, '.mcp.json'))).toBe(false);
        expect(existsSync(join(tempDir, '.claude'))).toBe(false);
        expect(existsSync(join(tempDir, '.cursor'))).toBe(false);
        expect(existsSync(join(tempDir, '.gemini'))).toBe(false);
        expect(existsSync(join(tempDir, '.ax-grok'))).toBe(false);
        expect(existsSync(join(tempDir, '.automatosx', 'providers', 'codex.config.toml'))).toBe(false);
        const providerSummary = JSON.parse(await readFile(join(tempDir, '.automatosx', 'providers.json'), 'utf8'));
        expect(providerSummary.providers?.every((provider) => provider.enabled === false)).toBe(true);
    });
    it('fails init on unknown command-specific flags', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const result = await initCommand(['--skip-unknown'], defaultOptions({ outputDir: tempDir }));
        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown init flag');
    });
    it('reports workspace readiness with doctor after setup and init', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';
        await setupCommand([], defaultOptions({ outputDir: tempDir }));
        await initCommand([], defaultOptions({ outputDir: tempDir }));
        const result = await doctorCommand([], defaultOptions({
            outputDir: tempDir,
            workflowDir: join(process.cwd(), 'workflows'),
        }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('AutomatosX Doctor');
        expect(result.message).toContain('Overall status: warning');
        expect(result.message).toContain('Workflow discovery succeeded');
        expect(result.message).toContain('MCP surface is available');
        expect(result.message).toContain('Provider integration summary loaded');
        expect(result.message).toContain('Provider integration artifacts are present for all enabled providers.');
        expect(result.message).toContain('Trace store is readable but has no traces yet.');
        const data = result.data;
        expect(data.status).toBe('warning');
        expect(data.summary.fail).toBe(0);
        expect(data.summary.warn).toBe(1);
    });
    it('reports provider integration drift with doctor when generated artifacts are missing', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';
        await setupCommand([], defaultOptions({ outputDir: tempDir }));
        await initCommand([], defaultOptions({ outputDir: tempDir }));
        await unlink(join(tempDir, '.cursor', 'mcp.json'));
        const result = await doctorCommand([], defaultOptions({
            outputDir: tempDir,
            workflowDir: join(process.cwd(), 'workflows'),
        }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('Provider integration drift detected');
        expect(result.message).toContain('.cursor/mcp.json');
        const data = result.data;
        expect(data.status).toBe('warning');
        expect(data.summary.fail).toBe(0);
        expect(data.summary.warn).toBe(2);
    });
    it('reports setup failures with doctor in an uninitialized workspace', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const result = await doctorCommand([], defaultOptions({
            outputDir: tempDir,
            workflowDir: join(process.cwd(), 'workflows'),
        }));
        expect(result.success).toBe(false);
        expect(result.message).toContain('Run "ax setup"');
        expect(result.message).toContain('Overall status: unhealthy');
    });
    it('lists available workflows with stable-surface annotations', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const result = await listCommand([], defaultOptions({
            outputDir: tempDir,
            workflowDir: join(process.cwd(), 'workflows'),
        }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('Available workflows');
        const data = result.data;
        expect(data.some((entry) => entry.workflowId === 'ship' && entry.stableSurface)).toBe(true);
        expect(data.some((entry) => entry.workflowId === 'architect' && entry.stableSurface)).toBe(true);
    });
    it('describes a workflow through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const result = await listCommand(['architect'], defaultOptions({
            outputDir: tempDir,
            workflowDir: join(process.cwd(), 'workflows'),
        }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('Workflow: architect');
        expect(result.message).toContain('Stable surface: yes');
        expect(result.message).toContain('Steps:');
        const data = result.data;
        expect(data.workflowId).toBe('architect');
        expect(data.stableSurface).toBe(true);
        expect(data.steps.length).toBeGreaterThan(0);
    });
    it('returns a usage error for list describe without a workflow id', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const result = await listCommand(['describe'], defaultOptions({
            outputDir: tempDir,
            workflowDir: join(process.cwd(), 'workflows'),
        }));
        expect(result.success).toBe(false);
        expect(result.message).toContain('Usage: ax list describe <workflow-id>');
    });
    it('runs top-level discussion and exposes the trace through trace commands', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const discussResult = await discussCommand([
            '--providers',
            'claude,gemini',
            '--rounds',
            '2',
            'Compare retained v14 CLI commands',
        ], defaultOptions({
            outputDir: tempDir,
            traceId: 'cli-discuss-trace',
        }));
        expect(discussResult.success).toBe(true);
        expect(discussResult.message).toContain('cli-discuss-trace');
        expect(discussResult.message).toContain('Warnings:');
        expect(discussResult.message).toContain('simulated provider output');
        const listResult = await traceCommand([], defaultOptions({
            outputDir: tempDir,
            limit: 5,
        }));
        expect(listResult.success).toBe(true);
        expect(listResult.message).toContain('cli-discuss-trace');
        const detailResult = await traceCommand(['cli-discuss-trace'], defaultOptions({ outputDir: tempDir }));
        expect(detailResult.success).toBe(true);
        expect(detailResult.message).toContain('Workflow: discuss');
        expect(detailResult.message).toContain('Status: completed');
    });
    it('runs quick and recursive discussion variants through the CLI surface', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const quick = await discussCommand([
            'quick',
            '--providers',
            'claude,gemini',
            'Summarize rollout strategy',
        ], defaultOptions({
            outputDir: tempDir,
            traceId: 'cli-discuss-quick-001',
        }));
        expect(quick.success).toBe(true);
        expect(quick.message).toContain('Discussion (quick) completed with trace cli-discuss-quick-001');
        const recursive = await discussCommand([
            'recursive',
            '--providers',
            'claude,gemini',
            '--subtopics',
            'Assess risk,Prepare validation',
            'Plan release rollout',
        ], defaultOptions({
            outputDir: tempDir,
            traceId: 'cli-discuss-recursive-001',
        }));
        expect(recursive.success).toBe(true);
        expect(recursive.message).toContain('Discussion (recursive) completed with trace cli-discuss-recursive-001');
        expect(recursive.message).toContain('Subtopics:');
        expect(recursive.message).toContain('Assess risk');
        const trace = await traceCommand(['cli-discuss-quick-001'], defaultOptions({ outputDir: tempDir }));
        expect(trace.success).toBe(true);
        expect(trace.message).toContain('Workflow: discuss.quick');
    });
    it('analyzes a stored trace through the trace command', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await discussCommand([
            '--providers',
            'claude,gemini',
            '--rounds',
            '2',
            'Compare release strategies',
        ], defaultOptions({
            outputDir: tempDir,
            traceId: 'cli-trace-analysis-001',
        }));
        const result = await traceCommand(['analyze', 'cli-trace-analysis-001'], defaultOptions({ outputDir: tempDir }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('Trace analysis: cli-trace-analysis-001');
        expect(result.message).toContain('Steps: 1 total, 1 ok, 0 failed');
        expect(result.message).toContain('TRACE_HEALTHY');
        expect(result.data).toMatchObject({
            traceId: 'cli-trace-analysis-001',
            workflowId: 'discuss',
            status: 'completed',
            failedSteps: 0,
        });
    });
    it('lists traces for a correlated session through the trace command', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await discussCommand([
            '--providers',
            'claude,gemini',
            'Compare release strategies',
        ], defaultOptions({
            outputDir: tempDir,
            traceId: 'cli-session-trace-001',
            sessionId: 'cli-session-001',
        }));
        const result = await traceCommand(['by-session', 'cli-session-001'], defaultOptions({ outputDir: tempDir }));
        expect(result.success).toBe(true);
        expect(result.message).toContain('Session traces: cli-session-001');
        expect(result.message).toContain('cli-session-trace-001');
        expect(result.data).toMatchObject([
            {
                traceId: 'cli-session-trace-001',
                workflowId: 'discuss',
            },
        ]);
    });
});
