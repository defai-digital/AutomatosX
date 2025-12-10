# AutomatosX Integration Guide (v12.7.x)

Single source for commands, agents, memory, and provider usage. Aligned to current CLI: priority-based routing, no policy/free-tier scoring.

---

## Quick Start

```bash
ax --version
ax setup
ax list agents
ax run backend "create a REST API for user management"
ax memory search "authentication"
ax config --list
```

---

## Agents (bundled examples)

- Development: backend, frontend, fullstack, mobile
- Infrastructure: devops
- Quality/Security: quality, security
- Architecture/Design: architecture, design
- Data/Research: data, data-scientist, researcher
- Product/Leadership: product, cto, ceo
- Content/Marketing: writer, creative-marketer
- Specialized: standard, aerospace-scientist, quantum-engineer

List agents:
```bash
ax list agents
ax agent show backend
```

---

## Core Commands

```bash
ax run <agent> "task"       # Agent execution
ax session <...>            # Create/use/list/show/delete sessions
ax memory <...>             # search/list/export/import/clear/stats
ax providers <list|info|test>
ax config --list            # Show config
ax config --set key --value value
ax bugfix <...>             # Autonomous bug-fix workflow
ax refactor <...>           # Guided refactor workflow
ax spec run <file>          # Run spec
ax gen <plan|dag> <file>    # Generate plan/DAG from spec
ax doctor [provider]        # Diagnostics
ax cleanup [provider]       # Cleanup orphaned processes
```

Global flags: `--debug`, `--quiet`, `--config <path>`, `--provider <name>` (where applicable).

---

## Providers & Routing (current behavior)

- Supported: claude-code, gemini-cli, openai, grok, qwen, glm.
- Routing is priority-based with health checks and fallback.
- No policy-based scoring, workload sizing, or free-tier routing.

Manage providers:
```bash
ax providers list
ax providers info <name>
ax doctor <name>
ax config --set providers.gemini-cli.priority --value 1
```

---

## Memory

- Local SQLite FTS; opt-in saving depending on command/config.
- Common commands:
```bash
ax memory search "topic"
ax memory list --limit 20
ax memory export > backup.json
ax memory import backup.json
ax memory clear --before "2024-01-01"
ax memory stats
```

---

## Sessions

Share context across runs:
```bash
ax session create "feature-x" backend security quality
ax session use feature-x
ax session show feature-x
ax session delete feature-x
```

---

## Diagnostics & Maintenance

```bash
ax doctor              # System check
ax cleanup             # Kill orphaned provider processes
ax cache status        # Cache stats
ax cache clear         # Clear caches
```

---

## What’s Out of Scope (removed/deprecated)

- Policy-driven routing, free-tier prioritization, workload scoring.
- Provider trace/metrics commands not present in CLI.
- Future SDK recommendations beyond existing code.

---

## Version & Tests

- Version: see `package.json` (v12.7.x on this branch).
- Tests: 200+ across unit/integration/smoke. Run `pnpm test` or `pnpm verify`.
