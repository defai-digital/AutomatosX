# Documentation Workflow

Use AutomatosX agents to create high-quality technical documentation.

---

## Overview

Use Writer agent to create API docs, user guides, and technical specifications.

**Time**: ~10-30 minutes per document
**Agents Used**: Writer (+ optional Backend/Frontend for technical details)
**Result**: Clear, comprehensive documentation

---

## The Workflow

### Step 1: API Documentation

```bash
ax run writer "Create API documentation for the authentication endpoints

Include:
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/reset-password
- GET /api/auth/verify-token

For each endpoint document:
- Purpose and description
- Request parameters (with types)
- Response format (success and error)
- Example requests and responses
- Error codes

Save to docs/api/authentication.md"
```

### Step 2: User Guide

```bash
ax run writer "Create a user guide for the authentication feature

Target audience: End users (non-technical)

Include:
- How to create an account
- How to log in
- How to reset password
- Troubleshooting common issues
- Security best practices

Use simple language with screenshots/examples.
Save to docs/user-guide/authentication.md"
```

### Step 3: Technical Specification

```bash
ax run writer "Create technical specification for authentication system

Include:
- Architecture overview
- Security model (JWT, hashing)
- Database schema
- API contracts
- Error handling strategy
- Rate limiting implementation

Target audience: Developers
Save to automatosx/PRD/auth-technical-spec.md"
```

---

## Documentation Types

### API Documentation
- Endpoint reference
- Request/response formats
- Authentication requirements
- Error codes

### User Guides
- Step-by-step instructions
- Screenshots and examples
- Troubleshooting tips
- FAQ

### Technical Specs
- Architecture diagrams
- Design decisions
- Implementation details
- Security considerations

### README Files
- Project overview
- Quick start guide
- Installation instructions
- Links to detailed docs

---

## Tips for Great Documentation

1. **Know Your Audience**: Write for users, not yourself
2. **Show Examples**: Code examples > long explanations
3. **Keep It Current**: Update docs when code changes
4. **Test Examples**: Ensure all code examples actually work
5. **Be Concise**: Shorter is better

---

## See Also

- [Feature Development Workflow](./feature-development.md)
- [Writer Agent Guide](../agent-guides/writer-agent.md)

---

**Version**: 9.0.0 | **Last Updated**: 2025-11-18
