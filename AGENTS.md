# Repository Guidelines

## Project Structure & Module Organization
AutomatosX is a TypeScript CLI. Core sources live in `src/`, with the entrypoint at `src/cli/index.ts` and domain folders such as `src/agents`, `src/core`, and `src/providers`. Tests mirror runtime code in `tests/` (unit, integration, e2e, reliability, smoke) with fixtures in `tests/fixtures/`. Schemas and generated config material sit under `schema/`, while runnable demos and scaffolds live in `examples/` and `templates/`. Long-lived product docs belong in `automatosx/PRD/`; temporary artifacts go to `automatosx/tmp/`.

## Build, Test, and Development Commands
- `npm run dev` – Run the CLI with `tsx` for fast local iteration.
- `npm run build` – Produce the distributable via `tsup` and regenerate config stubs; required before releasing.
- `npm run typecheck` – Perform a strict TypeScript pass without emitting JS to catch regressions early.
- `npm run lint` / `npm run lint:fix` – Enforce repo ESLint rules (and optionally auto-fix).
- `npm run test`, `npm run test:unit`, `npm run test:integration`, `npm run test:smoke` – Execute Vitest suites; smoke invokes `tests/smoke/smoke-test.sh`.
- `npm run verify` – Bundles typecheck, build, and unit tests; run prior to any PR.

## Coding Style & Naming Conventions
Use 2-space indentation and keep files ASCII-only unless a module already requires UTF-8 characters. Exported helpers must declare explicit return types, and asynchronous flows should favor `async/await`. Name source files in kebab-case (for example, `vector-store.service.ts`) and colocate tests as `<name>.test.ts` in the matching suite folder. Align formatting with the configured ESLint + `@typescript-eslint` rules and rely on `npm run lint` for enforcement. Route logs through existing utilities (see `src/utils/`) rather than `console`.

## Testing Guidelines
Vitest drives all suites, with coverage tracked through `npm run test:coverage`. Choose the suite that matches scope: unit for pure logic, integration for I/O boundaries, e2e/reliability for orchestrations, and smoke for CLI sanity checks. Mirror feature names in `describe` blocks and prefer deterministic fixtures from `tests/helpers/`. Document skipped tests with TODOs plus an issue link, and block merges until smoke tests pass on the latest branch.

## Commit & Pull Request Guidelines
Follow Conventional Commits (for example, `feat(core): add scheduler hints`) and leverage `npm run commit` if you need scaffolding. Each PR must include: a concise summary, linked issue or PRD reference, a checklist of commands executed (with outcomes), and screenshots or logs when user-facing behavior shifts. Breaking changes require updates to `docs/`, `schema/`, and relevant templates, plus CHANGELOG entries. Avoid force-pushes after reviews unless coordinated with maintainers.

## Security & Configuration Tips
Never store secrets in source files; load them via helpers in `src/utils/env`. Sensitive state for AutomatosX agents resides in `.automatosx/`, and configuration defaults are tracked in `automatosx.config.json`—review changes carefully before publishing. Commands that touch system configurations or networking should run with `ax --debug run ...` only when necessary, and results should be captured in `automatosx/tmp/` if they are transient.
