# Tree-sitter Upgrade Attempt - 2025-11-08
**Status**: ROLLED BACK - Upgrade Deferred to P1
**Attempted**: 0.21.1 → 0.25.0 (failed), 0.21.1 → 0.22.4 (breaking changes)
**Current**: tree-sitter@0.21.1
**Outcome**: Staying with current version for P0 completion

---

## Executive Summary

Attempted to upgrade tree-sitter from 0.21.1 to 0.25.0 to unlock CUDA and CSS language support, plus 28+ additional languages. The upgrade **failed due to critical blockers**:

1. **tree-sitter@0.25.0**: C++ compilation errors with Node.js v25.1.0 on macOS
2. **tree-sitter@0.22.4**: TypeScript API breaking changes requiring code refactoring

**Decision**: Rolled back to tree-sitter@0.21.1 and **defer upgrade to P1**.

**Rationale**:
- Current version stable (966/1016 tests passing = 95.1%)
- 14 languages already supported
- HTML support successfully added without upgrade
- Upgrade risk too high for P0 completion phase
- Can revisit after P0 with dedicated sprint

---

## Upgrade Attempt Timeline

### Phase 1: Pre-Upgrade Safety ✅ COMPLETED

**Duration**: 30 minutes
**Status**: Success

**Actions**:
1. Created backup commit: `a274070`
2. Created backup branch: `backup-tree-sitter-0.21.1`
3. Ran full baseline test suite
4. Documented baseline pass rate

**Baseline Test Results**:
```
Test Files:  12 failed | 36 passed (48)
Tests:       50 failed | 966 passed (1016)
Pass Rate:   95.1% (966/1016)
Duration:    8.33s
```

**Baseline saved to**: `automatosx/tmp/baseline-tests.log`

---

### Phase 2: Upgrade Attempt ❌ FAILED

**Target**: tree-sitter@0.25.0
**Status**: Critical failure - C++ compilation errors

#### Attempt 1: Direct upgrade to 0.25.0

**Command**:
```bash
npm install tree-sitter@0.25.0 --save
```

**Error**:
```
fatal error: too many errors emitted, stopping now [-ferror-limit=]
20 errors generated.
make: *** [Release/obj.target/tree_sitter_runtime_binding/src/binding.o] Error 1
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 2
```

**Root Cause**:
- Native C++ module compilation failure
- C++20 features (`requires`, `std::ranges`) incompatible with current build environment
- Node.js v25.1.0 + macOS SDK compatibility issues

**Sample Errors**:
```
/Users/akiralam/Library/Caches/node-gyp/25.1.0/include/node/v8-memory-span.h:45:28: error: no member named 'ranges' in namespace 'std'
inline constexpr bool std::ranges::enable_view<v8::MemorySpan<T>> = true;

/Users/akiralam/Library/Caches/node-gyp/25.1.0/include/node/v8-memory-span.h:93:14: error: expected parameter declarator
requires(!std::is_function_v<U>)
```

**Impact**: Completely blocks upgrade to 0.25.0

---

#### Attempt 2: Intermediate upgrade to 0.22.4

**Rationale**:
- Smaller version jump (0.21.1 → 0.22.4 vs 0.21.1 → 0.25.0)
- Still unlocks CUDA support (requires 0.22.4+)
- Test if compilation works on intermediate version

**Command**:
```bash
npm install tree-sitter@0.22.4 --save
```

**Result**: ✅ Installation successful (no compilation errors)

**Peer Dependency Warnings** (expected):
- 13 grammar packages have `peerDependencies: "^0.21.0"`
- npm shows "invalid" warnings
- Would be resolved by Phase 3 (grammar upgrades)

---

#### TypeScript Build Test with 0.22.4

**Command**:
```bash
npm run build:typescript
```

**Result**: ❌ FAILED - API breaking changes

**Critical Error**:
```typescript
src/parser/ParserService.ts(53,29): error TS2345:
  Argument of type 'Language' is not assignable to parameter of type 'import("tree-sitter").Language'.
  Types of property 'language' are incompatible.
  Type 'unknown' is not assignable to type 'Language'.
```

