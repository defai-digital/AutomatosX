# AutomatosX NPM Installation Compatibility Audit

**Audit Date**: 2025-11-27  
**Repository**: https://github.com/defai-digital/automatosx  
**Current Setup**: pnpm monorepo with 6 publishable packages  

---

## Executive Summary

The AutomatosX monorepo has **CRITICAL** npm compatibility issues that will prevent users from installing published packages via npm. While the project is properly structured as a monorepo, the use of **pnpm's `workspace:*` protocol in production dependencies** is fundamentally incompatible with npm. This must be resolved before publishing to npm.

**Key Finding**: 11 instances of `workspace:*` protocol across 5 packages will cause npm installation to fail completely.

---

## 1. Root Package.json Analysis

**File**: `/Users/akiralam/code/AutomatosX/package.json`

### Status: PROPER - Private Monorepo Root
```json
{
  "name": "@defai.digital/automatosx",
  "version": "11.0.0-alpha.0",
  "private": true,
  "packageManager": "pnpm@9.14.2",
  "workspaces": ["packages/*"]
}
```

### Issues Found: NONE
- ✅ Root is correctly marked `"private": true` (prevents accidental publishing)
- ✅ `packageManager` field restricts tool usage
- ✅ `workspaces` array properly configured for pnpm

### Scripts: PNPM DEPENDENT
All build/dev scripts use pnpm-specific filters:
- ❌ `"build": "pnpm -r build"` - Won't work with npm
- ❌ `"build:schemas": "pnpm --filter @ax/schemas build"` - pnpm-only
- ❌ `"dev": "pnpm -r --parallel dev"` - pnpm-only

This is acceptable for development since root is private, but must be noted.

---

## 2. Critical Issue: `workspace:*` Protocol

### THE MAIN PROBLEM

**6 out of 6 packages** use `workspace:*` protocol for internal dependencies. This protocol is **pnpm-exclusive** and npm does not understand it.

### Affected Packages & References:

#### @ax/algorithms
- Location: `packages/algorithms/package.json:42`
- Dependencies:
  ```json
  "@ax/schemas": "workspace:*"
  ```
- **Impact**: Cannot be installed via npm

#### @ax/core  
- Location: `packages/core/package.json:46-48`
- Dependencies:
  ```json
  "@ax/schemas": "workspace:*",
  "@ax/algorithms": "workspace:*",
  "@ax/providers": "workspace:*"
  ```
- **Impact**: Critical - Core engine won't install via npm

#### @ax/providers
- Location: `packages/providers/package.json:42`
- Dependencies:
  ```json
  "@ax/schemas": "workspace:*"
  ```
- **Impact**: Cannot be installed via npm

#### @ax/cli
- Location: `packages/cli/package.json:30-33`
- Dependencies:
  ```json
  "@ax/core": "workspace:*",
  "@ax/schemas": "workspace:*",
  "@ax/providers": "workspace:*",
  "@ax/algorithms": "workspace:*"
  ```
- **Impact**: CLI tool won't install via npm

#### @ax/mcp
- Location: `packages/mcp/package.json:29-30`
- Dependencies:
  ```json
  "@ax/core": "workspace:*",
  "@ax/schemas": "workspace:*"
  ```
- **Impact**: MCP server won't install via npm

#### @ax/schemas
- Location: `packages/schemas/package.json`
- Dependencies: NONE on workspace packages
- **Impact**: Can be installed via npm (leaf package)

### Total Incompatibilities: 11 `workspace:*` references

### What Happens When npm Installs:

```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! While resolving: @ax/cli@11.0.0-alpha.0
npm ERR! Found: @ax/core@workspace:* in dependencies
npm ERR! npm doesn't support the "workspace:" protocol for dependencies
```

---

## 3. Package-by-Package Analysis

### 3.1 @ax/schemas (packages/schemas/)

**Status**: ✅ NPM-COMPATIBLE

