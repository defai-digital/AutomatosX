# Code Review Workflow

Use AutomatosX agents to perform comprehensive code reviews covering quality, security, and best practices.

---

## Overview

This workflow shows how to use Quality and Security agents to review code systematically before merging to production.

**Time**: ~10-30 minutes
**Agents Used**: Quality → Security → (Optional) Backend/Frontend for fixes
**Result**: Reviewed, improved code ready for merge

---

## When to Use This Workflow

Use this workflow when you:

- ✅ Want to review a pull request before merging
- ✅ Need to check code quality and security
- ✅ Want automated code review feedback
- ✅ Are working solo without human reviewers
- ✅ Want a second opinion on your code

---

## The Workflow

### Step 1: Quality Review

**Goal**: Check code quality, bugs, and best practices

```bash
ax run quality "Review the code in src/api/users.ts

Check for:
- Code quality and readability
- Potential bugs or edge cases
- Performance issues
- Error handling
- Test coverage
- TypeScript type safety
- Documentation completeness

Provide specific improvement suggestions with line numbers."
```

**What Quality Agent Checks**:
- ✅ Code structure and organization
- ✅ Naming conventions
- ✅ Error handling patterns
- ✅ Edge cases and null checks
- ✅ Performance bottlenecks
- ✅ Test coverage gaps
- ✅ Code duplication
- ✅ TypeScript best practices

**Result**: Detailed quality report with actionable feedback

---

### Step 2: Security Audit

**Goal**: Identify security vulnerabilities

```bash
ax run security "Perform security audit of src/api/users.ts

Focus on:
- Input validation
- SQL injection vulnerabilities
- XSS prevention
- Authentication/authorization
- Data encryption
- Sensitive data exposure
- OWASP Top 10 vulnerabilities

Rate each issue by severity (Critical/High/Medium/Low)."
```

**What Security Agent Checks**:
- 🔒 Input sanitization
- 🔒 SQL injection risks
- 🔒 XSS vulnerabilities
- 🔒 Authentication flaws
- 🔒 Authorization bypass
- 🔒 Sensitive data handling
- 🔒 Cryptography usage
- 🔒 Security headers

**Result**: Security audit report with prioritized vulnerabilities

---

### Step 3: Apply Fixes (If Needed)

**Goal**: Address issues found in review

```bash
ax run backend "Fix the issues found in code review:

Quality Issues:
1. Add null checks for user.email on line 45
2. Extract repeated code on lines 78-92 into a helper function
3. Add error handling for database query on line 120

Security Issues:
1. CRITICAL: Add input validation for email parameter
2. HIGH: Use parameterized queries to prevent SQL injection on line 120
3. MEDIUM: Hash password before storing (line 156)

Apply all fixes to src/api/users.ts"
```

**What Happens**:
- Backend agent reads the review feedback
- Applies each fix systematically
- Maintains code structure and style
- Adds comments where needed

**Result**: Fixed code addressing all review feedback

---

### Step 4: Re-Review (Verification)

**Goal**: Verify fixes were applied correctly

```bash
ax run quality "Re-review src/api/users.ts after fixes.

Verify:
- All quality issues from previous review are resolved
- No new issues were introduced
- Code still follows best practices
- Tests still pass

Confirm if code is ready to merge."
```

**Result**: Confirmation that code is production-ready

---

## Complete Example

### Example: Reviewing a Pull Request

```bash
# 1. Quality review
ax run quality "Review all files changed in this PR:
- src/api/users.ts
- src/api/auth.ts
- src/middleware/validate.ts

Check code quality, bugs, and test coverage."

# 2. Security audit
ax run security "Security audit of PR changes:
- src/api/users.ts
- src/api/auth.ts
- src/middleware/validate.ts

Focus on authentication and input validation."

# 3. Fix issues (if any were found)
ax run backend "Apply fixes for issues found in code review..."

# 4. Verify fixes
ax run quality "Re-review to confirm all issues are resolved"
```

---

## Using Iterate Mode for Autonomous Review

For fully autonomous code review with automatic fixes:

```bash
ax run quality "Review src/api/users.ts and delegate fixes to backend agent if needed" --iterate

# Quality agent will:
# 1. Review the code
# 2. If issues found, delegate to backend agent
# 3. Backend agent fixes issues
# 4. Quality agent re-reviews
# 5. Reports final status
```

---

## Review Checklist

Use this checklist when reviewing code:

