# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# AutomatosX v2 - Code Intelligence Engine

Production-ready code intelligence system with Tree-sitter parsing, SQLite FTS5 search, and multi-language support (TypeScript, JavaScript, Python).

**Current Status**: Active development - TypeScript code intelligence system implemented, ReScript core in progress.

## Build & Development Commands

```bash
# Build entire project (ReScript + TypeScript)
npm run build

# Build ReScript core only
npm run build:rescript

# Build TypeScript layer only
npm run build:typescript

# Build and prepare CLI for execution
npm run build:cli

# Run all tests
npm test

# Run specific test file
npm test -- FileService

# Run tests matching pattern
npm test -- src/services/__tests__/QueryRouter.test.ts

# Run CLI (builds first)
npm run cli -- <command> [args]

# CLI Examples
npm run cli -- find "Calculator"
npm run cli -- def "getUserById"
npm run cli -- index ./src
npm run cli -- status --verbose
```

## Architecture Overview

### Hybrid Language Stack

This project uses a **hybrid ReScript + TypeScript architecture**:

**ReScript Core** (`packages/rescript-core/`)
- State machines for deterministic task orchestration
- Compiles to `.bs.js` files consumed by TypeScript
- Build output: `packages/rescript-core/lib/js/`
- Currently minimal - P0 implementation in progress

**TypeScript Layer** (`src/`)
- CLI framework (Commander.js)
- Code intelligence with SQLite + Tree-sitter
- Service layer, file I/O, telemetry
- Build output: `dist/`

### Code Intelligence System

The core code intelligence system has four layers:

**1. Database Layer** (`src/database/`)
- SQLite with FTS5 full-text search
- Schema migrations: `src/migrations/*.sql` (001-006)
- Tables: `files`, `symbols`, `calls`, `imports`, `chunks`, `chunks_fts`, `telemetry`
- DAOs: `FileDAO`, `SymbolDAO`, `ChunkDAO`, `TelemetryDAO`
- Connection: `getDatabase()` singleton with WAL mode

**2. Parser Layer** (`src/parser/`)
- `ParserRegistry` - Factory for language-specific parsers
- `TypeScriptParserService` - Tree-sitter TS/JS AST parsing
- `PythonParserService` - Tree-sitter Python AST parsing
- Additional parsers: Go, Ruby, Swift, Rust, Java, C#, PHP, Kotlin, OCaml
- Each parser implements `LanguageParser` interface
- Output: `ParseResult` with symbols, calls, imports

**3. Service Layer** (`src/services/`)
- `FileService` - High-level orchestration (indexing, search)
- `QueryRouter` - Intent detection (symbol vs natural language vs hybrid)
- `QueryFilterParser` - Parse filter syntax (`lang:ts`, `kind:function`, `file:src/`)
- `ChunkingService` - Break files into overlapping chunks for search
- `IndexQueue` - Background indexing with batch operations
- `FileWatcher` - Chokidar-based file monitoring

**4. CLI Layer** (`src/cli/`)
- `find` - Multi-modal search (symbol + full-text + filters)
- `def` - Symbol definition lookup
- `flow` - Call graph and data flow analysis
- `lint` - Code quality checks (Semgrep integration planned)
- `index` - Manual indexing trigger
- `watch` - Auto-index on file changes
- `status` - Index and cache statistics
- `config` - Configuration management
- `telemetry` - Telemetry data access

### Data Flow

**Indexing Pipeline**:
```
File → Parser (Tree-sitter AST) → Extract symbols/chunks → DAO → SQLite
```

**Query Pipeline**:
```
User Query → QueryRouter (intent) → FileService → DAO → SQLite FTS5 → Results
```

**Caching**:
```
Query → Cache check → Cache hit? → Return cached → Else → Query DB → Cache result
```

## Testing Strategy

Tests use **Vitest** with `.test.ts` suffix:

- `src/database/dao/__tests__/` - DAO integration tests with in-memory SQLite
- `src/services/__tests__/` - Service unit tests
- `src/parser/__tests__/` - Parser tests with fixture files
- `src/cache/__tests__/` - Cache behavior tests
- `src/__tests__/runtime/` - Runtime integration tests

