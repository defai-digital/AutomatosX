# Phase 3: Context & UX Design - Spec-Kit Integration
**Version:** v5.12.0 (Target)
**Date:** 2025-10-29
**Status:** Design Complete, Implementation Pending
**Depends On:** Phase 2B (v5.11.0) - Streaming & Observability ✅

---

## Executive Summary

Phase 3 delivers **intelligent context sharing** and **seamless UX** for Spec-Kit workflows by:

1. **Session-Aware Execution (I-4)** - Enable task-to-task memory sharing and conversation continuity
2. **Direct Post-Create Execution (I-7)** - Eliminate subprocess overhead when running specs immediately after creation
3. **Advanced Parallelism (p-limit)** - Add intelligent concurrency control with provider-aware throttling

### Strategic Value

| Capability | Current State | Phase 3 Target | Impact |
|------------|--------------|----------------|--------|
| **Cross-task context** | None (isolated runs) | Full memory sharing | Agents build on prior work |
| **Creation-to-execution** | +150ms subprocess | <15ms direct call | 10x faster feedback |
| **Parallel control** | Unbounded per level | Adaptive throttling | Prevent quota exhaustion |
| **User experience** | Multi-command workflow | Single integrated flow | +2 NPS improvement |

---

## Problem Statement

### Pain Points Addressed

From `automatosx/PRD/ax-spec-integration-improvements.md`:

| ID | Pain Point | Severity | Current Impact |
|----|------------|----------|----------------|
| P-1 | SessionManager instantiated but unused | **Medium** | No conversation continuity between tasks |
| P-2 | `ax spec create --execute` spawns nested CLI | **Low** | Duplicate boot costs, lost error context |
| P-3 | Unbounded parallel execution | **Medium** | Provider quota exhaustion on large specs |

### Real-World Scenario

**Before Phase 3:**
```bash
# User workflow (fragmented)
$ ax spec create "Build authentication with database, API, JWT"
# Spec generated...

$ ax spec run --parallel
# Task 1: @backend "Design database schema"
# Task 2: @backend "Implement auth API endpoints"
#   ❌ Task 2 has NO MEMORY of Task 1's schema design!
#   ❌ Backend agent redesigns schema from scratch
#   ❌ Wasted tokens, inconsistent design

# Alternative: --execute flag
$ ax spec create "..." --execute
#   ❌ Spawns `ax spec run` as subprocess
#   ❌ +150ms boot overhead
#   ❌ Reinitializes config, provider, session
```

**After Phase 3:**
```bash
# Single integrated workflow
$ ax spec create "Build authentication with database, API, JWT" --execute
# Spec generated...
# ✅ Execution starts IMMEDIATELY in same process
# ✅ Shared session/provider context
# ✅ No boot overhead

# Task 1: @backend "Design database schema"
#   Output: "Created users table with bcrypt password hashing..."
#   Memory: Saved to shared session

# Task 2: @backend "Implement auth API endpoints"
#   Context: Retrieves Task 1's schema design from memory
#   ✅ Uses exact schema from Task 1
#   ✅ Consistent implementation
#   ✅ Zero redundant work
```

---

