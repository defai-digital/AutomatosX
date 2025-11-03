# Bug Report: CLI Interactive Package

## Date: 2025-11-03

## Summary
Found 3 critical/high severity bugs in the cli-interactive package during code review.

---

## Bug #1: Broken Real-Time Streaming in GeminiProviderBridge
**File:** `packages/cli-interactive/src/provider-bridge.ts`
**Lines:** 142-172
**Severity:** CRITICAL

### Issue
The streaming implementation defeats its own purpose. The code:
1. Calls `provider.executeStreaming()` with an `onToken` callback (lines 142-147)
2. Accumulates tokens in `accumulatedContent` variable
3. **Awaits the full response** (line 152)
4. Only THEN streams the accumulated content char-by-char (lines 155-171)

This means:
- ❌ No real-time streaming from Gemini API
- ❌ User waits for complete response before seeing anything
- ❌ Defeats purpose of streaming UX
- ❌ The `onToken` callback is essentially useless

### Current Code
```typescript
// Lines 142-152
const responsePromise = provider.executeStreaming(request, {
  enabled: true,
  onToken: (token: string) => {
    accumulatedContent += token;  // ❌ Just accumulating, not yielding
  }
});

// ❌ Waits for ENTIRE response
const response = await responsePromise;

// Only then streams the completed content
const content = response.content;
```

### Expected Behavior
Tokens should be yielded in real-time as they arrive from the API:

```typescript
const responsePromise = provider.executeStreaming(request, {
  enabled: true,
  onToken: (token: string) => {
    // ✅ Yield token immediately for real-time display
  }
});
```

### Impact
- Poor UX: Users see nothing until complete response arrives
- Misleading code: Comments claim "real-time token streaming" (line 149)
- Wasted effort: Streaming infrastructure unused

---

## Bug #2: Missing Timeout in isAvailable() Child Process
**File:** `packages/cli-interactive/src/provider-bridge.ts`
**Lines:** 234-242
**Severity:** HIGH

### Issue
The `isAvailable()` method spawns a `which gemini` command but doesn't set a timeout. If the command hangs or the system is slow, this will block indefinitely.

### Current Code
```typescript
const child = spawn('which', ['gemini']);
child.on('exit', (code) => {
  resolve(code === 0);
});
child.on('error', () => {
  resolve(false);
});
// ❌ No timeout! Process could hang forever
```

### Expected Behavior
Add timeout to prevent hanging:

```typescript
const child = spawn('which', ['gemini']);
const timeout = setTimeout(() => {
  child.kill();
  resolve(false);
}, 5000); // 5 second timeout

child.on('exit', (code) => {
  clearTimeout(timeout);
  resolve(code === 0);
});
child.on('error', () => {
  clearTimeout(timeout);
  resolve(false);
});
```

### Impact
- CLI could hang indefinitely on slow systems
- No error handling for hung processes
- Poor user experience if `which` command is slow

---

## Bug #3: Potential Child Process Leak in isAvailable()
**File:** `packages/cli-interactive/src/provider-bridge.ts`
**Lines:** 234-242
**Severity:** MEDIUM

### Issue
Related to Bug #2, if the spawned child process doesn't exit cleanly (e.g., error before exit), there's no cleanup of the process handle. This could lead to zombie processes.

### Current Code
```typescript
const child = spawn('which', ['gemini']);
child.on('exit', (code) => {
  resolve(code === 0);
});
child.on('error', () => {
  resolve(false);  // ❌ Process might still be running
});
```

### Expected Behavior
Ensure process is killed on error:

```typescript
child.on('error', () => {
  child.kill();  // ✅ Explicit cleanup
  resolve(false);
});
```

### Impact
- Possible zombie processes accumulating over time
- Memory leak if called frequently
- Resource exhaustion on long-running CLI sessions

---

## Testing Status

### Unit Tests
- ✅ All 2471 unit tests passing
- ✅ TypeScript compilation clean (no diagnostics)
- ⚠️ Tests use mocks, so bugs in real provider integration not caught

### Integration Tests
- ⚠️ Need integration test with real Gemini CLI to verify streaming
- ⚠️ Need test for timeout behavior in isAvailable()

---

## Recommendations

### Immediate Actions (Critical)
1. **Fix Bug #1**: Implement true real-time streaming by yielding tokens as they arrive
2. **Fix Bug #2**: Add timeout to isAvailable() child process
3. **Fix Bug #3**: Add explicit process cleanup on error

### Follow-up Actions
1. Add integration tests for real streaming behavior
2. Add tests for timeout and process cleanup
3. Consider caching isAvailable() result (currently called on every request)
4. Document streaming architecture for future developers

---

## Files to Update
1. `packages/cli-interactive/src/provider-bridge.ts` - Main fixes
2. `tests/unit/cli-interactive/provider-bridge.test.ts` - Add tests for fixes
3. `docs/cli-interactive.md` - Document streaming architecture

---

## Related Issues
- Tests run successfully but don't catch real streaming behavior (mocks only)
- One test suite took 55s (`provider-bridge.test.ts`) - investigate performance

