# Version Synchronization Tool Guide

**Created**: 2025-10-14
**Updated**: 2025-10-15 (Simplified for P1-3)
**Version**: v2.0
**Purpose**: Automate version updates across documentation files

---

## 📦 Overview

The `sync-all-versions.js` tool synchronizes version references in documentation, using `package.json` as the single source of truth. This eliminates the need for `version.json` and manual version syncing.

### What It Updates

✅ **Automatically Updated Files**:
1. `README.md` - Status line (e.g., "v5.3.7 · October 2025")
2. `CLAUDE.md` - Version header and Critical Development Notes header
3. Test count badges (optional, requires running tests)

📌 **Single Source of Truth**:
- `package.json` - Managed by `npm version` commands

⚠️ **Manual Updates Required**:
1. `GitHub Releases (https://github.com/defai-digital/automatosx/releases)` - Release notes (content-specific)

**Note**: `version.json` has been removed in v5.3.7 to simplify version management.

---

## 🚀 Usage

### Basic Usage

```bash
# Use current package.json version
npm run sync:all-versions

# Or specify version explicitly
node tools/sync-all-versions.js 5.2.3
```

### Before Publishing to npm

```bash
# Complete pre-release workflow
npm run prerelease

# This runs:
# 1. npm run sync:all-versions  ← Syncs all version numbers
# 2. npm run typecheck          ← TypeScript validation
# 3. npm run test:all           ← Run all 1,538 tests
```

### When Bumping Versions

```bash
# Automatic version bump with sync
npm run version:patch   # 5.2.2 → 5.2.3
npm run version:minor   # 5.2.2 → 5.3.0
npm run version:major   # 5.2.2 → 6.0.0

# Then sync documentation
npm run sync:all-versions
```

---

## 📋 Complete Release Workflow

### Step-by-Step Process

```bash
# 1. Bump version (creates commit + tag)
npm run version:patch   # or minor/major

# 2. Sync all version references
npm run sync:all-versions

# 3. Review changes
git diff

# 4. Update GitHub Releases (https://github.com/defai-digital/automatosx/releases) (manual)
# Add release notes for the new version

# 5. Update test count badges (manual)
npm run test:all
# Note the test count (e.g., "1538 tests")
# Update README.md line 10: [![Tests](https://img.shields.io/badge/tests-1,538%20passing-brightgreen.svg)](#)
# Update README.md line 581: ✅ **1,538 tests passing** (100% pass rate)
# Update README.md line 593: Test Coverage: ~56% (1,538 tests passing, 100% pass rate)
# Update CLAUDE.md line 11: **Quality**: 1,538 tests (100% pass), 0 TypeScript errors, ~56% coverage
# Update CLAUDE.md line 173: npm run test:all           # All test suites (1,538 tests passing)
# Update CLAUDE.md line 587: - **Total**: 1,538 tests passing (100% pass rate as of 2025-10-14)

# 6. Commit all changes
git add .
git commit -m "chore: prepare release v5.2.3"

# 7. Push with tags
git push && git push --tags

# 8. Publish to npm
npm publish
```

---

## 🎯 Files Updated by Tool

### package.json (Source of Truth)
```json
{
  "version": "5.3.7"  // ← Managed by npm version commands
}
```

### README.md
```markdown
**Status**: ✅ Production Ready · v5.3.7 · October 2025
```

### CLAUDE.md
```markdown
**Version Management**:
- `package.json` is the single source of truth for version
- Tests read version dynamically from package.json

## Critical Development Notes (v5.3.7)
```

**Note**: `version.json` has been removed. Use `src/utils/version.ts` to read version in code.

---

## 🔍 Verification Checklist

After running the tool, verify these changes:

```bash
# 1. Check git diff
git diff

# You should see changes in:
#   M README.md
#   M CLAUDE.md

# 2. Verify version consistency
VERSION=$(node -p "require('./package.json').version")
echo "Current version: $VERSION"
grep -n "$VERSION" README.md CLAUDE.md

# 3. Check GitHub Releases (https://github.com/defai-digital/automatosx/releases) has entry
grep "## \[$VERSION\]" GitHub Releases (https://github.com/defai-digital/automatosx/releases)
# If not found, add release notes manually

# 4. Run tests
npm run test:all
# Verify all tests pass

# 5. Check TypeScript
npm run typecheck
# Should show 0 errors
```

---

## ❌ Known Limitations

### Manual Updates Required

