# tree-sitter 0.24.x Evaluation
**Date**: 2025-11-08
**Requested Version**: 0.24.x
**Finding**: ❌ **VERSION DOES NOT EXIST**

---

## Summary

**tree-sitter version 0.24.x does NOT exist on npm.**

The version sequence jumps from **0.22.4 directly to 0.25.0**, skipping both 0.23.x and 0.24.x entirely.

---

## Complete Version History

```
0.20.0, 0.20.1, 0.20.2, 0.20.3, 0.20.4, 0.20.5, 0.20.6
0.21.0, 0.21.1  ← Current version
0.22.0, 0.22.1, 0.22.2, 0.22.3, 0.22.4
[NO 0.23.x versions]
[NO 0.24.x versions]
0.25.0          ← Latest version
```

**Gap**: 0.22.4 → 0.25.0 (skipped 0.23 and 0.24 entirely)

---

## What This Means

### Version Gap Significance

The jump from **0.22.4 to 0.25.0** suggests:

1. **Major Refactoring**: Skipping two minor versions often indicates significant internal changes
2. **Breaking Changes**: Large jumps usually mean API changes (confirmed - we found TypeScript type incompatibilities)
3. **New Features**: 0.25.0 likely includes substantial new functionality
4. **Ecosystem Impact**: Grammar packages may need updates to support new version

This gap is unusual and was a **red flag** during our upgrade attempt.

---

## Available Upgrade Paths

Since 0.24.x doesn't exist, you have only **3 options**:

### Option 1: Stay on 0.21.1 ✅ RECOMMENDED

**Current Status**: Stable, 95.1% test pass rate (966/1016 tests)

**Pros**:
- ✅ Zero risk
- ✅ Proven stable
- ✅ 14 languages working
- ✅ Can add 13 more languages (JSON, YAML, Markdown, etc.)
- ✅ Focus on P0 completion

**Cons**:
- ❌ Can't add CUDA, CSS, C, Bash, Zsh
- ❌ Missing 28 additional languages
- ❌ Missing latest grammar bug fixes

**Coverage**:
- Current: 14 languages (31.8%)
- Potential: 27 languages (61.4%) with compatible grammars

**Recommendation**: Best choice for P0/P1

---

### Option 2: Upgrade to 0.22.4 ⚠️ RISKY

**Status**: Installation succeeds, BUT requires code refactoring

**Pros**:
- ✅ Unlocks CUDA support (tree-sitter-cuda requires 0.22.4)
- ✅ Unlocks C, Objective-C, ReScript, Makefile
- ✅ Smaller jump than 0.25.0
- ✅ Native module compiles successfully

**Cons**:
- ❌ TypeScript API breaking changes
- ❌ Requires refactoring 14 parser services
- ❌ Estimated 4-8 hours of work
- ❌ Unknown additional breaking changes
- ❌ Risk of runtime errors

**Blockers Found**:
```typescript
src/parser/ParserService.ts(53,29): error TS2345:
  Argument of type 'Language' is not assignable to parameter of type 'import("tree-sitter").Language'.
  Types of property 'language' are incompatible.
```

**Coverage**:
- Potential: 33 languages (75%) - adds 6 languages requiring 0.22.4

**Recommendation**: Only if CUDA is critical priority (unlikely)

---

### Option 3: Upgrade to 0.25.0 ❌ BLOCKED

**Status**: **FAILED** - C++ compilation errors

**Pros**:
- ✅ Latest features and bug fixes
- ✅ Unlocks ALL available languages (40/44 = 90.9%)
- ✅ Unlocks CSS, Bash, Zsh, Regex
- ✅ Best long-term choice

**Cons**:
- ❌ **CRITICAL**: Native module won't compile with Node.js v25.1.0
- ❌ C++20 features incompatible with current build environment
- ❌ TypeScript API breaking changes (same as 0.22.4)
- ❌ Requires both environment fixes AND code refactoring

