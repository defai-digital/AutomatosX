# Bug Report: Round 3 - REPL & Additional Files

## Date: 2025-11-03

## Critical Bugs Found

### Bug #6: Conversation Context Not Passed to AI ⚠️ CRITICAL

**File:** `packages/cli-interactive/src/repl.ts:174-184`
**Severity:** CRITICAL - Functional Bug
**Status:** 🔴 FOUND - NEEDS FIX

#### The Problem

The REPL fetches conversation context but **NEVER PASSES IT TO THE AI**!

**Code:**
```typescript
// Line 174: Fetch context
const context = this.conversation.getContext();

// Line 177-192: Use provider
if (this.provider) {
  spinner?.stop();
  this.renderer.displayAIPrefix();

  let fullResponse = '';

  // Line 184: ❌ ONLY PASSES CURRENT INPUT, NOT CONTEXT!
  for await (const event of this.provider.streamResponse(input)) {
    this.renderer.renderStreamEvent(event);
    // ...
  }
}
```

**Impact:**
- ❌ AI has NO memory of previous conversation
- ❌ Every message is treated as new conversation
- ❌ User says "Tell me more about that" → AI doesn't know what "that" is
- ❌ Completely breaks conversational UX

**Why It's Critical:**
- Fundamental feature broken
- Users expect conversational continuity
- Makes the interactive CLI essentially useless for multi-turn conversations

**Expected Behavior:**

The context should be passed to the provider:

```typescript
// Option 1: Build full prompt with context
const fullPrompt = context.map(m => `${m.role}: ${m.content}`).join('\n\n') + `\n\nuser: ${input}`;
for await (const event of this.provider.streamResponse(fullPrompt)) {
  // ...
}

// Option 2: Provider accepts context array (better)
for await (const event of this.provider.streamResponse(input, { context })) {
  // ...
}
```

**Proof:**

Run the CLI:
```
User: "What is 2+2?"
AI: "4"
User: "Double that"
AI: "I don't know what to double" ❌

Expected:
AI: "8" ✓
```

---

### Bug #7: process.cwd() Can Throw If Directory Deleted ⚠️ MEDIUM

**File:** `packages/cli-interactive/src/repl.ts:309`
**Severity:** MEDIUM
**Status:** 🔴 FOUND - NEEDS FIX

#### The Problem

`process.cwd()` throws an error if the current working directory has been deleted (e.g., `git checkout` in another terminal).

**Code:**
```typescript
// Line 309
workspaceRoot: process.cwd() || undefined,
```

**Error:**
```
Error: ENOENT: no such file or directory, uv_cwd
    at Object.cwd (node:internal/process/per_thread:365:9)
```

**Impact:**
- CLI crashes if CWD is deleted
- Common in development (git operations, directory moves)
- No error handling

**Fix:**

```typescript
try {
  workspaceRoot: process.cwd()
} catch {
  workspaceRoot: undefined
}
```

---

### Bug #8: No Cancellation of Streaming on Ctrl+C ⚠️ MEDIUM

**File:** `packages/cli-interactive/src/repl.ts:122-126`
**Severity:** MEDIUM
**Status:** 🔴 FOUND - NEEDS FIX

#### The Problem

When user presses Ctrl+C during streaming, the code sets `isProcessing = false` but doesn't actually cancel the provider stream!

**Code:**
```typescript
// Line 122-126
this.rl.on('SIGINT', () => {
  if (this.isProcessing) {
    // Cancel current operation
    this.renderer.displayInfo('\nCancelling current operation...');
    this.isProcessing = false;  // ❌ Doesn't actually cancel!
    this.rl.prompt();
  } else {
    // ...
  }
});
```

