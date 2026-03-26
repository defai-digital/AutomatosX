import { constants } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createMcpServerSurface } from '@defai.digital/mcp-server';
import type { CLIOptions, CommandResult } from '../types.js';
import { listDefaultAgentCatalog } from '../agent-catalog.js';
import { createRuntime, failure, resolveCliBasePath, success, usageError } from '../utils/formatters.js';
import { PROVIDER_CLIENT_IDS, PROVIDER_CLIENT_COMMANDS, type ProviderClientId } from '../utils/provider-detection.js';
import {
  buildDeniedImportedSkillAggregate,
  buildRuntimeGovernanceAggregate,
  type RuntimeGovernanceAggregate,
} from '../utils/runtime-guard-summary.js';
import { parseJsonObjectString } from '../utils/validation.js';
import { isBundledWorkflowDir, resolveEffectiveWorkflowDir } from '../workflow-paths.js';

// ============================================================================
// Types
// ============================================================================

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

export interface DoctorCommandData {
  basePath: string;
  status: 'healthy' | 'warning' | 'unhealthy';
  checks: DoctorCheck[];
  summary: DoctorSummary;
  governance: RuntimeGovernanceAggregate;
}

export function buildDoctorCommandData(input: {
  basePath: string;
  status: 'healthy' | 'warning' | 'unhealthy';
  checks: Array<{ id: string; status: 'ok' | 'warn' | 'fail'; message: string }>;
  summary: { ok: number; warn: number; fail: number };
  governance: RuntimeGovernanceAggregate;
}): DoctorCommandData {
  return {
    basePath: input.basePath,
    status: input.status,
    checks: input.checks,
    summary: input.summary,
    governance: input.governance,
  };
}

// ============================================================================
// Constants
// ============================================================================

const REQUIRED_MCP_TOOLS = ['workflow_run', 'trace_list', 'agent_list'];
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';

const PROVIDER_META: Record<ProviderClientId, { name: string; installHint: string }> = {
  claude: { name: 'Claude', installHint: 'npm install -g @anthropic-ai/claude-code' },
  gemini: { name: 'Gemini', installHint: 'npm install -g @google/gemini-cli' },
  codex: { name: 'Codex', installHint: 'npm install -g @openai/codex' },
  grok: { name: 'Grok', installHint: 'npm install -g ax-grok' },
  cursor: { name: 'Cursor', installHint: 'Install from https://cursor.com' },
};

// ============================================================================
// Provider CLI helpers
// ============================================================================

interface CachedProviderStatus {
  providerId?: string;
  cli?: string;
  installed?: boolean;
}

function createProviderStatusMap(
  providers: CachedProviderStatus[],
): Record<ProviderClientId, CachedProviderStatus> {
  const statusMap = {} as Record<ProviderClientId, CachedProviderStatus>;

  for (const providerId of PROVIDER_CLIENT_IDS) {
    statusMap[providerId] = {
      providerId,
      cli: PROVIDER_CLIENT_COMMANDS[providerId],
      installed: false,
    };
  }

  for (const provider of providers) {
    const providerId = typeof provider.providerId === 'string' ? provider.providerId : undefined;
    if (providerId === undefined || !PROVIDER_CLIENT_IDS.includes(providerId as ProviderClientId)) {
      continue;
    }
    statusMap[providerId as ProviderClientId] = {
      providerId,
      cli: typeof provider.cli === 'string' ? provider.cli : PROVIDER_CLIENT_COMMANDS[providerId as ProviderClientId],
      installed: provider.installed === true,
    };
  }

  return statusMap;
}

function getOverrideAvailableClients(): Set<ProviderClientId> | undefined {
  const override = process.env.AUTOMATOSX_AVAILABLE_CLIENTS ?? process.env.AUTOMATOSX_INIT_AVAILABLE_CLIENTS;
  if (typeof override !== 'string' || override.trim().length === 0) return undefined;
  const ids = new Set(
    override.split(',').map((s) => s.trim()).filter((s): s is ProviderClientId => PROVIDER_CLIENT_IDS.includes(s as ProviderClientId)),
  );
  return ids;
}

function createOverrideProviderChecks(overrideClients: Set<ProviderClientId>): DoctorCheck[] {
  return PROVIDER_CLIENT_IDS.map((id) => {
    const command = PROVIDER_CLIENT_COMMANDS[id];
    const meta = PROVIDER_META[id];
    return {
      id: `provider-${id}`,
      status: overrideClients.has(id) ? 'ok' : 'warn',
      message: overrideClients.has(id)
        ? `${meta.name} CLI (${command}): detected`
        : `${meta.name} CLI (${command}): not detected`,
    };
  });
}