## Architectural Design

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Layer (spec.ts)                       │
├─────────────────────────────────────────────────────────────┤
│  handleCreate()              handleRun()                     │
│    │                           │                             │
│    ├─> SpecGenerator          ├─> SpecLoader                │
│    │   (Generate spec)         │   (Load spec)               │
│    │                           │                             │
│    └─> [PHASE 3] If --execute:                              │
│        ├─> Create shared SessionManager                      │
│        └─> Call handleRun() directly                         │
│            (No subprocess!)                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SpecExecutor                              │
├─────────────────────────────────────────────────────────────┤
│  [PHASE 3] Session Integration:                             │
│    • sessionManager: SessionManager (used, not ignored)     │
│    • sessionId: string (shared across all tasks)            │
│    • memoryEnabled: boolean (from config)                   │
│                                                               │
│  executeTask(task):                                          │
│    1. Join session via sessionManager.joinSession()         │
│    2. Retrieve prior task outputs from memory               │
│    3. Execute task with enriched context                    │
│    4. Save task output to session memory                    │
│    5. Update task status                                    │
│                                                               │
│  [PHASE 3] Parallelism with p-limit:                        │
│    • concurrencyLimit: number (from config)                 │
│    • limiter: pLimit(concurrencyLimit)                      │
│    • executeParallel() wraps tasks with limiter()           │
│    • Provider-aware: check quota before scheduling          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              SessionManager (Enhanced)                       │
├─────────────────────────────────────────────────────────────┤
│  [PHASE 3] Task Context API:                                │
│    • getTaskContext(sessionId, taskId): Promise<Context>    │
│    • saveTaskOutput(sessionId, taskId, output): Promise     │
│    • getSessionMemory(sessionId): Promise<Memory[]>         │
│                                                               │
│  Context Retrieval:                                          │
│    1. Load session metadata                                 │
│    2. Query memory for prior task outputs (via tags)        │
│    3. Build context object with:                            │
│       - Prior task titles & outputs                         │
│       - Session-level memory entries                        │
│       - Execution metadata (timestamps, duration)           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│            MemoryManager (Utilized)                          │
├─────────────────────────────────────────────────────────────┤
│  Task Output Storage:                                        │
│    • Type: "task_output"                                    │
│    • Tags: ["spec:{specId}", "task:{taskId}"]              │
│    • Content: Task result text                              │
│    • Metadata: {taskTitle, duration, agent, level}          │
│                                                               │
│  Search API:                                                 │
│    • searchMemory(query, filters)                           │
│    • getEntriesByTags(tags)                                 │
│    • Latest entries used for context retrieval              │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature Design

### Feature 1: Session-Aware Task Execution (I-4)

#### Objective

Enable **conversation continuity** between spec tasks by sharing memory and session context.

#### Current Behavior

```typescript
// src/core/spec/SpecExecutor.ts:481-538 (current)
async executeTask(task: SpecTask): Promise<string> {
  const command = task.ops;
  // ❌ SessionManager is ignored
  // ❌ No memory retrieval
  // ❌ Each task starts with zero context

  const result = await this.executeOpsCommand(command);
  await this.updateTaskStatus(task.id, 'done');
  return result;
}
```

**Problems:**
- Task 2 cannot see Task 1's output
- Backend agent redesigns the same system architecture repeatedly
- Wasted tokens, inconsistent implementations
- No learning across tasks

#### Phase 3 Behavior

```typescript
// src/core/spec/SpecExecutor.ts (Phase 3)
async executeTask(task: SpecTask): Promise<string> {
  const startTime = performance.now();

  // PHASE 3: Join shared session
  await this.sessionManager.joinSession(this.sessionId, {
    taskId: task.id,
    taskTitle: task.title,
    agent: task.assigneeHint
  });

  // PHASE 3: Retrieve prior task outputs for context
  const priorContext = await this.sessionManager.getTaskContext(
    this.sessionId,
    task.id
  );

  // PHASE 3: Execute with enriched context
  const contextPrompt = this.buildContextPrompt(task, priorContext);
  const result = await this.executeOpsCommand(contextPrompt);

  // PHASE 3: Save output to session memory
  await this.sessionManager.saveTaskOutput(this.sessionId, task.id, {
    title: task.title,
    output: result,
    duration: performance.now() - startTime,
    agent: task.assigneeHint,
    timestamp: new Date().toISOString()
  });

  // Update task status
  await this.updateTaskStatus(task.id, 'done', result);

  return result;
}

/**
 * Build context-aware prompt with prior task outputs
 */
private buildContextPrompt(
  task: SpecTask,
  priorContext: TaskContext
): string {
  if (!priorContext.priorTasks.length) {
    return task.ops; // No prior context, use original prompt
  }

  // Enrich prompt with prior task outputs
  const contextSection = priorContext.priorTasks
    .map(prior => `
### Prior Task: ${prior.title}
**Completed:** ${prior.timestamp}
**Output:**
${prior.output.slice(0, 1000)}...
`)
    .join('\n');

  return `${task.ops}

## Context from Prior Tasks

You have access to outputs from previously completed tasks:
${contextSection}

