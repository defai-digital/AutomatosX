# Actionable Fix Checklist for NPM Compatibility

**Status**: Ready to implement  
**Estimated Time**: 15-30 minutes  
**Risk Level**: Low  
**Effort Level**: Low

---

## Quick Summary

5 package.json files need edits to replace 11 `workspace:*` references with semantic versions, then add `publishConfig` to all 6 packages.

---

## Phase 1: Replace workspace:* Protocol (CRITICAL)

### File 1: packages/algorithms/package.json

**Location**: Line 42  
**Current**:
```json
"dependencies": {
  "@ax/schemas": "workspace:*"
}
```

**Change To**:
```json
"dependencies": {
  "@ax/schemas": "^11.0.0-alpha.0"
}
```

**Lines to Change**: 1  
**Verification**: After edit, should show `"@ax/schemas": "^11.0.0-alpha.0"`

---

### File 2: packages/providers/package.json

**Location**: Line 42  
**Current**:
```json
"dependencies": {
  "@ax/schemas": "workspace:*",
  "@modelcontextprotocol/sdk": "^1.22.0"
}
```

**Change To**:
```json
"dependencies": {
  "@ax/schemas": "^11.0.0-alpha.0",
  "@modelcontextprotocol/sdk": "^1.22.0"
}
```

**Lines to Change**: 1  
**Verification**: @modelcontextprotocol/sdk should remain unchanged

---

### File 3: packages/core/package.json

**Location**: Lines 46-48  
**Current**:
```json
"dependencies": {
  "@ax/schemas": "workspace:*",
  "@ax/algorithms": "workspace:*",
  "@ax/providers": "workspace:*",
  "better-sqlite3": "^11.6.0",
  "yaml": "^2.6.1"
}
```

**Change To**:
```json
"dependencies": {
  "@ax/schemas": "^11.0.0-alpha.0",
  "@ax/algorithms": "^11.0.0-alpha.0",
  "@ax/providers": "^11.0.0-alpha.0",
  "better-sqlite3": "^11.6.0",
  "yaml": "^2.6.1"
}
```

**Lines to Change**: 3  
**Verification**: External deps (better-sqlite3, yaml) unchanged

---

### File 4: packages/cli/package.json

**Location**: Lines 30-33  
**Current**:
```json
"dependencies": {
  "@ax/core": "workspace:*",
  "@ax/schemas": "workspace:*",
  "@ax/providers": "workspace:*",
  "@ax/algorithms": "workspace:*",
  "yargs": "^17.7.2",
  "chalk": "^5.3.0",
  "ora": "^8.1.1",
  "cli-table3": "^0.6.5",
  "figures": "^6.1.0"
}
```

**Change To**:
```json
"dependencies": {
  "@ax/core": "^11.0.0-alpha.0",
  "@ax/schemas": "^11.0.0-alpha.0",
  "@ax/providers": "^11.0.0-alpha.0",
  "@ax/algorithms": "^11.0.0-alpha.0",
  "yargs": "^17.7.2",
  "chalk": "^5.3.0",
  "ora": "^8.1.1",
  "cli-table3": "^0.6.5",
  "figures": "^6.1.0"
}
```

**Lines to Change**: 4  
**Verification**: External CLI deps unchanged

---

### File 5: packages/mcp/package.json

**Location**: Lines 29-30  
**Current**:
```json
"dependencies": {
  "@ax/core": "workspace:*",
  "@ax/schemas": "workspace:*",
  "@modelcontextprotocol/sdk": "^1.22.0"
}
```

**Change To**:
```json
"dependencies": {
  "@ax/core": "^11.0.0-alpha.0",
  "@ax/schemas": "^11.0.0-alpha.0",
  "@modelcontextprotocol/sdk": "^1.22.0"
}
```

**Lines to Change**: 2  
**Verification**: MCP SDK unchanged

---

### Verification After Phase 1

```bash
# Should show 0 results
grep -r "workspace:\*" packages/*/package.json

# Should show clean output
grep -r "workspace:\*" packages/*/package.json | wc -l
# Output: 0
```

**Checkpoint**: All workspace:* references replaced ✅

