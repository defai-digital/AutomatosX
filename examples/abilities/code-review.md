---
abilityId: code-review
displayName: Code Review
category: quality
tags: [review, quality, best-practices]
priority: 85
---

# Code Review Best Practices

## Review Checklist

### Functionality
- [ ] Code does what it's supposed to do
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] No obvious bugs or logic errors

### Code Quality
- [ ] Code is readable and self-documenting
- [ ] Functions are focused (single responsibility)
- [ ] No code duplication (DRY principle)
- [ ] Appropriate naming conventions
- [ ] No magic numbers/strings (use constants)

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input is validated and sanitized
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Authentication/authorization is correct

### Performance
- [ ] No obvious performance issues
- [ ] Database queries are optimized
- [ ] No N+1 query problems
- [ ] Appropriate caching where needed
- [ ] No memory leaks

### Testing
- [ ] Tests cover the changes
- [ ] Tests are meaningful (not just coverage)
- [ ] Edge cases are tested
- [ ] Tests are maintainable

### Documentation
- [ ] Complex logic is commented
- [ ] Public APIs are documented
- [ ] README updated if needed
- [ ] Breaking changes documented

## Giving Feedback

### Be Constructive
- Focus on the code, not the person
- Suggest improvements, don't demand
- Explain the "why" behind suggestions
- Acknowledge good code and patterns

### Be Specific
- Point to exact lines or patterns
- Provide examples of preferred approach
- Link to relevant documentation
- Differentiate between blockers and suggestions

### Common Patterns to Flag

**Complexity**
```typescript
// Instead of deeply nested conditions
if (a) {
  if (b) {
    if (c) { ... }
  }
}

// Prefer early returns
if (!a) return;
if (!b) return;
if (!c) return;
// ... main logic
```

**Error Handling**
```typescript
// Instead of silent failures
try { ... } catch (e) { }

// Prefer explicit handling
try { ... } catch (e) {
  logger.error('Operation failed', { error: e });
  throw new OperationError('Failed to process', { cause: e });
}
```

**Type Safety**
```typescript
// Instead of any
function process(data: any) { ... }

// Prefer explicit types
function process(data: ProcessInput): ProcessOutput { ... }
```
