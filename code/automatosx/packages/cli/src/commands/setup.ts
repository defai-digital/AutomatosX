import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import { migrateJsonToSqlite } from '@defai.digital/state-store';
import { migrateTraceJsonToSqlite } from '@defai.digital/trace-store';
import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success } from '../utils/formatters.js';
import { listProviderClientStatuses, type ProviderClientStatus } from '../utils/provider-detection.js';
import { toDefaultAgentRegistrations } from '../agent-catalog.js';
import { buildAxMcpRuntimeConfig } from '../ax-mcp-config.js';
import { bootstrapProjectWorkspace, parseProjectBootstrapFlags } from './project-bootstrap.js';
import { getProductSurfaceSummaryData } from '../product-surface-summary.js';
import { renderSetupReport, writeJsonIfMissing } from './setup-support.js';

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
const PRODUCT_SURFACE = getProductSurfaceSummaryData();

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
      ...buildAxMcpRuntimeConfig(basePath),
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

export async function setupCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const parsedArgs = parseSetupArgs(args);
  if (parsedArgs.error !== undefined) {
    return failure(parsedArgs.error);
  }

  const { force, migrateStorage, flags } = parsedArgs;
  const basePath = options.outputDir ?? process.cwd();
  const isJson = options.format === 'json';

  const migration: {
    stateSkipped?: string;
    stateMigrated?: string;
    traceSkipped?: string;
    traceMigrated?: string;
  } = {};

  if (migrateStorage) {
    const [stateResult, traceResult] = await Promise.all([
      migrateJsonToSqlite({ basePath }),
      migrateTraceJsonToSqlite({ basePath }),
    ]);

    if (stateResult.skipped) {
      migration.stateSkipped = stateResult.reason;
    } else {
      migration.stateMigrated = String(stateResult.agents);
    }

    if (traceResult.skipped) {
      migration.traceSkipped = traceResult.reason;
    } else {
      migration.traceMigrated = String(traceResult.traces);
    }
  }

  const workspace = await ensureWorkspaceSetup(basePath, options.provider, force);
  const project = await bootstrapProjectWorkspace(basePath, workspace, flags);

  if (isJson) {
    return success('', {
      ...workspace,
      ...project,
    });
  }

  return success(renderSetupReport({
    basePath,
    provider: options.provider,
    migrateStorage,
    workspace,
    project,
    productSurface: PRODUCT_SURFACE,
    migration,
  }), {
    ...workspace,
    ...project,
  });
}
