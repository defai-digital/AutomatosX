import { mkdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { initCommand, setupCommand } from '../../cli/src/commands/index.js';
import { createMcpServerSurface, createMcpStdioServer } from '../src/index.js';
const execFileAsync = promisify(execFile);
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `mcp-surface-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
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
describe('mcp server surface', () => {
    const tempDirs = [];
    afterEach(async () => {
        delete process.env.AX_MCP_TOOL_PREFIX;
        await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
    });
    it('runs workflow tools against the shared runtime and shared trace store', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        const runResult = await surface.invokeTool('workflow.run', {
            workflowId: 'architect',
            workflowDir: join(process.cwd(), 'workflows'),
            traceId: 'mcp-trace-001',
            sessionId: 'mcp-session-001',
            input: { prompt: 'design auth system' },
        });
        expect(runResult.success).toBe(true);
        const traceResult = await surface.invokeTool('trace.get', {
            traceId: 'mcp-trace-001',
        });
        const analysisResult = await surface.invokeTool('trace.analyze', {
            traceId: 'mcp-trace-001',
        });
        const bySessionResult = await surface.invokeTool('trace.by_session', {
            sessionId: 'mcp-session-001',
        });
        expect(traceResult.success).toBe(true);
        expect(traceResult.data).toMatchObject({
            traceId: 'mcp-trace-001',
            workflowId: 'architect',
            surface: 'mcp',
            status: 'completed',
        });
        expect(analysisResult.success).toBe(true);
        expect(analysisResult.data).toMatchObject({
            traceId: 'mcp-trace-001',
            workflowId: 'architect',
            status: 'completed',
            failedSteps: 0,
        });
        expect(bySessionResult.success).toBe(true);
        expect(bySessionResult.data).toMatchObject([
            {
                traceId: 'mcp-trace-001',
                workflowId: 'architect',
            },
        ]);
    });
    it('shares memory, policy, and dashboard tools on the same stores', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        await surface.invokeTool('memory.store', {
            namespace: 'qa',
            key: 'latest-run',
            value: { target: 'checkout' },
        });
        await surface.invokeTool('policy.register', {
            policyId: 'provider-refactor',
            name: 'Provider Refactor',
        });
        await surface.invokeTool('workflow.run', {
            workflowId: 'qa',
            workflowDir: join(process.cwd(), 'workflows'),
            traceId: 'mcp-trace-qa',
            input: { prompt: 'qa checkout' },
        });
        const memories = await surface.invokeTool('memory.list', { namespace: 'qa' });
        const policies = await surface.invokeTool('policy.list');
        const dashboard = await surface.invokeTool('dashboard.list');
        expect(memories.success).toBe(true);
        expect(memories.data).toMatchObject([
            {
                namespace: 'qa',
                key: 'latest-run',
            },
        ]);
        expect(policies.success).toBe(true);
        expect(policies.data).toMatchObject([
            {
                policyId: 'provider-refactor',
            },
        ]);
        expect(dashboard.success).toBe(true);
        expect(dashboard.data).toMatchObject([
            {
                traceId: 'mcp-trace-qa',
                workflowId: 'qa',
                surface: 'mcp',
            },
        ]);
    });
    it('exposes extended memory, config, and stuck-session tools', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const surface = createMcpServerSurface({ basePath: tempDir, runtimeService: runtime });
        await surface.invokeTool('memory.store', {
            namespace: 'release',
            key: 'latest',
            value: { version: '14.0.0' },
        });
        const loaded = await surface.invokeTool('memory.retrieve', {
            namespace: 'release',
            key: 'latest',
        });
        const searched = await surface.invokeTool('memory.search', {
            query: '14.0.0',
        });
        const deleted = await surface.invokeTool('memory.delete', {
            namespace: 'release',
            key: 'latest',
        });
        await surface.invokeTool('config.set', {
            path: 'providers.default',
            value: 'claude',
        });
        const configValue = await surface.invokeTool('config.get', {
            path: 'providers.default',
        });
        const configAll = await surface.invokeTool('config.show');
        await surface.invokeTool('session.create', {
            sessionId: 'mcp-session-stuck-001',
            task: 'Blocked task',
            initiator: 'architect',
        });
        await runtime.getStores().traceStore.upsertTrace({
            traceId: 'mcp-trace-stuck-001',
            workflowId: 'ship',
            surface: 'mcp',
            status: 'running',
            startedAt: '2026-03-20T00:00:00.000Z',
            stepResults: [],
        });
        const closed = await surface.invokeTool('session.close_stuck', {
            maxAgeMs: 0,
        });
        const closedTraces = await surface.invokeTool('trace.close_stuck', {
            maxAgeMs: 0,
        });
        expect(loaded.data).toMatchObject({
            namespace: 'release',
            key: 'latest',
        });
        expect(searched.data).toMatchObject([
            {
                namespace: 'release',
                key: 'latest',
            },
        ]);
        expect(deleted.data).toMatchObject({ deleted: true });
        expect(configValue.data).toBe('claude');
        expect(configAll.data).toMatchObject({
            providers: {
                default: 'claude',
            },
        });
        expect(closed.data).toMatchObject([
            {
                sessionId: 'mcp-session-stuck-001',
                status: 'failed',
            },
        ]);
        expect(closedTraces.data).toMatchObject([
            {
                traceId: 'mcp-trace-stuck-001',
                status: 'failed',
            },
        ]);
    });
    it('exposes guard list/apply/check tools on the MCP surface', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        const listed = await surface.invokeTool('guard.list');
        expect(listed.success).toBe(true);
        expect(listed.data).toMatchObject([
            expect.objectContaining({ policyId: 'step-validation' }),
            expect.objectContaining({ policyId: 'safe-filesystem' }),
        ]);
        const applied = await surface.invokeTool('guard.apply', {
            policyId: 'step-validation',
        });
        expect(applied.success).toBe(true);
        expect(applied.data).toMatchObject({ policyId: 'step-validation' });
        const checked = await surface.invokeTool('guard.check', {
            policyId: 'step-validation',
            stepId: 'broken-tool',
            stepType: 'tool',
            stepConfig: { unexpected: true },
        });
        expect(checked.success).toBe(true);
        expect(checked.data).toMatchObject({
            blocked: true,
            policyIds: ['step-validation'],
        });
        const filesystemChecked = await surface.invokeTool('guard.check', {
            policyId: 'safe-filesystem',
            stepId: 'write-files',
            stepType: 'tool',
            stepConfig: {
                changedPaths: ['src/app.ts', '.github/workflows/deploy.yml'],
                allowedPaths: ['src/**'],
                changeRadius: 1,
                content: 'const token = "sk-live-abcdefghijklmnopqrstuvwxyz";',
            },
        });
        expect(filesystemChecked.success).toBe(true);
        expect(filesystemChecked.data).toMatchObject({
            blocked: true,
            policyIds: ['safe-filesystem'],
        });
    });
    it('exposes filesystem and git diff tools on the MCP surface', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await execFileAsync('git', ['init'], { cwd: tempDir });
        await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
        await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
        const surface = createMcpServerSurface({ basePath: tempDir });
        const created = await surface.invokeTool('directory.create', {
            path: 'notes',
        });
        expect(created.success).toBe(true);
        const written = await surface.invokeTool('file.write', {
            path: 'notes/todo.txt',
            content: 'hello\n',
            createDirectories: true,
        });
        expect(written.success).toBe(true);
        const exists = await surface.invokeTool('file.exists', {
            path: 'notes/todo.txt',
        });
        expect(exists.success).toBe(true);
        expect(exists.data).toMatchObject({ exists: true });
        await execFileAsync('git', ['add', 'notes/todo.txt'], { cwd: tempDir });
        await execFileAsync('git', ['commit', '-m', 'add note'], { cwd: tempDir });
        await surface.invokeTool('file.write', {
            path: 'notes/todo.txt',
            content: 'hello\nchanged\n',
            overwrite: true,
        });
        const diff = await surface.invokeTool('git.diff', {});
        expect(diff.success).toBe(true);
        expect(diff.data.diff).toContain('todo.txt');
    });
    it('exposes workflow describe, discuss, and review tools on the shared runtime surface', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const sourceDir = join(tempDir, 'src');
        mkdirSync(sourceDir, { recursive: true });
        await import('node:fs/promises').then(({ writeFile }) => writeFile(join(sourceDir, 'sample.ts'), [
            'export function sample(value: any) {',
            '  console.log(value);',
            '  return value;',
            '}',
            '',
        ].join('\n'), 'utf8'));
        const surface = createMcpServerSurface({ basePath: tempDir });
        const description = await surface.invokeTool('workflow.describe', {
            workflowId: 'architect',
            workflowDir: join(process.cwd(), 'workflows'),
        });
        const discussion = await surface.invokeTool('discuss.run', {
            topic: 'Compare release strategies',
            traceId: 'mcp-discuss-001',
            providers: ['claude', 'gemini'],
            rounds: 2,
        });
        const review = await surface.invokeTool('review.analyze', {
            paths: [sourceDir],
            traceId: 'mcp-review-001',
            focus: 'all',
        });
        const reviewList = await surface.invokeTool('review.list', { limit: 5 });
        expect(description.success).toBe(true);
        expect(description.data).toMatchObject({
            workflowId: 'architect',
            version: '1.0.0',
        });
        expect(discussion.success).toBe(true);
        expect(discussion.data).toMatchObject({
            traceId: 'mcp-discuss-001',
            success: true,
        });
        expect(review.success).toBe(true);
        expect(review.data).toMatchObject({
            traceId: 'mcp-review-001',
            success: true,
        });
        expect(reviewList.success).toBe(true);
        expect(reviewList.data).toMatchObject([
            {
                traceId: 'mcp-review-001',
                workflowId: 'review',
            },
        ]);
    });
    it('exposes quick and recursive discussion tools on the shared runtime surface', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        const quick = await surface.invokeTool('discuss.quick', {
            topic: 'Summarize rollout strategy',
            traceId: 'mcp-discuss-quick-001',
            providers: ['claude', 'gemini'],
        });
        const recursive = await surface.invokeTool('discuss.recursive', {
            topic: 'Plan release rollout',
            subtopics: ['Assess risk', 'Prepare validation'],
            traceId: 'mcp-discuss-recursive-001',
            providers: ['claude', 'gemini'],
        });
        expect(quick.success).toBe(true);
        expect(quick.data).toMatchObject({
            traceId: 'mcp-discuss-quick-001',
            pattern: 'quick',
        });
        expect(quick.data.rounds).toHaveLength(1);
        expect(recursive.success).toBe(true);
        expect(recursive.data).toMatchObject({
            traceId: 'mcp-discuss-recursive-001',
            subtopics: ['Assess risk', 'Prepare validation'],
        });
        expect(recursive.data.children).toHaveLength(2);
    });
    it('exposes agent registration tools with uniqueness semantics', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        const first = await surface.invokeTool('agent.register', {
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['design', 'review'],
        });
        const second = await surface.invokeTool('agent.register', {
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['review', 'design'],
        });
        const capabilities = await surface.invokeTool('agent.capabilities');
        const listed = await surface.invokeTool('agent.list');
        const loaded = await surface.invokeTool('agent.get', { agentId: 'architect' });
        const removed = await surface.invokeTool('agent.remove', { agentId: 'architect' });
        const afterRemoval = await surface.invokeTool('agent.list');
        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(capabilities.data).toEqual(['design', 'review']);
        expect(listed.success).toBe(true);
        expect(loaded.data).toMatchObject({
            agentId: 'architect',
            name: 'Architect',
        });
        expect(removed.data).toMatchObject({ removed: true });
        expect(afterRemoval.data).toEqual([]);
        expect(listed.data).toMatchObject([
            {
                agentId: 'architect',
            },
        ]);
    });
    it('exposes agent execution and recommendation tools', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        await surface.invokeTool('agent.register', {
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['architecture', 'planning'],
            metadata: {
                team: 'platform',
            },
        });
        await surface.invokeTool('agent.register', {
            agentId: 'qa',
            name: 'QA',
            capabilities: ['testing', 'regression'],
            metadata: {
                team: 'quality',
            },
        });
        const recommended = await surface.invokeTool('agent.recommend', {
            task: 'Need architecture planning for a rollout',
            requiredCapabilities: ['architecture'],
        });
        const executed = await surface.invokeTool('agent.run', {
            agentId: 'architect',
            task: 'Design the rollout plan',
            traceId: 'mcp-agent-run-001',
            sessionId: 'mcp-agent-session-001',
            input: {
                target: 'checkout',
            },
        });
        expect(recommended.success).toBe(true);
        expect(recommended.data).toMatchObject([
            {
                agentId: 'architect',
            },
        ]);
        expect(executed.success).toBe(true);
        expect(executed.data).toMatchObject({
            traceId: 'mcp-agent-run-001',
            agentId: 'architect',
            success: true,
        });
        const trace = await surface.invokeTool('trace.get', {
            traceId: 'mcp-agent-run-001',
        });
        expect(trace.data).toMatchObject({
            traceId: 'mcp-agent-run-001',
            workflowId: 'agent.run',
            metadata: expect.objectContaining({
                sessionId: 'mcp-agent-session-001',
                agentId: 'architect',
            }),
        });
    });
    it('exposes semantic storage and search tools', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        await surface.invokeTool('semantic.store', {
            namespace: 'agents',
            key: 'architect-rollout',
            content: 'Architecture rollout planning and system design guidance',
            tags: ['architecture', 'planning'],
        });
        await surface.invokeTool('semantic.store', {
            namespace: 'agents',
            key: 'qa-regression',
            content: 'Regression testing checklist for checkout flow',
            tags: ['qa', 'testing'],
        });
        const search = await surface.invokeTool('semantic.search', {
            query: 'architecture planning',
            namespace: 'agents',
            topK: 1,
        });
        const stats = await surface.invokeTool('semantic.stats', {
            namespace: 'agents',
        });
        const cleared = await surface.invokeTool('semantic.clear', {
            namespace: 'agents',
            confirm: true,
        });
        expect(search.success).toBe(true);
        expect(search.data).toMatchObject([
            {
                key: 'architect-rollout',
            },
        ]);
        expect(stats.data).toMatchObject([
            {
                namespace: 'agents',
                totalItems: 2,
            },
        ]);
        expect(cleared.data).toMatchObject({
            cleared: 2,
        });
    });
    it('exposes parallel planning and execution tools', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        await surface.invokeTool('agent.register', {
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['architecture', 'planning'],
        });
        await surface.invokeTool('agent.register', {
            agentId: 'qa',
            name: 'QA',
            capabilities: ['testing', 'regression'],
        });
        const plan = await surface.invokeTool('parallel.plan', {
            tasks: [
                { taskId: 'design', agentId: 'architect', task: 'Design rollout', priority: 2 },
                { taskId: 'verify', agentId: 'qa', task: 'Verify rollout', dependencies: ['design'] },
            ],
        });
        const run = await surface.invokeTool('parallel.run', {
            traceId: 'mcp-parallel-001',
            sessionId: 'mcp-parallel-session-001',
            tasks: [
                { taskId: 'design', agentId: 'architect', task: 'Design rollout' },
                { taskId: 'verify', agentId: 'qa', task: 'Verify rollout', dependencies: ['design'] },
            ],
            maxConcurrent: 2,
            failureStrategy: 'failSafe',
            resultAggregation: 'list',
        });
        expect(plan.success).toBe(true);
        expect(plan.data).toMatchObject({
            valid: true,
            layers: [['design'], ['verify']],
        });
        expect(run.success).toBe(true);
        expect(run.data).toMatchObject({
            traceId: 'mcp-parallel-001',
            success: true,
            layers: [['design'], ['verify']],
        });
    });
    it('accepts legacy ax_ tool aliases for backward compatibility', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        const listed = await surface.invokeTool('ax_agent_list');
        const workflow = await surface.invokeTool('ax_workflow_run', {
            workflowId: 'architect',
            workflowDir: join(process.cwd(), 'workflows'),
            traceId: 'mcp-legacy-001',
            input: { prompt: 'design auth system' },
        });
        expect(listed.success).toBe(true);
        expect(Array.isArray(listed.data)).toBe(true);
        expect(workflow.success).toBe(true);
        expect(workflow.data).toMatchObject({
            traceId: 'mcp-legacy-001',
            success: true,
        });
    });
    it('lists prefixed tool names when AX_MCP_TOOL_PREFIX is configured', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        process.env.AX_MCP_TOOL_PREFIX = 'ax_';
        const surface = createMcpServerSurface({ basePath: tempDir });
        const tools = surface.listToolDefinitions();
        expect(tools.some((tool) => tool.name === 'ax_workflow_run')).toBe(true);
        expect(tools.some((tool) => tool.name === 'ax_agent_list')).toBe(true);
        expect(tools.some((tool) => tool.name === 'workflow.run')).toBe(true);
    });
    it('exposes session lifecycle tools on the same shared runtime state', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const surface = createMcpServerSurface({ basePath: tempDir });
        const created = await surface.invokeTool('session.create', {
            sessionId: 'mcp-session-001',
            task: 'Coordinate rollout',
            initiator: 'architect',
            workspace: '/repo',
        });
        const joined = await surface.invokeTool('session.join', {
            sessionId: 'mcp-session-001',
            agentId: 'qa',
            role: 'collaborator',
        });
        const completed = await surface.invokeTool('session.complete', {
            sessionId: 'mcp-session-001',
            summary: 'Rollout coordinated',
        });
        const listed = await surface.invokeTool('session.list');
        expect(created.success).toBe(true);
        expect(joined.success).toBe(true);
        expect(completed.success).toBe(true);
        expect(listed.data).toMatchObject([
            {
                sessionId: 'mcp-session-001',
                status: 'completed',
            },
        ]);
    });
    it('exposes typed tool schemas plus resources and prompts over stdio', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await setupCommand([], defaultOptions({ outputDir: tempDir }));
        await initCommand([], defaultOptions({ outputDir: tempDir }));
        const outputChunks = [];
        const output = new Writable({
            write(chunk, _enc, cb) {
                outputChunks.push(chunk.toString());
                cb();
            },
        });
        const requests = [
            JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', clientInfo: { name: 'test' } } }),
            JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
            JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'resources/list' }),
            JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'prompts/list' }),
            JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'shutdown' }),
        ].join('\n') + '\n';
        const input = Readable.from([requests]);
        const server = createMcpStdioServer({ basePath: tempDir, input, output });
        await server.serve();
        const responses = outputChunks
            .join('')
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        const initResp = responses.find((entry) => entry.id === 1);
        expect(initResp?.result?.capabilities?.resources).toBeDefined();
        expect(initResp?.result?.capabilities?.prompts).toBeDefined();
        const toolResp = responses.find((entry) => entry.id === 2);
        const workflowRun = (toolResp?.result?.tools ?? []).find((tool) => tool.name === 'workflow.run');
        expect(workflowRun.inputSchema.required).toContain('workflowId');
        expect(workflowRun.inputSchema.properties.workflowId.type).toBe('string');
        const resourceResp = responses.find((entry) => entry.id === 3);
        const resources = resourceResp?.result?.resources ?? [];
        expect(resources.some((resource) => resource.uri === 'ax://workspace/config')).toBe(true);
        expect(resources.some((resource) => resource.uri === 'ax://workflow/catalog')).toBe(true);
        const promptResp = responses.find((entry) => entry.id === 4);
        const prompts = promptResp?.result?.prompts ?? [];
        expect(prompts.some((prompt) => prompt.name === 'workflow.run')).toBe(true);
        expect(prompts.some((prompt) => prompt.name === 'review.analyze')).toBe(true);
    });
    it('reads resources and prompts through stdio', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await setupCommand([], defaultOptions({ outputDir: tempDir }));
        await initCommand([], defaultOptions({ outputDir: tempDir }));
        const outputChunks = [];
        const output = new Writable({
            write(chunk, _enc, cb) {
                outputChunks.push(chunk.toString());
                cb();
            },
        });
        const requests = [
            JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', clientInfo: { name: 'test' } } }),
            JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'ax://workspace/config' } }),
            JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'prompts/get', params: { name: 'workflow.architect', arguments: { requirement: 'Design audit trail' } } }),
            JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'shutdown' }),
        ].join('\n') + '\n';
        const input = Readable.from([requests]);
        const server = createMcpStdioServer({ basePath: tempDir, input, output });
        await server.serve();
        const responses = outputChunks
            .join('')
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        const resourceResp = responses.find((entry) => entry.id === 2);
        expect(resourceResp?.result?.contents?.[0]?.uri).toBe('ax://workspace/config');
        expect(resourceResp?.result?.contents?.[0]?.text).toContain('"workflowArtifactDir"');
        const promptResp = responses.find((entry) => entry.id === 3);
        expect(promptResp?.result?.messages?.[0]?.content?.text).toContain('Design audit trail');
        expect(promptResp?.result?.description).toContain('architect');
    });
    it('rate limits expensive MCP requests and supports shutdown', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const outputChunks = [];
        const output = new Writable({
            write(chunk, _enc, cb) {
                outputChunks.push(chunk.toString());
                cb();
            },
        });
        const requests = [
            JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', clientInfo: { name: 'test' } } }),
            JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
            JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list' }),
            JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'shutdown' }),
        ].join('\n') + '\n';
        const input = Readable.from([requests]);
        const server = createMcpStdioServer({
            basePath: tempDir,
            input,
            output,
            rateLimit: {
                maxRequests: 1,
                windowMs: 10_000,
            },
        });
        await server.serve();
        const responses = outputChunks
            .join('')
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
        const limited = responses.find((entry) => entry.id === 3);
        expect(limited?.error?.code).toBe(-32001);
        expect(limited?.error?.message).toContain('Rate limit exceeded');
        const shutdown = responses.find((entry) => entry.id === 4);
        expect(shutdown?.result).toEqual({});
    });
    it('keeps the CLI MCP surface runnable as a process after protocol expansion', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await setupCommand([], defaultOptions({ outputDir: tempDir }));
        const { stdout } = await execFileAsync('node', [
            'packages/cli/src/main.js',
            'mcp',
            'tools',
            '--output-dir',
            tempDir,
        ], {
            cwd: process.cwd(),
        });
        expect(stdout).toContain('workflow.run');
        expect(stdout).toContain('dashboard.list');
    });
});
