# Our Code Review Checklist - AutomatosX v5

> Code review checklist for AutomatosX team

## Before Submitting PR

### Code Quality

- [ ] **No `any` types** - All types explicit, use `unknown` if truly unknown
- [ ] **ESM imports** - All imports have `.js` extension
- [ ] **Function size** - Functions <50 lines, extract helpers if needed
- [ ] **Naming** - Clear, descriptive names (no abbreviations)
- [ ] **Comments** - JSDoc for public APIs, inline for complex logic

### Error Handling

- [ ] **Custom errors** - Use AgentValidationError, PathError, etc.
- [ ] **Error context** - Include relevant context in error messages
- [ ] **Try-catch blocks** - Catch and re-throw with context
- [ ] **No silent failures** - All errors logged or thrown

### Security

- [ ] **Path validation** - All file access through PathResolver or WorkspaceManager
- [ ] **Input sanitization** - User inputs sanitized before use
- [ ] **Workspace boundaries** - Writes only to automatosx/PRD or automatosx/tmp (v5.2+)
- [ ] **File size limits** - Check file sizes to prevent DoS
- [ ] **No hardcoded secrets** - Use environment variables

### Testing

- [ ] **Tests added** - New features have tests (unit + integration)
- [ ] **Coverage maintained** - Overall ≥70%, core modules ≥85%
- [ ] **Tests pass** - All 1,149 tests passing
- [ ] **Edge cases** - Test edge cases and error scenarios

### Performance

- [ ] **No bottlenecks** - Profile if adding expensive operations
- [ ] **Lazy loading** - Heavy deps use dynamic import
- [ ] **Caching** - Use TTLCache for expensive operations
- [ ] **Bundle size** - Check `dist/index.js` stays <250KB

### Logging

- [ ] **Structured logging** - Use `logger.info/warn/error` with context
- [ ] **Log levels** - Appropriate log levels (debug/info/warn/error)
- [ ] **No console.log** - Use logger, not console.log

### Git

- [ ] **Conventional commits** - Format: `type(scope): message`
- [ ] **Descriptive message** - Clear what and why
- [ ] **No large files** - No binaries or large files
- [ ] **No sensitive data** - No API keys, passwords, etc.

## Reviewer Checklist

### Code Review

- [ ] **Logic correctness** - Does the code do what it's supposed to?
- [ ] **Type safety** - Are all types correct and complete?
- [ ] **Error handling** - Are errors handled appropriately?
- [ ] **Security** - No security vulnerabilities introduced?

### Architecture

- [ ] **Import hierarchy** - Follows layer architecture (types → utils → core → agents → cli)
- [ ] **Module boundaries** - No circular dependencies
- [ ] **Separation of concerns** - Each module has single responsibility

### Testing

- [ ] **Test quality** - Tests are meaningful and comprehensive
- [ ] **Test coverage** - Coverage meets targets
- [ ] **Mock providers** - Tests use AUTOMATOSX_MOCK_PROVIDERS=true

### Documentation

- [ ] **JSDoc complete** - Public APIs have JSDoc
- [ ] **README updated** - If adding features, update README
- [ ] **CHANGELOG updated** - Add entry to CHANGELOG.md

### Performance & Size

- [ ] **No new large deps** - Check package.json for new dependencies
- [ ] **Bundle size** - Run `npm run build` and check dist/index.js size
- [ ] **Startup time** - CLI startup time reasonable

## Common Patterns

### Type Safety

```typescript
// ❌ Avoid
const data: any = loadData();

// ✅ Prefer
const data: ProfileData = loadProfile(name);
```

### Error Handling

```typescript
// ❌ Avoid: Silent failure
try {
  await task();
} catch (e) { }

// ✅ Prefer: Log and re-throw
try {
  await task();
} catch (error) {
  logger.error('Task failed', {
    task: taskName,
    error: (error as Error).message
  });
  throw error;
}
```

### Security

```typescript
// ❌ Avoid: Path traversal risk
const path = join(root, userInput);

// ✅ Prefer: Validated path
const resolver = new PathResolver({ projectRoot: root });
const path = await resolver.resolve(userInput);
```

### Logging

```typescript
// ❌ Avoid
console.log('Profile loaded');

// ✅ Prefer
logger.info('Profile loaded', {
  name: profileName,
  path: profilePath
});
```

---

**Last Updated:** 2025-10-11
**For:** AutomatosX v5.2+
