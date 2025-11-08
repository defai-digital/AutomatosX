# Testing Ability

Write comprehensive, maintainable tests for software systems.

## Test Types

1. **Unit Tests** (80% of tests)
   - Test individual functions/methods
   - Mock external dependencies
   - Fast execution (<1ms per test)
   - High coverage (80%+)

2. **Integration Tests** (15% of tests)
   - Test component interactions
   - Use real dependencies when possible
   - Test critical workflows
   - Moderate execution time

3. **End-to-End Tests** (5% of tests)
   - Test complete user workflows
   - Use production-like environment
   - Test critical paths only
   - Slower execution acceptable

## Best Practices

- **Arrange-Act-Assert** pattern
- One assertion per test (when possible)
- Clear test names (describe what is tested)
- Independent tests (no shared state)
- Fast feedback (optimize test speed)

## Test Coverage Goals

- Critical paths: 100%
- Business logic: 90%+
- UI components: 70%+
- Utility functions: 80%+
- Overall project: 80%+

## Testing Anti-Patterns to Avoid

- Testing implementation details
- Brittle tests (break with minor changes)
- Slow tests (block development)
- Flaky tests (non-deterministic)
- No tests (technical debt)
