# Testing Standards Guide

**Version:** 1.0
**Last Updated:** October 30, 2025
**Status:** Active

This document establishes testing standards and best practices for AutomatosX development to ensure code quality, prevent CI/CD failures, and maintain type safety.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Testing Workflow](#testing-workflow)
3. [Test Quality Standards](#test-quality-standards)
4. [Type Safety Requirements](#type-safety-requirements)
5. [Pre-Commit Checklist](#pre-commit-checklist)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [CI/CD Integration](#cicd-integration)

---

## Quick Start

### Essential Commands

```bash
# Verify all quality gates before committing
npm run verify

# Individual checks
npm run typecheck:incremental    # Fast type checking with cache
npm run build                    # Build validation
npm run test:unit                # Unit tests only
npm run test:integration         # Integration tests only
npm run test                     # All tests (unit + integration + smoke)

# Development workflow
npm run test:watch               # Watch mode for TDD
npm run test:coverage            # Generate coverage report
```

### Pre-Commit Flow

**REQUIRED before every commit:**

```bash
npm run verify
```

This command runs:
1. `npm run typecheck:incremental` - Fast type checking with cache
2. `npm run build` - Validates build succeeds
3. `npm run test:unit` - Runs unit test suite

**Why?** Local vitest runs bypass TypeScript type-checking. The pre-commit hook (`npm run typecheck`) catches type errors, but `npm run verify` provides comprehensive validation.

---

## Testing Workflow

### 1. Development Phase

```bash
# Start with watch mode for immediate feedback
npm run test:watch

# In a separate terminal, run type-checking on file save
npm run typecheck -- --watch
```

**Best Practice:** Keep both terminals open during development for instant feedback on both tests and type errors.

### 2. Before Creating PR

```bash
# Run full verification suite
npm run verify

# Optional: Run all test suites including e2e
npm run test:all

# Optional: Check coverage
npm run test:coverage
```

### 3. CI/CD Validation

All PRs must pass:
- ✅ TypeScript compilation (`tsc --noEmit`)
- ✅ Build process (`npm run build`)
- ✅ Unit tests (`npm run test:unit`)
- ✅ Integration tests (`npm run test:integration`)
- ✅ Smoke tests (`npm run test:smoke`)

---

## Test Quality Standards

### 1. Type Safety in Tests

**CRITICAL:** All test files must be type-safe and compile without errors.

#### ❌ Common Type Errors to Avoid

```typescript
// ❌ WRONG: Using constructor without 'new' keyword
const manager = SessionManager({ /* config */ });

// ✅ CORRECT: Use 'new' keyword
const manager = new SessionManager({ /* config */ });

// ❌ WRONG: Missing null assertion for optional properties
const result = data.value.toString();

// ✅ CORRECT: Add null checks or assertions
const result = data.value!.toString();
// OR
const result = data.value ? data.value.toString() : 'default';

// ❌ WRONG: Incorrect method signatures
mockProvider.execute('prompt', { model: 'gpt-4' });

// ✅ CORRECT: Match interface signatures exactly
mockProvider.execute({ prompt: 'prompt', model: 'gpt-4' });
```

#### Required Type Checks

Before committing test files, run:

```bash
npm run typecheck
```

This catches errors that `vitest` alone would miss due to its transpilation approach (esbuild bypasses tsc).

### 2. Test File Organization

```
tests/
├── unit/                   # Pure unit tests (isolated, fast)
│   ├── core/              # Core module tests
│   ├── agents/            # Agent system tests
│   ├── providers/         # Provider tests
│   └── utils/             # Utility tests
├── integration/            # Cross-module integration tests
│   ├── cli-*.test.ts      # CLI integration tests
│   └── run-*.test.ts      # End-to-end workflow tests
├── e2e/                    # End-to-end tests (full workflows)
├── reliability/            # Chaos, concurrency, load tests
└── smoke/                  # Basic smoke tests (bash scripts)
```

### 3. Test Naming Conventions

```typescript
// Test file naming
// Pattern: <module-name>.test.ts OR <feature-name>.integration.test.ts
memory-manager.test.ts        // Unit test
cli-run-parallel.integration.test.ts  // Integration test

// Test suite structure
describe('MemoryManager', () => {
  describe('search()', () => {
    it('should return relevant results for keyword queries', async () => {
      // Test implementation
    });

    it('should handle empty queries gracefully', async () => {
      // Test implementation
    });

    it('should respect limit parameter', async () => {
      // Test implementation
    });
  });
});
```

### 4. Test Coverage Requirements

**Minimum Coverage Targets:**
- Unit tests: ≥80% statement coverage
- Critical paths: ≥95% statement coverage (router, memory, agents)
- New features: ≥80% coverage required for PR approval

```bash
# Generate coverage report
npm run test:coverage

# Coverage thresholds enforced in vitest.config.ts
```

### 5. Mock Best Practices

```typescript
// ❌ WRONG: Incomplete mock (missing required interface members)
const mockProvider = {
  execute: vi.fn()
};

// ✅ CORRECT: Complete mock matching interface
const mockProvider: Provider = {
  name: 'test-provider',
  execute: vi.fn().mockResolvedValue({ /* response */ }),
  capabilities: { streaming: false, embeddings: false },
  version: '1.0.0',
  // ... all required interface members
};

// Use environment variable for mock mode
process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';
```

---

## Type Safety Requirements

### Why TypeScript Type-Checking Matters

**The Problem:**
- Vitest uses esbuild for fast transpilation
- esbuild **bypasses** TypeScript's type-checking
- Tests can pass locally but fail in CI with type errors

**The Solution:**
- Pre-commit hook runs `npm run typecheck` automatically
- Manual verification with `npm run verify` before PR
- Incremental type-checking with `--incremental` flag for speed

### Required TypeScript Strictness

All test files must compile with `strict: true` in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### Type-Checking Workflow

```bash
# Fast incremental type-checking (caches results in tsconfig.tsbuildinfo)
npm run typecheck:incremental

# Full type-checking (slower, no cache)
npm run typecheck

# Type-check only test files
npm run test:typecheck
```

**Performance Note:** Incremental type-checking typically completes in ~2-5 seconds (vs ~15-20 seconds for full type-check).

---

## Pre-Commit Checklist

### Automated Checks (Git Hook)

The `.husky/pre-commit` hook automatically runs:
1. ✅ `npm run typecheck` - Validates all TypeScript files compile
2. ✅ `npm test` - Runs all tests (unit + integration + smoke)

**Do NOT skip the pre-commit hook!** It exists to prevent CI/CD failures.

### Manual Pre-Commit Workflow

For comprehensive validation, run:

```bash
# Recommended: Run before every commit
npm run verify

# This runs:
# 1. npm run typecheck:incremental (fast type check)
# 2. npm run build (validates build process)
# 3. npm run test:unit (validates unit tests)
```

### Pre-PR Checklist

Before creating a pull request:

- [ ] Run `npm run verify` successfully
- [ ] All tests passing locally (including integration tests)
- [ ] No TypeScript errors (`npm run typecheck` passes)
- [ ] Build succeeds (`npm run build` passes)
- [ ] New tests added for new features/fixes
- [ ] Test coverage maintained or improved
- [ ] No TODO comments left in test files
- [ ] All test descriptions are clear and accurate

---

## Common Issues & Solutions

### Issue 1: Tests Pass Locally, Fail in CI with Type Errors

**Symptoms:**
```
CI Error: TS2554: Expected 1 arguments, but got 2.
CI Error: TS2531: Object is possibly 'null'.
```

**Root Cause:** Vitest transpilation bypasses TypeScript type-checking locally.

**Solution:**
```bash
# Always run type-checking before committing
npm run typecheck

# Or use the comprehensive verify command
npm run verify
```

**Prevention:** The pre-commit hook automatically runs type-checking, but you can manually verify with `npm run verify`.

### Issue 2: Pre-Commit Hook Slow

**Symptoms:** Git commit takes 30+ seconds due to pre-commit hook.

**Solution:** Use incremental type-checking:
```bash
# The verify command already uses incremental type-checking
npm run verify

# Manually run incremental type-check
npm run typecheck:incremental
```

**Performance:**
- First run: ~15-20 seconds (builds cache)
- Subsequent runs: ~2-5 seconds (uses cache)

**Note:** `tsconfig.tsbuildinfo` cache file is already in `.gitignore`.

### Issue 3: Test Timeouts in CI

**Symptoms:**
```
Test timeout after 60000ms
```

**Root Cause:** CI environments are slower than local machines.

**Solution:**
```typescript
// Increase timeout for specific slow tests
it('should handle large dataset', async () => {
  // Test implementation
}, 120000); // 120 seconds timeout

// Or increase globally in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 60000
  }
});
```

### Issue 4: Mock Provider Errors

**Symptoms:**
```
Error: OpenAI API key not configured. Set OPENAI_API_KEY environment variable...
```

**Root Cause:** Test environment not properly configured for mock mode.

**Solution:**
```typescript
// Set environment variable in test setup
process.env.AUTOMATOSX_MOCK_PROVIDERS = 'true';

// Or add to vitest.config.ts env section
export default defineConfig({
  test: {
    env: {
      AUTOMATOSX_MOCK_PROVIDERS: 'true'
    }
  }
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

AutomatosX uses GitHub Actions for CI/CD validation:

**On Pull Request:**
- ✅ TypeScript type-checking (`tsc --noEmit`)
- ✅ Build validation (`npm run build`)
- ✅ Unit tests (`npm run test:unit`)
- ✅ Integration tests (`npm run test:integration`)
- ✅ Smoke tests (`npm run test:smoke`)

**On Nightly Schedule:**
- ✅ Full test suite (unit + integration + e2e + reliability)
- ✅ Cross-platform testing (Ubuntu, macOS, Windows)
- ✅ Coverage reporting
- ✅ Stability monitoring

### CI Configuration Files

```
.github/
├── workflows/
│   ├── ci.yml           # PR validation workflow
│   └── nightly.yml      # Nightly comprehensive testing
```

### Local CI Simulation

To run tests exactly as CI does:

```bash
# Use CI-specific configuration
npm run test:ci

# This uses vitest.config.ci.ts with CI-optimized settings
```

---

## Best Practices Summary

### DO ✅

1. **Always run `npm run verify` before committing**
2. **Write type-safe tests** (no any, proper null checks)
3. **Use descriptive test names** (what, not how)
4. **Keep tests isolated** (no shared state between tests)
5. **Mock external dependencies** (providers, file system, network)
6. **Test edge cases** (null, undefined, empty arrays, errors)
7. **Add tests for bug fixes** (regression tests)
8. **Use `AUTOMATOSX_MOCK_PROVIDERS=true`** for integration tests
9. **Check coverage for new features** (`npm run test:coverage`)
10. **Review test output in CI** (don't ignore CI failures)

### DON'T ❌

1. **Don't skip pre-commit hooks** (`--no-verify` is dangerous)
2. **Don't use `any` type in tests** (defeats type safety)
3. **Don't test implementation details** (test behavior, not internals)
4. **Don't leave console.log statements** (use proper assertions)
5. **Don't commit failing tests** (fix or mark as `.skip()`)
6. **Don't ignore type errors** ("it works locally" is not enough)
7. **Don't use real API keys in tests** (always use mocks)
8. **Don't write tests dependent on execution order** (tests must be isolated)
9. **Don't bypass CI checks** (they exist for a reason)
10. **Don't commit TODO comments in tests** (complete or remove)

---

## References

- **Vitest Documentation:** https://vitest.dev/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Testing Best Practices:** See `automatosx/tmp/testing-quality-improvement-plan.md`
- **Coverage Reports:** Run `npm run test:coverage` and open `coverage/index.html`

---

## Support

**Questions or issues with testing?**
- Check this guide first
- Review test examples in `tests/unit/` and `tests/integration/`
- Ask in pull request reviews
- Create issue with `testing` label

---

**Document Version:** 1.0
**Last Updated:** October 30, 2025
**Maintained By:** AutomatosX Team
