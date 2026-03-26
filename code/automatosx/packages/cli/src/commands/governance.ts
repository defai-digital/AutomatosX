import type { CLIOptions, CommandResult } from '../types.js';
import {
  createRuntime,
  resolveCliBasePath,
  success,
  usageError,
  failure,
} from '../utils/formatters.js';
import {
  buildCliGovernanceSnapshot,
  formatDeniedImportedSkillSummaryLines,
  formatDeniedInstalledBridgeSummaryLines,
  formatRuntimeGovernanceLatestLines,
} from '../utils/runtime-guard-summary.js';
import { findUnexpectedFlag } from '../utils/validation.js';

const DEFAULT_GOVERNANCE_LIMIT = 50;

export async function governanceCommand(args: string[], options: CLIOptions): Promise<CommandResult> {
  const unexpectedFlag = findUnexpectedFlag(args);
  if (unexpectedFlag !== undefined) {
    return failure(`Unknown governance flag: ${unexpectedFlag}.`);
  }

  if (args[0] !== undefined) {
    return usageError('ax governance');
  }

  const basePath = resolveCliBasePath(options);
  const runtime = createRuntime(options);
  const limit = options.limit ?? DEFAULT_GOVERNANCE_LIMIT;
  const status = await runtime.getStatus({ limit });
  const governanceSnapshot = await buildCliGovernanceSnapshot(basePath, status.recentFailedTraces);
  const { governance, deniedInstalledBridges } = governanceSnapshot;
  const latestBlockedTraceLines = formatRuntimeGovernanceLatestLines(governance.latest);
  const deniedImportedSkillLines = formatDeniedImportedSkillSummaryLines(governance.deniedImportedSkills);
  const deniedInstalledBridgeLines = formatDeniedInstalledBridgeSummaryLines(deniedInstalledBridges);

  const lines = [
    'AutomatosX Governance',
    '',
    `Trace scan limit: ${limit}`,
    `Runtime-governance blocked traces: ${governance.blockedCount}`,
    'Latest blocked trace:',
    ...latestBlockedTraceLines,
    '',
    'Denied imported skills:',
    ...deniedImportedSkillLines,
    '',
    'Denied installed bridges:',
    ...deniedInstalledBridgeLines,
  ];

  return success(lines.join('\n'), governance);
}
