import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  agentCommand,
  callCommand,
  cleanupCommand,
  configCommand,
  guardCommand,
  mcpCommand,
  sessionCommand,
  setupCommand,
  statusCommand,
} from '../src/commands/index.js';
import type { CLIOptions } from '../src/types.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `advanced-commands-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
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
    expect(listResult.message).toContain('Registered agents');
    expect(listResult.message).toContain('bug-hunter');

    const getResult = await agentCommand(['get', 'architect'], defaultOptions({ outputDir: tempDir }));
    expect(getResult.success).toBe(true);
    expect(getResult.message).toContain('Agent: architect');
    expect(getResult.message).toContain('Capabilities: adr, architecture, planning');

    const capabilityResult = await agentCommand(['capabilities'], defaultOptions({ outputDir: tempDir }));
    expect(capabilityResult.success).toBe(true);
    expect(capabilityResult.message).toContain('architecture');
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

  it('lists local MCP tools and invokes them through the in-process MCP surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));

    const toolsResult = await mcpCommand(['tools'], defaultOptions({ outputDir: tempDir }));
    expect(toolsResult.success).toBe(true);
    expect(toolsResult.message).toContain('workflow.run');
    expect(toolsResult.message).toContain('agent.list');

    const describeResult = await mcpCommand(['describe', 'workflow.run'], defaultOptions({ outputDir: tempDir }));
    expect(describeResult.success).toBe(true);
    expect(describeResult.message).toContain('MCP tool: workflow.run');
    expect(describeResult.message).toContain('"workflowId"');

    const resourcesResult = await mcpCommand(['resources'], defaultOptions({ outputDir: tempDir }));
    expect(resourcesResult.success).toBe(true);
    expect(resourcesResult.message).toContain('ax://workspace/config');

    const readResult = await mcpCommand(['read', 'ax://workspace/config'], defaultOptions({ outputDir: tempDir }));
    expect(readResult.success).toBe(true);
    expect(readResult.message).toContain('Resource: ax://workspace/config');

    const promptsResult = await mcpCommand(['prompts'], defaultOptions({ outputDir: tempDir }));
    expect(promptsResult.success).toBe(true);
    expect(promptsResult.message).toContain('workflow.run');

    const promptResult = await mcpCommand(['prompt', 'workflow.run'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        workflowId: 'architect',
        goal: 'Design auth system',
      }),
    }));
    expect(promptResult.success).toBe(true);
    expect(promptResult.message).toContain('Prompt: workflow.run');
    expect(promptResult.message).toContain('architect');

    const callResult = await mcpCommand(['call', 'agent.list'], defaultOptions({
      outputDir: tempDir,
    }));
    expect(callResult.success).toBe(true);

    const data = callResult.data as Array<{ agentId: string }>;
    expect(data.some((entry) => entry.agentId === 'architect')).toBe(true);
  });

  it('serves MCP JSON-RPC over stdio and handles initialize + tools/list + tools/call', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await setupCommand([], defaultOptions({ outputDir: tempDir }));

    const { createMcpStdioServer } = await import('@defai.digital/mcp-server');
    const { Readable, Writable } = await import('node:stream');

    const outputChunks: string[] = [];
    const output = new Writable({
      write(chunk: Buffer, _enc, cb) {
        outputChunks.push(chunk.toString());
        cb();
      },
    });

    const requests = [
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', clientInfo: { name: 'test' } } }),
      JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'agent.list', arguments: {} } }),
    ].join('\n') + '\n';

    const input = Readable.from([requests]);
    const server = createMcpStdioServer({ basePath: tempDir, input, output });
    await server.serve();

    const responses = outputChunks.join('').trim().split('\n').map((line) => JSON.parse(line) as { id: number; result?: unknown; error?: unknown });

    const initResp = responses.find((r) => r.id === 1);
    expect(initResp?.error).toBeUndefined();
    expect((initResp?.result as { serverInfo?: { name?: string } })?.serverInfo?.name).toBe('automatosx');

    const listResp = responses.find((r) => r.id === 2);
    const listTools = (listResp?.result as { tools?: Array<{ name: string }> })?.tools ?? [];
    expect(listTools.some((t) => t.name === 'workflow.run')).toBe(true);
    expect(listTools.some((t) => t.name === 'agent.list')).toBe(true);

    const callResp = responses.find((r) => r.id === 3);
    const callContent = (callResp?.result as { content?: Array<{ text: string }> })?.content ?? [];
    const parsed = JSON.parse(callContent[0]?.text ?? '[]') as Array<{ agentId: string }>;
    expect(parsed.some((entry) => entry.agentId === 'architect')).toBe(true);
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

  it('lists, applies, and checks guard policies through the CLI command', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const listResult = await guardCommand(['list'], defaultOptions({ outputDir: tempDir }));
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('step-validation');
    expect(listResult.message).toContain('safe-filesystem');

    const applyResult = await guardCommand(['apply', 'step-validation'], defaultOptions({ outputDir: tempDir }));
    expect(applyResult.success).toBe(true);
    expect(applyResult.message).toContain('Guard policy applied: step-validation');

    const checkResult = await guardCommand(['check'], defaultOptions({
      outputDir: tempDir,
      input: JSON.stringify({
        policyId: 'step-validation',
        stepId: 'broken-tool',
        stepType: 'tool',
        stepConfig: { unexpected: true },
      }),
    }));
    expect(checkResult.success).toBe(true);
    expect(checkResult.message).toContain('Guard check: blocked');
    expect(checkResult.message).toContain('validate-step-config');

    const filesystemCheckResult = await guardCommand(['check'], defaultOptions({
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
    expect(filesystemCheckResult.message).toContain('Guard check: blocked');
    expect(filesystemCheckResult.message).toContain('enforce-allowed-paths');
  });

  it('calls a provider directly and reports runtime status through CLI commands', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_PROVIDER_CLAUDE_CMD = 'node';
    process.env.AUTOMATOSX_PROVIDER_CLAUDE_ARGS = JSON.stringify([
      join(process.cwd(), 'packages/shared-runtime/tests/mock-provider.mjs'),
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
      join(process.cwd(), 'packages/shared-runtime/tests/mock-provider.mjs'),
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
});
