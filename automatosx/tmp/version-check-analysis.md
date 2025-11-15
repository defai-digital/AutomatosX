# Version Check Analysis - esbuild CORS Vulnerability

**Date**: 2025-11-15
**Status**: ⚠️ **VULNERABLE** - Action required

## Current Versions

| Package | Current | Vulnerable? | Fix Available |
|---------|---------|-------------|---------------|
| **vite** | 5.4.21 | ✅ Latest v5.x | ⚠️ Must upgrade to v6.2.0+ |
| **esbuild** | 0.21.5 | ❌ YES (via vite) | ✅ 0.25.0+ |
| **tsx** | 4.20.6 | ✅ Uses esbuild 0.25.12 | ✅ Already safe |

## Vulnerability Details

**CVE**: GHSA-67mh-4wv8-2f99
**Published**: 2025-02-10
**Affected**: esbuild <=0.24.2
**Fixed**: esbuild >=0.25.0

## Dependency Chain Analysis

### Current State (VULNERABLE)

```
vite@5.4.21 (devDependency)
├── Depends on: esbuild ^0.21.3
└── Resolves to: esbuild 0.21.5 ❌ VULNERABLE

vitest@3.2.4 (devDependency)
├── Depends on: vite@5.4.21
└── Uses: esbuild 0.21.5 ❌ VULNERABLE

@vitejs/plugin-react@4.7.0 (devDependency)
├── Depends on: vite@5.4.21
└── Uses: esbuild 0.21.5 ❌ VULNERABLE

tsx@4.20.6 (devDependency)
└── Uses: esbuild 0.25.12 ✅ SAFE
```

### Fix Path

**Option 1: Upgrade to vite 6.2.0+** (RECOMMENDED)
```
vite@6.2.0+ (latest: 6.2.7)
├── Depends on: esbuild ^0.25.0
└── Resolves to: esbuild 0.25.x ✅ SAFE
```

**Option 2: Stay on vite 5.x** (NOT RECOMMENDED)
- vite 5.4.21 is the latest v5.x release
- No v5.x version uses esbuild 0.25.0+
- Would require manual override (not recommended)

## Impact Assessment

### Who is Affected?

**Developers running**:
- `pnpm run dev:web` - Web UI development server
- `pnpm run preview:web` - Preview production build

**NOT affected**:
- ✅ Production builds (`pnpm run build:web`)
- ✅ Published npm package
- ✅ CLI users (`pnpm run cli`)
- ✅ Test suite (`pnpm test`)
- ✅ End users installing from npm

### Attack Scenario

1. Developer runs `pnpm run dev:web` (starts vite dev server on localhost:5173)
2. Developer browses to malicious website while dev server is running
3. Malicious website sends `fetch('http://localhost:5173/src/App.tsx')`
4. Due to `Access-Control-Allow-Origin: *`, request succeeds
5. Attacker steals source code

### Risk Level

**Severity**: MODERATE (CVSS 5.3)

**Likelihood**: LOW
- Requires developer to run dev server
- Requires developer to visit malicious site simultaneously
- Requires attacker to know dev server port
- Requires attacker to know file structure

**Real-world Impact**: LOW
- Web UI is minimal (React dashboard, not core product)
- Most development is CLI-focused
- Source code is open-source (Apache 2.0)

## Recommended Action

### Option A: Upgrade to vite 6 (Breaking Changes)

**Pros**:
- ✅ Fixes security vulnerability
- ✅ Latest features and performance
- ✅ Future-proof

**Cons**:
- ❌ Breaking changes (v5 → v6)
- ❌ May require code changes
- ❌ Requires testing web UI
- ❌ Time investment: 2-3 hours

**Commands**:
```bash
# Upgrade vite to v6
pnpm update vite@^6.2.0

# Update plugins if needed
pnpm update @vitejs/plugin-react@latest

# Test web UI
pnpm run build:web
pnpm run dev:web
pnpm test -- src/web
```

### Option B: Accept Risk (Temporary)

**Justification**:
- Web UI is minimal (dashboard only, not core product)
- Attack requires specific conditions
- Source code is public (Apache 2.0 license)
- Can defer until v9.0.0 major update

