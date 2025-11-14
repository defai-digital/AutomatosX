# Tree-sitter Upgrade Plan
**Date**: 2025-11-08
**Status**: ⚠️ DEFERRED TO P1 (Upgrade Attempted and Rolled Back)
**Risk**: MEDIUM-HIGH

**UPDATE 2025-11-08 12:13 PST**: Upgrade attempted and rolled back due to critical blockers:
- tree-sitter@0.25.0: C++ compilation errors with Node.js v25
- tree-sitter@0.22.4: TypeScript API breaking changes

See `TREE-SITTER-UPGRADE-ATTEMPT-2025-11-08.md` for full details.

**Current Status**: Staying on tree-sitter@0.21.1 for P0 completion
**Baseline**: 966/1016 tests passing (95.1%)

---

## Executive Summary

Upgrading tree-sitter from **0.21.1 → 0.25.0** to unlock:
- CUDA support (requires 0.22.4)
- CSS support (requires 0.25.0)
- 28+ additional languages from the comprehensive language list
- Latest grammar features and bug fixes

---

## Current State

**tree-sitter**: 0.21.1
**Active Languages**: 14
**Total Grammar Packages**: 13

---

## Upgrade Analysis

### Core Package

| Package | Current | Latest | Change | Risk |
|---------|---------|--------|--------|------|
| tree-sitter | 0.21.1 | 0.25.0 | +4 minor | HIGH |

### Grammar Packages

| Package | Current | Latest | Change | Status |
|---------|---------|--------|--------|--------|
| tree-sitter-c-sharp | 0.21.3 | 0.23.1 | +2 minor | Needs upgrade |
| tree-sitter-cpp | 0.21.0 | 0.23.4 | +2 minor | Needs upgrade |
| tree-sitter-go | 0.21.2 | 0.25.0 | +4 minor | Needs upgrade |
| tree-sitter-java | 0.21.0 | 0.23.5 | +2 minor | Needs upgrade |
| tree-sitter-php | 0.23.9 | 0.24.2 | +1 minor | Needs upgrade |
| tree-sitter-python | 0.21.0 | 0.25.0 | +4 minor | Needs upgrade |
| tree-sitter-ruby | 0.21.0 | 0.23.1 | +2 minor | Needs upgrade |
| tree-sitter-rust | 0.21.0 | 0.24.0 | +3 minor | Needs upgrade |
| tree-sitter-swift | 0.5.0 | 0.7.1 | +2 minor | Needs upgrade |
| @derekstride/tree-sitter-sql | 0.3.11 | 0.3.11 | None | ✅ Up to date |
| tree-sitter-html | 0.23.2 | 0.23.2 | None | ✅ Up to date |
| tree-sitter-kotlin | 0.3.8 | 0.3.8 | None | ✅ Up to date |
| tree-sitter-typescript | 0.23.2 | 0.23.2 | None | ✅ Up to date |

**Packages to Upgrade**: 10 out of 13

---

## Execution Plan

### Phase 1: Pre-Upgrade Safety (30 min)

1. **Backup Current State**
   ```bash
   git add -A
   git commit -m "Backup before tree-sitter upgrade"
   git branch backup-tree-sitter-0.21.1
   ```

2. **Run Full Test Suite (Baseline)**
   ```bash
   npm test 2>&1 | tee baseline-tests.log
   ```

3. **Document Current Pass Rate**
   - Record: X/Y tests passing
   - Identify any pre-existing failures

### Phase 2: Core Upgrade (10 min)

1. **Upgrade tree-sitter**
   ```bash
   npm install tree-sitter@0.25.0 --save
   ```

2. **Verify Installation**
   ```bash
   npm list tree-sitter
   ```

### Phase 3: Grammar Upgrades (20 min)

**Batch 1: Low Risk (Already 0.23+)**
```bash
# These are close to latest, minimal changes
npm install tree-sitter-html@0.23.2 --save     # Already latest
npm install tree-sitter-kotlin@0.3.8 --save    # Already latest
npm install tree-sitter-typescript@0.23.2 --save  # Already latest
npm install @derekstride/tree-sitter-sql@0.3.11 --save  # Already latest
```

**Batch 2: Medium Risk (0.21 → 0.23)**
```bash
npm install tree-sitter-c-sharp@0.23.1 --save
npm install tree-sitter-java@0.23.5 --save
npm install tree-sitter-ruby@0.23.1 --save
```

**Batch 3: Higher Risk (0.21 → 0.24/0.25)**
```bash
npm install tree-sitter-cpp@0.23.4 --save
npm install tree-sitter-go@0.25.0 --save
npm install tree-sitter-python@0.25.0 --save
npm install tree-sitter-rust@0.24.0 --save
npm install tree-sitter-php@0.24.2 --save
```

**Batch 4: Special Case (Swift)**
```bash
npm install tree-sitter-swift@0.7.1 --save
# Note: Swift jumped from 0.5.0 → 0.7.1 (significant change)
```

### Phase 4: Build & Test (45 min)

1. **Clean Build**
   ```bash
   npm run clean
   npm install
   npm run build
   ```

