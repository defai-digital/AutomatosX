# Test Writing Standards

**Version**: 1.0.0
**Last Updated**: 2025-10-30
**Status**: Active

This document defines standards and best practices for writing tests in AutomatosX to ensure consistency, type safety, and CI/CD compatibility.

---

## Table of Contents

1. [Type Safety Requirements](#type-safety-requirements)
2. [Constructor Usage](#constructor-usage)
3. [Method Signatures](#method-signatures)
4. [Array and Object Access](#array-and-object-access)
5. [Test Organization](#test-organization)
6. [Edge Cases and Error Handling](#edge-cases-and-error-handling)
7. [Async Testing](#async-testing)
8. [Resource Cleanup](#resource-cleanup)
9. [Pre-Commit Checklist](#pre-commit-checklist)
10. [Common Mistakes](#common-mistakes)

---

## Type Safety Requirements

### Rule 1: Always Use Proper TypeScript Types

**DO**:
```typescript
const sessionManager: SessionManager = new SessionManager({ persistencePath: testDir });
const result: MemoryEntry[] = await memoryManager.search('query');
```

**DON'T**:
```typescript
const sessionManager = new SessionManager(testDir); // Wrong constructor
const result = await memoryManager.search('query'); // Missing type annotation
```

### Rule 2: Enable Strict Null Checking

Our `tsconfig.json` has `"noUncheckedIndexedAccess": true`. Always handle potential undefined values:

**DO**:
```typescript
expect(spec.tasks).toHaveLength(1);
expect(spec.tasks[0]!.id).toBe('task-1'); // Non-null assertion
```

**DON'T**:
```typescript
expect(spec.tasks[0].id).toBe('task-1'); // Type error: possibly undefined
```

### Rule 3: Run Type Checking Before Commits

Always run before committing:
```bash
npm run typecheck
```

The pre-commit hook will also run this automatically, but it's best to catch issues early.

---

## Constructor Usage

### Rule 4: Use Correct Constructor Signatures

Always check the class constructor signature before instantiating in tests.

**Example: SessionManager**

**DO**:
```typescript
const sessionManager = new SessionManager({
  persistencePath: testDir
});
```

**DON'T**:
```typescript
const sessionManager = new SessionManager(testDir); // Wrong: expects object
```

**How to Verify**: Check the class definition:
```typescript
// src/core/session-manager.ts
constructor(options: SessionManagerOptions) {
  this.persistencePath = options.persistencePath;
  // ...
}
```

### Rule 5: Use Named Parameters for Clarity

When constructors accept multiple options, use named parameters:

**DO**:
```typescript
const loader = new SpecLoader({
  workspacePath: testDir,
  validateOnLoad: true
});
```

**DON'T**:
```typescript
const loader = new SpecLoader(testDir, true); // Unclear what 'true' means
```

---

## Method Signatures

### Rule 6: Match Parameter Types Exactly

Always verify method signatures before calling:

**Example: SessionManager.completeTask**

**DO**:
```typescript
await sessionManager.completeTask(
  session.id,      // sessionId: string
  'task-1',        // taskId: string
  1000            // durationMs: number
);
```

**DON'T**:
```typescript
await sessionManager.completeTask(session.id, 'task-1', {
  status: 'success',
  message: 'Completed'
}); // Wrong: expects number, not object
```

**How to Verify**: Check method definition:
```typescript
async completeTask(
  sessionId: string,
  taskId: string,
  durationMs: number
): Promise<void>
```

### Rule 7: Use TypeScript Inference to Catch Errors

Let TypeScript help you:

```typescript
// If this shows a type error, you're passing wrong arguments
await sessionManager.completeTask(session.id, 'task-1', 1000);
```

---

## Array and Object Access

### Rule 8: Use Non-Null Assertions for Array Access

When you've verified array length, use `!` to assert non-null:

**DO**:
```typescript
expect(spec.tasks).toHaveLength(1);
expect(spec.tasks[0]!.id).toBe('task-1');
expect(spec.tasks[0]!.ops).toBe('...');
```

**DON'T**:
```typescript
expect(spec.tasks[0].id).toBe('task-1'); // Type error
```

### Rule 9: Add Length Checks Before Access

Always verify array/object existence before accessing:

**DO**:
```typescript
expect(session.metadata?.tasks).toHaveLength(3);
expect(session.metadata?.tasks?.[0]!.id).toBe('task-1');
```

**DON'T**:
```typescript
expect(session.metadata.tasks[0].id).toBe('task-1'); // Could be undefined
```

### Rule 10: Use Optional Chaining for Nested Access

**DO**:
```typescript
const task1 = updated?.metadata?.tasks?.find((t: any) => t.id === 'task-1');
expect(task1?.title).toBe('Task One');
```

**DON'T**:
```typescript
const task1 = updated.metadata.tasks.find((t: any) => t.id === 'task-1');
expect(task1.title).toBe('Task One'); // Multiple potential undefined accesses
```

---

## Test Organization

### Rule 11: Use Descriptive Test Structure

**DO**:
```typescript
describe('SessionManager - Deduplication Regression Tests', () => {
  describe('Bug #2 Fix: Remove ALL duplicate task entries', () => {
    it('should remove single duplicate task entry when re-running', async () => {
      // Test implementation
    });

    it('should remove MULTIPLE duplicate task entries (regression case)', async () => {
      // Test implementation
    });
  });

  describe('Edge Cases', () => {
    // Edge case tests
  });
});
```

### Rule 12: Use beforeEach/afterEach for Setup/Cleanup

**DO**:
```typescript
describe('MyTest', () => {
  let testDir: string;
  let instance: MyClass;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    instance = new MyClass({ path: testDir });
  });

  afterEach(async () => {
    await instance.cleanup();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should work correctly', async () => {
    // Test uses fresh instance and testDir
  });
});
```

### Rule 13: One Assertion Focus Per Test

**DO**:
```typescript
it('should remove duplicate task entries', async () => {
  // Setup
  await joinTask('task-1', 'Attempt 1');
  await joinTask('task-1', 'Attempt 2');

  // Verify
  const session = await getSession();
  expect(session.metadata.tasks).toHaveLength(1);
});

it('should keep latest task entry after deduplication', async () => {
  // Setup
  await joinTask('task-1', 'Attempt 1');
  await joinTask('task-1', 'Attempt 2');

  // Verify
  const session = await getSession();
  expect(session.metadata.tasks[0]!.title).toBe('Attempt 2');
});
```

**DON'T**:
```typescript
it('should handle deduplication correctly', async () => {
  await joinTask('task-1', 'Attempt 1');
  await joinTask('task-1', 'Attempt 2');
  const session = await getSession();

  expect(session.metadata.tasks).toHaveLength(1); // Multiple assertions
  expect(session.metadata.tasks[0]!.title).toBe('Attempt 2');
  expect(session.metadata.tasks[0]!.status).toBe('running');
  // ... harder to debug which assertion failed
});
```

---

## Edge Cases and Error Handling

### Rule 14: Test Edge Cases Explicitly

**DO**:
```typescript
describe('Edge Cases', () => {
  it('should handle empty array', async () => {
    const result = await process([]);
    expect(result).toEqual([]);
  });

  it('should handle null input', async () => {
    await expect(process(null)).rejects.toThrow('Input cannot be null');
  });

  it('should handle very large input', async () => {
    const largeArray = new Array(10000).fill('item');
    const result = await process(largeArray);
    expect(result).toHaveLength(10000);
  });
});
```

### Rule 15: Test Error Conditions

**DO**:
```typescript
it('should throw error for invalid input', async () => {
  await expect(
    sessionManager.getSession('invalid-id')
  ).rejects.toThrow('Session not found');
});

it('should reject malformed JSON ops', async () => {
  const tasksContent = `# Tasks\n- [ ] id:test ops:{"invalid json}`;
  await createTestSpec(tasksContent);

  const loader = new SpecLoader({ workspacePath: testDir });
  const spec = await loader.load();

  // Malformed JSON should be skipped
  expect(spec.tasks).toHaveLength(0);
});
```

### Rule 16: Test Race Conditions

**DO**:
```typescript
it('should handle rapid sequential operations (race condition)', async () => {
  const operations = [];
  for (let i = 0; i < 10; i++) {
    operations.push(
      sessionManager.joinTask(session.id, {
        taskId: 'task-1',
        taskTitle: `Attempt ${i}`,
        agent: 'test'
      })
    );
  }

  await Promise.all(operations);

  const updated = await sessionManager.getSession(session.id);
  expect(updated?.metadata?.tasks).toHaveLength(1); // Should deduplicate correctly
});
```

---

## Async Testing

### Rule 17: Always Await Async Operations

**DO**:
```typescript
it('should save data correctly', async () => {
  await manager.save({ key: 'value' });
  const result = await manager.load();
  expect(result.key).toBe('value');
});
```

**DON'T**:
```typescript
it('should save data correctly', async () => {
  manager.save({ key: 'value' }); // Missing await
  const result = await manager.load();
  expect(result.key).toBe('value'); // Might fail due to timing
});
```

### Rule 18: Use Proper Timeout Configuration

For long-running tests:

**DO**:
```typescript
it('should complete long operation', async () => {
  const result = await longRunningOperation();
  expect(result).toBeDefined();
}, 30000); // 30 second timeout
```

---

## Resource Cleanup

### Rule 19: Always Clean Up Resources

**DO**:
```typescript
afterEach(async () => {
  try {
    await rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors (directory might not exist)
  }
});
```

### Rule 20: Close Database Connections

**DO**:
```typescript
afterEach(async () => {
  if (memoryManager) {
    await memoryManager.close();
  }
  if (sessionManager) {
    await sessionManager.close();
  }
});
```

### Rule 21: Use Unique Test Directories

**DO**:
```typescript
beforeEach(async () => {
  testDir = join(tmpdir(), `test-${Date.now()}-${Math.random()}`);
  await mkdir(testDir, { recursive: true });
});
```

This prevents test interference when running in parallel.

---

## Pre-Commit Checklist

Before committing new tests, verify:

- [ ] All tests pass locally: `npm test`
- [ ] TypeScript checking passes: `npm run typecheck`
- [ ] Tests use correct constructor signatures
- [ ] Tests use correct method signatures
- [ ] Array/object access uses non-null assertions
- [ ] Edge cases are covered
- [ ] Error conditions are tested
- [ ] Resources are properly cleaned up
- [ ] Tests are properly organized with describe/it blocks
- [ ] Test names clearly describe what they test

---

## Common Mistakes

### Mistake 1: Wrong Constructor Syntax

**WRONG**:
```typescript
const manager = new SessionManager(testDir);
```

**CORRECT**:
```typescript
const manager = new SessionManager({ persistencePath: testDir });
```

### Mistake 2: Missing Non-Null Assertions

**WRONG**:
```typescript
expect(spec.tasks[0].id).toBe('test');
```

**CORRECT**:
```typescript
expect(spec.tasks[0]!.id).toBe('test');
```

### Mistake 3: Wrong Parameter Types

**WRONG**:
```typescript
await manager.completeTask(sessionId, taskId, { status: 'success' });
```

**CORRECT**:
```typescript
await manager.completeTask(sessionId, taskId, 1000); // durationMs: number
```

### Mistake 4: Not Awaiting Async Operations

**WRONG**:
```typescript
manager.save(data); // Missing await
const result = await manager.load();
```

**CORRECT**:
```typescript
await manager.save(data);
const result = await manager.load();
```

### Mistake 5: Not Cleaning Up Resources

**WRONG**:
```typescript
afterEach(() => {
  // No cleanup
});
```

**CORRECT**:
```typescript
afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
  await manager.close();
});
```

---

## CI/CD Compatibility

### Key Differences Between Local and CI/CD

The CI/CD environment enforces stricter checks:

1. **TypeScript Strictness**: CI/CD runs `npm run typecheck` which catches type errors
2. **Parallel Testing**: CI/CD may run tests in parallel, requiring proper isolation
3. **Resource Limits**: CI/CD has limited resources, so cleanup is critical
4. **Clean Environment**: CI/CD starts from scratch, exposing hidden dependencies

### Ensuring CI/CD Success

1. **Run pre-commit hook manually**: The pre-commit hook now runs both tests and type checking
2. **Test in clean environment**: Occasionally test in a fresh clone
3. **Check for timing issues**: CI/CD may be slower, exposing race conditions
4. **Verify resource cleanup**: Use unique test directories and clean up thoroughly

---

## Questions or Issues?

If you encounter testing issues:

1. Run `npm run typecheck` to catch type errors
2. Check this document for best practices
3. Look at recent regression tests as examples:
   - `tests/unit/spec/spec-loader-json-regression.test.ts`
   - `tests/unit/session-manager-dedup-regression.test.ts`
4. Ask for review if unsure

---

**Document History**:
- **v1.0.0 (2025-10-30)**: Initial version created after v5.12.1 CI/CD incident
