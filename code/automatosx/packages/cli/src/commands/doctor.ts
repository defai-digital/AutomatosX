import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { createMcpServerSurface, STABLE_V15_MCP_TOOL_FAMILIES } from '@defai.digital/mcp-server';
import type { CLIOptions, CommandResult } from '../types.js';
import { listDefaultAgentCatalog } from '../agent-catalog.js';
import { readJsonObjectFile } from '../json-object-file.js';
import { createRuntime, failure, resolveCliBasePath, success, usageError } from '../utils/formatters.js';
import {
  buildCliGovernanceSnapshot,
  createEmptyCliGovernanceSnapshot,
  formatCliGovernanceWarningSummary,
  hasCliGovernanceWarnings,
  type DeniedInstalledBridgeAggregate,
  type RuntimeGovernanceAggregate,
} from '../utils/runtime-guard-summary.js';
import { isBundledWorkflowDir, resolveEffectiveWorkflowDir } from '../workflow-paths.js';
import {
  buildDoctorCommandData,
  type DoctorCheck,
  type DoctorCommandData,
  getProviderChecks,
  renderDoctorReport,
  summarizeDoctorChecks,
} from './doctor-support.js';

export type { DoctorCommandData } from './doctor-support.js';
export { buildDoctorCommandData } from './doctor-support.js';

