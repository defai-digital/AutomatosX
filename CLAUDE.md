# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# AutomatosX v8.0.16 - Code Intelligence Platform

Production-ready code intelligence platform with AI agents, workflow orchestration, Tree-sitter parsing, SQLite FTS5 search, and 44 language support.

**Current Status**: v8.0.16 - ✅ **PRODUCTION-READY**

**Completion**: 95% (all features implemented, 745+ tests passing)

**Key Features**:
- ✅ Code Intelligence (44 languages)
- ✅ AI Agent System (21 agents)
- ✅ Multi-Provider AI (Claude, Gemini, OpenAI)
- ✅ Interactive CLI (ChatGPT-style REPL)
- ✅ SpecKit Auto-Generation (5 generators, 171 tests)
- ✅ Iterate Mode (10 strategies, 103 tests)
- ✅ Natural Language Interface (40+ patterns, 30 tests)
- ✅ Validation System (ADR-014, 488k ops/sec, 213 tests)
- ✅ Workflow Orchestration (ReScript state machines)
- ✅ Web UI Dashboard
- ✅ LSP Server
- ✅ VS Code Extension

**Test Status**: 745+ tests passing (100% pass rate)

**Requirements**:
- **Node.js**: v24.x (LTS recommended)
- **pnpm**: v9.0.0 or higher (required for development)
- **Operating Systems**:
  - Ubuntu 24.04 LTS (Noble Numbat) or later
  - macOS 26 (Tahoe) or later
  - Windows 11 or later

**Project Artifacts**:
- `automatosx/PRD/` - Product Requirements Documents, design specs (committed to git)
- `automatosx/tmp/` - Temporary execution reports, meeting notes (NOT committed to git)

---

## Build & Development Commands

**Important**: This project uses **pnpm** (not npm) for development. End users can install via npm globally, but contributors must use pnpm.

```bash
# Build entire project (ReScript + TypeScript)
pnpm run build

# Build ReScript core only
pnpm run build:rescript

# Build TypeScript layer only
pnpm run build:typescript

# Build and prepare CLI for execution
pnpm run build:cli

# Build web UI
pnpm run build:web

# Link CLI globally (makes 'ax' command available)
pnpm run link

# Unlink CLI
pnpm run unlink

# Run all tests (745+ tests)
pnpm test

# Run specific test file
pnpm test -- src/services/__tests__/QueryRouter.test.ts

# Run with coverage
pnpm run test:coverage

# Run tests by category
pnpm run test:runtime          # Runtime integration tests
pnpm run test:web              # Web UI component tests

# Run SpecKit tests (ADR, PRD, API spec generators)
pnpm test -- src/speckit/__tests__/SpecKitGenerator.test.ts
pnpm test -- src/speckit/__tests__/ADRGenerator.test.ts
pnpm test -- src/speckit/__tests__/PRDGenerator.test.ts

# IMPORTANT: Run tests without watch mode to avoid cache issues
pnpm test -- src/speckit/__tests__/ --run --no-watch

# Run CLI (builds first)
pnpm run cli -- <command> [args]

# CLI Examples
pnpm run cli -- find "Calculator"
pnpm run cli -- def "getUserById"
pnpm run cli -- index ./src
pnpm run cli -- status --verbose
pnpm run cli -- setup ./my-project  # NEW: Setup command

# Or use linked binary directly:
ax find "Calculator"
ax setup ./my-project
ax cli  # Interactive mode

# Interactive CLI Mode
pnpm run cli -- cli            # Launch ChatGPT-style interactive mode

# Web UI Development
pnpm run dev:web              # Start Vite dev server on localhost:3000
pnpm run preview:web          # Preview production build

# Clean build artifacts
pnpm run clean
```

## Architecture Overview

### Hybrid Language Stack

**ReScript Core** (`packages/rescript-core/`)
- State machines for deterministic task orchestration (StateMachineV2, TaskStateMachine, WorkflowStateMachine)
- Rule engine and policy DSL (RuleEngine, RuleParser, PolicyDSL)
- Event system with guards and validation
- Compiles to `.bs.js` files consumed by TypeScript
- Build output: `packages/rescript-core/lib/bs/` (in-source compilation)
- Currently minimal - Core runtime modules implemented

