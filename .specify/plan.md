# Technical Plan: Spec-Kit CLI Integration

## Architecture

```
CLI Layer
  └─ ax spec [run|status|validate|graph]
       └─ SpecRegistry (workspace-specific factory)
            ├─ SpecLoader (parse .specify/ files)
            ├─ SpecGraphBuilder (DAG construction)
            ├─ SpecValidator (validation pipeline)
            └─ SpecExecutor (task execution orchestrator)
                 └─ spawn('ax run <agent> "task"')
```

## Technology Stack

- **Language**: TypeScript 5.3+ (strict mode)
- **CLI Framework**: yargs 18.x
- **Process Management**: Node.js child_process (spawn)
- **File I/O**: fs/promises
- **Graph Algorithms**: Kahn's algorithm (topological sort)
- **Output Formatting**: chalk, ora, boxen

## Implementation Approach

### Phase 1: Core Executor (COMPLETED)
1. ✅ Design type system (SpecExecutionResult, TaskExecutionResult)
2. ✅ Implement SpecExecutor class
3. ✅ Add sequential execution (topological order)
4. ✅ Add parallel execution (level-by-level)
5. ✅ Implement task status persistence (update tasks.md)

### Phase 2: CLI Commands (COMPLETED)
1. ✅ Implement `ax spec run` with options (--dry-run, --parallel, --task)
2. ✅ Implement `ax spec status` with JSON output
3. ✅ Implement `ax spec validate` with strict mode
4. ✅ Implement `ax spec graph` with DOT/Mermaid export
5. ✅ Register commands in CLI index

### Phase 3: Integration & Testing (IN PROGRESS)
1. Add auto-detection in `ax run`
2. Write unit tests for SpecExecutor
3. Write integration tests for CLI commands
4. Add E2E test with real .specify/ files
5. Performance benchmarking

### Phase 4: CI/CD & Documentation (PENDING)
1. GitHub Actions workflow for spec validation
2. Update README with spec-kit CLI examples
3. Create tutorial: "Building Features with Spec-Kit"
4. Add CHANGELOG entry for v5.9.0

## Data Model

**SpecRunState**:
- specId (string)
- sessionId (string)
- tasks (Map<taskId, TaskExecutionState>)
- metadata (totalTasks, completedTasks, failedTasks)
- status (running | completed | failed | paused)

**TaskExecutionState**:
- taskId (string)
- status (pending | running | completed | failed | skipped)
- output? (string)
- error? (string)
- retryCount (number)
- startedAt?, completedAt? (Date)

## API Design

**CLI Commands**:
```bash
ax spec run [--task <id>] [--dry-run] [--parallel] [--resume]
ax spec status [--pending] [--completed] [--json]
ax spec validate [--strict] [--fix]
ax spec graph [--dot] [--mermaid] [--critical-path]
```

**SpecExecutor API**:
```typescript
const executor = new SpecExecutor(spec, options, sessionManager);
const result = await executor.execute();
await executor.cleanup();
```

## Security Considerations

- Input sanitization: Validate task IDs and ops commands
- Path validation: Ensure .specify/ directory is within workspace
- Command injection prevention: Use spawn with array args (not shell)
- File write permissions: Only update tasks.md, not arbitrary files

## Testing Strategy

**Unit Tests** (40+ tests planned):
- SpecExecutor.execute() - sequential/parallel modes
- SpecExecutor.computeLevels() - DAG level computation
- SpecExecutor.areDependenciesCompleted() - dependency checking
- SpecExecutor.executeTask() - single task execution
- CLI command handlers - all 4 subcommands

**Integration Tests** (10+ tests):
- Full workflow: load spec → execute → verify results
- Error handling: cyclic dependencies, missing files
- Checkpoint/resume functionality
- Status persistence in tasks.md

**E2E Tests** (5+ tests):
- Real .specify/ directory with 5+ tasks
- Multi-agent delegation across tasks
- Parallel execution with 3 levels
- Dry-run mode verification

## Deployment Plan

**NPM Publish** (v5.9.0):
1. Run full test suite (unit + integration + smoke)
2. TypeScript strict mode validation
3. Build with `npm run build`
4. Publish to @defai.digital/automatosx
5. Create GitHub Release with notes

**Rollout Strategy**:
- Beta testing: Use .specify/ for AutomatosX's own development
- Documentation: Complete CLI guide before release
- Migration: No breaking changes, purely additive

## Risks and Mitigations

**Risk 1: Task execution hangs**
- Mitigation: Add timeout to spawn(), AbortController cleanup

**Risk 2: Circular dependencies not detected**
- Mitigation: SpecGraphBuilder already has cycle detection

**Risk 3: tasks.md file corruption**
- Mitigation: Write to temp file first, then atomic rename

**Risk 4: Memory leak in long-running executions**
- Mitigation: Cleanup AbortController, clear Maps after execution

**Risk 5: Performance overhead for large specs**
- Mitigation: LRU cache, lazy loading, parallel execution
