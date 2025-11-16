# NPM Package Fix - Missing dist/ Directory

## Problem

The published npm package `@defai.digital/automatosx@8.0.10` is **missing the `dist/` directory**, which contains all the compiled JavaScript code. This causes the CLI to fail immediately after installation.

**Symptoms:**
```
Error: No native build was found for platform=darwin arch=arm64 runtime=node abi=141
```

Or when trying to run `ax`:
```
/opt/homebrew/bin/ax: No such file or directory
```

## Root Cause

The `package.json` file is **missing a `files` array** that tells npm which files to include in the published package.

By default, npm excludes many directories including `dist/` unless explicitly told to include them.

## Solution

Add a `files` array to `package.json`:

```json
{
  "name": "@defai.digital/automatosx",
  "version": "8.0.10",
  ...
  "files": [
    "dist/",
    "src/",
    "packages/rescript-core/lib/",
    "scripts/",
    "examples/",
    "docs/",
    "LICENSE",
    "README.md",
    "CLAUDE.md",
    "automatosx.config.json"
  ],
  ...
}
```

## Required Files

| Path | Purpose |
|------|---------|
| `dist/` | **CRITICAL** - Compiled JavaScript (CLI, services, parsers) |
| `packages/rescript-core/lib/` | **CRITICAL** - Compiled ReScript modules (.bs.js files) |
| `scripts/` | Post-install scripts (link-binary.js) |
| `examples/` | Example workflows and agents |
| `src/` | Optional - TypeScript source for debugging |
| `docs/` | Documentation |
| Config files | README, LICENSE, CLAUDE.md, etc. |

## Testing Before Publishing

```bash
# 1. Build the project
npm run build

# 2. Test local packing
npm pack

# This creates @defai.digital-automatosx-8.0.10.tgz

# 3. Inspect the tarball
tar -tzf @defai.digital-automatosx-8.0.10.tgz | grep -E "dist/|lib/bs/"

# Should see:
# package/dist/cli/index.js
# package/dist/services/...
# package/packages/rescript-core/lib/bs/...

# 4. Test install from tarball
pnpm install -g ./@defai.digital-automatosx-8.0.10.tgz

# 5. Verify it works
ax --version
```

## Publish Checklist

- [ ] Add `files` array to package.json
- [ ] Run `npm run build` to ensure dist/ exists
- [ ] Run `npm pack` to test packaging
- [ ] Inspect tarball contents
- [ ] Test install from local tarball
- [ ] Bump version to 8.0.11
- [ ] Publish: `npm publish`
- [ ] Test global install: `pnpm install -g @defai.digital/automatosx`

## Additional Improvements

### 1. Add prepublishOnly script

```json
"scripts": {
  "prepublishOnly": "npm run build && npm test"
}
```

This ensures the package is always built before publishing.

### 2. Add .npmignore or update files array

Make sure test files and development artifacts aren't published:

```
# Exclude from package
**/__tests__/
*.test.ts
*.spec.ts
.automatosx/
test-output/
vitest.config.mts
```

### 3. Verify bin file is executable

The `dist/cli/index.js` must have a shebang:

```javascript
#!/usr/bin/env node
```

And be chmod +x before packaging.

## Current Status

**v8.0.10**: ❌ Broken - missing dist/
**v8.0.11**: 🔧 Fix required - add files array and republish

## Workaround for Users (Temporary)

Until fixed, users can:

1. Clone the repo
2. Build locally
3. Link globally

```bash
git clone https://github.com/defai-digital/automatosx
cd automatosx
pnpm install
pnpm run build
pnpm link --global
```
