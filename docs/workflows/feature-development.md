# Feature Development Workflow

Learn how to use AutomatosX agents to develop a complete feature from design to deployment.

---

## Overview

This workflow demonstrates how multiple specialized agents collaborate to deliver a production-ready feature. We'll build a user authentication system from scratch.

**Time**: ~2-4 hours
**Agents Used**: Product → Backend → Frontend → Quality → Security
**Result**: Fully tested, secure authentication feature

---

## When to Use This Workflow

Use this workflow when you need to:

- ✅ Build a new feature from scratch
- ✅ Coordinate multiple agents for different aspects
- ✅ Ensure quality and security from the start
- ✅ Maintain design documentation throughout

---

## The Workflow

### Step 1: Design with Product Agent

**Goal**: Create a comprehensive feature specification

```bash
ax run product "Design a user authentication system with:
- Email/password login
- JWT token-based sessions
- Password reset flow
- Remember me functionality
- Rate limiting for security

Save the design spec to automatosx/PRD/auth-system-design.md"
```

**What Happens**:
- Product agent (Paris) analyzes requirements
- Creates detailed specification document
- Includes user flows, API contracts, security requirements
- Saves to `automatosx/PRD/auth-system-design.md`

**Result**: Complete design specification ready for implementation

---

### Step 2: Implement Backend with Backend Agent

**Goal**: Build the authentication API

```bash
ax run backend "Implement the authentication system designed in automatosx/PRD/auth-system-design.md

Requirements:
- Read the design spec from automatosx/PRD/auth-system-design.md
- Implement JWT-based authentication
- Add password hashing with bcrypt
- Implement rate limiting middleware
- Create database schema for users
- Add proper error handling

Create all necessary files in src/auth/"
```

**What Happens**:
- Backend agent (Bob) reads the design spec from memory
- Creates authentication routes, middleware, database models
- Implements JWT token generation and validation
- Adds rate limiting and security measures
- Saves code to `src/auth/`

**Result**: Working backend authentication system

---

### Step 3: Build Frontend with Frontend Agent

**Goal**: Create the user interface

```bash
ax run frontend "Create the frontend for the authentication system designed in automatosx/PRD/auth-system-design.md

Requirements:
- Login form with email/password
- Registration form
- Password reset flow
- Token management (localStorage)
- Remember me checkbox
- Error handling and validation
- Responsive design

Use React with TypeScript. Create files in src/components/auth/"
```

**What Happens**:
- Frontend agent (Frank) reads design spec
- Creates React components for login, register, password reset
- Implements form validation
- Adds token storage and retrieval
- Creates responsive, accessible UI
- Saves components to `src/components/auth/`

**Result**: Complete authentication UI

---

### Step 4: Test with Quality Agent

**Goal**: Ensure everything works correctly

```bash
ax run quality "Review and test the authentication system

Tasks:
1. Review backend code in src/auth/ for bugs
2. Review frontend code in src/components/auth/
3. Write unit tests for:
   - JWT token generation/validation
   - Password hashing
   - Rate limiting
   - Login/logout flows
4. Write integration tests for the complete auth flow
5. Check test coverage (target: >90%)

Report any issues found."
```

**What Happens**:
- Quality agent (Queenie) analyzes all code
- Identifies potential bugs or edge cases
- Writes comprehensive test suite
- Runs tests and reports coverage
- Suggests improvements

**Result**: Well-tested, reliable authentication system

---

### Step 5: Security Audit with Security Agent

**Goal**: Verify security best practices

```bash
ax run security "Perform a security audit of the authentication system

Focus areas:
1. JWT token security (secret key, expiration)
2. Password hashing strength
3. SQL injection vulnerabilities
4. XSS prevention
5. CSRF protection
6. Rate limiting effectiveness
7. Session management
8. Error message information leakage

Check code in:
- src/auth/ (backend)
- src/components/auth/ (frontend)

Report any security issues with severity levels."
```

**What Happens**:
- Security agent (Steve) performs comprehensive security review
- Checks for common vulnerabilities (OWASP Top 10)
- Validates JWT implementation
- Reviews password security
- Reports findings with recommendations

**Result**: Security-validated authentication system

