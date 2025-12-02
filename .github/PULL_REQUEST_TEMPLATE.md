## Description

<!-- Provide a clear, concise description of what this PR does -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test coverage improvement

## Related Issues

<!-- Link related issues using #issue_number -->
Fixes #
Relates to #

## Testing Checklist

### Pre-Commit Verification

- [ ] Ran `npm run verify` successfully (typecheck + build + unit tests)
- [ ] All pre-commit hooks passed without `--no-verify`
- [ ] No TypeScript errors (`npm run typecheck` passes)
- [ ] ESLint passes (`npm run lint` passes)

### Test Coverage

- [ ] Added/updated unit tests for new/changed code
- [ ] Added/updated integration tests where applicable
- [ ] All tests pass locally (`npm test` passes)
- [ ] Test coverage maintained or improved (check `npm run test:coverage`)

### Type Safety (for test files)

- [ ] Used correct constructor signatures (check TEST_WRITING_STANDARDS.md)
- [ ] Applied non-null assertions (`!`) for array/object access where needed
- [ ] Avoided relying on implicit `any` types
- [ ] Used explicit types for mock return values

### Code Quality

- [ ] Followed existing code style and patterns
- [ ] Updated documentation (README, JSDoc comments, etc.) if needed
- [ ] No console.log/debugger statements in production code
- [ ] Cleaned up commented-out code

## Breaking Changes

<!-- If this is a breaking change, describe what breaks and how to migrate -->

## Additional Notes

<!-- Any additional information, screenshots, performance benchmarks, etc. -->

## Reviewer Checklist

- [ ] Code follows project conventions
- [ ] Tests are comprehensive and meaningful
- [ ] TypeScript types are correct and strict
- [ ] Documentation is updated if needed
- [ ] No security vulnerabilities introduced