Use this context to ensure consistency with prior decisions and avoid redundant work.
`;
}
```

#### SessionManager API Extensions

```typescript
// src/core/session-manager.ts (Phase 3 additions)

export interface TaskContext {
  sessionId: string;
  taskId: string;
  priorTasks: Array<{
    id: string;
    title: string;
    output: string;
    agent: string;
    timestamp: string;
    duration: number;
  }>;
  sessionMemory: Array<MemoryEntry>;
}

export interface TaskOutputMetadata {
  title: string;
  output: string;
  duration: number;
  agent: string;
  timestamp: string;
}

export class SessionManager {
  // ... existing methods ...

  /**
   * PHASE 3: Join a task to the shared session
   */
  async joinSession(
    sessionId: string,
    taskInfo: { taskId: string; taskTitle: string; agent?: string }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Add task to session metadata
    session.metadata.tasks = session.metadata.tasks || [];
    session.metadata.tasks.push({
      id: taskInfo.taskId,
      title: taskInfo.taskTitle,
      agent: taskInfo.agent,
      startedAt: new Date().toISOString()
    });

    await this.saveSession(session);
  }

  /**
   * PHASE 3: Get context for a task (prior outputs)
   */
  async getTaskContext(
    sessionId: string,
    currentTaskId: string
  ): Promise<TaskContext> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Query memory for prior task outputs in this session
    const priorTaskMemories = await this.memoryManager.search('', {
      filters: {
        type: 'task_output',
        tags: [`session:${sessionId}`]
      },
      limit: 10,
      sortBy: 'created'
    });

    // Build prior task array
    const priorTasks = priorTaskMemories.entries.map(mem => ({
      id: mem.metadata.taskId,
      title: mem.metadata.taskTitle,
      output: mem.content,
      agent: mem.metadata.agent,
      timestamp: mem.created.toISOString(),
      duration: mem.metadata.duration
    }));

    // Get session-level memory
    const sessionMemory = await this.memoryManager.search('', {
      filters: {
        sessionId
      },
      limit: 20
    });

    return {
      sessionId,
      taskId: currentTaskId,
      priorTasks,
      sessionMemory: sessionMemory.entries
    };
  }

  /**
   * PHASE 3: Save task output to session memory
   */
  async saveTaskOutput(
    sessionId: string,
    taskId: string,
    output: TaskOutputMetadata
  ): Promise<void> {
    await this.memoryManager.add({
      type: 'task_output',
      content: output.output,
      tags: [`session:${sessionId}`, `task:${taskId}`],
      metadata: {
        sessionId,
        taskId,
        taskTitle: output.title,
        agent: output.agent,
        duration: output.duration,
        timestamp: output.timestamp
      }
    });
  }
}
```

#### Configuration

```typescript
// automatosx.config.json (new fields)
{
  "execution": {
    "stages": {
      "enabled": true,
      "memorySharing": {
        "enabled": true,  // Phase 3: Enable cross-task memory
        "contextDepth": 5  // Include last 5 task outputs in context
      }
    }
  }
}
```

---

### Feature 2: Direct Post-Create Execution (I-7)

#### Objective

When `--execute` flag is used, run the spec immediately **in the same process** without spawning `ax spec run`.

#### Current Behavior

```typescript
// src/cli/commands/spec.ts:301-314 (current)
if (argv.execute) {
  console.log(chalk.cyan('\n▶️  Executing spec immediately...\n'));

  // ❌ Spawns subprocess with full boot overhead
  const runCommand = `ax spec run ${argv.parallel ? '--parallel' : ''}`;
  const runProcess = spawn(runCommand, { shell: true, cwd: workspacePath });

  // ❌ Config reinitialized
  // ❌ Provider cache lost
  // ❌ Session context lost
  // ❌ +150ms overhead
}
```

#### Phase 3 Behavior

