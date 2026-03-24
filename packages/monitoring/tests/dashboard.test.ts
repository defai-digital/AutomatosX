import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCommand } from '../../cli/src/commands/run.js';
import { createDashboardService } from '../src/index.js';
import { createMcpServerSurface } from '../../mcp-server/src/index.js';
import type { CLIOptions } from '../../cli/src/types.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `dashboard-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
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

describe('dashboard service', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('shows CLI and MCP workflow traces from the same shared trace store', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const cliResult = await runCommand(['ship'], defaultOptions({
      workflowDir: join(process.cwd(), 'workflows'),
      outputDir: tempDir,
      traceId: 'cli-trace-001',
      input: JSON.stringify({ prompt: 'ship checkout' }),
    }));

    expect(cliResult.success).toBe(true);

    const mcp = createMcpServerSurface({ basePath: tempDir });
    const mcpResult = await mcp.invokeTool('workflow.run', {
      workflowId: 'release',
      workflowDir: join(process.cwd(), 'workflows'),
      traceId: 'mcp-trace-001',
      input: { prompt: 'release 14.0.0' },
    });

    expect(mcpResult.success).toBe(true);

    const dashboard = createDashboardService({ basePath: tempDir });
    const entries = await dashboard.listWorkflowExecutions();

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          traceId: 'cli-trace-001',
          workflowId: 'ship',
          surface: 'cli',
        }),
        expect.objectContaining({
          traceId: 'mcp-trace-001',
          workflowId: 'release',
          surface: 'mcp',
        }),
      ]),
    );

    const cliTrace = await dashboard.getWorkflowExecution('cli-trace-001');
    expect(cliTrace).toMatchObject({
      traceId: 'cli-trace-001',
      workflowId: 'ship',
      status: 'completed',
    });
  });
});