1. **GitHub Releases (https://github.com/defai-digital/automatosx/releases)**
   - Tool checks if version exists but doesn't create entries
   - You must manually write release notes

2. **Test Count Badges**
   - Tool doesn't run tests or update test counts
   - Update manually after `npm run test:all`
   - Files to update:
     - `README.md` (lines 10, 581, 593)
     - `CLAUDE.md` (lines 11, 173, 587)

3. **Coverage Percentage**
   - Tool doesn't calculate coverage
   - Update manually after `npm run test:coverage`

---

## 🛠️ Tool Configuration

### npm Scripts

```json
{
  "scripts": {
    "sync:version": "node tools/sync-version.js",
    "sync:all-versions": "node tools/sync-all-versions.js",
    "prerelease": "npm run sync:all-versions && npm run typecheck && npm run test:all"
  }
}
```

### Git Hooks (Optional)

You can add a pre-push hook to ensure version sync:

```bash
# .git/hooks/pre-push
#!/bin/bash

echo "🔍 Checking version consistency..."
npm run sync:all-versions --dry-run

if [ $? -ne 0 ]; then
  echo "❌ Version sync check failed"
  exit 1
fi

echo "✅ Version consistency verified"
```

---

## 📊 Version Update Locations

### Primary Source (Single Source of Truth)
- [x] **package.json** (line 3) - Managed by `npm version` commands

### Automated Updates (by sync-all-versions.js)
- [x] **README.md** (line 12) - Status line with version and month/year
- [x] **CLAUDE.md** (lines 10, 46) - Version header and notes section
- [x] **Test count badges** (optional) - If tests are run first

### Manual Updates Required
- [ ] **GitHub Releases (https://github.com/defai-digital/automatosx/releases)** - Release notes (content-specific)
- [ ] **GitHub Release Notes** - When creating releases

### Removed (Simplified in v2.0)
- ~~version.json~~ - Eliminated to simplify version management
- ~~tools/sync-version.js~~ - No longer needed

---

## 🔄 Tool Evolution

### Version 2.0 (Current - Simplified)
- ✅ Use package.json as single source of truth
- ✅ Update README.md status line
- ✅ Update CLAUDE.md version headers
- ✅ Check GitHub Releases (https://github.com/defai-digital/automatosx/releases) has entry
- ✅ Colorful console output
- ✅ Automatically run tests and update test counts (optional)
- ✅ **SIMPLIFIED**: Removed version.json and sync-version.js
- ✅ **IMPROVED**: Reduced version management complexity by 50%

### Version 1.0 (Legacy)
- ✅ Sync package.json, version.json (removed in v2.0)
- ✅ Update README.md and CLAUDE.md
- ⚠️ Maintained two version sources (complex)

### Future Enhancements (v3.0)
- [ ] Calculate coverage percentage and update badges automatically
- [ ] Interactive mode for GitHub Releases (https://github.com/defai-digital/automatosx/releases) entries
- [ ] Dry-run mode for verification
- [ ] Automatic git commit after sync
- [ ] GitHub release notes generation

---

## 💡 Best Practices

### When to Run

1. **Before npm publish** - Always
2. **After version bump** - Recommended
3. **Before git push --tags** - Recommended
4. **After major refactoring** - Optional

### Version Numbering Strategy

- **Patch (x.x.1)**: Bug fixes, documentation updates
- **Minor (x.1.0)**: New features, backward compatible
- **Major (1.0.0)**: Breaking changes, major refactoring

### Commit Messages

```bash
# After version bump
git commit -m "chore: bump version to 5.2.3"

# After version sync
git commit -m "chore: sync version to 5.2.3"

# Combined (recommended)
git commit -m "chore: prepare release v5.2.3"
```

---

## 🐛 Troubleshooting

### "Could not find status line pattern in README.md"

**Cause**: README.md status line format changed
**Fix**: Update regex in `tools/sync-all-versions.js` line ~87

### "Could not find version patterns in CLAUDE.md"

**Cause**: CLAUDE.md header format changed
**Fix**: Update regex patterns in `tools/sync-all-versions.js` lines ~114-120

### "GitHub Releases (https://github.com/defai-digital/automatosx/releases) does not have entry"

**Expected**: Tool only checks, doesn't create entries
**Action**: Manually add release notes to GitHub Releases (https://github.com/defai-digital/automatosx/releases)

### Test counts are outdated

**Expected**: Tool doesn't update test counts
**Action**:
1. Run `npm run test:all`
2. Note the test count
3. Manually update badges in README.md and CLAUDE.md

---

## 📝 Example Output

```
📦 AutomatosX Version Sync Tool (Simplified)

Current Version: v5.3.7 (from package.json)
Release Date: 2025-10-15 (October 2025)

✓ Updated README.md status line
✓ Updated CLAUDE.md version references

Running tests to get count...
✓ Found 1735 passing tests

✓ Updated test counts in README.md (1,735 tests)

⚠ GitHub Releases (https://github.com/defai-digital/automatosx/releases) does not have entry for v5.3.7
  → Please add release notes to GitHub Releases (https://github.com/defai-digital/automatosx/releases)

✨ Version sync completed successfully!

Files updated:
  • README.md → v5.3.7 · October 2025
  • CLAUDE.md → v5.3.7 (October 2025)
  • README.md test counts → 1,735 tests

Note: package.json is the single source of truth
  Use npm version [patch|minor|major] to bump version
```

---

## 🎉 Success Criteria

After running the tool and following next steps:

✅ All tests passing (1,538/1,538)
✅ TypeScript check passing (0 errors)
✅ Version consistent across all files
✅ GitHub Releases (https://github.com/defai-digital/automatosx/releases) has release notes
✅ Test count badges updated
✅ Git commit created with clear message
✅ Git tag created (e.g., v5.2.3)
✅ Ready to publish to npm

---

**Tool Location**: `tools/sync-all-versions.js`
**npm Script**: `npm run sync:all-versions`
**Pre-release Script**: `npm run prerelease`