```typescript
// src/cli/commands/spec.ts (Phase 3)
async function handleCreate(argv: any) {
  // ... spec generation logic ...

  if (argv.execute) {
    console.log(chalk.cyan('\n▶️  Executing spec immediately...\n'));

    // PHASE 3: Direct execution in same process
    // Reuse existing config, provider, session
    const runResult = await handleRun({
      ...argv,
      // Pass shared context
      _internalSpec: generatedSpec,  // Skip re-loading
      _internalSession: sessionManager,  // Reuse session
      _internalConfig: config  // Reuse config
    });

    return runResult;
  }

  return { specPath, success: true };
}

async function handleRun(argv: any) {
  // PHASE 3: Check for internal context from handleCreate
  const spec = argv._internalSpec
    ? argv._internalSpec
    : await specLoader.load(workspacePath);

  const sessionManager = argv._internalSession
    ? argv._internalSession
    : await SessionManager.create(config);

  const config = argv._internalConfig
    ? argv._internalConfig
    : await loadConfig();

  // ... rest of execution logic unchanged ...
}
```

**Benefits:**
- **Zero subprocess overhead** (<15ms vs +150ms)
- **Shared provider cache** (no API re-initialization)
- **Shared session** (conversation continuity from generation to execution)
- **Unified error handling** (no lost context across processes)

---

### Feature 3: Advanced Parallelism with p-limit

#### Objective

Add **intelligent concurrency control** to prevent provider quota exhaustion and system overload.

#### Current Behavior

```typescript
// src/core/spec/SpecExecutor.ts:324-368 (current)
async executeParallel(): Promise<void> {
  for (const level of levels) {
    // ❌ Unbounded: all tasks in level run simultaneously
    await Promise.all(level.map(task => this.executeTask(task)));
  }
}
```

**Problems:**
- 20 parallel tasks = 20 simultaneous provider API calls
- Provider rate limits exceeded → failures cascade
- CPU thrashing on large DAGs

#### Phase 3 Behavior

```typescript
// src/core/spec/SpecExecutor.ts (Phase 3)
import pLimit from 'p-limit';

export class SpecExecutor {
  private concurrencyLimit: number;
  private limiter: ReturnType<typeof pLimit>;

  constructor(
    spec: Spec,
    options: SpecExecutorOptions,
    sessionManager: SessionManager
  ) {
    // ... existing initialization ...

    // PHASE 3: Initialize concurrency limiter
    this.concurrencyLimit = options.concurrency || config.execution.concurrency.maxConcurrentAgents || 4;
    this.limiter = pLimit(this.concurrencyLimit);

    logger.debug('SpecExecutor concurrency limit', {
      limit: this.concurrencyLimit
    });
  }

  async executeParallel(): Promise<void> {
    const levels = this.graphBuilder.getLevels();

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const levelStart = performance.now();

      this.events?.emitLevelStarted({
        level: i,
        totalLevels: levels.length,
        taskCount: level.length,
        taskIds: level.map(t => t.id)
      });

      // PHASE 3: Controlled parallelism with p-limit
      const promises = level.map(task =>
        this.limiter(() => this.executeTask(task))
      );

      const results = await Promise.allSettled(promises);

      // Track level metrics
      const completedInLevel = results.filter(r => r.status === 'fulfilled').length;
      const failedInLevel = results.filter(r => r.status === 'rejected').length;

      this.events?.emitLevelCompleted({
        level: i,
        totalLevels: levels.length,
        duration: performance.now() - levelStart,
        completedTasks: completedInLevel,
        failedTasks: failedInLevel
      });

      // Stop on level failure
      if (failedInLevel > 0 && !this.options.continueOnError) {
        throw new Error(`Level ${i} failed: ${failedInLevel} task(s) failed`);
      }
    }
  }
}
```

#### Configuration

```typescript
// automatosx.config.json
{
  "execution": {
    "concurrency": {
      "maxConcurrentAgents": 4,  // Default: 4 parallel tasks
      "spec": {
        "maxConcurrentTasks": 6  // Phase 3: Spec-specific limit
      }
    }
  }
}
```

**Benefits:**
- **Prevent quota exhaustion**: Limit parallel provider calls
- **System stability**: CPU/memory under control
- **Adaptive throttling**: Can integrate provider limit telemetry
- **Better error handling**: Controlled failure propagation

---

## Implementation Plan

### Dependencies

```bash
# Add p-limit for concurrency control
npm install p-limit
npm install --save-dev @types/p-limit
```