**Compilation Errors**:
```
fatal error: too many errors emitted, stopping now [-ferror-limit=]
20 errors generated.
make: *** [Release/obj.target/tree_sitter_runtime_binding/src/binding.o] Error 1
gyp ERR! build error
```

**Sample Errors**:
```cpp
error: no member named 'ranges' in namespace 'std'
error: expected parameter declarator
requires(!std::is_function_v<U>)
```

**Root Cause**: Node.js v25.1.0 + macOS SDK + C++20 features incompatibility

**Coverage**:
- Potential: 40 languages (90.9%) - maximum possible

**Recommendation**: **BLOCKED** - Wait for Node.js LTS compatibility

---

## Detailed Comparison

| Metric | 0.21.1 (Current) | 0.22.4 | 0.25.0 |
|--------|------------------|--------|--------|
| **Installation** | ✅ Working | ✅ Succeeds | ❌ Fails (C++ errors) |
| **Build** | ✅ Clean | ❌ TypeScript errors | ❌ Won't compile |
| **Tests** | ✅ 966/1016 (95.1%) | ⚠️ Unknown | ❌ Can't test |
| **Languages (Current)** | 14 | 14 | 0 (failed install) |
| **Languages (Potential)** | 27 (61.4%) | 33 (75%) | 40 (90.9%) |
| **Code Changes Required** | None | Medium (4-8h) | Medium + Environment |
| **Risk** | None | Medium-High | Very High |
| **Blockers** | None | TypeScript API | C++ compilation |

---

## Language Support by Version

### With 0.21.1 (Current)

**Can Use Now** (14):
- C#, C++, Go, HTML, Java, JavaScript, Kotlin, PHP, Python, Ruby, Rust, SQL, Swift, TypeScript

**Can Add Today** (13):
- Scala, Lua, JSON, YAML, TOML, XML, Markdown, LaTeX, CSV, Elm, R, Dockerfile, GraphQL

**Total**: 27 languages (61.4%)

---

### With 0.22.4 (If Upgraded)

**Everything from 0.21.1** (27 languages) **PLUS**:

**New Languages** (6):
- C
- Objective-C
- CUDA
- ReScript (via tree-sitter-ocaml)
- Makefile
- PHP 0.24.2 (upgrade from 0.23.9)

**Total**: 33 languages (75%)

**Still Blocked** (requires 0.25.0):
- Bash, Zsh, Regex
- JavaScript upgrade, Python upgrade, Go upgrade, Rust upgrade, Swift upgrade

---

### With 0.25.0 (If Compilation Fixed)

**Everything from 0.22.4** (33 languages) **PLUS**:

**New Languages** (7):
- Bash
- Zsh
- Regex
- JavaScript 0.25.0 (upgrade)
- Python 0.25.0 (upgrade)
- Go 0.25.0 (upgrade)
- Rust 0.24.0 (upgrade)
- Swift 0.7.1 (upgrade)

**Total**: 40 languages (90.9%)

**Still Missing** (no npm packages):
- Perl, CMake, Ninja, ProtoBuf, INI, Diff

---

## Recommendation

### ✅ Stay on 0.21.1 and Add 13 Compatible Languages

**Rationale**:
1. **No 0.24.x exists** - Can't use a non-existent version
2. **0.22.4 has risks** - TypeScript breaking changes, moderate value (+6 languages)
3. **0.25.0 is blocked** - C++ compilation issues
4. **0.21.1 is stable** - 95.1% tests passing
5. **Good coverage available** - Can reach 61.4% (27 languages) without upgrade

**Action Plan**:
1. **Immediately**: Add 13 compatible languages
   - JSON, YAML, TOML, XML (config files)
   - Markdown, LaTeX (documentation)
   - Dockerfile, Scala, GraphQL, Lua, R, Elm, CSV
2. **P1**: Revisit upgrade when Node.js LTS compatibility improves
3. **P2**: Upgrade to 0.25.0+ (or whatever version is stable)

---

## Alternative: If CUDA is Critical

If CUDA support is **absolutely critical** for your use case:

### Consider 0.22.4 Upgrade

**Prerequisites**:
- 2-day sprint allocated
- P0 complete
- Dedicated time for TypeScript refactoring

**Steps**:
1. Upgrade to tree-sitter@0.22.4
2. Fix TypeScript `Language` type errors (4-8 hours)
3. Update all 14 parser services
4. Run full test suite
5. Fix runtime errors
6. Test CUDA parser specifically

**Outcome**:
- ✅ CUDA support enabled
- ⚠️ 4-8 hours of refactoring work
- ⚠️ Medium risk of regressions

**When to Consider**: Only if CUDA (GPU programming support) is P0 requirement

---

## Why No 0.23.x or 0.24.x?

The tree-sitter maintainers likely:

1. **Skipped versions** for a major release (0.25.0)
2. **Consolidated changes** instead of incremental releases
3. **Aligned with ecosystem** changes (Node.js, Rust, etc.)

This is **unusual** but not unprecedented in semantic versioning. However, it creates risk:
- Larger API surface changes
- More potential breaking changes
- Harder to bisect issues
- Steeper upgrade path

---

## When to Upgrade in the Future

### Wait for These Signals

**Technical Readiness**:
- [ ] Node.js LTS (v20/v22) confirmed compatible with tree-sitter 0.25+
- [ ] tree-sitter releases 0.25.1+ with build fixes
- [ ] Community reports successful upgrades on macOS + Node.js v25

**Project Readiness**:
- [ ] AutomatosX P0 complete
- [ ] Test pass rate ≥ 99%
- [ ] 2-day sprint available for upgrade work
- [ ] Dedicated time for debugging

**Business Readiness**:
- [ ] Bash/Zsh support becomes P1 requirement
- [ ] CUDA support becomes business priority
- [ ] Customer requests for additional languages

---

## Conclusion

### Key Findings

1. **tree-sitter 0.24.x DOES NOT EXIST** - Version jumps from 0.22.4 → 0.25.0
2. **0.22.4 is possible** but requires TypeScript refactoring (4-8 hours)
3. **0.25.0 is blocked** by C++ compilation errors with Node.js v25
4. **0.21.1 is stable** and supports 27 languages (current 14 + 13 compatible)

### Final Recommendation

**✅ STAY ON 0.21.1**

**Immediate Action**:
- Add 13 compatible languages (JSON, YAML, Markdown, etc.)
- Reach 61.4% coverage (27/44 languages)
- Zero risk, proven pattern

**Future Action** (P1 or later):
- Revisit upgrade when Node.js compatibility improves
- Target 0.25.0+ or whatever version is stable
- Reach 90.9% coverage (40/44 languages)

**Skip 0.22.4**: Not worth the refactoring effort for only 6 additional languages (unless CUDA is critical)

---

## Document Summary

| Question | Answer |
|----------|--------|
| **Does 0.24.x exist?** | ❌ NO - Versions jump 0.22.4 → 0.25.0 |
| **Can we use 0.24.x?** | ❌ NO - Version doesn't exist |
| **Should we upgrade to 0.22.4?** | ⚠️ ONLY IF CUDA IS CRITICAL (requires 4-8h refactoring) |
| **Should we upgrade to 0.25.0?** | ❌ NO - Blocked by C++ compilation errors |
| **What should we do?** | ✅ STAY ON 0.21.1, add 13 compatible languages |
| **When to upgrade?** | P1 or later, when Node.js LTS is compatible |

---

**Document Version**: 1.0
**Created**: 2025-11-08 12:25 PST
**Author**: Claude Code
**Status**: FINAL - No 0.24.x Version Available

---

**See Also**:
- `TREE-SITTER-UPGRADE-ATTEMPT-2025-11-08.md` - Full upgrade attempt report
- `TREE-SITTER-UPGRADE-PLAN-2025-11-08.md` - Original upgrade plan (deferred)
- `LANGUAGE-SUPPORT-TREE-SITTER-0.21.1.md` - Compatible languages analysis
