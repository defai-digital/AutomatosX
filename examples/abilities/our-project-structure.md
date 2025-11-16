# Our Project Structure - AutomatosX v5

> AutomatosX project organization and file structure conventions

## Directory Structure

```
automatosx/
├── src/                      # TypeScript source code
│   ├── core/                 # Router, PathResolver, MemoryManager, SessionManager
│   ├── agents/               # ProfileLoader, AbilitiesManager, ContextManager, Executor
│   ├── providers/            # Claude, Gemini, OpenAI implementations
│   ├── cli/                  # CLI entry point and commands/
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Logger, errors, formatters
│
├── tests/                    # 1,149 tests (100% pass)
│   ├── unit/                 # Core modules, utilities
│   ├── integration/          # CLI command flows
│   ├── e2e/                  # Complete workflows
│   └── fixtures/             # Test helpers, mock providers
│
├── examples/
│   ├── agents/               # Example agent profiles (YAML)
│   ├── abilities/            # Example abilities (Markdown)
│   └── templates/            # Agent templates (v5.0.0+)
│
├── dist/                     # Build output (381KB, gitignored)
│   ├── index.js              # Bundled CLI (ESM)
│   ├── index.js.map
│   └── index.d.ts
│
├── .automatosx/              # User project directory (created by init)
│   ├── config.json           # User configuration
│   ├── agents/               # User's custom agents
│   ├── abilities/            # User's custom abilities
│   ├── memory/               # SQLite database (memory.db)
│   ├── sessions/             # Session persistence
│   └── logs/                 # Application logs
│
├── automatosx/               # Workspace directory (v5.2+)
│   ├── PRD/                  # Planning documents (permanent)
│   └── tmp/                  # Temporary files (auto-cleanup)
│
└── tmp/                      # Temporary files (gitignored)
```

## Module Import Hierarchy

**Dependency flow (imports only from lower layers):**

```
Layer 1: types/              → No dependencies
Layer 2: utils/              → types/
Layer 3: core/               → types/, utils/
Layer 4: providers/          → types/, core/
Layer 5: agents/             → types/, utils/, core/
Layer 6: cli/                → All of the above
```

**Rule:** Higher layers can import from lower layers, never vice versa.

## File Naming Conventions

**TypeScript files:** `kebab-case.ts`

```
✅ path-resolver.ts, memory-manager.ts, claude-provider.ts
❌ PathResolver.ts, path_resolver.ts, pathResolver.ts
```

**Test files:** `{module-name}.test.ts`

```
✅ path-resolver.test.ts, memory-manager.test.ts
❌ path-resolver.spec.ts, test-path-resolver.ts
```

**Type files:** `{concept}.ts` (no -types suffix)

```
✅ types/agent.ts, types/provider.ts
❌ types/agent-types.ts, types/AgentTypes.ts
```

**Configuration files:**

- YAML for agents: `examples/agents/backend.yaml`
- Markdown for abilities: `examples/abilities/code-generation.md`
- JSON for config: `.automatosx/config.json`

## Import Patterns

**ESM imports (always use .js extension):**

```typescript
// ✅ Good: Full path with .js
import { PathResolver } from '../core/path-resolver.js';
import type { AgentProfile } from '../types/agent.js';

// ❌ Bad: Missing .js extension
import { PathResolver } from '../core/path-resolver';
```

**Type-only imports:**

```typescript
// ✅ Good: type-only imports (better tree-shaking)
import type { AgentProfile } from '../types/agent.js';
import type { Provider } from '../types/provider.js';
```

## Configuration Hierarchy

**Priority order:**

1. `.automatosx/config.json` (project-specific, created by `ax setup`)
2. `automatosx.config.json` (project root, manually created)
3. `~/.automatosx/config.json` (user global)
4. `DEFAULT_CONFIG` (defaults in `src/types/config.ts`)

**Agent profiles search order:**

1. `.automatosx/agents/{name}.yaml` (user custom)
2. `examples/agents/{name}.yaml` (built-in)

**Abilities search order:**

1. `.automatosx/abilities/{name}.md` (user custom)
2. `examples/abilities/{name}.md` (built-in)

## Build Output

**Location:** `dist/`

- `index.js` - Bundled CLI (ESM, 381KB)
- `index.js.map` - Source map
- `index.d.ts` - Type definitions

**Bundle target:** ESM, Node 20+, <250KB target

## Workspace Structure (v5.2.0)

**Shared workspaces:**

- `automatosx/PRD/` - Planning documents, feature designs, proposals (permanent)
- `automatosx/tmp/` - Test scripts, analysis tools, temporary reports (auto-cleanup)

**All agents** have equal read/write access to both directories.

**Memory storage:** `.automatosx/memory/memory.db`

- SQLite database with FTS5 full-text search
- < 1ms search performance

**Session storage:** `.automatosx/sessions/sessions.json`

- JSON-based persistence
- 100ms debounced saves
- Automatic cleanup (7+ days old)

## Security Boundaries

**Allowed reads:**

- `{projectRoot}/**/*` (validated by PathResolver)

**Allowed writes:**

- `automatosx/PRD/**/*` - Planning documents
- `automatosx/tmp/**/*` - Temporary files

**Forbidden:**

- Empty paths or current directory (`''`, `'.'`)
- Path traversal (`../../../etc/passwd`)
- Symbolic links outside project
- Absolute paths

---

**Last Updated:** 2025-10-11
**For:** AutomatosX v5.2+
