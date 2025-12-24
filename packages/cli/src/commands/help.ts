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
  review <subcommand>   AI-powered code review (analyze, list)
  scaffold <subcommand> Scaffold contract-first components
  discuss <topic>       Multi-model discussion and consensus
  ability <subcommand>  Manage abilities (list, inject)
  mcp <subcommand>      MCP server for AI coding assistants
  status                Show current session status
  resume                Resume a previous session
  history               View execution history
  cleanup               Clean up old sessions and data
  iterate               Iterative development loop
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

Review Subcommands:
  review analyze <paths>  AI-powered code review with focus modes
  review list             List past code reviews

  Focus modes: --focus security|architecture|performance|maintainability|correctness|all

Scaffold Subcommands:
  scaffold project <name>   Generate new project from template
  scaffold contract <name>  Generate Zod schema and invariants
  scaffold domain <name>    Generate complete domain package
  scaffold guard <id>       Generate guard policy

  Scaffold Options:
    -t, --template <type>     Template: monorepo or standalone (default: standalone)
    -m, --domain <name>       Primary domain name (required for project)
    -d, --description <desc>  Domain description
    -o, --output <path>       Output directory
    -s, --scope <scope>       Package scope (default: @myorg)
    -r, --radius <n>          Change radius limit (default: 3)
    --no-tests                Skip test scaffolds
    --no-guard                Skip guard policy
    --dry-run                 Preview without writing files

Discuss Options:
  discuss <topic>           Start multi-model discussion
  discuss quick <topic>     Quick 2-3 model synthesis

  Discuss Flags:
    --providers <list>      Comma-separated providers (default: claude,glm,qwen,gemini)
    --pattern <type>        Pattern: synthesis, voting, debate, critique, round-robin
    --rounds <n>            Number of discussion rounds (default: 2)
    --consensus <method>    Method: synthesis, voting, moderator, unanimous, majority
    --context <text>        Additional context for discussion
    --verbose, -v           Show detailed progress

Ability Subcommands:
  ability list              List available abilities
  ability inject            Inject abilities into context

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
  ax review analyze src/ --focus security
  ax review analyze src/ --focus maintainability
  ax review list --limit 10
  ax scaffold project my-app -m order -t standalone
  ax scaffold project ecommerce -m order -t monorepo -s @myorg
  ax scaffold contract payment -d "Payment processing domain"
  ax scaffold domain payment --no-tests
  ax scaffold guard payment-dev -r 3
  ax scaffold project my-app -m order --dry-run
  ax discuss "What is the best approach for microservices?"
  ax discuss --pattern debate "Monolith vs microservices for startups"
  ax discuss quick "Best testing strategy for APIs"
  ax ability list
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
