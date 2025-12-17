# PRD: CLI Integration for Context, Config, and Iterate Mode

## Product Requirements Document

### 1. Overview

**Feature**: CLI Integration for High-Value Features
**Version**: v14.1.0
**Date**: 2025-12-15
**Dependencies**: context-domain, iterate-domain, config-domain (all implemented)

### 2. Problem Statement

The core domain packages for context loading, config resolution, and iterate mode are implemented and tested, but they are not yet wired into the CLI. Users cannot:

1. Use `--iterate` flag for autonomous multi-step execution
2. Benefit from automatic project context injection
3. Have their `.automatosx/config.json` settings applied
4. Bootstrap a new project with `ax setup`

### 3. Goals

| Goal | Success Metric |
|------|----------------|
| Enable iterate mode via CLI | `ax call --iterate "task"` works |
| Auto-inject project context | Context from `.automatosx/context/` is sent to LLM |
| Apply resolved config | User + project config merged and used |
| Bootstrap project structure | `ax setup` creates `.automatosx/` folder |

### 4. Non-Goals

- Modifying the underlying domain packages (already complete)
- Adding new contract schemas
- Changing provider adapters

### 5. Requirements

#### 5.1 Parser Flags (P0)

**New flags for `ax call` command:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--iterate` | boolean | false | Enable iterate mode |
| `--max-iterations` | number | 20 | Max iterations before stopping |
| `--max-time` | string | "5m" | Max time (e.g., "5m", "10m", "1h") |
| `--no-context` | boolean | false | Skip loading project context |

**Examples:**
```bash
# Basic iterate mode
ax call --iterate "implement user authentication"

# With custom limits
ax call --iterate --max-iterations 50 "refactor the entire API"

# With time limit
ax call --iterate --max-time 10m "add unit tests"

# Skip context loading
ax call --no-context "quick question about syntax"
```

#### 5.2 Call Command Integration (P0)

**Behavior changes:**

1. **Config Resolution**: Before any call, resolve config from:
   - Built-in defaults
   - User config (`~/.automatosx/config.json`)
   - Project config (`.automatosx/config.json`)

2. **Context Injection**: If `.automatosx/context/` exists:
   - Load all `.md` and `.txt` files
   - Prepend to system prompt as "Project Context" section
   - Skip if `--no-context` flag is set

3. **Iterate Mode** (when `--iterate` flag):
   - Create IterateController with budget from config/flags
   - Loop until STOP action or budget exceeded
   - On CONTINUE: auto-proceed with "Continue." response
   - On PAUSE: display reason, wait for user input
   - On STOP: display completion message, exit loop

**State Display:**
```
[Iteration 1/20] Working on task...
[Iteration 2/20] Analyzing codebase...
[Iteration 3/20] PAUSE: Which auth method? JWT or session-based?
> jwt
[Iteration 4/20] Implementing JWT authentication...
[Iteration 5/20] COMPLETE: Task finished successfully.
```

#### 5.3 Setup Command Enhancement (P1)

**New behavior for `ax setup`:**

```bash
$ ax setup

Creating .automatosx/ structure...
✓ Created .automatosx/config.json
✓ Created .automatosx/context/conventions.md (template)

Setup complete!
- Edit .automatosx/context/conventions.md to add your project conventions
- Edit .automatosx/config.json to customize settings
```

**Files created:**

1. `.automatosx/config.json`:
```json
{
  "version": "1.0.0",
  "defaultProvider": "claude",
  "iterate": {
    "maxIterations": 20,
    "maxTimeMs": 300000,
    "autoConfirm": false
  }
}
```

2. `.automatosx/context/conventions.md`:
```markdown
# Project Conventions

## Code Style
<!-- Describe your coding standards -->
- Example: Use TypeScript strict mode
- Example: Prefer functional components

## Architecture
<!-- Describe your project structure -->
- Example: Domain-driven design
- Example: Contract-first with Zod schemas

## Testing
<!-- Describe testing practices -->
- Example: Use vitest for unit tests
- Example: Co-locate tests with source files
```

#### 5.4 Iterate Command (P2 - New Command)

**New dedicated command for iterate mode:**

```bash
# Equivalent to: ax call --iterate "task"
ax iterate "implement feature X"

# With options
ax iterate --max-iterations 50 --max-time 10m "complex task"
```

This provides a cleaner UX for the common iterate use case.

### 6. Technical Design

#### 6.1 File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/parser.ts` | Modify | Add new flags |
| `packages/cli/src/types.ts` | Modify | Add flag types |
| `packages/cli/src/commands/call.ts` | Modify | Integrate context + iterate |
| `packages/cli/src/commands/setup.ts` | Modify | Create folder structure |
| `packages/cli/src/commands/iterate.ts` | New | Dedicated iterate command |
| `packages/cli/src/commands/index.ts` | Modify | Export iterate command |

#### 6.2 Dependencies