function createCachedProviderChecks(providerStatuses: Record<ProviderClientId, CachedProviderStatus>): DoctorCheck[] {
  return PROVIDER_CLIENT_IDS.map((id) => {
    const meta = PROVIDER_META[id];
    const provider = providerStatuses[id];
    const command = provider.cli ?? PROVIDER_CLIENT_COMMANDS[id];

    return {
      id: `provider-${id}`,
      status: provider.installed === true ? 'ok' : 'warn',
      message: provider.installed === true
        ? `${meta.name} CLI (${command}): available (cached environment baseline).`
        : `${meta.name} CLI (${command}): not installed in cached environment baseline — ${meta.installHint}`,
    };
  });
}

function createMissingProviderBaselineCheck(environmentPath: string): DoctorCheck {
  return {
    id: 'provider-baseline',
    status: 'warn',
    message: `Provider environment baseline is missing or invalid (${environmentPath}). Run "ax setup".`,
  };
}

async function getProviderChecks(environmentPath: string): Promise<DoctorCheck[]> {
  const overrideClients = getOverrideAvailableClients();
  if (overrideClients !== undefined) {
    return createOverrideProviderChecks(overrideClients);
  }

  const environment = await readJsonFile(environmentPath);
  const providers = Array.isArray(environment?.providers)
    ? environment.providers as CachedProviderStatus[]
    : undefined;
  if (providers === undefined) {
    return [createMissingProviderBaselineCheck(environmentPath)];
  }

  return createCachedProviderChecks(createProviderStatusMap(providers));
}

// ============================================================================
// Workspace helpers
// ============================================================================

async function canAccess(path: string, mode = constants.R_OK | constants.W_OK): Promise<boolean> {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = parseJsonObjectString(raw);
    return parsed.error === undefined ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Rendering
// ============================================================================

function statusIcon(status: DoctorStatus): string {
  if (status === 'ok') return `${GREEN}\u2713${RESET}`;
  if (status === 'fail') return `${RED}\u2717${RESET}`;
  return `${YELLOW}\u26A0${RESET}`;
}

function renderReport(basePath: string, checks: DoctorCheck[], summary: DoctorSummary): string {
  const overallStatus = summary.fail > 0 ? 'unhealthy' : summary.warn > 0 ? 'warning' : 'healthy';

  const header = [
    '',
    `${BOLD}AutomatosX Doctor${RESET}`,
    `Base path: ${basePath}`,
    `Overall status: ${overallStatus}`,
    `Summary: ${summary.ok} ok, ${summary.warn} warning${summary.warn === 1 ? '' : 's'}, ${summary.fail} failure${summary.fail === 1 ? '' : 's'}`,
    '',
  ];

  const checkLines = checks.map((c) => `[${c.status.toUpperCase()}] ${statusIcon(c.status)} ${c.message}`);

  const fixes = checks
    .filter((c) => c.status === 'fail' || c.status === 'warn')
    .filter((c) => {
      const msg = c.message.toLowerCase();
      return msg.includes('run "ax') || msg.includes('ax setup');
    });

  const fixLines: string[] = [];
  if (fixes.length > 0) {
    fixLines.push('', `${BOLD}Suggested Fixes:${RESET}`);
    let idx = 0;
    for (const fix of fixes) {
      const runMatch = /Run "([^"]+)"/.exec(fix.message);
      if (runMatch?.[1] !== undefined) {
        idx++;
        fixLines.push(`  ${idx}. ${DIM}${fix.message.split('.')[0]}${RESET}`);
        fixLines.push(`     Run: ${CYAN}${runMatch[1]}${RESET}`);
      }
    }
  }

  return [...header, ...checkLines, ...fixLines, ''].join('\n');
}

function summarizeChecks(checks: DoctorCheck[]): DoctorSummary {
  return checks.reduce<DoctorSummary>((s, c) => { s[c.status] += 1; return s; }, { ok: 0, warn: 0, fail: 0 });
}