async function canAccess(path: string, mode = constants.R_OK | constants.W_OK): Promise<boolean> {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

export async function doctorCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  if (args[0] !== undefined) {
    return args[0].startsWith('--')
      ? failure(`Unknown doctor flag: ${args[0]}.`)
      : usageError('ax doctor');
  }

  const basePath = resolveCliBasePath(options);
  const runtime = createRuntime(options);
  const workflowDir = resolveEffectiveWorkflowDir({
    workflowDir: options.workflowDir,
    basePath,
  });
  const checks: DoctorCheck[] = [];
  const automatosxDir = join(basePath, '.automatosx');
  const configPath = join(automatosxDir, 'config.json');
  const environmentPath = join(automatosxDir, 'environment.json');
  const localMcpPath = join(automatosxDir, 'mcp.json');
  const agentsMdPath = join(basePath, 'AGENTS.md');
  const providerSummaryPath = join(automatosxDir, 'providers.json');
  const emptyGovernanceSnapshot = createEmptyCliGovernanceSnapshot();
  let governance = emptyGovernanceSnapshot.governance;
  let deniedInstalledBridges: DeniedInstalledBridgeAggregate = emptyGovernanceSnapshot.deniedInstalledBridges;

  const basePathReady = await canAccess(basePath);
  checks.push({
    id: 'base-path',
    status: basePathReady ? 'ok' : 'fail',
    message: basePathReady
      ? `Base path is readable and writable (${basePath}).`
      : `Base path is not readable and writable (${basePath}).`,
  });

  if (!basePathReady) {
    const summary = summarizeDoctorChecks(checks);
    return failure(renderDoctorReport(basePath, checks, summary), {
      basePath,
      status: 'unhealthy',
      checks,
      summary,
    });
  }

  checks.push(...(await getProviderChecks(environmentPath)));

  const config = await readJsonObjectFile(configPath);
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

    const runtimeDirReady = await canAccess(join(basePath, config.runtimeStoreDir));
    checks.push({
      id: 'runtime-dir',
      status: runtimeDirReady ? 'ok' : 'fail',
      message: runtimeDirReady
        ? `Runtime store directory is accessible (${config.runtimeStoreDir}).`
        : `Runtime store directory is missing or not writable (${config.runtimeStoreDir}). Run "ax setup".`,
    });

    const artifactDirReady = await canAccess(join(basePath, config.workflowArtifactDir));
    checks.push({
      id: 'artifact-dir',
      status: artifactDirReady ? 'ok' : 'fail',
      message: artifactDirReady
        ? `Workflow artifact directory is accessible (${config.workflowArtifactDir}).`
        : `Workflow artifact directory is missing or not writable (${config.workflowArtifactDir}). Run "ax setup".`,
    });
  }

  const initArtifacts = [
    { label: 'AGENTS.md', path: agentsMdPath },
    { label: '.automatosx/mcp.json', path: localMcpPath },
  ];
  const missingInitArtifacts = (
    await Promise.all(initArtifacts.map(async (artifact) => ({ ...artifact, ok: await canAccess(artifact.path, constants.R_OK) })))
  ).filter((artifact) => !artifact.ok).map((artifact) => artifact.label);

  checks.push({
    id: 'init-artifacts',
    status: missingInitArtifacts.length === 0 ? 'ok' : 'warn',
    message: missingInitArtifacts.length === 0
      ? 'Stable bootstrap artifacts are present (AGENTS.md and .automatosx/mcp.json).'
      : `Stable bootstrap artifacts are incomplete (${missingInitArtifacts.join(', ')}). Run "ax setup".`,
  });

  const providerSummary = await readJsonObjectFile(providerSummaryPath);
  const summaryProviders = Array.isArray(providerSummary?.providers) ? providerSummary.providers as Array<{
    providerId?: string; enabled?: boolean; installed?: boolean; paths?: string[];
  }> : undefined;

  if (summaryProviders === undefined) {
    checks.push({
      id: 'provider-summary',
      status: 'warn',
      message: 'Provider integration summary is missing or invalid (.automatosx/providers.json). Run "ax setup".',
    });
  } else {
    const enabledProviders = summaryProviders.filter((provider) => provider.enabled === true);
    checks.push({
      id: 'provider-summary',
      status: 'ok',
      message: enabledProviders.length > 0
        ? `Provider integration summary loaded (${enabledProviders.length} enabled provider integration${enabledProviders.length === 1 ? '' : 's'}).`
        : 'Provider integration summary loaded (all provider integrations currently skipped).',
    });

    const missingArtifacts: string[] = [];
    const installedButNotEnabled: string[] = [];
    for (const provider of summaryProviders) {
      if (provider.installed === true && provider.enabled !== true) {
        installedButNotEnabled.push(provider.providerId ?? 'unknown');
      }
      if (provider.enabled !== true) continue;
      for (const artifactPath of Array.isArray(provider.paths) ? provider.paths : []) {
        if (!(await canAccess(artifactPath, constants.R_OK))) {
          missingArtifacts.push(`${provider.providerId ?? 'unknown'}:${artifactPath}`);
        }
      }
    }

    const issues = [
      ...(missingArtifacts.length > 0 ? [`missing artifacts: ${missingArtifacts.join(', ')}`] : []),
      ...(installedButNotEnabled.length > 0 ? [`installed but skipped: ${installedButNotEnabled.join(', ')}`] : []),
    ];
    checks.push({
      id: 'provider-artifacts',
      status: issues.length === 0 ? 'ok' : 'warn',
      message: issues.length === 0
        ? 'Provider integration artifacts are present for all enabled providers.'
        : `Provider integration drift detected (${issues.join('; ')}). Re-run "ax setup" or adjust skip flags.`,
    });
  }

  try {
    const [agents, policies, traces, workflows, runtimeStatus] = await Promise.all([
      runtime.listAgents(),
      runtime.listPolicies(),
      runtime.listTraces(options.limit ?? 5),
      runtime.listWorkflows({ workflowDir, basePath }),
      runtime.getStatus({ limit: options.limit ?? 5 }),
    ]);

    checks.push({ id: 'shared-runtime', status: 'ok', message: 'Shared runtime service is reachable.' });
    checks.push({
      id: 'agents',
      status: agents.length > 0 ? 'ok' : 'warn',
      message: agents.length > 0
        ? `Agent registry is populated (${agents.length} agents).`
        : `Runtime agent registry is empty. The built-in stable catalog still exposes ${listDefaultAgentCatalog().length} agents for discovery, but direct agent execution and MCP agent tools require "ax setup".`,
    });
    checks.push({
      id: 'policies',
      status: policies.length > 0 ? 'ok' : 'fail',
      message: policies.length > 0 ? `Policy registry is populated (${policies.length} policies).` : 'Policy registry is empty. Run "ax setup".',
    });
    checks.push({
      id: 'traces',
      status: traces.length > 0 ? 'ok' : 'warn',
      message: traces.length > 0
        ? `Trace store is readable (${traces.length} recent trace${traces.length === 1 ? '' : 's'} found).`
        : 'Trace store is readable but has no traces yet.',
    });
    const governanceSnapshot = await buildCliGovernanceSnapshot(basePath, runtimeStatus.recentFailedTraces);
    governance = governanceSnapshot.governance;
    deniedInstalledBridges = governanceSnapshot.deniedInstalledBridges;
    const hasGovernanceWarnings = hasCliGovernanceWarnings(governanceSnapshot);
    checks.push({
      id: 'runtime-governance',
      status: hasGovernanceWarnings ? 'warn' : 'ok',
      message: hasGovernanceWarnings
        ? (formatCliGovernanceWarningSummary(governanceSnapshot) ?? 'Runtime governance warnings detected.')
        : 'No recent runtime-governance blocks detected in failed traces, imported skills, or installed bridges.',
    });
    checks.push({
      id: 'workflows',
      status: workflows.length > 0 ? 'ok' : 'fail',
      message: workflows.length > 0
        ? `Workflow discovery succeeded (${workflows.length} workflow${workflows.length === 1 ? '' : 's'} found${isBundledWorkflowDir(workflowDir) ? ' from the bundled workflow catalog' : ''}).`
        : 'No workflows discovered. Pass --workflow-dir <path>, add a workflows directory, or use the bundled workflow catalog.',
    });
  } catch (error) {
    checks.push({
      id: 'shared-runtime',
      status: 'fail',
      message: `Shared runtime checks failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  try {
    const tools = createMcpServerSurface({ basePath }).listTools();
    const missingTools = STABLE_V15_MCP_TOOL_FAMILIES.filter((toolName) => !tools.includes(toolName));
    checks.push({
      id: 'mcp-surface',
      status: missingTools.length === 0 ? 'ok' : 'fail',
      message: missingTools.length === 0
        ? `MCP surface is available (${tools.length} tools; stable workflow-first contract present).`
        : `MCP surface is missing stable workflow-first tools (${missingTools.join(', ')}).`,
    });
  } catch (error) {
    checks.push({
      id: 'mcp-surface',
      status: 'fail',
      message: `MCP surface check failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const summary = summarizeDoctorChecks(checks);
  const overallStatus = summary.fail > 0 ? 'unhealthy' : summary.warn > 0 ? 'warning' : 'healthy';
  const report = renderDoctorReport(basePath, checks, summary);
  const data: DoctorCommandData = buildDoctorCommandData({
    basePath,
    status: overallStatus,
    checks,
    summary,
    governance,
    deniedInstalledBridges,
  });

  return summary.fail > 0 ? failure(report, data) : success(report, data);
}
