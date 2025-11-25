# AutomatosX Duplicate Code Refactoring Examples

## Quick Reference Guide

This document provides concrete code examples showing before/after refactoring for each duplicate pattern identified.

---

## Pattern 1: Error Message Extraction

### Current State (43 occurrences)

**File:** `/packages/cli/src/commands/run.ts:154`
```typescript
} catch (error) {
  spinner.stop();
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (argv.json) {
    output.json({ error: message });
  } else {
    output.error('Execution failed', message);
  }
  process.exit(1);
}
```

**File:** `/packages/mcp/src/tools/system.ts:79`
```typescript
catch (error) {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    ],
    isError: true,
  };
}
```

### After Refactoring

**New File:** `/packages/core/src/utils/error-handling.ts`
```typescript
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
```

**Updated:** `/packages/cli/src/commands/run.ts:154`
```typescript
import { getErrorMessage } from '@ax/core/utils/error-handling';

} catch (error) {
  spinner.stop();
  const message = getErrorMessage(error);
  if (argv.json) {
    output.json({ error: message });
  } else {
    output.error('Execution failed', message);
  }
  process.exit(1);
}
```

**Updated:** `/packages/mcp/src/tools/system.ts:79`
```typescript
import { getErrorMessage } from '@ax/core/utils/error-handling';

catch (error) {
  return toolError(error);
}
```

---

## Pattern 2: MCP Tool Result Building

### Current State (18+ occurrences)

**File:** `/packages/mcp/src/tools/memory.ts:88-105`
```typescript
return {
  content: [
    {
      type: 'text',
      text: `Found ${result.total} memories:\n\n${formattedResults}`,
    },
  ],
};
```

...and in error handling:
```typescript
} catch (error) {
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    ],
    isError: true,
  };
}
```

### After Refactoring

**New File:** `/packages/mcp/src/tools/helpers.ts`
```typescript
import { getErrorMessage } from '@ax/core/utils/error-handling';
import type { ToolResult } from '../types.js';

export function toolSuccess(text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

export function toolError(error: unknown): ToolResult {
  const message = getErrorMessage(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

export function toolSuccessJson(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}
```

**Updated:** `/packages/mcp/src/tools/memory.ts`
```typescript
import { toolSuccess, toolError } from './helpers.js';
import { getErrorMessage } from '@ax/core/utils/error-handling';

// In execute():
return toolSuccess(`Found ${result.total} memories:\n\n${formattedResults}`);

// In error handler:
} catch (error) {
  return toolError(error);
}
```

---

## Pattern 3: CLI Command Error Handling

### Current State (20+ occurrences)

**File:** `/packages/cli/src/commands/memory.ts:128-133`
```typescript
} catch (error) {
  spinner.stop();
  const message = error instanceof Error ? error.message : 'Unknown error';
  output.error('Search failed', message);
  process.exit(1);
}
```

**File:** `/packages/cli/src/commands/provider.ts:86-91`
```typescript
} catch (error) {
  spinner.stop();
  const message = error instanceof Error ? error.message : 'Unknown error';
  output.error('Failed to list providers', message);
  process.exit(1);
}
```

### After Refactoring

**New File:** `/packages/cli/src/utils/command-handler.ts`
```typescript
import { getErrorMessage } from '@ax/core/utils/error-handling';
import * as output from './output.js';
import * as spinner from './spinner.js';

export function handleCommandError(
  error: unknown,
  message: string = 'Operation failed'
): never {
  spinner.stop();
  const errorMsg = getErrorMessage(error);
  output.error(message, errorMsg);
  process.exit(1);
}

// For async operations with JSON fallback
export async function executeCommand<T>(
  operation: () => Promise<T>,
  errorMessage: string,
  argv: { json?: boolean }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (argv.json) {
      output.json({ error: getErrorMessage(error) });
    } else {
      handleCommandError(error, errorMessage);
    }
    // Unreachable but for type safety
    throw error;
  }
}
```