Run specific test:
```bash
npm test -- src/services/__tests__/QueryRouter.test.ts
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Database Schema & Migrations

Migrations auto-run on first CLI execution. Manual trigger:
```bash
node -e "import('./dist/database/migrations.js').then(m => m.runMigrations())"
```

**Adding new migration**:
1. Create `src/migrations/00X_description.sql`
2. Migrations apply in numeric order (001, 002, ...)
3. Tracked in `migrations` table with timestamp

**Current schema** (as of migration 006):
- `files` - Indexed files with hash, size, language
- `symbols` - Extracted symbols (functions, classes, variables)
- `calls` - Function call relationships
- `imports` - Import/dependency graph
- `chunks` - File content broken into searchable chunks
- `chunks_fts` - FTS5 virtual table for full-text search
- `telemetry` - Performance metrics and usage data
- `telemetry_queue` - Async telemetry event queue

## Key Patterns & Conventions

### File Organization

**Core source code**:
- `src/database/` - Database connection, DAOs, migrations
- `src/parser/` - Language parsers (Tree-sitter wrappers)
- `src/services/` - Business logic (FileService, QueryRouter, etc.)
- `src/cli/` - CLI commands and utilities
- `src/cache/` - Query result caching
- `src/types/` - TypeScript type definitions and Zod schemas
- `src/utils/` - Shared utilities

**Project artifacts**:
- `automatosx/PRD/` - Product Requirements Documents, design specs (committed to git)
- `automatosx/tmp/` - Temporary execution reports, meeting notes (not committed)
- `dist/` - TypeScript build output
- `packages/rescript-core/lib/` - ReScript build output

### Import Patterns

All TypeScript imports use `.js` extension for ESM compatibility:
```typescript
import { FileDAO } from '../database/dao/FileDAO.js';
import { ParserRegistry } from '../parser/ParserRegistry.js';
```

### Error Handling

Use `ErrorHandler` utility for consistent error messages:
```typescript
import { ErrorHandler } from '../cli/utils/ErrorHandler.js';

try {
  // ...
} catch (error) {
  ErrorHandler.handleError(error);
}
```

## Configuration System

Hierarchical configuration loading:
1. Default values in code
2. `automatosx.config.json` in project root
3. Environment variables with `AUTOMATOSX_` prefix

Example config:
```json
{
  "languages": {
    "typescript": { "enabled": true },
    "javascript": { "enabled": true },
    "python": { "enabled": true }
  },
  "search": {
    "defaultLimit": 10,
    "maxLimit": 100
  },
  "indexing": {
    "excludePatterns": ["**/node_modules/**", "**/.git/**"],
    "maxFileSize": 1048576
  },
  "database": {
    "path": ".automatosx/db/code-intelligence.db"
  },
  "performance": {
    "enableCache": true,
    "cacheMaxSize": 1000,
    "cacheTTL": 300000
  }
}
```

Environment variable override:
```bash
export AUTOMATOSX_SEARCH_DEFAULT_LIMIT=25
export AUTOMATOSX_DATABASE_WAL=false
```

## Performance Characteristics

Current performance metrics:
- **Query latency (cached)**: <1ms
- **Query latency (uncached)**: <5ms (P95)
- **Indexing throughput**: 2000+ files/sec
- **Cache hit rate**: 60%+ typical
- **Test coverage**: 85%+
- **Tests passing**: 165/165 (100%)

Performance tips:
1. Use caching - 10-100x speedup for repeated queries
2. Apply filters early - `lang:`, `kind:`, `file:` narrow results
3. Batch index entire directories at once
4. Use watch mode for active development
5. Monitor cache hit rate with `ax status -v`

## Common Development Workflows

### Adding a new language parser

1. Install Tree-sitter grammar: `npm install tree-sitter-<language>`
2. Create `src/parser/<Language>ParserService.ts` implementing `LanguageParser`
3. Register in `ParserRegistry.ts`
4. Add test fixtures in `src/parser/__tests__/fixtures/`
5. Write tests in `src/parser/__tests__/<Language>ParserService.test.ts`

### Adding a new CLI command

1. Create `src/cli/commands/<command>.ts`
2. Define command with Commander.js
3. Add action handler
4. Register in `src/cli/index.ts`
5. Write tests in `src/cli/commands/__tests__/<command>.test.ts`
6. Update README with usage examples

### Adding a new database table

1. Create migration: `src/migrations/00X_create_<table>.sql`
2. Create DAO: `src/database/dao/<Table>DAO.ts`
3. Add types to `src/types/`
4. Write tests: `src/database/dao/__tests__/<Table>DAO.test.ts`
5. Update connection logic if needed

## Troubleshooting

**Build failures**:
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

**Test failures**:
```bash
# Run tests with verbose output
npm test -- --reporter=verbose