```typescript
// New imports in call.ts
import { ConfigResolver } from '@automatosx/config-domain';
import { ContextLoader } from '@automatosx/context-domain';
import { IterateController } from '@automatosx/iterate-domain';
```

#### 6.3 Time Parsing Utility

```typescript
function parseTime(timeStr: string): number {
  const match = timeStr.match(/^(\d+)(s|m|h)$/);
  if (!match) throw new Error(`Invalid time format: ${timeStr}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}
```

### 7. User Experience

#### 7.1 Normal Mode (unchanged)

```bash
$ ax call "explain this code"
# Single LLM call, displays response, exits
```

#### 7.2 Iterate Mode

```bash
$ ax call --iterate "implement user authentication"

Loading project context from .automatosx/context/...
  ✓ Loaded conventions.md (2.1 KB)
  ✓ Loaded architecture.md (1.5 KB)

Starting iterate mode (max 20 iterations, 5m timeout)...

[1/20] Analyzing requirements...
       Creating auth module structure.

[2/20] Implementing user model...
       Added User interface and validation.

[3/20] PAUSE: Which database should I use?
       Options: PostgreSQL, SQLite, or MongoDB?

> postgresql

[4/20] Setting up PostgreSQL connection...
       Created database schema.

[5/20] Implementing login endpoint...
       Added /api/auth/login route.

[6/20] COMPLETE: User authentication implemented.

Summary:
- Created 5 files
- Modified 2 files
- All tests passing

Total: 6 iterations, 2m 34s
```

#### 7.3 Budget Exceeded

```bash
$ ax call --iterate --max-iterations 3 "very complex task"

[1/3] Starting work...
[2/3] Making progress...
[3/3] Still working...

STOPPED: Budget exceeded (iterations: 3/3)
Task incomplete. Run again with higher --max-iterations to continue.
```

### 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid `--max-time` format | Error: "Invalid time format. Use: 5m, 10m, 1h" |
| No provider configured | Error: "No provider configured. Run 'ax setup' first." |
| Context file too large | Warning: "Skipped large.md (exceeds 50KB limit)" |
| Dangerous command detected | PAUSE with safety warning |
| Ctrl+C during iterate | Graceful stop, show summary |

### 9. Testing Strategy

#### 9.1 Unit Tests

```typescript
// tests/cli/iterate-integration.test.ts
describe('Iterate CLI Integration', () => {
  it('should parse --iterate flag');
  it('should parse --max-iterations flag');
  it('should parse --max-time flag');
  it('should load and inject project context');
  it('should run iterate loop until STOP');
  it('should pause on PAUSE action');
  it('should stop on budget exceeded');
});
```

#### 9.2 Integration Tests

```typescript
// tests/application/iterate-e2e.test.ts
describe('Iterate E2E', () => {
  it('should complete simple iterate task');
  it('should respect max iterations');
  it('should inject context into prompt');
});
```

### 10. Rollout Plan

1. **Phase 1**: Parser flags + types (no behavior change)
2. **Phase 2**: Context injection in call command
3. **Phase 3**: Iterate mode in call command
4. **Phase 4**: Setup command enhancement
5. **Phase 5**: Dedicated iterate command

### 11. Success Criteria

- [ ] `ax call --iterate "task"` starts iterate loop
- [ ] `ax call` auto-loads `.automatosx/context/` files
- [ ] Config resolution applies user + project settings
- [ ] `ax setup` creates folder structure
- [ ] All existing tests still pass
- [ ] New integration tests pass

---

## Action Plan

### Task 1: Update Types
**File**: `packages/cli/src/types.ts`
- Add `iterate`, `maxIterations`, `maxTime`, `noContext` to CallOptions

### Task 2: Update Parser
**File**: `packages/cli/src/parser.ts`
- Add flag definitions for new options
- Add time parsing utility

### Task 3: Update Call Command
**File**: `packages/cli/src/commands/call.ts`
- Import domain packages
- Add context loading logic
- Add iterate loop logic
- Add progress display

### Task 4: Update Setup Command
**File**: `packages/cli/src/commands/setup.ts`
- Add folder structure creation
- Add template file generation

### Task 5: Create Iterate Command
**File**: `packages/cli/src/commands/iterate.ts`
- Create dedicated iterate command
- Delegate to call with --iterate flag

### Task 6: Update Command Index
**File**: `packages/cli/src/commands/index.ts`
- Export iterate command

### Task 7: Add Tests
**File**: `tests/cli/iterate-integration.test.ts`
- Test flag parsing
- Test iterate behavior
- Test context loading

### Estimated Lines of Code

| File | Lines |
|------|-------|
| types.ts | +15 |
| parser.ts | +40 |
| call.ts | +120 |
| setup.ts | +60 |
| iterate.ts | +50 |
| index.ts | +5 |
| tests | +100 |
| **Total** | ~390 |