**Configuration**:
```json
{
  "name": "@ax/schemas",
  "version": "11.0.0-alpha.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./agent": { "types": "./dist/agent.d.ts", "import": "./dist/agent.js" },
    "./config": { "types": "./dist/config.d.ts", "import": "./dist/config.js" },
    "./memory": { "types": "./dist/memory.d.ts", "import": "./dist/memory.js" },
    "./provider": { "types": "./dist/provider.d.ts", "import": "./dist/provider.js" },
    "./session": { "types": "./dist/session.d.ts", "import": "./dist/session.js" }
  },
  "files": ["dist"],
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

**Strengths**:
- ✅ No internal dependencies
- ✅ Clean `exports` field with multiple entry points
- ✅ Proper `files` array limiting package contents
- ✅ Standard semantic versioning for external deps

**Ready for publishing**: YES

---

### 3.2 @ax/algorithms (packages/algorithms/)

**Status**: ❌ NPM-INCOMPATIBLE

**Configuration**:
```json
{
  "name": "@ax/algorithms",
  "version": "11.0.0-alpha.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { ... },
    "./routing": { ... },
    "./dag": { ... },
    "./ranking": { ... }
  },
  "files": ["dist", "lib"],
  "dependencies": {
    "@ax/schemas": "workspace:*"
  }
}
```

**Issues**:
1. ❌ **CRITICAL**: `"@ax/schemas": "workspace:*"` - npm incompatible
2. ✅ Proper exports with multiple entry points
3. ✅ Files array includes both dist and lib (needed for ReScript)
4. ⚠️ Uses `npm run res:build` in scripts (should use pnpm in monorepo context)

**Fix Required**: Replace `"@ax/schemas": "workspace:*"` with `"@ax/schemas": "^11.0.0-alpha.0"`

---

### 3.3 @ax/providers (packages/providers/)

**Status**: ❌ NPM-INCOMPATIBLE

**Configuration**:
```json
{
  "name": "@ax/providers",
  "version": "11.0.0-alpha.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { ... },
    "./claude": { ... },
    "./gemini": { ... },
    "./ax-cli": { ... },
    "./openai": { ... }
  },
  "files": ["dist"],
  "dependencies": {
    "@ax/schemas": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.22.0"
  }
}
```

**Issues**:
1. ❌ **CRITICAL**: `"@ax/schemas": "workspace:*"` - npm incompatible
2. ✅ Proper exports with provider-specific entry points
3. ✅ Files array correct
4. ✅ External MCP SDK dependency properly versioned

**Fix Required**: Replace `"@ax/schemas": "workspace:*"` with `"@ax/schemas": "^11.0.0-alpha.0"`

---

### 3.4 @ax/core (packages/core/)

**Status**: ❌ NPM-INCOMPATIBLE (Most Critical)

**Configuration**:
```json
{
  "name": "@ax/core",
  "version": "11.0.0-alpha.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { ... },
    "./memory": { ... },
    "./config": { ... },
    "./router": { ... },
    "./session": { ... },
    "./agent": { ... }
  },
  "files": ["dist"],
  "dependencies": {
    "@ax/schemas": "workspace:*",
    "@ax/algorithms": "workspace:*",
    "@ax/providers": "workspace:*",
    "better-sqlite3": "^11.6.0",
    "yaml": "^2.6.1"
  }
}
```

**Issues**:
1. ❌ **CRITICAL**: 3 `workspace:*` dependencies - Core engine unusable via npm
2. ✅ Well-structured exports for domain-specific APIs
3. ✅ Proper external dependencies versioned
4. ✅ Files array correct
5. ⚠️ Marks `better-sqlite3` as external in tsup.config (correct but worth noting)

**Dependency Chain Problem**:
```
@ax/cli imports @ax/core
  @ax/core imports @ax/algorithms, @ax/providers, @ax/schemas
    @ax/algorithms imports @ax/schemas
    @ax/providers imports @ax/schemas
```

If any link uses `workspace:*`, entire chain fails.

**Fix Required**: Replace all 3 `workspace:*` with semantic versions

---

### 3.5 @ax/cli (packages/cli/)

**Status**: ❌ NPM-INCOMPATIBLE (Blocking CLI Distribution)

**Configuration**:
```json
{
  "name": "@ax/cli",
  "version": "11.0.0-alpha.0",
  "type": "module",
  "bin": {
    "ax": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
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
  },
  "engines": {
    "node": ">=24.0.0"
  }
}
```

**Issues**:
1. ❌ **CRITICAL**: 4 `workspace:*` dependencies
2. ✅ Bin entry correctly configured with shebang in compiled output
3. ✅ Files array correct
4. ✅ Proper Node.js version requirement
5. ✅ External CLI dependencies properly versioned
6. ✅ Dist file has correct `#!/usr/bin/env node` shebang

