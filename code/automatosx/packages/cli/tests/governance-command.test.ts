import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { RuntimeGovernanceAggregateSchema } from '@defai.digital/shared-runtime/governance';
import { executeCli } from '../src/index.js';
import {
  governanceCommand,
  skillCommand,
} from '../src/commands/index.js';
import type { CLIOptions } from '../src/types.js';
import { writeDeniedInstalledBridge } from './support/bridge-fixtures.js';
import { createCliTestTempDir } from './support/test-paths.js';

function createTempDir(): string {
  return createCliTestTempDir('governance-command');
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

describe('governance command', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('returns an empty governance aggregate for a clean workspace', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await governanceCommand([], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('AutomatosX Governance');
    expect(result.message).toContain('Runtime-governance blocked traces: 0');
    expect(result.message).toContain('Denied imported skills:');
    expect(result.data).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
    expect(RuntimeGovernanceAggregateSchema.parse(result.data)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
  });

  it('surfaces blocked traces and denied imported skills through the canonical aggregate', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const skillSourcePath = join(tempDir, 'fixtures', 'guarded-import', 'SKILL.md');
    await mkdir(join(tempDir, 'fixtures', 'guarded-import'), { recursive: true });
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

    await skillCommand(['import', skillSourcePath], defaultOptions({ outputDir: tempDir }));

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'governance-trace-001',
      workflowId: 'workflow-skill-trust',
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

    const result = await governanceCommand([], defaultOptions({ outputDir: tempDir, limit: 10 }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Runtime-governance blocked traces: 1');
    expect(result.message).toContain('governance-trace-001 workflow-skill-trust');
    expect(result.message).toContain('Runtime governance blocked step "run-skill"');
    expect(result.message).toContain('Denied imported skills:');
    expect(result.message).toContain('guarded-import-skill denied');
    expect(result.data).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'governance-trace-001',
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

  it('includes denied installed bridges in the governance text summary without changing the canonical aggregate', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await writeDeniedInstalledBridge(tempDir, {
      bridgeId: 'guarded-installed-bridge',
    });

    const result = await governanceCommand([], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Denied installed bridges:');
    expect(result.message).toContain('guarded-installed-bridge denied');
    expect(result.message).toContain('requires explicit trust');
    expect(RuntimeGovernanceAggregateSchema.parse(result.data)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
  });

  it('dispatches governance through the unified CLI entrypoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await executeCli([
      'governance',
      '--output-dir',
      tempDir,
      '--limit',
      '5',
      '--format',
      'json',
    ]);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
    expect(RuntimeGovernanceAggregateSchema.parse(result.data)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
  });

  it('uses recent failed traces instead of the generic trace list for governance aggregates', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'governance-failed-001',
      workflowId: 'workflow-skill-trust',
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
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'governance-success-001',
      workflowId: 'ship',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-25T00:00:10.000Z',
      completedAt: '2026-03-25T00:00:12.000Z',
      stepResults: [],
      metadata: {},
    });

    const result = await governanceCommand([], defaultOptions({ outputDir: tempDir, limit: 1 }));

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'governance-failed-001',
      },
    });
  });
});
