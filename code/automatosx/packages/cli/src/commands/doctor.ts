import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMcpServerSurface } from '@defai.digital/mcp-server';
import { createSharedRuntimeService } from '@defai.digital/shared-runtime';
import type { CLIOptions, CommandResult } from '../types.js';
import { failure, success } from '../utils/formatters.js';

type DoctorStatus = 'ok' | 'warn' | 'fail';

interface DoctorCheck {
  id: string;
  status: DoctorStatus;
  message: string;
}

interface DoctorSummary {
  ok: number;
  warn: number;
  fail: number;
}

interface WorkspaceConfig {
  workflowArtifactDir?: string;
  runtimeStoreDir?: string;
  defaultProvider?: string;
}

interface ProviderSummary {
  providers?: Array<{
    providerId?: string;
    enabled?: boolean;
    installed?: boolean;
    paths?: string[];
  }>;
}

const REQUIRED_MCP_TOOLS = ['workflow.run', 'trace.list', 'agent.list'];

export async function doctorCommand(_args: string[], options: CLIOptions): Promise<CommandResult> {
  const basePath = options.outputDir ?? process.cwd();
  const runtime = createSharedRuntimeService({ basePath });
  const checks: DoctorCheck[] = [];
  const automatosxDir = join(basePath, '.automatosx');
  const configPath = join(automatosxDir, 'config.json');
  const localMcpPath = join(automatosxDir, 'mcp.json');
  const claudeMcpPath = join(basePath, '.mcp.json');
  const axMdPath = join(basePath, 'AX.md');
  const providerSummaryPath = join(automatosxDir, 'providers.json');

  const basePathReady = await canAccess(basePath, constants.R_OK | constants.W_OK);
  checks.push({
    id: 'base-path',
    status: basePathReady ? 'ok' : 'fail',
    message: basePathReady
      ? `Base path is readable and writable (${basePath}).`
      : `Base path is not readable and writable (${basePath}).`,
  });

  if (!basePathReady) {
    return failure(renderDoctorReport(basePath, checks, summarizeChecks(checks)), {
      basePath,
      status: 'unhealthy',
      checks,
      summary: summarizeChecks(checks),
    });
  }

  const config = await readJsonFile<WorkspaceConfig>(configPath);
  if (config === undefined) {
    checks.push({
      id: 'workspace-config',
      status: 'fail',
      message: `Missing or invalid workspace config at ${configPath}. Run "ax setup".`,
    });
  } else if (typeof config.workflowArtifactDir !== 'string' || typeof config.runtimeStoreDir !== 'string') {
    checks.push({
      id: 'workspace-config',
      status: 'fail',
      message: `Workspace config is missing required paths in ${configPath}. Run "ax setup" again.`,
    });
  } else {
    checks.push({
      id: 'workspace-config',
      status: 'ok',
      message: `Workspace config loaded (${config.defaultProvider ?? 'no default provider set'}).`,
    });

    const runtimeDirReady = await canAccess(join(basePath, config.runtimeStoreDir), constants.R_OK | constants.W_OK);
    checks.push({
      id: 'runtime-dir',
      status: runtimeDirReady ? 'ok' : 'fail',
      message: runtimeDirReady
        ? `Runtime store directory is accessible (${config.runtimeStoreDir}).`
        : `Runtime store directory is missing or not writable (${config.runtimeStoreDir}). Run "ax setup".`,
    });

    const artifactDirReady = await canAccess(join(basePath, config.workflowArtifactDir), constants.R_OK | constants.W_OK);
    checks.push({
      id: 'artifact-dir',
      status: artifactDirReady ? 'ok' : 'fail',
      message: artifactDirReady
        ? `Workflow artifact directory is accessible (${config.workflowArtifactDir}).`
        : `Workflow artifact directory is missing or not writable (${config.workflowArtifactDir}). Run "ax setup".`,
    });
  }

  const initArtifacts = [
    { label: 'AX.md', path: axMdPath },
    { label: '.automatosx/mcp.json', path: localMcpPath },
    { label: '.mcp.json', path: claudeMcpPath },
  ];
  const missingInitArtifacts: string[] = [];
  for (const artifact of initArtifacts) {
    if (!(await canAccess(artifact.path, constants.R_OK))) {
      missingInitArtifacts.push(artifact.label);
    }
  }
  checks.push({
    id: 'init-artifacts',
    status: missingInitArtifacts.length === 0 ? 'ok' : 'warn',
    message: missingInitArtifacts.length === 0
      ? 'Project init artifacts are present.'
      : `Project init artifacts are incomplete (${missingInitArtifacts.join(', ')}). Run "ax init".`,
  });

  const providerSummary = await readJsonFile<ProviderSummary>(providerSummaryPath);
  if (providerSummary === undefined || !Array.isArray(providerSummary.providers)) {
    checks.push({
      id: 'provider-summary',
      status: 'warn',
      message: 'Provider integration summary is missing or invalid (.automatosx/providers.json). Run "ax init".',
    });
  } else {
    const enabledProviders = providerSummary.providers.filter((provider) => provider.enabled === true);
    checks.push({
      id: 'provider-summary',
      status: 'ok',
      message: enabledProviders.length > 0
        ? `Provider integration summary loaded (${enabledProviders.length} enabled provider integration${enabledProviders.length === 1 ? '' : 's'}).`
        : 'Provider integration summary loaded (all provider integrations currently skipped).',
    });

    const missingProviderArtifacts: string[] = [];
    const installedButNotEnabled: string[] = [];

    for (const provider of providerSummary.providers) {
      if (provider.installed === true && provider.enabled !== true) {
        installedButNotEnabled.push(provider.providerId ?? 'unknown');
      }

      if (provider.enabled !== true) {
        continue;
      }

      const paths = Array.isArray(provider.paths) ? provider.paths : [];
      for (const artifactPath of paths) {
        if (!(await canAccess(artifactPath, constants.R_OK))) {
          missingProviderArtifacts.push(`${provider.providerId ?? 'unknown'}:${artifactPath}`);
        }
      }
    }

    const providerArtifactIssues = [
      ...(missingProviderArtifacts.length > 0 ? [`missing artifacts: ${missingProviderArtifacts.join(', ')}`] : []),
      ...(installedButNotEnabled.length > 0 ? [`installed but skipped: ${installedButNotEnabled.join(', ')}`] : []),
    ];

    checks.push({
      id: 'provider-artifacts',
      status: providerArtifactIssues.length === 0 ? 'ok' : 'warn',
      message: providerArtifactIssues.length === 0
        ? 'Provider integration artifacts are present for all enabled providers.'
        : `Provider integration drift detected (${providerArtifactIssues.join('; ')}). Re-run "ax init" or adjust skip flags.`,
    });
  }

  try {
    const [agents, policies, traces, workflows] = await Promise.all([
      runtime.listAgents(),
      runtime.listPolicies(),
      runtime.listTraces(options.limit ?? 5),
      runtime.listWorkflows({
        workflowDir: options.workflowDir,
        basePath,
      }),
    ]);

    checks.push({
      id: 'shared-runtime',
      status: 'ok',
      message: 'Shared runtime service is reachable.',
    });

    checks.push({
      id: 'agents',
      status: agents.length > 0 ? 'ok' : 'fail',
      message: agents.length > 0
        ? `Agent registry is populated (${agents.length} agents).`
        : 'Agent registry is empty. Run "ax setup".',
    });

    checks.push({
      id: 'policies',
      status: policies.length > 0 ? 'ok' : 'fail',
      message: policies.length > 0
        ? `Policy registry is populated (${policies.length} policies).`
        : 'Policy registry is empty. Run "ax setup".',
    });

    checks.push({
      id: 'traces',
      status: traces.length > 0 ? 'ok' : 'warn',
      message: traces.length > 0
        ? `Trace store is readable (${traces.length} recent trace${traces.length === 1 ? '' : 's'} found).`
        : 'Trace store is readable but has no traces yet.',
    });

    checks.push({
      id: 'workflows',
      status: workflows.length > 0 ? 'ok' : 'fail',
      message: workflows.length > 0
        ? `Workflow discovery succeeded (${workflows.length} workflow${workflows.length === 1 ? '' : 's'} found).`
        : 'No workflows discovered. Pass --workflow-dir <path> or add a workflows directory.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      id: 'shared-runtime',
      status: 'fail',
      message: `Shared runtime checks failed: ${message}`,
    });
  }

  try {
    const tools = createMcpServerSurface({ basePath }).listTools();
    const missingTools = REQUIRED_MCP_TOOLS.filter((toolName) => !tools.includes(toolName));
    checks.push({
      id: 'mcp-surface',
      status: missingTools.length === 0 ? 'ok' : 'fail',
      message: missingTools.length === 0
        ? `MCP surface is available (${tools.length} tools).`
        : `MCP surface is missing required tools (${missingTools.join(', ')}).`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      id: 'mcp-surface',
      status: 'fail',
      message: `MCP surface check failed: ${message}`,
    });
  }

  const summary = summarizeChecks(checks);
  const overallStatus = summary.fail > 0 ? 'unhealthy' : summary.warn > 0 ? 'warning' : 'healthy';
  const report = renderDoctorReport(basePath, checks, summary);
  const data = {
    basePath,
    status: overallStatus,
    checks,
    summary,
  };

  return summary.fail > 0 ? failure(report, data) : success(report, data);
}

async function canAccess(path: string, mode: number): Promise<boolean> {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function summarizeChecks(checks: DoctorCheck[]): DoctorSummary {
  return checks.reduce<DoctorSummary>((summary, check) => {
    summary[check.status] += 1;
    return summary;
  }, { ok: 0, warn: 0, fail: 0 });
}

function renderDoctorReport(basePath: string, checks: DoctorCheck[], summary: DoctorSummary): string {
  const overallStatus = summary.fail > 0 ? 'unhealthy' : summary.warn > 0 ? 'warning' : 'healthy';
  return [
    'AutomatosX Doctor',
    `Base path: ${basePath}`,
    `Overall status: ${overallStatus}`,
    `Summary: ${summary.ok} ok, ${summary.warn} warning${summary.warn === 1 ? '' : 's'}, ${summary.fail} failure${summary.fail === 1 ? '' : 's'}`,
    '',
    ...checks.map((check) => `[${check.status.toUpperCase()}] ${check.message}`),
  ].join('\n');
}
