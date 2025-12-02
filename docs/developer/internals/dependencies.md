# NPM Dependencies Analysis - AutomatosX v8.2.0

**Date**: 2025-11-16
**Analyzed**: 822 total dependencies (173 prod, 649 dev)

## 🚨 Security Vulnerabilities

### Critical - Must Fix Immediately

**js-yaml (4.1.0 → 4.1.1)**
- **Severity**: Moderate (CVSS 5.3)
- **Issue**: Prototype pollution in merge (<<) operator
- **CVE**: GHSA-mh29-5h37-fv8m
- **Fix**: `npm update js-yaml` (simple patch update)
- **Risk**: LOW - patch version only
- **Action**: ✅ RECOMMENDED - Update immediately

---

## 📦 Outdated Packages Analysis

### Safe Updates (Patch/Minor - Low Risk)

#### DevDependencies

1. **@types/node (24.7.2 → 24.10.1)**
   - Type definitions update
   - Risk: VERY LOW
   - Action: ✅ Safe to update

2. **@types/yargs (17.0.33 → 17.0.35)**
   - Type definitions update
   - Risk: VERY LOW
   - Action: ✅ Safe to update

3. **tsup (8.5.0 → 8.5.1)**
   - Build tool patch update
   - Risk: LOW
   - Action: ✅ Safe to update

4. **openai (6.7.0 → 6.9.0)**
   - Minor version update
   - Risk: LOW - SDK updates typically backwards compatible
   - Action: ✅ Recommended - test API calls after update

#### Dependencies

5. **inquirer (12.10.0 → 12.11.1)**
   - Current: v12, Latest: v13 (major available)
   - Risk: LOW for 12.11.1, MEDIUM for v13
   - Action: ✅ Update to 12.11.1 (stay on v12 for now)

---

### Major Version Updates (Higher Risk - Need Review)

#### 1. marked (11.2.0 → 17.0.0)
- **Current**: v11.2.0
- **Latest**: v17.0.0 (6 major versions ahead!)
- **Risk**: HIGH - Major API changes likely
- **Breaking Changes**: Unknown without changelog review
- **Impact**: Used for markdown rendering in CLI
- **Action**: ⚠️ HOLD - Review changelog first
- **Recommendation**: Stay on v11 until v8.3.0 refactor

#### 2. marked-terminal (6.2.0 → 7.3.0)
- **Current**: v6.2.0
- **Latest**: v7.3.0 (1 major version ahead)
- **Risk**: MEDIUM - Likely paired with marked upgrade
- **Impact**: Terminal markdown rendering
- **Action**: ⚠️ HOLD - Upgrade with marked
- **Recommendation**: Test thoroughly with v7 before upgrading

#### 3. inquirer (12.10.0 → 13.0.0)
- **Current**: v12.10.0
- **Latest**: v13.0.0 (1 major version ahead)
- **Risk**: MEDIUM - Breaking changes in v13
- **Impact**: Interactive prompts (setup, approval system)
- **Action**: ⚠️ REVIEW - Check v13 changelog
- **Recommendation**: Stay on v12 for stability

#### 4. vitest (3.2.4 → 4.0.9)
- **Current**: v3.2.4
- **Latest**: v4.0.9 (1 major version ahead)
- **Risk**: MEDIUM - Test framework major update
- **Impact**: All 2,325+ tests
- **Action**: ⚠️ REVIEW - Check v4 breaking changes
- **Recommendation**: Major effort - schedule for v8.3.0

#### 5. @vitest/coverage-v8 (3.2.4 → 4.0.9)
- Must update with vitest (paired)
- Same risk/recommendation as vitest

---

## 📊 Update Strategy

### Immediate (v8.2.1 Patch Release)

```bash
# Security fix + safe updates
npm update js-yaml          # 4.1.0 → 4.1.1 (security)
npm update @types/node      # 24.7.2 → 24.10.1
npm update @types/yargs     # 17.0.33 → 17.0.35
npm update tsup            # 8.5.0 → 8.5.1
npm update openai          # 6.7.0 → 6.9.0
npm update inquirer        # 12.10.0 → 12.11.1 (stay on v12)

# Run tests
npm test

# Build and verify
npm run build

# Commit
git add package.json package-lock.json
git commit -m "chore: Update dependencies for security and stability

- Fix js-yaml security vulnerability (GHSA-mh29-5h37-fv8m)
- Update @types/node, @types/yargs, tsup, openai, inquirer
- All updates tested and verified"
```

**Release**: v8.2.1 (patch)
**Risk**: VERY LOW
**Testing**: 30 minutes (run full test suite)

---

### Future (v8.3.0 or later)

Major version updates require significant testing:

#### Phase 1: Testing Framework (v8.3.0-alpha)
```bash
npm install --save-dev vitest@4 @vitest/coverage-v8@4
npm test  # Expect failures, fix compatibility
```
- **Effort**: 2-4 hours
- **Risk**: Test failures, config changes
- **Benefit**: Latest test features, performance

#### Phase 2: Markdown Rendering (v8.3.0-beta)
```bash
npm install marked@17 marked-terminal@7
# Test CLI interactive mode thoroughly
npm run dev -- cli
```
- **Effort**: 1-2 hours
- **Risk**: Rendering differences, ANSI issues
- **Benefit**: Latest markdown features

#### Phase 3: Interactive Prompts (v8.3.0-rc)
```bash
npm install inquirer@13
# Test setup, approval system, all prompts
npm run dev -- setup
```
- **Effort**: 2-3 hours
- **Risk**: Breaking API changes in prompts
- **Benefit**: Better UX features in v13

---

## 🎯 Recommendations

### Do Now (v8.2.1)
1. ✅ **Update js-yaml** - Security fix (required)
2. ✅ **Update safe patches** - Types, tsup, openai
3. ✅ **Test thoroughly** - Run full test suite
4. ✅ **Release v8.2.1** - Patch release

### Schedule for v8.3.0
1. ⏳ **Vitest v4** - Plan 2-4 hours for migration
2. ⏳ **Marked v17** - Review changelog, plan testing
3. ⏳ **Inquirer v13** - Check breaking changes
4. ⏳ **Integration testing** - Full CLI workflow testing

### Monitor
- Watch for security advisories on current versions
- Check changelogs before major updates
- Test in staging before production

---

## 📈 Dependency Health Score

**Overall**: 🟢 GOOD (1 moderate security issue, fixable)

**Security**: 🟡 MODERATE (1 vuln)
**Freshness**: 🟢 GOOD (10 outdated, 5 major)
**Stability**: 🟢 GOOD (stable versions in use)
**Maintenance**: 🟢 GOOD (all packages actively maintained)

---

## 🔒 Security Notes

- **Current vulnerabilities**: 1 moderate (js-yaml)
- **After updates**: 0 known vulnerabilities
- **Dependencies audited**: 822 packages
- **No high/critical issues**: ✅

---

## 📝 Testing Checklist (for v8.2.1)

After updating:

- [ ] `npm test` - All 2,325+ tests pass
- [ ] `npm run build` - Build succeeds
- [ ] `npm run typecheck` - No type errors
- [ ] `ax --version` - CLI works
- [ ] `ax setup` - Setup command works
- [ ] `ax run backend "test"` - Agent execution works
- [ ] `ax cli` - Interactive mode works
- [ ] Markdown rendering - Check CLI output
- [ ] OpenAI integration - Test if using openai package

---

**Generated**: 2025-11-16 by Claude Code
**Next Review**: After v8.2.1 release
