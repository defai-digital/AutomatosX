# End User Peer Dependency Warnings - Root Cause & Solutions

**Date**: 2025-11-15
**Status**: Issue identified, solutions being evaluated

## Problem Statement

When users install `@defai.digital/automatosx@8.0.5` from npm registry using pnpm, they see 25+ peer dependency warnings:

```
WARN  Issues with peer dependencies found
.
└─┬ @defai.digital/automatosx 8.0.5
  ├─┬ tree-sitter-c 0.24.1
  │ └── ✕ unmet peer tree-sitter@^0.22.4: found 0.25.0
  ├─┬ tree-sitter-cpp 0.21.0
  │ └── ✕ unmet peer tree-sitter@^0.21.1: found 0.25.0
  [... 25+ more]
```

**Impact**:
- ❌ Poor UX - users think something is broken
- ✅ Package still works correctly
- ✅ Development environment has no warnings (pnpm.peerDependencyRules works)
- ❌ End users don't inherit pnpm configuration from published package

## Root Cause Analysis

### Why Development Works

In `/Users/akiralam/code/automatosx2/package.json`:
```json
{
  "pnpm": {
    "overrides": {
      "tree-sitter": "^0.25.0"
    },
    "peerDependencyRules": {
      "allowedVersions": {
        "tree-sitter": "0.25"
      }
    }
  }
}
```

This configuration:
- ✅ Applies when developers run `pnpm install` in the project
- ✅ Forces all tree-sitter packages to use v0.25.0
- ✅ Suppresses peer dependency warnings locally
- ❌ NOT included in published package metadata
- ❌ End users don't inherit these rules

### Why End Users See Warnings

When npm publishes `@defai.digital/automatosx@8.0.5`:
1. Package metadata includes `dependencies` (tree-sitter packages)
2. Package metadata includes `peerDependencies` (if defined)
3. Package metadata **DOES NOT** include `pnpm.peerDependencyRules`
4. Users' pnpm reads peer dependencies from tree-sitter packages directly
5. Each tree-sitter package declares `"peerDependencies": { "tree-sitter": "^0.21.0" }`
6. User's pnpm sees mismatch: expected `^0.21.0`, found `0.25.0`
7. Warnings appear

**Key insight**: `pnpm.peerDependencyRules` is a **local configuration**, not package metadata.

## Solution Options

### Option 1: Add .npmrc Template for Users ✅ RECOMMENDED

**Approach**: Provide `.npmrc` file users can copy to their project

**Create `/Users/akiralam/code/automatosx2/.npmrc.example`**:
```ini
# AutomatosX Configuration
# Copy this file to .npmrc in your project root to suppress peer dependency warnings

# Suppress tree-sitter peer dependency warnings
legacy-peer-deps=true

# Or use strict-peer-dependencies=false (pnpm)
strict-peer-dependencies=false
```

**Pros**:
- ✅ Simple for users
- ✅ Works with both npm and pnpm
- ✅ No code changes required
- ✅ Users have control

**Cons**:
- ❌ Requires user action (copy file)
- ❌ Not automatic

**Documentation update**:
```markdown
### Suppress Peer Dependency Warnings

If you see warnings about tree-sitter peer dependencies, copy `.npmrc.example` to `.npmrc` in your project:

```bash
curl -o .npmrc https://raw.githubusercontent.com/defai-digital/automatosx/main/.npmrc.example
```

Or create `.npmrc` manually:
```ini
strict-peer-dependencies=false
```
```

---

### Option 2: Bundle tree-sitter Dependencies ⚠️ NOT RECOMMENDED

**Approach**: Use `bundleDependencies` to include tree-sitter packages in tarball

**Changes to `package.json`**:
```json
{
  "bundleDependencies": [
    "tree-sitter",
    "tree-sitter-bash",
    "tree-sitter-c",
    // ... all 43 tree-sitter packages
  ]
}
```

**Pros**:
- ✅ No peer dependency warnings
- ✅ Automatic for users

**Cons**:
- ❌ Package size: 5MB → 15MB (3x larger)
- ❌ Slow npm publish (bundle all packages)
- ❌ Duplicate installations if users have tree-sitter elsewhere
- ❌ Breaks semantic versioning updates

