# Conventional Commits Guide

AutomatosX follows the [Conventional Commits](https://www.conventionalcommits.org/) specification.

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (white-space, formatting)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates
- **ci**: CI/CD configuration changes
- **build**: Build system or external dependencies

### Scope (Optional)

The scope could be anything specifying the place of the commit change:
- `agents` - Agent-related changes
- `cli` - CLI commands
- `memory` - Memory management
- `router` - Routing logic
- `providers` - Provider implementations
- `mcp` - MCP server
- `core` - Core functionality
- `tests` - Test infrastructure

### Subject

Short summary (max 100 characters):
- Use imperative, present tense: "add" not "added" nor "adds"
- Don't capitalize first letter
- No period (.) at the end

### Body (Optional)

Provide additional context about the change:
- Explain the motivation for the change
- Contrast with previous behavior
- Use imperative, present tense

### Footer (Optional)

Reference issues or breaking changes:
- `BREAKING CHANGE:` for breaking changes
- `Closes #123` or `Fixes #456` for issue references

## Examples

### Feature

```bash
feat(agents): add delegation depth validation

Implement max delegation depth tracking to prevent infinite delegation loops.
Coordinators (CTO, DevOps, Data Scientist) have depth 3, others have depth 2.

Closes #234
```

### Bug Fix

```bash
fix(router): handle provider timeout correctly

Provider timeout was not being caught properly, causing the fallback chain
to fail. Now wraps provider calls in try-catch and handles timeouts gracefully.
```

### Documentation

```bash
docs: update release process guide

Add section on pre-release workflow for beta/rc versions.
```

### Breaking Change

```bash
feat(router)!: remove deprecated fallback option

BREAKING CHANGE: The `enableFallback` option has been removed.
Use `fallbackChain` instead.

Migration:
- Before: enableFallback: true
- After: fallbackChain: ['codex', 'gemini', 'claude']
```

### Refactoring

```bash
refactor(memory): simplify search query sanitization

Extract sanitization logic into separate function for better testability.
No functional changes.
```

### Performance

```bash
perf(memory): optimize FTS5 search with prepared statements

Use prepared statements for repeated queries, reducing search time by 15%.
```

### Tests

```bash
test(agents): add delegation cycle detection tests

Add test cases for detecting and preventing circular delegation chains.
```

### Chore

```bash
chore(deps): update vitest to v2.1.0

Update test framework to latest version for improved performance.
```

## Using Commitizen

For interactive commit message creation:

```bash
npm run commit
```

This will prompt you for:
1. Type of change
2. Scope (optional)
3. Short description
4. Longer description (optional)
5. Breaking changes (optional)
6. Issues closed (optional)

## Automated Changelog

Commits following this format automatically generate CHANGELOG entries:

```bash
# Create a new release with auto-generated changelog
npm run release

# Specific version bump
npm run release:patch  # 5.3.7 → 5.3.8
npm run release:minor  # 5.3.7 → 5.4.0
npm run release:major  # 5.3.7 → 6.0.0

# Pre-release
npm run release:beta   # 5.3.7 → 5.4.0-beta.0
npm run release:rc     # 5.3.7 → 5.4.0-rc.0
```

## Commit Hooks

Git hooks enforce conventional commits:
- `commit-msg`: Validates commit message format
- Rejects commits that don't follow the convention

### Bypassing Hooks (Not Recommended)

If absolutely necessary:

```bash
git commit --no-verify -m "emergency fix"
```

⚠️ Use sparingly - bypassing hooks defeats the purpose of automation.

## Validating Locally

Test your commit message before committing:

```bash
echo "feat: add new feature" | npx commitlint
# ✓ Valid

echo "invalid message" | npx commitlint
# ✗ Invalid - will show error
```

## Common Mistakes

### ❌ Wrong

```bash
# Capitalized first letter
git commit -m "feat: Add new feature"

# Past tense
git commit -m "feat: added new feature"

# Missing type
git commit -m "add new feature"

# Period at end
git commit -m "feat: add new feature."

# Too long subject (> 100 chars)
git commit -m "feat: this is a very long commit message that exceeds the maximum allowed length of 100 characters"
```

### ✅ Right

```bash
# Correct format
git commit -m "feat: add new feature"

# With scope
git commit -m "feat(agents): add delegation tracking"

# With body
git commit -m "feat: add new feature

This feature implements XYZ functionality that was requested in issue #123."

# Breaking change
git commit -m "feat!: remove deprecated API

BREAKING CHANGE: Removed /api/v1 endpoints. Use /api/v2 instead."
```

## Benefits

1. **Automated Changelog**: Generate CHANGELOG.md automatically
2. **Semantic Versioning**: Determine version bumps automatically
3. **Clear History**: Easy to understand project history
4. **Better Collaboration**: Consistent commit style across team
5. **Tooling Support**: Works with standard-version, semantic-release, etc.

## Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Commitizen](http://commitizen.github.io/cz-cli/)
- [Standard Version](https://github.com/conventional-changelog/standard-version)

## Questions?

If you have questions about conventional commits:
1. Check this guide first
2. Review examples in git history: `git log --oneline`
3. Use commitizen: `npm run commit`
4. Ask in project discussions
