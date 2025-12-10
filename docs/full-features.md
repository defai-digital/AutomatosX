# AutomatosX CLI Reference (v12.7.x)

This guide lists the current AutomatosX CLI surface area and supported capabilities. It reflects the shipped code (priority-based provider routing; no policy/free-tier routing).

---

## Core Commands

```bash
ax setup                # Initialize .automatosx workspace
ax run <agent> "task"   # Run an agent task
ax session <...>        # Create/use/list/end sessions
ax memory <...>         # Search/list/export/import/clear memory
ax providers <...>      # List/info/test providers
ax config <...>         # Show/set config values
ax gen <plan|dag> ...   # Plan/DAG from spec
ax spec run <file>      # Execute spec-driven workflow
ax bugfix <...>         # Autonomous bug-fixing workflow
ax refactor <...>       # Guided refactoring workflow
ax doctor [provider]    # Diagnostics
ax cleanup [provider]   # Cleanup orphaned processes
ax cache <status|clear> # Cache commands
ax list <agents|abilities|providers>
```

### Global options (common)
- `--debug` / `--quiet`
- `--config <path>`
- `--provider <name>` where supported

---

## Agents (examples bundled in `examples/agents/`)

- backend, frontend, fullstack, mobile
- devops, security, quality, architecture, design
- data, data-scientist, researcher
- product, cto, ceo, writer, creative-marketer, standard, aerospace-scientist, quantum-engineer

Use `ax list agents` or `ax agent show <name>` for details.

---

## Provider Support

Priority-based fallback routing; no cost/policy/free-tier routing. Supported providers (per codebase):
- claude-code
- gemini-cli
- openai
- grok
- qwen
- glm

Check status:
```bash
ax providers list
ax providers info <name>
ax doctor <name>
```

Set provider priority in `ax.config.json` or via `ax config`.

---

## Memory Commands

```bash
ax memory search "keyword"
ax memory list --limit 20
ax memory export > backup.json
ax memory import backup.json
ax memory clear --before "2024-01-01"
ax memory stats
```

Memory is local SQLite FTS; saving behavior depends on command mode and config.

---

## Sessions

```bash
ax session create "feature-x" backend security quality
ax session use feature-x
ax session list
ax session show feature-x
ax session delete feature-x
```

Sessions share memory/context across agent runs.

---

## Workflows & Specs

```bash
ax spec run examples/specs/automatosx-release.ax.yaml
ax gen plan workflow.ax.yaml
ax gen dag workflow.ax.yaml
```

Spec execution is sequential/parallel per spec; review generated plans before long runs.

---

## Bugfix & Refactor Tools

- `ax bugfix` — autonomous bug-fixing with typecheck/tests (configurable).
- `ax refactor` — guided refactoring (focus areas: dead_code, type_safety, conditionals, etc.).

Run `--help` on each for available flags.

---

## Configuration

Show config:
```bash
ax config --list
```

Set values:
```bash
ax config --set providers.claude-code.apiKey --value "key"
ax config --set router.fallbackEnabled --value true
```

Routing: priority-based fallback only (`src/core/router/router.ts`); no policy or free-tier scoring.

---

## Diagnostics & Maintenance

```bash
ax doctor              # System check
ax cleanup             # Clean orphaned processes
ax cache status        # Cache stats
ax cache clear         # Clear caches
```

---

## What’s Not Supported (to avoid confusion)
- Free-tier prioritization or policy-driven routing (removed in v8.3.0).
- Provider trace/metrics commands described in older docs.
- Future SDK additions for GLM/Grok beyond current implementation.

---

## Version & Tests
- Version: see `package.json` (current branch uses v12.7.x).
- Tests: 200+ across unit/integration/smoke; run `pnpm test`, `pnpm verify`, or focused suites.
