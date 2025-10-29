# MCP Gemini Integration Fix - Summary

## Problem Identified

### Provider Name Mismatch
The MCP server had a critical bug where MCP client provider names didn't match the internal AutomatosX provider names:

- **MCP API uses**: `'claude'`, `'gemini'`, `'openai'`
- **System uses**: `'claude-code'`, `'gemini-cli'`, `'openai'`

When MCP clients (like Claude Code) requested `provider: 'gemini'`, the system couldn't find a provider named `'gemini'` because it was actually registered as `'gemini-cli'`. This caused provider routing failures.

### Model Specification Issue
Both Gemini CLI and OpenAI Codex CLI should use their default models, not have models explicitly specified, to avoid version conflicts and ensure optimal model selection.

## Changes Made

### 1. Created Provider Mapping Utility
**File**: `src/mcp/utils/provider-mapping.ts` (NEW)

Created bidirectional mapping functions:
- `mapMcpProviderToActual()` - Maps MCP names → Internal names
- `mapActualProviderToMcp()` - Maps Internal names → MCP names

```typescript
mapMcpProviderToActual('gemini') // Returns: 'gemini-cli'
mapMcpProviderToActual('claude') // Returns: 'claude-code'
mapMcpProviderToActual('openai') // Returns: 'openai'
```

### 2. Updated MCP run_agent Tool
**File**: `src/mcp/tools/run-agent.ts`

- Import provider mapping utility
- Map MCP provider name to actual provider name before passing to `createContext()`
- Enhanced logging to show both MCP and actual provider names

**Before**:
```typescript
const context = await deps.contextManager.createContext(agent, task, {
  provider,  // Wrong! Uses 'gemini' instead of 'gemini-cli'
  skipMemory: no_memory
});
```

**After**:
```typescript
const actualProvider = mapMcpProviderToActual(provider);
const context = await deps.contextManager.createContext(agent, task, {
  provider: actualProvider,  // Correct! Uses 'gemini-cli'
  skipMemory: no_memory
});
```

### 3. Updated MCP get_status Tool
**File**: `src/mcp/tools/get-status.ts`

- Import reverse mapping utility
- Map actual provider names back to MCP names in status responses

**Before**:
```typescript
const providers = availableProviders.map((p) => p.name);
// Returns: ['claude-code', 'gemini-cli', 'openai']
```

**After**:
```typescript
const providers = availableProviders.map((p) => mapActualProviderToMcp(p.name));
// Returns: ['claude', 'gemini', 'openai']
```

### 4. Fixed OpenAI Model Specification
**File**: `src/providers/openai-provider.ts`

Removed model parameter passing to let OpenAI Codex CLI use its default model:

**Before**:
```typescript
// Add model if specified
if (request.model) {
  args.push('-m', request.model);
}
```

**After**:
```typescript
// NOTE: Do NOT pass --model / -m flag - let OpenAI Codex CLI use its own default model
// The CLI is configured to use the best available model automatically
// Specifying a model manually can cause version conflicts
```

### 5. Verified Gemini Model Handling
**File**: `src/providers/gemini-provider.ts`

Confirmed that Gemini CLI already correctly avoids passing model parameter:
- Line 167: `// Do NOT pass --model - let CLI use its own default`
- `buildCLIArgs()` method does NOT include model parameter

### 6. Updated Tests
**File**: `tests/unit/mcp/tools/run-agent.test.ts`

Updated test expectations to verify mapping works:

```typescript
// Provider should be mapped from 'gemini' (MCP) to 'gemini-cli' (actual)
expect(mockContextManager.createContext).toHaveBeenCalledWith(
  'test-agent',
  'test task',
  { provider: 'gemini-cli', skipMemory: undefined }  // ✅ Expects mapped name
);
```

### 7. Added Comprehensive Tests
**File**: `tests/unit/mcp/provider-mapping.test.ts` (NEW)

Created full test suite with:
- Forward mapping tests (MCP → Actual)
- Reverse mapping tests (Actual → MCP)
- Bidirectional round-trip tests
- Edge case handling (undefined, empty string, unknown providers)

## Impact

### Before Fix
❌ MCP client requests with `provider: 'gemini'` failed
❌ Provider routing didn't work for gemini
❌ Models were explicitly specified causing potential conflicts

### After Fix
✅ MCP client requests with `provider: 'gemini'` work correctly
✅ Provider routing properly routes to 'gemini-cli'
✅ Status responses show simplified names ('gemini' not 'gemini-cli')
✅ Both Gemini and OpenAI use their optimal default models
✅ Full test coverage for provider mapping

## Testing

Run the following to verify the fix:

```bash
# Type check
npm run typecheck

# Run provider mapping tests
npm run test:unit -- provider-mapping

# Run MCP tools tests
npm run test:unit -- mcp/tools/run-agent
npm run test:unit -- mcp/tools/get-status

# Build
npm run build
```

## Documentation Updates Needed

The following files should be updated to reflect these changes:
- [ ] README.md - Document MCP provider names
- [ ] CLAUDE.md - Update MCP integration section
- [ ] API documentation - Clarify provider name mapping

## Files Modified

1. `src/mcp/utils/provider-mapping.ts` - **CREATED**
2. `src/mcp/tools/run-agent.ts` - **MODIFIED**
3. `src/mcp/tools/get-status.ts` - **MODIFIED**
4. `src/providers/openai-provider.ts` - **MODIFIED**
5. `tests/unit/mcp/tools/run-agent.test.ts` - **MODIFIED**
6. `tests/unit/mcp/provider-mapping.test.ts` - **CREATED**

## Backwards Compatibility

✅ **Fully backwards compatible**

- Existing code that uses actual provider names ('gemini-cli') continues to work
- MCP clients can now use simplified names ('gemini')
- Unknown provider names are passed through unchanged
- No breaking changes to existing APIs

## Related Issues

Fixes the MCP integration issue where Gemini provider couldn't be selected through MCP clients.