**TypeScript Layer** (`src/`)
- CLI framework (Commander.js) with interactive mode
- Code intelligence with SQLite + Tree-sitter (44 languages)
- Service layer, file I/O, telemetry
- LSP server for editor integration
- Web UI with React + Redux + Material-UI
- Build output: `dist/`

### Code Intelligence System Architecture

The system has eight major layers working together:

**1. Database Layer** (`src/database/`)
- SQLite with FTS5 full-text search and BM25 ranking
- Schema migrations: `src/migrations/*.sql` (001-013)
- Core tables: `files`, `symbols`, `calls`, `imports`, `chunks`, `chunks_fts` (FTS5)
- Extended: `telemetry`, `workflows`, `providers`, `cache`, `rate_limits`, `monitoring`, `memory_*`, `conversations`, `messages`, `message_embeddings`
- DAOs: `FileDAO`, `SymbolDAO`, `ChunkDAO`, `TelemetryDAO`, `WorkflowDAO`, `ConversationDAO`, `MessageDAO`, `MessageEmbeddingDAO`
- Connection: `getDatabase()` singleton with WAL mode
- Connection pooling via `ConnectionPool` for concurrent operations
- Vector storage: `sqlite-vec` and `sqlite-vss` for semantic search with embeddings

**2. Parser Layer** (`src/parser/`)
- `ParserRegistry` - Factory for 44 language-specific parsers
- Each parser implements `LanguageParser` interface
- Output: `ParseResult` with symbols, calls, imports, and metadata
- Languages: TypeScript, JavaScript, Python, Go, Rust, Java, C++, C#, Haskell, OCaml, Elm, Elixir, Gleam, Swift, Kotlin, Dart, Ruby, PHP, Bash, Zsh, Lua, Perl, Groovy, C, Zig, CUDA, AssemblyScript, SQL, JSON, YAML, TOML, CSV, Markdown, XML, HCL (Terraform), Makefile, Puppet, Solidity, Verilog, Thrift, Julia, MATLAB, Regex, HTML

**3. Service Layer** (`src/services/`)
- `FileService` - High-level orchestration (indexing, search)
- `QueryRouter` - Intent detection (symbol vs natural language vs hybrid)
- `QueryFilterParser` - Parse filter syntax (`lang:ts`, `kind:function`, `file:src/`)
- `ChunkingService` - Break files into overlapping chunks for search
- `IndexQueue` - Background indexing with batch operations
- `FileWatcher` - Chokidar-based file monitoring
- `WorkflowEngine` / `WorkflowEngineV2` - Workflow orchestration and execution
- `ProviderService` / `ProviderRouterV2` - Multi-provider AI integration (Claude, Gemini, OpenAI)
- `EmbeddingService` - Generate embeddings for semantic search
- `MetricsCollector`, `CheckpointService` / `CheckpointServiceV2`, `AlertManager`
- **Iterate Mode Services**:
  - `StrategySelector` - Adaptive retry strategy selection (5 built-in strategies)
  - `FailureAnalyzer` - Error classification (9 types) and pattern detection
  - `SafetyEvaluator` - Risk assessment with 3 safety levels (paranoid, normal, permissive)
  - `IterateEngine` - Main orchestrator for autonomous retry loops

**4. CLI Layer** (`src/cli/`)
- Commands: `find`, `def`, `flow`, `lint`, `index`, `watch`, `status`, `config`, `telemetry`, `memory`, `workflow`, `provider`, `monitor`, `analyze`, `perf`, `queue`, `ratelimit`, `agent`, `speckit`, `cli` (interactive), `setup` (NEW)
- Built with Commander.js
- Color-coded output with Chalk, tables with cli-table3
- Interactive mode: Inquirer for prompts, Ora for spinners
- Commands registered in `src/cli/index.ts`
- **Setup Command** (`src/cli/commands/setup.ts`):
  - Initializes `.automatosx/` directory structure
  - Copies example agents, abilities, teams, and templates
  - Creates `automatosx.config.json`
  - Sets up Claude Code integration (`.claude/` directory)
  - Sets up Gemini CLI integration (`.gemini/` directory)
  - Creates `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` integration guides
  - Initializes git repository (for Codex CLI compatibility)
  - Optional Spec-Kit initialization (`.specify/` directory)
