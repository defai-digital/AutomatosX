import { createRequire } from 'node:module';
import type { CommandResult, CLIOptions } from '../types.js';

/**
 * Read CLI version from package.json
 */
const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as { version: string };
export const CLI_VERSION = pkg.version;

/**
 * Help text for the CLI
 */
const HELP_TEXT = `
AutomatosX - AI-powered workflow automation

Usage:
  ax <command> [options]

Commands:
  setup                 Initialize AutomatosX configuration
  config <subcommand>   Manage configuration (show, get, set, reset, path)
  run <workflow-id>     Execute a workflow
  list                  List available workflows
  trace [trace-id]      View trace information
  doctor [provider]     Check system health and provider CLIs
  guard <subcommand>    Post-check AI coding governance
  call <provider>       Call an AI provider directly
  agent <subcommand>    Manage agents (list, get, register, run, remove)
  session <subcommand>  Manage sessions (list, get, create, join, complete)
  bugfix <subcommand>   Bug detection and fixing (scan, run, list)
  refactor <subcommand> Code refactoring (scan, apply, list)
  mcp <subcommand>      MCP server for AI coding assistants
  help                  Show this help message
  version               Show version information

Config Subcommands:
  config show           Show current configuration
  config get <path>     Get a specific config value
  config set <path> <v> Set a config value
  config reset          Reset configuration to defaults
  config path           Show config file paths

Agent Subcommands:
  agent list            List registered agents
  agent get <id>        Get agent details
  agent register        Register a new agent from JSON input
  agent run <id>        Execute an agent
  agent remove <id>     Remove an agent

Session Subcommands:
  session list          List sessions
  session get <id>      Get session details
  session create        Create a new session
  session join <id>     Join a session
  session leave <id>    Leave a session
  session complete <id> Complete a session
  session fail <id>     Fail a session

Bugfix Subcommands:
  bugfix scan <paths>   Scan code for potential bugs
  bugfix run --bug-id   Attempt to fix a detected bug
  bugfix list           List detected bugs from previous scans

Refactor Subcommands:
  refactor scan <paths> Scan code for refactoring opportunities
  refactor apply --id   Apply a detected refactoring
  refactor list         List detected opportunities

MCP Subcommands:
  mcp server            Start MCP server (stdio transport)
  mcp serve             Alias for 'server'

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
  ax setup
  ax setup --force
  ax config show
  ax config get logLevel
  ax config set logLevel debug
  ax run my-workflow
  ax run my-workflow --input '{"key": "value"}'
  ax list --format json
  ax trace
  ax trace abc123-def456 --verbose
  ax doctor
  ax doctor claude --verbose
  ax guard check --policy provider-refactor --target openai
  ax guard list
  ax call gemini "Summarize this text"
  ax call claude --file ./README.md "Explain in Chinese"
  ax agent list
  ax agent get code-reviewer
  ax agent run code-reviewer --input '{"query": "Review this code"}'
  ax session create --input '{"initiator": "agent-1", "task": "Review code"}'
  ax session get <session-id>
  ax bugfix scan src/ --min-severity medium
  ax bugfix run --bug-id bug-123 --apply
  ax refactor scan src/ --type extract-function
  ax refactor apply --opportunity-id opp-456 --apply --run-tests
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
    message: `ax version ${CLI_VERSION}`,
    data: { version: CLI_VERSION },
    exitCode: 0,
  });
}