# Run single test file
npm test -- src/database/dao/__tests__/FileDAO.test.ts
```

**Database issues**:
```bash
# Delete and recreate database
rm -rf .automatosx/db/
npm run cli -- index ./src
```

**ReScript compilation errors**:
```bash
# Clean ReScript build
cd packages/rescript-core && npm run clean && npm run build
```

## Documentation Resources

- **README.md** - User-facing documentation and quick start
- **CHANGELOG.md** - Version history and release notes
- **API-QUICKREF.md** - CLI command reference
- **automatosx/PRD/automatosx-v2-revamp.md** - Master PRD with architecture
- **automatosx/PRD/v2-implementation-plan.md** - Implementation strategy

## Project Roadmap

**P0 (Current)**: Core code intelligence with TypeScript/JavaScript/Python
**P1 (Planned)**: Additional languages (Go, Rust), configuration tools
**P2 (Future)**: ML semantic search, cross-project search, LSP integration

---

# AutomatosX Integration

This project uses [AutomatosX](https://github.com/defai-digital/automatosx) - an AI agent orchestration platform with persistent memory and multi-agent collaboration.

## Quick Start

### Available Commands

```bash
# List all available agents
ax list agents

# Run an agent with a task
ax run <agent-name> "your task description"

# Example: Ask the backend agent to create an API
ax run backend "create a REST API for user management"

# Search memory for past conversations
ax memory search "keyword"

# View system status
ax status
```

### Using AutomatosX in Claude Code

You can interact with AutomatosX agents directly in Claude Code using natural language:

**Natural Language Examples**:
```
"Please work with ax agent backend to implement user authentication"
"Ask the ax security agent to audit this code for vulnerabilities"
"Have the ax quality agent write tests for this feature"
"Use ax agent product to design this new feature"
"Work with ax agent devops to set up the deployment pipeline"
```

Claude Code will understand your intent and invoke the appropriate AutomatosX agent for you. Just describe what you need in natural language - no special commands required!

### Available Agents

This project includes the following specialized agents:

- **backend** (Bob) - Backend development (Go/Rust systems)
- **frontend** (Frank) - Frontend development (React/Next.js/Swift)
- **architecture** (Avery) - System architecture and ADR management
- **fullstack** (Felix) - Full-stack development (Node.js/TypeScript)
- **mobile** (Maya) - Mobile development (iOS/Android, Swift/Kotlin/Flutter)
- **devops** (Oliver) - DevOps and infrastructure
- **security** (Steve) - Security auditing and threat modeling
- **data** (Daisy) - Data engineering and ETL
- **quality** (Queenie) - QA and testing
- **design** (Debbee) - UX/UI design
- **writer** (Wendy) - Technical writing
- **product** (Paris) - Product management
- **cto** (Tony) - Technical strategy
- **ceo** (Eric) - Business leadership
- **researcher** (Rodman) - Research and analysis
- **data-scientist** (Dana) - Machine learning and data science
- **aerospace-scientist** (Astrid) - Aerospace engineering and mission design
- **quantum-engineer** (Quinn) - Quantum computing and algorithms
- **creative-marketer** (Candy) - Creative marketing and content strategy
- **standard** (Stan) - Standards and best practices expert

For a complete list with capabilities, run: `ax list agents --format json`

## Key Features

### 1. Persistent Memory

AutomatosX agents remember all previous conversations and decisions:

```bash
# First task - design is saved to memory
ax run product "Design a calculator with add/subtract features"

# Later task - automatically retrieves the design from memory
ax run backend "Implement the calculator API"
```

### 2. Multi-Agent Collaboration

Agents can delegate tasks to each other automatically:

```bash
ax run product "Build a complete user authentication feature"
# → Product agent designs the system
# → Automatically delegates implementation to backend agent
# → Automatically delegates security audit to security agent
```

### 3. Cross-Provider Support

AutomatosX supports multiple AI providers with automatic fallback:
- **Claude** (Anthropic) - Primary provider for Claude Code users
- **Gemini** (Google) - Alternative provider
- **OpenAI** (GPT) - Alternative provider

Configuration is in `automatosx.config.json`.

## Configuration

### Project Configuration

Edit `automatosx.config.json` to customize:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2
    }
  },
  "execution": {
    "defaultTimeout": 1500000,  // 25 minutes
    "maxRetries": 3
  },
  "memory": {
    "enabled": true,
    "maxEntries": 10000
  }
}
```

