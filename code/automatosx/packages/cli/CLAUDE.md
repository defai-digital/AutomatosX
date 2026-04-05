# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is the `@defai.digital/cli` package — the `ax` binary. See the root [CLAUDE.md](../../CLAUDE.md) for monorepo-wide context.

---

## Commands

```bash
# Build all packages (must run from monorepo root)
npm run build

# Build CLI only
npm run build --workspace=packages/cli

# Run CLI tests only
npm run test:cli              # from monorepo root

# Run a single test file
npx vitest run packages/cli/tests/cli-parser.test.ts

# Type-check the whole workspace
npm run typecheck
```

Tests run via Vitest with `node:sqlite` shimmed out — no build step needed for tests thanks to the root `vitest.config.ts` path aliases.

## Architecture

### Dispatch pipeline

```
main.ts
  → parseCommand(argv)           # cli-parser.ts: extract flags + command name
  → executeParsedCli(parsed)     # index.ts: builtin check → registry lookup → handler()
  → renderCommandResult(result)  # index.ts: text or JSON output
```

If `--iterate` is set, `runIterativeHandler()` in `cli-iterate.ts` wraps the handler in a retry loop with `--max-iterations` / `--max-time` budget.

### Command registration

1. Each command is a standalone function in `src/commands/<name>.ts` with signature `(args: string[], options: CLIOptions) => Promise<CommandResult>`.
2. `command-manifest.ts` imports all handlers and builds `COMMAND_REGISTRY` (name → handler map).
3. `command-metadata.ts` defines usage, description, category (`root | workflow | retained | advanced`), and stability for every command.
4. Workflow commands (`ship`, `architect`, `audit`, `qa`, `release`) are generated via `src/commands/workflows.ts` using catalog entries from shared-runtime.

### Adding a new command

1. Create `src/commands/<name>.ts` exporting an async `<name>Command` function.
2. Re-export from `src/commands/index.ts`.
3. Add entry in `command-manifest.ts` (registry) and `command-metadata.ts` (metadata).
4. Add tests in `tests/`.

### Key modules

| File | Role |
|---|---|
| `cli-parser.ts` | Global flag parsing (`GLOBAL_FLAG_SPECS`). Flags are `--flag value` or `--flag=value`. First positional arg becomes the command name. |
| `types.ts` | `CLIOptions`, `ParsedCommand`, `CommandResult`, `CommandHandler` — core interfaces |
| `workflow-adapter.ts` | Orchestrates workflow commands: input parsing, validation, artifact I/O, dispatch to shared-runtime |
| `utils/formatters.ts` | `createRuntime()` (creates shared-runtime instance), `success()` / `failure()` result builders |
| `utils/command-args.ts` | `parseCommandArgs()` — typed flag parser for individual commands |
| `utils/validation.ts` | JSON input parsing, type coercion helpers (`asString`, `asOptionalInteger`, etc.) |

### Thin-adapter rule

The CLI is a thin adapter over `shared-runtime`. All orchestration logic (workflow execution, provider calls, governance, state) lives in shared-runtime. Commands should create a runtime via `createRuntime(options)` and delegate to it — never duplicate runtime logic here.

### Workflow artifact layout

Workflow commands write artifacts to:
```
.automatosx/workflows/<workflow-id>/<trace-id>/
  ├── manifest.json
  ├── summary.json
  └── artifacts/*.md
```
Status lifecycle: `pending → preview (dry-run) | dispatched (success) | failed`.

## Conventions

- All commands return `CommandResult` — use `success(message, data)` and `failure(message, exitCode)` from `utils/formatters.ts`.
- `--format json` wraps output in `{ success, message, data, exitCode }`.
- Domain types come from `@defai.digital/contracts` — never define domain schemas locally.
- ES modules throughout; imports use `.js` extensions.
- Node >= 22.5.0 required (native `node:sqlite`, `crypto.randomUUID`).
