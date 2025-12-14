import type { CommandResult, CLIOptions } from '../types.js';

/**
 * CLI version
 */
export const CLI_VERSION = '1.0.0';

/**
 * Help text for the CLI
 */
const HELP_TEXT = `
automatosx - AI-powered workflow automation

Usage:
  automatosx <command> [options]

Commands:
  run <workflow-id>     Execute a workflow
  list                  List available workflows
  trace [trace-id]      View trace information
  help                  Show this help message
  version               Show version information

Options:
  -h, --help            Show help
  -v, --verbose         Enable verbose output
  -V, --version         Show version
  --format <format>     Output format: text (default) or json
  --workflow-dir <dir>  Path to workflow files directory
  --workflow-id <id>    Workflow ID for run command
  --trace-id <id>       Trace ID for trace command
  --limit <n>           Limit number of results
  --input <json>        Input JSON for workflow execution

Examples:
  automatosx run my-workflow
  automatosx run my-workflow --input '{"key": "value"}'
  automatosx list --format json
  automatosx trace
  automatosx trace abc123-def456 --verbose
`.trim();

/**
 * Handles the 'help' command
 */
export function helpCommand(
  _args: string[],
  _options: CLIOptions
): Promise<CommandResult> {
  return Promise.resolve({
    success: true,
    message: HELP_TEXT,
    data: undefined,
    exitCode: 0,
  });
}

/**
 * Handles the 'version' command
 */
export function versionCommand(
  _args: string[],
  _options: CLIOptions
): Promise<CommandResult> {
  return Promise.resolve({
    success: true,
    message: `automatosx version ${CLI_VERSION}`,
    data: { version: CLI_VERSION },
    exitCode: 0,
  });
}
