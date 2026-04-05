import { type RuntimeGovernanceAggregate } from '../utils/runtime-guard-summary.js';
import { PROVIDER_CLIENT_IDS, PROVIDER_CLIENT_COMMANDS, type ProviderClientId } from '../utils/provider-detection.js';
import { readJsonObjectFile } from '../json-object-file.js';
import {
  REPORT_BOLD,
  REPORT_CHECK,
  REPORT_CROSS,
  REPORT_CYAN,
  REPORT_DIM,
  REPORT_RESET,
  REPORT_WARN_ICON,
} from '../cli-report-style.js';

export type DoctorStatus = 'ok' | 'warn' | 'fail';

export interface DoctorCheck {
  id: string;
  status: DoctorStatus;
  message: string;
}

export interface DoctorSummary {
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
  deniedInstalledBridges: {
    deniedCount: number;
    latest?: {
      bridgeId?: string;
      relativePath?: string;
      summary?: string;
      trustState?: string;
      approvalMode?: string;
      sourceRef?: string;
      installedAt?: string;
    };
  };
}

export interface CachedProviderStatus {
  providerId?: string;
  cli?: string;
  installed?: boolean;
}

const PROVIDER_META: Record<ProviderClientId, { name: string; installHint: string }> = {
  claude: { name: 'Claude', installHint: 'npm install -g @anthropic-ai/claude-code' },
  gemini: { name: 'Gemini', installHint: 'npm install -g @google/gemini-cli' },
  codex: { name: 'Codex', installHint: 'npm install -g @openai/codex' },
  grok: { name: 'Grok', installHint: 'npm install -g ax-grok' },
  cursor: { name: 'Cursor', installHint: 'Install from https://cursor.com' },
};

export function buildDoctorCommandData(input: {
  basePath: string;
  status: 'healthy' | 'warning' | 'unhealthy';
  checks: Array<{ id: string; status: 'ok' | 'warn' | 'fail'; message: string }>;
  summary: { ok: number; warn: number; fail: number };
  governance: RuntimeGovernanceAggregate;
  deniedInstalledBridges: DoctorCommandData['deniedInstalledBridges'];
}): DoctorCommandData {
  return {
    basePath: input.basePath,
    status: input.status,
    checks: input.checks,
    summary: input.summary,
    governance: input.governance,
    deniedInstalledBridges: input.deniedInstalledBridges,
  };
}

export function summarizeDoctorChecks(checks: DoctorCheck[]): DoctorSummary {
  return checks.reduce<DoctorSummary>((summary, check) => {
    summary[check.status] += 1;
    return summary;
  }, { ok: 0, warn: 0, fail: 0 });
}

export function renderDoctorReport(basePath: string, checks: DoctorCheck[], summary: DoctorSummary): string {
  const overallStatus = summary.fail > 0 ? 'unhealthy' : summary.warn > 0 ? 'warning' : 'healthy';
  const header = [
    '',
    `${REPORT_BOLD}AutomatosX Doctor${REPORT_RESET}`,
    `Base path: ${basePath}`,
    `Overall status: ${overallStatus}`,
    `Summary: ${summary.ok} ok, ${summary.warn} warning${summary.warn === 1 ? '' : 's'}, ${summary.fail} failure${summary.fail === 1 ? '' : 's'}`,
    '',
  ];
  const checkLines = checks.map((check) => `[${check.status.toUpperCase()}] ${statusIcon(check.status)} ${check.message}`);
  const fixLines = renderSuggestedFixes(checks);
  return [...header, ...checkLines, ...fixLines, ''].join('\n');
}

export async function getProviderChecks(environmentPath: string): Promise<DoctorCheck[]> {
  const overrideClients = getOverrideAvailableClients();
  if (overrideClients !== undefined) {
    return createOverrideProviderChecks(overrideClients);
  }

  const environment = await readJsonObjectFile(environmentPath);
  const providers = Array.isArray(environment?.providers)
    ? environment.providers as CachedProviderStatus[]
    : undefined;
  if (providers === undefined) {
    return [createMissingProviderBaselineCheck(environmentPath)];
  }

  return createCachedProviderChecks(createProviderStatusMap(providers));
}

function statusIcon(status: DoctorStatus): string {
  if (status === 'ok') return REPORT_CHECK;
  if (status === 'fail') return REPORT_CROSS;
  return REPORT_WARN_ICON;
}

function renderSuggestedFixes(checks: DoctorCheck[]): string[] {
  const fixes = checks
    .filter((check) => check.status === 'fail' || check.status === 'warn')
    .filter((check) => {
      const message = check.message.toLowerCase();
      return message.includes('run "ax') || message.includes('ax setup');
    });

  if (fixes.length === 0) {
    return [];
  }

  const lines: string[] = ['', `${REPORT_BOLD}Suggested Fixes:${REPORT_RESET}`];
  let index = 0;
  for (const fix of fixes) {
    const runMatch = /Run "([^"]+)"/.exec(fix.message);
    if (runMatch?.[1] === undefined) {
      continue;
    }
    index += 1;
    lines.push(`  ${index}. ${REPORT_DIM}${fix.message.split('.')[0]}${REPORT_RESET}`);
    lines.push(`     Run: ${REPORT_CYAN}${runMatch[1]}${REPORT_RESET}`);
  }
  return lines;
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
  return new Set(
    override.split(',').map((value) => value.trim()).filter((value): value is ProviderClientId => PROVIDER_CLIENT_IDS.includes(value as ProviderClientId)),
  );
}

function createOverrideProviderChecks(overrideClients: Set<ProviderClientId>): DoctorCheck[] {
  return PROVIDER_CLIENT_IDS.map((providerId) => {
    const command = PROVIDER_CLIENT_COMMANDS[providerId];
    const meta = PROVIDER_META[providerId];
    return {
      id: `provider-${providerId}`,
      status: overrideClients.has(providerId) ? 'ok' : 'warn',
      message: overrideClients.has(providerId)
        ? `${meta.name} CLI (${command}): detected`
        : `${meta.name} CLI (${command}): not detected`,
    };
  });
}

function createCachedProviderChecks(providerStatuses: Record<ProviderClientId, CachedProviderStatus>): DoctorCheck[] {
  return PROVIDER_CLIENT_IDS.map((providerId) => {
    const meta = PROVIDER_META[providerId];
    const provider = providerStatuses[providerId];
    const command = provider.cli ?? PROVIDER_CLIENT_COMMANDS[providerId];
    return {
      id: `provider-${providerId}`,
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