- **Interactive CLI** (`src/cli/interactive/`):
  - `REPLSession` - ChatGPT-style interactive mode with token streaming
  - `SlashCommandRegistry` - 15+ slash commands (/help, /clear, /history, /workflow, etc.)
  - `ConversationContext` - Persistent conversation management with DAO
  - `SyntaxHighlighter` - Code syntax highlighting in responses
  - `TableFormatter` - Rich ASCII table formatting
- **Natural Language Interface** (`src/cli/interactive/`):
  - `IntentClassifier` - 40+ pattern matchers + LLM fallback for intent classification
  - `NaturalLanguageRouter` - Routes NL queries to Memory/Workflow/Agent/Provider systems
  - `ClarificationHandler` - Handles ambiguous queries with interactive prompts
  - `IntentLearningSystem` - Learns from user corrections and adapts patterns
  - `FileSystem` abstraction - Dependency injection for testability

**5. LSP Layer** (`src/lsp/`)
- `LSPServer` - Language Server Protocol implementation
- `DocumentManager` - Track open documents and sync changes
- Providers: Definition, References, Hover, Completion, Symbols, Rename, Diagnostics, CodeActions, Formatting
- WebSocket server for real-time editor communication
- Integration with VS Code extension (`extensions/vscode/`)

**6. Web UI Layer** (`src/web/`)
- React 18 + Redux Toolkit + Material-UI
- Pages: Home, Quality Dashboard, Dependency Graph, Settings, Workflow Monitor
- Components: Charts (Recharts), Graphs (D3.js), Tables, Filters, Timeline views
- Real-time updates via WebSocket
- State management: Redux with normalized store patterns

**7. AI Agent System** (`src/agents/`)
- 21 specialized agents for development tasks
- Categories: Engineering, Technical Specialists, Leadership
- Agent registry with capability-based routing
- Agent-to-agent delegation and collaboration
- Integration with workflow engine
- Key modules:
  - `ProfileLoader` - Load agent YAML configurations
  - `AbilitiesManager` - Manage agent capabilities
  - `TeamManager` - Multi-agent collaboration
  - `AgentExecutor` - Execute agent tasks with provider routing
  - `ContextManager` - Manage conversation context

**8. SpecKit System** (`src/speckit/`)
- **Template Method Pattern**: `SpecKitGenerator` abstract base class defines 6-step pipeline
  1. `analyze()` - Scan project structure
  2. `detect()` - Find patterns/features via PatternDetector/FeatureDetector
  3. `generateContent()` - Call AI provider with structured prompt
  4. `format()` - Apply template and formatting
  5. `validate()` - Check content quality (length, word count, headings)
  6. `save()` - Write to file with metadata
- **Generators**:
  - `ADRGenerator` - Architectural Decision Records (100% test coverage)
  - `PRDGenerator` - Product Requirements Documents (47% test coverage)
  - `APISpecGenerator` - API documentation
- **Detection Services**:
  - `PatternDetector` - Find design patterns (Singleton, Factory, DI, etc.)
  - `FeatureDetector` - Detect features (auth, API, database, UI, etc.)
  - Confidence-based filtering (threshold: 0.5)
- **Integration**: Uses MemoryService for code search, ProviderRouter for AI generation

### Data Flow Pipelines

**Indexing**:
```
File → FileWatcher → FileService → Parser (Tree-sitter) → Extract symbols/chunks → DAO → SQLite
```

**Query**:
```
User Query → QueryRouter (intent + filters) → FileService → DAO → SQLite FTS5 + BM25 → Cache → Results
```

**Workflow Execution**:
```
Workflow Def → WorkflowParser → WorkflowEngine → State Machine → Provider Router → AI Provider → Results
```

**Interactive CLI**:
```
User Input → CLI → ConversationDAO → ProviderRouter → AI Provider → Response → MessageDAO → Display
```

