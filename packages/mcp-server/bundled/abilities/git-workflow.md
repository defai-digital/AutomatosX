---
abilityId: git-workflow
displayName: Git Workflow
category: engineering
tags: [git, version-control, workflow]
priority: 75
---

# Git Workflow Best Practices

## Branching Strategies

### Git Flow
```
main ─────────────────────────────────────────────
        │                            │
develop ├───────────────────────────────────────
        │           │               │
feature/x──────────│               │
                feature/y─────────│
```

### Trunk-Based Development
```
main ───●───●───●───●───●───●───●───●───
       │   │       │       │
       └─┬─┘       └───┬───┘
     short-lived   feature flags
     branches
```

### Branch Naming
```bash
# Feature branches
feature/user-authentication
feature/JIRA-123-payment-gateway

# Bug fixes
fix/login-redirect-loop
fix/JIRA-456-memory-leak

# Releases
release/1.2.0

# Hotfixes
hotfix/security-patch
```

## Commit Best Practices

### Commit Message Format
```
type(scope): subject

body (optional)

footer (optional)
```

### Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation
- **style**: Formatting (no code change)
- **refactor**: Code restructuring
- **test**: Adding tests
- **chore**: Maintenance tasks

### Examples
```bash
# Good commit messages
feat(auth): add OAuth2 login with Google

Implements OAuth2 flow for Google authentication.
Includes token refresh and session management.

Closes #123

fix(api): handle null response from payment gateway

The payment gateway occasionally returns null instead
of an error object. Added defensive check.

docs(readme): update installation instructions

refactor(users): extract validation logic to separate module

chore(deps): upgrade React to 18.2.0
```

### Atomic Commits
```bash
# BAD - multiple unrelated changes
git commit -m "fix login bug and add new feature and update docs"

# GOOD - separate commits
git commit -m "fix(auth): resolve login redirect loop"
git commit -m "feat(dashboard): add user analytics widget"
git commit -m "docs(api): document rate limiting behavior"
```

## Common Operations

### Feature Development
```bash
# Start feature
git checkout -b feature/new-feature main

# Make changes and commit
git add -p                    # Stage changes interactively
git commit -m "feat: add new feature"

# Keep up to date
git fetch origin
git rebase origin/main

# Push and create PR
git push -u origin feature/new-feature
```

### Interactive Rebase
```bash
# Clean up commits before merge
git rebase -i HEAD~3

# Options:
# pick - keep commit
# reword - change message
# squash - combine with previous
# fixup - combine, discard message
# drop - remove commit
```

### Stashing
```bash
# Save work in progress
git stash push -m "WIP: feature implementation"

# List stashes
git stash list

# Apply and remove
git stash pop

# Apply but keep
git stash apply stash@{0}

# Stash specific files
git stash push -m "WIP" -- file1.js file2.js
```

### Undoing Changes
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Revert a commit (creates new commit)
git revert abc123

# Discard uncommitted changes
git checkout -- file.js
git restore file.js        # newer syntax

# Unstage files
git reset HEAD file.js
git restore --staged file.js
```

### Cherry-Pick
```bash
# Apply specific commit to current branch
git cherry-pick abc123

# Cherry-pick without committing
git cherry-pick --no-commit abc123

# Cherry-pick range
git cherry-pick abc123..def456
```

## Pull Request Guidelines

### Before Opening PR
```bash
# Ensure tests pass
npm test

# Lint code
npm run lint

# Rebase on latest main
git fetch origin
git rebase origin/main

# Squash fixup commits
git rebase -i origin/main
```

### PR Description Template
```markdown
## Summary
Brief description of changes.

## Changes
- Added X
- Modified Y
- Removed Z

## Testing
- [ ] Unit tests pass
- [ ] Manual testing done
- [ ] Edge cases covered

## Screenshots (if applicable)
Before/after screenshots for UI changes.

## Related Issues
Closes #123
```

## Git Configuration

```bash
# User setup
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.st status
git config --global alias.last "log -1 HEAD"
git config --global alias.unstage "reset HEAD --"
git config --global alias.visual "!gitk"

# Default branch
git config --global init.defaultBranch main

# Auto-prune on fetch
git config --global fetch.prune true

# Rebase on pull
git config --global pull.rebase true
```

## Hooks

### Pre-commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit

# Run linter
npm run lint || exit 1

# Run tests
npm test || exit 1

# Check for console.log
if git diff --cached | grep -E '^\+.*console\.log'; then
  echo "Error: console.log found"
  exit 1
fi
```

### Commit-msg Hook
```bash
#!/bin/sh
# .git/hooks/commit-msg

# Enforce conventional commits
if ! head -1 "$1" | grep -qE "^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}"; then
  echo "Invalid commit message format"
  exit 1
fi
```

## Anti-Patterns

- Force pushing to shared branches
- Large, unfocused commits
- Vague commit messages ("fix stuff")
- Long-lived feature branches
- Not pulling before pushing
- Committing sensitive data
- Ignoring merge conflicts
