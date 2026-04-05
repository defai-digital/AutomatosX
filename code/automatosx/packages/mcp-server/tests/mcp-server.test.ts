import { mkdirSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { chmod, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { createRuntimeBridgeService } from '@defai.digital/shared-runtime/bridge';
import { RuntimeGovernanceAggregateSchema } from '@defai.digital/shared-runtime/governance';
import { initCommand, setupCommand } from '../../cli/src/commands/index.js';
import type { CLIOptions } from '../../cli/src/types.js';
import {
  createMcpServerSurface,
  DEFAULT_SETUP_MCP_TOOL_FAMILIES,
  LEGACY_MCP_TOOL_ALIASES,
  MCP_BASE_PATH_ENV_VAR,
  STABLE_V15_MCP_TOOL_FAMILIES,
} from '../src/index.js';
import { ensurePackageBuilt } from '../../../tests/support/ensure-built.js';

const execFileAsync = promisify(execFile);
const PROCESS_TEST_TIMEOUT_MS = 20_000;
const MCP_SERVER_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_ROOT = resolve(MCP_SERVER_PACKAGE_ROOT, '..', '..');
const CLI_ENTRY_PATH = join(WORKSPACE_ROOT, 'packages', 'cli', 'dist', 'main.js');
const SHARED_RUNTIME_BUNDLED_WORKFLOW_DIR = join(WORKSPACE_ROOT, 'packages', 'shared-runtime', 'workflows');
const MCP_CONFIG_PATH = join(WORKSPACE_ROOT, '.automatosx', 'mcp.json');

function createTempDir(): string {
  const dir = join(MCP_SERVER_PACKAGE_ROOT, '.tmp', `mcp-surface-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function defaultOptions(overrides: Partial<CLIOptions> = {}): CLIOptions {
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

async function writeBridgeDefinition(basePath: string, content: unknown, relativePath = join('.automatosx', 'bridges', 'sample', 'bridge.json')): Promise<string> {
  const path = join(basePath, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  return path;
}

async function writeSkillSource(basePath: string, content: string, relativePath = join('.automatosx', 'skills', 'sample', 'SKILL.md')): Promise<string> {
  const path = join(basePath, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  return path;
}

async function writeScriptFile(basePath: string, relativePath: string, content: string): Promise<string> {
  const path = join(basePath, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  await chmod(path, 0o755);
  return path;
}

describe('mcp server surface', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    delete process.env.AX_MCP_TOOL_PREFIX;
    delete process.env[MCP_BASE_PATH_ENV_VAR];
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('runs workflow tools against the shared runtime and shared trace store', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const runResult = await surface.invokeTool('workflow_run', {
      workflowId: 'architect',
      traceId: 'mcp-trace-001',
      sessionId: 'mcp-session-001',
      input: { prompt: 'design auth system' },
    });

    expect(runResult.success).toBe(true);

    const traceResult = await surface.invokeTool('trace_get', {
      traceId: 'mcp-trace-001',
    });
    const analysisResult = await surface.invokeTool('trace_analyze', {
      traceId: 'mcp-trace-001',
    });
    const bySessionResult = await surface.invokeTool('trace_by_session', {
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

  it('returns runtime-governance guard summaries from workflow_run', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    mkdirSync(join(tempDir, '.automatosx', 'skills', 'deploy-review'), { recursive: true });
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

    const surface = createMcpServerSurface({ basePath: tempDir });
    const runResult = await surface.invokeTool('workflow_run', {
      workflowId: 'workflow-skill-trust',
      workflowDir: tempDir,
      traceId: 'mcp-guard-trace-001',
    });

    expect(runResult.success).toBe(true);
    expect(runResult.data).toMatchObject({
      success: false,
      workflowId: 'workflow-skill-trust',
      error: expect.objectContaining({
        code: 'WORKFLOW_GUARD_BLOCKED',
        failedStepId: 'run-skill',
      }),
      guard: expect.objectContaining({
        blockedByRuntimeGovernance: true,
        toolName: 'skill.run',
        trustState: 'implicit-local',
      }),
    });
    expect((runResult.data as { guard?: { summary?: string } }).guard?.summary).toContain('Runtime governance blocked step "run-skill"');
  });

  it('exposes bundled stable workflow definitions over MCP without a local workflow directory', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const listed = await surface.invokeTool('workflow_list');
    const described = await surface.invokeTool('workflow_describe', {
      workflowId: 'architect',
    });

    expect(listed.success).toBe(true);
    expect(listed.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        workflowId: 'architect',
        version: '1.0.0',
      }),
    ]));
    expect(described.success).toBe(true);
    expect(described.data).toMatchObject({
      workflowId: 'architect',
      version: '1.0.0',
      source: 'workflow-definition',
    });
    expect((described.data as { steps?: Array<{ stepId: string; type: string }> }).steps?.[0]).toMatchObject({
      stepId: 'analyze-requirement',
      type: 'prompt',
    });
  });

  it('keeps the stable v15 MCP tool families available under unprefixed canonical names', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const toolNames = new Set(surface.listTools());
    const toolDefinitions = new Set(surface.listToolDefinitions().map((tool) => tool.name));

    expect(Array.from(STABLE_V15_MCP_TOOL_FAMILIES).every((toolName) => toolNames.has(toolName))).toBe(true);
    expect(Array.from(STABLE_V15_MCP_TOOL_FAMILIES).every((toolName) => toolDefinitions.has(toolName))).toBe(true);
    expect(Array.from(LEGACY_MCP_TOOL_ALIASES).every((toolName) => toolNames.has(toolName))).toBe(false);
    expect(Array.from(LEGACY_MCP_TOOL_ALIASES).every((toolName) => toolDefinitions.has(toolName))).toBe(false);
  });

  it('keeps generated mcp config aligned with the stable v15 MCP tool families', async () => {
    const configuredTools = new Set(
      (JSON.parse(readFileSync(MCP_CONFIG_PATH, 'utf8')) as { tools?: string[] }).tools ?? [],
    );

    expect(Array.from(STABLE_V15_MCP_TOOL_FAMILIES).every((toolName) => configuredTools.has(toolName))).toBe(true);
    expect(Array.from(LEGACY_MCP_TOOL_ALIASES).every((toolName) => configuredTools.has(toolName))).toBe(false);
  });

  it('keeps the checked-in default setup mcp config narrowed to the stable v15 tool families', async () => {
    const configuredTools = (
      JSON.parse(readFileSync(MCP_CONFIG_PATH, 'utf8')) as { tools?: string[] }
    ).tools ?? [];

    expect(configuredTools).toEqual([...DEFAULT_SETUP_MCP_TOOL_FAMILIES]);
  });

  it('defaults the MCP surface base path to the current working directory', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);

      const surface = createMcpServerSurface();
      const runResult = await surface.invokeTool('workflow_run', {
        workflowId: 'architect',
        traceId: 'mcp-cwd-trace-001',
      });

      expect(runResult.success).toBe(true);

      const runtime = createSharedRuntimeService({ basePath: tempDir });
      await expect(runtime.getTrace('mcp-cwd-trace-001')).resolves.toMatchObject({
        traceId: 'mcp-cwd-trace-001',
        workflowId: 'architect',
        surface: 'mcp',
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('prefers the MCP workspace env override over the current working directory', async () => {
    const workspaceDir = createTempDir();
    const launcherDir = createTempDir();
    tempDirs.push(workspaceDir, launcherDir);
    const originalCwd = process.cwd();

    try {
      process.env[MCP_BASE_PATH_ENV_VAR] = workspaceDir;
      process.chdir(launcherDir);

      const surface = createMcpServerSurface();
      const runResult = await surface.invokeTool('workflow_run', {
        workflowId: 'architect',
        traceId: 'mcp-env-trace-001',
      });

      expect(runResult.success).toBe(true);

      const runtime = createSharedRuntimeService({ basePath: workspaceDir });
      await expect(runtime.getTrace('mcp-env-trace-001')).resolves.toMatchObject({
        traceId: 'mcp-env-trace-001',
        workflowId: 'architect',
        surface: 'mcp',
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('shares memory, policy, and dashboard tools on the same stores', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });

    await surface.invokeTool('memory_store', {
      namespace: 'qa',
      key: 'latest-run',
      value: { target: 'checkout' },
    });
    await surface.invokeTool('policy_register', {
      policyId: 'provider-refactor',
      name: 'Provider Refactor',
    });
    await surface.invokeTool('workflow_run', {
      workflowId: 'qa',
      workflowDir: SHARED_RUNTIME_BUNDLED_WORKFLOW_DIR,
      traceId: 'mcp-trace-qa',
      input: { prompt: 'qa checkout' },
    });

    const memories = await surface.invokeTool('memory_list', { namespace: 'qa' });
    const policies = await surface.invokeTool('policy_list');
    const dashboard = await surface.invokeTool('dashboard_list');

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
    expect(dashboard.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        traceId: 'mcp-trace-qa',
        workflowId: 'qa',
        surface: 'mcp',
      }),
    ]));
  });

  it('records generic MCP tool requests in the shared trace store without polluting sessions', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const surface = createMcpServerSurface({ basePath: tempDir, runtimeService: runtime });

    const result = await surface.invokeTool('memory_store', {
      namespace: 'ops',
      key: 'latest-request',
      value: { scope: 'monitor' },
    });

    expect(result.success).toBe(true);

    const traces = await runtime.listTraces();
    const requestTrace = traces.find((trace) => trace.workflowId === 'mcp.tool.memory_store');
    expect(requestTrace).toMatchObject({
      surface: 'mcp',
      status: 'completed',
      metadata: expect.objectContaining({
        command: 'memory_store',
        displayLabel: 'MCP: Memory Store',
        requestKind: 'mcp-tool',
        summary: 'ops/latest-request',
      }),
    });

    expect(requestTrace?.metadata?.sessionId).toBeUndefined();
    await expect(runtime.listSessions()).resolves.toEqual([]);
  });

  it('creates a distinct implicit session for each sessionless MCP execution request', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const surface = createMcpServerSurface({ basePath: tempDir, runtimeService: runtime });

    const first = await surface.invokeTool('workflow_run', {
      workflowId: 'architect',
      traceId: 'mcp-sessionless-001',
    });
    const second = await surface.invokeTool('workflow_run', {
      workflowId: 'architect',
      traceId: 'mcp-sessionless-002',
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);

    const sessions = await runtime.listSessions();
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((session) => session.sessionId)).size).toBe(2);
    expect(sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        initiator: 'mcp',
        task: 'Run workflow: architect',
        status: 'completed',
        metadata: expect.objectContaining({
          command: 'workflow.run',
          surface: 'mcp',
        }),
      }),
    ]));

    const [firstTrace, secondTrace] = await Promise.all([
      runtime.getTrace('mcp-sessionless-001'),
      runtime.getTrace('mcp-sessionless-002'),
    ]);
    expect(firstTrace?.metadata?.sessionId).not.toBe(secondTrace?.metadata?.sessionId);
  });

  it('exposes extended memory, config, and stuck-session tools', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const surface = createMcpServerSurface({ basePath: tempDir, runtimeService: runtime });
    await surface.invokeTool('memory_store', {
      namespace: 'release',
      key: 'latest',
      value: { version: '14.0.0' },
    });

    const loaded = await surface.invokeTool('memory_retrieve', {
      namespace: 'release',
      key: 'latest',
    });
    const searched = await surface.invokeTool('memory_search', {
      query: '14.0.0',
    });
    const deleted = await surface.invokeTool('memory_delete', {
      namespace: 'release',
      key: 'latest',
    });

    await surface.invokeTool('config_set', {
      path: 'providers.default',
      value: 'claude',
    });
    const configValue = await surface.invokeTool('config_get', {
      path: 'providers.default',
    });
    const configAll = await surface.invokeTool('config_show');

    await surface.invokeTool('session_create', {
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
    const closed = await surface.invokeTool('session_close_stuck', {
      maxAgeMs: 0,
    });
    const closedTraces = await surface.invokeTool('trace_close_stuck', {
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
    expect(closed.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sessionId: 'mcp-session-stuck-001',
        status: 'failed',
      }),
    ]));
    expect(closedTraces.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        traceId: 'mcp-trace-stuck-001',
        status: 'failed',
      }),
    ]));
  });

  it('imports memory entries and skips duplicates when overwrite is disabled', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    await surface.invokeTool('memory_store', {
      namespace: 'bulk',
      key: 'existing-entry',
      value: { scope: 'existing' },
    });

    const imported = await surface.invokeTool('memory_import', {
      entries: [
        { key: 'valid-entry', namespace: 'bulk', value: { scope: 'checkout' } },
        { key: 'existing-entry', namespace: 'bulk', value: { scope: 'updated' } },
      ],
    });
    const loaded = await surface.invokeTool('memory_list', { namespace: 'bulk' });

    expect(imported.success).toBe(true);
    expect(imported.data).toMatchObject({
      imported: 1,
      skipped: 1,
    });
    expect(loaded.success).toBe(true);
    expect(loaded.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'valid-entry',
        namespace: 'bulk',
      }),
      expect.objectContaining({
        key: 'existing-entry',
        namespace: 'bulk',
      }),
    ]));
  });

  it('exposes feedback, abilities, trace trees, and local git/pr helpers', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await initializeGitRepo(tempDir);
    await execFileAsync('git', ['checkout', '-b', 'feature/mcp-wave'], { cwd: tempDir });
    await writeFile(join(tempDir, 'tracked.txt'), 'baseline\nchanged\n', 'utf8');

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'tree-root',
      workflowId: 'parallel.run',
      surface: 'mcp',
      status: 'completed',
      startedAt: '2026-03-22T00:00:00.000Z',
      stepResults: [],
    });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'tree-child',
      workflowId: 'agent.run',
      surface: 'mcp',
      status: 'completed',
      startedAt: '2026-03-22T00:01:00.000Z',
      stepResults: [],
      metadata: {
        parentTraceId: 'tree-root',
        rootTraceId: 'tree-root',
      },
    });

    const surface = createMcpServerSurface({ basePath: tempDir, runtimeService: runtime });
    const feedback = await surface.invokeTool('feedback_submit', {
      selectedAgent: 'architect',
      rating: 5,
      taskDescription: 'Review rollout plan',
      outcome: 'accepted',
    });
    const feedbackStats = await surface.invokeTool('feedback_stats', { agentId: 'architect' });
    const abilities = await surface.invokeTool('ability_list', { category: 'review' });
    const injection = await surface.invokeTool('ability_inject', { task: 'Review the diff for security issues' });
    const tree = await surface.invokeTool('trace_tree', { traceId: 'tree-child' });
    const gitStatus = await surface.invokeTool('git_status', {});
    const commitPrepare = await surface.invokeTool('commit_prepare', {
      paths: ['tracked.txt'],
      type: 'fix',
      scope: 'mcp',
    });

    await execFileAsync('git', ['commit', '-m', 'feature mcp change'], { cwd: tempDir });
    const prReview = await surface.invokeTool('pr_review', { base: 'main', head: 'HEAD' });

    const originalPath = process.env.PATH;
    const ghPath = join(tempDir, process.platform === 'win32' ? 'gh.cmd' : 'gh');
    await writeFile(
      ghPath,
      process.platform === 'win32'
        ? '@echo off\r\necho https://example.test/pr/2\r\n'
        : '#!/bin/sh\necho https://example.test/pr/2\n',
      'utf8',
    );
    if (process.platform !== 'win32') {
      await execFileAsync('chmod', ['+x', ghPath]);
    }
    process.env.PATH = `${tempDir}${process.platform === 'win32' ? ';' : ':'}${originalPath ?? ''}`;

    try {
      const prCreate = await surface.invokeTool('pr_create', {
        title: 'MCP test PR',
        base: 'main',
        head: 'HEAD',
      });

      expect(feedback.success).toBe(true);
      expect(feedbackStats.data).toMatchObject({ agentId: 'architect', averageRating: 5 });
      expect(abilities.data).toMatchObject([expect.objectContaining({ abilityId: 'code-review' })]);
      expect((injection.data as { content: string }).content).toContain('review');
      expect(tree.data).toMatchObject({ traceId: 'tree-root' });
      expect(gitStatus.data).toMatchObject({ branch: 'feature/mcp-wave' });
      expect(commitPrepare.data).toMatchObject({ message: 'fix(mcp): update mcp' });
      expect(prReview.data).toMatchObject({ base: 'main' });
      expect(prCreate.data).toMatchObject({ url: 'https://example.test/pr/2' });
    } finally {
      process.env.PATH = originalPath;
    }
  }, 15000);

  it('exposes guard list/apply/check tools on the MCP surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const listed = await surface.invokeTool('guard_list');
    expect(listed.success).toBe(true);
    expect(listed.data).toMatchObject([
      expect.objectContaining({ policyId: 'step-validation' }),
      expect.objectContaining({ policyId: 'safe-filesystem' }),
      expect.objectContaining({ policyId: 'runtime-governance' }),
    ]);

    const applied = await surface.invokeTool('guard_apply', {
      policyId: 'step-validation',
    });
    expect(applied.success).toBe(true);
    expect(applied.data).toMatchObject({ policyId: 'step-validation' });

    const checked = await surface.invokeTool('guard_check', {
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

    const filesystemChecked = await surface.invokeTool('guard_check', {
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
    const created = await surface.invokeTool('directory_create', {
      path: 'notes',
    });
    expect(created.success).toBe(true);

    const written = await surface.invokeTool('file_write', {
      path: 'notes/todo.txt',
      content: 'hello\n',
      createDirectories: true,
    });
    expect(written.success).toBe(true);

    const exists = await surface.invokeTool('file_exists', {
      path: 'notes/todo.txt',
    });
    expect(exists.success).toBe(true);
    expect(exists.data).toMatchObject({ exists: true });

    await execFileAsync('git', ['add', 'notes/todo.txt'], { cwd: tempDir });
    await execFileAsync('git', ['commit', '-m', 'add note'], { cwd: tempDir });
    await surface.invokeTool('file_write', {
      path: 'notes/todo.txt',
      content: 'hello\nchanged\n',
      overwrite: true,
    });

    const diff = await surface.invokeTool('git_diff', {});
    expect(diff.success).toBe(true);
    expect((diff.data as { diff: string }).diff).toContain('todo.txt');
  });

  it('forwards basePath to filesystem tools on the MCP surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: join(MCP_SERVER_PACKAGE_ROOT, 'tmp', 'unrelated-mcp-root') });
    const created = await surface.invokeTool('directory_create', {
      path: 'notes',
      basePath: tempDir,
    });
    const written = await surface.invokeTool('file_write', {
      path: 'notes/override.txt',
      content: 'hello\n',
      createDirectories: true,
      basePath: tempDir,
    });
    const exists = await surface.invokeTool('file_exists', {
      path: 'notes/override.txt',
      basePath: tempDir,
    });

    expect(created.success).toBe(true);
    expect(written.success).toBe(true);
    expect(exists.success).toBe(true);
    expect(exists.data).toMatchObject({ exists: true });
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
    const description = await surface.invokeTool('workflow_describe', {
      workflowId: 'architect',
      workflowDir: SHARED_RUNTIME_BUNDLED_WORKFLOW_DIR,
    });
    const discussion = await surface.invokeTool('discuss_run', {
      topic: 'Compare release strategies',
      traceId: 'mcp-discuss-001',
      providers: ['claude', 'gemini'],
      rounds: 2,
    });
    const review = await surface.invokeTool('review_analyze', {
      paths: [sourceDir],
      traceId: 'mcp-review-001',
      focus: 'all',
    });
    const reviewList = await surface.invokeTool('review_list', { limit: 5 });

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

  it('exposes dedicated bridge and skill MCP tools through the shared bridge runtime service', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const installSourceDir = join(tempDir, 'fixtures', 'installable-bridge');
    await writeScriptFile(installSourceDir, 'echo.js', [
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2) }));",
      '',
    ].join('\n'));
    await writeBridgeDefinition(installSourceDir, {
      schemaVersion: 1,
      bridgeId: 'installed-bridge',
      name: 'Installed Bridge',
      version: '0.1.0',
      description: 'Installable bridge bundle.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
    }, 'bridge.json');
    await writeScriptFile(tempDir, join('.automatosx', 'bridges', 'runtime', 'echo.js'), [
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2) }));",
      '',
    ].join('\n'));
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'runtime-bridge',
      name: 'Runtime Bridge',
      version: '0.1.0',
      description: 'Run a local runtime bridge.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
    }, join('.automatosx', 'bridges', 'runtime', 'bridge.json'));
    await writeSkillSource(tempDir, [
      '---',
      'name: Runtime Skill',
      'command-dispatch: tool',
      'linked-bridge-id: runtime-bridge',
      'tags: [bridge, runtime]',
      '---',
      '# Runtime Skill',
      '',
      'Invoke the runtime bridge.',
      '',
    ].join('\n'), join('.automatosx', 'skills', 'runtime-skill', 'SKILL.md'));

    const runtimeService = createSharedRuntimeService({ basePath: tempDir });
    const surface = createMcpServerSurface({ basePath: tempDir, runtimeService });
    const installed = await surface.invokeTool('bridge_install', {
      sourcePath: installSourceDir,
    });
    const listed = await surface.invokeTool('bridge_list');
    const inspected = await surface.invokeTool('bridge_inspect', { reference: 'runtime-bridge' });
    const executed = await surface.invokeTool('bridge_run', {
      reference: 'runtime-bridge',
      args: ['hello'],
    });
    const skills = await surface.invokeTool('skill_list');
    const resolved = await surface.invokeTool('skill_resolve', {
      query: 'runtime bridge',
    });
    const skillRun = await surface.invokeTool('skill_run', {
      reference: 'runtime-skill',
      args: ['hello'],
    });

    expect(installed.success).toBe(true);
    expect(installed.data).toMatchObject({
      definition: expect.objectContaining({
        bridgeId: 'installed-bridge',
        provenance: expect.objectContaining({
          importer: 'ax.bridge.install',
        }),
      }),
    });
    expect(listed.success).toBe(true);
    expect(listed.data).toMatchObject({
      total: 2,
      bridges: expect.arrayContaining([
        expect.objectContaining({
          success: true,
          definition: expect.objectContaining({
            bridgeId: 'installed-bridge',
          }),
        }),
        expect.objectContaining({
          success: true,
          definition: expect.objectContaining({
            bridgeId: 'runtime-bridge',
          }),
        }),
      ]),
    });
    expect(inspected.success).toBe(true);
    expect(inspected.data).toMatchObject({
      definition: expect.objectContaining({
        bridgeId: 'runtime-bridge',
      }),
    });
    expect(executed.success).toBe(true);
    expect(executed.data).toMatchObject({
      execution: expect.objectContaining({
        exitCode: 0,
        stdout: expect.stringContaining('"args":["hello"]'),
      }),
    });
    expect(skills.success).toBe(true);
    expect(skills.data).toMatchObject({
      total: 1,
    });
    expect(resolved.success).toBe(true);
    expect(resolved.data).toMatchObject({
      query: 'runtime bridge',
      matches: [
        expect.objectContaining({
          definition: expect.objectContaining({
            skillId: 'runtime-skill',
          }),
        }),
      ],
    });
    expect(skillRun.success).toBe(true);
    expect(skillRun.data).toMatchObject({
      skillId: 'runtime-skill',
      dispatch: 'bridge',
      execution: expect.objectContaining({
        exitCode: 0,
        stdout: expect.stringContaining('"args":["hello"]'),
      }),
    });
  });

  it('rejects denied bridge installs in MCP strict mode without writing the installed bridge', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const installSourceDir = join(tempDir, 'fixtures', 'remote-install-bridge');
    await writeScriptFile(installSourceDir, 'echo.js', [
      "process.stdout.write('ok\\n');",
      '',
    ].join('\n'));
    await writeBridgeDefinition(installSourceDir, {
      schemaVersion: 1,
      bridgeId: 'mcp-remote-install-bridge',
      name: 'MCP Remote Install Bridge',
      version: '0.1.0',
      description: 'Strict MCP install should reject denied trust.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/mcp-remote-install-bridge',
      },
    }, 'bridge.json');

    const surface = createMcpServerSurface({ basePath: tempDir });
    const result = await surface.invokeTool('bridge_install', {
      sourcePath: installSourceDir,
      requireTrusted: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Bridge install denied: mcp-remote-install-bridge');
    await expect(rm(join(tempDir, '.automatosx', 'bridges', 'mcp-remote-install-bridge'), { recursive: false })).rejects.toThrow();
  });

  it('returns governance aggregates through a dedicated MCP tool', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const skillSourcePath = join(tempDir, 'fixtures', 'guarded-import', 'SKILL.md');
    mkdirSync(dirname(skillSourcePath), { recursive: true });
    await writeFile(skillSourcePath, [
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

    const runtimeService = createSharedRuntimeService({ basePath: tempDir });
    await runtimeService.getStores().traceStore.upsertTrace({
      traceId: 'mcp-governance-trace-001',
      workflowId: 'workflow-skill-trust',
      surface: 'mcp',
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

    const bridgeService = createRuntimeBridgeService({ basePath: tempDir });
    await bridgeService.importSkillDocument(skillSourcePath);

    const surface = createMcpServerSurface({ basePath: tempDir, runtimeService });
    const result = await surface.invokeTool('governance_get', { limit: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'mcp-governance-trace-001',
        toolName: 'skill.run',
        trustState: 'implicit-local',
      },
      deniedImportedSkills: {
        deniedCount: 1,
        latest: {
          skillId: 'guarded-import-skill',
          trustState: 'denied',
        },
      },
    });
    expect(RuntimeGovernanceAggregateSchema.parse(result.data)).toMatchObject({
      blockedCount: 1,
      deniedImportedSkills: {
        deniedCount: 1,
      },
    });
  });

  it('uses recent failed traces for governance aggregates instead of the generic trace list', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtimeService = createSharedRuntimeService({ basePath: tempDir });
    await runtimeService.getStores().traceStore.upsertTrace({
      traceId: 'mcp-governance-failed-001',
      workflowId: 'workflow-skill-trust',
      surface: 'mcp',
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
    await runtimeService.getStores().traceStore.upsertTrace({
      traceId: 'mcp-governance-success-001',
      workflowId: 'ship',
      surface: 'mcp',
      status: 'completed',
      startedAt: '2026-03-25T00:00:10.000Z',
      completedAt: '2026-03-25T00:00:12.000Z',
      stepResults: [],
      metadata: {},
    });

    const surface = createMcpServerSurface({ basePath: tempDir, runtimeService });
    const result = await surface.invokeTool('governance_get', { limit: 1 });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'mcp-governance-failed-001',
      },
    });
    expect(RuntimeGovernanceAggregateSchema.parse(result.data)).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'mcp-governance-failed-001',
      },
    });
  });

  it('validates task list status filters', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const submitted = await surface.invokeTool('task_submit', {
      taskId: 'task-001',
      type: 'lint',
      payload: { file: 'src/index.ts' },
      priority: 1,
    });
    expect(submitted.success).toBe(true);

    const pending = await surface.invokeTool('task_list', { status: 'pending' });
    expect(pending.success).toBe(true);
    expect((pending.data as { tasks: unknown[] }).tasks).toHaveLength(1);

    const invalid = await surface.invokeTool('task_list', { status: 'bogus' as 'pending' });
    expect(invalid.success).toBe(false);
    expect(typeof invalid.error).toBe('string');
    expect((invalid.error as string)).toMatch(/Invalid status filter|arguments\.status must be one of:/);
  });

  it('forwards provider overrides for research tools on the MCP surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const query = await surface.invokeTool('research_query', {
      query: 'Compare release strategies',
      provider: 'gemini',
    });
    const synthesis = await surface.invokeTool('research_synthesize', {
      topic: 'Release strategies',
      provider: 'grok',
      sources: [
        { content: 'Blue-green reduces downtime.' },
        { content: 'Canary lowers initial blast radius.' },
      ],
    });

    expect(query.success).toBe(true);
    expect(query.data).toMatchObject({
      query: 'Compare release strategies',
      provider: 'gemini',
    });
    expect(synthesis.success).toBe(true);
    expect(synthesis.data).toMatchObject({
      topic: 'Release strategies',
      provider: 'grok',
      sourceCount: 2,
    });
  });

  it('exposes quick and recursive discussion tools on the shared runtime surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const quick = await surface.invokeTool('discuss_quick', {
      topic: 'Summarize rollout strategy',
      traceId: 'mcp-discuss-quick-001',
      providers: ['claude', 'gemini'],
    });
    const recursive = await surface.invokeTool('discuss_recursive', {
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
    expect((quick.data as { rounds?: unknown[] }).rounds).toHaveLength(1);

    expect(recursive.success).toBe(true);
    expect(recursive.data).toMatchObject({
      traceId: 'mcp-discuss-recursive-001',
      subtopics: ['Assess risk', 'Prepare validation'],
    });
    expect((recursive.data as { children?: unknown[] }).children).toHaveLength(2);
  });

  it('exposes agent registration tools with uniqueness semantics', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const first = await surface.invokeTool('agent_register', {
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['design', 'review'],
    });
    const second = await surface.invokeTool('agent_register', {
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['review', 'design'],
    });
    const capabilities = await surface.invokeTool('agent_capabilities');
    const listed = await surface.invokeTool('agent_list');
    const loaded = await surface.invokeTool('agent_get', { agentId: 'architect' });
    const removed = await surface.invokeTool('agent_remove', { agentId: 'architect' });
    const afterRemoval = await surface.invokeTool('agent_list');

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(capabilities.data).toEqual(expect.arrayContaining(['design', 'review', 'qa', 'release']));
    expect(listed.success).toBe(true);
    expect(loaded.data).toMatchObject({
      agentId: 'architect',
      name: 'Architect',
      capabilities: expect.arrayContaining(['design', 'review', 'architecture', 'planning']),
    });
    expect(removed.data).toMatchObject({ removed: true });
    expect(afterRemoval.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agentId: 'architect',
        registrationKey: 'stable-catalog:architect',
      }),
    ]));
    expect(listed.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agentId: 'architect',
      }),
    ]));
  });

  it('exposes built-in stable agents over MCP before setup seeds runtime state', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const listed = await surface.invokeTool('agent_list');
    const loaded = await surface.invokeTool('agent_get', { agentId: 'architect' });
    const capabilities = await surface.invokeTool('agent_capabilities');
    const recommended = await surface.invokeTool('agent_recommend', {
      task: 'Need architecture planning for rollout',
      requiredCapabilities: ['architecture'],
      limit: 1,
    });
    const executed = await surface.invokeTool('agent_run', {
      agentId: 'architect',
      task: 'Design the rollout plan',
      traceId: 'mcp-agent-built-in-001',
    });

    expect(listed.success).toBe(true);
    expect(listed.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        agentId: 'architect',
        registrationKey: 'stable-catalog:architect',
      }),
      expect.objectContaining({
        agentId: 'quality',
      }),
    ]));
    expect(loaded.data).toMatchObject({
      agentId: 'architect',
      registrationKey: 'stable-catalog:architect',
      metadata: expect.objectContaining({
        recommendedCommands: expect.arrayContaining(['ax architect']),
      }),
    });
    expect(capabilities.data).toEqual(expect.arrayContaining(['architecture', 'planning', 'qa']));
    expect(recommended.data).toMatchObject([
      {
        agentId: 'architect',
      },
    ]);
    expect(executed.success).toBe(true);
    expect(executed.data).toMatchObject({
      traceId: 'mcp-agent-built-in-001',
      agentId: 'architect',
      success: false,
      error: {
        code: 'AGENT_NOT_FOUND',
      },
      warnings: expect.arrayContaining([
        expect.stringContaining('stable catalog'),
        expect.stringContaining('ax architect'),
      ]),
    });
  });

  it('exposes agent execution and recommendation tools', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    await surface.invokeTool('agent_register', {
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['architecture', 'planning'],
      metadata: {
        team: 'platform',
      },
    });
    await surface.invokeTool('agent_register', {
      agentId: 'qa',
      name: 'QA',
      capabilities: ['testing', 'regression'],
      metadata: {
        team: 'quality',
      },
    });

    const recommended = await surface.invokeTool('agent_recommend', {
      task: 'Need architecture planning for a rollout',
      requiredCapabilities: ['architecture'],
    });
    const executed = await surface.invokeTool('agent_run', {
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

    const trace = await surface.invokeTool('trace_get', {
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

  it('forwards agent.run basePath to the shared runtime provider bridge', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await writeFile(join(tempDir, 'workspace-agent-provider.mjs'), [
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
      "    content: `WORKSPACE-AGENT:${provider}:${payload.prompt || ''}`",
      "  }));",
      "});",
    ].join('\n'), 'utf8');
    mkdirSync(join(tempDir, '.automatosx'), { recursive: true });
    await writeFile(join(tempDir, '.automatosx', 'config.json'), `${JSON.stringify({
      providers: {
        executors: {
          claude: {
            command: 'node',
            args: [join(tempDir, 'workspace-agent-provider.mjs')],
          },
        },
      },
    }, null, 2)}\n`, 'utf8');

    const surface = createMcpServerSurface({ basePath: join(MCP_SERVER_PACKAGE_ROOT, 'tmp', 'unrelated-mcp-root') });
    await surface.invokeTool('agent_register', {
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['architecture'],
    });

    const executed = await surface.invokeTool('agent_run', {
      agentId: 'architect',
      task: 'Design rollout plan',
      traceId: 'mcp-agent-workspace-001',
      basePath: tempDir,
    });

    expect(executed.success).toBe(true);
    expect(executed.data).toMatchObject({
      traceId: 'mcp-agent-workspace-001',
      executionMode: 'subprocess',
      content: expect.stringContaining('WORKSPACE-AGENT:claude:'),
    });
  });

  it('exposes semantic storage and search tools', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    await surface.invokeTool('semantic_store', {
      namespace: 'agents',
      key: 'architect-rollout',
      content: 'Architecture rollout planning and system design guidance',
      tags: ['architecture', 'planning'],
    });
    await surface.invokeTool('semantic_store', {
      namespace: 'agents',
      key: 'qa-regression',
      content: 'Regression testing checklist for checkout flow',
      tags: ['qa', 'testing'],
    });

    const search = await surface.invokeTool('semantic_search', {
      query: 'architecture planning',
      namespace: 'agents',
      topK: 1,
    });
    const stats = await surface.invokeTool('semantic_stats', {
      namespace: 'agents',
    });
    const cleared = await surface.invokeTool('semantic_clear', {
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
    await surface.invokeTool('agent_register', {
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['architecture', 'planning'],
    });
    await surface.invokeTool('agent_register', {
      agentId: 'qa',
      name: 'QA',
      capabilities: ['testing', 'regression'],
    });

    const plan = await surface.invokeTool('parallel_plan', {
      tasks: [
        { taskId: 'design', agentId: 'architect', task: 'Design rollout', priority: 2 },
        { taskId: 'verify', agentId: 'qa', task: 'Verify rollout', dependencies: ['design'] },
      ],
    });
    const run = await surface.invokeTool('parallel_run', {
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

  it('rejects empty parallel task ids before runtime execution', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const result = await surface.invokeTool('parallel_plan', {
      tasks: [
        { taskId: '', agentId: 'architect', task: 'Design rollout' },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('tasks[0].taskId is invalid');
  });

  it('accepts legacy ax_ tool aliases for backward compatibility', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const listed = await surface.invokeTool('ax_agent_list');
    const workflow = await surface.invokeTool('ax_workflow_run', {
      workflowId: 'architect',
      workflowDir: SHARED_RUNTIME_BUNDLED_WORKFLOW_DIR,
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
    expect(tools.some((tool) => tool.name === 'workflow_run')).toBe(true);
  });

  it('exposes session lifecycle tools on the same shared runtime state', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const surface = createMcpServerSurface({ basePath: tempDir });
    const created = await surface.invokeTool('session_create', {
      sessionId: 'mcp-session-001',
      task: 'Coordinate rollout',
      initiator: 'architect',
      workspace: '/repo',
    });
    const joined = await surface.invokeTool('session_join', {
      sessionId: 'mcp-session-001',
      agentId: 'qa',
      role: 'collaborator',
    });
    const completed = await surface.invokeTool('session_complete', {
      sessionId: 'mcp-session-001',
      summary: 'Rollout coordinated',
    });
    const listed = await surface.invokeTool('session_list');

    expect(created.success).toBe(true);
    expect(joined.success).toBe(true);
    expect(completed.success).toBe(true);
    expect(listed.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sessionId: 'mcp-session-001',
        status: 'completed',
      }),
    ]));
  });

  it('exposes typed tool schemas, resources and prompts via the surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    await initCommand([], defaultOptions({ outputDir: tempDir }));

    const surface = createMcpServerSurface({ basePath: tempDir });

    const tools = surface.listToolDefinitions();
    const workflowRun = tools.find((tool) => tool.name === 'workflow_run');
    expect(workflowRun).toBeDefined();
    expect(workflowRun!.inputSchema.required).toContain('workflowId');
    expect((workflowRun!.inputSchema.properties as any).workflowId.type).toBe('string');

    const resources = surface.listResources();
    expect(resources.some((r) => r.uri === 'ax://workspace/config')).toBe(true);
    expect(resources.some((r) => r.uri === 'ax://workflow/catalog')).toBe(true);

    const prompts = surface.listPrompts();
    expect(prompts.some((p) => p.name === 'workflow_run')).toBe(true);
    expect(prompts.some((p) => p.name === 'review_analyze')).toBe(true);
  });

  it('reads resources and prompts via the surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    await initCommand([], defaultOptions({ outputDir: tempDir }));

    const surface = createMcpServerSurface({ basePath: tempDir });

    const resource = await surface.readResource('ax://workspace/config');
    expect(resource.uri).toBe('ax://workspace/config');
    expect(resource.text).toContain('"workflowArtifactDir"');

    const prompt = await surface.getPrompt('workflow_architect', { requirement: 'Design audit trail' });
    expect(prompt.messages[0]?.content.text).toContain('Design audit trail');
    expect(prompt.description).toContain('architect');
  });

  it('keeps the CLI MCP surface runnable as a process after protocol expansion', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    await ensurePackageBuilt('cli');

    const { stdout } = await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'mcp',
      'tools',
      '--output-dir',
      tempDir,
    ], {
      cwd: WORKSPACE_ROOT,
    });

    expect(stdout).toContain('workflow_run');
    expect(stdout).toContain('dashboard_list');
  }, PROCESS_TEST_TIMEOUT_MS);
});

async function initializeGitRepo(tempDir: string): Promise<void> {
  await execFileAsync('git', ['init', '-b', 'main'], { cwd: tempDir });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir });
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir });
  await writeFile(join(tempDir, 'tracked.txt'), 'baseline\n', 'utf8');
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd: tempDir });
  await execFileAsync('git', ['commit', '-m', 'init'], { cwd: tempDir });
}