**Mitigation**:
- Document risk in README/INSTALLATION.md
- Warn developers not to visit untrusted sites while running dev server
- Use `--host 127.0.0.1` to restrict dev server to localhost only

**Workaround**:
```bash
# Run dev server with restricted host
pnpm run dev:web -- --host 127.0.0.1

# Or add to vite.config.ts
server: {
  host: '127.0.0.1',
  strictPort: true
}
```

### Option C: Override esbuild Version (HACKY)

**NOT RECOMMENDED** - Forces specific esbuild version

```json
{
  "pnpm": {
    "overrides": {
      "esbuild": "^0.25.0"
    }
  }
}
```

**Why not recommended**:
- May break vite compatibility
- Untested configuration
- Better to upgrade vite properly

## Comparison with Other Vulnerabilities

### js-yaml (CVE-2024-12269)

**Status**: DOCUMENTED, not fixed
**Reason**: Breaking changes in js-yaml 5.x
**Impact**: Only affects YAML parsing with untrusted input
**Mitigation**: Input validation, documented in ADR

### onnxruntime-node

**Status**: KNOWN LIMITATION, not fixable
**Reason**: Upstream compatibility issue with Node.js 24
**Impact**: 14 embedding tests fail
**Mitigation**: Use Node.js 20 LTS

### esbuild CORS (this one)

**Status**: FIXABLE by upgrading vite
**Impact**: Development server only
**Fix**: Upgrade vite 5 → 6

## Decision Matrix

| Criteria | Upgrade to vite 6 | Accept Risk | Override esbuild |
|----------|-------------------|-------------|------------------|
| **Security** | ✅ Fixed | ⚠️ Vulnerable | ⚠️ Untested |
| **Time** | ❌ 2-3 hours | ✅ 0 hours | ⚠️ 1 hour |
| **Risk** | ⚠️ Breaking changes | ⚠️ Security risk | ❌ May break build |
| **Long-term** | ✅ Future-proof | ❌ Tech debt | ❌ Hacky |
| **Recommended** | ✅ **YES** | ⚠️ Temporary | ❌ **NO** |

## Recommendation

### ✅ Upgrade to vite 6.2.0+ in v8.0.7

**Reasoning**:
1. Security fix for MODERATE vulnerability
2. Latest v5.x (5.4.21) doesn't have fix
3. vite 6 is stable (released Oct 2024)
4. Web UI is small - low migration risk
5. Better to fix now than defer to v9.0.0

**Timeline**:
- v8.0.7 (next week): Upgrade vite 5 → 6, test web UI
- Estimated time: 2-3 hours
- Risk: Low (web UI is minimal)

### Alternative: Document Risk, Fix in v9.0.0

**If deferring**:
- Add warning to INSTALLATION.md
- Document attack scenario
- Provide mitigation (--host 127.0.0.1)
- Schedule fix for v9.0.0 major update

## Testing Checklist (if upgrading)

- [ ] Update vite to 6.2.0+
- [ ] Update @vitejs/plugin-react to latest
- [ ] Run `pnpm run build:web` (check for errors)
- [ ] Run `pnpm run dev:web` (verify dev server works)
- [ ] Test web UI manually (all pages load)
- [ ] Run `pnpm test -- src/web` (all web tests pass)
- [ ] Check for vite 6 breaking changes
- [ ] Update vite.config.ts if needed
- [ ] Verify production build works
- [ ] Document changes in CHANGELOG.md

## Conclusion

**Current Status**: ⚠️ VULNERABLE (esbuild 0.21.5 via vite 5.4.21)
**Fix Available**: ✅ YES (vite 6.2.0+ uses esbuild 0.25.0+)
**Recommended Action**: Upgrade vite to 6.2.0+ in v8.0.7

**Impact if not fixed**:
- Development server has CORS vulnerability
- Attack requires specific conditions (low likelihood)
- Does NOT affect production or published package

**Next Step**: Decide whether to:
1. ✅ Upgrade vite to 6.2.0+ now (v8.0.7)
2. ⚠️ Document risk and defer to v9.0.0
