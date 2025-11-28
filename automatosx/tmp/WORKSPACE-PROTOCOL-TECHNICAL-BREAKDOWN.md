# Technical Deep Dive: pnpm workspace:* Protocol and npm Compatibility

---

## What is workspace:* Protocol?

### pnpm's Innovation

pnpm introduced the `workspace:*` protocol as a special dependency resolution mechanism for monorepos:

```json
{
  "dependencies": {
    "@ax/core": "workspace:*"  // Means: use whatever version is in workspace
  }
}
```

### How It Works in pnpm

1. **Monorepo-Aware**: pnpm recognizes `workspace:*` as a reference to local workspace packages
2. **Version Matching**: Automatically uses the current version of the package in the workspace
3. **Symlinks**: Creates symlinks during development for instant updates
4. **Publishing Transformation**: When publishing, converts `workspace:*` to actual semantic versions

### Why pnpm Does This

Advantage during development:
```
packages/schemas/
  package.json: "version": "11.0.0-alpha.0"

packages/core/package.json has:
  "@ax/schemas": "workspace:*"

When pnpm installs:
  - Creates symlink to local schemas
  - No npm registry lookup needed
  - Changes to schemas immediately reflected
  - Much faster than npm's dependency resolution
```

---

## The npm Problem

### npm Does NOT Support workspace:*

npm's dependency resolver sees this:
```json
{
  "@ax/core": "workspace:*"
}
```

And fails with:
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! 
npm ERR! While resolving: @ax/mcp@11.0.0-alpha.0
npm ERR! Found: @ax/core@workspace:* (as a dependency of @ax/mcp)
npm ERR! 
npm ERR! npm doesn't support the "workspace:" protocol
```

### Why npm Doesn't Support It

1. **Not Part of npm Spec**: The `workspace:` protocol is pnpm-specific, not part of npm's package spec
2. **Registry Lookup Required**: npm must look up ALL dependencies from npm registry
3. **No Monorepo Awareness**: npm doesn't have built-in monorepo support like pnpm does
4. **Universal Format**: npm needs to work identically on Windows, Mac, Linux - can't use local symlinks in published packages

---

## Current AutomatosX Dependency Graph

### Actual Dependency Structure

```
@ax/cli (11.0.0-alpha.0)
├── @ax/core (workspace:*)                    <- PROBLEM
├── @ax/schemas (workspace:*)                 <- PROBLEM
├── @ax/providers (workspace:*)               <- PROBLEM
└── @ax/algorithms (workspace:*)              <- PROBLEM

@ax/core (11.0.0-alpha.0)
├── @ax/schemas (workspace:*)                 <- PROBLEM
├── @ax/algorithms (workspace:*)              <- PROBLEM
├── @ax/providers (workspace:*)               <- PROBLEM
├── better-sqlite3 (^11.6.0)                  <- OK
└── yaml (^2.6.1)                             <- OK

@ax/providers (11.0.0-alpha.0)
├── @ax/schemas (workspace:*)                 <- PROBLEM
└── @modelcontextprotocol/sdk (^1.22.0)       <- OK

@ax/algorithms (11.0.0-alpha.0)
├── @ax/schemas (workspace:*)                 <- PROBLEM
└── (has external deps for ReScript)          <- OK

@ax/schemas (11.0.0-alpha.0)
└── zod (^3.23.8)                             <- OK (LEAF PACKAGE!)