### File Changes

| File | Changes | Lines | Complexity |
|------|---------|-------|------------|
| `src/core/session-manager.ts` | Add `joinSession`, `getTaskContext`, `saveTaskOutput` | +150 | Medium |
| `src/core/spec/SpecExecutor.ts` | Session integration, context building, p-limit | +200 | High |
| `src/cli/commands/spec.ts` | Direct execution for `--execute` | +50 | Low |
| `automatosx.config.json` | Add memory sharing & concurrency config | +15 | Low |
| `tests/unit/spec/spec-session-integration.test.ts` | Test session-aware execution | +120 | Medium |
| `tests/integration/spec-context-sharing.integration.test.ts` | End-to-end context tests | +80 | Medium |

**Total Estimated Lines:** ~615 lines
**Estimated Effort:** 8-10 hours

---

## Success Metrics

### Quantitative

| Metric | Baseline | Phase 3 Target | Method |
|--------|----------|----------------|--------|
| Task context awareness | 0% (isolated) | 100% (full memory) | Unit tests verify memory retrieval |
| Creation-to-execution latency | 150ms | <15ms | Benchmark --execute path |
| Parallel task crashes (quota) | ~15% on 10+ task specs | <2% | Stress test with 20-task spec |
| Token efficiency | Baseline | +30% (less redundant work) | Track tokens per multi-task spec |

### Qualitative

| Metric | Measurement | Target |
|--------|-------------|--------|
| User satisfaction (NPS) | Quarterly survey | +2 points |
| Workflow fragmentation | Manual observation | Single-command flow |
| Agent consistency | Code review | Schema/API consistency across tasks |

---

## Testing Strategy

### Unit Tests

```typescript
// tests/unit/spec/spec-session-integration.test.ts

describe('SpecExecutor - Session Integration', () => {
  it('should join session before executing task', async () => {
    const executor = new SpecExecutor(spec, options, sessionManager);
    const joinSpy = vi.spyOn(sessionManager, 'joinSession');

    await executor.executeTask(task);

    expect(joinSpy).toHaveBeenCalledWith(sessionId, {
      taskId: task.id,
      taskTitle: task.title,
      agent: task.assigneeHint
    });
  });

  it('should retrieve prior task context', async () => {
    const executor = new SpecExecutor(spec, options, sessionManager);
    const getContextSpy = vi.spyOn(sessionManager, 'getTaskContext');

    await executor.executeTask(task);

    expect(getContextSpy).toHaveBeenCalledWith(sessionId, task.id);
  });

  it('should save task output to memory', async () => {
    const executor = new SpecExecutor(spec, options, sessionManager);
    const saveSpy = vi.spyOn(sessionManager, 'saveTaskOutput');

    await executor.executeTask(task);

    expect(saveSpy).toHaveBeenCalledWith(sessionId, task.id, expect.objectContaining({
      title: task.title,
      output: expect.any(String),
      duration: expect.any(Number)
    }));
  });

  it('should enrich task prompt with prior context', async () => {
    // Set up prior task output in memory
    await memoryManager.add({
      type: 'task_output',
      content: 'Prior task result: Created users table...',
      tags: [`session:${sessionId}`, 'task:task1']
    });

    const executor = new SpecExecutor(spec, options, sessionManager);
    const executeOpsSpy = vi.spyOn(executor as any, 'executeOpsCommand');

    await executor.executeTask(task2);

    // Verify enriched prompt includes prior context
    expect(executeOpsSpy).toHaveBeenCalledWith(
      expect.stringContaining('Prior Task:')
    );
    expect(executeOpsSpy).toHaveBeenCalledWith(
      expect.stringContaining('Created users table')
    );
  });
});

describe('SpecExecutor - Concurrency Control', () => {
  it('should limit parallel task execution', async () => {
    const executor = new SpecExecutor(spec, {
      parallel: true,
      concurrency: 2
    }, sessionManager);

    const executionOrder: string[] = [];
    vi.spyOn(executor as any, 'executeTask').mockImplementation(async (task) => {
      executionOrder.push(`start:${task.id}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      executionOrder.push(`end:${task.id}`);
    });

    await executor.executeParallel();

    // Verify max 2 concurrent
    // (complex assertion checking overlap)
  });
});
```

### Integration Tests

```typescript
// tests/integration/spec-context-sharing.integration.test.ts