**Updated:** `/packages/cli/src/commands/memory.ts`
```typescript
import { handleCommandError } from '../utils/command-handler.js';

} catch (error) {
  handleCommandError(error, 'Search failed');
}
```

**Updated:** `/packages/cli/src/commands/provider.ts`
```typescript
import { handleCommandError } from '../utils/command-handler.js';

} catch (error) {
  handleCommandError(error, 'Failed to list providers');
}
```

---

## Pattern 4: Async Initialization Lock

### Current State (identical in Claude & Gemini providers)

**File:** `/packages/providers/src/claude.ts:65-81`
```typescript
private client: Client | null = null;
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
  // ... implementation
}
```

**File:** `/packages/providers/src/gemini.ts:65-81` - IDENTICAL CODE

### After Refactoring

**Modified:** `/packages/providers/src/base.ts`
```typescript
export abstract class BaseProvider {
  // ... existing code ...

  /**
   * Create an initialization lock for concurrent-safe initialization
   */
  protected createInitializationLock<T>(
    factory: () => Promise<T>
  ): { initialize: () => Promise<T> } {
    let cached: T | null = null;
    let initPromise: Promise<T | null> | null = null;

    return {
      initialize: async (): Promise<T> => {
        if (cached != null) {
          return cached;
        }

        if (initPromise) {
          const result = await initPromise;
          if (result != null) return result;
        }

        initPromise = factory().then(
          (result) => {
            cached = result;
            return result;
          },
          (error) => {
            initPromise = null;
            throw error;
          }
        );

        return initPromise;
      },
    };
  }
}
```

**Updated:** `/packages/providers/src/claude.ts`
```typescript
export class ClaudeProvider extends BaseProvider {
  readonly id = 'claude' as const;
  readonly name = 'Claude Code';
  readonly integrationMode = 'mcp' as const;

  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private readonly command: string;
  private readonly args: string[];
  private initLock = this.createInitializationLock(() => this.doInitialize());

  constructor(options?: { command?: string; args?: string[] }) {
    super();
    this.command = options?.command ?? DEFAULT_COMMAND;
    this.args = options?.args ?? DEFAULT_ARGS;
  }

  override async initialize(): Promise<void> {
    await this.initLock.initialize();
  }

  private async doInitialize(): Promise<void> {
    // Double-check after acquiring lock
    if (this.client) {
      return;
    }
    // ... implementation ...
  }
}
```

**Updated:** `/packages/providers/src/gemini.ts` - Same pattern applied

---

## Pattern 5: String Building with Arrays

### Current State (15+ occurrences)

**File:** `/packages/mcp/src/tools/system.ts:163-186`
```typescript
const fallbackOrder = config.providers.fallbackOrder ?? config.providers.enabled;
const info = [
  'AutomatosX Configuration',
  '═══════════════════════════',
  '',
  `Config file: ${configPath ?? 'Using defaults'}`,
  '',
  'Providers:',
  `  Default: ${config.providers.default}`,
  `  Enabled: ${config.providers.enabled.join(', ')}`,
  `  Fallback order: ${fallbackOrder.join(' → ')}`,
  '',
  'Router:',
  `  Health check interval: ${formatDuration(config.router.healthCheckInterval)}`,
];

if (config.memory.autoCleanup) {
  info.push(`  Cleanup strategy: ${config.memory.cleanupStrategy}`);
  info.push(`  Retention days: ${config.memory.retentionDays}`);
}

return {
  content: [{ type: 'text', text: info.join('\n') }],
};
```

### After Refactoring

**New File:** `/packages/core/src/utils/text-builder.ts`
```typescript
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
    if (condition) {
      this.lines.push(text);
    }
    return this;
  }

  lines_(...items: string[]): this {
    this.lines.push(...items);
    return this;
  }

  build(): string {
    return this.lines.join('\n');
  }
}
```