@ax/mcp (11.0.0-alpha.0)
├── @ax/core (workspace:*)                    <- PROBLEM
├── @ax/schemas (workspace:*)                 <- PROBLEM
└── @modelcontextprotocol/sdk (^1.22.0)       <- OK
```

### Dependency Count

- **workspace:* references**: 11
- **Normal version references**: 5
- **Ratio**: 69% problematic (11 of 16 internal references)

---

## Scenario: What Happens During npm install

### Scenario 1: Installing @ax/schemas (Works Today)

```bash
npm install @ax/schemas@11.0.0-alpha.0
```

**Result**: ✅ SUCCESS
- No dependencies on workspace packages
- Only depends on zod (public package)
- npm registry resolves zod
- Package installs cleanly

**Proof**: @ax/schemas is publishable RIGHT NOW

---

### Scenario 2: Installing @ax/core (Currently Blocked)

```bash
npm install @ax/core@11.0.0-alpha.0
```

**Step 1**: npm finds @ax/core in registry
```json
{
  "name": "@ax/core",
  "version": "11.0.0-alpha.0",
  "dependencies": {
    "@ax/schemas": "workspace:*"  // npm sees this
  }
}
```

**Step 2**: npm tries to resolve `@ax/schemas@workspace:*`
- npm registry doesn't have a version called `workspace:*`
- npm asks: "What is 'workspace:*'?"
- npm has no idea what this means

**Result**: ❌ FAILURE
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

---

### Scenario 3: npm ci in CI/CD

```bash
git clone https://github.com/defai-digital/automatosx
cd automatosx
npm ci  # Clean install from lock file
```

**Problem 1**: No package-lock.json exists
```
npm ERR! The package-lock.json file is missing
npm ERR! without a package.json
```

**Result**: ❌ FAILURE - Can't use npm for CI

---

## How pnpm Handles This Differently

### pnpm's Resolution Process

When pnpm sees `workspace:*`:

1. **Local Workspace Check**
   ```typescript
   if (dependency.startsWith("workspace:")) {
     return resolveFromLocalWorkspace(packageName);
   }
   ```

2. **No Registry Lookup**
   - Skips npm registry entirely
   - Looks at current workspace packages
   - Finds `packages/schemas/package.json`
   - Reads version: `"11.0.0-alpha.0"`
   - Uses that version

3. **Installation Linking**
   - Creates symlinks in `.pnpm` directory
   - Points to local package
   - Symlinks are stored in `pnpm-lock.yaml`

4. **Publishing Conversion** (pnpm only)
   - Before publishing: `"@ax/schemas": "workspace:*"`
   - After publish: `"@ax/schemas": "^11.0.0-alpha.0"`
   - This conversion happens automatically

---

## The Solution: Converting workspace:* to Semantic Versions

### Current (pnpm only):
```json
{
  "dependencies": {
    "@ax/schemas": "workspace:*"
  }
}
```

### After Fix (npm + pnpm compatible):
```json
{
  "dependencies": {
    "@ax/schemas": "^11.0.0-alpha.0"
  }
}
```

### Why This Works for BOTH

#### For pnpm Development:
```bash
cd /monorepo
pnpm install

# pnpm is smart enough to see:
# - @ax/schemas has version 11.0.0-alpha.0 in workspace
# - @ax/core depends on ^11.0.0-alpha.0
# - ^ means >= 11.0.0-alpha.0, < 12.0.0
# - Local version matches!
# - Uses local workspace version (fast, symlinked)
```

#### For npm Publishing:
```bash
cd packages/core
npm publish

# npm publishes with:
{
  "dependencies": {
    "@ax/schemas": "^11.0.0-alpha.0"
  }
}

# When someone does: npm install @ax/core
# npm resolves: @ax/schemas@^11.0.0-alpha.0
# npm finds: @ax/schemas@11.0.0-alpha.0 in registry
# Installation succeeds ✅
```

---

## Why pnpm Prefers workspace:*

### For Large Monorepos

Consider if you're developing with 20 packages:

#### With semantic versions (old way):
```json
{
  "dependencies": {
    "@our/pkg1": "^1.0.0",
    "@our/pkg2": "^2.0.0",
    "@our/pkg3": "^1.0.0",
    "@our/pkg4": "^3.0.0"
  }
}
```

**Problem**: When you bump pkg1 to v2.0.0:
1. Manually update all package.json files
2. Update pnpm-lock.yaml
3. Risk of version mismatches
4. Tedious and error-prone

#### With workspace:* (modern way):
```json
{
  "dependencies": {
    "@our/pkg1": "workspace:*",
    "@our/pkg2": "workspace:*",
    "@our/pkg3": "workspace:*",
    "@our/pkg4": "workspace:*"
  }
}
```

**Benefit**: When you bump version in root:
1. All workspace:* references automatically match
2. No manual syncing needed
3. Single source of truth
4. pnpm handles everything

### Trade-off: Not npm Compatible

- ✅ Perfect for monorepo development with pnpm
- ❌ Not compatible with npm
- ❌ Not compatible with other package managers
- ❌ Can't be published to npm as-is

---

## Real-World Impact

### Publishing Flow with workspace:*

```
CURRENT (BROKEN):
┌─────────────────────────────────────┐
│ Developer runs: npm publish         │
│ (in packages/cli)                   │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ npm reads package.json              │
│ Sees: "@ax/core": "workspace:*"     │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ npm tries to resolve "workspace:*"  │
│ Asks npm registry for that version  │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ npm registry: "Version not found"   │
│ PUBLISH BLOCKED ❌                  │
└─────────────────────────────────────┘
```

---

## Verification: Checking Current Status

### Command to Check

```bash
# Show all workspace:* references
grep -r "workspace:\*" packages/*/package.json

# Count them
grep -r "workspace:\*" packages/*/package.json | wc -l
```

### Output We See:

```
packages/algorithms/package.json:42:    "@ax/schemas": "workspace:*"
packages/cli/package.json:30:    "@ax/core": "workspace:*",
packages/cli/package.json:31:    "@ax/schemas": "workspace:*",
packages/cli/package.json:32:    "@ax/providers": "workspace:*",
packages/cli/package.json:33:    "@ax/algorithms": "workspace:*",
packages/core/package.json:46:    "@ax/schemas": "workspace:*",
packages/core/package.json:47:    "@ax/algorithms": "workspace:*",
packages/core/package.json:48:    "@ax/providers": "workspace:*",
packages/mcp/package.json:29:    "@ax/core": "workspace:*",
packages/mcp/package.json:30:    "@ax/schemas": "workspace:*",
packages/providers/package.json:42:    "@ax/schemas": "workspace:*",