**Verdict**: Too much downside for cosmetic benefit

---

### Option 3: Update Tree-sitter Packages to v0.25.0 Compatibility ⚠️ UPSTREAM ISSUE

**Approach**: Submit PRs to tree-sitter language packages to update peer dependency

**Changes required** (in upstream repos):
```json
{
  "peerDependencies": {
    "tree-sitter": "^0.21.0 || ^0.22.0 || ^0.25.0"
  }
}
```

**Pros**:
- ✅ Fixes root cause
- ✅ Benefits entire ecosystem

**Cons**:
- ❌ Requires 43 PRs to different maintainers
- ❌ Months/years for all to merge
- ❌ Not under our control
- ❌ Not realistic short-term solution

**Verdict**: Good long-term, not viable for v8.0.6

---

### Option 4: Use peerDependenciesMeta to Mark as Optional ❌ DOESN'T HELP END USERS

**Approach**: Add `peerDependenciesMeta` to package.json

**Changes**:
```json
{
  "peerDependenciesMeta": {
    "tree-sitter": {
      "optional": true
    }
  }
}
```

**Pros**:
- ✅ Standard npm feature

**Cons**:
- ❌ Only applies if WE declare tree-sitter as peer dependency (we don't)
- ❌ Warnings come from transitive peer deps (tree-sitter-c, tree-sitter-python, etc.)
- ❌ Cannot control their peerDependenciesMeta
- ❌ Doesn't solve the problem

**Verdict**: Not applicable

---

### Option 5: Document as Expected Behavior ✅ MINIMUM VIABLE SOLUTION

**Approach**: Update README/INSTALLATION.md to explain warnings are harmless

**Documentation addition**:
```markdown
## ⚠️ Known Issue: Peer Dependency Warnings

When installing AutomatosX, you may see warnings like:

```
WARN  Issues with peer dependencies found
├─┬ tree-sitter-c 0.24.1
│ └── ✕ unmet peer tree-sitter@^0.22.4: found 0.25.0
```

**These warnings are harmless and can be safely ignored.**

### Why This Happens

- AutomatosX uses tree-sitter v0.25.0 (latest)
- Language parser packages haven't updated peer dependencies yet
- Everything works correctly despite the warnings

### How to Suppress Warnings

**Option 1**: Use `.npmrc` (recommended)
```bash
echo "strict-peer-dependencies=false" > .npmrc
pnpm install
```

**Option 2**: Use `--no-strict-peer-dependencies` flag
```bash
pnpm install @defai.digital/automatosx --no-strict-peer-dependencies
```

**Option 3**: Use npm instead of pnpm
```bash
npm install -g @defai.digital/automatosx
# npm ignores peer dependency mismatches by default
```
```

**Pros**:
- ✅ No code changes
- ✅ Educates users
- ✅ Provides workarounds
- ✅ Fast to implement

**Cons**:
- ❌ Warnings still appear initially
- ❌ Users must read docs

**Verdict**: Good baseline, combine with Option 1

---

## Recommended Implementation: Hybrid Approach

**Combine Option 1 + Option 5**:

1. ✅ Create `.npmrc.example` with recommended settings
2. ✅ Update README.md with clear explanation
3. ✅ Update INSTALLATION.md with troubleshooting
4. ✅ Add FAQ.md entry
5. ✅ Mention in release notes

### Files to Create/Update

#### 1. `/Users/akiralam/code/automatosx2/.npmrc.example`
```ini
# AutomatosX Recommended Configuration
# Copy this file to .npmrc in your project to suppress peer dependency warnings

# For pnpm users (recommended)
strict-peer-dependencies=false

# For npm users (alternative)
legacy-peer-deps=true

# Optional: Faster installations
auto-install-peers=true
```

#### 2. `/Users/akiralam/code/automatosx2/README.md`
Add prominent notice after installation section:
```markdown
### ⚠️ Peer Dependency Warnings

You may see warnings about tree-sitter peer dependencies. **These are harmless and can be ignored.**

To suppress warnings, copy `.npmrc.example` to `.npmrc`:
```bash
cp .npmrc.example .npmrc
# Or download directly
curl -o .npmrc https://raw.githubusercontent.com/defai-digital/automatosx/main/.npmrc.example
```

See [INSTALLATION.md](./INSTALLATION.md#peer-dependency-warnings) for details.
```

#### 3. `/Users/akiralam/code/automatosx2/INSTALLATION.md`
Add section:
```markdown
## Peer Dependency Warnings

### What You'll See

```
WARN  Issues with peer dependencies found
└─┬ @defai.digital/automatosx 8.0.5
  ├─┬ tree-sitter-c 0.24.1
  │ └── ✕ unmet peer tree-sitter@^0.22.4: found 0.25.0
```

### Why This Happens

AutomatosX uses tree-sitter v0.25.0, which is newer than what some language parser packages expect. The parsers work correctly with v0.25.0, but their package metadata hasn't been updated yet.

### Solution 1: .npmrc Configuration (Recommended)

Copy `.npmrc.example` to `.npmrc`:
```bash
cp .npmrc.example .npmrc
```

Or create manually:
```bash
echo "strict-peer-dependencies=false" > .npmrc
```

### Solution 2: Install with Flag

```bash
# pnpm
pnpm install @defai.digital/automatosx --no-strict-peer-dependencies

# npm (no flag needed - ignores peer deps by default)
npm install -g @defai.digital/automatosx
```

### Solution 3: Ignore Warnings

The warnings don't affect functionality. You can safely ignore them.
```

#### 4. `/Users/akiralam/code/automatosx2/FAQ.md` (new file)
```markdown
# Frequently Asked Questions

## Installation Issues

### Q: Why do I see peer dependency warnings?

A: AutomatosX uses tree-sitter v0.25.0, which is newer than what some language parser packages expect. The warnings are harmless.

**Solution**: Copy `.npmrc.example` to `.npmrc` to suppress warnings.

### Q: Can I use npm instead of pnpm?

A: Yes! For end users installing the CLI:
- ✅ `npm install -g @defai.digital/automatosx` works perfectly
- ✅ No peer dependency warnings with npm

For developers contributing to the project:
- ⚠️ Must use pnpm (workspace structure requires it)
```

---

## Implementation Plan

### v8.0.6 Release Checklist

1. ✅ Create `.npmrc.example`
2. ✅ Update `README.md` with peer dependency notice
3. ✅ Update `INSTALLATION.md` with troubleshooting section
4. ✅ Create `FAQ.md`
5. ✅ Update version to 8.0.6 in package.json
6. ✅ Commit changes
7. ✅ Tag as v8.0.6
8. ✅ Publish to npm
9. ✅ Update GitHub release notes

### Estimated Time: 30 minutes

---

## Long-term Strategy

1. **v8.0.6 (immediate)**: Documentation + .npmrc.example
2. **v8.1.0 (1-2 months)**: Submit PRs to tree-sitter packages for peer dep updates
3. **v9.0.0 (future)**: If tree-sitter packages still unmaintained, consider bundling or forking

---

## Testing Plan

After implementing v8.0.6:

```bash
# Test 1: Install fresh with warnings
cd /tmp
mkdir test-install-warnings
cd test-install-warnings
pnpm init
pnpm add @defai.digital/automatosx@8.0.6
# Expect: Peer dependency warnings appear

# Test 2: Install with .npmrc
cd /tmp
mkdir test-install-fixed
cd test-install-fixed
pnpm init
echo "strict-peer-dependencies=false" > .npmrc
pnpm add @defai.digital/automatosx@8.0.6
# Expect: No peer dependency warnings

# Test 3: Verify CLI works
npx @defai.digital/automatosx status
# Expect: CLI works correctly
```

---

## Conclusion

**Recommended Solution**: Hybrid approach (Documentation + .npmrc.example)

**Reasoning**:
1. ✅ No code changes required
2. ✅ Users have clear path to suppress warnings
3. ✅ Works with both npm and pnpm
4. ✅ Fast to implement (30 minutes)
5. ✅ Transparent about the issue
6. ✅ Doesn't increase package size
7. ✅ Doesn't sacrifice dependency management best practices

**Next Action**: Implement v8.0.6 with documentation updates
