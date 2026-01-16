# Project Conventions

## Code Style
- Use TypeScript strict mode - null checks required
- Explicit return types required on all functions
- ESM modules: use import/export (not require/module.exports)
- ESM Imports: Always use `.js` extension even for TypeScript files: `import { x } from './y.js'`
- Prefer functional patterns over class-based when appropriate

## Architecture
- Contract-first: all types and schemas in packages/contracts/
- Domain-driven design with packages/core/*/
- Monorepo structure with pnpm workspace
- No circular dependencies between packages
- Standardized output paths for artifacts (PRD/, REPORT/, tmp/)

## Testing
- Use Vitest for unit tests
- Co-locate tests with source: *.test.ts next to implementation
- 80%+ test coverage, test error paths
- Mock external dependencies, not internal modules

## Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for types, classes, and interfaces
- Kebab-case for file names and directories
- Prefix domain packages with -domain (e.g., user-domain)

## Workflow
- Build: `pnpm -r build`
- Test: `vitest run`
- Lint: `eslint .`
- Typecheck: `tsc --build`
- Target specific packages: `pnpm --filter <pkg>`