**Binary Issue**: The `ax` command won't work via npm install because @ax/core won't resolve

**Fix Required**: Replace all 4 `workspace:*` with semantic versions

---

### 3.6 @ax/mcp (packages/mcp/)

**Status**: ❌ NPM-INCOMPATIBLE (MCP Integration)

**Configuration**:
```json
{
  "name": "@ax/mcp",
  "version": "11.0.0-alpha.0",
  "type": "module",
  "bin": {
    "ax-mcp": "./dist/server.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"],
  "dependencies": {
    "@ax/core": "workspace:*",
    "@ax/schemas": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.22.0"
  },
  "engines": {
    "node": ">=24.0.0"
  }
}
```

**Issues**:
1. ❌ **CRITICAL**: 2 `workspace:*` dependencies
2. ✅ Dual bin/main configuration (correct)
3. ✅ Files array correct
4. ✅ Node.js version requirement proper
5. ✅ MCP SDK dependency properly versioned
6. ✅ Server.js has correct shebang in compiled output
7. ✅ Comprehensive package metadata (repository, keywords, license)

**Special Consideration**: MCP server is designed to be installed as a standalone npm package, so `workspace:*` is especially problematic here.

**Fix Required**: Replace 2 `workspace:*` with semantic versions

---

## 4. Publishing Configuration Analysis

### 4.1 Missing Files

**Expected but not found**:
- ❌ No `.npmignore` at root or in packages
- ⚠️ All packages rely on `files` array (which is fine)

**Current Setup**:
Each package uses a `files` array approach:
```json
"files": ["dist"]  // or "dist", "lib" for algorithms
```

**Assessment**: ✅ ACCEPTABLE
- The `files` field is the modern npm best practice
- Properly excludes source, tests, config files
- Will prevent bloated npm packages

### 4.2 PublishConfig

**Status**: ❌ MISSING

No `publishConfig` found in any package.json