**Agent Execution**:
```
User Request → AgentExecutor → ProfileLoader → AbilitiesManager → ProviderRouter → AI Provider → Response
```

## Testing Strategy

Tests use **Vitest** with `.test.ts` suffix (745+ tests, 100% passing):

- `src/database/dao/__tests__/` - DAO integration tests with in-memory SQLite
- `src/services/__tests__/` - Service unit tests
  - **Iterate Mode**: `StrategySelector.test.ts` (24 tests), `FailureAnalyzer.test.ts` (34 tests), `SafetyEvaluator.test.ts` (24 tests), `IterateEngine.test.ts` (21 tests)
- `src/parser/__tests__/` - Parser tests with fixture files (44 languages)
- `src/cache/__tests__/` - Cache behavior tests
- `src/__tests__/runtime/` - Runtime integration tests
- `src/__tests__/rescript-core/` - ReScript bridge tests
- `src/__tests__/integration/` - End-to-end tests
- `src/__tests__/performance/` - Performance benchmarks
- `src/web/__tests__/` - Web UI component tests
- `src/speckit/__tests__/` - SpecKit generator tests (ADR, PRD, API specs)
- `src/cli/interactive/__tests__/` - Interactive CLI and Natural Language Interface tests
  - `NaturalLanguageRouter.test.ts` (30 tests) - Intent classification, routing, workflow name normalization

**Test Configuration**:
- Vitest config: `vitest.config.mts`
- Uses `jsdom` environment for React component tests
- Pool: `forks` with `singleFork: true` (required for onnxruntime-node compatibility)
- Path aliases: `@` → `./src`, `@web` → `./src/web`

### Critical: Vitest Cache Poisoning Issue

**Problem**: Vitest watch mode can serve stale compiled modules even after source code changes, causing phantom errors like `this.getGeneratorType is not a function` when source actually uses `this.generatorName`.

**Symptoms**:
- Test errors don't match source code
- Error mentions methods/properties that don't exist in current source
- Errors persist even after confirmed fixes

**Solution**: ALWAYS run tests with `--run --no-watch` when debugging persistent failures:
```bash
# DON'T use watch mode for critical debugging
pnpm test -- src/speckit/__tests__/ADRGenerator.test.ts

# DO use --run --no-watch for fresh module loading
pnpm test -- src/speckit/__tests__/ADRGenerator.test.ts --run --no-watch
```

**Prevention**:
- Kill watch mode processes before major debugging: `pkill -f "vitest"`
- Clear node_modules cache if issues persist: `rm -rf node_modules/.vite`
- Rebuild if necessary: `pnpm run build`

### Dependency Injection for Testability

When implementing services that interact with external systems (filesystem, network, etc.), use dependency injection to enable clean testing:

```typescript
// ✅ CORRECT: Define interface for dependencies
export interface FileSystem {
  existsSync(path: string): boolean;
  readdirSync(path: string): string[];
}

export const defaultFileSystem: FileSystem = {
  existsSync: fs.existsSync,
  readdirSync: fs.readdirSync
};

// Service accepts optional dependency injection
export class MyService {
  private fs: FileSystem;

  constructor(fileSystem?: FileSystem) {
    this.fs = fileSystem || defaultFileSystem;
  }

  async process(path: string) {
    if (!this.fs.existsSync(path)) return null;
    const files = this.fs.readdirSync(path);
    // ...
  }
}

// In tests: inject mock
const mockFileSystem: FileSystem = {
  existsSync: vi.fn().mockReturnValue(true),
  readdirSync: vi.fn().mockReturnValue(['file1.ts', 'file2.ts'])
};
const service = new MyService(mockFileSystem);

// In production: uses real filesystem
const service = new MyService(); // Uses defaultFileSystem
```

**Benefits**:
- No module-level mocking required (avoids Vitest "Cannot redefine property" errors)
- Each test has isolated mock state
- Production code unchanged
- Type-safe interface
- Easy to test edge cases

### Mock Implementation Patterns for SpecKit Tests

**Pattern Detection Tests** require specific mock data quantities to pass confidence thresholds:

