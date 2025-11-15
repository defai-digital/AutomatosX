# Deprecated Dependencies Audit

**Date**: 2025-11-15
**Status**: 1 deprecated package found

## Summary

Found **1 deprecated package** in dependencies:
- `@types/handlebars` - Can be safely removed (handlebars includes its own types)

## Deprecated Packages

### 1. @types/handlebars ⚠️ DEPRECATED

**Current Version**: 4.1.0
**Status**: DEPRECATED
**Reason**: Stub types definition - handlebars provides its own type definitions

**Deprecation Message**:
```
This is a stub types definition. handlebars provides its own type definitions,
so you do not need this installed.
```

**Impact**: LOW
- handlebars@4.7.8 includes `runtime.d.ts`
- Removing `@types/handlebars` will not break type checking

**Action Required**: ✅ Remove from package.json

**Fix**:
```bash
pnpm remove @types/handlebars
```

---

## Outdated (Not Deprecated) Packages

These packages have newer versions available but are NOT deprecated:

### Major Version Updates Available

| Package | Current | Latest | Breaking Changes Risk |
|---------|---------|--------|----------------------|
| `@mui/icons-material` | 5.18.0 | 7.3.5 | HIGH (v5 → v7) |
| `@mui/material` | 5.18.0 | 7.3.5 | HIGH (v5 → v7) |
| `react` | 18.3.1 | 19.2.0 | MEDIUM (v18 → v19) |
| `react-dom` | 18.3.1 | 19.2.0 | MEDIUM (v18 → v19) |
| `react-router-dom` | 6.30.2 | 7.9.6 | MEDIUM (v6 → v7) |
| `inquirer` | 9.3.8 | 12.11.1 | HIGH (v9 → v12) |
| `vite` | 5.4.21 | 7.2.2 | MEDIUM (v5 → v7) |
| `vitest` | 3.2.4 | 4.0.9 | LOW (v3 → v4) |
| `zod` | 3.25.76 | 4.1.12 | HIGH (v3 → v4) |
| `jsdom` | 23.2.0 | 27.2.0 | MEDIUM |

**Recommendation**: Defer major updates until after v8.0.6 stabilizes
- Current versions work correctly
- Major updates require testing and migration
- No security vulnerabilities reported

### Minor/Patch Updates Available

| Package | Current | Latest | Risk |
|---------|---------|--------|------|
| `@anthropic-ai/sdk` | 0.68.0 | 0.69.0 | LOW |
| `better-sqlite3` | 11.10.0 | 12.4.1 | MEDIUM |
| `node-gyp` (dev) | 10.3.1 | 12.1.0 | LOW |
| `tree-sitter-c-sharp` | 0.21.3 | 0.23.1 | LOW |
| `tree-sitter-cpp` | 0.21.0 | 0.23.4 | LOW |
| `tree-sitter-go` | 0.21.2 | 0.25.0 | LOW |

**Recommendation**: Safe to update incrementally
- Minor version bumps are usually backwards compatible
- Tree-sitter packages can be updated to latest

---

## Immediate Action Required

### Remove @types/handlebars ✅

**Why**: Package is deprecated and unnecessary

**Steps**:
1. Remove from package.json
2. Reinstall dependencies
3. Verify TypeScript compilation still works
4. Run tests

**Commands**:
```bash
# Remove deprecated package
pnpm remove @types/handlebars

# Verify builds still work
pnpm run build

# Verify tests still pass
pnpm test

# Verify handlebars types are available
pnpm exec tsc --noEmit --skipLibCheck src/speckit/*.ts
```

**Expected Outcome**:
- TypeScript still finds handlebars types (from handlebars package itself)
- No compilation errors
- All tests pass

---

## Future Maintenance Plan

### v8.0.7 (Next Patch) - Remove Deprecated Package

**Changes**:
- Remove `@types/handlebars` from dependencies
- Update minor versions of safe packages:
  - `@anthropic-ai/sdk`: 0.68.0 → 0.69.0
  - `tree-sitter-c-sharp`: 0.21.3 → 0.23.1
  - `tree-sitter-cpp`: 0.21.0 → 0.23.4
  - `tree-sitter-go`: 0.21.2 → 0.25.0

**Estimated Time**: 15 minutes
**Risk**: Very low

### v8.1.0 (Minor Update) - Safe Updates

**Changes**:
- Update Vitest: 3.2.4 → 4.0.9 (test framework)
- Update better-sqlite3: 11.10.0 → 12.4.1 (database)
- Update node-gyp: 10.3.1 → 12.1.0 (build tool)
- Update @types packages (React, etc.)

**Estimated Time**: 1-2 hours (includes testing)
**Risk**: Low (breaking changes unlikely)

### v9.0.0 (Major Update) - Breaking Changes

**Changes**:
- React 18 → 19 (requires migration)
- MUI 5 → 7 (major API changes)
- Zod 3 → 4 (type changes)
- Vite 5 → 7 (config changes)
- Inquirer 9 → 12 (API changes)
- React Router 6 → 7 (routing changes)

**Estimated Time**: 1-2 weeks (extensive testing required)
**Risk**: High (multiple breaking changes)
**Prerequisites**:
- Full test coverage
- Migration guides reviewed
- Staging environment testing

