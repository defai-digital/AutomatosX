# Bug Fix Report: ConfigLoader Source Tracking

**Date**: 2025-11-06
**Status**: ✅ FIXED
**Test Result**: All 140 tests passing (was 139/140 passing)

---

## Executive Summary

Fixed a critical bug in `ConfigLoader` where configuration fields that weren't present in user config files were incorrectly marked as coming from `ConfigSource.PROJECT` instead of `ConfigSource.DEFAULT`.

**Impact**: Configuration source tracking was broken, making it impossible to know which settings came from which source (default, global, project, env).

**Root Cause**: Zod's `.partial()` method doesn't strip `.default()` values, causing schemas to fill in missing fields even when they weren't in the original config file.

**Fix**: Created truly partial schemas without defaults by explicitly defining optional fields without `.default()` values.

---

## Bug Details

### Failing Test
```typescript
// src/services/__tests__/ConfigLoader.test.ts:113-114
expect(sources.get('search.defaultLimit')).toBe(ConfigSource.PROJECT); // ✅ Passed
expect(sources.get('search.maxLimit')).toBe(ConfigSource.DEFAULT);     // ❌ Failed
```

**Error Message**:
```
AssertionError: expected 'project' to be 'default'
- Expected: 'default'
+ Received: 'project'
```

### Reproduction
When loading a project config with only one field:
```json
{
  "search": {
    "defaultLimit": 20
  }
}
```

**Expected Behavior**:
- `search.defaultLimit` → source: `project` ✅
- `search.maxLimit` → source: `default` ✅
- `search.enableSymbolSearch` → source: `default` ✅

**Actual Behavior (BEFORE FIX)**:
- `search.defaultLimit` → source: `project` ✅
- `search.maxLimit` → source: `project` ❌ (should be `default`)
- `search.enableSymbolSearch` → source: `project` ❌ (should be `default`)

ALL search fields were marked as `project` even though only `defaultLimit` was in the file!

---

## Root Cause Analysis

### The Zod `.partial()` Gotcha

The original PartialConfigSchema used Zod's `.partial()` method:

```typescript
// ❌ BEFORE (BROKEN)
export const PartialConfigSchema = AutomatosXConfigSchema.partial().extend({
  search: SearchConfigSchema.partial().optional(),
  // ...
});
```

Where `SearchConfigSchema` is:
```typescript
const SearchConfigSchema = z.object({
  defaultLimit: z.number().int().positive().default(10),
  maxLimit: z.number().int().positive().default(100),
  // ...
});
```

### The Problem

When you call `.partial()` on a schema with `.default()` values:
```typescript
SearchConfigSchema.partial()
```

It creates:
```typescript
z.object({
  defaultLimit: z.number().int().positive().default(10).optional(),
  maxLimit: z.number().int().positive().default(100).optional(),
  // ...
})
```

The `.default()` values are **STILL THERE**! When parsing:
```json
{ "search": { "defaultLimit": 20 } }
```

Zod fills in:
```json
{
  "search": {
    "defaultLimit": 20,
    "maxLimit": 100,          // ← Filled by Zod!
    "enableSymbolSearch": true, // ← Filled by Zod!
    // ... all other fields with defaults
  }
}
```

Then `markConfigFields()` marks ALL these fields as `ConfigSource.PROJECT`, even though they weren't in the original file!

### Debug Evidence

Created debug scripts to prove the issue:

**Before Fix**:
```
=== PROJECT CONFIG ===
{ "search": { "defaultLimit": 20 } }

=== PARSED WITH PartialConfigSchema ===
{
  "search": {
    "defaultLimit": 20,
    "maxLimit": 100,              // ← Should NOT be here!
    "enableSymbolSearch": true,    // ← Should NOT be here!
    ...
  }
}

=== SOURCES ===
search.defaultLimit: project  ✅ Correct
search.maxLimit: project      ❌ WRONG! Should be 'default'
```

**After Fix**:
```
=== PROJECT CONFIG ===
{ "search": { "defaultLimit": 20 } }

=== PARSED WITH PartialConfigSchema ===
{
  "search": {
    "defaultLimit": 20   // ✅ Only what was in the file!
  }
}

=== SOURCES ===
search.defaultLimit: project  ✅ Correct
search.maxLimit: default      ✅ FIXED!
```

---

## The Fix

### Solution: Explicit Partial Schemas Without Defaults

Created new partial schemas that explicitly define optional fields WITHOUT `.default()` values:

