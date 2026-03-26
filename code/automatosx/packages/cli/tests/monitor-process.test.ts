import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { MCP_BASE_PATH_ENV_VAR } from '@defai.digital/mcp-server';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { createMcpServerSurface } from '@defai.digital/mcp-server';
import { buildWorkspacePackage } from '../../../tools/workspace-build.js';
import {
  CLI_ENTRY_PATH,
  CLI_PACKAGE_ROOT,
  CLI_WORKFLOW_DIR,
  createCliTestTempDir,
} from './support/test-paths.js';

const PROCESS_TEST_TIMEOUT_MS = 30_000;
const execFileAsync = promisify(execFile);

function createTempDir(): string {
  return createCliTestTempDir('monitor-process');
}

async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to acquire an available port.')));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function canListenOnLocalhost(): Promise<boolean> {
  try {
    await findAvailablePort();
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('EPERM')) {
      return false;
    }
    throw error;
  }
}

async function waitForServerReady(
  child: ReturnType<typeof spawn>,
  port: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let output = '';

  const onStdout = (chunk: Buffer | string): void => {
    output += chunk.toString();
  };
  const onStderr = (chunk: Buffer | string): void => {
    output += chunk.toString();
  };

  child.stdout?.on('data', onStdout);
  child.stderr?.on('data', onStderr);

  try {
    while (Date.now() < deadline) {
      if (output.includes(`http://localhost:${String(port)}`)) {
        return;
      }
      if (child.exitCode !== null) {
        throw new Error(`Monitor exited early.\n${output}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } finally {
    child.stdout?.off('data', onStdout);
    child.stderr?.off('data', onStderr);
  }

  throw new Error(`Timed out waiting for monitor startup.\n${output}`);
}

async function shutdownChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, 2_000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    child.kill('SIGTERM');
  });
}

describe('monitor process', () => {
  const tempDirs: string[] = [];
  const children: Array<ReturnType<typeof spawn>> = [];

  afterEach(async () => {
    await Promise.all(children.splice(0).map((child) => shutdownChild(child)));
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('serves the live dashboard and compatibility api endpoints over localhost', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await buildWorkspacePackage('cli');

    // Some CI and sandboxed runners disallow local socket binding entirely.
    if (!(await canListenOnLocalhost())) {
      return;
    }

    const port = await findAvailablePort();
    const child = spawn('node', [
      CLI_ENTRY_PATH,
      'monitor',
      '--no-open',
      '--port',
      String(port),
      '--output-dir',
      tempDir,
      '--workflow-dir',
      CLI_WORKFLOW_DIR,
    ], {
      cwd: CLI_PACKAGE_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);

    await waitForServerReady(child, port, 10_000);

    const [htmlResponse, healthResponse, stateResponse, statusResponse, providersResponse, governanceResponse, workflowsResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${String(port)}/`),
      fetch(`http://127.0.0.1:${String(port)}/api/health`),
      fetch(`http://127.0.0.1:${String(port)}/api/state`),
      fetch(`http://127.0.0.1:${String(port)}/api/status`),
      fetch(`http://127.0.0.1:${String(port)}/api/providers`),
      fetch(`http://127.0.0.1:${String(port)}/api/governance`),
      fetch(`http://127.0.0.1:${String(port)}/api/workflows`),
    ]);

    expect(htmlResponse.status).toBe(200);
    const html = await htmlResponse.text();
    expect(html).toContain('AutomatosX Monitor');
    expect(html).toContain('Overview');
    expect(html).toContain("fetch('/api/state'");

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      success: true,
      data: { status: 'ok' },
    });

    expect(statusResponse.status).toBe(200);
    await expect(statusResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        runtime: expect.any(Object),
        sessions: expect.any(Object),
        traces: expect.any(Object),
      },
    });

    expect(providersResponse.status).toBe(200);
    await expect(providersResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        source: expect.stringMatching(/cached|unavailable/),
      },
    });

    expect(governanceResponse.status).toBe(200);
    await expect(governanceResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        blockedCount: expect.any(Number),
        deniedImportedSkills: expect.any(Object),
      },
    });

    expect(workflowsResponse.status).toBe(200);
    await expect(workflowsResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ workflowId: 'architect' }),
      ]),
    });

    expect(stateResponse.status).toBe(200);
    await expect(stateResponse.json()).resolves.toMatchObject({
      status: expect.any(Object),
      governance: expect.any(Object),
      providers: expect.any(Object),
      sessions: expect.any(Array),
      agents: expect.any(Array),
      traces: expect.any(Array),
      workflows: expect.any(Array),
    });
  }, PROCESS_TEST_TIMEOUT_MS);

  it('loads workflows and provider snapshots from the current workspace when no output-dir is passed', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await buildWorkspacePackage('cli');

    if (!(await canListenOnLocalhost())) {
      return;
    }

    mkdirSync(join(tempDir, 'workflows'), { recursive: true });
    mkdirSync(join(tempDir, '.automatosx'), { recursive: true });
    await writeFile(
      join(tempDir, 'workflows', 'audit.json'),
      `${JSON.stringify({
        workflowId: 'audit',
        name: 'Audit Workflow',
        version: '1.0.0',
        steps: [
          {
            stepId: 'inspect-scope',
            type: 'prompt',
            config: {
              prompt: 'Inspect audit scope.',
            },
          },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      join(tempDir, '.automatosx', 'environment.json'),
      `${JSON.stringify({
        generatedAt: '2026-03-25T00:00:00.000Z',
        providers: [
          { providerId: 'claude', installed: true },
        ],
      }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      join(tempDir, '.automatosx', 'providers.json'),
      `${JSON.stringify({
        providers: [
          { providerId: 'claude', enabled: true, installed: true },
        ],
      }, null, 2)}\n`,
      'utf8',
    );

    const port = await findAvailablePort();
    const child = spawn('node', [
      CLI_ENTRY_PATH,
      'monitor',
      '--no-open',
      '--port',
      String(port),
    ], {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);

    await waitForServerReady(child, port, 10_000);

    const [workflowsResponse, providersResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${String(port)}/api/workflows`),
      fetch(`http://127.0.0.1:${String(port)}/api/providers`),
    ]);

    expect(workflowsResponse.status).toBe(200);
    await expect(workflowsResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({ workflowId: 'audit' }),
      ]),
    });

    expect(providersResponse.status).toBe(200);
    await expect(providersResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        source: 'cached',
        enabledProviders: ['claude'],
        detectedProviders: ['claude'],
      },
    });
  }, PROCESS_TEST_TIMEOUT_MS);

  it('falls back to bundled workflow metadata when the workspace has no local workflow directory', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await buildWorkspacePackage('cli');

    if (!(await canListenOnLocalhost())) {
      return;
    }

    const port = await findAvailablePort();
    const child = spawn('node', [
      CLI_ENTRY_PATH,
      'monitor',
      '--no-open',
      '--port',
      String(port),
    ], {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);

    await waitForServerReady(child, port, 10_000);

    const [agentsResponse, agentDetailResponse, workflowsResponse, workflowDetailResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${String(port)}/api/agents`),
      fetch(`http://127.0.0.1:${String(port)}/api/agents/architect`),
      fetch(`http://127.0.0.1:${String(port)}/api/workflows`),
      fetch(`http://127.0.0.1:${String(port)}/api/workflows/architect`),
    ]);

    expect(agentsResponse.status).toBe(200);
    await expect(agentsResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          agentId: 'architect',
          registrationKey: 'stable-catalog:architect',
          metadata: expect.objectContaining({
            description: expect.stringContaining('architecture proposals'),
            ownedWorkflows: expect.arrayContaining(['architect']),
          }),
        }),
      ]),
    });

    expect(agentDetailResponse.status).toBe(200);
    await expect(agentDetailResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({
        agentId: 'architect',
        registrationKey: 'stable-catalog:architect',
        capabilities: expect.arrayContaining(['architecture', 'planning']),
        metadata: expect.objectContaining({
          recommendedCommands: expect.arrayContaining(['ax architect']),
        }),
      }),
    });

    expect(workflowsResponse.status).toBe(200);
    await expect(workflowsResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          workflowId: 'architect',
          agentId: 'architect',
          description: expect.stringContaining('implementation-ready architecture proposal'),
        }),
      ]),
    });

    expect(workflowDetailResponse.status).toBe(200);
    await expect(workflowDetailResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        workflow: expect.objectContaining({
          workflowId: 'architect',
          agentId: 'architect',
          artifactNames: expect.arrayContaining(['ADR draft']),
          requiredInputs: expect.arrayContaining(['request', 'input']),
        }),
      },
    });
  }, PROCESS_TEST_TIMEOUT_MS);

  it('enriches thin registered agents with stable catalog metadata in monitor detail views', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await buildWorkspacePackage('cli');

    if (!(await canListenOnLocalhost())) {
      return;
    }

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['planning'],
    });

    const port = await findAvailablePort();
    const child = spawn('node', [
      CLI_ENTRY_PATH,
      'monitor',
      '--no-open',
      '--port',
      String(port),
    ], {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);

    await waitForServerReady(child, port, 10_000);

    const agentDetailResponse = await fetch(`http://127.0.0.1:${String(port)}/api/agents/architect`);

    expect(agentDetailResponse.status).toBe(200);
    await expect(agentDetailResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({
        agentId: 'architect',
        capabilities: expect.arrayContaining(['planning', 'architecture']),
        metadata: expect.objectContaining({
          description: expect.stringContaining('architecture proposals'),
          ownedWorkflows: expect.arrayContaining(['architect']),
          recommendedCommands: expect.arrayContaining(['ax architect']),
        }),
      }),
    });
  }, PROCESS_TEST_TIMEOUT_MS);

  it('surfaces auto-created sessions for ordinary session-aware runtime activity', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await buildWorkspacePackage('cli');

    if (!(await canListenOnLocalhost())) {
      return;
    }

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.runDiscussion({
      topic: 'Coordinate rollout review',
      traceId: 'monitor-session-trace-001',
      sessionId: 'monitor-session-001',
      providers: ['claude'],
      rounds: 1,
      surface: 'cli',
    });

    const port = await findAvailablePort();
    const child = spawn('node', [
      CLI_ENTRY_PATH,
      'monitor',
      '--no-open',
      '--port',
      String(port),
    ], {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);

    await waitForServerReady(child, port, 10_000);

    const [sessionsResponse, sessionDetailResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${String(port)}/api/sessions`),
      fetch(`http://127.0.0.1:${String(port)}/api/sessions/monitor-session-001`),
    ]);

    expect(sessionsResponse.status).toBe(200);
    await expect(sessionsResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          sessionId: 'monitor-session-001',
          initiator: 'cli',
          status: 'active',
          task: 'Discuss: Coordinate rollout review',
        }),
      ]),
    });

    expect(sessionDetailResponse.status).toBe(200);
    await expect(sessionDetailResponse.json()).resolves.toMatchObject({
      success: true,
      data: {
        session: expect.objectContaining({
          sessionId: 'monitor-session-001',
          metadata: expect.objectContaining({
            autoCreated: true,
            command: 'discuss',
          }),
        }),
        traces: expect.arrayContaining([
          expect.objectContaining({
            traceId: 'monitor-session-trace-001',
            workflowId: 'discuss',
          }),
        ]),
      },
    });
  }, PROCESS_TEST_TIMEOUT_MS);

  it('shows sessionless MCP workflow runs in monitor with distinct auto-created sessions', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await buildWorkspacePackage('cli');

    if (!(await canListenOnLocalhost())) {
      return;
    }

    const surface = createMcpServerSurface({ basePath: tempDir });
    const firstRunResult = await surface.invokeTool('workflow_run', {
      workflowId: 'architect',
      traceId: 'monitor-mcp-trace-001',
    });
    const secondRunResult = await surface.invokeTool('workflow_run', {
      workflowId: 'architect',
      traceId: 'monitor-mcp-trace-002',
    });
    expect(firstRunResult.success).toBe(true);
    expect(secondRunResult.success).toBe(true);

    const port = await findAvailablePort();
    const child = spawn('node', [
      CLI_ENTRY_PATH,
      'monitor',
      '--no-open',
      '--port',
      String(port),
    ], {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);

    await waitForServerReady(child, port, 10_000);

    const [tracesResponse, sessionsResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${String(port)}/api/traces`),
      fetch(`http://127.0.0.1:${String(port)}/api/sessions`),
    ]);

    expect(tracesResponse.status).toBe(200);
    await expect(tracesResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          traceId: 'monitor-mcp-trace-001',
          workflowId: 'architect',
          surface: 'mcp',
        }),
        expect.objectContaining({
          traceId: 'monitor-mcp-trace-002',
          workflowId: 'architect',
          surface: 'mcp',
        }),
      ]),
    });

    expect(sessionsResponse.status).toBe(200);
    const sessionsBody = await sessionsResponse.json();
    expect(sessionsBody).toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          initiator: 'mcp',
          task: 'Run workflow: architect',
          status: 'completed',
          metadata: expect.objectContaining({
            command: 'workflow.run',
            surface: 'mcp',
          }),
        }),
      ]),
    });
    expect(Array.isArray(sessionsBody.data)).toBe(true);
    expect(new Set(sessionsBody.data.map((session: { sessionId: string }) => session.sessionId)).size).toBeGreaterThanOrEqual(2);
  }, PROCESS_TEST_TIMEOUT_MS);

  it('shows generic MCP tool requests in monitor runs without creating monitor sessions', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await buildWorkspacePackage('cli');

    if (!(await canListenOnLocalhost())) {
      return;
    }

    const surface = createMcpServerSurface({ basePath: tempDir });
    const toolResult = await surface.invokeTool('memory_store', {
      namespace: 'monitor',
      key: 'latest-request',
      value: { status: 'ok' },
    });
    expect(toolResult.success).toBe(true);

    const port = await findAvailablePort();
    const child = spawn('node', [
      CLI_ENTRY_PATH,
      'monitor',
      '--no-open',
      '--port',
      String(port),
    ], {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);

    await waitForServerReady(child, port, 10_000);

    const [tracesResponse, sessionsResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${String(port)}/api/traces`),
      fetch(`http://127.0.0.1:${String(port)}/api/sessions`),
    ]);

    expect(tracesResponse.status).toBe(200);
    await expect(tracesResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          workflowId: 'mcp.tool.memory_store',
          surface: 'mcp',
          metadata: expect.objectContaining({
            command: 'memory_store',
            displayLabel: 'MCP: Memory Store',
            requestKind: 'mcp-tool',
            summary: 'monitor/latest-request',
          }),
        }),
      ]),
    });

    expect(sessionsResponse.status).toBe(200);
    const sessionsBody = await sessionsResponse.json();
    expect(sessionsBody).toMatchObject({
      success: true,
      data: expect.any(Array),
    });
    expect(sessionsBody.data).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        task: 'MCP tool activity',
      }),
    ]));
  }, PROCESS_TEST_TIMEOUT_MS);

  it('shows MCP activity in monitor when ax mcp runs from a different cwd with an explicit workspace base path', async () => {
    const workspaceDir = createTempDir();
    const launcherDir = createTempDir();
    tempDirs.push(workspaceDir, launcherDir);
    await buildWorkspacePackage('cli');

    if (!(await canListenOnLocalhost())) {
      return;
    }

    await execFileAsync('node', [
      CLI_ENTRY_PATH,
      'mcp',
      'call',
      'workflow_run',
      '--input',
      JSON.stringify({
        workflowId: 'architect',
        traceId: 'monitor-mcp-env-trace-001',
      }),
    ], {
      cwd: launcherDir,
      env: {
        ...process.env,
        [MCP_BASE_PATH_ENV_VAR]: workspaceDir,
      },
    });

    const port = await findAvailablePort();
    const child = spawn('node', [
      CLI_ENTRY_PATH,
      'monitor',
      '--no-open',
      '--port',
      String(port),
    ], {
      cwd: workspaceDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);

    await waitForServerReady(child, port, 10_000);

    const [tracesResponse, sessionsResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${String(port)}/api/traces`),
      fetch(`http://127.0.0.1:${String(port)}/api/sessions`),
    ]);

    expect(tracesResponse.status).toBe(200);
    await expect(tracesResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          traceId: 'monitor-mcp-env-trace-001',
          workflowId: 'architect',
          surface: 'mcp',
        }),
      ]),
    });

    expect(sessionsResponse.status).toBe(200);
    await expect(sessionsResponse.json()).resolves.toMatchObject({
      success: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          initiator: 'mcp',
          task: 'Run workflow: architect',
          status: 'completed',
          metadata: expect.objectContaining({
            command: 'workflow.run',
            surface: 'mcp',
          }),
        }),
      ]),
    });
  }, PROCESS_TEST_TIMEOUT_MS);
});