function truncateSummary(value: string, maxLength = 140): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}\u2026`;
}

// ============================================================================
// Command
// ============================================================================

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
  const claudeMcpPath = join(basePath, '.mcp.json');
  const agentsMdPath = join(basePath, 'AGENTS.md');
  const providerSummaryPath = join(automatosxDir, 'providers.json');
  let governance = buildRuntimeGovernanceAggregate([]);

  // ── Base path ──────────────────────────────────────────────────────────────
  const basePathReady = await canAccess(basePath);
  checks.push({
    id: 'base-path',
    status: basePathReady ? 'ok' : 'fail',
    message: basePathReady
      ? `Base path is readable and writable (${basePath}).`
      : `Base path is not readable and writable (${basePath}).`,
  });

  if (!basePathReady) {
    const summary = summarizeChecks(checks);
    return failure(renderReport(basePath, checks, summary), { basePath, status: 'unhealthy', checks, summary });
  }

  // ── Provider CLIs ──────────────────────────────────────────────────────────
  checks.push(...(await getProviderChecks(environmentPath)));

  // ── Workspace config ───────────────────────────────────────────────────────
  const config = await readJsonFile(configPath);
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

  // ── Init artifacts ─────────────────────────────────────────────────────────
  const initArtifacts = [
    { label: 'AGENTS.md', path: agentsMdPath },
    { label: '.automatosx/mcp.json', path: localMcpPath },
    { label: '.mcp.json', path: claudeMcpPath },
  ];
  const missingInitArtifacts = (
    await Promise.all(initArtifacts.map(async (a) => ({ ...a, ok: await canAccess(a.path, constants.R_OK) })))
  ).filter((a) => !a.ok).map((a) => a.label);

  checks.push({
    id: 'init-artifacts',
    status: missingInitArtifacts.length === 0 ? 'ok' : 'warn',
    message: missingInitArtifacts.length === 0
      ? 'Project bootstrap artifacts are present.'
      : `Project bootstrap artifacts are incomplete (${missingInitArtifacts.join(', ')}). Run "ax setup".`,
  });

  // ── Provider summary ───────────────────────────────────────────────────────
  const providerSummary = await readJsonFile(providerSummaryPath);
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
    const enabledProviders = summaryProviders.filter((p) => p.enabled === true);
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

  // ── Shared runtime ─────────────────────────────────────────────────────────
  try {
    const [agents, policies, traces, workflows, runtimeStatus, deniedImportedSkills] = await Promise.all([
      runtime.listAgents(),
      runtime.listPolicies(),
      runtime.listTraces(options.limit ?? 5),
      runtime.listWorkflows({ workflowDir, basePath }),
      runtime.getStatus({ limit: options.limit ?? 5 }),
      buildDeniedImportedSkillAggregate(basePath),
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
    governance = buildRuntimeGovernanceAggregate(runtimeStatus.recentFailedTraces, {
      deniedImportedSkills,
    });
    checks.push({
      id: 'runtime-governance',
      status: governance.blockedCount > 0 || governance.deniedImportedSkills.deniedCount > 0 ? 'warn' : 'ok',
      message: governance.blockedCount > 0 || governance.deniedImportedSkills.deniedCount > 0
        ? formatDoctorGovernanceMessage(governance)
        : 'No recent runtime-governance blocks detected in failed traces or imported skills.',
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

  // ── MCP surface ────────────────────────────────────────────────────────────
  try {
    const tools = createMcpServerSurface({ basePath }).listTools();
    const missingTools = REQUIRED_MCP_TOOLS.filter((t) => !tools.includes(t));
    checks.push({
      id: 'mcp-surface',
      status: missingTools.length === 0 ? 'ok' : 'fail',
      message: missingTools.length === 0
        ? `MCP surface is available (${tools.length} tools).`
        : `MCP surface is missing required tools (${missingTools.join(', ')}).`,
    });
  } catch (error) {
    checks.push({
      id: 'mcp-surface',
      status: 'fail',
      message: `MCP surface check failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const summary = summarizeChecks(checks);
  const overallStatus = summary.fail > 0 ? 'unhealthy' : summary.warn > 0 ? 'warning' : 'healthy';
  const report = renderReport(basePath, checks, summary);
  const data = buildDoctorCommandData({
    basePath,
    status: overallStatus,
    checks,
    summary,
    governance,
  });

  return summary.fail > 0 ? failure(report, data) : success(report, data);
}

function formatDoctorGovernanceMessage(governance: RuntimeGovernanceAggregate): string {
  const parts: string[] = [];

  if (governance.blockedCount > 0) {
    parts.push(
      `Recent runtime-governance blocks detected (${governance.blockedCount} trace${governance.blockedCount === 1 ? '' : 's'}). Latest: ${governance.latest?.traceId}: ${truncateSummary(governance.latest?.summary ?? 'Unknown runtime governance block.')}`,
    );
  }

  const deniedImportedSkills = governance.deniedImportedSkills;
  if (deniedImportedSkills.deniedCount > 0) {
    parts.push(
      `Denied imported skills detected (${deniedImportedSkills.deniedCount} skill${deniedImportedSkills.deniedCount === 1 ? '' : 's'}). Latest: ${deniedImportedSkills.latest?.skillId}: ${truncateSummary(deniedImportedSkills.latest?.summary ?? 'Unknown denied imported skill.')}`,
    );
  }

  return parts.join(' ');
}