### Agent Customization

Create custom agents in `.automatosx/agents/`:

```bash
ax agent create my-agent --template developer --interactive
```

### Workspace Conventions

**IMPORTANT**: AutomatosX uses specific directories for organized file management. Please follow these conventions when working with agents:

- **`automatosx/PRD/`** - Product Requirements Documents, design specs, and planning documents
  - Use for: Architecture designs, feature specs, technical requirements
  - Example: `automatosx/PRD/auth-system-design.md`

- **`automatosx/tmp/`** - Temporary files, scratch work, and intermediate outputs
  - Use for: Draft code, test outputs, temporary analysis
  - Auto-cleaned periodically
  - Example: `automatosx/tmp/draft-api-endpoints.ts`

**Usage in Claude Code**:
```
"Please save the architecture design to automatosx/PRD/user-auth-design.md"
"Put the draft implementation in automatosx/tmp/auth-draft.ts for review"
"Work with ax agent backend to implement the spec in automatosx/PRD/api-spec.md"
```

These directories are automatically created by `ax setup` and included in `.gitignore` appropriately.

## Memory System

### Search Memory

```bash
# Search for past conversations
ax memory search "authentication"
ax memory search "API design"

# List recent memories
ax memory list --limit 10

# Export memory for backup
ax memory export > backup.json
```

### How Memory Works

- **Automatic**: All agent conversations are saved automatically
- **Fast**: SQLite FTS5 full-text search (< 1ms)
- **Local**: 100% private, data never leaves your machine
- **Cost**: $0 (no API calls for memory operations)

## Advanced Usage

### Parallel Execution (v5.6.0+)

Run multiple agents in parallel for faster workflows:

```bash
ax run product "Design authentication system" --parallel
```

### Resumable Runs (v5.3.0+)

For long-running tasks, enable checkpoints:

```bash
ax run backend "Refactor entire codebase" --resumable

# If interrupted, resume with:
ax resume <run-id>

# List all runs
ax runs list
```

### Streaming Output (v5.6.5+)

See real-time output from AI providers:

```bash
ax run backend "Explain this codebase" --streaming
```

### Spec-Driven Development (v5.8.0+)

For complex projects, use spec-driven workflows:

```bash
# Create spec from natural language
ax spec create "Build authentication with database, API, JWT, and tests"

# Or manually define in .specify/tasks.md
ax spec run --parallel

# Check progress
ax spec status
```

## Troubleshooting

### Common Issues

**"Agent not found"**
```bash
# List available agents
ax list agents

# Make sure agent name is correct
ax run backend "task"  # ✓ Correct
ax run Backend "task"  # ✗ Wrong (case-sensitive)
```

**"Provider not available"**
```bash
# Check system status
ax status

# View configuration
ax config show
```

**"Out of memory"**
```bash
# Clear old memories
ax memory clear --before "2024-01-01"

# View memory stats
ax cache stats
```

### Getting Help

```bash
# View command help
ax --help
ax run --help

# Enable debug mode
ax --debug run backend "task"

# Search memory for similar past tasks
ax memory search "similar task"
```

## Best Practices

1. **Use Natural Language in Claude Code**: Let Claude Code coordinate with agents for complex tasks
2. **Leverage Memory**: Reference past decisions and designs
3. **Start Simple**: Test with small tasks before complex workflows
4. **Review Configurations**: Check `automatosx.config.json` for timeouts and retries
5. **Keep Agents Specialized**: Use the right agent for each task type

## Documentation

- **AutomatosX Docs**: https://github.com/defai-digital/automatosx
- **Agent Directory**: `.automatosx/agents/`
- **Configuration**: `automatosx.config.json`
- **Memory Database**: `.automatosx/memory/memories.db`
- **Workspace**: `automatosx/PRD/` (planning docs) and `automatosx/tmp/` (temporary files)

## Support

- Issues: https://github.com/defai-digital/automatosx/issues
- NPM: https://www.npmjs.com/package/@defai.digital/automatosx
