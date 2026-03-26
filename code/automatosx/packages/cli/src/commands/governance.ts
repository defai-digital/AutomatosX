import type { CLIOptions, CommandResult } from '../types.js';
import {
  createRuntime,
  resolveCliBasePath,
  success,
  usageError,
  failure,
} from '../utils/formatters.js';
import {
  buildDeniedImportedSkillAggregate,
  buildRuntimeGovernanceAggregate,
  formatDeniedImportedSkillSummaryLines,
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
  const [status, deniedImportedSkills] = await Promise.all([
    runtime.getStatus({ limit }),
    buildDeniedImportedSkillAggregate(basePath),
  ]);

  const governance = buildRuntimeGovernanceAggregate(status.recentFailedTraces, { deniedImportedSkills });
  const latestBlockedTraceLines = formatLatestBlockedTrace(governance.latest);
  const deniedImportedSkillLines = formatDeniedImportedSkillSummaryLines(governance.deniedImportedSkills);

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
  ];

  return success(lines.join('\n'), governance);
}

function formatLatestBlockedTrace(latest: ReturnType<typeof buildRuntimeGovernanceAggregate>['latest']): string[] {
  if (latest === undefined) {
    return ['- none'];
  }

  const lines = [
    `- ${latest.traceId}${latest.workflowId === undefined ? '' : ` ${latest.workflowId}`}`,
    `  governance: ${latest.summary}`,
  ];
  if (latest.toolName !== undefined) {
    lines.push(`  tool: ${latest.toolName}`);
  }
  if (latest.trustState !== undefined) {
    lines.push(`  trust: ${latest.trustState}`);
  }
  if (latest.requiredTrustStates !== undefined && latest.requiredTrustStates.length > 0) {
    lines.push(`  requires: ${latest.requiredTrustStates.join(', ')}`);
  }
  if (latest.sourceRef !== undefined) {
    lines.push(`  source: ${latest.sourceRef}`);
  }
  return lines;
}
