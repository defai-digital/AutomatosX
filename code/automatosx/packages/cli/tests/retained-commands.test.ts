import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETUP_MCP_TOOL_FAMILIES, MCP_BASE_PATH_ENV_VAR } from '@defai.digital/mcp-server';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { RuntimeGovernanceAggregateSchema } from '@defai.digital/shared-runtime/governance';
import {
  ADVANCED_SUPPORT_COMMANDS,
  DEFAULT_ENTRY_PATH_COMMANDS,
  README_WORKFLOW_COMMANDS,
  STABLE_SUPPORT_COMMANDS,
} from '../src/command-metadata.js';
import {
  doctorCommand,
  discussCommand,
  initCommand,
  listCommand,
  skillCommand,
  setupCommand,
  traceCommand,
} from '../src/commands/index.js';
import type { CLIOptions } from '../src/types.js';
import {
  CLI_WORKFLOW_DIR,
  WORKSPACE_ROOT,
  createCliTestTempDir,
} from './support/test-paths.js';
import { writeDeniedInstalledBridge } from './support/bridge-fixtures.js';

function createTempDir(): string {
  return createCliTestTempDir('retained-commands');
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

describe('retained high-value commands', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    delete process.env.AUTOMATOSX_AVAILABLE_CLIENTS;
    delete process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS;
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('keeps checked-in AX Trust docs aligned with the shared command surface', async () => {
    const agentsMd = await readFile(join(WORKSPACE_ROOT, 'AGENTS.md'), 'utf8');
    const readme = await readFile(join(WORKSPACE_ROOT, 'README.md'), 'utf8');

    expect(agentsMd).toContain('This repository is configured for AutomatosX v14');
    for (const usage of DEFAULT_ENTRY_PATH_COMMANDS) {
      expect(agentsMd).toContain(`- ${usage}`);
    }
    for (const usage of STABLE_SUPPORT_COMMANDS) {
      expect(agentsMd).toContain(`- ${usage}`);
    }
    for (const usage of ADVANCED_SUPPORT_COMMANDS) {
      expect(agentsMd).toContain(`- ${usage}`);
    }
    for (const usage of README_WORKFLOW_COMMANDS) {
      expect(readme).toContain(usage);
    }
    expect(readme).toContain('Advanced surfaces still available in the CLI include');
    expect(readme).toContain('AutomatosX is the product family.');
    expect(readme).toContain('This repository is being repositioned as `AX Trust`');
    expect(readme).not.toContain('ax audit --scope <path>');
    expect(readme).not.toContain('ax qa --target <service> --url <url>');
    expect(readme).not.toContain('ax iterate <command> --max-rounds 3');
    expect(readme).toContain('## Built-in stable agents');
    expect(readme).toContain('- `architect`');
    expect(readme).toContain('- `quality`');
    expect(readme).toContain('- `bug-hunter`');
    expect(readme).toContain('- `release-manager`');
    expect(readme).not.toContain('Available agents (28 total)');
    expect(readme).not.toContain('`frontend`');
    expect(readme).not.toContain('`product`');

    expect(readme).toContain('`workflow_run`');
    expect(readme).toContain('`workflow_list`');
    expect(readme).toContain('`workflow_describe`');
    expect(readme).toContain('`discuss_run`');
    expect(readme).toContain('`agent_run`');
    expect(readme).toContain('`review_analyze`');
    expect(readme).not.toContain('`ax_workflow_run`');
    expect(readme).not.toContain('`ax_discuss`');
    expect(readme).not.toContain('`ax_agent_run`');
    expect(readme).not.toContain('`ax_review_analyze`');
  });

  it('bootstraps local workspace state with setup', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_AVAILABLE_CLIENTS = 'claude,gemini,codex';

    const result = await setupCommand([], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    const config = JSON.parse(await readFile(join(tempDir, '.automatosx', 'config.json'), 'utf8')) as {
      workflowArtifactDir?: string;
      runtimeStoreDir?: string;
    };
    expect(config.workflowArtifactDir).toBe('.automatosx/workflows');
    expect(config.runtimeStoreDir).toBe('.automatosx/runtime');
    expect(result.message).toContain('Detected provider clients: claude, gemini, codex');
    expect(result.message).toContain('Default Surface');
    expect(result.message).toContain('Workflow-first entry paths:');
    expect(result.message).toContain('Stable support commands:');
    expect(result.message).toContain('Advanced commands remain available:');

    const environment = JSON.parse(await readFile(join(tempDir, '.automatosx', 'environment.json'), 'utf8')) as {
      providers?: Array<{ providerId: string; installed: boolean }>;
      mcp?: { command?: string; args?: string[]; env?: Record<string, string> };
    };
    expect(environment.mcp?.command).toBe('ax');
    expect(environment.mcp?.args).toEqual(['mcp', 'serve']);
    expect(environment.mcp?.env).toMatchObject({
      [MCP_BASE_PATH_ENV_VAR]: tempDir,
    });
    expect(environment.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerId: 'claude', installed: true }),
      expect.objectContaining({ providerId: 'gemini', installed: true }),
      expect.objectContaining({ providerId: 'codex', installed: true }),
    ]));

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    const agents = await runtime.listAgents();
    const policies = await runtime.listPolicies();

    expect(agents.map((agent) => agent.agentId)).toEqual([
      'architect',
      'bug-hunter',
      'quality',
      'release-manager',
    ]);
    expect(policies.map((policy) => policy.policyId)).toContain('workflow-artifact-contract');
  });

  it('keeps setup idempotent when a built-in agent already exists with older configuration', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.registerAgent({
      agentId: 'architect',
      name: 'Architect',
      capabilities: ['planning'],
      metadata: {
        team: 'core',
      },
    });

    const result = await setupCommand([], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Agents ready: architect, quality, bug-hunter, release-manager');

    const agents = await runtime.listAgents();
    expect(agents.map((agent) => agent.agentId)).toEqual([
      'architect',
      'bug-hunter',
      'quality',
      'release-manager',
    ]);
    await expect(runtime.getAgent('architect')).resolves.toMatchObject({
      agentId: 'architect',
      capabilities: ['planning'],
      metadata: {
        team: 'core',
      },
    });
  });

  it('creates project context and provider integration metadata with setup', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    const result = await setupCommand([], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Provider integration files:');
    expect(await readFile(join(tempDir, 'AGENTS.md'), 'utf8')).toContain('AutomatosX v14');
    expect(await readFile(join(tempDir, '.automatosx', 'context', 'conventions.md'), 'utf8')).toContain('Conventions');
    expect(await readFile(join(tempDir, '.automatosx', 'context', 'rules.md'), 'utf8')).toContain('Prefer first-class workflow commands');

    const mcpConfig = JSON.parse(await readFile(join(tempDir, '.automatosx', 'mcp.json'), 'utf8')) as {
      tools?: string[];
      transport?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    };
    expect(mcpConfig.tools).toContain('workflow_run');
    expect(mcpConfig.tools).toContain('trace_list');
    expect(mcpConfig.tools).toEqual([...DEFAULT_SETUP_MCP_TOOL_FAMILIES]);
    expect(mcpConfig.tools).not.toContain('design_api');
    expect(mcpConfig.tools).not.toContain('memory_store');
    expect(mcpConfig.transport).toBe('stdio');
    expect(mcpConfig.command).toBe('ax');
    expect(mcpConfig.args).toEqual(['mcp', 'serve']);
    expect(mcpConfig.env).toMatchObject({
      [MCP_BASE_PATH_ENV_VAR]: tempDir,
    });

    const claudeMcp = JSON.parse(await readFile(join(tempDir, '.mcp.json'), 'utf8')) as {
      mcpServers?: { automatosx?: { command?: string; args?: string[]; env?: Record<string, string> } };
    };
    expect(claudeMcp.mcpServers?.automatosx?.command).toBe('ax');
    expect(claudeMcp.mcpServers?.automatosx?.args).toEqual(['mcp', 'serve']);
    expect(claudeMcp.mcpServers?.automatosx?.env).toMatchObject({
      [MCP_BASE_PATH_ENV_VAR]: tempDir,
    });

    const claudeSettings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf8')) as {
      permissions?: { allow?: string[] };
      hooks?: Record<string, unknown>;
    };
    expect(claudeSettings.permissions?.allow).toContain('mcp__automatosx__*');
    expect(Object.keys(claudeSettings.hooks ?? {})).toEqual(expect.arrayContaining(['SessionStart', 'SessionEnd']));
    expect(existsSync(join(tempDir, '.claude', 'hooks', 'session-start.sh'))).toBe(true);
    expect(existsSync(join(tempDir, '.claude', 'hooks', 'session-end.sh'))).toBe(true);

    const cursorConfig = JSON.parse(await readFile(join(tempDir, '.cursor', 'mcp.json'), 'utf8')) as {
      mcpServers?: { automatosx?: { command?: string; args?: string[]; env?: Record<string, string> } };
    };
    expect(cursorConfig.mcpServers?.automatosx?.command).toBe('ax');
    expect(cursorConfig.mcpServers?.automatosx?.args).toEqual(['mcp', 'serve']);
    expect(cursorConfig.mcpServers?.automatosx?.env).toMatchObject({
      [MCP_BASE_PATH_ENV_VAR]: tempDir,
    });

    const geminiConfig = JSON.parse(await readFile(join(tempDir, '.gemini', 'settings.json'), 'utf8')) as {
      mcpServers?: { automatosx?: { command?: string; args?: string[]; env?: Record<string, string>; transport?: string } };
    };
    expect(geminiConfig.mcpServers?.automatosx?.command).toBe('ax');
    expect(geminiConfig.mcpServers?.automatosx?.transport).toBe('stdio');
    expect(geminiConfig.mcpServers?.automatosx?.env).toMatchObject({
      [MCP_BASE_PATH_ENV_VAR]: tempDir,
    });

    const grokConfig = JSON.parse(await readFile(join(tempDir, '.ax-grok', 'settings.json'), 'utf8')) as {
      mcpServers?: { automatosx?: { command?: string; args?: string[]; env?: Record<string, string>; transport?: string } };
    };
    expect(grokConfig.mcpServers?.automatosx?.command).toBe('ax');
    expect(grokConfig.mcpServers?.automatosx?.transport).toBe('stdio');
    expect(grokConfig.mcpServers?.automatosx?.env).toMatchObject({
      [MCP_BASE_PATH_ENV_VAR]: tempDir,
    });

    const codexSnippet = await readFile(join(tempDir, '.automatosx', 'providers', 'codex.config.toml'), 'utf8');
    expect(codexSnippet).toContain('[mcp_servers.automatosx]');
    expect(codexSnippet).toContain('command = "ax"');
    expect(codexSnippet).toContain(`${MCP_BASE_PATH_ENV_VAR} = ${JSON.stringify(tempDir)}`);

    const providerSummary = JSON.parse(await readFile(join(tempDir, '.automatosx', 'providers.json'), 'utf8')) as {
      providers?: Array<{ providerId: string; installed: boolean; enabled: boolean }>;
    };
    expect(providerSummary.providers?.every((provider) => provider.installed && provider.enabled)).toBe(true);
  });

  it('supports selectively skipping provider registration during setup', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    const result = await setupCommand(['--skip-mcp'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(existsSync(join(tempDir, '.mcp.json'))).toBe(false);
    expect(existsSync(join(tempDir, '.claude'))).toBe(false);
    expect(existsSync(join(tempDir, '.cursor'))).toBe(false);
    expect(existsSync(join(tempDir, '.gemini'))).toBe(false);
    expect(existsSync(join(tempDir, '.ax-grok'))).toBe(false);
    expect(existsSync(join(tempDir, '.automatosx', 'providers', 'codex.config.toml'))).toBe(false);

    const providerSummary = JSON.parse(await readFile(join(tempDir, '.automatosx', 'providers.json'), 'utf8')) as {
      providers?: Array<{ enabled: boolean; notes: string[] }>;
    };
    expect(providerSummary.providers?.every((provider) => provider.enabled === false)).toBe(true);
  });

  it('fails setup on unknown command-specific flags', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await setupCommand(['--skip-unknown'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown setup flag');
  });

  it('keeps init as a compatibility alias to setup', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    const result = await initCommand([], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('ax init is deprecated');
    expect(await readFile(join(tempDir, 'AGENTS.md'), 'utf8')).toContain('AutomatosX v14');
  });

  it('reports workspace readiness with doctor after setup', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    await setupCommand([], defaultOptions({ outputDir: tempDir }));

    const result = await doctorCommand([], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('AutomatosX Doctor');
    expect(result.message).toContain('Overall status: warning');
    expect(result.message).toContain('Workflow discovery succeeded');
    expect(result.message).toContain('MCP surface is available');
    expect(result.message).toContain('stable workflow-first contract present');
    expect(result.message).toContain('Provider integration summary loaded');
    expect(result.message).toContain('Provider integration artifacts are present for all enabled providers.');
    expect(result.message).toContain('Stable bootstrap artifacts are present');
    expect(result.message).toContain('Trace store is readable but has no traces yet.');

    const data = result.data as { status: string; summary: { fail: number; warn: number } };
    expect(data.status).toBe('warning');
    expect(data.summary.fail).toBe(0);
    expect(data.summary.warn).toBe(1);
  });

  it('reports provider integration drift with doctor when generated artifacts are missing', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    await unlink(join(tempDir, '.cursor', 'mcp.json'));

    const result = await doctorCommand([], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Provider integration drift detected');
    expect(result.message).toContain('.cursor/mcp.json');
    expect(result.message).toContain('Stable bootstrap artifacts are present');

    const data = result.data as { status: string; summary: { fail: number; warn: number } };
    expect(data.status).toBe('warning');
    expect(data.summary.fail).toBe(0);
    expect(data.summary.warn).toBe(2);
  });

  it('does not treat provider-specific MCP registration as a missing stable bootstrap artifact', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    await setupCommand(['--skip-mcp'], defaultOptions({ outputDir: tempDir }));

    const result = await doctorCommand([], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Stable bootstrap artifacts are present');
    expect(result.message).not.toContain('Stable bootstrap artifacts are incomplete');
    expect(result.message).toContain('Provider integration summary loaded');
  });

  it('surfaces recent runtime governance blocks through doctor', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'doctor-guard-001',
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
        guardSummary: 'Runtime governance blocked step "run-skill". Guard "enforce-runtime-trust" rejected tool "skill.run". Trust state: implicit-local. Required trust states: trusted-id.',
        guardBlockedByRuntimeGovernance: true,
        guardToolName: 'skill.run',
        guardTrustState: 'implicit-local',
        guardRequiredTrustStates: ['trusted-id'],
      },
    });

    const result = await doctorCommand([], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Recent runtime-governance blocks detected');
    expect(result.message).toContain('doctor-guard-001');
    expect(result.message).toContain('Runtime governance blocked step "run-skill"');
    expect(result.data).toMatchObject({
      governance: {
        blockedCount: 1,
        latest: {
          traceId: 'doctor-guard-001',
          toolName: 'skill.run',
          trustState: 'implicit-local',
        },
      },
    });
    expect(RuntimeGovernanceAggregateSchema.parse((result.data as { governance: unknown }).governance)).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'doctor-guard-001',
      },
    });
  });

  it('surfaces denied imported skills through doctor', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    const sourcePath = join(tempDir, 'fixtures', 'guarded-import', 'SKILL.md');
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

    const importResult = await skillCommand(['import', sourcePath], defaultOptions({ outputDir: tempDir }));
    expect(importResult.success).toBe(true);

    const result = await doctorCommand([], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Denied imported skills detected');
    expect(result.message).toContain('guarded-import-skill');
    expect(result.message).toContain('Execution blocked because');
    expect(result.data).toMatchObject({
      governance: {
        blockedCount: 0,
        deniedImportedSkills: {
          deniedCount: 1,
          latest: {
            skillId: 'guarded-import-skill',
            trustState: 'denied',
          },
        },
      },
    });
    expect(RuntimeGovernanceAggregateSchema.parse((result.data as { governance: unknown }).governance)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 1,
      },
    });
  });

  it('surfaces denied installed bridges through doctor', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS = 'claude,cursor,gemini,codex,grok';

    await setupCommand([], defaultOptions({ outputDir: tempDir }));
    await writeDeniedInstalledBridge(tempDir, {
      bridgeId: 'guarded-installed-bridge',
    });

    const result = await doctorCommand([], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Denied installed bridges detected');
    expect(result.message).toContain('guarded-installed-bridge');
    expect(result.message).toContain('Execution blocked because');
    expect(result.data).toMatchObject({
      governance: {
        blockedCount: 0,
      },
      deniedInstalledBridges: {
        deniedCount: 1,
        latest: {
          bridgeId: 'guarded-installed-bridge',
          trustState: 'denied',
        },
      },
    });
    expect(RuntimeGovernanceAggregateSchema.parse((result.data as { governance: unknown }).governance)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
  });

  it('reports setup failures with doctor in an uninitialized workspace', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await doctorCommand([], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Run "ax setup"');
    expect(result.message).toContain('Overall status: unhealthy');
    expect(result.message).toContain('built-in stable catalog still exposes 4 agents for discovery');
  });

  it('lists available workflows with stable-surface annotations', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await listCommand([], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Available workflows');
    expect(result.message).toContain('owner quality');
    const data = result.data as Array<{ workflowId: string; stableSurface: boolean }>;
    expect(data.some((entry) => entry.workflowId === 'ship' && entry.stableSurface)).toBe(true);
    expect(data.some((entry) => entry.workflowId === 'architect' && entry.stableSurface)).toBe(true);
  });

  it('describes a workflow through the shared runtime', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await listCommand(['architect'], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Workflow: architect');
    expect(result.message).toContain('Stable surface: yes');
    expect(result.message).toContain('Owner agent: architect');
    expect(result.message).toContain('Required inputs: request or input');
    expect(result.message).toContain('Steps:');
    expect(result.message).toContain('Examples:');

    const data = result.data as {
      workflowId: string;
      stableSurface: boolean;
      steps: Array<{ stepId: string; type: string }>;
    };
    expect(data.workflowId).toBe('architect');
    expect(data.stableSurface).toBe(true);
    expect(data.steps.length).toBeGreaterThan(0);
  });

  it('lists stable workflows from the bundled workflow catalog without an explicit workflow directory', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await listCommand([], defaultOptions({
      basePath: tempDir,
    }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('ship');
    const data = result.data as Array<{ workflowId: string; stableSurface: boolean; source?: string }>;
    expect(data.some((entry) => entry.workflowId === 'ship' && entry.stableSurface)).toBe(true);
    expect(data.some((entry) => entry.source === 'bundled-definition' || entry.source === 'bundled-catalog')).toBe(true);
  });

  it('returns a usage error for list describe without a workflow id', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const result = await listCommand(['describe'], defaultOptions({
      outputDir: tempDir,
      workflowDir: CLI_WORKFLOW_DIR,
    }));

    expect(result.success).toBe(false);
    expect(result.message).toContain('Usage: ax list describe <workflow-id>');
  });

  it('runs top-level discussion and exposes the trace through trace commands', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const discussResult = await discussCommand([
      '--providers',
      'claude,gemini',
      '--rounds',
      '2',
      'Compare retained v14 CLI commands',
    ], defaultOptions({
      outputDir: tempDir,
      traceId: 'cli-discuss-trace',
    }));

    expect(discussResult.success).toBe(true);
    expect(discussResult.message).toContain('cli-discuss-trace');
    expect(discussResult.message).toContain('Warnings:');
    expect(discussResult.message).toContain('simulated provider output');

    const listResult = await traceCommand([], defaultOptions({
      outputDir: tempDir,
      limit: 5,
    }));
    expect(listResult.success).toBe(true);
    expect(listResult.message).toContain('cli-discuss-trace');

    const detailResult = await traceCommand(['cli-discuss-trace'], defaultOptions({ outputDir: tempDir }));
    expect(detailResult.success).toBe(true);
    expect(detailResult.message).toContain('Workflow: discuss');
    expect(detailResult.message).toContain('Status: completed');
  });

  it('runs quick and recursive discussion variants through the CLI surface', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const quick = await discussCommand([
      'quick',
      '--providers',
      'claude,gemini',
      'Summarize rollout strategy',
    ], defaultOptions({
      outputDir: tempDir,
      traceId: 'cli-discuss-quick-001',
    }));
    expect(quick.success).toBe(true);
    expect(quick.message).toContain('Discussion (quick) completed with trace cli-discuss-quick-001');

    const recursive = await discussCommand([
      'recursive',
      '--providers',
      'claude,gemini',
      '--subtopics',
      'Assess risk,Prepare validation',
      'Plan release rollout',
    ], defaultOptions({
      outputDir: tempDir,
      traceId: 'cli-discuss-recursive-001',
    }));
    expect(recursive.success).toBe(true);
    expect(recursive.message).toContain('Discussion (recursive) completed with trace cli-discuss-recursive-001');
    expect(recursive.message).toContain('Subtopics:');
    expect(recursive.message).toContain('Assess risk');

    const trace = await traceCommand(['cli-discuss-quick-001'], defaultOptions({ outputDir: tempDir }));
    expect(trace.success).toBe(true);
    expect(trace.message).toContain('Workflow: discuss.quick');
  });

  it('rejects unknown discussion flags instead of treating them as topic text', async () => {
    const result = await discussCommand([
      '--bogus',
      'value',
      'Compare release strategies',
    ], defaultOptions());

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown discuss flag: --bogus.');
  });

  it('analyzes a stored trace through the trace command', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await discussCommand([
      '--providers',
      'claude,gemini',
      '--rounds',
      '2',
      'Compare release strategies',
    ], defaultOptions({
      outputDir: tempDir,
      traceId: 'cli-trace-analysis-001',
    }));

    const result = await traceCommand(['analyze', 'cli-trace-analysis-001'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Trace analysis: cli-trace-analysis-001');
    expect(result.message).toContain('Steps: 1 total, 1 ok, 0 failed');
    expect(result.message).toContain('TRACE_HEALTHY');
    expect(result.data).toMatchObject({
      traceId: 'cli-trace-analysis-001',
      workflowId: 'discuss',
      status: 'completed',
      failedSteps: 0,
    });
  });

  it('surfaces runtime guard summaries in trace detail and analysis views', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'cli-trace-guard-001',
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
        sessionId: 'cli-guard-session-001',
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

    const detailResult = await traceCommand(['cli-trace-guard-001'], defaultOptions({ outputDir: tempDir }));
    expect(detailResult.success).toBe(true);
    expect(detailResult.message).toContain('Policy: Runtime governance blocked step "run-skill"');
    expect(detailResult.message).toContain('Policy tool: skill.run');
    expect(detailResult.message).toContain('Policy trust: implicit-local');
    expect(detailResult.message).toContain('Policy requires: trusted-id');

    const analysisResult = await traceCommand(['analyze', 'cli-trace-guard-001'], defaultOptions({ outputDir: tempDir }));
    expect(analysisResult.success).toBe(true);
    expect(analysisResult.message).toContain('Policy: Runtime governance blocked step "run-skill"');
    expect(analysisResult.message).toContain('RUNTIME_GOVERNANCE_BLOCK');
    expect(analysisResult.data).toMatchObject({
      traceId: 'cli-trace-guard-001',
      guard: {
        guardId: 'enforce-runtime-trust',
        toolName: 'skill.run',
        trustState: 'implicit-local',
      },
    });
  });

  it('lists traces for a correlated session through the trace command', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await discussCommand([
      '--providers',
      'claude,gemini',
      'Compare release strategies',
    ], defaultOptions({
      outputDir: tempDir,
      traceId: 'cli-session-trace-001',
      sessionId: 'cli-session-001',
    }));

    const result = await traceCommand(['by-session', 'cli-session-001'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('Session traces: cli-session-001');
    expect(result.message).toContain('cli-session-trace-001');
    expect(result.data).toMatchObject([
      {
        traceId: 'cli-session-trace-001',
        workflowId: 'discuss',
      },
    ]);
  });

  it('renders a trace tree through the trace command', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const runtime = createSharedRuntimeService({ basePath: tempDir });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'trace-root',
      workflowId: 'parallel.run',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-22T00:00:00.000Z',
      stepResults: [],
    });
    await runtime.getStores().traceStore.upsertTrace({
      traceId: 'trace-child',
      workflowId: 'agent.run',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-22T00:01:00.000Z',
      stepResults: [],
      metadata: {
        parentTraceId: 'trace-root',
        rootTraceId: 'trace-root',
      },
    });

    const result = await traceCommand(['tree', 'trace-child'], defaultOptions({ outputDir: tempDir }));

    expect(result.success).toBe(true);
    expect(result.message).toContain('trace-root parallel.run completed');
    expect(result.message).toContain('trace-child agent.run completed');
  });
});