### Code Quality ✅
- [ ] Code is readable and well-structured
- [ ] Variables and functions have clear names
- [ ] No code duplication
- [ ] Proper error handling
- [ ] Edge cases are handled
- [ ] Performance is acceptable
- [ ] Tests cover main functionality
- [ ] Documentation is complete

### Security 🔒
- [ ] Input is validated and sanitized
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Authentication is secure
- [ ] Authorization is enforced
- [ ] Sensitive data is encrypted
- [ ] Security headers are set
- [ ] Dependencies are up-to-date

### TypeScript Specific 📘
- [ ] Types are properly defined
- [ ] No use of `any` type
- [ ] Null checks are in place
- [ ] Enums used where appropriate
- [ ] Interfaces for complex objects

---

## Tips & Best Practices

### 1. **Review in Layers**

Don't try to check everything at once:

```bash
# Layer 1: Quality
ax run quality "Review for code quality..."

# Layer 2: Security
ax run security "Security audit..."

# Layer 3: Performance (optional)
ax run backend "Analyze performance of..."
```

### 2. **Be Specific**

The more specific your review request, the better:

```bash
# ❌ Vague
ax run quality "Review the code"

# ✅ Specific
ax run quality "Review src/api/users.ts focusing on:
- Error handling in async functions
- Input validation for user email
- Test coverage for edge cases"
```

### 3. **Use File Patterns**

Review multiple files at once:

```bash
ax run quality "Review all TypeScript files in src/api/

Focus on:
- Consistent error handling
- Proper async/await usage
- Input validation"
```

### 4. **Track Review History**

AutomatosX remembers reviews via memory:

```bash
# First review
ax run quality "Review src/api/users.ts"

# Later, check what changed
ax run quality "Compare current src/api/users.ts with the version I reviewed yesterday"
```

### 5. **Combine with Git**

Review git changes directly:

```bash
# Review uncommitted changes
git diff src/api/users.ts > /tmp/changes.diff
ax run quality "Review these code changes: $(cat /tmp/changes.diff)"

# Review PR diff
gh pr diff 123 | ax run quality "Review this pull request diff"
```

---

## Advanced: Multi-File Review

For large pull requests with many files:

```bash
ax run quality "Review this pull request:

Changed files:
- src/api/users.ts
- src/api/auth.ts
- src/api/posts.ts
- src/middleware/auth.ts
- src/models/user.ts

Focus on:
1. Consistency across files
2. Breaking changes
3. Impact on existing functionality
4. Test coverage for new features

Provide a summary of overall code quality." --iterate
```

---

## Troubleshooting

### Issue: Review Too Generic

**Problem**: Agent gives vague feedback

**Solution**: Be more specific about what to check:

```bash
# Instead of:
ax run quality "Review the code"

# Use:
ax run quality "Review src/api/users.ts and check:
1. Is the email validation regex correct?
2. Are there race conditions in the user creation function?
3. Is the password hashing using bcrypt correctly?"
```

### Issue: Missing Security Issues

**Problem**: Security agent doesn't find known vulnerabilities

**Solution**: Explicitly mention what to check:

```bash
ax run security "Audit src/api/users.ts for:
- SQL injection in the getUserById function (line 120)
- XSS in the user profile endpoint (line 200)
- Authentication bypass in the admin check (line 350)"
```

### Issue: Too Many Issues

**Problem**: Review finds hundreds of issues

**Solution**: Prioritize and fix in batches:

```bash
# Step 1: Fix critical security issues
ax run backend "Fix only CRITICAL security issues from the audit"

# Step 2: Fix high-priority quality issues
ax run backend "Fix HIGH priority quality issues"

# Step 3: Address remaining issues
ax run backend "Fix remaining MEDIUM priority issues"
```

---

## Next Steps

After completing code review:

- ✅ All quality issues addressed
- ✅ Security vulnerabilities fixed
- ✅ Code follows best practices
- ✅ Tests are passing
- ✅ Ready to merge!

**What's Next?**

- [Feature Development Workflow](./feature-development.md) - Build features with agents
- [Bug Fixing Workflow](./bug-fixing.md) - Fix bugs systematically
- [Documentation Workflow](./documentation.md) - Document your code

---

## See Also

- [Quality Agent Guide](../agent-guides/quality-agent.md) - Quality agent capabilities
- [Security Agent Guide](../agent-guides/security-agent.md) - Security agent capabilities
- [Multi-Agent Workflows](../user-guide/multi-agent-workflows.md) - Agent collaboration

---

**Happy code reviewing with AutomatosX!** 🔍✨

---

**Version**: 9.0.0
**Last Updated**: 2025-11-18
**Phase 4**: Content Quality - Workflow Guides