---

## Security Audit

Running security check:
```bash
pnpm audit
```

**Result**: ⚠️ **1 moderate vulnerability** found

### CVE: esbuild CORS Vulnerability (GHSA-67mh-4wv8-2f99)

**Severity**: MODERATE (CVSS 5.3)
**Package**: `esbuild@0.21.5` (transitive dependency via vite)
**Vulnerable Versions**: <=0.24.2
**Patched Version**: >=0.25.0

**Vulnerability**: esbuild allows any website to send requests to the development server and read the response due to default CORS settings (`Access-Control-Allow-Origin: *`)

**Attack Scenario**:
1. Attacker serves malicious webpage
2. User accesses malicious page while running esbuild dev server
3. Attacker sends `fetch('http://127.0.0.1:8000/main.js')` from malicious page
4. Attacker steals source code

**Impact**:
- ⚠️ **Development only** - affects `pnpm run dev:web` users
- ✅ **Production safe** - does not affect compiled bundles or CLI
- ✅ **Not exposed in published npm package**

**Paths Affected**:
- `vite@5.4.21 > esbuild@0.21.5`
- `vitest@3.2.4 > vite@5.4.21 > esbuild@0.21.5`
- `@vitejs/plugin-react@4.7.0 > vite@5.4.21 > esbuild@0.21.5`

**Fix**: Upgrade vite to latest version (which uses esbuild 0.25.0+)
```bash
pnpm update vite@latest
```

**Workaround** (if not upgrading immediately):
- Don't access untrusted websites while running dev server
- Use `--host` flag to bind to specific interface (not 0.0.0.0)
- Run dev server in isolated network environment

**References**:
- GitHub Advisory: https://github.com/advisories/GHSA-67mh-4wv8-2f99
- CVE: CWE-346 (Origin Validation Error)
- Fix Commit: https://github.com/evanw/esbuild/commit/de85afd65edec9ebc44a11e245fd9e9a2e99760d

**Additional Notes**:
- GitHub Dependabot alert #6: https://github.com/defai-digital/AutomatosX/security/dependabot/6

---

## Recommendations

### Immediate (v8.0.7)
✅ **Remove `@types/handlebars`** - Deprecated, unnecessary
✅ **Update vite** - Fixes esbuild CORS vulnerability (MODERATE severity)
✅ **Update tree-sitter parsers** - Minor version bumps, safe
✅ **Update @anthropic-ai/sdk** - Patch update, low risk

### Short-term (v8.1.0 - 1 month)
⬜ Update Vitest 3 → 4 (test framework)
⬜ Update better-sqlite3 11 → 12 (database)
⬜ Update node-gyp 10 → 12 (build tool)
⬜ Review and address Dependabot alert

### Long-term (v9.0.0 - 3-6 months)
⬜ Plan React 18 → 19 migration
⬜ Plan MUI 5 → 7 migration (major UI changes)
⬜ Plan Zod 3 → 4 migration (type system changes)
⬜ Plan Vite 5 → 7 migration (build system)
⬜ Coordinate all breaking changes in single major release

---

## Testing Checklist for Updates

Before any dependency update:
- [ ] Read CHANGELOG for breaking changes
- [ ] Check migration guide (if major version)
- [ ] Update package.json
- [ ] Run `pnpm install`
- [ ] Run `pnpm run build` (check for errors)
- [ ] Run `pnpm test` (all tests must pass)
- [ ] Test CLI manually: `pnpm run cli -- status`
- [ ] Test web UI: `pnpm run dev:web` (if UI deps changed)
- [ ] Review TypeScript errors (if any)
- [ ] Test in clean environment (Docker or fresh clone)
- [ ] Update CHANGELOG.md
- [ ] Commit with descriptive message

---

## Conclusion

### Current Status: ⚠️ NEEDS ATTENTION

**Deprecated packages**: 1 (low risk, easy fix)
**Security vulnerabilities**: 1 MODERATE (esbuild CORS - dev only)
**Outdated packages**: 24 (all optional, no urgency)

### Action Plan

**v8.0.7** (next week):
- 🔒 **SECURITY**: Update vite to fix esbuild CORS vulnerability
- Remove `@types/handlebars` (deprecated)
- Update tree-sitter parsers to latest
- Update @anthropic-ai/sdk to 0.69.0

**v8.1.0** (1 month):
- Safe minor/patch updates
- Test framework updates
- Build tool updates

**v9.0.0** (3-6 months):
- Major framework migrations (React 19, MUI 7, etc.)
- Comprehensive testing required
- Migration guides prepared

---

**⚠️ Action recommended** - One moderate security vulnerability found.

**Priority Actions**:
1. 🔒 Update vite to fix esbuild CORS vulnerability (affects dev server only)
2. Remove deprecated `@types/handlebars` package (no impact on functionality)

**Risk Assessment**:
- **Production**: ✅ Safe - vulnerability only affects development server
- **Development**: ⚠️ MODERATE - developers should avoid untrusted websites while running `pnpm run dev:web`
- **Published Package**: ✅ Safe - vulnerability not included in npm distribution
