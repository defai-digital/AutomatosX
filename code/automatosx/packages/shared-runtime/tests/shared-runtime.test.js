import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '../src/index.js';
const execFileAsync = promisify(execFile);
function createTempDir() {
    const dir = join(process.cwd(), '.tmp', `shared-runtime-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}
describe('shared runtime service', () => {
    const tempDirs = [];
    afterEach(async () => {
        clearProviderExecutorEnv();
        await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
    });
    it('executes workflows and stores trace records in the shared trace store', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const result = await runtime.runWorkflow({
            workflowId: 'ship',
            workflowDir: join(process.cwd(), 'workflows'),
            traceId: 'shared-trace-001',
            surface: 'cli',
            input: {
                prompt: 'ship checkout flow',
            },
        });
        expect(result.success).toBe(true);
        expect(result.traceId).toBe('shared-trace-001');
        const trace = await runtime.getTrace('shared-trace-001');
        expect(trace).toMatchObject({
            traceId: 'shared-trace-001',
            workflowId: 'ship',
            surface: 'cli',
            status: 'completed',
        });
        expect(trace?.stepResults.length).toBeGreaterThan(0);
    });
    it('analyzes stored traces through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.runWorkflow({
            workflowId: 'ship',
            workflowDir: join(process.cwd(), 'workflows'),
            traceId: 'shared-trace-analysis-001',
            surface: 'cli',
            input: {
                prompt: 'ship checkout flow',
            },
        });
        const analysis = await runtime.analyzeTrace('shared-trace-analysis-001');
        expect(analysis).toMatchObject({
            traceId: 'shared-trace-analysis-001',
            workflowId: 'ship',
            status: 'completed',
            totalSteps: expect.any(Number),
            successfulSteps: expect.any(Number),
            failedSteps: 0,
        });
        expect(analysis?.findings).toEqual([
            expect.objectContaining({
                code: 'TRACE_HEALTHY',
                level: 'info',
            }),
        ]);
    });
    it('lists traces by session id through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.runDiscussion({
            topic: 'Compare release strategies',
            traceId: 'shared-session-trace-001',
            sessionId: 'session-001',
            providers: ['claude', 'gemini'],
            rounds: 2,
            surface: 'cli',
        });
        const sessionTraces = await runtime.listTracesBySession('session-001');
        expect(sessionTraces).toMatchObject([
            {
                traceId: 'shared-session-trace-001',
                workflowId: 'discuss',
            },
        ]);
    });
    it('executes prompt workflows through a configured provider subprocess bridge', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await configureMockProviders(tempDir, ['claude']);
        await writeFile(join(tempDir, 'real-provider-prompt.json'), `${JSON.stringify({
            workflowId: 'real-provider-prompt',
            name: 'Real Provider Prompt',
            version: '1.0.0',
            steps: [
                {
                    stepId: 'prompt-1',
                    type: 'prompt',
                    config: {
                        prompt: 'Summarize the release risk.',
                        provider: 'claude',
                    },
                },
            ],
        }, null, 2)}\n`, 'utf8');
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const result = await runtime.runWorkflow({
            workflowId: 'real-provider-prompt',
            workflowDir: tempDir,
            traceId: 'real-provider-trace-001',
            surface: 'cli',
        });
        expect(result.success).toBe(true);
        expect(result.output?.content).toContain('REAL:claude:');
    });
    it('runs top-level discussions through configured provider subprocesses when available', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await configureMockProviders(tempDir, ['claude', 'gemini']);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const result = await runtime.runDiscussion({
            topic: 'Compare release strategies',
            traceId: 'real-discussion-trace-001',
            providers: ['claude', 'gemini'],
            rounds: 2,
            surface: 'cli',
        });
        expect(result.success).toBe(true);
        expect(result.rounds.every((round) => round.responses.every((response) => response.content.startsWith('REAL:')))).toBe(true);
        const trace = await runtime.getTrace('real-discussion-trace-001');
        expect(trace?.output?.metadata?.executionMode).toBe('subprocess');
    });
    it('calls a provider directly through the shared runtime bridge', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await configureMockProviders(tempDir, ['claude']);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const result = await runtime.callProvider({
            prompt: 'Summarize release risk.',
            provider: 'claude',
            traceId: 'direct-call-001',
            surface: 'cli',
        });
        expect(result.success).toBe(true);
        expect(result.executionMode).toBe('subprocess');
        expect(result.content).toContain('REAL:claude:');
        expect(await runtime.getTrace('direct-call-001')).toMatchObject({
            workflowId: 'call',
            status: 'completed',
        });
    });
    it('uses native provider presets when a matching CLI is installed', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const rawScriptPath = join(process.cwd(), 'packages/shared-runtime/tests/mock-provider-raw.mjs');
        const shimPath = join(tempDir, process.platform === 'win32' ? 'claude.cmd' : 'claude');
        await writeFile(shimPath, process.platform === 'win32'
            ? `@echo off\r\nnode "${rawScriptPath}"\r\n`
            : `#!/bin/sh\nnode "${rawScriptPath}"\n`, 'utf8');
        if (process.platform !== 'win32') {
            await execFileAsync('chmod', ['+x', shimPath]);
        }
        const originalPath = process.env.PATH;
        const originalNativeAdapters = process.env.AUTOMATOSX_PROVIDER_NATIVE_ADAPTERS;
        process.env.PATH = `${tempDir}${process.platform === 'win32' ? ';' : ':'}${originalPath ?? ''}`;
        process.env.AUTOMATOSX_PROVIDER_NATIVE_ADAPTERS = 'true';
        try {
            const runtime = createSharedRuntimeService({ basePath: tempDir });
            const result = await runtime.callProvider({
                prompt: 'Summarize release risk.',
                provider: 'claude',
                traceId: 'native-call-001',
                surface: 'cli',
            });
            expect(result.success).toBe(true);
            expect(result.executionMode).toBe('subprocess');
            expect(result.content).toContain('RAW:Summarize release risk.');
        }
        finally {
            process.env.PATH = originalPath;
            process.env.AUTOMATOSX_PROVIDER_NATIVE_ADAPTERS = originalNativeAdapters;
        }
    });
    it('shares memory and policy stores through one runtime service', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.storeMemory({
            namespace: 'release',
            key: 'latest',
            value: { version: '14.0.0' },
        });
        await runtime.registerPolicy({
            policyId: 'bugfix',
            name: 'Bugfix Policy',
            metadata: { radius: 5 },
        });
        const memories = await runtime.listMemory('release');
        const policies = await runtime.listPolicies();
        expect(memories).toHaveLength(1);
        expect(memories[0]).toMatchObject({
            namespace: 'release',
            key: 'latest',
            value: { version: '14.0.0' },
        });
        expect(policies).toHaveLength(1);
        expect(policies[0]).toMatchObject({
            policyId: 'bugfix',
            name: 'Bugfix Policy',
        });
    });
    it('supports config and extended memory operations through one runtime service', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.setConfig('providers.default', 'claude');
        expect(await runtime.getConfig('providers.default')).toBe('claude');
        expect(await runtime.showConfig()).toMatchObject({
            providers: {
                default: 'claude',
            },
        });
        await runtime.storeMemory({
            namespace: 'release',
            key: 'latest',
            value: { version: '14.0.0' },
        });
        expect(await runtime.getMemory('latest', 'release')).toMatchObject({
            namespace: 'release',
            key: 'latest',
        });
        expect(await runtime.searchMemory('14.0.0')).toMatchObject([
            {
                namespace: 'release',
                key: 'latest',
            },
        ]);
        expect(await runtime.deleteMemory('latest', 'release')).toBe(true);
        expect(await runtime.getMemory('latest', 'release')).toBeUndefined();
    });
    it('closes stale traces through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.getStores().traceStore.upsertTrace({
            traceId: 'runtime-stuck-trace-001',
            workflowId: 'ship',
            surface: 'cli',
            status: 'running',
            startedAt: '2026-03-20T00:00:00.000Z',
            stepResults: [],
        });
        const closed = await runtime.closeStuckTraces(0);
        expect(closed).toMatchObject([
            {
                traceId: 'runtime-stuck-trace-001',
                status: 'failed',
            },
        ]);
    });
    it('lists, applies, and evaluates guard policies through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const builtinPolicies = await runtime.listGuardPolicies();
        expect(builtinPolicies.some((policy) => policy.policyId === 'step-validation')).toBe(true);
        expect(builtinPolicies.some((policy) => policy.policyId === 'safe-filesystem')).toBe(true);
        const applied = await runtime.applyGuardPolicy({ policyId: 'step-validation' });
        expect(applied.policyId).toBe('step-validation');
        const guardResult = await runtime.checkGuards({
            policyId: 'step-validation',
            stepId: 'bad-tool-step',
            stepType: 'tool',
            stepConfig: { unexpected: true },
        });
        expect(guardResult.blocked).toBe(true);
        expect(guardResult.results[0]).toMatchObject({
            guardId: 'validate-step-config',
            status: 'FAIL',
            blocked: true,
        });
        const filesystemGuard = await runtime.checkGuards({
            policyId: 'safe-filesystem',
            stepId: 'write-files',
            stepType: 'tool',
            stepConfig: {
                changedPaths: ['src/app.ts', '.github/workflows/deploy.yml'],
                allowedPaths: ['src/**'],
                changeRadius: 1,
                content: 'const secret = "sk-live-abcdefghijklmnopqrstuvwxyz";',
            },
        });
        expect(filesystemGuard.blocked).toBe(true);
        expect(filesystemGuard.results).toEqual(expect.arrayContaining([
            expect.objectContaining({
                guardId: 'enforce-allowed-paths',
                status: 'FAIL',
                gates: [expect.objectContaining({ gateId: 'path_violation', status: 'FAIL' })],
            }),
            expect.objectContaining({
                guardId: 'enforce-change-radius',
                status: 'FAIL',
                gates: [expect.objectContaining({ gateId: 'change_radius', status: 'FAIL' })],
            }),
            expect.objectContaining({
                guardId: 'prevent-sensitive-changes',
                status: 'FAIL',
                gates: [expect.objectContaining({ gateId: 'sensitive_change', status: 'FAIL' })],
            }),
            expect.objectContaining({
                guardId: 'prevent-secret-leaks',
                status: 'FAIL',
                gates: [expect.objectContaining({ gateId: 'secrets_detection', status: 'FAIL' })],
            }),
        ]));
    });
    it('summarizes runtime status and git diff through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await execFileAsync('git', ['init'], { cwd: tempDir });
        await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
        await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
        await writeFile(join(tempDir, 'tracked.txt'), 'baseline\n', 'utf8');
        await execFileAsync('git', ['add', 'tracked.txt'], { cwd: tempDir });
        await execFileAsync('git', ['commit', '-m', 'init'], { cwd: tempDir });
        await writeFile(join(tempDir, 'tracked.txt'), 'baseline\nchanged\n', 'utf8');
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.createSession({
            sessionId: 'status-session-001',
            task: 'Observe runtime',
            initiator: 'architect',
        });
        await runtime.getStores().traceStore.upsertTrace({
            traceId: 'status-trace-001',
            workflowId: 'ship',
            surface: 'cli',
            status: 'running',
            startedAt: '2026-03-22T00:00:00.000Z',
            stepResults: [],
        });
        const status = await runtime.getStatus({ limit: 5 });
        expect(status.sessions.active).toBeGreaterThanOrEqual(1);
        expect(status.traces.running).toBeGreaterThanOrEqual(1);
        const diff = await runtime.gitDiff();
        expect(diff.command[0]).toBe('git');
        expect(diff.diff).toContain('tracked.txt');
    });
    it('shares agent registration through one runtime service and rejects conflicting duplicates', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const first = await runtime.registerAgent({
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['design', 'review'],
        });
        const second = await runtime.registerAgent({
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['review', 'design'],
        });
        expect(second).toEqual(first);
        await expect(runtime.registerAgent({
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['ops'],
        })).rejects.toThrow('already registered');
        expect(await runtime.getAgent('architect')).toMatchObject({
            agentId: 'architect',
            name: 'Architect',
        });
    });
    it('runs a registered agent through the shared runtime with durable trace output', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await configureMockProviders(tempDir, ['claude']);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.registerAgent({
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['architecture', 'planning'],
            metadata: {
                provider: 'claude',
                systemPrompt: 'You produce architecture-focused answers.',
            },
        });
        const result = await runtime.runAgent({
            agentId: 'architect',
            task: 'Design a rollout plan',
            input: { system: 'checkout' },
            traceId: 'agent-run-001',
            sessionId: 'session-agent-001',
            surface: 'cli',
        });
        expect(result).toMatchObject({
            traceId: 'agent-run-001',
            agentId: 'architect',
            success: true,
            executionMode: 'subprocess',
        });
        expect(result.content).toContain('REAL:claude:Agent: architect');
        const trace = await runtime.getTrace('agent-run-001');
        expect(trace).toMatchObject({
            traceId: 'agent-run-001',
            workflowId: 'agent.run',
            status: 'completed',
            metadata: expect.objectContaining({
                sessionId: 'session-agent-001',
                agentId: 'architect',
            }),
        });
    });
    it('recommends agents deterministically based on task and capabilities', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.registerAgent({
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['architecture', 'planning'],
            metadata: { team: 'platform' },
        });
        await runtime.registerAgent({
            agentId: 'qa',
            name: 'QA',
            capabilities: ['testing', 'regression'],
            metadata: { team: 'quality' },
        });
        await runtime.registerAgent({
            agentId: 'release-manager',
            name: 'Release Manager',
            capabilities: ['release', 'rollout'],
            metadata: { team: 'platform' },
        });
        const recommendations = await runtime.recommendAgents({
            task: 'Need architecture planning for platform rollout',
            requiredCapabilities: ['architecture'],
            limit: 2,
        });
        expect(recommendations).toHaveLength(1);
        expect(recommendations[0]).toMatchObject({
            agentId: 'architect',
        });
        expect(recommendations[0]?.confidence).toBeGreaterThan(0);
    });
    it('plans and runs bounded parallel agent tasks with trace linkage', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await configureMockProviders(tempDir, ['claude']);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.registerAgent({
            agentId: 'architect',
            name: 'Architect',
            capabilities: ['architecture', 'planning'],
            metadata: { provider: 'claude' },
        });
        await runtime.registerAgent({
            agentId: 'qa',
            name: 'QA',
            capabilities: ['testing', 'regression'],
            metadata: { provider: 'claude' },
        });
        const plan = await runtime.planParallel({
            tasks: [
                { taskId: 'design', agentId: 'architect', task: 'Design rollout', priority: 2 },
                { taskId: 'verify', agentId: 'qa', task: 'Verify rollout', dependencies: ['design'] },
            ],
        });
        expect(plan).toMatchObject({
            valid: true,
            layers: [['design'], ['verify']],
        });
        const result = await runtime.runParallel({
            traceId: 'parallel-run-001',
            sessionId: 'parallel-session-001',
            tasks: [
                { taskId: 'design', agentId: 'architect', task: 'Design rollout', priority: 2, provider: 'claude' },
                { taskId: 'verify', agentId: 'qa', task: 'Verify rollout', dependencies: ['design'], provider: 'claude' },
            ],
            maxConcurrent: 2,
            failureStrategy: 'failSafe',
            resultAggregation: 'merge',
            surface: 'cli',
        });
        expect(result).toMatchObject({
            traceId: 'parallel-run-001',
            success: true,
            layers: [['design'], ['verify']],
        });
        expect(result.results).toMatchObject([
            expect.objectContaining({ taskId: 'design', status: 'completed' }),
            expect.objectContaining({ taskId: 'verify', status: 'completed' }),
        ]);
        expect(result.aggregatedResult).toMatchObject({
            design: expect.stringContaining('REAL:claude:'),
            verify: expect.stringContaining('REAL:claude:'),
        });
        const rootTrace = await runtime.getTrace('parallel-run-001');
        expect(rootTrace).toMatchObject({
            traceId: 'parallel-run-001',
            workflowId: 'parallel.run',
            metadata: expect.objectContaining({
                sessionId: 'parallel-session-001',
            }),
        });
        const childTraceId = result.results[0]?.traceId;
        expect(childTraceId).toBeDefined();
        const childTrace = await runtime.getTrace(childTraceId);
        expect(childTrace?.metadata).toMatchObject({
            parentTraceId: 'parallel-run-001',
            rootTraceId: 'parallel-run-001',
        });
    });
    it('stores and searches semantic context through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.storeSemantic({
            namespace: 'agents',
            key: 'architect-rollout',
            content: 'Architecture rollout planning and system design guidance',
            tags: ['architecture', 'planning'],
        });
        await runtime.storeSemantic({
            namespace: 'agents',
            key: 'qa-regression',
            content: 'Regression testing checklist for checkout flow',
            tags: ['qa', 'testing'],
        });
        const search = await runtime.searchSemantic('architecture planning', {
            namespace: 'agents',
            topK: 1,
        });
        expect(search).toHaveLength(1);
        expect(search[0]).toMatchObject({
            key: 'architect-rollout',
        });
        const stats = await runtime.semanticStats('agents');
        expect(stats).toMatchObject([
            {
                namespace: 'agents',
                totalItems: 2,
            },
        ]);
        expect(await runtime.clearSemantic('agents')).toBe(2);
        expect(await runtime.listSemantic({ namespace: 'agents' })).toEqual([]);
    });
    it('fails discussion workflows that exceed the configured provider budget', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await writeFile(join(tempDir, 'discussion-budget.json'), `${JSON.stringify({
            workflowId: 'discussion-budget',
            name: 'Discussion Budget Workflow',
            version: '1.0.0',
            steps: [
                {
                    stepId: 'discuss-budget',
                    type: 'discuss',
                    config: {
                        prompt: 'Compare provider options.',
                        providers: ['claude', 'openai', 'gemini', 'grok'],
                        minProviders: 3,
                        rounds: 4,
                    },
                },
            ],
        }, null, 2)}\n`, 'utf8');
        const runtime = createSharedRuntimeService({
            basePath: tempDir,
            maxConcurrentDiscussions: 1,
            maxProvidersPerDiscussion: 2,
            maxDiscussionRounds: 2,
        });
        const result = await runtime.runWorkflow({
            workflowId: 'discussion-budget',
            workflowDir: tempDir,
            traceId: 'discussion-budget-trace',
            input: {
                prompt: 'Release planning',
            },
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatchObject({
            code: 'WORKFLOW_STEP_EXECUTION_FAILED',
            failedStepId: 'discuss-budget',
        });
    });
    it('queues concurrent discussion workflows and preserves trace output', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        await writeFile(join(tempDir, 'discussion-queue.json'), `${JSON.stringify({
            workflowId: 'discussion-queue',
            name: 'Discussion Queue Workflow',
            version: '1.0.0',
            steps: [
                {
                    stepId: 'discuss-queue',
                    type: 'discuss',
                    config: {
                        prompt: 'Compare rollout options.',
                        providers: ['claude', 'openai'],
                        minProviders: 2,
                        rounds: 4,
                    },
                },
            ],
        }, null, 2)}\n`, 'utf8');
        const runtime = createSharedRuntimeService({
            basePath: tempDir,
            maxConcurrentDiscussions: 1,
            maxProvidersPerDiscussion: 2,
            maxDiscussionRounds: 2,
        });
        const [first, second] = await Promise.all([
            runtime.runWorkflow({
                workflowId: 'discussion-queue',
                workflowDir: tempDir,
                traceId: 'discussion-trace-1',
                input: {
                    prompt: 'Release planning',
                },
            }),
            runtime.runWorkflow({
                workflowId: 'discussion-queue',
                workflowDir: tempDir,
                traceId: 'discussion-trace-2',
                input: {
                    prompt: 'Release rollback plan',
                },
            }),
        ]);
        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(first.output).toMatchObject({
            type: 'discuss',
        });
        expect(second.output).toMatchObject({
            type: 'discuss',
        });
        const queueDepths = [first.output, second.output]
            .map((output) => output.metadata?.queueDepth ?? 0);
        const roundsExecuted = [first.output, second.output]
            .map((output) => output.metadata?.roundsExecuted ?? 0);
        expect(queueDepths).toContain(1);
        expect(roundsExecuted).toEqual([2, 2]);
        expect(await runtime.listTraces()).toHaveLength(2);
    });
    it('runs top-level discussion requests and stores them as traceable runtime records', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const result = await runtime.runDiscussion({
            topic: 'Compare rollout strategies for v14.',
            traceId: 'discussion-command-trace',
            providers: ['claude', 'gemini'],
            rounds: 2,
            consensusMethod: 'synthesis',
            surface: 'cli',
        });
        expect(result.success).toBe(true);
        expect(result.traceId).toBe('discussion-command-trace');
        expect(result.providers).toEqual(['claude', 'gemini']);
        const trace = await runtime.getTrace('discussion-command-trace');
        expect(trace).toMatchObject({
            traceId: 'discussion-command-trace',
            workflowId: 'discuss',
            status: 'completed',
            surface: 'cli',
        });
        expect(trace?.output).toMatchObject({
            type: 'discuss',
            topic: 'Compare rollout strategies for v14.',
        });
    });
    it('runs quick discussions as a single-round fast path', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const result = await runtime.runDiscussionQuick({
            topic: 'Summarize rollout strategy',
            traceId: 'discussion-quick-trace',
            providers: ['claude', 'gemini'],
            surface: 'cli',
        });
        expect(result.success).toBe(true);
        expect(result.traceId).toBe('discussion-quick-trace');
        expect(result.pattern).toBe('quick');
        expect(result.rounds).toHaveLength(1);
        const trace = await runtime.getTrace('discussion-quick-trace');
        expect(trace).toMatchObject({
            traceId: 'discussion-quick-trace',
            workflowId: 'discuss.quick',
            status: 'completed',
        });
    });
    it('runs recursive discussions with child trace linkage', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const result = await runtime.runDiscussionRecursive({
            topic: 'Plan release rollout',
            subtopics: ['Assess risk', 'Prepare validation'],
            traceId: 'discussion-recursive-trace',
            providers: ['claude', 'gemini'],
            surface: 'cli',
        });
        expect(result.success).toBe(true);
        expect(result.traceId).toBe('discussion-recursive-trace');
        expect(result.children).toHaveLength(2);
        const rootTrace = await runtime.getTrace('discussion-recursive-trace');
        expect(rootTrace).toMatchObject({
            traceId: 'discussion-recursive-trace',
            workflowId: 'discuss.recursive',
            status: 'completed',
        });
        const childTrace = await runtime.getTrace('discussion-recursive-trace:child:1');
        expect(childTrace?.metadata).toMatchObject({
            parentTraceId: 'discussion-recursive-trace',
            rootTraceId: 'discussion-recursive-trace',
        });
    });
    it('describes workflows and runs reviews through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const sourceDir = join(tempDir, 'src');
        mkdirSync(sourceDir, { recursive: true });
        await writeFile(join(sourceDir, 'sample.ts'), [
            'export function sample(value: any) {',
            '  console.log(value);',
            '  return value;',
            '}',
            '',
        ].join('\n'), 'utf8');
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        const description = await runtime.describeWorkflow({
            workflowId: 'architect',
            workflowDir: join(process.cwd(), 'workflows'),
        });
        expect(description).toMatchObject({
            workflowId: 'architect',
            version: '1.0.0',
        });
        expect(description?.steps[0]).toMatchObject({
            stepId: 'analyze-requirement',
            type: 'prompt',
        });
        const review = await runtime.analyzeReview({
            paths: [sourceDir],
            focus: 'all',
            traceId: 'shared-review-001',
            basePath: tempDir,
            surface: 'cli',
        });
        expect(review.success).toBe(true);
        expect(review.traceId).toBe('shared-review-001');
        expect(review.findings.length).toBeGreaterThan(0);
        const reviews = await runtime.listReviewTraces(5);
        expect(reviews).toMatchObject([
            {
                traceId: 'shared-review-001',
                workflowId: 'review',
                status: 'completed',
            },
        ]);
    });
    it('closes stuck sessions through the shared runtime', async () => {
        const tempDir = createTempDir();
        tempDirs.push(tempDir);
        const runtime = createSharedRuntimeService({ basePath: tempDir });
        await runtime.createSession({
            sessionId: 'shared-session-stuck-001',
            task: 'Investigate blocked rollout',
            initiator: 'architect',
        });
        const closed = await runtime.closeStuckSessions(0);
        expect(closed).toMatchObject([
            {
                sessionId: 'shared-session-stuck-001',
                status: 'failed',
            },
        ]);
    });
});
async function configureMockProviders(tempDir, providers) {
    const scriptPath = join(tempDir, 'mock-provider.mjs');
    await writeFile(scriptPath, [
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => { input += chunk; });",
        "process.stdin.on('end', () => {",
        "  const payload = JSON.parse(input || '{}');",
        "  const provider = payload.provider || 'unknown';",
        "  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';",
        "  const firstLine = prompt.split(/\\n+/)[0] || prompt;",
        "  process.stdout.write(JSON.stringify({",
        "    success: true,",
        "    provider,",
        "    model: `mock-${provider}`,",
        "    content: `REAL:${provider}:${firstLine}`,",
        "    usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }",
        "  }));",
        "});",
    ].join('\n'), 'utf8');
    process.env.AUTOMATOSX_PROVIDER_EXECUTION_MODE = 'require-real';
    for (const provider of providers) {
        const prefix = `AUTOMATOSX_PROVIDER_${provider.toUpperCase()}`;
        process.env[`${prefix}_CMD`] = 'node';
        process.env[`${prefix}_ARGS`] = JSON.stringify([scriptPath]);
    }
}
function clearProviderExecutorEnv() {
    for (const key of Object.keys(process.env)) {
        if (key === 'AUTOMATOSX_PROVIDER_EXECUTION_MODE' || key.startsWith('AUTOMATOSX_PROVIDER_')) {
            delete process.env[key];
        }
    }
}
