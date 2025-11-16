# `ax` Command Troubleshooting Guide

**Issue**: Mac user reports that `pnpm install` does not give the `ax` or `automatosx` command

## Root Cause Analysis

I tested a **fresh clone + install** and found that the postinstall script **DOES work correctly** in v8.0.8+:

```bash
$ cd /tmp && git clone https://github.com/defai-digital/AutomatosX.git
$ cd AutomatosX
$ pnpm install
...
postinstall: 🔗 Linking AutomatosX CLI binary...
postinstall: ✅ AutomatosX CLI linked successfully!
...

$ which ax
/opt/homebrew/bin/ax

$ ax --help
✅ Works!
```

## Possible Causes

### 1. User is on an Old Version (< v8.0.8)

**Problem**: The postinstall script was only added in v8.0.8 (released 2025-11-15 22:01 UTC)

**Solution**: Pull latest changes

```bash
cd /path/to/automatosx
git pull origin main
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Check version**:
```bash
grep '"version"' package.json | head -1
# Should show: "version": "8.0.9" or later
```

### 2. dist/cli/index.js Doesn't Exist

**Problem**: On very old clones, the `dist/` folder might not be tracked in git

**Check**:
```bash
ls -la dist/cli/index.js
```

**If file doesn't exist**:
```bash
# Pull latest (dist/ was added to git in v8.0.0+)
git pull origin main

# If still missing, build it:
pnpm run build
pnpm link --global
```

### 3. pnpm link --global Failed Silently

**Problem**: The postinstall script catches errors and shows a warning, but users might not read it

**Check**: Look for this in `pnpm install` output:
```
⚠️  Could not link binary automatically.
To link manually, run:
  pnpm link --global
```

**If you see this**, run manually:
```bash
pnpm link --global
```

**Common causes of link failure**:
- Permission issues (need sudo/admin rights)
- pnpm global bin directory not in PATH
- Old pnpm version (need v9+)

### 4. Global pnpm Bin Directory Not in PATH

**Problem**: `pnpm link --global` creates symlink in pnpm's global bin directory, but that directory isn't in PATH

**Check**:
```bash
pnpm bin -g
# Example output: /Users/username/Library/pnpm
```

**Add to PATH** (add to `~/.zshrc` or `~/.bashrc`):
```bash
export PATH="$(pnpm bin -g):$PATH"
```

**Then reload shell**:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

### 5. Conflicting Global Install

**Problem**: User previously installed AutomatosX globally with npm or an older version

**Check**:
```bash
which ax
# If it points to /usr/local/bin/ax or npm global, there's a conflict
```

**Solution**: Uninstall old version first
```bash
npm uninstall -g automatosx
# or
npm uninstall -g @defai.digital/automatosx

# Then reinstall with pnpm
cd /path/to/automatosx
pnpm link --global
```

## Complete Diagnostic Checklist

Run these commands and share the output:

```bash
# 1. Check version
grep '"version"' package.json | head -1

# 2. Check if dist/cli/index.js exists
ls -la dist/cli/index.js

# 3. Check if postinstall script exists
cat scripts/link-binary.js | head -5

# 4. Check pnpm version
pnpm --version

# 5. Check global bin directory
pnpm bin -g

# 6. Check if global bin is in PATH
echo $PATH | grep -o "$(pnpm bin -g)"

# 7. Check if ax exists in global bin
ls -la "$(pnpm bin -g)/ax" 2>&1

# 8. Try to link manually
pnpm link --global 2>&1

# 9. Check which ax is being used
which ax 2>&1

# 10. Try to run ax
ax --version 2>&1 | head -5
```

## Recommended Solutions (in order)

### Solution 1: Pull Latest + Clean Install ⭐ RECOMMENDED

```bash
cd /path/to/automatosx
git pull origin main
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Expected output**:
```
postinstall: 🔗 Linking AutomatosX CLI binary...
postinstall: ✅ AutomatosX CLI linked successfully!
```

**Verify**:
```bash
which ax  # Should show path to ax
ax --version  # Should work
```

### Solution 2: Manual Link

```bash
cd /path/to/automatosx
pnpm link --global
```

**Verify**:
```bash
which ax
ax --version
```

### Solution 3: Add pnpm Global Bin to PATH

```bash
# Check current global bin
pnpm bin -g

# Add to PATH (example for Homebrew pnpm)
echo 'export PATH="/Users/$(whoami)/Library/pnpm:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Verify**:
```bash
echo $PATH | grep pnpm  # Should show pnpm directory
which ax  # Should now find ax
```

### Solution 4: Use pnpm run cli (Fallback)

If nothing else works, use the verbose command:

```bash
pnpm run cli -- find "Calculator"
pnpm run cli -- def "getUserById"
pnpm run cli -- cli  # Interactive mode
```

**Create alias** for convenience:
```bash
# Add to ~/.zshrc or ~/.bashrc
alias ax='pnpm run cli --'

# Reload shell
source ~/.zshrc
```

## Testing the Fix

After applying a solution, test with:

```bash
# Test 1: which finds ax
which ax
# Expected: /opt/homebrew/bin/ax (or similar)

# Test 2: ax runs
ax --version
# Expected: Shows version and feature flags

# Test 3: ax commands work
ax find "test"
# Expected: Shows search results or "no results" (not "command not found")

# Test 4: ax works from any directory
cd /tmp
ax --help
# Expected: Shows help text
```

## Platform-Specific Notes

### macOS (Homebrew pnpm)

**Global bin location**: `/opt/homebrew/bin/` (Apple Silicon) or `/usr/local/bin/` (Intel)

**PATH**: Usually configured by Homebrew automatically

**pnpm location**: `/opt/homebrew/bin/pnpm`

### macOS (npm-installed pnpm)

**Global bin location**: `/Users/username/Library/pnpm/`

**PATH**: May need manual configuration

**pnpm location**: `/Users/username/.npm/bin/pnpm` or similar

### Linux

**Global bin location**: `~/.local/share/pnpm/`

**PATH**: May need manual configuration

## Verification Script

Save this as `check-ax.sh` and run it:

```bash
#!/bin/bash

