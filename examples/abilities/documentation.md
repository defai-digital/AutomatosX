---
abilityId: documentation
displayName: Documentation Best Practices
category: engineering
tags: [documentation, technical-writing, readme]
priority: 70
---

# Documentation Best Practices

## README Structure

### Essential Sections
```markdown
# Project Name

Brief description of what this project does.

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- Feature 1
- Feature 2
- Feature 3

## Installation

Detailed installation steps...

## Usage

\`\`\`javascript
import { feature } from 'project';
feature.doSomething();
\`\`\`

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DEBUG` | Enable debug | `false` |

## API Reference

Link to API docs or inline reference.

## Contributing

How to contribute to the project.

## License

MIT License
```

## Code Documentation

### JSDoc/TSDoc
```typescript
/**
 * Calculates the total price including tax.
 *
 * @param items - Array of items to calculate
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @returns The total price including tax
 * @throws {ValidationError} If items array is empty
 *
 * @example
 * ```ts
 * const total = calculateTotal([{ price: 100 }], 0.08);
 * // Returns: 108
 * ```
 */
function calculateTotal(items: Item[], taxRate: number): number {
  if (items.length === 0) {
    throw new ValidationError('Items cannot be empty');
  }
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  return subtotal * (1 + taxRate);
}
```

### Interface Documentation
```typescript
/**
 * Configuration options for the HTTP client.
 */
interface HttpClientConfig {
  /**
   * Base URL for all requests.
   * @example "https://api.example.com"
   */
  baseUrl: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Custom headers to include in every request.
   */
  headers?: Record<string, string>;

  /**
   * Retry configuration for failed requests.
   */
  retry?: {
    /** Maximum number of retries */
    maxRetries: number;
    /** Base delay between retries in ms */
    baseDelay: number;
  };
}
```

## API Documentation

### OpenAPI/Swagger
```yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
  description: API for managing users

paths:
  /users:
    get:
      summary: List all users
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'

    post:
      summary: Create a user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserInput'
      responses:
        '201':
          description: User created

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        createdAt:
          type: string
          format: date-time
```

## Architecture Documentation

### Architecture Decision Records (ADRs)
```markdown
# ADR-001: Use PostgreSQL for Primary Database

## Status
Accepted

## Context
We need a database for storing user data and transactions.
Options considered: PostgreSQL, MySQL, MongoDB.

## Decision
We will use PostgreSQL.

## Consequences

### Positive
- Strong ACID compliance
- Excellent JSON support (JSONB)
- Rich ecosystem and tooling
- Good performance for our use case

### Negative
- Slightly more complex than MySQL
- Requires more tuning for very high write loads

## Alternatives Considered

### MySQL
- Rejected: Less powerful JSON support
- Rejected: Weaker constraint enforcement

### MongoDB
- Rejected: Our data is highly relational
- Rejected: Consistency requirements don't fit eventual consistency model
```

### System Diagrams (Mermaid)
```markdown
\`\`\`mermaid
graph TD
    A[Client] --> B[Load Balancer]
    B --> C[API Gateway]
    C --> D[User Service]
    C --> E[Order Service]
    D --> F[(User DB)]
    E --> G[(Order DB)]
    D --> H[Redis Cache]
    E --> H
\`\`\`
```

## Changelog

### Keep a Changelog Format
```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- New feature X

### Changed
- Updated dependency Y

## [1.2.0] - 2024-01-15

### Added
- User authentication (#123)
- Email notifications (#125)

### Fixed
- Memory leak in background worker (#130)

### Security
- Updated crypto library to patch CVE-2024-XXXX

## [1.1.0] - 2024-01-01

### Added
- Initial release
```

## Documentation Principles

### Write for Your Audience
- **Users**: Focus on how to use
- **Contributors**: Focus on how to develop
- **Operators**: Focus on how to deploy/maintain

### Keep It Updated
- Document as you code
- Review docs in PR reviews
- Automate where possible (API docs from code)

### Make It Findable
- Good structure and navigation
- Search functionality
- Cross-references

### Show, Don't Just Tell
- Code examples for every feature
- Diagrams for complex concepts
- Screenshots for UI features

## Anti-Patterns

- Outdated documentation (worse than none)
- Documenting implementation instead of behavior
- No examples
- Wall of text without structure
- Assuming too much knowledge
- Not documenting error cases
