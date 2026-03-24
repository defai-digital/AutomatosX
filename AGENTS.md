# AGENTS.md - Coding Agent Guidelines

## Build, Lint, and Test Commands

```bash
npm test                    # Run all tests (or: vitest run)
npm run test:migration      # Migration tests
npm run test:cli            # CLI package tests

# Run a single test file
vitest run packages/cli/tests/workflow-adapter.test.ts

# Run a single test by name pattern
vitest run -t "builds command-specific previews"

vitest watch                # Watch mode
npx tsc --noEmit            # Type checking
```

No explicit build step required - TypeScript compiles on-demand via path aliases.

## Project Structure

```
automatosx/
├── packages/
│   ├── cli/                 # CLI app: commands/, utils/, tests/
│   ├── contracts/           # Shared types and Zod schemas
│   ├── mcp-server/          # MCP server implementation
│   ├── monitoring/          # Monitoring and observability
│   ├── shared-runtime/      # Runtime service integration
│   ├── state-store/         # State persistence
│   ├── trace-store/         # Trace/execution history
│   └── workflow-engine/     # Core workflow execution engine
├── tests/migration/         # Integration tests
└── vitest.config.ts
```

## Code Style Guidelines

### Imports

```typescript
import { existsSync } from 'node:fs';           // Node built-ins: 'node:' prefix
import { join } from 'node:path';
import type { CommandResult } from '../types.js'; // Type-only: 'import type'
import { failure, success } from '../utils/formatters.js'; // ES modules: .js extension required
```

- **Node builtins**: Always use `node:` prefix
- **Local imports**: Always include `.js` extension (TypeScript ESM requirement)
- **Type imports**: Use `import type { }` for type-only imports

### Formatting

- **Indentation**: 2 spaces | **Semicolons**: Required | **Quotes**: Single quotes
- **Trailing commas**: Required in multiline structures | **Max line width**: 100 chars

### Types and Interfaces

```typescript
// Interfaces for object shapes
export interface WorkflowDefinition {
  workflowId: string;
  name?: string;              // Optional: use ?
  steps: WorkflowStep[];
}

// Optional fields can use | undefined explicitly
export interface StepResult {
  success: boolean;
  output?: unknown;
  error?: StepError | undefined;
}

// Type for unions and function signatures
export type StepExecutor = (step: WorkflowStep, context: StepContext) => Promise<StepResult>;

// Constants object with as const for literal types
export const WorkflowErrorCodes = {
  VALIDATION_ERROR: 'WORKFLOW_VALIDATION_ERROR',
  STEP_TIMEOUT: 'WORKFLOW_STEP_TIMEOUT',
} as const;

export type WorkflowErrorCode = (typeof WorkflowErrorCodes)[keyof typeof WorkflowErrorCodes];
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `workflow-adapter.ts` |
| Functions | camelCase | `createWorkflowRunner` |
| Interfaces/Types | PascalCase | `WorkflowDefinition` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_WORKFLOW_DIRS` |
| Unused params | Underscore prefix | `_args`, `_options` |

### Function Patterns

```typescript
// Factory functions use 'create' prefix
export function createWorkflowLoader(config: WorkflowLoaderConfig): WorkflowLoader {
  return {
    async load(workflowId: string): Promise<WorkflowDefinition | undefined> { /* ... */ },
  };
}

// Explicit return types on exported functions
export async function runCommand(args: string[], options: CLIOptions): Promise<CommandResult> { /* ... */ }

// Validation: return null on success, error message on failure
function validateInput(input: WorkflowInput): string | null {
  if (!input.request) return 'A request is required';
  return null;
}

// Parse/validation functions return result objects
function parseInputJson(input?: string): { valid: boolean; value: Record<string, unknown>; error?: string } {
  if (input === undefined) return { valid: true, value: {} };
  // ...
}
```

### Error Handling

```typescript
// Error objects: code, message, optional retryable flag and details
interface StepError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown> | undefined;
}

// Result pattern with success boolean
interface CommandResult {
  success: boolean;
  message: string | undefined;
  data: unknown;
  exitCode: number;
}

// Helper functions
export function failure(message: string, data: unknown = undefined): CommandResult {
  return { success: false, message, data, exitCode: 1 };
}

export function failureFromError(action: string, error: unknown): CommandResult {
  const message = error instanceof Error ? error.message : String(error);
  return failure(`Failed to ${action}: ${message}`);
}
```

### Null vs Undefined

- Use `undefined` for optional values, not `null`
- Check explicitly: `if (workflow === undefined)`
- Use optional chaining and nullish coalescing: `options.workflowDir ?? runtime.findWorkflowDir?.(process.cwd())`

### Testing Patterns

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rm } from 'node:fs/promises';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('module name', () => {
  let tempDir: string;

  beforeEach(() => { tempDir = createTempDir(); });
  afterEach(async () => { await rm(tempDir, { recursive: true, force: true }); });

  it('describes expected behavior', async () => {
    const result = await functionUnderTest(input);
    expect(result.success).toBe(true);
  });
});
```

### JSDoc Comments

Use JSDoc for public APIs only: `/** CLI options */ export interface CLIOptions { help: boolean; }`

## TypeScript Configuration

- **Target**: ES2022 | **Module**: NodeNext | **Strict mode**: Enabled
- **Path aliases** (use these instead of relative imports across packages):
  - `@defai.digital/contracts`
  - `@defai.digital/mcp-server`
  - `@defai.digital/monitoring`
  - `@defai.digital/shared-runtime`
  - `@defai.digital/state-store`
  - `@defai.digital/trace-store`
  - `@defai.digital/workflow-engine`

## Important Notes

1. **No comments in code** unless explicitly requested - prefer self-documenting code
2. **Temporary files** → `automatosx/tmp/`
3. **PRD files** → `automatosx/prd/`
4. **Do not add Claude Code as Co-Author** in commits
5. Run `npx tsc --noEmit` after changes to verify correctness