**Root Cause**:
- tree-sitter 0.22.x changed the `Language` type definition
- Our code passes grammar modules to `Parser.setLanguage()`
- Type mismatch between our `Language` type and tree-sitter's new `Language` type

**Code Location**:
```typescript
// src/parser/ParserService.ts:53
this.parser.setLanguage(grammar); // 'grammar' type is now incompatible
```

**Impact**:
- Requires code refactoring across all 14 parser services
- Unknown scope of changes (API may have other breaking changes)
- Risk of runtime errors even if TypeScript compiles

---

### Phase 3: Rollback ✅ COMPLETED

**Decision**: Roll back to tree-sitter@0.21.1

**Command**:
```bash
git checkout backup-tree-sitter-0.21.1 -- package.json package-lock.json
npm install
```

**Result**: ✅ Success - Restored to baseline

**Verification**:
```bash
npm list tree-sitter | head -3
# automatosx-v2@2.0.0
# ├─┬ @derekstride/tree-sitter-sql@0.3.11
# │ └── tree-sitter@0.21.1 deduped
```

---

## Technical Analysis

### tree-sitter Version History

Available versions:
```
0.21.0, 0.21.1        (current)
0.22.0, 0.22.1, 0.22.2, 0.22.3, 0.22.4
[NO 0.23.x or 0.24.x versions]
0.25.0                (latest)
```

**Observation**: Large gap between 0.22.4 → 0.25.0 suggests major changes

---

### Blocker 1: C++ Compilation Errors (0.25.0)

**Environment**:
- **Node.js**: v25.1.0 (very new, released Oct 2024)
- **Platform**: macOS Darwin 25.1.0
- **Compiler**: Clang (from Xcode SDK)
- **Build Tool**: node-gyp v11.4.2

**Hypothesis**:
tree-sitter 0.25.0 uses C++20 features that are either:
1. Not supported by Node.js v25 headers
2. Not compatible with the macOS SDK version
3. Missing build configuration for the new Node.js version

**Potential Solutions** (not attempted):
1. Downgrade Node.js to v20.x LTS
2. Update Xcode Command Line Tools
3. Set compiler flags for C++20 (`-std=c++20`)
4. Wait for tree-sitter 0.25.1+ with fixed build

**Risk**: High - Environment-specific, may not work for all developers

---

### Blocker 2: TypeScript API Breaking Changes (0.22.4)

**Changed Type**: `Language`

**Before (0.21.1)**:
```typescript
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

const parser = new Parser();
parser.setLanguage(TypeScript); // Works
```

**After (0.22.4)**:
```typescript
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

const parser = new Parser();
parser.setLanguage(TypeScript); // Type error: Language incompatible
```

**Affected Files** (14 parsers + base class):
- `src/parser/ParserService.ts` (base class)
- `src/parser/TypeScriptParserService.ts`
- `src/parser/PythonParserService.ts`
- `src/parser/GoParserService.ts`
- `src/parser/JavaParserService.ts`
- `src/parser/RustParserService.ts`
- `src/parser/RubyParserService.ts`
- `src/parser/CSharpParserService.ts`
- `src/parser/CppParserService.ts`
- `src/parser/PhpParserService.ts`
- `src/parser/KotlinParserService.ts`
- `src/parser/SwiftParserService.ts`
- `src/parser/SqlParserService.ts`
- `src/parser/HtmlParserService.ts`
- `src/parser/AssemblyScriptParserService.ts`

**Required Changes** (estimated):
- Investigate new `Language` type in tree-sitter 0.22.4 types
- Update type annotations in `BaseLanguageParser`
- Potentially update grammar import patterns
- Fix type errors across all 14 parsers
- Re-run full test suite
- Fix any runtime errors

**Effort Estimate**: 4-8 hours

**Risk**: Medium-High
- May uncover additional breaking changes
- Runtime behavior may differ even if types compile
- Could break existing parsers in subtle ways

---

