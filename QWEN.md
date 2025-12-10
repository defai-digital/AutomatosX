# AutomatosX Project Context

## Project Overview

AutomatosX is an advanced AI orchestration platform that transforms AI coding assistants (Claude Code, Gemini CLI, Codex) into a multi-agent enterprise platform. It provides 20+ specialized agents, persistent memory, and 80% cost savings through intelligent multi-provider routing while maintaining a natural, invisible integration with existing workflows.

### Key Features
- **Multi-Agent Orchestration**: 20+ specialized agents (Backend, Security, Frontend, DevOps, Quality, Product, Data, etc.)
- **Persistent Memory**: SQLite FTS5-based memory system with <1ms search and zero token waste
- **Multi-Provider Routing**: Intelligent cost optimization routing between Claude, Gemini, and OpenAI
- **Workflow Automation**: YAML-based workflow specifications
- **Complete Observability**: JSONL trace logging for all decisions
- **MCP Integration**: Native integration with Claude Code via Model Context Protocol

### Architecture
The project follows a modular TypeScript architecture with:
- CLI interface for user interaction
- Core orchestration engine managing multi-agent workflows
- Provider integration layer for various AI services
- Memory system for persistent context storage
- MCP server for Claude Code integration
- Configuration system with extensive settings for performance and behavior

## Building and Running

### Prerequisites
- Node.js >= 24.0.0
- pnpm package manager
- At least one AI CLI (Claude Code, Gemini CLI, or Codex CLI)

### Installation
```bash
# Install the package globally
npm install -g @defai.digital/automatosx

# Initialize your project
cd your-project
ax setup
```

### Development Setup
```bash
# Clone and set up the repository
git clone https://github.com/defai-digital/automatosx.git
cd automatosx
npm install
npm test
```

### Build Commands
```bash
# Build the project
npm run build

# Run tests
npm test                    # All tests
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:smoke         # Smoke tests
npm run test:coverage      # Coverage report

# Development
npm run dev                # Development mode
npm run test:watch         # Watch mode for tests
npm run lint               # Lint code
npm run typecheck          # Type check
```

## Development Conventions

### Code Structure
- `src/cli/` - Command-line interface implementation
- `src/core/` - Core orchestration logic
- `src/agents/` - Specialized AI agent implementations
- `src/providers/` - AI provider integrations
- `src/mcp/` - Model Context Protocol server
- `src/shared/` - Shared utilities and constants
- `src/types/` - Type definitions
- `src/workers/` - Background processing workers
- `tests/` - All test files organized by category

### TypeScript Configuration
- Strict type checking enabled
- ESNext module system
- Node 20+ target
- Path aliases: `@/*` maps to `./src/*`, `@tests/*` maps to `./tests/*`

### Testing
- Vitest for testing framework
- Forks-based process pool for native module safety (sqlite)
- Comprehensive coverage with unit, integration, and smoke tests
- Mock providers enabled by default in tests

### Dependencies
- Core dependencies include better-sqlite3 for persistent storage, various AI SDKs for provider integration
- Build tool: tsup for bundling
- External packages remain unbundled to preserve functionality (native modules, terminal UI libraries)

### Configuration
- Extensive configuration via `ax.config.json`
- Settings for provider management, execution parameters, memory, orchestration, logging, performance, and security
- Environment-specific behavior through runtime environment variables

## Project Purpose and Use Cases

AutomatosX addresses key challenges with traditional AI coding assistants:
- High costs through multi-provider routing
- Loss of context between sessions with persistent memory
- Single-agent limitations with 20+ specialized agents
- Lack of observability with complete JSONL trace logging
- Manual coordination needs with workflow automation

### Primary Use Cases
1. **Cost Optimization**: Route tasks to the most cost-effective provider while maintaining quality
2. **Persistent Context**: Store and retrieve conversation history to avoid token waste
3. **Specialized Task Handling**: Delegate to specialized agents (security, backend, frontend, etc.)
4. **Workflow Automation**: Execute complex multi-step tasks through YAML specifications
5. **Enterprise Compliance**: Maintain audit trails and work in air-gapped environments

## Key Configuration Files

- `ax.config.json`: Main configuration with settings for providers, execution, memory, orchestration, and performance
- `tsconfig.json`: TypeScript configuration with strict typing and path aliases
- `tsup.config.ts`: Build configuration with separate CLI and MCP server builds
- `vitest.config.ts`: Test configuration optimized for native modules
- `package.json`: Project metadata, scripts, and dependencies
- `commitlint.config.js`: Commit message linting rules
- `eslint.config.js`: ESLint configuration for code quality

## Development Workflow

1. **Initialize**: Run `ax setup` in your project directory to create .automatosx configuration
2. **Use Naturally**: Interact with Claude Code as usual, AutomatosX provides invisible enhancements
3. **Multi-Agent**: Mention specific agents (e.g., "Security agent, audit this code") for specialized tasks
4. **Memory**: Automatically store and retrieve context across sessions
5. **Workflows**: Define reusable YAML workflows for complex multi-step operations
6. **Monitor**: Use observability features to track provider usage, costs, and execution paths

## Security and Compliance

- File system sandboxing to prevent access outside project directory
- Resource limits for agents (CPU/memory)
- Network restrictions and dangerous operation detection
- Complete audit trails with JSONL logging
- 100% local operation with optional offline mode
- Data sovereignty with no data leaving your infrastructure