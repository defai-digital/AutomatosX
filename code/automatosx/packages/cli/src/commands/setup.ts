import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MCP_BASE_PATH_ENV_VAR } from '@defai.digital/mcp-server';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { migrateJsonToSqlite } from '@defai.digital/state-store';
import { migrateTraceJsonToSqlite } from '@defai.digital/trace-store';
import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success } from '../utils/formatters.js';
import { listProviderClientStatuses, type ProviderClientStatus } from '../utils/provider-detection.js';
import { isRecord, parseJsonObjectString } from '../utils/validation.js';
import { toDefaultAgentRegistrations } from '../agent-catalog.js';
import { bootstrapProjectWorkspace, parseProjectBootstrapFlags } from './project-bootstrap.js';

export interface SetupWorkspaceResult {
  basePath: string;
  automatosxDir: string;
  contextDir: string;
  runtimeDir: string;
  artifactDir: string;
  configPath: string;
  environmentPath: string;
  writtenFiles: string[];
  readyAgents: string[];
  registeredPolicies: string[];
  detectedProviders: ProviderClientStatus[];
}

const DEFAULT_AGENTS = toDefaultAgentRegistrations();

const DEFAULT_POLICIES = [
  {
    policyId: 'workflow-artifact-contract',
    name: 'Workflow Artifact Contract',
    enabled: true,
    metadata: {
      artifactDir: '.automatosx/workflows',
      traceDir: '.automatosx/runtime',
    },
  },
];