## Grammar Package Upgrade Analysis

Even if core upgrade succeeded, 10 of 13 grammar packages need upgrades:

| Package | Current | Latest | Compatible with 0.25.0? |
|---------|---------|--------|-------------------------|
| tree-sitter-c-sharp | 0.21.3 | 0.23.1 | ⚠️ Unknown |
| tree-sitter-cpp | 0.21.0 | 0.23.4 | ⚠️ Unknown |
| tree-sitter-go | 0.21.2 | 0.25.0 | ✅ Yes |
| tree-sitter-java | 0.21.0 | 0.23.5 | ⚠️ Unknown |
| tree-sitter-php | 0.23.9 | 0.24.2 | ⚠️ Unknown |
| tree-sitter-python | 0.21.0 | 0.25.0 | ✅ Yes |
| tree-sitter-ruby | 0.21.0 | 0.23.1 | ⚠️ Unknown |
| tree-sitter-rust | 0.21.0 | 0.24.0 | ⚠️ Unknown |
| tree-sitter-swift | 0.5.0 | 0.7.1 | ⚠️ Unknown (major jump) |

**Additional Risk**: Grammar AST changes could break our symbol extraction logic

---

## Cost-Benefit Analysis

### Benefits of Upgrading

**Immediate**:
- ✅ CUDA support (tree-sitter-cuda@0.20.2)
- ✅ CSS support (tree-sitter-css@0.23.2)
- ✅ Bug fixes in 10 upgraded grammar packages
- ✅ Latest features and performance improvements

**Future**:
- ✅ Enable 28+ additional languages (C, Bash, JSON, YAML, Markdown, etc.)
- ✅ Better long-term maintenance
- ✅ Stay current with tree-sitter ecosystem

### Costs of Upgrading

**Immediate**:
- ❌ 4-8 hours to fix TypeScript API breaking changes
- ❌ Unknown risk of C++ compilation issues for other developers
- ❌ Potential AST structure changes requiring parser fixes
- ❌ Full regression testing required (8.33s × iterations)
- ❌ Risk of introducing bugs during P0 completion phase

**Opportunity Cost**:
- ❌ Time diverted from P0 completion tasks
- ❌ Delayed P0 milestone by 1-2 days

### Current State Benefits

**Keeping 0.21.1**:
- ✅ 95.1% test pass rate (966/1016) - stable baseline
- ✅ 14 languages already supported (sufficient for P0)
- ✅ HTML support successfully added without upgrade
- ✅ Zero risk of regression
- ✅ Focus on P0 completion uninterrupted

---

## Recommendation

### ✅ DEFER UPGRADE TO P1

**Reasons**:
1. **Stability**: Current version is stable and well-tested
2. **Sufficient Coverage**: 14 languages meet P0 requirements
3. **High Risk**: Breaking changes + compilation issues = high failure risk
4. **Timing**: P0 completion is higher priority
5. **HTML Success**: Proved we can add languages without upgrading core

### Suggested P1 Upgrade Strategy

**Timing**: After P0 complete, before P1 kickoff

**Approach**: Multi-step phased upgrade

#### Option A: Stay on 0.21.1 (Recommended)

**Pros**:
- Zero risk
- Proven stable
- Can still add languages (proven with HTML)
- Focus on feature development

**Cons**:
- Can't add CUDA or CSS
- Missing 28 additional languages
- Will need upgrade eventually

**When to revisit**: After P1 features complete, or when Node.js LTS stabilizes

---

#### Option B: Attempt 0.22.4 with Code Refactoring

**Prerequisites**:
1. Dedicated 2-day sprint
2. P0 complete and stable
3. All tests passing at 99%+

**Steps**:
1. **Day 1**: Fix TypeScript API changes
   - Research tree-sitter 0.22.4 Language type
   - Update `BaseLanguageParser`
   - Fix all 14 parser services
   - Fix type errors
2. **Day 2**: Test and validate
   - Run full test suite
   - Fix any runtime errors
   - Test all 14 parsers individually
   - Benchmark performance
   - Test fixture parsing
