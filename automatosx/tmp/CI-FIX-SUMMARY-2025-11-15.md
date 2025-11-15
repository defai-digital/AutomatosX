# CI/CD Fix Summary - 2025-11-15

**Status**: ✅ **PARTIALLY RESOLVED** (Node.js v24 compatibility fixed, tree-sitter-swift blocking)

---

## Problem Overview

GitHub CI/CD pipelines failing on all jobs with native addon compilation errors due to Node.js v24 requirements.

---

## Root Causes Identified

### 1. ✅ **FIXED**: C++20 Standard Required
**Error**:
```
error: #error "C++20 or later required."
error: non-type template parameters of class type only available with '-std=c++20' or '-std=gnu++20'
```

**Root Cause**: Node.js v24 requires C++20 for native addons, but tree-sitter packages were compiling with older C++ standard.

**Fix Applied**:
```yaml
# .github/workflows/runtime-ci.yml
# .github/workflows/sprint2-ci.yml (all 4 jobs)
- name: Install dependencies
  env:
    CXXFLAGS: "-std=c++20 -fexceptions"
  run: npm ci --legacy-peer-deps
```

**Commit**: `6266d5d` - "fix(ci): Add -fexceptions flag for tree-sitter-markdown compilation"

---

### 2. ✅ **FIXED**: Exception Handling Disabled
**Error**:
```
error: exception handling disabled, use '-fexceptions' to enable
  #define TREE_SITTER_MARKDOWN_ASSERT(condition) if (!(condition)) throw 1;
```

**Root Cause**: tree-sitter-markdown uses C++ exceptions but they were disabled by default.

**Fix Applied**: Added `-fexceptions` to CXXFLAGS (see above)

---

### 3. ✅ **FIXED**: C Code Warnings
**Warning**:
```
cc1: warning: command-line option '-std=c++20' is valid for C++/ObjC++ but not for C
```

**Root Cause**: Initially set both CFLAGS and CXXFLAGS, causing warnings for C code compilation.

**Fix Applied**: Only set CXXFLAGS (not CFLAGS) using GitHub Actions `env:` block.

**Commit**: `28104aa` - "fix(ci): Use env CXXFLAGS instead of export to avoid C code warnings"

---

### 4. ❌ **BLOCKING**: tree-sitter-swift Package Issue
**Error**:
```
Error: spawn /home/runner/work/AutomatosX/AutomatosX/node_modules/tree-sitter-swift/node_modules/tree-sitter-cli/tree-sitter ENOENT
errno: -2
code: 'ENOENT'
syscall: 'spawn .../tree-sitter-cli/tree-sitter'
```

**Root Cause**: tree-sitter-swift package tries to run `tree-sitter generate` during installation, but tree-sitter-cli binary is not available for the GitHub Actions runner platform (Ubuntu 24.04, x64).

**Impact**: Blocks npm install completion in CI

**Not Our Code**: This is a tree-sitter-swift package issue (v0.5.0)

---

## Fixes Applied

### Commit History

1. **795ab64** - "fix(ci): Add C++20 compiler flags for Node.js v24 native addons"
   - Created .npmrc with legacy-peer-deps
   - Added CXXFLAGS and CFLAGS exports (initial attempt)

2. **28104aa** - "fix(ci): Use env CXXFLAGS instead of export to avoid C code warnings"
   - Changed to GitHub Actions `env:` block
   - Removed CFLAGS to avoid C code warnings
   - Set only CXXFLAGS="-std=c++20"

3. **6266d5d** - "fix(ci): Add -fexceptions flag for tree-sitter-markdown compilation"
   - Added -fexceptions to CXXFLAGS
   - Final: CXXFLAGS="-std=c++20 -fexceptions"

###  Files Modified

1. **.npmrc** (created)
```ini
# Node.js v24 requires C++20 for native addons
legacy-peer-deps=true
```

2. **.github/workflows/runtime-ci.yml**
```yaml
- name: Install dependencies
  env:
    CXXFLAGS: "-std=c++20 -fexceptions"
  run: npm ci --legacy-peer-deps
```

3. **.github/workflows/sprint2-ci.yml** (4 jobs updated)
- test-macos
- test-linux
- test-windows
- validate-schemas

All use same fix as runtime-ci.yml

---

## Current CI Status

### ✅ **Passing**
- CodeQL (code quality analysis)

### ❌ **Failing**
- Runtime CI - Blocked by tree-sitter-swift
- Sprint 2 CI Matrix - Blocked by tree-sitter-swift
  - test-macos
  - test-linux
  - test-windows
  - validate-schemas

---

## Compilation Progress

