import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { RuntimeGovernanceAggregateSchema } from '@defai.digital/shared-runtime/governance';
import { governanceCommand, doctorCommand, setupCommand, skillCommand, statusCommand } from '../src/commands/index.js';
import { createMonitorApiResponse } from '../src/commands/monitor.js';
import { buildMonitorState } from '../src/commands/monitor-state.js';
import type { CLIOptions } from '../src/types.js';
import { createCliTestTempDir } from './support/test-paths.js';

function createTempDir(): string {
  return createCliTestTempDir('governance-surface-parity');
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

describe('governance surface parity', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    delete process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS;
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('keeps canonical governance aggregates aligned across governance, doctor, status, and monitor surfaces', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';
    const setupResult = await setupCommand([], defaultOptions({ outputDir: tempDir }));
    expect(setupResult.success).toBe(true);

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

    const importResult = await skillCommand(['import', skillSourcePath], defaultOptions({ outputDir: tempDir }));
    expect(importResult.success).toBe(true);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'governance-parity-trace-001',
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

    const options = defaultOptions({ outputDir: tempDir, limit: 10 });
    const governanceResult = await governanceCommand([], options);
    const doctorResult = await doctorCommand([], options);
    const statusResult = await statusCommand([], options);
    const monitorState = await buildMonitorState(
      runtime,
      async () => ({
        source: 'unavailable',
        detectedProviders: [],
        enabledProviders: [],
        installedButDisabledProviders: [],
      }),
      tempDir,
      undefined,
      10,
    );
    const monitorGovernance = JSON.parse(createMonitorApiResponse('/api/governance', monitorState).body) as {
      success: boolean;
      data: unknown;
    };

    expect(governanceResult.success).toBe(true);
    expect(doctorResult.success).toBe(true);
    expect(statusResult.success).toBe(true);
    expect(monitorGovernance.success).toBe(true);

    const governance = RuntimeGovernanceAggregateSchema.parse(governanceResult.data);
    const doctorGovernance = RuntimeGovernanceAggregateSchema.parse((doctorResult.data as { governance: unknown }).governance);
    const statusGovernance = RuntimeGovernanceAggregateSchema.parse((statusResult.data as { governance: unknown }).governance);
    const monitorAggregate = RuntimeGovernanceAggregateSchema.parse(monitorGovernance.data);

    expect(doctorGovernance).toEqual(governance);
    expect(statusGovernance).toEqual(governance);
    expect(monitorAggregate).toEqual(governance);
    expect(governance).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'governance-parity-trace-001',
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
  });
});
