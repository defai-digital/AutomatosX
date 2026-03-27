import { mkdirSync } from 'node:fs';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { TraceRecord, TraceStore } from '@defai.digital/trace-store';
import { createSharedRuntimeService } from '../src/index.js';
import { createRuntimeBridgeService } from '../src/runtime-public-bridge-exports.js';
import { RuntimeGovernanceAggregateSchema } from '../src/runtime-public-governance-exports.js';
import { resolveBundledWorkflowDir } from '../src/runtime-public-catalog-exports.js';

const execFileAsync = promisify(execFile);
const SHARED_RUNTIME_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHARED_RUNTIME_BUNDLED_WORKFLOW_DIR = resolveBundledWorkflowDir() ?? join(SHARED_RUNTIME_PACKAGE_ROOT, 'workflows');
const RAW_PROVIDER_SCRIPT_PATH = join(SHARED_RUNTIME_PACKAGE_ROOT, 'tests', 'mock-provider-raw.mjs');

function createTempDir(): string {
  const dir = join(SHARED_RUNTIME_PACKAGE_ROOT, '.tmp', `shared-runtime-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('shared runtime service', () => {
  const tempDirs: string[] = [];

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

  it('scopes workflow discovery to the requested base path while preserving bundled workflow execution', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const workflows = await runtime.listWorkflows({ basePath: tempDir });
    expect(workflows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        workflowId: 'architect',
        version: '1.0.0',
      }),
    ]));

    const description = await runtime.describeWorkflow({
      workflowId: 'architect',
      basePath: tempDir,
    });
    expect(description).toMatchObject({
      workflowId: 'architect',
      version: '1.0.0',
      source: 'workflow-definition',
      workflowDir: resolveBundledWorkflowDir(),
    });
    expect(description?.steps[0]).toMatchObject({
      stepId: 'analyze-requirement',
      type: 'prompt',
    });

    const result = await runtime.runWorkflow({
      workflowId: 'architect',
      basePath: tempDir,
      surface: 'cli',
    });
    expect(result).toMatchObject({
      workflowId: 'architect',
      success: true,
      workflowDir: resolveBundledWorkflowDir(),
    });
  });

  it('analyzes stored traces through the shared runtime', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.runWorkflow({
      workflowId: 'ship',
      workflowDir: SHARED_RUNTIME_BUNDLED_WORKFLOW_DIR,
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

  it('surfaces persisted runtime governance summaries through trace analysis', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'shared-trace-guard-analysis-001',
      workflowId: 'ship',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-25T00:00:00.000Z',
      completedAt: '2026-03-25T00:00:05.000Z',
      stepResults: [],
      error: {
        code: 'WORKFLOW_GUARD_BLOCKED',
        message: 'Runtime governance blocked workflow execution.',
      },
      metadata: {
        guardId: 'enforce-runtime-trust',
        guardFailedGates: ['runtime_trust'],
        guardFailedGateMessages: ['Tool trust state "implicit-local" did not satisfy required states.'],
        guardSummary: 'Runtime governance blocked step "run-skill". Guard "enforce-runtime-trust" rejected tool "skill.run". Trust state: implicit-local. Required trust states: trusted-id.',
        guardBlockedByRuntimeGovernance: true,
        guardToolName: 'skill.run',
        guardTrustState: 'implicit-local',
        guardRequiredTrustStates: ['trusted-id'],
        guardSourceRef: 'skill:deploy-review',
      },
    });

    const analysis = await runtime.analyzeTrace('shared-trace-guard-analysis-001');

    expect(analysis).toMatchObject({
      traceId: 'shared-trace-guard-analysis-001',
      workflowId: 'ship',
      status: 'failed',
      guard: {
        guardId: 'enforce-runtime-trust',
        blockedByRuntimeGovernance: true,
        toolName: 'skill.run',
        trustState: 'implicit-local',
        requiredTrustStates: ['trusted-id'],
        sourceRef: 'skill:deploy-review',
      },
    });
    expect(analysis?.guard?.summary).toContain('Runtime governance blocked step "run-skill"');
    expect(analysis?.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'RUNTIME_GOVERNANCE_BLOCK',
        level: 'error',
      }),
    ]));
  });

  it('exports a governance aggregate schema that validates canonical runtime aggregates', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'shared-governance-schema-001',
      workflowId: 'ship',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-25T00:00:00.000Z',
      completedAt: '2026-03-25T00:00:05.000Z',
      stepResults: [],
      error: {
        code: 'WORKFLOW_GUARD_BLOCKED',
        message: 'Runtime governance blocked workflow execution.',
      },
      metadata: {
        guardSummary: 'Runtime governance blocked step "run-skill". Trust state: implicit-local. Required trust states: trusted-id.',
        guardBlockedByRuntimeGovernance: true,
        guardToolName: 'skill.run',
        guardTrustState: 'implicit-local',
        guardRequiredTrustStates: ['trusted-id'],
      },
    });

    const status = await runtime.getStatus({ limit: 10 });
    const aggregate = RuntimeGovernanceAggregateSchema.parse({
      blockedCount: 1,
      latest: {
        traceId: status.recentFailedTraces[0]?.traceId,
        workflowId: status.recentFailedTraces[0]?.workflowId,
        startedAt: status.recentFailedTraces[0]?.startedAt,
        summary: 'Runtime governance blocked step "run-skill". Trust state: implicit-local. Required trust states: trusted-id.',
        failedGates: [],
        failedGateMessages: [],
        blockedByRuntimeGovernance: true,
        toolName: 'skill.run',
        trustState: 'implicit-local',
        requiredTrustStates: ['trusted-id'],
      },
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });

    expect(aggregate).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'shared-governance-schema-001',
        toolName: 'skill.run',
      },
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
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

  it('does not drop older session traces when listTracesBySession is called with a limit', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const traces: TraceRecord[] = [
      {
        traceId: 'newest-trace-001',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:05.000Z',
        stepResults: [],
      },
      {
        traceId: 'newest-trace-002',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:04.000Z',
        stepResults: [],
      },
      {
        traceId: 'newest-trace-003',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:03.000Z',
        stepResults: [],
      },
      {
        traceId: 'newest-trace-004',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:02.000Z',
        stepResults: [],
      },
      {
        traceId: 'target-session-trace-001',
        workflowId: 'discuss',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:01.000Z',
        stepResults: [],
        metadata: {
          sessionId: 'session-older',
        },
      },
    ];

    const traceStore: TraceStore = {
      upsertTrace: async (record) => record,
      getTrace: async () => undefined,
      listTraces: async (limit?: number) => limit === undefined ? traces : traces.slice(0, limit),
      getTraceStatusCounts: async () => ({
        total: traces.length,
        running: 0,
        completed: traces.length,
        failed: 0,
      }),
      countTraces: async () => traces.length,
      listTracesByStatus: async () => [],
      listTracesByWorkflow: async () => [],
      listTracesBySession: async (sessionId: string, limit?: number) => {
        const filtered = traces.filter((trace) => trace.metadata?.sessionId === sessionId);
        return limit === undefined ? filtered : filtered.slice(0, limit);
      },
      getTraceTree: async () => undefined,
      closeStuckTraces: async () => [],
      getHourlyMetrics: async () => [],
    };

    const runtime = createSharedRuntimeService({ basePath: tempDir, traceStore });
    const sessionTraces = await runtime.listTracesBySession('session-older', 1);

    expect(sessionTraces).toMatchObject([
      {
        traceId: 'target-session-trace-001',
        workflowId: 'discuss',
      },
    ]);
  });

  it('auto-creates session records for session-aware runtime activity', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });

    await runtime.runWorkflow({
      workflowId: 'ship',
      traceId: 'workflow-session-trace-001',
      sessionId: 'workflow-session-001',
      surface: 'cli',
    });
    await runtime.runDiscussion({
      topic: 'Compare release strategies',
      traceId: 'discussion-session-trace-001',
      sessionId: 'discussion-session-001',
      providers: ['claude', 'gemini'],
      rounds: 1,
      surface: 'cli',
    });
    await runtime.callProvider({
      prompt: 'Summarize release risk.',
      traceId: 'call-session-trace-001',
      sessionId: 'call-session-001',
      surface: 'cli',
    });

    await expect(runtime.getSession('workflow-session-001')).resolves.toMatchObject({
      sessionId: 'workflow-session-001',
      task: 'Run workflow: ship',
      initiator: 'cli',
      status: 'active',
      metadata: expect.objectContaining({
        autoCreated: true,
        command: 'workflow.run',
      }),
    });
    await expect(runtime.getSession('discussion-session-001')).resolves.toMatchObject({
      sessionId: 'discussion-session-001',
      task: 'Discuss: Compare release strategies',
      initiator: 'cli',
      status: 'active',
      metadata: expect.objectContaining({
        autoCreated: true,
        command: 'discuss',
      }),
    });
    await expect(runtime.getSession('call-session-001')).resolves.toMatchObject({
      sessionId: 'call-session-001',
      task: 'Call provider: claude',
      initiator: 'cli',
      status: 'active',
      metadata: expect.objectContaining({
        autoCreated: true,
        command: 'call',
      }),
    });
  });

  it('executes prompt workflows through a configured provider subprocess bridge', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await configureMockProviders(tempDir, ['claude']);
    await writeFile(
      join(tempDir, 'real-provider-prompt.json'),
      `${JSON.stringify({
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
      }, null, 2)}\n`,
      'utf8',
    );

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const result = await runtime.runWorkflow({
      workflowId: 'real-provider-prompt',
      workflowDir: tempDir,
      traceId: 'real-provider-trace-001',
      surface: 'cli',
    });

    expect(result.success).toBe(true);
    expect((result.output as { content?: string })?.content).toContain('REAL:claude:');
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
    expect((trace?.output as { metadata?: { executionMode?: string } })?.metadata?.executionMode).toBe('subprocess');
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

  it('falls back to raw subprocess output when provider returns unexpected json shape', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const scriptPath = join(tempDir, 'unexpected-provider-shape.mjs');
    await writeFile(scriptPath, [
      "process.stdout.write(JSON.stringify(['unexpected', 'shape']));",
    ].join('\n'), 'utf8');
    await writeProviderConfig(tempDir, scriptPath);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const result = await runtime.callProvider({
      prompt: 'Summarize release risk.',
      provider: 'claude',
      traceId: 'direct-call-unexpected-json-001',
      surface: 'cli',
    });

    expect(result.success).toBe(true);
    expect(result.executionMode).toBe('subprocess');
    expect(result.content).toBe('["unexpected","shape"]');
  });

  it('resolves provider workspace config from the request base path', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const scriptPath = join(tempDir, 'workspace-provider.mjs');
    await writeFile(scriptPath, [
      "let input = '';",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (chunk) => { input += chunk; });",
      "process.stdin.on('end', () => {",
      "  const payload = JSON.parse(input || '{}');",
      "  const provider = payload.provider || 'unknown';",
      "  process.stdout.write(JSON.stringify({",
      "    success: true,",
      "    provider,",
      "    model: `workspace-${provider}`,",
      "    content: `WORKSPACE:${provider}:${payload.prompt || ''}`",
      "  }));",
      "});",
    ].join('\n'), 'utf8');
    mkdirSync(join(tempDir, '.automatosx'), { recursive: true });
    await writeFile(join(tempDir, '.automatosx', 'config.json'), `${JSON.stringify({
      providers: {
        executors: {
          claude: {
            command: 'node',
            args: [scriptPath],
          },
        },
      },
    }, null, 2)}\n`, 'utf8');

    const runtime = createSharedRuntimeService({ basePath: join(SHARED_RUNTIME_PACKAGE_ROOT, 'tmp', 'unrelated-runtime-root') });
    const result = await runtime.callProvider({
      prompt: 'workspace scoped prompt',
      provider: 'claude',
      traceId: 'workspace-call-001',
      basePath: tempDir,
      surface: 'cli',
    });

    expect(result.success).toBe(true);
    expect(result.executionMode).toBe('subprocess');
    expect(result.content).toContain('WORKSPACE:claude:workspace scoped prompt');
  });

  it('uses native provider presets when a matching CLI is installed', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const shimPath = join(tempDir, process.platform === 'win32' ? 'claude.cmd' : 'claude');
    await writeFile(
      shimPath,
      process.platform === 'win32'
        ? `@echo off\r\nnode "${RAW_PROVIDER_SCRIPT_PATH}"\r\n`
        : `#!/bin/sh\nnode "${RAW_PROVIDER_SCRIPT_PATH}"\n`,
      'utf8',
    );
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
    } finally {
      process.env.PATH = originalPath;
      process.env.AUTOMATOSX_PROVIDER_NATIVE_ADAPTERS = originalNativeAdapters;
    }
  });

  it('reloads provider executor config after config.json changes within one runtime', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const scriptA = await writeConfiguredProviderScript(tempDir, 'CONFIG-A');
    await writeProviderConfig(tempDir, scriptA);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const first = await runtime.callProvider({
      prompt: 'refresh prompt',
      provider: 'claude',
      traceId: 'config-refresh-001',
      surface: 'cli',
    });
    expect(first.success).toBe(true);
    expect(first.content).toContain('CONFIG-A:refresh prompt');

    await new Promise((resolve) => setTimeout(resolve, 5));
    const scriptB = await writeConfiguredProviderScript(tempDir, 'CONFIG-B');
    await writeProviderConfig(tempDir, scriptB);

    const second = await runtime.callProvider({
      prompt: 'refresh prompt',
      provider: 'claude',
      traceId: 'config-refresh-002',
      surface: 'cli',
    });
    expect(second.success).toBe(true);
    expect(second.content).toContain('CONFIG-B:refresh prompt');
  });

  it('refreshes native provider preset detection when the CLI appears on the same PATH', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const shimPath = join(tempDir, process.platform === 'win32' ? 'claude.cmd' : 'claude');
    const originalPath = process.env.PATH;
    const originalNativeAdapters = process.env.AUTOMATOSX_PROVIDER_NATIVE_ADAPTERS;
    process.env.PATH = process.platform === 'win32'
      ? `${tempDir};${process.env.SystemRoot ?? 'C:\\Windows'}\\System32`
      : `${tempDir}:/usr/bin:/bin`;
    process.env.AUTOMATOSX_PROVIDER_NATIVE_ADAPTERS = 'true';

    try {
      const runtime = createSharedRuntimeService({ basePath: tempDir });
      const before = await runtime.callProvider({
        prompt: 'native refresh prompt',
        provider: 'claude',
        traceId: 'native-refresh-001',
        surface: 'cli',
      });
      expect(before.success).toBe(true);
      expect(before.executionMode).toBe('simulated');

      await writeFile(
        shimPath,
        process.platform === 'win32'
          ? `@echo off\r\n"${process.execPath}" "${RAW_PROVIDER_SCRIPT_PATH}"\r\n`
          : `#!/bin/sh\n"${process.execPath}" "${RAW_PROVIDER_SCRIPT_PATH}"\n`,
        'utf8',
      );
      if (process.platform !== 'win32') {
        await chmod(shimPath, 0o755);
      }

      const after = await runtime.callProvider({
        prompt: 'native refresh prompt',
        provider: 'claude',
        traceId: 'native-refresh-002',
        surface: 'cli',
      });
      expect(after.success).toBe(true);
      expect(after.executionMode).toBe('subprocess');
      expect(after.content).toContain('RAW:native refresh prompt');
    } finally {
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

  it('reloads shared runtime config after config.json changes within one runtime', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.setConfig('providers.default', 'claude');
    expect(await runtime.getConfig('providers.default')).toBe('claude');

    await new Promise((resolve) => setTimeout(resolve, 5));
    await writeFile(
      join(tempDir, '.automatosx', 'config.json'),
      `${JSON.stringify({
        providers: {
          default: 'gemini',
        },
      }, null, 2)}\n`,
      'utf8',
    );

    expect(await runtime.getConfig('providers.default')).toBe('gemini');
    expect(await runtime.showConfig()).toMatchObject({
      providers: {
        default: 'gemini',
      },
    });
  });

  it('falls back to an empty config when config.json is not a JSON object', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await mkdir(join(tempDir, '.automatosx'), { recursive: true });
    await writeFile(join(tempDir, '.automatosx', 'config.json'), '["invalid"]\n', 'utf8');

    const runtime = createSharedRuntimeService({ basePath: tempDir });

    expect(await runtime.showConfig()).toEqual({});
    expect(await runtime.getConfig('providers.default')).toBeUndefined();
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

    await initializeGitRepo(tempDir);
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

  it('does not drop running or failed traces from status when sampled trace listing misses them', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const sampledTraces: TraceRecord[] = [
      {
        traceId: 'sampled-completed-001',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:05.000Z',
        stepResults: [],
      },
    ];
    const runningTraces: TraceRecord[] = [
      {
        traceId: 'running-status-001',
        workflowId: 'ship',
        surface: 'cli',
        status: 'running',
        startedAt: '2026-03-23T00:00:01.000Z',
        stepResults: [],
      },
    ];
    const failedTraces: TraceRecord[] = [
      {
        traceId: 'failed-status-001',
        workflowId: 'release',
        surface: 'cli',
        status: 'failed',
        startedAt: '2026-03-23T00:00:00.000Z',
        completedAt: '2026-03-23T00:00:02.000Z',
        stepResults: [],
        error: {
          message: 'status failure',
        },
      },
    ];

    const traceStore: TraceStore = {
      upsertTrace: async (record) => record,
      getTrace: async () => undefined,
      listTraces: async () => sampledTraces,
      getTraceStatusCounts: async () => ({
        total: 7,
        running: 3,
        completed: 2,
        failed: 2,
      }),
      countTraces: async (status?: TraceRecord['status']) => (
        status === undefined ? 7 : status === 'running' ? 3 : status === 'completed' ? 2 : 2
      ),
      listTracesByStatus: async (status: TraceRecord['status']) => (
        status === 'running'
          ? runningTraces
          : status === 'failed'
            ? failedTraces
            : []
      ),
      listTracesByWorkflow: async () => [],
      listTracesBySession: async () => [],
      getTraceTree: async () => undefined,
      closeStuckTraces: async () => [],
      getHourlyMetrics: async () => [],
    };

    const stateStore = {
      storeMemory: async () => {
        throw new Error('not implemented');
      },
      getMemory: async () => undefined,
      searchMemory: async () => [],
      deleteMemory: async () => false,
      listMemory: async () => [],
      registerPolicy: async () => {
        throw new Error('not implemented');
      },
      listPolicies: async () => [],
      registerAgent: async () => {
        throw new Error('not implemented');
      },
      getAgent: async () => undefined,
      listAgents: async () => [],
      removeAgent: async () => false,
      listAgentCapabilities: async () => [],
      storeSemantic: async () => {
        throw new Error('not implemented');
      },
      searchSemantic: async () => [],
      getSemantic: async () => undefined,
      listSemantic: async () => [],
      deleteSemantic: async () => false,
      clearSemantic: async () => 0,
      semanticStats: async () => [],
      submitFeedback: async () => {
        throw new Error('not implemented');
      },
      listFeedback: async () => [],
      createSession: async () => {
        throw new Error('not implemented');
      },
      getSession: async () => undefined,
      listSessions: async () => [],
      getSessionStatusCounts: async () => ({
        total: 9,
        active: 4,
        completed: 3,
        failed: 2,
      }),
      countSessions: async (status?: 'active' | 'completed' | 'failed') => (
        status === undefined ? 9 : status === 'active' ? 4 : status === 'completed' ? 3 : 2
      ),
      listSessionsByStatus: async () => [
        {
          sessionId: 'active-status-001',
          task: 'Observe runtime',
          initiator: 'architect',
          status: 'active' as const,
          participants: [],
          createdAt: '2026-03-23T00:00:00.000Z',
          updatedAt: '2026-03-23T00:00:01.000Z',
        },
      ],
      joinSession: async () => {
        throw new Error('not implemented');
      },
      leaveSession: async () => {
        throw new Error('not implemented');
      },
      completeSession: async () => {
        throw new Error('not implemented');
      },
      failSession: async () => {
        throw new Error('not implemented');
      },
      closeStuckSessions: async () => [],
    };

    const runtime = createSharedRuntimeService({ basePath: tempDir, traceStore, stateStore });
    const status = await runtime.getStatus({ limit: 1 });

    expect(status.sessions).toMatchObject({
      total: 9,
      active: 4,
      completed: 3,
      failed: 2,
    });
    expect(status.traces).toMatchObject({
      total: 7,
      running: 3,
      completed: 2,
      failed: 2,
    });
    expect(status.runningTraces).toMatchObject([
      {
        traceId: 'running-status-001',
        status: 'running',
      },
    ]);
    expect(status.recentFailedTraces).toMatchObject([
      {
        traceId: 'failed-status-001',
        status: 'failed',
      },
    ]);
  });

  it('builds trace trees, feedback stats, abilities, and local git/pr helpers', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await initializeGitRepo(tempDir);
    await execFileAsync('git', ['checkout', '-b', 'feature/runtime-wave'], { cwd: tempDir });
    await writeFile(join(tempDir, 'tracked.txt'), 'baseline\nchanged\n', 'utf8');
    await writeFile(join(tempDir, 'new-file.ts'), 'export const value = 1;\n', 'utf8');

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'root-trace',
      workflowId: 'parallel.run',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-22T00:00:00.000Z',
      stepResults: [],
    });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'child-trace',
      workflowId: 'agent.run',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-22T00:01:00.000Z',
      stepResults: [],
      metadata: {
        parentTraceId: 'root-trace',
        rootTraceId: 'root-trace',
      },
    });

    const tree = await runtime.getTraceTree('child-trace');
    expect(tree).toMatchObject({
      traceId: 'root-trace',
      children: [
        {
          traceId: 'child-trace',
        },
      ],
    });

    await runtime.submitFeedback({
      selectedAgent: 'architect',
      rating: 5,
      taskDescription: 'Review rollout plan',
      outcome: 'accepted',
      durationMs: 1200,
    });
    await runtime.submitFeedback({
      selectedAgent: 'architect',
      rating: 4,
      taskDescription: 'Refine rollout plan',
      outcome: 'approved-with-edits',
      durationMs: 800,
    });

    const stats = await runtime.getFeedbackStats('architect');
    expect(stats).toMatchObject({
      agentId: 'architect',
      totalFeedback: 2,
      ratingsCount: 2,
      averageRating: 4.5,
    });
    const overview = await runtime.getFeedbackOverview();
    expect(overview.totalFeedback).toBe(2);
    const adjustment = await runtime.getFeedbackAdjustments('architect');
    expect(adjustment.adjustment).toBeGreaterThan(0);

    const abilities = await runtime.listAbilities({ category: 'review' });
    expect(abilities).toMatchObject([
      expect.objectContaining({ abilityId: 'code-review' }),
    ]);
    const injection = await runtime.injectAbilities({
      task: 'Review the diff for security and maintainability',
      maxAbilities: 2,
      includeMetadata: true,
    });
    expect(injection.abilities.length).toBeGreaterThan(0);
    expect(injection.content).toContain('Category:');

    const gitStatus = await runtime.gitStatus();
    expect(gitStatus.untracked).toContain('new-file.ts');
    expect(gitStatus.unstaged).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'tracked.txt' }),
    ]));

    const prepared = await runtime.commitPrepare({
      paths: ['tracked.txt'],
      type: 'fix',
      scope: 'shared-runtime',
    });
    expect(prepared.message).toBe('fix(shared-runtime): update shared-runtime');
    expect(prepared.stagedPaths).toContain('tracked.txt');

    await execFileAsync('git', ['add', 'new-file.ts'], { cwd: tempDir });
    await execFileAsync('git', ['commit', '-m', 'feature runtime change'], { cwd: tempDir });

    const review = await runtime.reviewPullRequest({ base: 'main', head: 'HEAD' });
    expect(review.changedFiles).toContain('tracked.txt');

    const originalPath = process.env.PATH;
    const ghPath = join(tempDir, process.platform === 'win32' ? 'gh.cmd' : 'gh');
    await writeFile(
      ghPath,
      process.platform === 'win32'
        ? '@echo off\r\necho https://example.test/pr/1\r\n'
        : '#!/bin/sh\necho https://example.test/pr/1\n',
      'utf8',
    );
    if (process.platform !== 'win32') {
      await execFileAsync('chmod', ['+x', ghPath]);
    }
    process.env.PATH = `${tempDir}${process.platform === 'win32' ? ';' : ':'}${originalPath ?? ''}`;

    try {
      const pr = await runtime.createPullRequest({
        title: 'Test PR',
        body: 'Body',
        base: 'main',
        head: 'HEAD',
      });
      expect(pr.url).toBe('https://example.test/pr/1');
    } finally {
      process.env.PATH = originalPath;
    }
  }, 10_000);

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

  it('runs a delegate-dispatch skill through the shared runtime and links the child agent trace', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const skillDir = join(tempDir, '.automatosx', 'skills', 'deploy-review');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), [
      '---',
      'name: Deploy Review',
      'dispatch: delegate',
      'linked-agent-id: deploy-reviewer',
      'description: Review deploy readiness and rollout risks.',
      '---',
      '# Deploy Review',
      '',
      'Use the deploy reviewer agent to assess rollout risk.',
      '',
    ].join('\n'), 'utf8');

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'deploy-reviewer',
      name: 'Deploy Reviewer',
      capabilities: ['deploy', 'review'],
    });

    const result = await runtime.runSkill({
      reference: 'deploy-review',
      args: ['check', 'rollout'],
      traceId: 'skill-run-001',
      sessionId: 'skill-session-001',
      basePath: tempDir,
      surface: 'cli',
    });

    expect(result).toMatchObject({
      traceId: 'skill-run-001',
      skillId: 'deploy-review',
      dispatch: 'delegate',
      success: true,
      agentId: 'deploy-reviewer',
      agentResult: expect.objectContaining({
        success: true,
        agentId: 'deploy-reviewer',
      }),
    });
    expect(result.agentResult?.content).toContain('Simulated agent output from deploy-reviewer');

    const trace = await runtime.getTrace('skill-run-001');
    expect(trace).toMatchObject({
      traceId: 'skill-run-001',
      workflowId: 'skill.run',
      status: 'completed',
      metadata: expect.objectContaining({
        skillId: 'deploy-review',
        dispatch: 'delegate',
        agentId: 'deploy-reviewer',
        sessionId: 'skill-session-001',
        skillTrustState: 'implicit-local',
      }),
    });

    const delegateTrace = await runtime.getTrace(result.agentResult?.traceId ?? '');
    expect(delegateTrace).toMatchObject({
      workflowId: 'agent.run',
      status: 'completed',
      metadata: expect.objectContaining({
        parentTraceId: 'skill-run-001',
        rootTraceId: 'skill-run-001',
        agentId: 'deploy-reviewer',
      }),
    });
  });

  it('reuses runSkill semantics from workflow tool steps', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await mkdir(join(tempDir, '.automatosx', 'skills', 'deploy-review'), { recursive: true });
    await writeFile(join(tempDir, '.automatosx', 'skills', 'deploy-review', 'SKILL.md'), [
      '---',
      'name: Deploy Review',
      'dispatch: delegate',
      'linked-agent-id: deploy-reviewer',
      'description: Review rollout readiness.',
      '---',
      '# Deploy Review',
      '',
      'Use the deploy reviewer agent to assess rollout readiness.',
      '',
    ].join('\n'), 'utf8');
    await writeFile(join(tempDir, 'workflow-skill-tool.json'), `${JSON.stringify({
      workflowId: 'workflow-skill-tool',
      version: '1.0.0',
      steps: [
        {
          stepId: 'run-skill',
          type: 'tool',
          config: {
            toolName: 'skill.run',
            toolInput: {
              reference: 'deploy-review',
              args: ['check', 'rollout'],
            },
          },
        },
      ],
    }, null, 2)}\n`, 'utf8');

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'deploy-reviewer',
      name: 'Deploy Reviewer',
      capabilities: ['deploy', 'review'],
    });

    const result = await runtime.runWorkflow({
      workflowId: 'workflow-skill-tool',
      workflowDir: tempDir,
      traceId: 'workflow-skill-tool-001',
      surface: 'cli',
    });

    expect(result.success).toBe(true);
    expect(result.stepResults[0]?.output).toMatchObject({
      type: 'tool',
      toolName: 'skill.run',
      toolOutput: expect.objectContaining({
        skillId: 'deploy-review',
        dispatch: 'delegate',
        success: true,
      }),
    });

    const skillTraceId = ((result.stepResults[0]?.output as {
      toolOutput?: { traceId?: string };
    })?.toolOutput?.traceId) ?? '';
    const skillTrace = await runtime.getTrace(skillTraceId);
    expect(skillTrace).toMatchObject({
      workflowId: 'skill.run',
      metadata: expect.objectContaining({
        parentTraceId: 'workflow-skill-tool-001',
        rootTraceId: 'workflow-skill-tool-001',
      }),
    });
  });

  it('blocks workflow tool steps when runtime trust state does not satisfy step requirements', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await mkdir(join(tempDir, '.automatosx', 'skills', 'deploy-review'), { recursive: true });
    await writeFile(join(tempDir, '.automatosx', 'skills', 'deploy-review', 'SKILL.md'), [
      '---',
      'name: Deploy Review',
      'dispatch: delegate',
      'linked-agent-id: deploy-reviewer',
      'description: Review rollout readiness.',
      '---',
      '# Deploy Review',
      '',
      'Use the deploy reviewer agent to assess rollout readiness.',
      '',
    ].join('\n'), 'utf8');
    await writeFile(join(tempDir, 'workflow-skill-trust.json'), `${JSON.stringify({
      workflowId: 'workflow-skill-trust',
      version: '1.0.0',
      steps: [
        {
          stepId: 'run-skill',
          type: 'tool',
          config: {
            toolName: 'skill.run',
            requiredTrustStates: ['trusted-id'],
            toolInput: {
              reference: 'deploy-review',
              args: ['check', 'rollout'],
            },
          },
        },
      ],
    }, null, 2)}\n`, 'utf8');

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'deploy-reviewer',
      name: 'Deploy Reviewer',
      capabilities: ['deploy', 'review'],
    });

    const result = await runtime.runWorkflow({
      workflowId: 'workflow-skill-trust',
      workflowDir: tempDir,
      traceId: 'workflow-skill-trust-001',
      surface: 'cli',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({
      code: 'WORKFLOW_GUARD_BLOCKED',
      failedStepId: 'run-skill',
      details: expect.objectContaining({
        guardId: 'enforce-runtime-trust',
        failedGates: ['runtime_trust'],
      }),
    });
    expect(result.guard).toMatchObject({
      blockedByRuntimeGovernance: true,
      guardId: 'enforce-runtime-trust',
      failedStepId: 'run-skill',
      toolName: 'skill.run',
      trustState: 'implicit-local',
      requiredTrustStates: ['trusted-id'],
    });
    expect(result.guard?.summary).toContain('Runtime governance blocked step "run-skill"');
    expect(result.guard?.summary).toContain('Trust state: implicit-local');
    expect(result.stepResults[0]?.output).toMatchObject({
      type: 'tool',
      toolName: 'skill.run',
      toolOutput: expect.objectContaining({
        skillId: 'deploy-review',
        skillTrust: expect.objectContaining({
          state: 'implicit-local',
        }),
      }),
    });
  });

  it('reuses bridge install and run semantics from workflow tool steps', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const installSourceDir = join(tempDir, 'fixtures', 'installable-bridge');
    await mkdir(installSourceDir, { recursive: true });
    await writeFile(join(installSourceDir, 'echo.js'), [
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2) }));",
      '',
    ].join('\n'), 'utf8');
    await chmod(join(installSourceDir, 'echo.js'), 0o755);
    await writeFile(join(installSourceDir, 'bridge.json'), `${JSON.stringify({
      schemaVersion: 1,
      bridgeId: 'workflow-bridge',
      name: 'Workflow Bridge',
      version: '0.1.0',
      description: 'Installable workflow bridge.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
    }, null, 2)}\n`, 'utf8');
    await writeFile(join(tempDir, 'workflow-bridge-tool.json'), `${JSON.stringify({
      workflowId: 'workflow-bridge-tool',
      version: '1.0.0',
      steps: [
        {
          stepId: 'install-bridge',
          type: 'tool',
          config: {
            toolName: 'bridge.install',
            toolInput: {
              sourcePath: 'fixtures/installable-bridge',
            },
          },
        },
        {
          stepId: 'run-bridge',
          type: 'tool',
          config: {
            toolName: 'bridge.run',
            toolInput: {
              reference: 'workflow-bridge',
              args: ['hello'],
            },
          },
        },
      ],
    }, null, 2)}\n`, 'utf8');

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const result = await runtime.runWorkflow({
      workflowId: 'workflow-bridge-tool',
      workflowDir: tempDir,
      traceId: 'workflow-bridge-tool-001',
      surface: 'cli',
    });

    expect(result.success).toBe(true);
    expect(result.stepResults[0]?.output).toMatchObject({
      type: 'tool',
      toolName: 'bridge.install',
      toolOutput: expect.objectContaining({
        definition: expect.objectContaining({
          bridgeId: 'workflow-bridge',
          provenance: expect.objectContaining({
            importer: 'ax.bridge.install',
          }),
        }),
        trust: expect.objectContaining({
          allowed: true,
          state: 'implicit-local',
        }),
      }),
    });
    expect(result.stepResults[1]?.output).toMatchObject({
      type: 'tool',
      toolName: 'bridge.run',
      toolOutput: expect.objectContaining({
        execution: expect.objectContaining({
          exitCode: 0,
          stdout: expect.stringContaining('"args":["hello"]'),
        }),
      }),
    });
  });

  it('surfaces denied trust warnings for bridge installs by default', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const installSourceDir = join(tempDir, 'fixtures', 'direct-remote-bridge');
    await mkdir(installSourceDir, { recursive: true });
    await writeFile(join(installSourceDir, 'echo.js'), [
      "process.stdout.write('ok\\n');",
      '',
    ].join('\n'), 'utf8');
    await chmod(join(installSourceDir, 'echo.js'), 0o755);
    await writeFile(join(installSourceDir, 'bridge.json'), `${JSON.stringify({
      schemaVersion: 1,
      bridgeId: 'direct-remote-bridge',
      name: 'Direct Remote Bridge',
      version: '0.1.0',
      description: 'Direct bridge service install with denied trust.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/direct-remote-bridge',
      },
    }, null, 2)}\n`, 'utf8');

    const bridgeService = createRuntimeBridgeService({ basePath: tempDir });
    const installed = await bridgeService.installBridgeDefinition(installSourceDir);

    expect(installed.trust).toMatchObject({
      allowed: false,
      state: 'denied',
      sourceRef: 'https://github.com/example/direct-remote-bridge',
    });
    expect(installed.warnings).toEqual([
      expect.stringContaining('installed, but trust is currently denied'),
    ]);
    const installedRaw = await readFile(join(tempDir, '.automatosx', 'bridges', 'direct-remote-bridge', 'bridge.json'), 'utf8');
    expect(installedRaw).toContain('"bridgeId": "direct-remote-bridge"');
  });

  it('rejects denied bridge installs in bridge service strict mode before writing files', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const installSourceDir = join(tempDir, 'fixtures', 'direct-strict-bridge');
    await mkdir(installSourceDir, { recursive: true });
    await writeFile(join(installSourceDir, 'echo.js'), [
      "process.stdout.write('ok\\n');",
      '',
    ].join('\n'), 'utf8');
    await chmod(join(installSourceDir, 'echo.js'), 0o755);
    await writeFile(join(installSourceDir, 'bridge.json'), `${JSON.stringify({
      schemaVersion: 1,
      bridgeId: 'direct-strict-bridge',
      name: 'Direct Strict Bridge',
      version: '0.1.0',
      description: 'Strict mode should block denied installs.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/direct-strict-bridge',
      },
    }, null, 2)}\n`, 'utf8');

    const bridgeService = createRuntimeBridgeService({ basePath: tempDir });
    await expect(bridgeService.installBridgeDefinition(installSourceDir, {
      requireTrusted: true,
    })).rejects.toMatchObject({
      code: 'BRIDGE_INSTALL_TRUST_REQUIRED',
    });
    await expect(readFile(join(tempDir, '.automatosx', 'bridges', 'direct-strict-bridge', 'bridge.json'), 'utf8')).rejects.toThrow();
  });

  it('surfaces denied trust warnings for skill imports by default', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const sourcePath = join(tempDir, 'fixtures', 'guarded-import-skill', 'SKILL.md');
    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, [
      '---',
      'name: Guarded Import Skill',
      'approval-mode: prompt',
      'dispatch: delegate',
      'linked-agent-id: guarded-reviewer',
      'description: Requires explicit trust on import.',
      '---',
      '# Guarded Import Skill',
      '',
      'Import this skill for review workflows.',
      '',
    ].join('\n'), 'utf8');

    const bridgeService = createRuntimeBridgeService({ basePath: tempDir });
    const imported = await bridgeService.importSkillDocument(sourcePath);

    expect(imported.trust).toMatchObject({
      allowed: false,
      state: 'denied',
    });
    expect(imported.warnings).toEqual([
      expect.stringContaining('imported, but trust is currently denied'),
    ]);
    const canonicalRaw = await readFile(join(tempDir, '.automatosx', 'skills', 'guarded-import-skill', 'skill.json'), 'utf8');
    expect(canonicalRaw).toContain('"skillId": "guarded-import-skill"');
  });

  it('rejects denied skill imports in bridge service strict mode before writing files', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const sourcePath = join(tempDir, 'fixtures', 'strict-import-skill', 'SKILL.md');
    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, [
      '---',
      'name: Strict Import Skill',
      'approval-mode: prompt',
      'dispatch: delegate',
      'linked-agent-id: strict-reviewer',
      'description: Strict skill import should fail.',
      '---',
      '# Strict Import Skill',
      '',
      'This import should be rejected in strict mode.',
      '',
    ].join('\n'), 'utf8');

    const bridgeService = createRuntimeBridgeService({ basePath: tempDir });
    await expect(bridgeService.importSkillDocument(sourcePath, {
      requireTrusted: true,
    })).rejects.toMatchObject({
      code: 'SKILL_IMPORT_TRUST_REQUIRED',
    });
    await expect(readFile(join(tempDir, '.automatosx', 'skills', 'strict-import-skill', 'skill.json'), 'utf8')).rejects.toThrow();
  });

  it('blocks workflow bridge installs when installed bridge trust is denied', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const installSourceDir = join(tempDir, 'fixtures', 'remote-bridge');
    await mkdir(installSourceDir, { recursive: true });
    await writeFile(join(installSourceDir, 'echo.js'), [
      "process.stdout.write('ok\\n');",
      '',
    ].join('\n'), 'utf8');
    await chmod(join(installSourceDir, 'echo.js'), 0o755);
    await writeFile(join(installSourceDir, 'bridge.json'), `${JSON.stringify({
      schemaVersion: 1,
      bridgeId: 'remote-bridge',
      name: 'Remote Bridge',
      version: '0.1.0',
      description: 'Carries remote provenance metadata.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/remote-bridge',
      },
    }, null, 2)}\n`, 'utf8');
    await writeFile(join(tempDir, 'workflow-bridge-install-trust.json'), `${JSON.stringify({
      workflowId: 'workflow-bridge-install-trust',
      version: '1.0.0',
      steps: [
        {
          stepId: 'install-bridge',
          type: 'tool',
          config: {
            toolName: 'bridge.install',
            toolInput: {
              sourcePath: 'fixtures/remote-bridge',
            },
          },
        },
      ],
    }, null, 2)}\n`, 'utf8');

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const result = await runtime.runWorkflow({
      workflowId: 'workflow-bridge-install-trust',
      workflowDir: tempDir,
      traceId: 'workflow-bridge-install-trust-001',
      surface: 'cli',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({
      code: 'WORKFLOW_GUARD_BLOCKED',
      failedStepId: 'install-bridge',
    });
    expect(result.guard).toMatchObject({
      blockedByRuntimeGovernance: true,
      toolName: 'bridge.install',
      trustState: 'denied',
      sourceRef: 'https://github.com/example/remote-bridge',
    });
    expect(result.guard?.summary).toContain('Runtime governance blocked step "install-bridge"');
    expect(result.guard?.summary).toContain('Trust state: denied');
    expect(result.stepResults[0]?.output).toMatchObject({
      type: 'tool',
      toolName: 'bridge.install',
      toolOutput: expect.objectContaining({
        trust: expect.objectContaining({
          allowed: false,
          state: 'denied',
          sourceRef: 'https://github.com/example/remote-bridge',
        }),
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
    const childTrace = await runtime.getTrace(childTraceId!);
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

    await writeFile(
      join(tempDir, 'discussion-budget.json'),
      `${JSON.stringify({
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
      }, null, 2)}\n`,
      'utf8',
    );

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

    await writeFile(
      join(tempDir, 'discussion-queue.json'),
      `${JSON.stringify({
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
      }, null, 2)}\n`,
      'utf8',
    );

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
      .map((output) => (output as { metadata?: { queueDepth?: number; roundsExecuted?: number } }).metadata?.queueDepth ?? 0);
    const roundsExecuted = [first.output, second.output]
      .map((output) => (output as { metadata?: { queueDepth?: number; roundsExecuted?: number } }).metadata?.roundsExecuted ?? 0);
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
      workflowDir: SHARED_RUNTIME_BUNDLED_WORKFLOW_DIR,
    });
    expect(description).toMatchObject({
      workflowId: 'architect',
      version: '1.0.0',
      source: 'workflow-definition',
    });
    expect(description?.steps[0]).toMatchObject({
      stepId: 'analyze-requirement',
      type: 'prompt',
    });

    const review = await runtime.analyzeReview({
      paths: [sourceDir],
      focus: 'all',
      traceId: 'shared-review-001',
      sessionId: 'shared-review-session-001',
      basePath: tempDir,
      surface: 'cli',
    });
    expect(review.success).toBe(true);
    expect(review.traceId).toBe('shared-review-001');
    expect(review.findings.length).toBeGreaterThan(0);
    await expect(runtime.getSession('shared-review-session-001')).resolves.toMatchObject({
      sessionId: 'shared-review-session-001',
      task: expect.stringContaining('Review:'),
      initiator: 'cli',
      status: 'active',
      metadata: expect.objectContaining({
        autoCreated: true,
        command: 'review',
      }),
    });

    const reviews = await runtime.listReviewTraces(5);
    expect(reviews).toMatchObject([
      {
        traceId: 'shared-review-001',
        workflowId: 'review',
        status: 'completed',
      },
    ]);
  });

  it('resolves review paths relative to the requested base path', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const sourceDir = join(tempDir, 'src');
    mkdirSync(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, 'relative-review.ts'), [
      'export function relativeReview(value: any) {',
      '  console.log(value);',
      '  return value;',
      '}',
      '',
    ].join('\n'), 'utf8');

    const runtime = createSharedRuntimeService({ basePath: join(SHARED_RUNTIME_PACKAGE_ROOT, 'tmp', 'unrelated-runtime-root') });
    const review = await runtime.analyzeReview({
      paths: ['src'],
      focus: 'all',
      traceId: 'shared-review-relative-001',
      basePath: tempDir,
      surface: 'cli',
    });

    expect(review.success).toBe(true);
    expect(review.filesScanned).toBe(1);
    expect(review.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        file: 'src/relative-review.ts',
        ruleId: 'maintainability.console-log',
      }),
    ]));
  });

  it('does not drop older review traces when listReviewTraces is called with a limit', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const traces: TraceRecord[] = [
      {
        traceId: 'newest-trace-001',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:05.000Z',
        stepResults: [],
      },
      {
        traceId: 'newest-trace-002',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:04.000Z',
        stepResults: [],
      },
      {
        traceId: 'newest-trace-003',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:03.000Z',
        stepResults: [],
      },
      {
        traceId: 'newest-trace-004',
        workflowId: 'ship',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:02.000Z',
        stepResults: [],
      },
      {
        traceId: 'older-review-trace-001',
        workflowId: 'review',
        surface: 'cli',
        status: 'completed',
        startedAt: '2026-03-23T00:00:01.000Z',
        stepResults: [],
      },
    ];

    const traceStore: TraceStore = {
      upsertTrace: async (record) => record,
      getTrace: async () => undefined,
      listTraces: async (limit?: number) => limit === undefined ? traces : traces.slice(0, limit),
      getTraceStatusCounts: async () => ({
        total: traces.length,
        running: 0,
        completed: traces.length,
        failed: 0,
      }),
      countTraces: async () => traces.length,
      listTracesByStatus: async () => [],
      listTracesByWorkflow: async (workflowId: string, limit?: number) => {
        const filtered = traces.filter((trace) => trace.workflowId === workflowId);
        return limit === undefined ? filtered : filtered.slice(0, limit);
      },
      listTracesBySession: async () => [],
      getTraceTree: async () => undefined,
      closeStuckTraces: async () => [],
      getHourlyMetrics: async () => [],
    };

    const runtime = createSharedRuntimeService({ basePath: tempDir, traceStore });
    const reviewTraces = await runtime.listReviewTraces(1);

    expect(reviewTraces).toMatchObject([
      {
        traceId: 'older-review-trace-001',
        workflowId: 'review',
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

async function configureMockProviders(tempDir: string, providers: string[]): Promise<void> {
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

async function writeConfiguredProviderScript(tempDir: string, label: string): Promise<string> {
  const scriptPath = join(tempDir, `configured-provider-${label.toLowerCase()}.mjs`);
  await writeFile(scriptPath, [
    "let input = '';",
    "process.stdin.setEncoding('utf8');",
    "process.stdin.on('data', (chunk) => { input += chunk; });",
    "process.stdin.on('end', () => {",
    "  const payload = JSON.parse(input || '{}');",
    "  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';",
    "  const firstLine = prompt.split(/\\n+/)[0] || prompt;",
    "  process.stdout.write(JSON.stringify({",
    "    success: true,",
    "    provider: payload.provider || 'claude',",
    "    model: 'configured-test',",
    `    content: '${label}:' + firstLine,`,
    "    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }",
    "  }));",
    "});",
  ].join('\n'), 'utf8');
  return scriptPath;
}

async function writeProviderConfig(tempDir: string, scriptPath: string): Promise<void> {
  const configDir = join(tempDir, '.automatosx');
  mkdirSync(configDir, { recursive: true });
  await writeFile(
    join(configDir, 'config.json'),
    `${JSON.stringify({
      providers: {
        executors: {
          claude: {
            command: 'node',
            args: [scriptPath],
          },
        },
      },
    }, null, 2)}\n`,
    'utf8',
  );
}

async function initializeGitRepo(tempDir: string): Promise<void> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: tempDir });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
  await writeFile(join(tempDir, 'tracked.txt'), 'baseline\n', 'utf8');
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd: tempDir });
  await execFileAsync('git', ['commit', '-m', 'init'], { cwd: tempDir });
}

function clearProviderExecutorEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (key === 'AUTOMATOSX_PROVIDER_EXECUTION_MODE' || key.startsWith('AUTOMATOSX_PROVIDER_')) {
      delete process.env[key];
    }
  }
}