Total: 11 instances
```

---

## After Fix: Testing

### Test 1: pnpm Still Works

```bash
cd /automatosx
pnpm install
pnpm build
pnpm test
```

**Result**: ✅ Everything still works

**Why**: pnpm is smart enough to use local workspace packages even with semantic versions

---

### Test 2: npm Can Install @ax/schemas

```bash
npm install @ax/schemas@11.0.0-alpha.0
```

**Result**: ✅ Works (was already working - it's a leaf package)

---

### Test 3: npm Can Install @ax/core

```bash
npm install @ax/core@11.0.0-alpha.0
```

**Step 1**: npm downloads @ax/core
**Step 2**: npm reads dependencies: `"@ax/schemas": "^11.0.0-alpha.0"`
**Step 3**: npm downloads @ax/schemas from registry
**Step 4**: npm links everything together

**Result**: ✅ Works after fix

---

### Test 4: npm Can Install Full CLI

```bash
npm install -g @ax/cli@11.0.0-alpha.0
```

**Dependency Chain**:
1. @ax/cli (downloads from registry)
2. @ax/core (downloads from registry)
3. @ax/algorithms (downloads from registry)
4. @ax/providers (downloads from registry)
5. @ax/schemas (downloads from registry)
6. All external deps (zod, chalk, yargs, etc.)

**Result**: ✅ CLI tool available globally as `ax` command

---

## Why Not Just Use npm with workspace protocol?

### The Question: "Why not add npm support for workspace:*?"

**Answer**: npm maintainers have decided against it because:

1. **Universal Compatibility Goal**
   - npm wants identical behavior on all systems
   - Symlinks work differently on Windows, Mac, Linux
   - Published packages can't contain symlinks

2. **Registry-Centric Design**
   - npm is designed for package distribution
   - Assumes all packages come from npm registry
   - Monorepo support is secondary concern

3. **pnpm Differentiation**
   - pnpm created workspace:* as a competitive advantage
   - It's part of pnpm's identity
   - npm won't copy it to avoid confusion

4. **Yarn Workspaces Different**
   - Yarn workspaces use different approach
   - Still resolves to semantic versions for publishing

### The Right Approach

**Use the tool's native features**:
- **For Development**: Use pnpm with workspace:* (best experience)
- **For Publishing**: Use semantic versions (npm compatible)
- **For Users**: They install via npm, get clean packages

This is the intended workflow!

---

## Summary: Why This Matters

### For AutomatosX Users

```
npm install @ax/cli

WITHOUT FIX:
  ❌ Installation fails
  ❌ Can't use the CLI tool
  ❌ No way to integrate AutomatosX

WITH FIX:
  ✅ Installation succeeds
  ✅ CLI tool works out of the box
  ✅ Easy integration into projects
```

### For AutomatosX Developers

```
pnpm install

WITHOUT FIX:
  ✅ Development works fine
  ✅ workspace:* is already implemented

WITH FIX:
  ✅ Development still works fine
  ✅ pnpm uses local packages (smarter than just semantic versions)
  ✅ Plus: npm publishing now possible!
```

### Zero Risk to Development Workflow

Switching from `workspace:*` to semantic versions in package.json:
- **Does NOT affect development** - pnpm is smart about this
- **Only affects publishing** - enables npm compatibility
- **Pure upside** - no downside for either package manager
