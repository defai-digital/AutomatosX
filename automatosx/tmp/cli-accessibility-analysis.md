# CLI Accessibility Analysis

**Date**: 2025-11-15
**Issue**: Users cannot use `ax` or `automatosx` command after `pnpm install`

## Problem Statement

After running `pnpm install` in the AutomatosX repository, developers cannot directly use:
```bash
ax find "Calculator"  # Command not found
automatosx status     # Command not found
```

Instead, they must use:
```bash
pnpm run cli -- find "Calculator"  # Works but verbose
```

## Root Cause Analysis

### 1. Package is Marked Private

**Current state** (`package.json:15`):
```json
{
  "private": true,
  "bin": {
    "ax": "./dist/cli/index.js"
  }
}
```

**Impact**:
- ❌ Cannot publish to npm registry
- ❌ Cannot install globally (`npm install -g` or `pnpm install -g`)
- ❌ Binary linking doesn't work for private packages

**Why it's private**: Likely to prevent accidental publishing during development

### 2. Binary Not Linked During Development

When you run `pnpm install` in a workspace:
- pnpm installs dependencies
- pnpm does NOT create symlinks for binaries in private packages
- The `bin` field is only processed during `npm install -g` or when publishing

**Expected behavior** (for published packages):
```bash
npm install -g @defai.digital/automatosx
# Creates symlinks:
# /usr/local/bin/ax -> /usr/local/lib/node_modules/@defai.digital/automatosx/dist/cli/index.js
```

**Actual behavior** (for development):
```bash
pnpm install
# No symlinks created
# Must use: pnpm run cli
```

## Solutions

### Option A: Link Binary Manually (Development Workaround)

**Add to `package.json` scripts**:
```json
{
  "scripts": {
    "postinstall": "pnpm run link-cli",
    "link-cli": "chmod +x dist/cli/index.js && (command -v ax >/dev/null 2>&1 || pnpm link --global)",
    "unlink-cli": "pnpm unlink --global"
  }
}
```

**How it works**:
1. After `pnpm install`, `postinstall` runs automatically
2. Makes CLI executable
3. Creates global link: `ax` → `dist/cli/index.js`

**Testing**:
```bash
pnpm install     # Automatically runs postinstall
ax find "test"   # Now works!
```

**Pros**:
- ✅ Automatic after `pnpm install`
- ✅ Works like a globally installed package
- ✅ Keeps package private (safe during development)

**Cons**:
- ⚠️ Creates global link (may conflict with other versions)
- ⚠️ Requires manual unlink before uninstalling

---

### Option B: Use pnpm exec (No Changes Needed)

**No code changes required**. Developers can use:

```bash
# Option 1: pnpm exec
pnpm exec ax find "Calculator"

# Option 2: Direct node execution
node dist/cli/index.js find "Calculator"

# Option 3: npm script (current approach)
pnpm run cli -- find "Calculator"
```

**Pros**:
- ✅ No code changes
- ✅ No global pollution
- ✅ Works immediately

**Cons**:
- ❌ Verbose
- ❌ Doesn't feel like a native CLI

---

### Option C: Create Shell Alias (User-Side Workaround)

**Add to `~/.zshrc` or `~/.bashrc`**:
```bash
alias ax='pnpm run cli --'
alias automatosx='pnpm run cli --'
```

**Then**:
```bash
ax find "Calculator"  # Works!
```

**Pros**:
- ✅ Simple and clean
- ✅ No code changes
- ✅ Feels native

**Cons**:
- ❌ Requires manual setup per developer
- ❌ Only works in directories with package.json

---

### Option D: Remove "private": true (Publish to npm)

**Change `package.json`**:
```json
{
  "private": false,  // Allow publishing
  "name": "@defai.digital/automatosx",
  "version": "8.0.7"
}
```

**Then publish**:
```bash
npm publish --access public
```

**End users can install**:
```bash
npm install -g @defai.digital/automatosx
ax find "Calculator"  # Works globally!
```

**Pros**:
- ✅ Best end-user experience
- ✅ Standard npm package workflow
- ✅ Binary linking handled automatically
- ✅ Can publish updates to npm registry

**Cons**:
- ⚠️ Package becomes public (already open-source, so not an issue)
- ⚠️ Requires npm publishing workflow
- ⚠️ Must follow semantic versioning strictly

---

### Option E: Hybrid Approach (Recommended)

