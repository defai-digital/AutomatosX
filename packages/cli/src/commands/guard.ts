/**
 * Guard Command
 *
 * Post-check AI coding governance.
 * Usage: ax guard check --policy <policy> --target <target>
 */

import {
  guardCheck,
  listPolicies,
  validatePolicyId,
} from '@defai.digital/guard';
import type { GuardResult } from '@defai.digital/guard';
import type { CommandResult, CLIOptions } from '../types.js';

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Status icons
 */
const ICONS = {
  PASS: `${COLORS.green}\u2713${COLORS.reset}`,
  FAIL: `${COLORS.red}\u2717${COLORS.reset}`,
  WARN: `${COLORS.yellow}\u26A0${COLORS.reset}`,
};

/**
 * Formats guard result for text output
 */
function formatGuardResult(result: GuardResult, verbose: boolean): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(`${COLORS.bold}AX Guard Check${COLORS.reset}`);
  lines.push(`Policy: ${result.policyId}`);
  lines.push(`Target: ${result.target}`);
  lines.push('');

  // Status banner
  const statusIcon = ICONS[result.status];
  const statusColor =
    result.status === 'PASS'
      ? COLORS.green
      : result.status === 'FAIL'
        ? COLORS.red
        : COLORS.yellow;

  lines.push(
    `${statusIcon} ${statusColor}${COLORS.bold}${result.status}${COLORS.reset}: ${result.summary}`
  );
  lines.push('');

  // Gate results
  if (result.gates.length > 0) {
    lines.push(`${COLORS.bold}Gate Results${COLORS.reset}`);
    for (const gate of result.gates) {
      const gateIcon = ICONS[gate.status];
      lines.push(`  ${gateIcon} ${gate.gate}: ${gate.message}`);

      if (verbose && gate.details !== undefined) {
        const detailsStr = JSON.stringify(gate.details, null, 2)
          .split('\n')
          .map((line) => `      ${COLORS.dim}${line}${COLORS.reset}`)
          .join('\n');
        lines.push(detailsStr);
      }
    }
    lines.push('');
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    lines.push(`${COLORS.bold}Suggested Actions${COLORS.reset}`);
    for (const suggestion of result.suggestions) {
      lines.push(`  ${COLORS.dim}\u2022${COLORS.reset} ${suggestion}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Parsed guard arguments
 */
interface ParsedGuardArgs {
  subcommand: string;
  policy: string | undefined;
  target: string | undefined;
}

/**
 * Parses guard subcommand and options
 */
function parseGuardArgs(args: string[], options: CLIOptions): ParsedGuardArgs {
  const subcommand = args[0] ?? 'help';

  // Parse --policy and --target from remaining args
  let policy: string | undefined = options.workflowId; // Reuse workflowId for policy
  let target: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--policy' && i + 1 < args.length) {
      policy = args[++i];
    } else if (arg === '--target' && i + 1 < args.length) {
      target = args[++i];
    } else if (target === undefined && arg !== undefined && !arg.startsWith('-')) {
      // First positional arg after subcommand is target
      target = arg;
    }
  }

  return { subcommand, policy, target };
}

/**
 * Shows guard help
 */
function showGuardHelp(): CommandResult {
  const policies = listPolicies();

  const helpText = `
${COLORS.bold}AX Guard - Post-check AI Coding Governance${COLORS.reset}

Usage:
  ax guard check --policy <policy> --target <target>
  ax guard list
  ax guard help

Commands:
  check     Run governance checks on current changes
  list      List available policies
  help      Show this help message

Options:
  --policy <policy>   Policy to apply (required for check)
  --target <target>   Target name, e.g., provider name (required for check)
  --verbose           Show detailed gate results

Available Policies:
${policies.map((p) => `  - ${p}`).join('\n')}

Examples:
  ax guard check --policy provider-refactor --target openai
  ax guard check --policy bugfix --target fix-123 --verbose
  ax guard list
`.trim();

  return {
    success: true,
    message: helpText,
    data: undefined,
    exitCode: 0,
  };
}

/**
 * Lists available policies
 */
function listPoliciesCommand(): CommandResult {
  const policies = listPolicies();

  return {
    success: true,
    message: `Available policies:\n${policies.map((p) => `  - ${p}`).join('\n')}`,
    data: policies,
    exitCode: 0,
  };
}

/**
 * Runs guard check
 */
async function runGuardCheck(
  policy: string,
  target: string,
  options: CLIOptions
): Promise<CommandResult> {
  // Validate policy
  if (!validatePolicyId(policy)) {
    const available = listPolicies();
    return {
      success: false,
      message: `Unknown policy: ${policy}\nAvailable policies: ${available.join(', ')}`,
      data: undefined,
      exitCode: 1,
    };
  }

  try {
    const result = await guardCheck({
      policy,
      target,
      format: options.format,
      verbose: options.verbose,
    });

    if (options.format === 'json') {
      return {
        success: result.status !== 'FAIL',
        message: undefined,
        data: result,
        exitCode: result.status === 'FAIL' ? 1 : 0,
      };
    }

    return {
      success: result.status !== 'FAIL',
      message: formatGuardResult(result, options.verbose),
      data: result,
      exitCode: result.status === 'FAIL' ? 1 : 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Guard check failed: ${message}`,
      data: undefined,
      exitCode: 1,
    };
  }
}

/**
 * Guard command handler
 */
export async function guardCommand(
  args: string[],
  options: CLIOptions
): Promise<CommandResult> {
  const { subcommand, policy, target } = parseGuardArgs(args, options);

  switch (subcommand) {
    case 'check': {
      if (policy === undefined) {
        return {
          success: false,
          message: 'Error: --policy is required\n\nRun "ax guard help" for usage.',
          data: undefined,
          exitCode: 1,
        };
      }
      if (target === undefined) {
        return {
          success: false,
          message: 'Error: --target is required\n\nRun "ax guard help" for usage.',
          data: undefined,
          exitCode: 1,
        };
      }
      return runGuardCheck(policy, target, options);
    }

    case 'list':
      return listPoliciesCommand();

    case 'help':
    default:
      return showGuardHelp();
  }
}