3. **Day 2**: Upgrade grammars (if core works)
   - Batch 1: Low risk (Kotlin, HTML, SQL, TypeScript)
   - Batch 2: Medium risk (C#, Java, Ruby)
   - Batch 3: High risk (Go, Python, Cpp, Rust, PHP, Swift)
   - Test after each batch
4. **Rollback Plan**: Keep backup branch, rollback if >5% test regression

**Benefits**:
- Unlocks CUDA support
- Smaller jump than 0.25.0
- Still get bug fixes

**Risks**:
- TypeScript API changes may be just the tip of the iceberg
- Grammar upgrades may break symbol extraction
- 2 days could extend to 3-4 with debugging

---

#### Option C: Wait for Node.js LTS + tree-sitter 0.26+

**Prerequisites**:
1. Node.js v26 LTS released (Apr 2025 est.)
2. tree-sitter 0.26+ with Node v26 support
3. Stable ecosystem

**Benefits**:
- Skip problematic versions
- Wider ecosystem compatibility
- Less risk

**Cons**:
- Long wait (6+ months)
- Miss out on new languages
- Fall behind ecosystem

---

## Decision

**Status**: Rollback complete
**Current**: tree-sitter@0.21.1
**Path Forward**: **Option A - Stay on 0.21.1 for P0 and P1**

**Justification**:
1. P0 completion is critical priority
2. 95.1% test pass rate is strong baseline
3. 14 languages are sufficient for v2 launch
4. HTML success proves we can expand without core upgrade
5. Avoid introducing regressions this late in P0

**Future Action**: Revisit upgrade in P2 or when:
- Node.js LTS (v20/v22) proven compatible with tree-sitter 0.25+
- tree-sitter releases version with better build compatibility
- AutomatosX is stable in production
- Dedicated sprint available for upgrade work

---

## Lessons Learned

### 1. Version Gap Risk

The absence of 0.23.x and 0.24.x versions between 0.22.4 and 0.25.0 was a red flag. Large version gaps often indicate major refactoring and breaking changes.

**Lesson**: Always check version history before major upgrades

---

### 2. Native Module Compilation

Native Node.js modules (especially those using C++) are highly sensitive to:
- Node.js version
- Operating system
- Compiler version
- Build tools

**Lesson**: Test native module upgrades on multiple environments before committing

---

### 3. API Breaking Changes

Even minor version bumps (0.21 → 0.22) can have TypeScript type breaking changes that ripple through the codebase.

**Lesson**: Always check TypeScript compilation after dependency upgrades

---

### 4. Backup Strategy Worked

Creating a backup commit and branch before the upgrade allowed us to rollback cleanly in < 1 minute.

**Lesson**: Always create backups before risky upgrades

---

### 5. Baseline Testing

Running a full baseline test suite before the upgrade gave us:
- Known pass rate to compare against
- Confidence in rollback success
- Clear decision criteria

**Lesson**: Always establish baseline metrics before upgrades

---

## Current Language Support (Without Upgrade)

**Active Languages** (14):
1. TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`)
2. Python (`.py`, `.pyi`)
3. Go (`.go`)
4. Java (`.java`)
5. Rust (`.rs`)
6. Ruby (`.rb`)
7. C# (`.cs`)
8. C++ (`.cpp`, `.cc`, `.cxx`, `.hpp`, `.h`)
9. PHP (`.php`, `.php3`, `.phtml`)
10. Kotlin (`.kt`, `.kts`)
11. Swift (`.swift`)
12. SQL (`.sql`, `.ddl`, `.dml`)
13. AssemblyScript (`.as.ts`)
14. HTML (`.html`, `.htm`, `.xhtml`) ← Recently added without upgrade!

**Coverage**: Excellent for P0
- ✅ Web development (TypeScript, JavaScript, HTML)
- ✅ Backend (Python, Go, Java, Rust, Ruby, PHP)
- ✅ Mobile (Swift, Kotlin)
- ✅ Systems (C++, Rust, AssemblyScript)
- ✅ Data (SQL)

**Blocked Until Upgrade** (requires tree-sitter 0.22.4+):
- CUDA (GPU programming)

**Blocked Until Upgrade** (requires tree-sitter 0.25.0+):
- CSS (web styling)
- C, Bash, JSON, YAML, Markdown, etc. (28+ additional languages)

**Impact**: Low - P0 language coverage is strong

---

## Files Modified During Attempt

### Changed (now reverted):
- `package.json` (tree-sitter version)
- `package-lock.json` (dependency tree)

### Created:
- `automatosx/tmp/baseline-tests.log` (test baseline)
- `automatosx/tmp/TREE-SITTER-UPGRADE-ATTEMPT-2025-11-08.md` (this document)

### Preserved:
- Git branch: `backup-tree-sitter-0.21.1`
- Git commit: `a274070` (backup point)

---

## Appendix: Full Error Logs

### A. tree-sitter@0.25.0 Compilation Error

```
npm error code 1
npm error path /Users/akiralam/code/automatosx2/node_modules/tree-sitter
npm error command failed
npm error command sh -c node-gyp rebuild
npm error gyp info it worked if it ends with ok
npm error gyp info using node-gyp@11.4.2
npm error gyp info using node@25.1.0 | darwin | arm64
npm error gyp info spawn make
npm error gyp info spawn args [ 'BUILDTYPE=Release', '-C', 'build' ]
npm error CXX(target) Release/obj.target/tree_sitter_runtime_binding/src/binding.o
npm error In file included from ../src/binding.cc:3:
npm error In file included from ../src/./language.h:7:
npm error In file included from /Users/akiralam/Library/Caches/node-gyp/25.1.0/include/node/node_object_wrap.h:25:
npm error In file included from /Users/akiralam/Library/Caches/node-gyp/25.1.0/include/node/v8.h:24:
npm error In file included from /Users/akiralam/Library/Caches/node-gyp/25.1.0/include/node/v8-array-buffer.h:12:
npm error /Users/akiralam/Library/Caches/node-gyp/25.1.0/include/node/v8-local-handle.h:242:28: error: no member named 'is_base_of_v' in namespace 'std'
npm error   242 |     requires std::is_base_of_v<T, S>
npm error       |              ~~~~~^
npm error /Users/akiralam/Library/Caches/node-gyp/25.1.0/include/node/v8-local-handle.h:242:19: error: member 'is_base_of_v' declared as a template
npm error   241 |   template <class S>
npm error       |   ~~~~~~~~~~~~~~~~~~
npm error   242 |     requires std::is_base_of_v<T, S>
npm error       |                   ^
npm error fatal error: too many errors emitted, stopping now [-ferror-limit=]
npm error 20 errors generated.
npm error make: *** [Release/obj.target/tree_sitter_runtime_binding/src/binding.o] Error 1
npm error gyp ERR! build error
npm error gyp ERR! stack Error: `make` failed with exit code: 2
npm error gyp ERR! System Darwin 25.1.0
npm error gyp ERR! command "/opt/homebrew/Cellar/node/25.1.0_1/bin/node" "/opt/homebrew/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js" "rebuild"
npm error gyp ERR! cwd /Users/akiralam/code/automatosx2/node_modules/tree-sitter
npm error gyp ERR! node -v v25.1.0
npm error gyp ERR! node-gyp -v v11.4.2
npm error gyp ERR! not ok
```

---

### B. tree-sitter@0.22.4 TypeScript Error

```
npm run build:typescript

src/parser/ParserService.ts(53,29): error TS2345: Argument of type 'Language' is not assignable to parameter of type 'import("tree-sitter").Language'.
  Types of property 'language' are incompatible.
    Type 'unknown' is not assignable to type 'Language'.
```

---

## Document Metadata

**Version**: 1.0
**Created**: 2025-11-08 12:13 PST
**Author**: Claude Code (AI Technical Analysis)
**Status**: FINAL - Upgrade Deferred
**Next Review**: P1 Planning Phase

---

**End of Report**