### ✅ **Successfully Compiling**
These tree-sitter packages now compile successfully:
- tree-sitter (core)
- tree-sitter-bash
- tree-sitter-c
- tree-sitter-c-sharp
- tree-sitter-cpp
- tree-sitter-csv
- tree-sitter-cuda
- tree-sitter-dart
- tree-sitter-dockerfile
- tree-sitter-elixir
- tree-sitter-elm
- tree-sitter-gleam
- tree-sitter-go
- tree-sitter-groovy
- tree-sitter-haskell
- tree-sitter-html
- tree-sitter-java
- tree-sitter-json
- tree-sitter-julia
- tree-sitter-kotlin
- tree-sitter-lua
- tree-sitter-make
- tree-sitter-markdown (fixed with -fexceptions)
- tree-sitter-matlab
- tree-sitter-objc
- tree-sitter-ocaml
- tree-sitter-perl
- tree-sitter-php
- tree-sitter-python
- tree-sitter-r
- tree-sitter-regex
- tree-sitter-ruby
- tree-sitter-rust
- tree-sitter-scala
- tree-sitter-solidity
- tree-sitter-sql
- tree-sitter-systemverilog
- tree-sitter-thrift
- tree-sitter-toml
- tree-sitter-typescript
- tree-sitter-verilog
- tree-sitter-xml
- tree-sitter-yaml
- tree-sitter-zig
- tree-sitter-zsh

### ❌ **Blocked**
- tree-sitter-swift - Missing tree-sitter-cli binary

---

## Recommendations

### Option 1: Remove tree-sitter-swift (RECOMMENDED)
**Pros**:
- Immediate CI fix
- Swift support is tier-2 (not critical)
- Can re-add later when package is fixed

**Cons**:
- Loses Swift language support (1 of 45 languages)

**Implementation**:
```bash
npm uninstall tree-sitter-swift
git add package.json package-lock.json
git commit -m "fix(ci): Remove tree-sitter-swift to unblock CI

tree-sitter-swift v0.5.0 has installation issues on GitHub Actions:
- tree-sitter-cli binary not available for Ubuntu 24.04 x64
- Blocks npm install with ENOENT error

Swift support can be re-added when package is fixed.
Reduces language support from 45 to 44 languages (96% coverage)."
git push origin main
```

### Option 2: Install tree-sitter-cli Globally in CI
**Pros**:
- Keeps Swift support

**Cons**:
- Adds CI complexity
- May not work (tree-sitter-cli has its own build issues)

**Implementation**:
```yaml
- name: Install tree-sitter CLI
  run: npm install -g tree-sitter-cli

- name: Install dependencies
  env:
    CXXFLAGS: "-std=c++20 -fexceptions"
  run: npm ci --legacy-peer-deps
```

### Option 3: Wait for tree-sitter-swift Fix
**Pros**:
- No code changes needed

**Cons**:
- Unknown timeline
- Blocks all CI/CD

---

## Impact Assessment

### Code Quality
- ✅ C++20 compliance achieved
- ✅ Exception handling enabled
- ✅ Clean compilation (no C code warnings)
- ⚠️ tree-sitter-swift blocking complete validation

### Language Support
- ✅ 44/45 languages working (98%)
- ❌ Swift blocked by package issue

### CI/CD Health
- ✅ CodeQL passing
- ❌ Runtime CI blocked
- ❌ Sprint 2 CI blocked

---

## Next Steps

### Immediate (RECOMMENDED)
1. Remove tree-sitter-swift from dependencies
2. Update language count in documentation (45 → 44)
3. Verify CI passes

### Alternative (If Swift is Critical)
1. Try Option 2 (install tree-sitter-cli globally)
2. If that fails, investigate tree-sitter-swift alternatives
3. Consider manual parser implementation

### Long-term
1. Monitor tree-sitter-swift for fixes
2. Re-add when package is stable on Node.js v24
3. Document Swift support as "experimental" if re-added

---

## Technical Learnings

### Node.js v24 Native Addon Requirements
1. Must use C++20 standard (`-std=c++20`)
2. Must enable exceptions if using them (`-fexceptions`)
3. Cannot mix C++ flags with C code compilation
4. Use GitHub Actions `env:` block, not `export` commands

### GitHub Actions Environment Variables
```yaml
# ✅ CORRECT: Scoped to single step
- name: Install dependencies
  env:
    CXXFLAGS: "-std=c++20 -fexceptions"
  run: npm ci

# ❌ WRONG: Creates warnings for C code
- name: Install dependencies
  run: |
    export CFLAGS="-std=c++20"
    export CXXFLAGS="-std=c++20"
    npm ci
```

### tree-sitter CLI Dependencies
- Some tree-sitter packages require tree-sitter-cli at install time
- tree-sitter-cli has platform-specific binary issues
- Always test with clean node_modules in CI environment

---

## Files Changed

```bash
.npmrc                                 # Created
.github/workflows/runtime-ci.yml       # Modified
.github/workflows/sprint2-ci.yml       # Modified
```

**Total commits**: 3
**Total lines changed**: ~50

---

## Summary

**What Worked**:
- Fixed C++20 standard requirement
- Fixed exception handling for tree-sitter-markdown
- Eliminated C code warnings
- Enabled 44/45 languages to compile successfully

**What's Blocking**:
- tree-sitter-swift package installation issue (not our code)

**Recommended Action**:
Remove tree-sitter-swift dependency to unblock CI/CD pipelines. This reduces language support by 1 (2.2%) but allows full CI validation and deployment.

---

**Generated**: 2025-11-15T04:08:00Z
**Status**: ✅ **FIXES READY** (pending tree-sitter-swift removal)
**Commits**: 795ab64, 28104aa, 6266d5d
**Recommendation**: Remove tree-sitter-swift to unblock CI