```typescript
// PatternDetector confidence formulas:
// Singleton: confidence = Math.min(results.length / 5, 1) → need 3+ results for >0.5
// Factory:   confidence = Math.min(results.length / 5, 1) → need 3+ results for >0.5
// DI:        confidence = Math.min(results.length / 10, 1) → need 6+ results for >0.5

// ✅ CORRECT: Use .mockImplementation() for dynamic query handling
mockMemoryService.search = vi.fn().mockImplementation((query: string) => {
  if (query === 'static instance') {
    return Promise.resolve([
      { file: 'db.ts', content: 'static instance; getInstance()', score: 0.9 },
      { file: 'cache.ts', content: 'static instance', score: 0.85 },
      { file: 'config.ts', content: 'static instance', score: 0.8 },
      { file: 'logger.ts', content: 'getInstance()', score: 0.75 },
    ]); // 4 results → confidence = 4/5 = 0.8 → passes 0.5 threshold
  }
  return Promise.resolve([]);
});

// ❌ WRONG: .mockResolvedValueOnce() only handles first N calls
mockMemoryService.search = vi.fn()
  .mockResolvedValueOnce([...results...])  // Call 1
  .mockResolvedValueOnce([...results...])  // Call 2
  .mockResolvedValueOnce([...results...]);  // Call 3
  // PatternDetector.detectAll() sends 7+ queries → calls 4-7 get undefined!
```

**Feature Detection Tests** require even more mock data:

```typescript
// FeatureDetector confidence formula:
// Auth: confidence = Math.min((files.length / 10) * 0.6 + (endpoints.length / 5) * 0.4, 1)
// Need 10+ files to reach 0.6, or balanced combination for >0.5

// ✅ CORRECT: Return 10-12 results per feature type
if (query.match(/auth|login|signup|password|token|session|jwt/i)) {
  return Promise.resolve([
    // ... 10-12 auth-related results
  ]); // 10 results → confidence = (10/10)*0.6 = 0.6 → passes threshold
}
```

**Query Matching Rules**:
1. Match EXACT query strings (case-sensitive!)
   - `query === 'static instance'` (Singleton)
   - `query === 'factory'` (Factory - lowercase!)
   - `query === 'auth|login|signup|password|token|session|jwt'` (Auth - full regex)
2. Mock content must pass BOTH search AND filter conditions:
   ```typescript
   // DetectorExample.ts:
   const results = await searchCode('factory');  // Search query
   const filtered = results.filter(r =>
     (r.content.includes('create') || r.content.includes('build')) &&  // Filter check
     r.content.includes('Factory')  // Case-sensitive!
   );
   ```
3. Mock AI responses must pass validation:
   - Length > 100 characters
   - Word count ≥ 50 (if > 1 word)
   - At least 2 headings

**Test Isolation**: Add cleanup to prevent mock pollution:
```typescript
afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();  // Clear module cache between tests
  generator.clearCache();
});
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

## Key Patterns & Conventions

### Import Patterns

**TypeScript imports** - Use `.js` extension for ESM compatibility:
```typescript
import { FileDAO } from '../database/dao/FileDAO.js';
import { ParserRegistry } from '../parser/ParserRegistry.js';
```

**ReScript imports** - Import via `.bs.js` generated files:
```typescript
import * as StateMachine from '../../packages/rescript-core/src/runtime/StateMachineV2.bs.js';
```

### Error Handling

Use `ErrorEnvelope` for structured error handling:
```typescript
import { ErrorEnvelope } from '../utils/ErrorEnvelope.js';