2. **Test Each Parser Individually**
   ```bash
   npm test -- TypeScriptParserService --run
   npm test -- PythonParserService --run
   npm test -- GoParserService --run
   npm test -- JavaParserService --run
   npm test -- RustParserService --run
   npm test -- RubyParserService --run
   npm test -- CSharpParserService --run
   npm test -- CppParserService --run
   npm test -- PhpParserService --run
   npm test -- KotlinParserService --run
   npm test -- SwiftParserService --run
   npm test -- SqlParserService --run
   npm test -- HtmlParserService --run
   npm test -- AssemblyScriptParserService --run
   ```

3. **Full Test Suite**
   ```bash
   npm test 2>&1 | tee post-upgrade-tests.log
   ```

4. **Compare Results**
   ```bash
   diff baseline-tests.log post-upgrade-tests.log
   ```

### Phase 5: Fix Breaking Changes (Variable)

**If tests fail**:

1. **Identify Broken Parsers**
   - Review test output
   - Isolate which parsers have regressions

2. **Common Breaking Changes to Check**:
   - AST node type changes
   - Field name changes
   - Child node structure changes
   - API changes in tree-sitter core

3. **Fix Strategy**:
   - Update extractSymbol() methods
   - Adjust node type matching
   - Update descendantsOfType() calls
   - Fix field access patterns

4. **Re-test After Each Fix**

### Phase 6: Rollback Plan (if needed)

**If upgrade fails**:

```bash
# Rollback to backup branch
git checkout backup-tree-sitter-0.21.1

# Reinstall old dependencies
npm install

# Verify rollback
npm test
```

---

## Success Criteria

### Must Pass

- [ ] All 14 existing language parsers tests passing
- [ ] Build completes without errors
- [ ] No TypeScript compilation errors
- [ ] Performance not degraded (parse times similar)

### Should Pass

- [ ] Test pass rate ≥ current baseline
- [ ] No new warnings introduced
- [ ] All fixtures parse successfully

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AST structure changes | Medium | High | Test each parser individually, fix incrementally |
| API breaking changes | Low | High | Review tree-sitter 0.22-0.25 changelogs |
| Performance degradation | Low | Medium | Benchmark before/after |
| Grammar incompatibilities | Medium | Medium | Upgrade grammars in batches |
| Build failures | Low | High | Clean install, verify deps |

**Overall Risk**: MEDIUM-HIGH (manageable with careful execution)

---

## Timeline

| Phase | Duration | Total |
|-------|----------|-------|
| Pre-Upgrade Safety | 30 min | 0:30 |
| Core Upgrade | 10 min | 0:40 |
| Grammar Upgrades | 20 min | 1:00 |
| Build & Test | 45 min | 1:45 |
| Fix Breaking Changes | 0-120 min | 1:45-3:45 |
| Documentation | 15 min | 2:00-4:00 |

**Estimated Total**: 2-4 hours

---

## Post-Upgrade Benefits

### Immediate Unlocks

1. **CUDA Support** (requires 0.22.4) ✅
   - tree-sitter-cuda@0.20.2
   - GPU programming, AI/ML, HPC

2. **CSS Support** (requires 0.25.0) ✅
   - tree-sitter-css@0.23.2
   - Web styling, front-end development

3. **Improved Grammars**
   - Bug fixes in all upgraded grammars
   - Better AST accuracy
   - Performance improvements

### Future Enables

Can now add **28+ additional languages**:

**Systems & Low-Level**:
- C (tree-sitter-c)
- Objective-C (tree-sitter-objc)
- CUDA (tree-sitter-cuda)

**Scripting & Shell**:
- Bash (tree-sitter-bash)
- Zsh (tree-sitter-zsh)
- Lua (tree-sitter-lua)
- Perl (tree-sitter-perl)

**Data & Config**:
- JSON (tree-sitter-json)
- YAML (tree-sitter-yaml)
- TOML (tree-sitter-toml)
- XML (tree-sitter-xml)
- CSV (tree-sitter-csv)
- INI (tree-sitter-ini)

**Build & DevOps**:
- Dockerfile (tree-sitter-dockerfile)
- Makefile (tree-sitter-make)
- CMake (tree-sitter-cmake)

**Documentation**:
- Markdown (tree-sitter-markdown)
- LaTeX (tree-sitter-latex)

**Query Languages**:
- GraphQL (tree-sitter-graphql)
- ProtoBuf (tree-sitter-proto)

**Functional**:
- Scala (tree-sitter-scala)
- Elm (tree-sitter-elm)
- R (tree-sitter-r)

**Utility**:
- Diff (tree-sitter-diff)
- Regex (tree-sitter-regex)

---

## Decision Points

### Proceed if:
- ✅ Ready to invest 2-4 hours
- ✅ Can handle potential breaking changes
- ✅ Have rollback plan in place
- ✅ Tests are in known good state

### Defer if:
- ❌ Critical production deadline
- ❌ Unstable test baseline
- ❌ No time for debugging
- ❌ Risk tolerance low

---

## Recommendation

✅ **PROCEED WITH UPGRADE**

**Reasons**:
1. Unlocks 30+ additional languages
2. Latest bug fixes and features
3. Better long-term maintenance
4. Current tests are stable (93%+ passing)
5. Good rollback plan in place

**Timing**: Now is ideal - P0 phase nearing completion, before production release

---

**Document Version**: 1.0
**Last Updated**: 2025-11-08
**Author**: AI Technical Analysis
**Status**: READY TO EXECUTE ✅