**Impact:**
- Stream continues running in background
- Resources not freed
- Confusing UX (says "cancelling" but doesn't)
- Multiple streams can run simultaneously

**Expected Behavior:**

Need to track the stream generator and close it:

```typescript
private currentStream: AsyncGenerator<StreamEvent> | null = null;

// When starting stream:
this.currentStream = this.provider.streamResponse(input);
for await (const event of this.currentStream) {
  // ...
}

// On SIGINT:
if (this.currentStream) {
  this.currentStream.return();  // Close the generator
  this.currentStream = null;
}
```

---

### Bug #9: Input Validation Missing in markdown-renderer.ts ⚠️ LOW

**File:** `packages/cli-interactive/src/markdown-renderer.ts:94-96, 132-133`
**Severity:** LOW
**Status:** 🔴 FOUND - NEEDS FIX

#### The Problem

`highlightCode()` and `boxCode()` don't validate that `code` parameter is a string.

**Code:**
```typescript
// Line 94
highlightCode(code: string, language?: string): string {
  try {
    const trimmedCode = code.trim();  // ❌ Crashes if code is undefined/null
    // ...
  }
}

// Line 132
private boxCode(code: string, language: string): string {
  const lines = code.split('\n');  // ❌ Crashes if code is undefined/null
  // ...
}
```

**Impact:**
- TypeScript types don't prevent runtime undefined
- marked library might pass undefined
- Crash instead of graceful degradation

**Fix:**

```typescript
highlightCode(code: string, language?: string): string {
  // Validate input
  if (!code || typeof code !== 'string') {
    return this.boxCode('', language || 'text');
  }

  try {
    const trimmedCode = code.trim();
    // ...
  }
}

private boxCode(code: string, language: string): string {
  // Validate input
  if (!code || typeof code !== 'string') {
    code = '';
  }

  const lines = code.split('\n');
  // ...
}
```

---

### Bug #10: Welcome Message Formatting Breaks with Long Provider Names ⚠️ LOW

**File:** `packages/cli-interactive/src/renderer.ts:42`
**Severity:** LOW - Cosmetic
**Status:** 🔴 FOUND - NEEDS FIX

#### The Problem

The welcome message box has a fixed width (55 chars), but uses `padEnd(40)` for provider name, which doesn't truncate long names.

**Code:**
```typescript
// Line 38-44
const message = `
╭─────────────────────────────────────────────────╮
│   AutomatosX Interactive CLI v0.1.1                 │
│   Type /help for commands, /exit to quit            │
│   Using: ${provider.padEnd(40)}│  // ❌ Breaks if provider > 40 chars
╰─────────────────────────────────────────────────────╯
`.trim();
```

**Impact:**
- Box formatting breaks if provider name > 40 characters
- Cosmetic issue, not functional
- Example: "Gemini 2.0 Flash Experimental with Extended Context" (50+ chars)

**Fix:**

```typescript
const maxProviderLen = 40;
const truncatedProvider = provider.length > maxProviderLen
  ? provider.substring(0, maxProviderLen - 3) + '...'
  : provider.padEnd(maxProviderLen);

const message = `
╭─────────────────────────────────────────────────╮
│   AutomatosX Interactive CLI v0.1.1                 │
│   Type /help for commands, /exit to quit            │
│   Using: ${truncatedProvider}│
╰─────────────────────────────────────────────────────╯
`.trim();
```

---

## Summary

### Bugs by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 1     | 🔴 Found |
| MEDIUM   | 2     | 🔴 Found |
| LOW      | 2     | 🔴 Found |
| **Total**| **5** | **🔴 5 Found** |

### Most Critical

**Bug #6** is the most critical - it completely breaks the conversational AI feature. The AI has no memory of previous messages, making it useless for multi-turn conversations.

### Files Affected

1. `packages/cli-interactive/src/repl.ts` (Bugs #6, #7, #8)
2. `packages/cli-interactive/src/markdown-renderer.ts` (Bug #9)
3. `packages/cli-interactive/src/renderer.ts` (Bug #10)

---

## Total Bugs Found Across All Rounds

| Round | Bugs | Severity Distribution |
|-------|------|----------------------|
| 1     | 3    | 1 Critical, 1 High, 1 Medium |
| 2     | 2    | 1 Critical, 1 Medium |
| 3     | 5    | 1 Critical, 2 Medium, 2 Low |
| **Total** | **10** | **3 Critical, 1 High, 3 Medium, 3 Low** |

---

## Next Steps

1. Fix Bug #6 (CRITICAL): Pass conversation context to AI
2. Fix Bug #7 (MEDIUM): Handle process.cwd() errors
3. Fix Bug #8 (MEDIUM): Implement stream cancellation
4. Fix Bug #9 (LOW): Add input validation to markdown renderer
5. Fix Bug #10 (LOW): Truncate long provider names

All bugs require code changes and testing.