**For developers** (working on the repo):
- Use `pnpm run cli --` or add shell alias
- Keep package private during active development

**For end users** (using the tool):
- Publish to npm as a public package
- Users install with `npm install -g @defai.digital/automatosx`
- Binary works out of the box

**Implementation**:
1. Keep `"private": true` in the main branch
2. Before releasing, set `"private": false` and publish
3. After publishing, revert to `"private": true`

**Or better**: Use npm lifecycle scripts to ensure builds before publish:
```json
{
  "scripts": {
    "prepublishOnly": "pnpm run build && pnpm test",
    "publish:cli": "pnpm run build && npm publish --access public"
  }
}
```

---

## Decision Matrix

| Criterion | Option A (Link) | Option B (pnpm exec) | Option C (Alias) | Option D (Publish) | Option E (Hybrid) |
|-----------|----------------|---------------------|------------------|-------------------|-------------------|
| **Developer UX** | ✅ Excellent | ⚠️ Verbose | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **End User UX** | ❌ No access | ❌ No access | ❌ No access | ✅ Excellent | ✅ Excellent |
| **Setup Complexity** | ⚠️ Auto but risky | ✅ Zero | ⚠️ Manual | ✅ Standard | ⚠️ Workflow needed |
| **Global Pollution** | ❌ Yes | ✅ No | ✅ No | ⚠️ Intentional | ⚠️ Intentional |
| **Maintenance** | ⚠️ Medium | ✅ Zero | ✅ Zero | ✅ Low | ⚠️ Medium |
| **Production Ready** | ❌ No | ❌ No | ❌ No | ✅ Yes | ✅ Yes |

---

## Recommendation

### Immediate Fix (v8.0.8): Option A + Documentation

**Add postinstall script for automatic binary linking**:

```json
{
  "scripts": {
    "postinstall": "node scripts/link-binary.js",
    "preuninstall": "pnpm unlink --global 2>/dev/null || true"
  }
}
```

**Create `scripts/link-binary.js`**:
```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cliPath = path.join(__dirname, '../dist/cli/index.js');

// Only link if dist/cli/index.js exists (after build)
if (fs.existsSync(cliPath)) {
  try {
    console.log('Linking AutomatosX CLI binary...');
    execSync('pnpm link --global', { stdio: 'inherit' });
    console.log('✅ AutomatosX CLI linked! You can now use "ax" command.');
  } catch (error) {
    console.log('⚠️  Could not link binary automatically. Use "pnpm run cli" instead.');
  }
} else {
  console.log('⚠️  CLI binary not built yet. Run "pnpm run build" first.');
}
```

**Update README.md** with clear instructions:
```markdown
## Developer Setup

After cloning the repository:

```bash
# Install dependencies and link CLI
pnpm install
pnpm run build

# The CLI is now available as:
ax find "Calculator"  # Linked automatically after install
# OR
pnpm run cli -- find "Calculator"  # Alternative method
```

To unlink:
```bash
pnpm unlink --global
```
```

---

### Long-term Fix (v9.0.0): Option D (Publish to npm)

**Remove `"private": true` and publish officially**:

1. Update package.json: `"private": false`
2. Add publishing workflow
3. Publish to npm: `npm publish --access public`
4. Update all documentation to use: `npm install -g @defai.digital/automatosx`

**This is the standard approach for CLI tools.**

---

## Current Workarounds (No Code Changes)

For developers RIGHT NOW who want to use `ax` command:

### Workaround 1: Manual Link
```bash
cd /path/to/automatosx2
pnpm run build
pnpm link --global
ax find "Calculator"  # Now works!
```

### Workaround 2: Shell Alias
```bash
# Add to ~/.zshrc or ~/.bashrc
alias ax='pnpm run cli --'

# Then use:
ax find "Calculator"
```

### Workaround 3: Direct Execution
```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="/path/to/automatosx2/dist/cli:$PATH"

# Make sure CLI is executable
chmod +x /path/to/automatosx2/dist/cli/index.js

# Then use:
ax find "Calculator"
```

---

## Recommendation Summary

**Immediate** (Now): Use manual `pnpm link --global` + document in README
**Next Release** (v8.0.8): Add postinstall script for automatic linking
**Future** (v9.0.0): Publish to npm as public package

This provides a smooth developer experience while maintaining the ability to publish for end users later.