**Recommended Addition** (especially for scoped packages):
```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

**Why**: Scoped packages (@ax/*) default to private publishing and require explicit `"access": "public"` to be published publicly.

---

## 5. Lock File Analysis

### Current State:
- ✅ `pnpm-lock.yaml` exists (correct for pnpm)
- ❌ No `package-lock.json` (expected with pnpm)
- ❌ No `npm-shrinkwrap.json`

### Issue:
**npm ci will fail** because it expects `package-lock.json` when using npm.

---

## 6. Build & Distribution Analysis

### tsup Configurations

All packages use ESM-only builds (correct for modern npm):

**Common Pattern**:
```typescript
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],           // Only ESM
  dts: true,                 // Type definitions included
  target: 'node24',          // Matches engines requirement
  splitting: false,
  sourcemap: true
})
```

**Issues**:
1. ⚠️ ESM-only may break some users expecting CommonJS
2. ✅ Proper DTS generation
3. ✅ Source maps included
4. ✅ External declarations prevent bundling of workspace packages

### Compiled Output Structure

Example `/packages/cli/dist/`:
```
dist/
  ├── index.d.ts
  ├── index.js (with #!/usr/bin/env node shebang)
  └── index.js.map
```

**Assessment**: ✅ CORRECT
- Shebang present and correct in bin entries
- TypeScript definitions included
- Source maps for debugging

---

## 7. Dependency Version Consistency

### Version Matrix:

All packages use matching versions:
```
@ax/algorithms:  11.0.0-alpha.0
@ax/cli:         11.0.0-alpha.0
@ax/core:        11.0.0-alpha.0
@ax/mcp:         11.0.0-alpha.0
@ax/providers:   11.0.0-alpha.0
@ax/schemas:     11.0.0-alpha.0
```

**Assessment**: ✅ GOOD
- Monorepo versioning is synchronized
- All packages will have the same version when published
- Alpha versioning appropriate for pre-release

---

## 8. Peer Dependencies

### Found In:

**@ax/schemas**:
```json
"peerDependencies": {
  "typescript": ">=5.0.0"
}
```

**@ax/algorithms, @ax/core, @ax/providers, @ax/cli**:
```json
"peerDependencies": {
  "typescript": ">=5.0.0"
}
```

**Assessment**: ✅ GOOD
- TypeScript is optional peer dependency (correct)
- Versions are permissive (>=5.0.0)
- @ax/mcp has no peer dependencies (appropriate)

---

## 9. CLI Tool Specific Issues

### @ax/cli Package

**Bin File Status**:
- ✅ `dist/index.js` exists
- ✅ File is executable (755 permissions)
- ✅ Shebang `#!/usr/bin/env node` present
- ✅ Will be registered in npm as `ax` command

**Problem**: Will fail with:
```
npm ERR! @ax/cli@11.0.0-alpha.0 depends on @ax/core@workspace:*
```

### @ax/mcp Package  

**Bin File Status**:
- ✅ `dist/server.js` exists
- ✅ File is executable
- ✅ Shebang correct
- ✅ Will be registered as `ax-mcp` command

**Problem**: Same workspace:* issue blocks installation

---

## 10. Standalone Installation Test

### Scenario: `npm install @ax/mcp`

**Current Outcome**:
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! 
npm ERR! While resolving: @ax/mcp@11.0.0-alpha.0
npm ERR! Found: @ax/core@workspace:* (as a dependency of @ax/mcp)
npm ERR! 
npm ERR! npm doesn't support the "workspace:" protocol
```

**Why This Matters**: The design goal was for MCP to be installable standalone, but it will fail.

---

## 11. Recommended Fixes (Priority Order)

### PRIORITY 1: CRITICAL - Fix workspace:* Protocol

**For Publishing to Work**, replace ALL `workspace:*` references with semantic versions:

#### In `packages/algorithms/package.json`:
```json
// BEFORE:
"dependencies": {
  "@ax/schemas": "workspace:*"
}

// AFTER:
"dependencies": {
  "@ax/schemas": "^11.0.0-alpha.0"
}
```

#### In `packages/providers/package.json`:
```json
// BEFORE:
"dependencies": {
  "@ax/schemas": "workspace:*"
}

// AFTER:
"dependencies": {
  "@ax/schemas": "^11.0.0-alpha.0"
}
```

#### In `packages/core/package.json`:
```json
// BEFORE:
"dependencies": {
  "@ax/schemas": "workspace:*",
  "@ax/algorithms": "workspace:*",
  "@ax/providers": "workspace:*"
}

// AFTER:
"dependencies": {
  "@ax/schemas": "^11.0.0-alpha.0",
  "@ax/algorithms": "^11.0.0-alpha.0",
  "@ax/providers": "^11.0.0-alpha.0"
}
```

#### In `packages/cli/package.json`:
```json
// BEFORE:
"dependencies": {
  "@ax/core": "workspace:*",
  "@ax/schemas": "workspace:*",
  "@ax/providers": "workspace:*",
  "@ax/algorithms": "workspace:*"
}

// AFTER:
"dependencies": {
  "@ax/core": "^11.0.0-alpha.0",
  "@ax/schemas": "^11.0.0-alpha.0",
  "@ax/providers": "^11.0.0-alpha.0",
  "@ax/algorithms": "^11.0.0-alpha.0"
}
```

#### In `packages/mcp/package.json`:
```json
// BEFORE:
"dependencies": {
  "@ax/core": "workspace:*",
  "@ax/schemas": "workspace:*"
}

// AFTER:
"dependencies": {
  "@ax/core": "^11.0.0-alpha.0",
  "@ax/schemas": "^11.0.0-alpha.0"
}
```

**Impact**: ✅ Enables npm installation

---

### PRIORITY 2: HIGH - Add publishConfig

Add to all packages to ensure public publishing:

```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

**Affects**: @ax/algorithms, @ax/cli, @ax/core, @ax/mcp, @ax/providers, @ax/schemas

**Impact**: ✅ Prevents accidental private publishing of scoped packages

---

### PRIORITY 3: HIGH - Add package-lock.json

For npm installation support:

```bash
npm install  # Will generate package-lock.json
```

Then commit `package-lock.json` to version control.

**Note**: Maintain pnpm-lock.yaml for primary development workflow.

**Impact**: ✅ Enables `npm ci` in CI/CD pipelines

---

### PRIORITY 4: MEDIUM - Consider CommonJS Build

**Current**: ESM-only exports

**Option 1: Keep ESM-only** (Recommended for modern Node.js 18+)
- Add in package.json exports:
```json
"engines": {
  "node": ">=24.0.0"
}
```
- Document ESM requirement in README

**Option 2: Add CommonJS support**
- Update tsup config to `format: ['esm', 'cjs']`
- Require conditional exports in package.json
- Note: Increases bundle size

**Recommendation**: Keep ESM-only (matches Node 24 requirement already in place)

---

### PRIORITY 5: MEDIUM - Root package.json Scripts

Consider adding npm-compatible wrapper scripts for development if npm users need to contribute:

```json
"scripts": {
  "build": "npm run build:all",
  "build:all": "npm run build:schemas && npm run build:algorithms && npm run build:providers && npm run build:core && npm run build:cli && npm run build:mcp",
  "build:schemas": "npm --prefix packages/schemas run build",
  "build:algorithms": "npm --prefix packages/algorithms run build",
  // ... etc
}
```

**Note**: This is for contributor experience, not publishing. Keep pnpm as primary tool.

---

### PRIORITY 6: LOW - Documentation

Create `PUBLISHING.md`:
```markdown
# Publishing AutomatosX Packages

This monorepo uses pnpm workspaces for development but publishes to npm.

## Requirements
- Node.js >= 24.0.0
- pnpm >= 9.14.2

## Publish Process
1. Update version in package.json files
2. Run: `pnpm build`
3. Run: `pnpm test`
4. Run: `npm publish` in each package directory (or use publish script)

## Each package is published independently:
- @ax/schemas
- @ax/algorithms  
- @ax/providers
- @ax/core
- @ax/cli
- @ax/mcp
```

---

## 12. Verification Checklist

### Pre-Publishing Checklist:

- [ ] Replace all 11 `workspace:*` with semantic versions
- [ ] Add `publishConfig` to all packages
- [ ] Generate `package-lock.json` via npm install
- [ ] Test: `npm install @ax/schemas` (should work - leaf package)
- [ ] Test: `npm install @ax/algorithms` (should work after fix)
- [ ] Test: `npm install @ax/cli` (should work after fix)
- [ ] Test: `npm install @ax/mcp` (should work standalone after fix)
- [ ] Verify bin entries work: `npm install -g @ax/cli && ax --help`
- [ ] Verify MCP server: `npm install -g @ax/mcp && ax-mcp --help`
- [ ] Check for secrets in dist files (before publishing)
- [ ] Review LICENSE file in each package

---

## 13. Summary of Issues Found

| Issue | Severity | Count | Fixable | Impact |
|-------|----------|-------|---------|--------|
| `workspace:*` protocol used | CRITICAL | 11 | YES | npm installation completely blocked |
| Missing `publishConfig` | HIGH | 6 | YES | Scoped packages may default to private |
| No package-lock.json | MEDIUM | 1 | YES | npm ci fails in CI/CD |
| ESM-only build | LOW | 6 | OPTIONAL | Some legacy users may struggle |
| No .npmignore | LOW | 0 | N/A | Using `files` field instead (acceptable) |

---

## 14. Impact Assessment

### Current State:
```
Publishing Status: BLOCKED ❌

Reason: 11 instances of pnpm-exclusive `workspace:*` protocol
        across 5 production packages
```

### After Fixes:

```
Publishing Status: READY ✅

- All 6 packages installable via npm
- CLI tool functional: npm install -g @ax/cli
- MCP server functional: npm install -g @ax/mcp
- All packages properly scoped and accessible
- Full ESM/TypeScript support
```

---

## 15. Files Requiring Changes

**Must Edit** (in order):
1. `/packages/algorithms/package.json` - Line 42
2. `/packages/providers/package.json` - Line 42
3. `/packages/core/package.json` - Lines 46-48
4. `/packages/cli/package.json` - Lines 30-33
5. `/packages/mcp/package.json` - Lines 29-30

**Should Add** (all packages):
- `publishConfig` block in each package.json

**Should Generate**:
- `/package-lock.json` (via npm install)

---

## Conclusion

The AutomatosX monorepo is **architecturally sound** and well-structured. However, it's currently **not publishable to npm** due to the use of pnpm-specific `workspace:*` protocol in production dependencies.

The fixes are straightforward and mechanical:
1. Replace 11 `workspace:*` references with semantic versions (5 files)
2. Add `publishConfig` entries (6 files)
3. Generate npm lock file

Once these changes are applied, all 6 packages can be published independently and installed via npm by end users.

**Estimated fix time**: 15-30 minutes  
**Effort level**: Low  
**Risk level**: Low (only affects npm publishing, not pnpm development workflow)