try {
  // ...
} catch (error) {
  throw ErrorEnvelope.wrap(error, 'CONTEXT_CODE', { metadata });
}
```

### Configuration System

Hierarchical configuration loading (Zod-validated):
1. Default values in code
2. `automatosx.config.json` in project root
3. Environment variables with `AUTOMATOSX_` prefix

Example config:
```json
{
  "languages": {
    "typescript": { "enabled": true },
    "python": { "enabled": true }
  },
  "search": {
    "defaultLimit": 10,
    "maxLimit": 100
  },
  "indexing": {
    "excludePatterns": ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    "maxFileSize": 1048576
  },
  "database": {
    "path": ".automatosx/db/code-intelligence.db",
    "walMode": true
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

## Common Development Workflows

### Adding a new language parser

1. Install Tree-sitter grammar: `pnpm add tree-sitter-<language>`
2. Create `src/parser/<Language>ParserService.ts` implementing `LanguageParser`
3. Register in `ParserRegistry.ts` (add to `PARSERS` map)
4. Add test fixtures in `src/parser/__tests__/fixtures/<language>/`
5. Write tests in `src/parser/__tests__/<Language>ParserService.test.ts`

### Adding a new CLI command

1. Create `src/cli/commands/<command>.ts`
2. Define command with Commander.js (use `createCommand()` factory pattern)
3. Add action handler with proper error handling
4. Register in `src/cli/index.ts`
5. Write tests in `src/cli/commands/__tests__/<command>.test.ts`

### Adding a new database table

1. Create migration: `src/migrations/00X_create_<table>.sql`
2. Create DAO: `src/database/dao/<Table>DAO.ts`
3. Add types to `src/types/` (TypeScript interfaces + Zod schemas)
4. Write tests: `src/database/dao/__tests__/<Table>DAO.test.ts`

### Adding a new ReScript module

1. Create `packages/rescript-core/src/<module>/<Module>.res`
2. Add exports to `packages/rescript-core/src/Index.res`
3. Build ReScript: `pnpm run build:rescript`
4. Import in TypeScript via `.bs.js` file
5. Write tests in `src/__tests__/rescript-core/<Module>.test.ts`

### Adding a new SpecKit generator

1. Create `src/speckit/<Name>Generator.ts` extending `SpecKitGenerator`
2. Implement required methods:
   ```typescript
   export class MyGenerator extends SpecKitGenerator<MyGenerateOptions> {
     constructor(providerRouter: ProviderRouterV2, memoryService: MemoryService) {
       super(providerRouter, memoryService, 'MY');  // Generator name for metadata
     }

     protected async detect(options: MyGenerateOptions): Promise<DetectionResult> {
       // Use PatternDetector or FeatureDetector to find relevant code
       // Return { items, summary, confidence }
     }

     protected async generateContent(options: MyGenerateOptions, detection: DetectionResult): Promise<string> {
       // Build prompt for AI provider
       // Call this.providerRouter.route() with prompt
       // Return generated content
     }

     protected async format(content: string, options: MyGenerateOptions): Promise<string> {
       // Add header comment, formatting, etc.
       return `<!--\nGenerated by AutomatosX MyGenerator\n-->\n\n${content}`;
     }
   }
   ```
3. Create test file: `src/speckit/__tests__/<Name>Generator.test.ts`
4. Mock ProviderRouter with 120+ word response
5. Mock MemoryService with 4-6 results for patterns, 10-12 for features
6. Run tests with `--run --no-watch` to avoid cache issues

### Working with ReScript-TypeScript Bridge

When calling ReScript code from TypeScript:
1. ReScript modules export functions via `packages/rescript-core/src/Index.res`
2. Use `@genType` decorator for automatic TypeScript type generation
3. Import the `.bs.js` file (not `.res`)
4. Types are available in generated `.gen.tsx` files
5. Example:
```typescript
// TypeScript
import * as StateMachine from '../packages/rescript-core/src/runtime/StateMachineV2.bs.js';
const machine = StateMachine.make(config);
```

## Troubleshooting

**Build failures**:
```bash
pnpm run clean
pnpm install
pnpm run build
```

**Test failures**:
```bash
# Run tests with verbose output
pnpm test -- --reporter=verbose

# Run single test file
pnpm test -- src/database/dao/__tests__/FileDAO.test.ts

# Run with debugging
node --inspect-brk node_modules/.bin/vitest
```

**Database issues**:
```bash
# Delete and recreate database
rm -rf .automatosx/db/
pnpm run cli -- index ./src

# Check database integrity
sqlite3 .automatosx/db/code-intelligence.db "PRAGMA integrity_check;"
```

**ReScript compilation errors**:
```bash
# Clean ReScript build
cd packages/rescript-core
pnpm run clean
pnpm run build
cd ../..

# Or from root
pnpm run build:rescript
```

**Parser errors** (Tree-sitter):
```bash
# Reinstall Tree-sitter grammars
pnpm rebuild tree-sitter

# Check specific parser installation
pnpm list tree-sitter-typescript
```

**SpecKit test failures**:
```bash
# CRITICAL: Kill watch mode first to avoid cache poisoning
pkill -f "vitest"

# Run tests fresh without watch mode
pnpm test -- src/speckit/__tests__/ADRGenerator.test.ts --run --no-watch

# If tests still fail with "this.getGeneratorType is not a function":
# 1. Check source code - should use this.generatorName (not getGeneratorType())
# 2. Rebuild TypeScript: pnpm run build:typescript
# 3. Clear Vite cache: rm -rf node_modules/.vite
# 4. Run tests again: pnpm test -- src/speckit/__tests__/ --run --no-watch

# Mock-related failures (PatternDetector/FeatureDetector):
# 1. Check confidence thresholds in detector implementation
# 2. Increase mock result count (3-6 for patterns, 10-12 for features)
# 3. Verify query strings match EXACTLY (case-sensitive!)
# 4. Ensure mock content passes both search AND filter conditions
# 5. Expand mock AI response to 120+ words to pass validation
```

**pnpm vs npm**:
```bash
# If you see npm-related errors, make sure you're using pnpm:
pnpm install       # NOT: npm install
pnpm run build     # NOT: npm run build
pnpm test          # NOT: npm test

# If you accidentally ran npm commands, clean up:
rm -rf node_modules package-lock.json
pnpm install
```

## Performance Characteristics

Current metrics (v8.0.12):
- **Query latency (cached)**: <1ms
- **Query latency (uncached)**: <5ms (P95)
- **Indexing throughput**: 2000+ files/sec
- **Cache hit rate**: 60%+ typical
- **Test coverage**: 85%+
- **Tests passing**: 745/745 (100%)
- **Supported languages**: 45

Performance tips:
1. Use caching - 10-100x speedup for repeated queries
2. Apply filters early - `lang:`, `kind:`, `file:` narrow results
3. Batch index entire directories at once
4. Use watch mode for active development
5. Monitor cache hit rate with `ax status -v`
6. Enable WAL mode for SQLite (enabled by default)

## Privacy & Telemetry

**Privacy by Default**: AutomatosX does **NOT** collect any telemetry data by default.

### Current Behavior (v8.0.16+)

On first run, AutomatosX automatically disables telemetry without prompting. You'll see:

```
💡 Privacy by default: Telemetry is disabled
   To help improve AutomatosX, run: ax telemetry enable
   Learn more: ax telemetry --help
```

This one-time message appears only on first execution. No data is collected unless you explicitly enable telemetry.

### Opt-in Telemetry (Optional)

To help improve AutomatosX, you can optionally enable telemetry:

```bash
# Enable local-only telemetry (stored in SQLite)
ax telemetry enable

# Enable with anonymous remote submission
ax telemetry enable --remote

# View statistics
ax telemetry stats

# Export data
ax telemetry export > telemetry-data.json

# Disable anytime
ax telemetry disable

# Check status
ax telemetry status
```

### What We Collect (if enabled)

✅ **We collect**:
- Command usage (which commands you run)
- Query performance (how long operations take)
- Error occurrences (what errors happen)
- Parser invocations (which languages are used)

❌ **We NEVER collect**:
- File paths or names
- Code content
- User identifiers (IP addresses, usernames, etc.)
- Personal information

### Environment Variable Override

For CI/CD or automated environments:

```bash
# Disable telemetry completely (skip even the informational message)
export AUTOMATOSX_TELEMETRY_ENABLED=false

# Then run commands normally
ax find "test"
```

### Telemetry Storage

When enabled, telemetry data is stored locally in:
- **Database**: `.automatosx/db/code-intelligence.db` (telemetry tables)
- **Location**: Same database as code intelligence index
- **Format**: SQLite with FTS5 for fast analytics

See [PRIVACY.md](./PRIVACY.md) for complete privacy policy.

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
