# Project Conventions

This file documents the coding conventions and patterns for this project.
Place this file in `.automatosx/context/` to inject it into AI agent prompts.

## Code Style

### TypeScript
- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit return types for exported functions
- Use interfaces over type aliases for object shapes

### Naming
- Use camelCase for variables and functions
- Use PascalCase for classes and interfaces
- Use UPPER_SNAKE_CASE for constants
- Use kebab-case for file names

### Imports
- Group imports: external, internal, relative
- Use explicit imports (no barrel imports in core code)
- Prefer named exports over default exports

## Architecture

### Package Structure
- `packages/contracts/` - Zod schemas, types, validation
- `packages/core/*/` - Domain logic (no I/O)
- `packages/adapters/*/` - External integrations
- `packages/cli/` - Command-line interface

### Domain Patterns
- Contract-first: define schemas before implementation
- Ports and adapters: isolate I/O from domain logic
- Invariants: document with INV-* comments

### Error Handling
- Use typed error classes with error codes
- Never swallow errors silently
- Include context in error messages

## Testing

### Structure
- Co-locate tests: `*.test.ts` next to source
- Use vitest for all tests
- Mock at boundaries (adapters), not internally

### Coverage
- Contracts: 100% schema validation
- Domain: >80% logic coverage
- Integration: key user flows

## Git Conventions

### Commits
- Use conventional commits: feat, fix, docs, refactor, test, chore
- Keep commits atomic and focused
- Include issue reference when applicable

### Branches
- `main` - production ready
- `feat/*` - new features
- `fix/*` - bug fixes
