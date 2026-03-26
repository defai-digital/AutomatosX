import { mkdirSync } from 'node:fs';
import { rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildWorkflowInput,
  dispatch,
  getWorkflowCatalogEntry,
  parseWorkflowCommandInput,
  preview,
  validateWorkflowInput,
  type WorkflowCommandInput,
} from '../src/workflow-adapter.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `workflow-adapter-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('workflow adapter', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('builds command-specific previews', async () => {
    const commandInputs: Array<{ id: WorkflowCommandInput['commandId']; args: string[] }> = [
      { id: 'ship', args: ['--scope', 'checkout', '--issue', 'AX-1'] },
      { id: 'architect', args: ['--request', 'Auth redesign'] },
      { id: 'audit', args: ['--scope', 'src/core', '--depth', 'deep'] },
      { id: 'qa', args: ['--target', 'checkout', '--url', 'https://localhost:3000'] },
      { id: 'release', args: ['--releaseVersion', '1.2.0', '--commits', 'a..b'] },
    ];

    for (const commandInput of commandInputs) {
      const input = parseWorkflowCommandInput(commandInput.id, commandInput.args);
      const commandPreview = await preview(input);
      const catalogEntry = getWorkflowCatalogEntry(commandInput.id);

      expect(commandPreview.workflowId).toBe(commandInput.id);
      expect(commandPreview.workflowName).toBe(catalogEntry?.workflowName);
      expect(commandPreview.agent).toBe(catalogEntry?.agentId);
      expect(commandPreview.stages).toEqual(catalogEntry?.stages ?? []);
      expect(commandPreview.artifactNames).toEqual(catalogEntry?.artifactNames ?? []);
      expect(commandPreview.artifactNames.length).toBeGreaterThan(0);
      expect(commandPreview.traceId).toMatch(/[0-9a-f-]{20,}/);
    }
  });

  it('validates required input values for architect', () => {
    const input = parseWorkflowCommandInput('architect', []);
    expect(validateWorkflowInput(input)).toBe('A request or input is required for architect');
  });

  it('validates required input values for ship, qa, and release from the shared catalog contract', () => {
    expect(validateWorkflowInput(parseWorkflowCommandInput('ship', []))).toBe('A scope is required for ship');
    expect(validateWorkflowInput(parseWorkflowCommandInput('qa', ['--target', 'checkout']))).toBe('Required inputs for qa: target and url');
    expect(validateWorkflowInput(parseWorkflowCommandInput('release', ['--target', 'production']))).toBe('A releaseVersion is required for release');
  });

  it('builds runtime payloads for all five workflow commands', async () => {
    const ids: Array<'ship' | 'architect' | 'audit' | 'qa' | 'release'> = [
      'ship',
      'architect',
      'audit',
      'qa',
      'release',
    ];

    for (const commandId of ids) {
      const input = parseWorkflowCommandInput(commandId, ['--output-dir', tempDir], 'claude');
      const payload = buildWorkflowInput(input);

      expect(payload.workflowId).toBe(commandId);
      expect(payload.workflowName.length).toBeGreaterThan(0);
      expect(payload.options.outputDir).toBe(tempDir);
      expect(payload.options.provider).toBe('claude');
    }
  });

  it('propagates session ids through workflow runtime payloads', async () => {
    const input = parseWorkflowCommandInput(
      'ship',
      ['--scope', 'checkout', '--session-id', 'workflow-session-001', '--output-dir', tempDir],
      'claude',
    );
    const payload = buildWorkflowInput(input);

    expect(payload.options.sessionId).toBe('workflow-session-001');

    const result = await dispatch(input, {
      runtimeDispatcher: async (runtimePayload) => {
        expect(runtimePayload.options.sessionId).toBe('workflow-session-001');
        return {
          success: true,
          traceId: runtimePayload.traceId,
          outputDir: tempDir,
          manifestPath: join(tempDir, 'manifest.json'),
          summaryPath: join(tempDir, 'summary.json'),
        };
      },
    });

    expect(result.success).toBe(true);
  });

  it('returns preview status artifacts for all five workflow commands when --dry-run is set', async () => {
    const ids: Array<'ship' | 'architect' | 'audit' | 'qa' | 'release'> = [
      'ship',
      'architect',
      'audit',
      'qa',
      'release',
    ];

    for (const commandId of ids) {
      const input = parseWorkflowCommandInput(commandId, ['--output-dir', tempDir, '--dry-run'], 'claude');
      const result = await dispatch(input);

      expect(result.success).toBe(true);
      expect(result.manifestPath).toMatch(/manifest\.json$/);
      expect(result.summaryPath).toMatch(/summary\.json$/);

      const manifestPath = result.manifestPath ?? '';
      const summaryPath = result.summaryPath ?? '';

      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        status?: string;
        workflow?: { id?: string };
      };
      const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as {
        status?: string;
      };

      expect(manifest.status).toBe('preview');
      expect(summary.status).toBe('preview');
      expect(manifest.workflow?.id).toBe(commandId);
    }
  });

  it('does not call runtime dispatch on dry-run', async () => {
    const input = parseWorkflowCommandInput('release', ['--output-dir', tempDir, '--dry-run'], 'claude');
    let called = 0;

    const result = await dispatch(input, {
      runtimeDispatcher: async () => {
        called += 1;
        return {
          success: true,
          traceId: input.traceContext?.parentTraceId ?? 'unused',
          outputDir: tempDir,
          manifestPath: join(tempDir, 'manifest.json'),
          summaryPath: join(tempDir, 'summary.json'),
        };
      },
    });

    expect(result.success).toBe(true);
    expect(called).toBe(0);
  });

  it('propagates provided trace context through dispatch artifact updates', async () => {
    const input = parseWorkflowCommandInput('qa', ['target-service', '--url', 'https://localhost:3000', '--output-dir', tempDir], 'claude');
    input.traceContext = { parentTraceId: 'trace-parent-123' };

    const result = await dispatch(input, {
      runtimeDispatcher: async (payload) => {
        expect(payload.traceId).toBe('trace-parent-123');
        return {
          success: true,
          traceId: payload.traceId,
          outputDir: tempDir,
          manifestPath: join(tempDir, 'manifest.json'),
          summaryPath: join(tempDir, 'summary.json'),
        };
      },
    });

    expect(result.success).toBe(true);
    expect(result.traceId).toBe('trace-parent-123');
  });

  it('does not implicitly reuse preview trace ids during dispatch', async () => {
    const input = parseWorkflowCommandInput('ship', ['--scope', 'checkout', '--output-dir', tempDir], 'claude');
    const commandPreview = await preview(input);

    const result = await dispatch(input, {
      runtimeDispatcher: async (payload) => ({
        success: true,
        traceId: payload.traceId,
        outputDir: tempDir,
        manifestPath: join(tempDir, 'manifest.json'),
        summaryPath: join(tempDir, 'summary.json'),
      }),
    });

    expect(result.success).toBe(true);
    expect(result.traceId).not.toBe(commandPreview.traceId);
  });

  it('returns success when dispatch uses a custom runtime dispatcher', async () => {
    const input = parseWorkflowCommandInput('qa', ['target-service', '--url', 'https://localhost:3000', '--output-dir', tempDir]);

    const runtimeDispatchedPath = join(tempDir, 'runtime-dispatched.txt');
    const result = await dispatch(input, {
      runtimeDispatcher: async (payload) => {
        await writeFile(runtimeDispatchedPath, `trace=${payload.traceId}`, 'utf8');
        return {
          success: true,
          traceId: payload.traceId,
          outputDir: tempDir,
          manifestPath: join(tempDir, 'manifest.json'),
          summaryPath: join(tempDir, 'summary.json'),
        };
      },
    });

    expect(result.success).toBe(true);
    const runtimePayload = await readFile(runtimeDispatchedPath, 'utf8');
    expect(runtimePayload).toContain('trace=');
  });

  it('recovers when workflow artifact json is corrupted before status update', async () => {
    const input = parseWorkflowCommandInput('architect', ['--request', 'Recover status write', '--output-dir', tempDir], 'claude');

    const result = await dispatch(input, {
      runtimeDispatcher: async () => {
        await Promise.all([
          writeFile(join(tempDir, 'manifest.json'), '["invalid"]', 'utf8'),
          writeFile(join(tempDir, 'summary.json'), '{"status"', 'utf8'),
        ]);
        return {
          success: true,
          traceId: 'runtime-trace-001',
          outputDir: tempDir,
          manifestPath: join(tempDir, 'manifest.json'),
          summaryPath: join(tempDir, 'summary.json'),
        };
      },
    });

    expect(result.success).toBe(true);
    expect(result.traceId.length).toBeGreaterThan(0);

    const manifest = JSON.parse(await readFile(join(tempDir, 'manifest.json'), 'utf8')) as {
      status?: string;
    };
    const summary = JSON.parse(await readFile(join(tempDir, 'summary.json'), 'utf8')) as {
      status?: string;
    };

    expect(manifest.status).toBe('dispatched');
    expect(summary.status).toBe('dispatched');
  });

  it('writes runtime guard summaries into workflow manifest and summary artifacts on failed dispatch', async () => {
    const input = parseWorkflowCommandInput('architect', ['--request', 'Guarded rollout', '--output-dir', tempDir], 'claude');

    const result = await dispatch(input, {
      runtimeDispatcher: async () => ({
        success: false,
        traceId: 'runtime-guard-001',
        outputDir: tempDir,
        manifestPath: join(tempDir, 'manifest.json'),
        summaryPath: join(tempDir, 'summary.json'),
        errorCode: 'workflow_runtime_failed',
        errorMessage: 'Workflow "architect" failed: guard blocked execution.',
        guard: {
          summary: 'Runtime governance blocked step "run-skill". Trust state: implicit-local.',
          guardId: 'enforce-runtime-trust',
          failedStepId: 'run-skill',
          failedGates: ['runtime_trust'],
          blockedByRuntimeGovernance: true,
          toolName: 'skill.run',
          trustState: 'implicit-local',
          requiredTrustStates: ['trusted-id'],
        },
      }),
    });

    expect(result.success).toBe(false);
    expect(result.guard).toMatchObject({
      blockedByRuntimeGovernance: true,
      toolName: 'skill.run',
      trustState: 'implicit-local',
    });

    const manifest = JSON.parse(await readFile(join(tempDir, 'manifest.json'), 'utf8')) as {
      status?: string;
      error?: string;
      guard?: {
        summary?: string;
        trustState?: string;
      };
    };
    const summary = JSON.parse(await readFile(join(tempDir, 'summary.json'), 'utf8')) as {
      status?: string;
      error?: string;
      guard?: {
        summary?: string;
        toolName?: string;
      };
    };

    expect(manifest.status).toBe('failed');
    expect(summary.status).toBe('failed');
    expect(manifest.error).toContain('guard blocked execution');
    expect(summary.error).toContain('guard blocked execution');
    expect(manifest.guard).toMatchObject({
      trustState: 'implicit-local',
    });
    expect(manifest.guard?.summary).toContain('Runtime governance blocked step "run-skill"');
    expect(summary.guard).toMatchObject({
      toolName: 'skill.run',
    });

    const artifactMarkdown = await readFile(result.artifactPaths?.[0] ?? '', 'utf8');
    expect(artifactMarkdown).toContain('## Dispatch Outcome');
    expect(artifactMarkdown).toContain('- Status: failed');
    expect(artifactMarkdown).toContain('- Error: Workflow "architect" failed: guard blocked execution.');
    expect(artifactMarkdown).toContain('- Guard: Runtime governance blocked step "run-skill". Trust state: implicit-local.');
    expect(artifactMarkdown).toContain('- Guard tool: skill.run');
    expect(artifactMarkdown).toContain('- Guard trust: implicit-local');
    expect(artifactMarkdown).toContain('- Guard requires: trusted-id');
  });
});
