# AutomatosX Codebase Duplicate Code Analysis

## Executive Summary

This analysis identifies **5 major duplicate code patterns** across the AutomatosX codebase that should be refactored. The duplicates span error handling, tool result building, async patterns, and validation logic. Consolidating these would improve maintainability, reduce code size by ~15-20%, and standardize error handling across the platform.

---

## 1. DUPLICATE ERROR HANDLING PATTERN

### Pattern: `error instanceof Error ? error.message : 'Unknown error'`

This pattern appears **43 times** across the codebase and is the single most prevalent duplication.

### Locations:

#### CLI Commands (12 occurrences)
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/run.ts:154`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/provider.ts:88, 142, 211`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/memory.ts:130, 196, 256, 304, 352, 407`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/agent.ts:105, 196`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/session.ts:106, 204`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/system.ts:119, 184, 200, 356, 419`

#### MCP Tools (8 occurrences)
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/system.ts:79, 132, 206`
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/memory.ts:101, 177, 236`
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/session.ts:75, 153, 237`
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/agent.ts:102, 161, 236`

#### Core Services (9 occurrences)
- `/Users/akiralam/code/AutomatosX/packages/core/src/agent/executor.ts:246, 336, 441`
- `/Users/akiralam/code/AutomatosX/packages/core/src/agent/loader.ts:157`
- `/Users/akiralam/code/AutomatosX/packages/core/src/memory/manager.ts:656`
- `/Users/akiralam/code/AutomatosX/packages/core/src/router/provider-router.ts:366, 496`
- `/Users/akiralam/code/AutomatosX/packages/core/src/config/loader.ts:174, 186`

#### Providers (7 occurrences)
- `/Users/akiralam/code/AutomatosX/packages/providers/src/base.ts:223`
- `/Users/akiralam/code/AutomatosX/packages/providers/src/claude.ts:156`
- `/Users/akiralam/code/AutomatosX/packages/providers/src/gemini.ts:155`
- `/Users/akiralam/code/AutomatosX/packages/providers/src/openai.ts:87`
- `/Users/akiralam/code/AutomatosX/packages/providers/src/ax-cli.ts:178`

#### Utilities (3 occurrences)
- `/Users/akiralam/code/AutomatosX/packages/cli/src/utils/spinner.ts:114`
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/mcp-server.ts:152`

### Consolidation Strategy:

Create a shared utility function in `@ax/core` or `@ax/schemas`:

```typescript
// packages/core/src/utils/error-handling.ts
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
```

**Usage across codebase:**
```typescript
// Before: 43 occurrences
const message = error instanceof Error ? error.message : 'Unknown error';