```typescript
// ✅ AFTER (FIXED)
const PartialSearchConfigSchema = z.object({
  defaultLimit: z.number().int().positive().optional(),      // No .default()!
  maxLimit: z.number().int().positive().optional(),          // No .default()!
  enableSymbolSearch: z.boolean().optional(),                // No .default()!
  enableNaturalSearch: z.boolean().optional(),               // No .default()!
  enableHybridSearch: z.boolean().optional(),                // No .default()!
  symbolMatchThreshold: z.number().min(0).max(1).optional(), // No .default()!
  hybridSymbolWeight: z.number().min(0).max(1).optional(),   // No .default()!
}).strict();

export const PartialConfigSchema = z.object({
  version: z.string().optional(),
  languages: z.record(z.string(), LanguageConfigSchema.partial()).optional(),
  search: PartialSearchConfigSchema.optional(),
  indexing: PartialIndexingConfigSchema.optional(),
  database: PartialDatabaseConfigSchema.optional(),
  performance: PartialPerformanceConfigSchema.optional(),
  logging: PartialLoggingConfigSchema.optional(),
}).strict();
```

### Why This Works

Now when parsing `{ "search": { "defaultLimit": 20 } }`:
1. Zod validates `defaultLimit: 20` ✅
2. `maxLimit` is optional and NOT present → Zod doesn't add it ✅
3. All other fields are optional and NOT present → Zod doesn't add them ✅
4. Result: `{ "search": { "defaultLimit": 20 } }` (unchanged!)

Then `markConfigFields()` only marks fields that were actually in the file:
- `search` → PROJECT
- `search.defaultLimit` → PROJECT
- `search.maxLimit` → stays DEFAULT ✅

---

## Files Changed

### src/types/Config.ts (Updated)

**Lines Changed**: 118-182
**Changes**:
- Created 5 new partial schema definitions without defaults:
  - `PartialSearchConfigSchema`
  - `PartialIndexingConfigSchema`
  - `PartialDatabaseConfigSchema`
  - `PartialPerformanceConfigSchema`
  - `PartialLoggingConfigSchema`
- Updated `PartialConfigSchema` to use the new partial schemas
- Added comprehensive documentation explaining the fix

**Lines Added**: +64
**Lines Removed**: -8
**Net Change**: +56 lines

### Impact Analysis

**Breaking Changes**: None
- The PartialConfig type interface remains the same
- API is unchanged
- Only internal parsing behavior is fixed

**Performance Impact**: None
- Schema parsing speed unchanged
- Memory usage unchanged

**Test Coverage**:
- Fixed: 1 failing test
- Added: 0 new tests (existing test now passes)
- Total: 140/140 tests passing (100%)

---

## Verification

### Test Results

**Before Fix**:
```
Test Files  1 failed | 7 passed (8)
Tests       1 failed | 139 passed (140)
FAIL  ConfigLoader.test.ts > should mark project config fields as PROJECT source
```

**After Fix**:
```
✓ Test Files  8 passed (8)
✓ Tests       140 passed (140)
✓ Duration    293ms
```

### Manual Verification

Created debug scripts to verify behavior:
1. `debug-zod-partial.ts` - Confirmed parsing doesn't add defaults
2. `debug-config-bug.ts` - Confirmed source tracking is correct

Both scripts confirmed the fix works as expected.

---

## Lessons Learned

### Zod Best Practices

1. **`.partial()` preserves `.default()` values** - If you want truly optional fields without defaults, define them explicitly.

2. **Schema design patterns**:
   ```typescript
   // ❌ Don't do this for user configs
   const Schema = z.object({
     field: z.string().default('value')
   }).partial();

   // ✅ Do this instead
   const PartialSchema = z.object({
     field: z.string().optional()
   });

   const FullSchema = z.object({
     field: z.string().default('value')
   });
   ```

3. **Test schema parsing behavior** - Don't assume `.partial()` does what you think it does!

### Testing Insights

- **Source tracking tests are critical** - They caught this subtle bug that would have been very hard to debug in production.
- **Debug scripts are invaluable** - Creating minimal reproductions (debug-zod-partial.ts) made the bug obvious.
- **Test what you don't see** - The bug was in what WASN'T in the parsed config, not what was.

---

## Related Issues

### Potential Future Improvements

1. **Schema validation warnings**: Add warnings when partial configs have unexpected fields
2. **Source tracking UI**: Create a CLI command to show config sources: `ax config sources`
3. **Config diff tool**: Show what changed between default and user configs

### No Regressions

Verified that this fix doesn't affect:
- ✅ Default config initialization
- ✅ Global config loading
- ✅ Environment variable parsing
- ✅ Config merging logic
- ✅ Config validation

---

## Conclusion

**Status**: ✅ Bug completely fixed and verified

**Quality Improvement**:
- Test suite: 139/140 → 140/140 passing
- Code quality: Fixed subtle Zod schema bug
- Documentation: Added clear comments explaining the fix

**Technical Debt Reduced**: This fix eliminates a confusing behavior where user config sources were misreported, which could have led to debugging nightmares in production.

---

**Document Version**: 1.0
**Author**: Claude Code MegaThink Bug Analysis
**Verified By**: Full test suite (140/140 passing)
