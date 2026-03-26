import { mkdirSync } from 'node:fs';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { executeCli } from '../src/index.js';
import { skillCommand } from '../src/commands/skill.js';
import type { CLIOptions } from '../src/types.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `skill-command-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
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
    sessionId: undefined,
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
    status: undefined,
    compact: false,
    team: undefined,
    provider: undefined,
    outputDir: undefined,
    basePath: undefined,
    dryRun: false,
    quiet: false,
    ...overrides,
  };
}

async function writeSkillSource(basePath: string, content: string, relativePath = join('fixtures', 'sample-skill', 'SKILL.md')): Promise<string> {
  const path = join(basePath, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  return path;
}

async function writeBridgeDefinition(basePath: string, content: unknown, relativePath = join('.automatosx', 'bridges', 'sample', 'bridge.json')): Promise<string> {
  const path = join(basePath, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  return path;
}

async function writeScriptFile(basePath: string, relativePath: string, content: string): Promise<string> {
  const path = join(basePath, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  await chmod(path, 0o755);
  return path;
}

async function writeWorkspaceConfig(basePath: string, content: unknown): Promise<void> {
  const path = join(basePath, '.automatosx', 'config.json');
  mkdirSync(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
}

describe('skill command', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('imports a local SKILL.md and lists it through the unified CLI entrypoint', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Deploy Review',
      'description: Review deploy readiness for a service.',
      'dispatch: delegate',
      'tags: [deploy, review]',
      '---',
      '# Deploy Review',
      '',
      'Use this skill to review deploy readiness and release risks.',
      '',
    ].join('\n'));

    const importResult = await executeCli(['skill', 'import', sourcePath, '--output-dir', tempDir]);
    expect(importResult.success).toBe(true);
    expect(importResult.message).toContain('Imported skill: deploy-review');

    const listResult = await executeCli(['skill', 'list', '--output-dir', tempDir]);
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('deploy-review [delegate]');
  });

  it('imports denied skills by default but surfaces trust warnings', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
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
    ].join('\n'), join('fixtures', 'guarded-import', 'SKILL.md'));

    const result = await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Imported skill: guarded-import-skill');
    expect(result.message).toContain('Trust: denied');
    expect(result.message).toContain('Warning:');
    expect(result.data).toMatchObject({
      trust: expect.objectContaining({
        allowed: false,
        state: 'denied',
      }),
      warnings: [
        expect.stringContaining('imported, but trust is currently denied'),
      ],
    });

    const canonicalRaw = await readFile(join(tempDir, '.automatosx', 'skills', 'guarded-import-skill', 'skill.json'), 'utf8');
    expect(canonicalRaw).toContain('"skillId": "guarded-import-skill"');
  });

  it('rejects denied skill imports when --require-trusted is set', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
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
    ].join('\n'), join('fixtures', 'strict-import', 'SKILL.md'));

    const result = await skillCommand(['import', sourcePath, '--require-trusted'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Skill import denied: strict-import-skill');
    await expect(readFile(join(tempDir, '.automatosx', 'skills', 'strict-import-skill', 'skill.json'), 'utf8')).rejects.toThrow();
  });

  it('rejects denied skill imports when workspace config enables strict admission', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Config Import Skill',
      'approval-mode: prompt',
      'dispatch: delegate',
      'linked-agent-id: config-reviewer',
      'description: Workspace config forces strict skill admission.',
      '---',
      '# Config Import Skill',
      '',
      'This import should be rejected by workspace config.',
      '',
    ].join('\n'), join('fixtures', 'config-import', 'SKILL.md'));
    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        skillImport: {
          rejectDenied: true,
        },
      },
    });

    const result = await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Skill import denied: config-import-skill');
    await expect(readFile(join(tempDir, '.automatosx', 'skills', 'config-import-skill', 'skill.json'), 'utf8')).rejects.toThrow();
  });

  it('suppresses denied skill import warnings when workspace config disables them', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Quiet Import Skill',
      'approval-mode: prompt',
      'dispatch: delegate',
      'linked-agent-id: quiet-reviewer',
      'description: Warning should be suppressed.',
      '---',
      '# Quiet Import Skill',
      '',
      'Import this skill without a human-facing warning.',
      '',
    ].join('\n'), join('fixtures', 'quiet-import', 'SKILL.md'));
    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        skillImport: {
          warnOnDenied: false,
        },
      },
    });

    const result = await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Imported skill: quiet-import-skill');
    expect(result.message).toContain('Trust: denied');
    expect(result.message).not.toContain('Warning:');
    expect(result.data).toMatchObject({
      warnings: [],
    });
  });

  it('resolves an imported skill against a query', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Release Guard',
      'description: Audit release readiness and rollout risks.',
      'tags: [release, qa]',
      '---',
      '# Release Guard',
      '',
      'Check rollout blockers, release risks, and deployment issues.',
      '',
    ].join('\n'));

    await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));
    const result = await skillCommand(['resolve', 'release risk'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Resolved skills for query: release risk');
    expect(result.message).toContain('release-guard');
  });

  it('exports a canonical skill definition back to SKILL.md', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Bridge Runner',
      'description: Invoke a linked bridge from a skill.',
      'command-dispatch: tool',
      'linked-bridge-id: internal-bridge',
      'tags: [bridge, runtime]',
      '---',
      '# Bridge Runner',
      '',
      'Run the linked bridge with validated input.',
      '',
    ].join('\n'), join('fixtures', 'bridge-runner', 'SKILL.md'));

    await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));

    const exportResult = await skillCommand(
      ['export', 'bridge-runner', join('exports', 'bridge-runner')],
      defaultOptions({ outputDir: tempDir }),
    );
    expect(exportResult.success).toBe(true);
    expect(exportResult.message).toContain('Exported skill: bridge-runner');

    const exportedRaw = await readFile(join(tempDir, 'exports', 'bridge-runner', 'SKILL.md'), 'utf8');
    expect(exportedRaw).toContain('skill-id: bridge-runner');
    expect(exportedRaw).toContain('dispatch: bridge');
    expect(exportedRaw).toContain('command-dispatch: tool');
    expect(exportedRaw).toContain('linked-bridge-id: internal-bridge');
    expect(exportedRaw).toContain('provenance:');
    expect(exportedRaw).toContain('# Bridge Runner');
  });

  it('runs a bridge-dispatch skill through its linked bridge', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    await writeScriptFile(tempDir, join('.automatosx', 'bridges', 'runtime', 'echo.js'), [
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2) }));",
      '',
    ].join('\n'));
    await writeBridgeDefinition(tempDir, {
      schemaVersion: 1,
      bridgeId: 'runtime-bridge',
      name: 'Runtime Bridge',
      version: '0.1.0',
      description: 'Run a linked runtime script.',
      kind: 'script',
      entrypoint: {
        type: 'script',
        path: './echo.js',
      },
    }, join('.automatosx', 'bridges', 'runtime', 'bridge.json'));
    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Runtime Skill',
      'command-dispatch: tool',
      'linked-bridge-id: runtime-bridge',
      '---',
      '# Runtime Skill',
      '',
      'Invoke the linked runtime bridge.',
      '',
    ].join('\n'), join('fixtures', 'runtime-skill', 'SKILL.md'));

    await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));
    const result = await skillCommand(['run', 'runtime-skill', 'hello'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Skill executed: runtime-skill');
    expect(result.message).toContain('Dispatch: bridge');
    expect(result.message).toContain('Bridge: runtime-bridge');
    expect(result.message).toContain('"args":["hello"]');
  });

  it('runs a delegate-dispatch skill through the shared runtime agent path', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'deploy-reviewer',
      name: 'Deploy Reviewer',
      capabilities: ['deploy', 'review'],
    });

    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Deploy Review',
      'dispatch: delegate',
      'linked-agent-id: deploy-reviewer',
      'description: Review deployment readiness and rollout risks.',
      '---',
      '# Deploy Review',
      '',
      'Use the deploy reviewer agent to check rollout readiness.',
      '',
    ].join('\n'), join('fixtures', 'deploy-review', 'SKILL.md'));

    await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));
    const result = await skillCommand(['run', 'deploy-review', 'check rollout risk'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Skill executed: deploy-review');
    expect(result.message).toContain('Dispatch: delegate');
    expect(result.message).toContain('Agent: deploy-reviewer');
    expect(result.message).toContain('Simulated agent output from deploy-reviewer');
  });

  it('stores import provenance and blocks trusted skills until allowlisted', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'ops-reviewer',
      name: 'Ops Reviewer',
      capabilities: ['ops', 'review'],
    });

    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Ops Review',
      'dispatch: delegate',
      'linked-agent-id: ops-reviewer',
      'approval-mode: prompt',
      'description: Review operations readiness.',
      '---',
      '# Ops Review',
      '',
      'Use the ops reviewer agent.',
      '',
    ].join('\n'), join('fixtures', 'ops-review', 'SKILL.md'));

    await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));
    const canonicalRaw = await readFile(join(tempDir, '.automatosx', 'skills', 'ops-review', 'skill.json'), 'utf8');
    expect(canonicalRaw).toContain('"importer": "ax.skill.import"');
    expect(canonicalRaw).toContain('"type": "local-file"');

    const blocked = await skillCommand(['run', 'ops-review'], defaultOptions({ outputDir: tempDir }));
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain('requires explicit trust');

    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        trust: {
          trustedSkillIds: ['ops-review'],
        },
      },
    });

    const allowed = await skillCommand(['run', 'ops-review'], defaultOptions({ outputDir: tempDir }));
    expect(allowed.success).toBe(true);
    expect(allowed.message).toContain('Skill executed: ops-review');
    expect(allowed.message).toContain('Dispatch: delegate');
  });

  it('allows prompt-approved skills when their source prefix is trusted', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'community-reviewer',
      name: 'Community Reviewer',
      capabilities: ['ops', 'review'],
    });

    const canonicalPath = join(tempDir, '.automatosx', 'skills', 'community-review', 'skill.json');
    mkdirSync(dirname(canonicalPath), { recursive: true });
    await writeFile(canonicalPath, `${JSON.stringify({
      schemaVersion: 1,
      skillId: 'community-review',
      name: 'Community Review',
      dispatch: 'delegate',
      linkedAgentId: 'community-reviewer',
      description: 'Review operations readiness from a trusted source.',
      body: 'Use the community reviewer agent.',
      approval: {
        mode: 'prompt',
      },
      provenance: {
        type: 'github',
        ref: 'https://github.com/example/community-review',
        importer: 'ax.skill.import',
      },
    }, null, 2)}\n`, 'utf8');

    await writeWorkspaceConfig(tempDir, {
      axBridge: {
        trust: {
          trustedSourcePrefixes: ['https://github.com/example/'],
        },
      },
    });

    const result = await skillCommand(['run', 'community-review'], defaultOptions({ outputDir: tempDir }));
    expect(result.success).toBe(true);
    expect(result.message).toContain('Skill executed: community-review');
    expect(result.message).toContain('Dispatch: delegate');
    expect(result.message).toContain('Agent: community-reviewer');
  });

  it('rejects direct execution for prompt-only skills', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name: Prompt Only',
      'dispatch: prompt',
      '---',
      '# Prompt Only',
      '',
      'This is guidance only.',
      '',
    ].join('\n'), join('fixtures', 'prompt-only', 'SKILL.md'));

    await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));
    const result = await skillCommand(['run', 'prompt-only'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('prompt-only and cannot be run directly');
  });

  it('fails to import malformed SKILL.md frontmatter', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const sourcePath = await writeSkillSource(tempDir, [
      '---',
      'name Deploy Review',
      'description: Missing colon in frontmatter.',
      '---',
      '# Broken Skill',
      '',
      'This should fail.',
      '',
    ].join('\n'), join('fixtures', 'broken-skill', 'SKILL.md'));

    const result = await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Malformed SKILL.md frontmatter line');
  });
});
