# PRD: Resume Command Storage Consolidation

## Problem Statement

The `resume.ts` CLI command creates its own in-memory checkpoint storage via a local `getCheckpointStorage()` function, instead of using the shared storage instances from `storage-instances.ts`. This causes:

1. **Data Loss**: Checkpoints are not persisted to SQLite even when available
2. **Inconsistency**: The resume command operates on a different storage instance than other commands
3. **Code Duplication**: Local function duplicates functionality already in `storage-instances.ts`

## Current State

```
packages/cli/src/commands/resume.ts:243-249
```

```typescript
/**
 * Get checkpoint storage instance
 * TODO: Use SQLite storage in production
 */
function getCheckpointStorage(): CheckpointStorage {
  return createInMemoryCheckpointStorage();
}
```

This function is called at:
- Line 53: `const storage = getCheckpointStorage();`
- Line 155: `const storage = getCheckpointStorage();`

## Target State

Use the shared storage infrastructure from `storage-instances.ts`:

```typescript
import {
  getCheckpointStorage,
  initializeStorageAsync,
} from '../utils/storage-instances.js';
```

## Architectural Alignment

### Contract Layer
- No contract changes required
- `CheckpointStorage` interface already defined in `@automatosx/contracts`

### Domain Layer
- No domain changes required
- `agent-execution` package already exports checkpoint storage implementations

### Adapter Layer
- No adapter changes required
- SQLite checkpoint storage already implemented in `@automatosx/sqlite-adapter`

### Application Layer (CLI)
- **Change Required**: Update `resume.ts` to use shared storage instances
- Pattern already established in `cleanup.ts` (see lines 30-33)

## Implementation Plan

### Step 1: Update Imports
Remove local import of `createInMemoryCheckpointStorage` and add import from storage-instances.

**Before:**
```typescript
import {
  createCheckpointManager,
  createInMemoryCheckpointStorage,
  type CheckpointStorage,
} from '@automatosx/agent-execution';
```

**After:**
```typescript
import {
  createCheckpointManager,
} from '@automatosx/agent-execution';
import {
  getCheckpointStorage,
  initializeStorageAsync,
} from '../utils/storage-instances.js';
```

### Step 2: Update Command Handler
Initialize storage asynchronously at command start for SQLite support.

**Add to `resumeCommand()`:**
```typescript
// Initialize storage (enables SQLite if available)
await initializeStorageAsync();
```

### Step 3: Remove Local Function
Delete the local `getCheckpointStorage()` function (lines 243-249).

### Step 4: Remove Unused Type Import
Remove `type CheckpointStorage` from imports as it's no longer needed.

## Invariants Preserved

- **INV-MEM-001**: Memory events immutable after storage (unchanged)
- **INV-CLI-001**: Commands use consistent storage backends (now enforced)
- **INV-STORAGE-001**: SQLite preferred when available, fallback to in-memory (now applied)

## Testing

1. **Unit Test**: Verify `resume` command uses shared storage instance
2. **Integration Test**: Verify checkpoints persist across CLI invocations with SQLite
3. **Fallback Test**: Verify graceful fallback to in-memory when SQLite unavailable

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Break existing checkpoints | Low | Low | In-memory was always transient |
| SQLite init failure | Low | Low | Fallback already implemented |
| Import path issues | Low | Low | Same pattern used in cleanup.ts |

## Success Criteria

1. `resume.ts` no longer has local `getCheckpointStorage()` function
2. Resume command uses `storage-instances.ts` exports
3. Checkpoints persist to SQLite when `AX_STORAGE=sqlite` (default)
4. All existing tests pass
5. `pnpm typecheck` passes
