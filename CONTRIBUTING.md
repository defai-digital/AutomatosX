# Contributing to AutomatosX

Thank you for your interest in contributing to AutomatosX! This document provides
guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing](#testing)

## Code of Conduct

Please be respectful and constructive in all interactions. We're building
something together.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/AutomatosX.git
   cd AutomatosX
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/defai-digital/AutomatosX.git
   ```

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- Git

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Project Structure

```
AutomatosX/
├── packages/
│   ├── schemas/     # Zod schemas and type definitions
│   ├── core/        # Core orchestration engine
│   ├── providers/   # AI provider integrations
│   ├── algorithms/  # Performance-critical algorithms (ReScript)
│   ├── cli/         # Command-line interface
│   └── mcp/         # Model Context Protocol server
├── docs/            # Documentation
└── .github/         # CI/CD workflows
```

### Package Dependencies

```
schemas (base)
    ↓
algorithms ← providers
    ↓           ↓
    └─→ core ←──┘
          ↓
        cli ← mcp
```

## Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the code style guidelines

3. Write or update tests as needed

4. Run the full test suite:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test
   ```

5. Commit your changes following the commit guidelines

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Scopes

- `core`: Changes to @ax/core
- `cli`: Changes to @ax/cli
- `schemas`: Changes to @ax/schemas
- `providers`: Changes to @ax/providers
- `algorithms`: Changes to @ax/algorithms
- `mcp`: Changes to @ax/mcp
- `deps`: Dependency updates
- `ci`: CI/CD changes

### Examples

```
feat(core): Add session checkpoint support

fix(cli): Handle missing config file gracefully

docs(schemas): Update API documentation

refactor(providers): Extract common retry logic
```

## Pull Request Process

1. Update documentation if needed
2. Ensure all tests pass
3. Ensure linting passes
4. Update CHANGELOG.md if applicable
5. Request review from maintainers

### PR Title Format

Use the same format as commit messages:
```
feat(core): Add session checkpoint support
```

### PR Description

Include:
- What changes were made
- Why the changes were needed
- How to test the changes
- Any breaking changes

## Code Style

### TypeScript

- Use strict TypeScript (`strict: true`)
- Prefer `const` over `let`
- Use explicit return types for exported functions
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

### Formatting

Code is automatically formatted with Prettier. Run:
```bash
pnpm format
```

### Linting

ESLint enforces code quality. Run:
```bash
pnpm lint
pnpm lint:fix  # Auto-fix issues
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific package
pnpm --filter @ax/core test
```

### Writing Tests

- Place tests next to the implementation (`file.ts` → `file.test.ts`)
- Use descriptive test names
- Test edge cases and error conditions
- Aim for meaningful coverage, not just high numbers

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';

describe('FeatureName', () => {
  describe('methodName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = methodName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      // ...
    });
  });
});
```

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions or ideas

Thank you for contributing!