---

## Complete Example

Here's the full workflow in one command sequence:

```bash
# Step 1: Design
ax run product "Design user authentication system..."

# Step 2: Implement backend
ax run backend "Implement the auth system from automatosx/PRD/auth-system-design.md..."

# Step 3: Build frontend
ax run frontend "Create frontend for auth system..."

# Step 4: Test
ax run quality "Review and test authentication system..."

# Step 5: Security audit
ax run security "Perform security audit of auth system..."
```

**Total Time**: ~2-4 hours depending on complexity

---

## Tips & Best Practices

### 1. **Use Memory**

Each agent automatically remembers context from previous steps:

```bash
# Later, you can reference the feature:
ax run backend "Add email verification to the authentication system"
# Backend agent remembers the entire auth system design
```

### 2. **Save Design Specs**

Always save design documents to `automatosx/PRD/`:

```bash
"Save the design spec to automatosx/PRD/feature-name.md"
```

This provides a permanent reference for all agents.

### 3. **Iterate on Feedback**

If Quality or Security agents find issues:

```bash
ax run backend "Fix the SQL injection vulnerability found in login endpoint"
ax run quality "Re-test the login endpoint after security fix"
```

### 4. **Run Agents in Iterate Mode**

For complex features, use iterate mode for autonomous execution:

```bash
ax run backend "Implement auth system..." --iterate
```

The agent will work through multiple iterations without manual approval.

### 5. **Use Parallel Execution**

For independent tasks, run agents in parallel:

```bash
# In separate terminals or use --parallel flag
ax run backend "Implement API endpoints" &
ax run frontend "Create UI components" &
```

---

## Variations

### Variation 1: Add Documentation

```bash
ax run writer "Create API documentation for the authentication system

Include:
- API endpoints and parameters
- Request/response examples
- Error codes
- Authentication flow diagrams

Save to docs/api/authentication.md"
```

### Variation 2: Add DevOps

```bash
ax run devops "Set up CI/CD for the authentication feature

Tasks:
- Add automated tests to CI pipeline
- Set up staging environment
- Configure JWT secret in environment variables
- Add deployment scripts

Use GitHub Actions"
```

### Variation 3: Add Monitoring

```bash
ax run backend "Add monitoring and logging to authentication system

Requirements:
- Log all login attempts (success/failure)
- Track rate limiting hits
- Monitor JWT token generation
- Add metrics for Prometheus
- Create alerts for suspicious activity"
```

---

## Troubleshooting

### Issue: Agents Don't Have Context

**Problem**: Agent doesn't know about previous work

**Solution**: Explicitly reference memory or files:

```bash
ax run backend "Read the design from automatosx/PRD/auth-system-design.md and implement..."
```

### Issue: Quality Tests Fail

**Problem**: Tests reveal bugs after implementation

**Solution**: This is expected! Fix iteratively:

```bash
ax run backend "Fix the issues found by quality agent in the test report"
ax run quality "Re-run tests after fixes"
```

### Issue: Security Vulnerabilities Found

**Problem**: Security agent finds critical issues

**Solution**: Always fix security issues before deploying:

```bash
ax run backend "Fix security vulnerabilities: [list issues]"
ax run security "Re-audit after security fixes"
```

---

## Next Steps

After completing this workflow:

- ✅ Feature is designed, implemented, tested, and secured
- ✅ All code is in source control
- ✅ Tests are passing with good coverage
- ✅ Security audit is complete

**What's Next?**

- [Code Review Workflow](./code-review.md) - Have agents review your code
- [Bug Fixing Workflow](./bug-fixing.md) - Fix issues systematically
- [Documentation Workflow](./documentation.md) - Document your feature

---

## See Also

- [Multi-Agent Workflows](../user-guide/multi-agent-workflows.md) - Understanding agent collaboration
- [Spec-Driven Workflows](../advanced/spec-driven-workflows.md) - YAML-based automation
- [Memory System](../user-guide/memory-system.md) - How agents remember context

---

**Happy feature development with AutomatosX!** 🚀

---

**Version**: 9.0.0
**Last Updated**: 2025-11-18
**Phase 4**: Content Quality - Workflow Guides
