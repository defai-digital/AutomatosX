# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by `pnpm` with TypeScript ESM packages in `packages/*/src`. Key areas: `packages/cli` (CLI entry points), `packages/core` (domain logic), `packages/guard` (governance/validation), `packages/adapters` (integrations), and `packages/mcp-server` (server wiring).
- Shared tests live in `tests/` (unit by domain plus `integration/` flows); package-local specs may also sit beside sources. Built output lands in `dist/` directories and should not be edited manually.
- Docs and product notes are in `docs/` and `PRD/`. Keep generated artifacts out of version control unless explicitly required.

## Build, Test, and Development Commands
- `pnpm install`: sync workspace deps (Node 20+ required).
- `pnpm build`: recursive build for all packages.
- `pnpm typecheck`: workspace TS project references via `tsc --build`.
- `pnpm lint` / `pnpm lint:fix`: ESLint with strict TypeScript configs; fixable issues auto-corrected by `lint:fix`.
- `pnpm test` or `pnpm test:watch`: Vitest suite once or in watch mode.
- `pnpm deps:check`: dependency-cruiser policy check; `pnpm deps:graph` emits `dependency-graph.svg`.
- `pnpm validate`: runs typecheck → lint → deps check → tests; use before opening a PR.

## Coding Style & Naming Conventions
- TypeScript strictness: explicit return types, no `any`, strict boolean expressions; unused args must be prefixed with `_`.
- Prefer small, composable modules; keep side effects at entry points. Use named exports where practical.
- Tests follow `*.test.ts` naming. Keep folder names kebab-case; files should mirror exported symbols where possible (e.g., `routing-engine.ts` → `routing-engine.test.ts`).
- Do not edit generated `dist/` output; changes belong in `src/`.

## Testing Guidelines
- Framework: Vitest. Place domain/unit specs under `tests/<domain>/*.test.ts`; integration flows under `tests/integration/`.
- Target fast, deterministic tests; stub external I/O. Add coverage for new public functions and cross-package contracts.
- Run `pnpm test` locally; add focused checks with `pnpm test --filter <name>` when debugging.

## Commit & Pull Request Guidelines
- Commits: concise, present-tense subject lines; scope tags or versions optional (e.g., `routing: tighten guard validation`, `v13.0.0: ...`). Keep related changes together; avoid drive-by edits.
- PRs: include a clear summary, linked issues, and testing notes (`pnpm validate` output). Add screenshots or CLI traces when behavior changes. Highlight breaking changes and migration steps.
- Small, reviewable diffs are preferred; update docs in `docs/` or `AGENTS.md` when behavior or expectations shift.