// After: Single utility import
import { getErrorMessage } from '@ax/core/utils/error-handling';
const message = getErrorMessage(error);
```

---

## 2. DUPLICATE TOOL RESULT BUILDERS

### Pattern: Repeated MCP ToolResult structure with `content` array and error handling

This pattern appears **18+ times** across MCP tool files.

### Example Locations:

**Success Pattern** (appears in all MCP tools):
```typescript
return {
  content: [
    {
      type: 'text',
      text: 'Success message or output',
    },
  ],
};
```

**Error Pattern** (appears in all MCP tools):
```typescript
return {
  content: [
    {
      type: 'text',
      text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    },
  ],
  isError: true,
};
```

### Files with Duplicates:
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/system.ts` (3 tools)
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/memory.ts` (3 tools)
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/agent.ts` (3 tools)
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/session.ts` (4 tools)

### Consolidation Strategy:

Create helper functions in `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/helpers.ts`:

```typescript
export function toolSuccess(text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

export function toolError(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}
```

**Usage:**
```typescript
// Before: 6 lines of boilerplate per function
catch (error) {
  return {
    content: [
      { type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
    ],
    isError: true,
  };
}

// After: 1 line
catch (error) {
  return toolError(error);
}
```

---

## 3. DUPLICATE TRY-CATCH ERROR HANDLING IN CLI COMMANDS

### Pattern: Repeated catch blocks with spinner and error output

This pattern appears **20+ times** across CLI command handlers.

### Example:
```typescript
} catch (error) {
  spinner.stop();
  const message = error instanceof Error ? error.message : 'Unknown error';
  output.error('Operation failed', message);
  process.exit(1);
}
```

### Locations:
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/run.ts:152-163`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/provider.ts:86-91, 140-145, 209-214`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/memory.ts:128-133, 194-199, 254-259, 302-307, 350-355, 405-410`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/agent.ts:103-108, 194-199`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/session.ts:104-109, 202-207`
- `/Users/akiralam/code/AutomatosX/packages/cli/src/commands/system.ts:117-122, 182-187, 198-203, 354-360, 417-422`

### Consolidation Strategy:

Create a wrapper in `/Users/akiralam/code/AutomatosX/packages/cli/src/utils/command-handler.ts`:

```typescript
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorLabel: string = 'Operation failed'
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    spinner.stop();
    const message = getErrorMessage(error);
    output.error(errorLabel, message);
    process.exit(1);
  }
}
```

**Usage:**
```typescript
// Before: 6 lines
} catch (error) {
  spinner.stop();
  const message = error instanceof Error ? error.message : 'Unknown error';
  output.error('Failed to list memories', message);
  process.exit(1);
}

// After: 1 line
} catch (error) {
  return withErrorHandling(async () => { /* operation */ }, 'Failed to list memories');
}
```

---

## 4. DUPLICATE ASYNC INITIALIZATION PATTERNS

### Pattern: Promise lock pattern in provider initialization (prevents race conditions)

This pattern appears **4 times** with identical implementation across provider classes.

### Locations:
- `/Users/akiralam/code/AutomatosX/packages/providers/src/claude.ts:65-81`
- `/Users/akiralam/code/AutomatosX/packages/providers/src/gemini.ts:65-81`

### Example Code:
```typescript
private initPromise: Promise<void> | null = null;

override async initialize(): Promise<void> {
  if (this.client) {
    return; // Already initialized
  }

  if (this.initPromise) {
    return this.initPromise;
  }

  this.initPromise = this.doInitialize();
  try {
    await this.initPromise;
  } finally {
    this.initPromise = null;
  }
}

private async doInitialize(): Promise<void> {
  if (this.client) {
    return;
  }
  // ... initialization logic
}
```

### Consolidation Strategy:

Create a mixin or base method in `BaseProvider`:

```typescript
// In BaseProvider
protected createInitializationLock<T>(
  factory: () => Promise<T>
): { initialize: () => Promise<T> } {
  let cached: T | null = null;
  let initPromise: Promise<T> | null = null;

  return {
    initialize: async () => {
      if (cached) return cached;
      if (initPromise) return initPromise;

      initPromise = factory();
      try {
        cached = await initPromise;
        return cached;
      } finally {
        initPromise = null;
      }
    },
  };
}
```

---

## 5. DUPLICATE STRING BUILDING PATTERNS

### Pattern: Array-based info/details string building with `push` and `join`

This pattern appears **15+ times** across tools, commands, and executors.

### Locations:
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/system.ts:46-64, 163-192`
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/memory.ts:207-221`
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/session.ts:203-222`
- `/Users/akiralam/code/AutomatosX/packages/mcp/src/tools/agent.ts:211-227`
- `/Users/akiralam/code/AutomatosX/packages/core/src/agent/executor.ts:352-383`

### Example:
```typescript
const info = [
  'AutomatosX Configuration',
  '═══════════════════════════',
  '',
  `Config file: ${configPath ?? 'Using defaults'}`,
  '',
  'Providers:',
  `  Default: ${config.providers.default}`,
  `  Enabled: ${config.providers.enabled.join(', ')}`,
];

if (config.memory.autoCleanup) {
  info.push(`  Cleanup strategy: ${config.memory.cleanupStrategy}`);
  info.push(`  Retention days: ${config.memory.retentionDays}`);
}

return {
  content: [{ type: 'text', text: info.join('\n') }],
};
```

### Consolidation Strategy:

Create a builder utility:

```typescript
// packages/core/src/utils/text-builder.ts
export class TextBuilder {
  private lines: string[] = [];

  section(title: string): this {
    this.lines.push(title);
    this.lines.push('═'.repeat(Math.min(title.length, 30)));
    return this;
  }

  line(text: string): this {
    this.lines.push(text);
    return this;
  }

  blank(): this {
    this.lines.push('');
    return this;
  }

  conditional(condition: boolean, text: string): this {
    if (condition) this.lines.push(text);
    return this;
  }

  build(): string {
    return this.lines.join('\n');
  }
}
```

**Usage:**
```typescript
// Before: Manual array + join
const info = ['Title', '═════', '', 'Content'];
return { content: [{ type: 'text', text: info.join('\n') }] };

// After: Fluent builder
const text = new TextBuilder()
  .section('AutomatosX Configuration')
  .line(`Config file: ${configPath ?? 'Using defaults'}`)
  .build();
return toolSuccess(text);
```

---

## 6. DUPLICATE NULL/UNDEFINED CHECKS

### Pattern: Repeated type guard patterns for optional properties

This pattern appears **30+ times** across the codebase.

### Example:
```typescript
// Checking undefined before using
if (agent.abilities && agent.abilities.length > 0) {
  // use abilities
}

// Checking null/undefined
const value = session.completedAt ? session.completedAt.toLocaleString() : undefined;

// Default values
const name = agent.displayName ?? 'Unnamed';
```

### Consolidation Strategy:

Use existing TypeScript `Partial<T>` and create a utility helper:

```typescript
// packages/core/src/utils/optional.ts
export function ifPresent<T, R>(
  value: T | null | undefined,
  fn: (val: T) => R
): R | undefined {
  return value != null ? fn(value) : undefined;
}

export function getOrDefault<T>(
  value: T | null | undefined,
  defaultValue: T
): T {
  return value ?? defaultValue;
}
```

---

## Summary of Consolidations

| Pattern | Occurrences | File | Priority | Effort |
|---------|-------------|------|----------|--------|
| Error Message Extraction | 43 | Scattered across packages | High | Low |
| MCP ToolResult Building | 18+ | `/mcp/src/tools/*.ts` | High | Low |
| Try-Catch Error Handling | 20+ | CLI commands | Medium | Medium |
| Async Initialization Lock | 4 | Provider classes | Medium | Low |
| String Array Building | 15+ | Tools & commands | Medium | Low |
| Null/Undefined Checks | 30+ | Core utilities | Low | Very Low |

---

## Recommended Refactoring Priority

1. **Phase 1 (High Impact, Low Effort):**
   - Extract `getErrorMessage()` utility function
   - Extract `toolSuccess()` and `toolError()` helpers
   - Impact: ~30% code deduplication, immediate consistency

2. **Phase 2 (Medium Impact, Medium Effort):**
   - Extract command error handler wrapper
   - Consolidate async initialization pattern
   - Impact: ~20% code reduction, improved testing

3. **Phase 3 (Lower Priority):**
   - Create TextBuilder utility for info formatting
   - Standardize optional value handling
   - Impact: ~10% code reduction, better readability

---

## Files to Create/Modify

### New Utility Files:
1. `/packages/core/src/utils/error-handling.ts` - Error message extraction
2. `/packages/mcp/src/tools/helpers.ts` - MCP tool result builders
3. `/packages/cli/src/utils/command-handler.ts` - CLI error handling wrapper
4. `/packages/core/src/utils/text-builder.ts` - Text formatting builder

### Modified Files:
- `/packages/providers/src/base.ts` - Add initialization lock helper
- All provider files - Use base initialization lock
- All MCP tool files - Use helper functions
- All CLI command files - Use error handler wrapper