export async function ensureWorkspaceSetup(basePath: string, provider?: string, force = false): Promise<SetupWorkspaceResult> {
  const automatosxDir = join(basePath, '.automatosx');
  const contextDir = join(automatosxDir, 'context');
  const runtimeDir = join(automatosxDir, 'runtime');
  const artifactDir = join(automatosxDir, 'workflows');
  const configPath = join(automatosxDir, 'config.json');
  const environmentPath = join(automatosxDir, 'environment.json');

  await mkdir(contextDir, { recursive: true });
  await mkdir(runtimeDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });

  const writtenFiles: string[] = [];
  await writeJsonIfMissing(configPath, {
    schemaVersion: 1,
    productVersion: '14.0.0',
    defaultProvider: provider ?? 'claude',
    workflowArtifactDir: '.automatosx/workflows',
    runtimeStoreDir: '.automatosx/runtime',
    createdBy: 'ax setup',
  }, writtenFiles, force);

  const runtime = createSharedRuntimeService({ basePath });
  const readyAgents: string[] = [];
  for (const agent of DEFAULT_AGENTS) {
    const existing = await runtime.getAgent(agent.agentId);
    if (existing === undefined) {
      await runtime.registerAgent(agent);
    }
    readyAgents.push(agent.agentId);
  }

  const registeredPolicies: string[] = [];
  for (const policy of DEFAULT_POLICIES) {
    await runtime.registerPolicy(policy);
    registeredPolicies.push(policy.policyId);
  }

  const detectedProviders = listProviderClientStatuses();
  await writeFile(environmentPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedBy: 'ax setup',
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    mcp: {
      serverId: 'automatosx',
      transport: 'stdio',
      command: 'ax',
      args: ['mcp', 'serve'],
      env: {
        [MCP_BASE_PATH_ENV_VAR]: basePath,
      },
      toolPrefix: process.env.AX_MCP_TOOL_PREFIX ?? undefined,
    },
    providers: detectedProviders,
  }, null, 2)}\n`, 'utf8');

  return {
    basePath,
    automatosxDir,
    contextDir,
    runtimeDir,
    artifactDir,
    configPath,
    environmentPath,
    writtenFiles,
    readyAgents,
    registeredPolicies,
    detectedProviders,
  };
}

function parseSetupArgs(args: string[]): {
  force: boolean;
  migrateStorage: boolean;
  error?: string;
  flags: ReturnType<typeof parseProjectBootstrapFlags>['flags'];
} {
  const migrateStorage = args.includes('--migrate-storage');
  const bootstrapArgs = args.filter((arg) => arg !== '--migrate-storage');
  const parsed = parseProjectBootstrapFlags(bootstrapArgs, 'setup');
  return {
    force: parsed.flags.force,
    migrateStorage,
    error: parsed.error,
    flags: parsed.flags,
  };
}

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const CHECK = `${GREEN}\u2713${RESET}`;
const CROSS = `${RED}\u2717${RESET}`;
const WARN_ICON = `\x1b[33m\u26A0${RESET}`;

export async function setupCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const parsedArgs = parseSetupArgs(args);
  if (parsedArgs.error !== undefined) {
    return failure(parsedArgs.error);
  }

  const { force, migrateStorage, flags } = parsedArgs;
  const basePath = options.outputDir ?? process.cwd();
  const isJson = options.format === 'json';
  const out: string[] = [];

  if (!isJson) {
    out.push('');
    out.push(`${BOLD}AutomatosX Setup${RESET}`);
    out.push('');
  }

  // ── Step 1: System Check ───────────────────────────────────────────────────
  if (!isJson) {
    out.push(`${BOLD}Step 1: System Check${RESET}`);
    out.push(`  ${CHECK} Node.js: ${process.version}`);
    out.push(`  ${CHECK} Platform: ${process.platform}/${process.arch}`);
    out.push('');
  }

  // ── Step 2: Storage / Migration ────────────────────────────────────────────
  if (!isJson) out.push(`${BOLD}Step 2: Storage${RESET}`);

  const migrationLines: string[] = [];
  if (migrateStorage) {
    const [stateResult, traceResult] = await Promise.all([
      migrateJsonToSqlite({ basePath }),
      migrateTraceJsonToSqlite({ basePath }),
    ]);
    if (stateResult.skipped) {
      migrationLines.push(`State migration skipped: ${stateResult.reason}`);
      if (!isJson) out.push(`  ${WARN_ICON} State migration skipped: ${stateResult.reason}`);
    } else {
      migrationLines.push(`State migrated to SQLite: ${stateResult.memory} memory, ${stateResult.agents} agents, ${stateResult.sessions} sessions, ${stateResult.feedback} feedback, ${stateResult.semantic} semantic entries.`);
      if (!isJson) out.push(`  ${CHECK} State migrated to SQLite`);
    }
    if (traceResult.skipped) {
      migrationLines.push(`Trace migration skipped: ${traceResult.reason}`);
      if (!isJson) out.push(`  ${WARN_ICON} Trace migration skipped: ${traceResult.reason}`);
    } else {
      migrationLines.push(`Traces migrated to SQLite: ${traceResult.traces} records.`);
      if (!isJson) out.push(`  ${CHECK} Traces migrated to SQLite (${traceResult.traces} records)`);
    }
  } else {
    if (!isJson) out.push(`  ${CHECK} Storage backend: SQLite (WAL mode)`);
  }
  if (!isJson) out.push('');

  // ── Step 3: Workspace bootstrap ────────────────────────────────────────────
  if (!isJson) out.push(`${BOLD}Step 3: Workspace${RESET}`);

  const result = await ensureWorkspaceSetup(basePath, options.provider, force);

  if (!isJson) {
    out.push(`  ${CHECK} Directories: .automatosx/context, .automatosx/runtime, .automatosx/workflows`);
    if (result.writtenFiles.length > 0) {
      out.push(`  ${CHECK} Config written: ${result.writtenFiles.map((f) => f.replace(basePath + '/', '')).join(', ')}`);
    } else {
      out.push(`  ${CHECK} Config up to date`);
    }
    out.push(`  ${CHECK} Agents ready: ${result.readyAgents.join(', ')}`);
    out.push(`  ${CHECK} Policies registered: ${result.registeredPolicies.join(', ')}`);
    out.push('');
  }

  // ── Step 4: Provider Detection ─────────────────────────────────────────────
  const detectedCount = result.detectedProviders.filter((p) => p.installed).length;
  const detectedNames = result.detectedProviders.filter((p) => p.installed).map((p) => p.providerId);

  if (!isJson) {
    out.push(`${BOLD}Step 4: Provider Detection${RESET}`);
    for (const provider of result.detectedProviders) {
      const icon = provider.installed ? CHECK : `  ${DIM}-${RESET}`;
      const status = provider.installed ? 'detected' : 'not detected';
      out.push(`  ${icon} ${provider.providerId.padEnd(10)} ${status}`);
    }
    out.push(`  Detected provider clients: ${detectedNames.length > 0 ? detectedNames.join(', ') : 'none'}`);
    out.push('');
  }

  // ── Step 5: Project Bootstrap ─────────────────────────────────────────────
  if (!isJson) out.push(`${BOLD}Step 5: Project Bootstrap${RESET}`);

  const project = await bootstrapProjectWorkspace(basePath, result, flags);
  const enabledProviders = project.providers.filter((entry) => entry.enabled).map((entry) => entry.providerId);

  if (!isJson) {
    out.push(`  ${project.agentsMdWritten ? CHECK : `${CHECK} ${DIM}(updated)${RESET}`} AGENTS.md`);
    out.push(`  ${project.conventionsWritten ? CHECK : `${CHECK} ${DIM}(updated)${RESET}`} .automatosx/context/conventions.md`);
    out.push(`  ${project.rulesWritten ? CHECK : `${CHECK} ${DIM}(updated)${RESET}`} .automatosx/context/rules.md`);
    out.push(`  ${CHECK} .automatosx/mcp.json ${DIM}(${project.tools.length} tools)${RESET}`);
    out.push(`  ${CHECK} Provider integration files: ${enabledProviders.length > 0 ? enabledProviders.join(', ') : 'none'}`);
    out.push('');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (!isJson) {
    out.push(`${BOLD}Summary${RESET}`);
    out.push(`  Providers detected: ${detectedCount}/${result.detectedProviders.length}`);
    out.push(`  MCP registered: ${enabledProviders.length} provider(s)`);
    out.push(`  Default provider: ${options.provider ?? 'claude'}`);
    out.push(`  Workspace: ${result.automatosxDir}`);
    out.push('');
    out.push(`${BOLD}Next Steps${RESET}`);
    out.push(`  1. Edit ${CYAN}AGENTS.md${RESET}, ${CYAN}.automatosx/context/rules.md${RESET}, and ${CYAN}.automatosx/context/conventions.md${RESET} as needed`);
    out.push(`  2. Run ${CYAN}ax doctor${RESET} to verify providers are working`);
    out.push('');
  }

  if (isJson) {
    return success('', {
      ...result,
      ...project,
    });
  }

  return success(out.join('\n'), {
    ...result,
    ...project,
  });
}

async function writeJsonIfMissing(
  filePath: string,
  value: unknown,
  writtenFiles: string[],
  force = false,
): Promise<void> {
  if (await exists(filePath)) {
    if (force) {
      await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      writtenFiles.push(filePath);
      return;
    }
    // Merge any top-level keys from value that are absent in the existing file
    if (isRecord(value)) {
      try {
        const existing = parseJsonObjectString(await readFile(filePath, 'utf8'));
        if (existing.error !== undefined) {
          return;
        }
        const additions = Object.fromEntries(
          Object.entries(value).filter(([k]) => !(k in existing.value)),
        );
        if (Object.keys(additions).length > 0) {
          await writeFile(filePath, `${JSON.stringify({ ...existing.value, ...additions }, null, 2)}\n`, 'utf8');
          writtenFiles.push(filePath);
        }
      } catch {
        // leave file as-is on read/parse error
      }
    }
    return;
  }

  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  writtenFiles.push(filePath);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