**Updated:** `/packages/mcp/src/tools/system.ts`
```typescript
import { TextBuilder } from '@ax/core/utils/text-builder';
import { toolSuccess } from './helpers.js';

const fallbackOrder = config.providers.fallbackOrder ?? config.providers.enabled;
const text = new TextBuilder()
  .section('AutomatosX Configuration')
  .blank()
  .line(`Config file: ${configPath ?? 'Using defaults'}`)
  .blank()
  .section('Providers')
  .line(`  Default: ${config.providers.default}`)
  .line(`  Enabled: ${config.providers.enabled.join(', ')}`)
  .line(`  Fallback order: ${fallbackOrder.join(' → ')}`)
  .blank()
  .section('Router')
  .line(`  Health check interval: ${formatDuration(config.router.healthCheckInterval)}`)
  .conditional(config.memory.autoCleanup, `  Cleanup strategy: ${config.memory.cleanupStrategy}`)
  .conditional(config.memory.autoCleanup, `  Retention days: ${config.memory.retentionDays}`)
  .build();

return toolSuccess(text);
```

---

## Pattern 6: Optional Value Handling

### Current State (30+ occurrences)

**File:** `/packages/mcp/src/tools/agent.ts:217-221`
```typescript
if (agent.abilities && agent.abilities.length > 0) {
  info.push(`Abilities: ${agent.abilities.join(', ')}`);
}
```

**File:** `/packages/mcp/src/tools/session.ts:220-222`
```typescript
if (session.tags.length > 0) {
  info.push(`Tags: ${session.tags.join(', ')}`);
}
```

### After Refactoring

**New File:** `/packages/core/src/utils/optional.ts`
```typescript
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

export function ifPresentPush<T>(
  array: string[],
  value: T | null | undefined,
  formatter: (val: T) => string
): void {
  if (value != null) {
    array.push(formatter(value));
  }
}
```

**Updated:** `/packages/mcp/src/tools/agent.ts`
```typescript
import { ifPresentPush } from '@ax/core/utils/optional';

const info: string[] = [
  `Agent: ${agent.displayName} (${agent.name})`,
  `Description: ${agent.description ?? 'No description'}`,
  `Team: ${agent.team}`,
  `Role: ${agent.role}`,
  `Status: ${agent.enabled ? 'Enabled' : 'Disabled'}`,
];

ifPresentPush(info, agent.abilities, (abilities) =>
  abilities.length > 0 ? `Abilities: ${abilities.join(', ')}` : ''
);
```

---

## Migration Strategy

### Step 1: Create New Utility Files
```bash
cd /Users/akiralam/code/AutomatosX

# Create utilities directory if not exists
mkdir -p packages/core/src/utils

# Create new files
touch packages/core/src/utils/error-handling.ts
touch packages/core/src/utils/text-builder.ts
touch packages/core/src/utils/optional.ts
touch packages/mcp/src/tools/helpers.ts
touch packages/cli/src/utils/command-handler.ts
```

### Step 2: Add Imports to Barrels
Update barrel exports in `packages/core/src/utils/index.ts`:
```typescript
export * from './error-handling.js';
export * from './text-builder.js';
export * from './optional.js';
```

### Step 3: Refactor by Phase
1. Error handling utilities first (highest impact)
2. MCP tool helpers next (isolated changes)
3. CLI command handler (coordinated changes)
4. Text builder and optional utilities (lower priority)

### Step 4: Testing
- Run existing tests to ensure backward compatibility
- Add tests for new utility functions
- Verify all duplicate locations have been refactored

---

## Code Size Impact

Based on the analysis:

| Component | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Error message extraction | ~215 bytes × 43 | ~25 bytes × 43 | ~8.2 KB |
| Tool result builders | ~350 bytes × 18 | ~85 bytes × 18 | ~4.8 KB |
| CLI error handling | ~250 bytes × 20 | ~50 bytes × 20 | ~4 KB |
| String builders | ~400 bytes × 15 | ~150 bytes × 15 | ~3.75 KB |
| **Total Reduction** | | | **~20.75 KB** |

**Plus maintainability gains:**
- Single source of truth for error handling
- Consistent patterns across all tools
- Easier to update error messages globally
- Better testing of utility functions