echo "AutomatosX ax Command Diagnostic"
echo "=================================="
echo ""

echo "1. Package version:"
grep '"version"' package.json | head -1

echo ""
echo "2. dist/cli/index.js exists:"
ls -la dist/cli/index.js 2>&1 | grep -v "No such"

echo ""
echo "3. pnpm version:"
pnpm --version

echo ""
echo "4. pnpm global bin:"
pnpm bin -g

echo ""
echo "5. Global bin in PATH:"
if echo "$PATH" | grep -q "$(pnpm bin -g)"; then
  echo "✅ Yes"
else
  echo "❌ No - THIS IS THE PROBLEM!"
  echo "Add this to ~/.zshrc or ~/.bashrc:"
  echo "  export PATH=\"$(pnpm bin -g):\$PATH\""
fi

echo ""
echo "6. ax symlink exists:"
ls -la "$(pnpm bin -g)/ax" 2>&1

echo ""
echo "7. which ax:"
which ax 2>&1

echo ""
echo "8. ax --version:"
ax --version 2>&1 | head -5

echo ""
echo "=================================="
echo "If ax works, you should see version info above"
echo "If not, follow the solution steps in ax-command-troubleshooting.md"
```

**Run**:
```bash
chmod +x check-ax.sh
./check-ax.sh
```

## Expected Behavior

**Correct installation flow**:
```bash
$ git clone https://github.com/defai-digital/AutomatosX.git
$ cd AutomatosX
$ pnpm install

# During install, you should see:
postinstall: 🔗 Linking AutomatosX CLI binary...
postinstall: ✅ AutomatosX CLI linked successfully!
postinstall: You can now use:
postinstall:   ax find "Calculator"

$ which ax
/opt/homebrew/bin/ax

$ ax --version
# Shows version info

✅ SUCCESS!
```

## Summary for User

**To fix "ax command not found" issue**:

1. **Make sure you're on v8.0.8+**:
   ```bash
   git pull origin main
   ```

2. **Clean install**:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

3. **Check if linking worked**:
   ```bash
   which ax
   ```

4. **If still not working, add pnpm global bin to PATH**:
   ```bash
   echo 'export PATH="$(pnpm bin -g):$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

5. **Verify**:
   ```bash
   ax --version
   ```

**If all else fails**, use `pnpm run cli --` as a fallback.

---

**Version Requirements**:
- AutomatosX: v8.0.8 or later
- pnpm: v9.0.0 or later
- Node.js: v24.0.0 or later

**Need help?** Share the output of the "Complete Diagnostic Checklist" above.

---

## Known Issue: Tree-sitter Native Module Error (FIXED 2025-11-15)

### Problem

```
Error: No native build was found for platform=darwin arch=arm64 runtime=node abi=137 uv=1 armv=8 libc=glibc node=24.11.1
    loaded from: /Users/akiralam/Library/pnpm/global/5/.pnpm/tree-sitter@0.25.0/node_modules/tree-sitter
```

Or:

```
Error: The module '/Users/.../tree-sitter-csv/build/Release/tree_sitter_csv_binding.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 141. This version of Node.js requires
NODE_MODULE_VERSION 137.
```

### Root Cause

Tree-sitter native modules (45 language parsers) were not compiled for the current Node.js version (v24.11.1), or were compiled for a different Node.js ABI version.

### Solution

**Step 1: Rebuild all native modules**
```bash
cd /path/to/automatosx
pnpm rebuild
```

This recompiles all 45+ tree-sitter language parsers for your current Node.js version.

**Step 2: Fix link-binary.js for ES modules**

The `scripts/link-binary.js` script has been updated to use ES modules (fixed in this session):

```javascript
// Old (CommonJS)
const { execSync } = require('child_process');

// New (ES modules)
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

**Step 3: Create direct symlink**

If `pnpm link --global` fails due to pnpm store version mismatch, use a direct symlink:

```bash
# Remove old symlink
rm /Users/$(whoami)/Library/pnpm/ax 2>/dev/null || true

# Create new symlink to local project
ln -sf "$(pwd)/dist/cli/index.js" /Users/$(whoami)/Library/pnpm/ax

# Make CLI executable
chmod +x dist/cli/index.js
```

This ensures `ax` uses your local project's `node_modules` with properly compiled native modules.

**Step 4: Verify**

```bash
ax --version
# Should output: 8.0.10 (or later)
```

### Why This Happened

1. **Global install via pnpm**: When installed globally, pnpm's store may not have native modules compiled for your Node.js version
2. **Node.js version change**: If you upgrade Node.js, native modules must be recompiled
3. **ABI mismatch**: Different Node.js versions use different ABIs (Application Binary Interfaces)

### Prevention

**For developers**: Always use local development with `pnpm install` and symlink, not global install.

**For end users**: The npm package should include prebuilt binaries (future enhancement).

### Testing After Fix

```bash
# Test 1: Version check
ax --version
# Expected: 8.0.10

# Test 2: Status command (uses parser registry)
ax status
# Expected: Should not throw tree-sitter errors

# Test 3: Find command (uses code intelligence)
ax find "Calculator"
# Expected: Search results or "no results"
```

### Related Changes

- Fixed `scripts/link-binary.js` to use ES modules (2025-11-15)
- Direct symlink approach avoids pnpm global store issues
- All 45 tree-sitter parsers now compile correctly for Node.js v24.11.1
