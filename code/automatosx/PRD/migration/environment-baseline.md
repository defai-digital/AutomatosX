# Migration Environment Baseline (v14)

## Toolchain
- Node.js: `>=20.0.0` (preferred 22.x for development parity)
- pnpm: `9.15.x`
- TypeScript: `~5.7.x`
- ESLint: `~9.16.x`
- Vitest: `~2.1.x`

## Required Scripts
Minimum scripts that must remain available across the v14 workspace:
- `build`
- `test`
- `test:watch`
- `lint`
- `lint:fix`
- `typecheck`

## Repository Conventions
- Monorepo with package boundaries aligned to `packages/*`
- Workspace dependencies via `workspace:*`
- Shared tracing and persistence contracts in domain-level packages
- CLI and MCP execution paths share runtime interfaces

## Dependency Hygiene
- Keep root `pnpm-lock.yaml` updated as the single source of dependency truth
- Keep package-level configs aligned with root TypeScript/Eslint expectations
- Avoid per-package unrelated dependency forks unless required by migration isolation

## Validation (Sprint 1 Baseline)
- Confirm baseline command set works from the repo root before feature work
- Document any temporary overrides in this file with owner + expiry date
