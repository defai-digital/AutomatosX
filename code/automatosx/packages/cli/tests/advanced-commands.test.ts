import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import {
  abilityCommand,
  agentCommand,
  callCommand,
  cleanupCommand,
  configCommand,
  guardCommand,
  feedbackCommand,
  historyCommand,
  listCommand,
  mcpCommand,
  policyCommand,
  runCommand,
  sessionCommand,
  setupCommand,
  skillCommand,
  statusCommand,
} from '../src/commands/index.js';
import type { CLIOptions } from '../src/types.js';
import {
  SHARED_RUNTIME_MOCK_PROVIDER,
  createCliTestTempDir,
} from './support/test-paths.js';
import { writeDeniedInstalledBridge } from './support/bridge-fixtures.js';

function createTempDir(): string {
  return createCliTestTempDir('advanced-commands');
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

describe('advanced retained commands', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    delete process.env.AUTOMATOSX_PROVIDER_CLAUDE_CMD;
    delete process.env.AUTOMATOSX_PROVIDER_CLAUDE_ARGS;
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('lists and reads retained agents through the shared runtime store', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));

    const listResult = await agentCommand(['list'], defaultOptions({ outputDir: tempDir }));
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('Available agents');
    expect(listResult.message).toContain('bug-hunter');
    expect(listResult.message).toContain('Owns: architect');

    const getResult = await agentCommand(['get', 'architect'], defaultOptions({ outputDir: tempDir }));
    expect(getResult.success).toBe(true);
    expect(getResult.message).toContain('Agent: architect');
    expect(getResult.message).toContain('Capabilities: adr, architecture, planning');
    expect(getResult.message).toContain('Owns workflows: architect');
    expect(getResult.message).toContain('Recommended commands: ax architect');

    const capabilityResult = await agentCommand(['capabilities'], defaultOptions({ outputDir: tempDir }));
    expect(capabilityResult.success).toBe(true);
    expect(capabilityResult.message).toContain('architecture');
  });

  it('exposes built-in stable agents before setup seeds runtime state', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const listResult = await agentCommand(['list'], defaultOptions({ outputDir: tempDir }));
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('Available agents');
    expect(listResult.message).toContain('architect');
    expect(listResult.message).toContain('release-manager');

    const getResult = await agentCommand(['get', 'architect'], defaultOptions({ outputDir: tempDir }));
    expect(getResult.success).toBe(true);
    expect(getResult.message).toContain('Availability: built-in stable surface');
    expect(getResult.message).toContain('Runtime registration: not seeded');
    expect(getResult.message).toContain('Recommended commands: ax architect');

    const capabilityResult = await agentCommand(['capabilities'], defaultOptions({ outputDir: tempDir }));
    expect(capabilityResult.success).toBe(true);
    expect(capabilityResult.message).toContain('architecture');

    const recommendResult = await agentCommand(['recommend'], defaultOptions({
      outputDir: tempDir,
      task: 'Need architecture planning for rollout',
      limit: 1,
    }));
    expect(recommendResult.success).toBe(true);
    expect(recommendResult.message).toContain('architect');

    const runResult = await agentCommand(['run', 'architect'], defaultOptions({
      outputDir: tempDir,
      task: 'Design a rollout plan',
    }));
    expect(runResult.success).toBe(false);
    expect(runResult.message).toContain('is not registered');
    expect(runResult.message).toContain('direct agent execution requires runtime registration via "ax setup"');
    expect(runResult.message).toContain('Stable workflow commands: ax architect');
  });

  it('enriches legacy agent records with catalog metadata on read', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await agentCommand(['register'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        agentId: 'architect',
        name: 'Architect',
        capabilities: ['planning'],
      }),
    }));

    const listResult = await agentCommand(['list'], defaultOptions({ outputDir: tempDir }));
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('Turns requirements into architecture proposals');
    expect(listResult.message).toContain('Owns: architect');

    const getResult = await agentCommand(['get', 'architect'], defaultOptions({ outputDir: tempDir }));
    expect(getResult.success).toBe(true);
    expect(getResult.message).toContain('Description: Turns requirements into architecture proposals');
    expect(getResult.message).toContain('Owns workflows: architect');
    expect(getResult.message).toContain('Recommended commands: ax architect');
    expect(getResult.message).toContain('Use this when: new system design');
  });

  it('registers agents from JSON input through the shared runtime store', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await agentCommand(['register'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        agentId: 'researcher',
        name: 'Researcher',
        capabilities: ['discovery', 'synthesis'],
      }),
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Agent registered: researcher');

    const getResult = await agentCommand(['get', 'researcher'], defaultOptions({ outputDir: tempDir }));
    expect(getResult.success).toBe(true);
    expect(getResult.message).toContain('Capabilities: discovery, synthesis');

    const removeResult = await agentCommand(['remove', 'researcher'], defaultOptions({ outputDir: tempDir }));
    expect(removeResult.success).toBe(true);
    expect(removeResult.message).toContain('Agent removed: researcher');
  });

  it('runs and recommends agents through the CLI surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await agentCommand(['register'], defaultOptions({
      outputDir: tempDir,
      provider: 'claude',
      input: JSON.stringify({
        agentId: 'architect',
        name: 'Architect',
        capabilities: ['architecture', 'planning'],
      }),
    }));
    await agentCommand(['register'], defaultOptions({
      outputDir: tempDir,
      provider: 'claude',
      input: JSON.stringify({
        agentId: 'qa',
        name: 'QA',
        capabilities: ['testing', 'regression'],
      }),
    }));

    const runResult = await agentCommand(['run', 'architect'], defaultOptions({
      outputDir: tempDir,
      task: 'Design a rollout plan',
      input: JSON.stringify({ target: 'checkout' }),
      traceId: 'cli-agent-run-001',
    }));
    expect(runResult.success).toBe(true);
    expect(runResult.message).toContain('Agent run: architect');
    expect(runResult.message).toContain('Mode: simulated');

    const recommendResult = await agentCommand(['recommend'], defaultOptions({
      outputDir: tempDir,
      task: 'Need architecture planning for rollout',
      limit: 1,
    }));
    expect(recommendResult.success).toBe(true);
    expect(recommendResult.message).toContain('Agent recommendations for: Need architecture planning for rollout');
    expect(recommendResult.message).toContain('architect');
  });

  it('lists abilities and captures feedback through dedicated CLI commands', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const listResult = await abilityCommand(['list'], defaultOptions({
      outputDir: tempDir,
      category: 'review',
    }));
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('code-review');

    const injectResult = await abilityCommand(['inject'], defaultOptions({
      outputDir: tempDir,
      task: 'Review the diff for security issues',
      limit: 2,
    }));
    expect(injectResult.success).toBe(true);
    expect(injectResult.message).toContain('Ability injection for:');

    const submitResult = await feedbackCommand(['submit'], defaultOptions({
      outputDir: tempDir,
      agent: 'architect',
      task: 'Review rollout plan',
      input: JSON.stringify({ rating: 5, outcome: 'accepted' }),
    }));
    expect(submitResult.success).toBe(true);
    expect(submitResult.message).toContain('Feedback submitted:');

    const overviewResult = await feedbackCommand(['overview'], defaultOptions({
      outputDir: tempDir,
    }));
    expect(overviewResult.success).toBe(true);
    expect(overviewResult.message).toContain('Feedback overview');

    const statsResult = await feedbackCommand(['stats', 'architect'], defaultOptions({
      outputDir: tempDir,
    }));
    expect(statsResult.success).toBe(true);
    expect(statsResult.message).toContain('Average rating: 5');
  });

  it('rejects feedback ratings outside the 1-5 range', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const submitResult = await feedbackCommand(['submit'], defaultOptions({
      outputDir: tempDir,
      agent: 'architect',
      task: 'Review rollout plan',
      input: JSON.stringify({ rating: 1000 }),
    }));

    expect(submitResult.success).toBe(false);
    expect(submitResult.message).toContain('Rating must be between 1 and 5.');
  });

  it('rejects stray flags and extra args for strict CLI wrappers', async () => {
    const abilityResult = await abilityCommand(['inject', '--bogus'], defaultOptions());
    expect(abilityResult.success).toBe(false);
    expect(abilityResult.message).toContain('Unknown ability flag: --bogus.');

    const feedbackResult = await feedbackCommand(['history', '--bogus'], defaultOptions());
    expect(feedbackResult.success).toBe(false);
    expect(feedbackResult.message).toContain('Unknown feedback flag: --bogus.');

    const listResult = await listCommand(['--bogus'], defaultOptions());
    expect(listResult.success).toBe(false);
    expect(listResult.message).toContain('Unknown list flag: --bogus.');

    const statusResult = await statusCommand(['--bogus'], defaultOptions());
    expect(statusResult.success).toBe(false);
    expect(statusResult.message).toContain('Unknown status flag: --bogus.');
  });

  it('rejects unknown flags for provider calls', async () => {
    const result = await callCommand([
      '--bogus',
      'value',
      'Summarize release risk',
    ], defaultOptions());

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown call flag: --bogus.');
  });

  it('lists local MCP tools and invokes them through the in-process MCP surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));

    const toolsResult = await mcpCommand(['tools'], defaultOptions({ outputDir: tempDir }));
    expect(toolsResult.success).toBe(true);
    expect(toolsResult.message).toContain('workflow_run');
    expect(toolsResult.message).toContain('agent_list');

    const describeResult = await mcpCommand(['describe', 'workflow_run'], defaultOptions({ outputDir: tempDir }));
    expect(describeResult.success).toBe(true);
    expect(describeResult.message).toContain('MCP tool: workflow_run');
    expect(describeResult.message).toContain('"workflowId"');

    const resourcesResult = await mcpCommand(['resources'], defaultOptions({ outputDir: tempDir }));
    expect(resourcesResult.success).toBe(true);
    expect(resourcesResult.message).toContain('ax://workspace/config');

    const readResult = await mcpCommand(['read', 'ax://workspace/config'], defaultOptions({ outputDir: tempDir }));
    expect(readResult.success).toBe(true);
    expect(readResult.message).toContain('Resource: ax://workspace/config');

    const promptsResult = await mcpCommand(['prompts'], defaultOptions({ outputDir: tempDir }));
    expect(promptsResult.success).toBe(true);
    expect(promptsResult.message).toContain('workflow_run');

    const promptResult = await mcpCommand(['prompt', 'workflow_run'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        workflowId: 'architect',
        goal: 'Design auth system',
      }),
    }));
    expect(promptResult.success).toBe(true);
    expect(promptResult.message).toContain('Prompt: workflow_run');
    expect(promptResult.message).toContain('architect');

    const callResult = await mcpCommand(['call', 'agent_list'], defaultOptions({
      outputDir: tempDir,
    }));
    expect(callResult.success).toBe(true);

    const data = callResult.data as Array<{ agentId: string }>;
    expect(data.some((entry) => entry.agentId === 'architect')).toBe(true);
  });

  it('returns CLI failures for unknown MCP resources and prompts instead of throwing', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));

    const readResult = await mcpCommand(['read', 'ax://missing/resource'], defaultOptions({ outputDir: tempDir }));
    expect(readResult.success).toBe(false);
    expect(readResult.message).toContain('Unknown resource: ax://missing/resource');

    const promptResult = await mcpCommand(['prompt', 'missing.prompt'], defaultOptions({ outputDir: tempDir }));
    expect(promptResult.success).toBe(false);
    expect(promptResult.message).toContain('Unknown prompt: missing.prompt');
  });

  it('exposes MCP surface with tools and invokes agent_list via the surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));

    const { createMcpServerSurface } = await import('@defai.digital/mcp-server');
    const surface = createMcpServerSurface({ basePath: tempDir });

    const tools = surface.listToolDefinitions();
    expect(tools.some((t) => t.name === 'workflow_run')).toBe(true);
    expect(tools.some((t) => t.name === 'agent_list')).toBe(true);

    const result = await surface.invokeTool('agent_list', {});
    expect(result.success).toBe(true);
    const parsed = result.data as Array<{ agentId: string }>;
    expect(parsed.some((entry) => entry.agentId === 'architect')).toBe(true);
  });

  it('uses the current workspace as the default base path for CLI MCP commands', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const originalCwd = process.cwd();

    try {
      process.chdir(tempDir);

      const runResult = await mcpCommand(['call', 'workflow_run'], defaultOptions({
        input: JSON.stringify({
          workflowId: 'architect',
          traceId: 'cli-mcp-cwd-trace-001',
        }),
      }));

      expect(runResult.success).toBe(true);

      const runtime = createSharedRuntimeService({ basePath: tempDir });
      await expect(runtime.getTrace('cli-mcp-cwd-trace-001')).resolves.toMatchObject({
        traceId: 'cli-mcp-cwd-trace-001',
        workflowId: 'architect',
        surface: 'mcp',
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('creates and transitions sessions through the shared runtime state', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const created = await sessionCommand(['create'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        sessionId: 'cli-session-001',
        task: 'Coordinate migration closeout',
        initiator: 'architect',
        workspace: '/repo',
      }),
    }));
    expect(created.success).toBe(true);
    expect(created.message).toContain('cli-session-001');

    const joined = await sessionCommand(['join', 'cli-session-001'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        agentId: 'qa',
        role: 'collaborator',
      }),
    }));
    expect(joined.success).toBe(true);

    const completed = await sessionCommand(['complete', 'cli-session-001'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        summary: 'Migration closeout aligned',
      }),
    }));
    expect(completed.success).toBe(true);

    const listed = await sessionCommand(['list'], defaultOptions({ outputDir: tempDir }));
    expect(listed.success).toBe(true);
    expect(listed.message).toContain('cli-session-001');

    const fetched = await sessionCommand(['get', 'cli-session-001'], defaultOptions({ outputDir: tempDir }));
    expect(fetched.success).toBe(true);
    expect(fetched.message).toContain('Status: completed');
    expect(fetched.message).toContain('qa:collaborator');
  });

  it('preserves an explicit empty summary when completing a session', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await sessionCommand(['create'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        sessionId: 'cli-session-empty-summary',
        task: 'Check summary handling',
        initiator: 'architect',
      }),
    }));

    const completed = await sessionCommand(['complete', 'cli-session-empty-summary'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        summary: '',
      }),
    }));
    expect(completed.success).toBe(true);
    expect((completed.data as { summary?: string }).summary).toBe('');
  });

  it('surfaces workspace config read/write through a dedicated CLI command', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const setResult = await configCommand(['set', 'providers.default', 'gemini'], defaultOptions({ outputDir: tempDir }));
    expect(setResult.success).toBe(true);
    expect(setResult.message).toContain('Updated config path: providers.default');

    const getResult = await configCommand(['get', 'providers.default'], defaultOptions({ outputDir: tempDir }));
    expect(getResult.success).toBe(true);
    expect(getResult.message).toContain('Config value: providers.default');
    expect(getResult.message).toContain('"gemini"');

    const showResult = await configCommand(['show'], defaultOptions({ outputDir: tempDir }));
    expect(showResult.success).toBe(true);
    expect(showResult.message).toContain('"providers"');
  });

  it('rejects malformed JSON when config set uses --input', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await configCommand(['set', 'providers.default'], defaultOptions({
      outputDir: tempDir,
      input: '{"provider"',
    }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid JSON input. Please provide a valid JSON value.');
  });

  it('accepts non-object JSON values when config set uses --input', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const setResult = await configCommand(['set', 'providers.priority'], defaultOptions({
      outputDir: tempDir,
      input: '["claude","gemini"]',
    }));

    expect(setResult.success).toBe(true);

    const getResult = await configCommand(['get', 'providers.priority'], defaultOptions({ outputDir: tempDir }));
    expect(getResult.success).toBe(true);
    expect(getResult.data).toEqual(['claude', 'gemini']);
  });

  it('closes stale sessions and traces through cleanup', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await sessionCommand(['create'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        sessionId: 'stuck-session-001',
        task: 'Hung task',
        initiator: 'architect',
      }),
    }));

    const { createSharedRuntimeService } = await import('@defai.digital/shared-runtime');
    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'stuck-trace-001',
      workflowId: 'ship',
      surface: 'cli',
      status: 'running',
      startedAt: '2026-03-20T00:00:00.000Z',
      stepResults: [],
    });

    const result = await cleanupCommand(['stuck', '0'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Closed sessions: 1');
    expect(result.message).toContain('Closed traces: 1');
    expect(result.message).toContain('stuck-session-001');
    expect(result.message).toContain('stuck-trace-001');
  });

  it('lists, applies, and checks trust policies through the canonical CLI command', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const listResult = await policyCommand(['list'], defaultOptions({ outputDir: tempDir }));
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('step-validation');
    expect(listResult.message).toContain('safe-filesystem');
    expect(listResult.message).toContain('Trust policies:');

    const applyResult = await policyCommand(['apply', 'step-validation'], defaultOptions({ outputDir: tempDir }));
    expect(applyResult.success).toBe(true);
    expect(applyResult.message).toContain('Trust policy applied: step-validation');

    const checkResult = await policyCommand(['check'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        policyId: 'step-validation',
        stepId: 'broken-tool',
        stepType: 'tool',
        stepConfig: { unexpected: true },
      }),
    }));
    expect(checkResult.success).toBe(true);
    expect(checkResult.message).toContain('Policy check: blocked');
    expect(checkResult.message).toContain('validate-step-config');

    const filesystemCheckResult = await policyCommand(['check'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        policyId: 'safe-filesystem',
        stepId: 'write-files',
        stepType: 'tool',
        stepConfig: {
          changedPaths: ['src/app.ts', '.github/workflows/deploy.yml'],
          allowedPaths: ['src/**'],
          changeRadius: 1,
          content: 'const token = "sk-live-abcdefghijklmnopqrstuvwxyz";',
        },
      }),
    }));
    expect(filesystemCheckResult.success).toBe(true);
    expect(filesystemCheckResult.message).toContain('Policy check: blocked');
    expect(filesystemCheckResult.message).toContain('enforce-allowed-paths');
  });

  it('keeps the legacy guard alias working for compatibility', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const listResult = await guardCommand(['list'], defaultOptions({ outputDir: tempDir }));
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('Trust policies:');
  });

  it('rejects invalid policy input types before writing policy state or building guard context', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const invalidApply = await guardCommand(['apply'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        policyId: 'step-validation',
        enabled: 'false',
      }),
    }));
    expect(invalidApply.success).toBe(false);
    expect(invalidApply.message).toContain('Policy apply input requires "enabled" to be a boolean.');

    const invalidCheck = await guardCommand(['check'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        stepId: 'broken-tool',
        stepType: 'tool',
        stepIndex: -1,
        totalSteps: 0,
      }),
    }));
    expect(invalidCheck.success).toBe(false);
    expect(invalidCheck.message).toContain('Input requires "stepIndex" to be a non-negative integer.');
  });

  it('calls a provider directly and reports runtime status through CLI commands', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_PROVIDER_CLAUDE_CMD = 'node';
    process.env.AUTOMATOSX_PROVIDER_CLAUDE_ARGS = JSON.stringify([
      SHARED_RUNTIME_MOCK_PROVIDER,
    ]);

    const callResult = await callCommand([
      '--system',
      'Be concise.',
      'Summarize release risk.',
    ], defaultOptions({
      outputDir: tempDir,
      traceId: 'call-trace-001',
      provider: 'claude',
    }));
    expect(callResult.success).toBe(true);
    expect(callResult.message).toContain('Call completed with trace call-trace-001.');
    expect(callResult.message).toContain('REAL:claude:');

    const statusResult = await statusCommand([], defaultOptions({ outputDir: tempDir, limit: 5 }));
    expect(statusResult.success).toBe(true);
    expect(statusResult.message).toContain('AutomatosX Status');
    expect(statusResult.message).toContain('Configured executors:');

    delete process.env.AUTOMATOSX_PROVIDER_CLAUDE_CMD;
    delete process.env.AUTOMATOSX_PROVIDER_CLAUDE_ARGS;
  });

  it('runs autonomous call rounds with intent-aware prompting', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_PROVIDER_CLAUDE_CMD = 'node';
    process.env.AUTOMATOSX_PROVIDER_CLAUDE_ARGS = JSON.stringify([
      SHARED_RUNTIME_MOCK_PROVIDER,
    ]);

    const result = await callCommand([
      '--autonomous',
      '--intent',
      'analysis',
      '--goal',
      'Produce a release recommendation.',
      '--max-rounds',
      '2',
      'Analyze release risk for checkout service.',
    ], defaultOptions({
      outputDir: tempDir,
      traceId: 'auto-call-001',
      provider: 'claude',
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Autonomous call completed with 2 rounds.');
    expect(result.message).toContain('Intent: analysis');
    expect(result.message).toContain('auto-call-001-r1');
    expect(result.message).toContain('auto-call-001-r2');
    expect(result.message).toContain('REAL:claude:');
  });

  it('surfaces runtime guard summaries in status and history views', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'guard-history-001',
      workflowId: 'workflow-skill-trust',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-24T12:00:00.000Z',
      completedAt: '2026-03-24T12:00:02.000Z',
      stepResults: [{
        stepId: 'run-skill',
        success: false,
        durationMs: 120,
        retryCount: 0,
        error: 'Step blocked by runtime governance.',
      }],
      error: {
        code: 'WORKFLOW_GUARD_BLOCKED',
        message: 'Step run-skill blocked by guard: runtime_trust: trust state mismatch',
        failedStepId: 'run-skill',
      },
      metadata: {
        guardSummary: 'Runtime governance blocked step "run-skill". Trust state: implicit-local. Required trust states: trusted-id.',
        guardId: 'enforce-runtime-trust',
        guardFailedGates: ['runtime_trust'],
        guardToolName: 'skill.run',
        guardTrustState: 'implicit-local',
        guardRequiredTrustStates: ['trusted-id'],
      },
    });

    const statusResult = await statusCommand([], defaultOptions({ outputDir: tempDir, limit: 5 }));
    expect(statusResult.success).toBe(true);
    expect(statusResult.message).toContain('Recent failed traces:');
    expect(statusResult.message).toContain('policy: Runtime governance blocked step "run-skill"');

    const historyResult = await historyCommand([], defaultOptions({
      outputDir: tempDir,
      limit: 5,
      status: 'failed',
    }));
    expect(historyResult.success).toBe(true);
    expect(historyResult.message).toContain('Run History:');
    expect(historyResult.message).toContain('policy: Runtime governance blocked step "run-skill"');

    const verboseHistory = await historyCommand([], defaultOptions({
      outputDir: tempDir,
      limit: 5,
      status: 'failed',
      verbose: true,
    }));
    expect(verboseHistory.success).toBe(true);
    expect(verboseHistory.message).toContain('Policy:   Runtime governance blocked step "run-skill"');
  });

  it('surfaces denied imported skills in status views', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    await mkdir(join(tempDir, 'fixtures', 'guarded-import'), { recursive: true });
    await writeFile(join(tempDir, 'fixtures', 'guarded-import', 'SKILL.md'), [
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

    const importResult = await skillCommand(
      ['import', join(tempDir, 'fixtures', 'guarded-import', 'SKILL.md')],
      defaultOptions({ outputDir: tempDir }),
    );
    expect(importResult.success).toBe(true);

    const statusResult = await statusCommand([], defaultOptions({ outputDir: tempDir, limit: 5 }));
    expect(statusResult.success).toBe(true);
    expect(statusResult.message).toContain('Denied imported skills:');
    expect(statusResult.message).toContain('guarded-import-skill denied');
    expect(statusResult.message).toContain('requires explicit trust');
    expect(statusResult.data).toMatchObject({
      governance: {
        deniedImportedSkills: {
          deniedCount: 1,
          latest: {
            skillId: 'guarded-import-skill',
            trustState: 'denied',
          },
        },
      },
    });
  });

  it('surfaces denied installed bridges in status views', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    await writeDeniedInstalledBridge(tempDir, {
      bridgeId: 'guarded-installed-bridge',
    });

    const statusResult = await statusCommand([], defaultOptions({ outputDir: tempDir, limit: 5 }));
    expect(statusResult.success).toBe(true);
    expect(statusResult.message).toContain('Denied installed bridges:');
    expect(statusResult.message).toContain('guarded-installed-bridge denied');
    expect(statusResult.message).toContain('requires explicit trust');
    expect(statusResult.data).toMatchObject({
      deniedInstalledBridges: {
        deniedCount: 1,
        latest: {
          bridgeId: 'guarded-installed-bridge',
          trustState: 'denied',
        },
      },
    });
  });

  it('surfaces runtime-governance guard summaries in ax run failures', async () => {
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

    const result = await runCommand(['workflow-skill-trust'], defaultOptions({
      outputDir: tempDir,
      workflowDir: tempDir,
      traceId: 'run-guard-001',
    }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Workflow "workflow-skill-trust" failed');
    expect(result.message).toContain('Policy: Runtime governance blocked step "run-skill"');
    expect(result.message).toContain('Trust state: implicit-local');
    const data = result.data as {
      guard?: {
        blockedByRuntimeGovernance?: boolean;
        trustState?: string;
        toolName?: string;
      };
    };
    expect(data.guard).toMatchObject({
      blockedByRuntimeGovernance: true,
      trustState: 'implicit-local',
      toolName: 'skill.run',
    });
  });
});
