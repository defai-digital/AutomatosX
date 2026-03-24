import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { migrateJsonToSqlite } from '@defai.digital/state-store';
import { migrateTraceJsonToSqlite } from '@defai.digital/trace-store';
import type { CLIOptions, CommandResult } from '../types.js';
import { success } from '../utils/formatters.js';
import { listProviderClientStatuses, type ProviderClientStatus } from '../utils/provider-detection.js';

export interface SetupWorkspaceResult {
  basePath: string;
  automatosxDir: string;
  contextDir: string;
  runtimeDir: string;
  artifactDir: string;
  configPath: string;
  environmentPath: string;
  writtenFiles: string[];
  registeredAgents: string[];
  registeredPolicies: string[];
  detectedProviders: ProviderClientStatus[];
}

const DEFAULT_AGENTS = [
  {
    agentId: 'architect',
    name: 'Architect',
    capabilities: ['adr', 'architecture', 'planning'],
  },
  {
    agentId: 'quality',
    name: 'Quality',
    capabilities: ['bug-hunting', 'qa', 'review'],
  },
  {
    agentId: 'bug-hunter',
    name: 'Bug Hunter',
    capabilities: ['debugging', 'regression-analysis'],
  },
  {
    agentId: 'release-manager',
    name: 'Release Manager',
    capabilities: ['changelog', 'release', 'rollout'],
  },
];

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

export async function ensureWorkspaceSetup(basePath: string, provider?: string): Promise<SetupWorkspaceResult> {
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
  }, writtenFiles);

  const runtime = createSharedRuntimeService({ basePath });
  const registeredAgents: string[] = [];
  for (const agent of DEFAULT_AGENTS) {
    await runtime.registerAgent(agent);
    registeredAgents.push(agent.agentId);
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
    registeredAgents,
    registeredPolicies,
    detectedProviders,
  };
}

export async function setupCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const basePath = options.outputDir ?? process.cwd();

  // --migrate-storage: import legacy JSON data into SQLite before setup continues
  const migrateStorage = args.includes('--migrate-storage');
  const migrationLines: string[] = [];
  if (migrateStorage) {
    const [stateResult, traceResult] = await Promise.all([
      migrateJsonToSqlite({ basePath }),
      migrateTraceJsonToSqlite({ basePath }),
    ]);
    if (stateResult.skipped) {
      migrationLines.push(`State migration skipped: ${stateResult.reason}`);
    } else {
      migrationLines.push(`State migrated to SQLite: ${stateResult.memory} memory, ${stateResult.agents} agents, ${stateResult.sessions} sessions, ${stateResult.feedback} feedback, ${stateResult.semantic} semantic entries.`);
    }
    if (traceResult.skipped) {
      migrationLines.push(`Trace migration skipped: ${traceResult.reason}`);
    } else {
      migrationLines.push(`Traces migrated to SQLite: ${traceResult.traces} records.`);
    }
  }

  const result = await ensureWorkspaceSetup(basePath, options.provider);

  const lines = [
    `Workspace setup completed in ${result.automatosxDir}.`,
    `Storage backend: SQLite (WAL mode).`,
    `Registered agents: ${result.registeredAgents.join(', ')}.`,
    `Registered policies: ${result.registeredPolicies.join(', ')}.`,
    `Detected provider clients: ${formatDetectedProviders(result.detectedProviders)}.`,
    `Wrote environment baseline: ${result.environmentPath}.`,
    ...migrationLines,
  ];

  return success(lines.join('\n'), result);
}

function formatDetectedProviders(providers: ProviderClientStatus[]): string {
  const installed = providers.filter((provider) => provider.installed).map((provider) => provider.providerId);
  return installed.length > 0 ? installed.join(', ') : 'none';
}

async function writeJsonIfMissing(
  filePath: string,
  value: unknown,
  writtenFiles: string[],
): Promise<void> {
  if (await exists(filePath)) {
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