---

## Phase 2: Add publishConfig (HIGH PRIORITY)

Add this block to each of the 6 package.json files:

### Template for All Packages:

After the `"version"` field, add:

```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

### File 1: packages/schemas/package.json

**Insert After Line**: 3 (after "version": "11.0.0-alpha.0",)

```json
{
  "name": "@ax/schemas",
  "version": "11.0.0-alpha.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "description": "Zod schemas for AutomatosX",
  // ... rest of file
}
```

---

### File 2: packages/algorithms/package.json

**Insert After Line**: 3

```json
{
  "name": "@ax/algorithms",
  "version": "11.0.0-alpha.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "description": "Performance-critical algorithms for AutomatosX (ReScript)",
  // ... rest of file
}
```

---

### File 3: packages/providers/package.json

**Insert After Line**: 3

```json
{
  "name": "@ax/providers",
  "version": "11.0.0-alpha.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "description": "Provider implementations for AutomatosX",
  // ... rest of file
}
```

---

### File 4: packages/core/package.json

**Insert After Line**: 3

```json
{
  "name": "@ax/core",
  "version": "11.0.0-alpha.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "description": "Core orchestration engine for AutomatosX",
  // ... rest of file
}
```

---

### File 5: packages/cli/package.json

**Insert After Line**: 3

```json
{
  "name": "@ax/cli",
  "version": "11.0.0-alpha.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "description": "Command-line interface for AutomatosX",
  // ... rest of file
}
```

---

### File 6: packages/mcp/package.json

**Insert After Line**: 3

```json
{
  "name": "@ax/mcp",
  "version": "11.0.0-alpha.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "description": "AutomatosX MCP Server - Model Context Protocol integration",
  // ... rest of file
}
```

---

### Verification After Phase 2

```bash
# Should show 6 results (one per package)
grep -r "publishConfig" packages/*/package.json | wc -l
# Output: 6
```

**Checkpoint**: publishConfig added to all packages ✅

---

## Phase 3: Validate Changes (OPTIONAL)

### Test 1: pnpm Still Works

```bash
cd /Users/akiralam/code/AutomatosX
pnpm install
pnpm build
```

**Expected**: Everything builds successfully

**Reason**: pnpm is smart enough to use local workspace packages even with semantic versions

---

### Test 2: Verify No Syntax Errors

```bash
# Use Node.js to validate JSON
node -e "Object.keys(require('./packages/core/package.json')).forEach(k => console.log(k))"
```

**Expected**: No JSON errors

---

### Test 3: Check Dependencies Look Right

```bash
# Show dependencies for core package
grep -A 10 '"dependencies"' packages/core/package.json
```

**Expected Output**:
```
"dependencies": {
  "@ax/schemas": "^11.0.0-alpha.0",
  "@ax/algorithms": "^11.0.0-alpha.0",
  "@ax/providers": "^11.0.0-alpha.0",
  "better-sqlite3": "^11.6.0",
  "yaml": "^2.6.1"
}
```

**Checkpoint**: Dependencies are correctly formatted ✅

---

## Phase 4: Generate npm Lock File (HIGH PRIORITY)

**Why**: npm ci in CI/CD requires package-lock.json

```bash
cd /Users/akiralam/code/AutomatosX

# Install with npm (alongside pnpm)
npm install

# This will create:
# - package-lock.json (new file)
# - node_modules/ (might be recreated)
```

**Expected Output**:
- New file: `/package-lock.json` created
- Filesize: ~2-5 MB (typical for this project)

**Checkpoint**: npm lock file generated ✅

---

## Phase 5: Commit Changes

```bash
cd /Users/akiralam/code/AutomatosX

# Stage changes
git add packages/*/package.json package-lock.json

# Commit
git commit -m "fix: replace workspace:* protocol with semantic versions for npm compatibility

- Replace 11 workspace:* references with ^11.0.0-alpha.0
- Add publishConfig to all 6 packages for public npm publishing
- Generate package-lock.json for npm ci support

This enables all packages to be installed via npm while maintaining
pnpm development workflow compatibility.

