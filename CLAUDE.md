# Working with AutomatosX in Claude Code

Use this guide to stay aligned with AutomatosX conventions when coding from Claude Code.

## Quick Start
- Ensure `node --version` returns 20 or newer.
- Run `npm install` after pulling to install dependencies.
- Use `npm run dev -- <command>` to exercise the CLI in watch mode (for example `npm run dev -- status`).
- Build with `npm run build` and resolve type issues with `npm run typecheck` before committing.
- Validate locally with `npm test`; scope with `npm run test:unit`, `npm run test:integration`, or `npm run test:smoke` as needed.

## Workspace Conventions
- `src/cli/`, `src/agents/`, `src/core/`, `src/integrations/`, `src/utils/` — runtime source organized by responsibility; add new code in the matching module.
- `tests/unit/`, `tests/integration/`, `tests/reliability/`, `tests/smoke/` — mirror runtime features with Vitest suites and CLI smokes.
- `docs/` — user-facing documentation; update alongside behavioral changes.
- `automatosx/PRD/` — long-lived product requirements and design notes.
- `automatosx/tmp/` — short-lived drafts and scratch outputs (auto-cleaned).
- `dist/` — generated bundles; never edit by hand.

## Claude Code Workflow
1. Review related specs or docs in `PRD/` or `docs/` before changing code.
2. Modify implementation under `src/` and colocated tests under the matching folder in `tests/`.
3. Use Claude's terminal to run the commands in this guide and keep worktree diffs focused.
4. Document behavioral updates in `docs/` or `README.md` and sync sample configs when adding configuration.

## Essential Commands
### Development
```bash
npm run dev -- list agents
npm run dev -- run backend "hello world"
npm run prebuild:config            # regenerate src/config.generated.ts from automatosx.config.json
```

### Testing
```bash
npm test
npm run test:unit -- memory        # targeted unit suite
npm run test:integration
npm run test:smoke
npm run test:coverage
```

### Quality Checks
```bash
npm run typecheck
npm run tools:check
npm run check:timers
npm run sync:all-versions
```

## Using AutomatosX Agents in Claude Code
- Interact conversationally: “Have the ax backend agent scaffold an authentication API in `src/`.”
- Use slash-style directives when desired: `/ax-agent backend, add CRUD handlers for projects`.
- Inspect available agents with `ax list agents --format table`; search prior context via `ax memory search "keyword"`.
- Manage sessions and checkpoints through CLI helpers such as `ax spec status` or `ax runs list`.

## Architecture Snapshot
- `src/core/router.ts` orchestrates provider routing with automatic failover and usage limits.
- `src/core/memory-manager.ts` maintains the SQLite + FTS5 memory store with optional vector search.
- `src/core/spec/` implements the DAG-based Spec-Kit planner and executor.
- `src/agents/` holds reusable agent behaviors, delegation planning, and context builders.
- `src/providers/` wraps CLI integrations for Claude Code, Gemini CLI, and OpenAI.

## Troubleshooting & Tips
- If `claude` CLI commands fail, check installation or run `ax status` to confirm provider availability.
- Use `npm run test:ci` when validating changes against the CI profile that mirrors GitHub Actions.
- When workspace automation stalls, run `bash tools/cleanup-tmp.sh` or `bash tools/cleanup-prd.sh` to clear stale outputs.
- Keep secrets out of the repository—load required keys via environment variables documented in `docs/configuration.md`.