describe('Spec Context Sharing (Integration)', () => {
  it('should share context between sequential tasks', async () => {
    // Create spec with 2 dependent tasks
    const specContent = `
- [ ] id:task:design ops:"ax run backend 'Design user schema'" dep:
- [ ] id:task:implement ops:"ax run backend 'Implement schema'" dep:design
`;

    const executor = new SpecExecutor(spec, options, sessionManager);
    await executor.execute();

    // Verify task 2 received task 1's output in context
    const task2Memory = await memoryManager.search('', {
      filters: { tags: ['task:implement'] }
    });

    expect(task2Memory.entries[0].metadata.hadPriorContext).toBe(true);
  });

  it('should execute spec immediately with --execute flag', async () => {
    // Simulate handleCreate with --execute
    const createResult = await handleCreate({
      description: 'Test spec',
      execute: true,
      _testMode: true
    });

    expect(createResult.executionResult).toBeDefined();
    expect(createResult.executionResult.success).toBe(true);

    // Verify no subprocess spawned (check for internal flags)
    expect(createResult.usedDirectExecution).toBe(true);
  });
});
```

---

## Rollout Plan

### Phase 3.1 - Session Integration (4-5 hours)

**Tasks:**
1. Extend SessionManager with task context API
2. Modify SpecExecutor.executeTask() to use session
3. Implement context prompt enrichment
4. Add unit tests for session integration
5. Verify backward compatibility (session optional)

**Validation:**
- All existing tests pass
- New tests verify memory retrieval
- Manual test: 2-task spec with shared context

### Phase 3.2 - Direct Execution (2-3 hours)

**Tasks:**
1. Refactor handleCreate/handleRun for context sharing
2. Add internal parameter passing (_internalSpec, etc.)
3. Update CLI help text
4. Add integration tests
5. Benchmark latency improvement

**Validation:**
- `ax spec create "..." --execute` runs in <15ms
- Error handling works correctly
- Provider cache reused

### Phase 3.3 - Advanced Parallelism (2-3 hours)

**Tasks:**
1. Install p-limit dependency
2. Add concurrency configuration
3. Modify executeParallel() to use limiter
4. Add stress tests (20+ task specs)
5. Validate quota protection

**Validation:**
- Large specs complete without quota errors
- Concurrency limit respected
- Performance tests pass

### Phase 3.4 - Documentation & Release (1-2 hours)

**Tasks:**
1. Update CHANGELOG.md for v5.12.0
2. Document new configuration options
3. Add examples to docs/BEST-PRACTICES.md
4. Create PHASE3-COMPLETION-SUMMARY.md
5. Version bump and tag

---

## Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Context too large → prompt bloat | Medium | Medium | Limit to last 5 tasks, truncate outputs |
| Memory retrieval adds latency | Low | Low | Cache session context, optimize queries |
| Breaking change for custom integrations | Low | Medium | Keep session optional, backward compat |
| p-limit conflicts with other limits | Low | Low | Coordinate with provider rate limiting |

---

## Future Enhancements (Post-Phase 3)

### Phase 4 Candidates

1. **Provider-Aware Throttling**: Integrate real-time quota telemetry from providers
2. **Smart Context Pruning**: Use relevance scoring to include only relevant prior tasks
3. **Multi-Spec Sessions**: Share context across multiple spec runs
4. **Checkpoint Resume with Context**: Restore context when resuming from checkpoint
5. **Visualize Context Flow**: Show which tasks contributed to each agent's context

---

## Conclusion

Phase 3 transforms Spec-Kit from a **task executor** into an **intelligent workflow orchestrator** with:

- **Conversation continuity** through session-aware memory
- **Seamless UX** with direct execution
- **Production reliability** with concurrency control

**Estimated Delivery:** 8-10 hours
**Target Release:** v5.12.0
**Dependencies:** Phase 2B complete ✅

Ready to implement! 🚀