Fixes: npm installation of @ax/cli, @ax/mcp, @ax/core packages"
```

---

## Summary Checklist

### Phase 1: Replace workspace:* (CRITICAL)

- [ ] packages/algorithms/package.json - 1 change
- [ ] packages/providers/package.json - 1 change
- [ ] packages/core/package.json - 3 changes
- [ ] packages/cli/package.json - 4 changes
- [ ] packages/mcp/package.json - 2 changes
- [ ] Verify: `grep -r "workspace:\*" packages/*/package.json` returns 0 results

### Phase 2: Add publishConfig (HIGH)

- [ ] packages/schemas/package.json
- [ ] packages/algorithms/package.json
- [ ] packages/providers/package.json
- [ ] packages/core/package.json
- [ ] packages/cli/package.json
- [ ] packages/mcp/package.json
- [ ] Verify: `grep -r "publishConfig" packages/*/package.json | wc -l` returns 6

### Phase 3: Validate (OPTIONAL)

- [ ] `pnpm install` still works
- [ ] `pnpm build` still works
- [ ] No JSON syntax errors in any package.json
- [ ] Dependencies are properly formatted

### Phase 4: Generate npm Lock File (HIGH)

- [ ] Run `npm install` from root directory
- [ ] Verify package-lock.json was created
- [ ] Verify it contains all dependencies

### Phase 5: Commit (OPTIONAL)

- [ ] Stage all changes
- [ ] Create git commit with descriptive message
- [ ] Verify git status is clean

---

## Expected Results After All Changes

### Development Workflow (pnpm)

```bash
pnpm install  # Works exactly as before
pnpm build    # Works exactly as before
pnpm test     # Works exactly as before
```

**Result**: Zero impact on development ✅

---

### Publishing (npm)

```bash
cd packages/core
npm publish   # NOW WORKS ✅
```

**Result**: Package successfully published to npm

---

### User Installation (npm)

```bash
npm install @ax/cli      # NOW WORKS ✅
npm install -g @ax/cli   # CLI tool available globally ✅
ax --help                # Command works ✅
```

**Result**: Users can install and use AutomatosX

---

## Rollback Plan (If Needed)

If something goes wrong:

```bash
# Revert to previous state
git reset --hard HEAD

# Or restore specific files
git checkout packages/*/package.json
```

**Note**: The changes are minimal and reversible. Low risk.

---

## FAQ

### Q: Will this break pnpm development?
**A**: No. pnpm is smart enough to use local workspace packages even with semantic versions.

### Q: Do we need to change anything else?
**A**: No. These are the only changes needed for npm compatibility.

### Q: What if we forget to generate package-lock.json?
**A**: npm ci will fail in CI/CD, but development will work. It's important for CI but not critical for development.

### Q: Can we change the versions later?
**A**: Yes. For the next version (e.g., 11.0.0), just update all package.json version fields and repeat.

### Q: Does this affect the public API?
**A**: No. Users will still install the same packages from npm with the same exports and functionality.

### Q: Should we do this before or after publishing to npm?
**A**: Before. Make these changes first, then publish.

---

## Final Notes

- **Total Changes**: 11 dependency references + 6 publishConfig blocks
- **Files Modified**: 5 (for dependencies) + 6 (for publishConfig) = 5 unique files
- **Lines Changed**: ~20 lines total
- **Risk**: Minimal (only affects npm publishing, not pnpm development)
- **Reversible**: Yes (all changes are straightforward reversions)
- **Testing**: pnpm build should pass without changes

---

## Success Criteria

After completing all phases, verify:

```bash
# 1. No workspace:* references remain
grep -r "workspace:\*" packages/*/package.json
# Should output: (no results)

# 2. publishConfig exists in all packages
grep -c "publishConfig" packages/*/package.json
# Should output: 6

# 3. npm lock file exists
ls -la package-lock.json
# Should show: (file exists)

# 4. pnpm still works
pnpm install
pnpm build
# Should complete without errors

# 5. Ready for publishing
npm publish --dry-run --workspace packages/schemas
# Should show what would be published
```

**When all criteria pass**: The project is ready for npm publishing! ✅
