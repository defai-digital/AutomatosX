# Bug Fixing Workflow

Systematically find, fix, and verify bugs using AutomatosX agents.

---

## Overview

Use Quality and Backend agents to identify bugs, implement fixes, and verify solutions.

**Time**: ~15-45 minutes per bug
**Agents Used**: Quality → Backend → Quality (verification)
**Result**: Fixed, tested, verified bug resolution

---

## The Workflow

### Step 1: Find the Bug

```bash
ax run quality "Analyze the bug: users can't log in after password reset

Investigate:
- src/api/auth.ts (login function)
- src/api/users.ts (password reset function)
- src/middleware/auth.ts (token validation)

Find the root cause and explain what's wrong."
```

### Step 2: Implement Fix

```bash
ax run backend "Fix the bug found by quality agent:

Root cause: Password reset generates new JWT but doesn't invalidate old tokens

Solution:
1. Add token versioning to user model
2. Increment version on password reset
3. Check token version during validation

Apply fixes to:
- src/models/user.ts
- src/api/users.ts
- src/middleware/auth.ts"
```

### Step 3: Verify Fix

```bash
ax run quality "Verify the bug fix:

Test scenarios:
1. User resets password
2. Old token should be invalid
3. New token should work
4. Login with new password should succeed

Run tests and confirm bug is resolved."
```

---

## Quick Bug Fix

For simple bugs, use iterate mode:

```bash
ax run quality "Find and fix the bug where email validation fails for valid emails" --iterate
```

Quality agent will:
1. Find the bug
2. Delegate fix to backend agent
3. Verify the fix
4. Report results

---

## See Also

- [Feature Development Workflow](./feature-development.md)
- [Code Review Workflow](./code-review.md)
- [Quality Agent Guide](../agent-guides/quality-agent.md)

---

**Version**: 9.0.0 | **Last Updated**: 2025-11-18
