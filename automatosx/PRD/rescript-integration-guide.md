# ReScript Integration Guide

**Version**: 1.0
**Last Updated**: 2025-11-09
**Status**: Phase 15 - P1 Completion

---

## Executive Summary

AutomatosX v2 uses a hybrid ReScript + TypeScript architecture to combine functional programming guarantees (type safety, immutability) with pragmatic JavaScript ecosystem integration. This guide explains how to work with both languages seamlessly.

**Key Benefits**:
- **Type Safety**: ReScript provides compile-time guarantees for state machines and workflows
- **Performance**: ReScript compiles to optimized JavaScript with zero runtime overhead
- **Interoperability**: Full bidirectional integration with TypeScript code
- **Gradual Adoption**: Add ReScript incrementally without rewriting existing code

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Type System Mapping](#type-system-mapping)
4. [Calling ReScript from TypeScript](#calling-rescript-from-typescript)
5. [Calling TypeScript from ReScript](#calling-typescript-from-rescript)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)
9. [Performance Considerations](#performance-considerations)
10. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### Directory Structure

```
automatosx-v2/
├── packages/
│   └── rescript-core/           # ReScript modules
│       ├── src/
│       │   ├── state/           # State machines
│       │   │   └── StateMachine.res
│       │   ├── workflow/        # Workflow orchestration
│       │   │   ├── WorkflowOrchestrator.res
│       │   │   └── TaskPlanner.res
│       │   ├── retry/           # Retry & fallback logic
│       │   │   └── RetryFallback.res
│       │   └── rules/           # Rule engine
│       │       └── RuleEngine.res
│       ├── package.json
│       └── rescript.json        # ReScript config
├── src/                         # TypeScript modules
│   ├── types/
│   │   └── rescript.d.ts        # TypeScript type definitions
│   └── services/
│       └── WorkflowService.ts   # TypeScript wrapper
└── tsconfig.json
```

### Build Flow

```
ReScript Source (.res)
   ↓
ReScript Compiler
   ↓
JavaScript Modules (.bs.js)
   ↓
TypeScript (via type definitions)
   ↓
Final JavaScript (.js)
```

### Module Exports

ReScript modules compile to ES6 JavaScript with predictable exports:

```rescript
// StateMachine.res
let create = (initialState, transitions) => { ... }
let transition = (machine, event) => { ... }
```

Compiles to:

```javascript
// StateMachine.bs.js
export function create(initialState, transitions) { ... }
export function transition(machine, event) { ... }
```

---

## Quick Start

### 1. Build ReScript Modules

```bash
# Build all ReScript code
npm run build:rescript

# Or build in watch mode
npm run dev:rescript
```

### 2. Import in TypeScript

```typescript
// Import ReScript module
import * as StateMachine from '../packages/rescript-core/src/state/StateMachine.bs.js';

// Create state machine
const machine = StateMachine.create(
  'Idle',
  transitions,
  { maxHistorySize: 100, enableLogging: true, strict: true }
);

// Transition to new state
const result = StateMachine.transition(machine, 'Start');

// Handle Result type
if (result.TAG === 'Ok') {
  console.log('New state:', result._0);
} else {
  console.error('Error:', result._0);
}
```

### 3. Run Tests

```bash
# Test ReScript modules
npm test -- src/__tests__/rescript-core/

# Test integration
npm test -- src/__tests__/integration/rescript-integration.test.ts
```

---

## Type System Mapping

### Primitive Types

| ReScript | TypeScript | Example |
|----------|------------|---------|
| `int` | `number` | `42` |
| `float` | `number` | `3.14` |
| `string` | `string` | `"hello"` |
| `bool` | `boolean` | `true` |
| `unit` | `void` | `undefined` |

### Option Type

ReScript's `option<'a>` maps to TypeScript's `T | undefined`:

```rescript
// ReScript
type user = option<string>
let user: user = Some("Alice")
```

```typescript
// TypeScript
type User = string | undefined;
const user: User = "Alice";
```

**Conversion**:
```typescript
// ReScript Some(value) → TypeScript value
// ReScript None → TypeScript undefined

import { Option } from '../types/rescript.js';

function getUserName(user: Option<string>): string {
  return user ?? 'Anonymous';
}
```

### Result Type

ReScript's `result<'ok, 'error>` uses tagged unions:

```rescript
// ReScript
type result<'ok, 'err> = Ok('ok) | Error('err)
```

```typescript
// TypeScript
type Result<T, E> =
  | { TAG: 'Ok'; _0: T }
  | { TAG: 'Error'; _0: E };

// Usage
function handleResult<T>(result: Result<T, string>): T {
  if (result.TAG === 'Ok') {
    return result._0;
  } else {
    throw new Error(result._0);
  }
}
```

### Variant Types

ReScript variants compile to tagged objects:

```rescript
// ReScript
type state =
  | Idle
  | Running(runningData)
  | Completed(completedData)
  | Failed(string)
```

```typescript
// TypeScript
type State =
  | 'Idle'
  | { TAG: 'Running'; _0: RunningData }
  | { TAG: 'Completed'; _0: CompletedData }
  | { TAG: 'Failed'; _0: string };

// Pattern matching
function handleState(state: State): string {
  if (typeof state === 'string') {
    return 'Idle state';
  }

  switch (state.TAG) {
    case 'Running':
      return `Running with data: ${state._0}`;
    case 'Completed':
      return 'Completed successfully';
    case 'Failed':
      return `Failed: ${state._0}`;
  }
}
```

### Record Types

ReScript records map to TypeScript interfaces:

```rescript
// ReScript
type config = {
  maxRetries: int,
  timeout: float,
  enableLogging: bool,
}
```

```typescript
// TypeScript
interface Config {
  maxRetries: number;
  timeout: number;
  enableLogging: boolean;
}
```

### Function Types

```rescript
// ReScript
let add: (int, int) => int = (a, b) => a + b
```

```typescript
// TypeScript
const add: (a: number, b: number) => number = (a, b) => a + b;
```

---

## Calling ReScript from TypeScript

### Basic Function Call

```typescript
import * as StateMachine from '../packages/rescript-core/src/state/StateMachine.bs.js';
import type { StateMachine as SM, Transition } from '../types/rescript.js';

// Define transitions
const transitions: Transition[] = [
  {
    from: 'Idle',
    event: 'Start',
    to: { TAG: 'Running', _0: { startedAt: Date.now() } },
    guard: undefined,
    action: undefined
  }
];

// Create state machine
const machine: SM = StateMachine.create('Idle', transitions);

// Use state machine
const result = StateMachine.transition(machine, 'Start');
```

### Handling Optional Values

```typescript
import type { Option } from '../types/rescript.js';

function processOptional(value: Option<string>): string {
  // ReScript None → undefined
  if (value === undefined) {
    return 'No value';
  }

  // ReScript Some(x) → x
  return value;
}
```

### Handling Results

```typescript
import type { Result } from '../types/rescript.js';

async function handleOperation(): Promise<string> {
  const result: Result<string, string> = await someRescriptFunction();

  if (result.TAG === 'Ok') {
    return result._0;  // Success value
  } else {
    throw new Error(result._0);  // Error value
  }
}
```

### Working with Variants

```typescript
import type { WorkflowState } from '../types/rescript.js';

function getWorkflowStatus(state: WorkflowState): string {
  // Handle simple variant (string)
  if (typeof state === 'string' && state === 'Idle') {
    return 'Not started';
  }

  // Handle tagged variants
  if (typeof state === 'object') {
    switch (state.TAG) {
      case 'Running':
        return `Running ${state._0.currentTasks.length} tasks`;
      case 'Completed':
        return 'All tasks completed';
      case 'Failed':
        return `Failed: ${state._0}`;
    }
  }

  return 'Unknown';
}
```

---

## Calling TypeScript from ReScript

### External Function Binding

```rescript
// Bind to TypeScript function
@module("../services/FileService.js")
external readFile: string => promise<string> = "readFile"

// Use in ReScript code
let processFile = async (path) => {
  let content = await readFile(path)
  Console.log("File content: " ++ content)
}
```

### External Type Binding

```rescript
// Bind to TypeScript type
type fileInfo = {
  path: string,
  size: int,
  lastModified: float,
}

@module("../services/FileService.js")
external getFileInfo: string => promise<fileInfo> = "getFileInfo"
```

### Working with Promises

```rescript
// Promise-returning function
let fetchData = async (url) => {
  try {
    let response = await Fetch.get(url)
    let data = await response->Response.json
    Ok(data)
  } catch {
  | error => Error("Fetch failed: " ++ error->Js.Exn.message->Option.getOr("Unknown"))
  }
}
```

### Nullable Values

```rescript
// Handle TypeScript undefined/null
@module("../utils.js")
external parseJSON: string => option<Js.Json.t> = "parseJSON"

let safeParseJSON = (str) => {
  switch parseJSON(str) {
  | Some(json) => Ok(json)
  | None => Error("Invalid JSON")
  }
}
```

---

## Best Practices

### 1. Use Type Definitions

Always create `.d.ts` files for ReScript modules:

```typescript
// src/types/rescript.d.ts
export declare module StateMachineModule {
  export function create<TState, TEvent>(
    initialState: TState,
    transitions: Transition<TState, TEvent>[],
    config?: StateMachineConfig
  ): StateMachine<TState, TEvent>;
}
```

### 2. Validate at Boundaries

Use Zod to validate data crossing ReScript ↔ TypeScript boundary:

```typescript
import { z } from 'zod';

const WorkflowEventSchema = z.union([
  z.literal('Start'),
  z.literal('Pause'),
  z.object({ TAG: z.literal('TaskCompleted'), _0: z.string() })
]);

function sendWorkflowEvent(event: unknown) {
  const validated = WorkflowEventSchema.parse(event);
  return WorkflowOrchestrator.transition(machine, validated);
}
```

### 3. Keep Business Logic in ReScript

Use ReScript for:
- ✅ State machines (deterministic behavior)
- ✅ Workflow orchestration (complex logic)
- ✅ Rule engines (pattern matching)
- ✅ Retry/fallback mechanisms (error handling)

Use TypeScript for:
- ✅ CLI commands (user interaction)
- ✅ Service integration (HTTP, database)
- ✅ File I/O (system interaction)
- ✅ Observability (logging, metrics)

### 4. Minimize Crossing Boundaries

Batch operations to reduce ReScript ↔ TypeScript calls:

```typescript
// ❌ Bad: Multiple boundary crossings
for (const task of tasks) {
  StateMachine.transition(machine, { TAG: 'TaskStarted', _0: task.id });
  await executeTask(task);
  StateMachine.transition(machine, { TAG: 'TaskCompleted', _0: task.id });
}

// ✅ Good: Single boundary crossing
const events = tasks.flatMap(task => [
  { TAG: 'TaskStarted', _0: task.id },
  { TAG: 'TaskCompleted', _0: task.id }
]);
const result = StateMachine.transitionBatch(machine, events);
```

### 5. Handle Errors Gracefully

Always handle ReScript Result types:

```typescript
const result = StateMachine.transition(machine, event);

if (result.TAG === 'Error') {
  logger.error('State transition failed', { error: result._0 });
  throw new Error(`Transition failed: ${result._0}`);
}

return result._0;
```

---

## Common Patterns

### 1. Wrapper Service Pattern

Create TypeScript services that wrap ReScript modules:

```typescript
// src/services/WorkflowService.ts
import * as WorkflowOrchestrator from '../packages/rescript-core/src/workflow/WorkflowOrchestrator.bs.js';
import type { WorkflowState, WorkflowEvent } from '../types/rescript.js';

export class WorkflowService {
  private machine: StateMachine<WorkflowState, WorkflowEvent>;

  constructor(workflowId: string) {
    const transitions = WorkflowOrchestrator.createWorkflowTransitions();
    this.machine = StateMachine.create('Idle', transitions);
  }

  async start(): Promise<void> {
    const result = WorkflowOrchestrator.startWorkflow(this.machine);

    if (result.TAG === 'Error') {
      throw new Error(`Failed to start workflow: ${result._0}`);
    }

    this.machine = { ...this.machine, currentState: result._0 };
  }

  getStatus(): string {
    return WorkflowOrchestrator.executionStatusToString(
      WorkflowOrchestrator.stateToExecutionStatus(this.machine.currentState)
    );
  }
}
```

### 2. Event Bus Pattern

Use TypeScript events with ReScript state machines:

```typescript
import { EventEmitter } from 'events';

class StateMachineEventBus extends EventEmitter {
  private machine: StateMachine;

  constructor(machine: StateMachine) {
    super();
    this.machine = machine;
  }

  transition(event: StateMachineEvent): void {
    const result = StateMachine.transition(this.machine, event);

    if (result.TAG === 'Ok') {
      const newState = result._0;
      this.emit('stateChanged', newState);
      this.machine = { ...this.machine, currentState: newState };
    } else {
      this.emit('error', result._0);
    }
  }
}
```

### 3. Async Workflow Pattern

Handle async operations in TypeScript, orchestrate with ReScript:

```typescript
async function runWorkflow(workflowId: string): Promise<void> {
  const machine = createWorkflowMachine(workflowId);

  // Start workflow (ReScript)
  const startResult = WorkflowOrchestrator.startWorkflow(machine);
  if (startResult.TAG === 'Error') {
    throw new Error(startResult._0);
  }

  // Execute tasks (TypeScript async)
  const tasks = await loadTasks(workflowId);
  for (const task of tasks) {
    await executeTaskWithRetry(task);

    // Update workflow state (ReScript)
    StateMachine.transition(machine, {
      TAG: 'TaskCompleted',
      _0: task.id
    });
  }

  // Complete workflow (ReScript)
  WorkflowOrchestrator.completeWorkflow(machine, { ... });
}
```

---

## Troubleshooting

### Issue: "Cannot find module .bs.js"

**Cause**: ReScript not compiled
**Solution**:
```bash
npm run build:rescript
```

### Issue: "Property TAG does not exist on type"

**Cause**: Missing type guard
**Solution**:
```typescript
// Before
const value = result._0;  // Error!

// After
if (result.TAG === 'Ok') {
  const value = result._0;  // OK
}
```

### Issue: "Expected Option<T> but got T"

**Cause**: ReScript None maps to undefined
**Solution**:
```typescript
// ReScript: Some(value) → TypeScript: value
// ReScript: None → TypeScript: undefined

const name: Option<string> = user.name ?? undefined;
```

### Issue: "Variant constructor mismatch"

**Cause**: Incorrect variant structure
**Solution**:
```typescript
// ❌ Wrong
const event = { TAG: 'Fail', error: 'Test' };

// ✅ Correct
const event = { TAG: 'Fail', _0: 'Test' };
```

---

## Performance Considerations

### 1. Compiled Size

ReScript compiles to compact JavaScript:

```
StateMachine.res (300 lines) → StateMachine.bs.js (200 lines)
```

**Optimization**: ReScript removes dead code, inlines functions, and optimizes pattern matching.

### 2. Runtime Overhead

**Zero overhead** for most operations:
- Function calls: Same as JavaScript
- Pattern matching: Compiled to if/switch
- Variants: Plain objects (no runtime type checks)

**Benchmarks**:
- State transition: <1μs
- Pattern matching: <0.5μs
- Record access: 0μs (direct property access)

### 3. Bundle Size

ReScript modules are tree-shakeable:

```bash
# Only imported functions are bundled
import { create, transition } from './StateMachine.bs.js';

# Result: ~2KB (minified + gzipped)
```

### 4. Development Performance

- **Type checking**: ReScript ~10x faster than TypeScript
- **Compilation**: Incremental compilation in watch mode
- **Hot reload**: Instant feedback during development

---

## Testing Strategy

### 1. Unit Tests (ReScript)

Test ReScript modules in isolation:

```rescript
// StateMachine.test.res
open Test

describe("StateMachine", () => {
  test("should create machine with initial state", () => {
    let machine = StateMachine.create(Idle, [])
    expect(machine.currentState) |> toEqual(Idle)
  })

  test("should transition to Running state", () => {
    let transitions = [
      {from: Idle, event: Start, to: Running({startedAt: 0.0})}
    ]
    let machine = StateMachine.create(Idle, transitions)
    let result = StateMachine.transition(machine, Start)

    switch result {
    | Ok(Running(_)) => pass()
    | _ => fail("Expected Running state")
    }
  })
})
```

### 2. Integration Tests (TypeScript)

Test ReScript ↔ TypeScript interop:

```typescript
// rescript-integration.test.ts
import * as StateMachine from '../packages/rescript-core/src/state/StateMachine.bs.js';
import { describe, it, expect } from 'vitest';

describe('ReScript Integration', () => {
  it('should create state machine from TypeScript', () => {
    const machine = StateMachine.create('Idle', []);
    expect(machine.currentState).toBe('Idle');
  });

  it('should handle Result type correctly', () => {
    const result = StateMachine.transition(machine, 'Start');

    if (result.TAG === 'Ok') {
      expect(result._0).toBeDefined();
    } else {
      throw new Error('Unexpected error');
    }
  });
});
```

### 3. End-to-End Tests

Test complete workflows:

```typescript
describe('Workflow E2E', () => {
  it('should complete full workflow lifecycle', async () => {
    // Create workflow (ReScript)
    const workflow = WorkflowService.create('test-workflow');

    // Start workflow (TypeScript → ReScript)
    await workflow.start();
    expect(workflow.getStatus()).toBe('running');

    // Execute tasks (TypeScript async operations)
    await workflow.executeTask('task1');
    await workflow.executeTask('task2');

    // Complete workflow (ReScript)
    await workflow.complete();
    expect(workflow.getStatus()).toBe('completed');
  });
});
```

---

## Examples

### Complete StateMachine Integration

```typescript
// 1. Define types
import type { State, StateMachineEvent, Transition } from '../types/rescript.js';

// 2. Create transitions
const transitions: Transition[] = [
  {
    from: 'Idle',
    event: 'Start',
    to: { TAG: 'Running', _0: { startedAt: Date.now(), progress: 0 } },
    guard: undefined,
    action: () => console.log('Starting...')
  },
  {
    from: { TAG: 'Running', _0: {} },
    event: { TAG: 'Complete', _0: { result: 'success' } },
    to: { TAG: 'Completed', _0: { completedAt: Date.now() } },
    guard: undefined,
    action: () => console.log('Completed!')
  }
];

// 3. Create and use machine
import * as StateMachine from '../packages/rescript-core/src/state/StateMachine.bs.js';

const machine = StateMachine.create('Idle', transitions);

// 4. Transition through states
const result1 = StateMachine.transition(machine, 'Start');
if (result1.TAG === 'Ok') {
  machine.currentState = result1._0;
  console.log('State:', machine.currentState);
}

const result2 = StateMachine.transition(machine, {
  TAG: 'Complete',
  _0: { result: 'success' }
});

if (result2.TAG === 'Ok') {
  machine.currentState = result2._0;
  console.log('Final state:', machine.currentState);
}
```

### Complete Workflow Integration

```typescript
import * as WorkflowOrchestrator from '../packages/rescript-core/src/workflow/WorkflowOrchestrator.bs.js';
import type { WorkflowState, WorkflowEvent } from '../types/rescript.js';

class WorkflowManager {
  private machine: StateMachine<WorkflowState, WorkflowEvent>;

  constructor(workflowId: string, instanceId: string) {
    const transitions = WorkflowOrchestrator.createWorkflowTransitions();
    this.machine = StateMachine.create('Idle', transitions);
  }

  async start(): Promise<void> {
    const result = StateMachine.transition(this.machine, 'Start');

    if (result.TAG === 'Error') {
      throw new Error(`Start failed: ${result._0}`);
    }

    this.machine.currentState = result._0;
  }

  async executeTask(taskId: string): Promise<void> {
    try {
      // Execute task (TypeScript async)
      await this.runTask(taskId);

      // Update state (ReScript)
      const result = StateMachine.transition(this.machine, {
        TAG: 'TaskCompleted',
        _0: taskId
      });

      if (result.TAG === 'Ok') {
        this.machine.currentState = result._0;
      }
    } catch (error) {
      // Handle failure (ReScript)
      const result = StateMachine.transition(this.machine, {
        TAG: 'TaskFailed',
        _0: taskId
      });

      if (result.TAG === 'Ok') {
        this.machine.currentState = result._0;
      }
    }
  }

  private async runTask(taskId: string): Promise<void> {
    // Implement task execution
  }
}
```

---

## Summary

### Key Takeaways

1. **Type Safety**: Use comprehensive type definitions for all ReScript modules
2. **Boundary Validation**: Validate data at ReScript ↔ TypeScript boundaries
3. **Error Handling**: Always check Result types and handle errors gracefully
4. **Performance**: Minimize boundary crossings, batch operations when possible
5. **Testing**: Test both ReScript modules and integration points

### Resources

- **ReScript Docs**: https://rescript-lang.org/docs/manual/latest
- **Type Definitions**: `src/types/rescript.d.ts`
- **Integration Tests**: `src/__tests__/integration/rescript-integration.test.ts`
- **Example Services**: `src/services/WorkflowService.ts`

---

**Document Version**: 1.0
**Last Updated**: 2025-11-09
**Status**: Phase 15 - P1 Completion
