# Code Generation

Generate high-quality, production-ready code following best practices and patterns.

## Core Principles

### 1. Type Safety & Validation
- Use strong typing (TypeScript interfaces, Python type hints)
- Validate inputs before processing
- Define clear return types
- Use enums for fixed value sets

### 2. Error Handling
- Use try-catch for I/O operations
- Provide specific error messages with context
- Log errors appropriately
- Never swallow errors silently
- Return typed error objects or throw typed exceptions

### 3. Function Design
- Single responsibility per function
- Clear, descriptive names
- Document complex logic with comments
- Keep functions small (<50 lines)
- Minimize side effects

### 4. API Design
- RESTful conventions (GET/POST/PUT/DELETE)
- Consistent response formats
- Proper HTTP status codes
- Request/response validation
- API versioning when needed

### 5. Testing
- Write unit tests for business logic
- Test error cases and edge conditions
- Use descriptive test names
- Aim for >80% coverage on critical paths
- Mock external dependencies

### 6. Code Quality
- Follow project coding standards
- Use linting and formatting tools
- Write self-documenting code
- Keep complexity low (cyclomatic complexity <10)
- Remove dead code and TODOs

### 7. Security
- Validate and sanitize all inputs
- Use parameterized queries (prevent SQL injection)
- Never log sensitive data
- Follow principle of least privilege
- Keep dependencies updated

### 8. Performance
- Avoid N+1 queries
- Use appropriate data structures
- Cache when beneficial
- Lazy load when possible
- Profile before optimizing

## Language-Specific Patterns

### TypeScript/JavaScript
- Async/await for promises
- Optional chaining (?.) and nullish coalescing (??)
- Destructuring for cleaner code
- Use const by default, let when needed
- Avoid var

### Python
- Type hints for function signatures
- List/dict comprehensions for data transformation
- Context managers (with statement) for resources
- Follow PEP 8 style guide
- Use dataclasses for data models

### SQL
- Use indexes on frequently queried columns
- Avoid SELECT *
- Use JOINs efficiently
- Parameterize queries
- Use transactions for multi-step operations

## Quick Checklist

Before submitting code:
- [ ] Types and interfaces defined
- [ ] Error handling implemented
- [ ] Input validation added
- [ ] Tests written and passing
- [ ] Code formatted and linted
- [ ] No console.log/print in production code
- [ ] Security considerations addressed
- [ ] Performance optimized where needed
