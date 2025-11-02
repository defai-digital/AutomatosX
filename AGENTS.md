# AutomatosX Agent Guide

> This document follows the [AGENTS.md open standard](https://agents.md) and is tailored for AI coding assistants collaborating on the AutomatosX repository. Platform-specific variants live in `CLAUDE.md` (Claude Code) and `GEMINI.md` (Gemini CLI).

## Mission
- Understand AutomatosX's TypeScript CLI ecosystem and contribute safely within the existing git worktree.
- Partner with maintainers by documenting assumptions, highlighting risks, and surfacing testing gaps.
- Keep AutomatosX automation agents and human contributors unblocked with clear next steps.

## Environment Essentials
- Commands run through the Codex CLI harness; prefer `["bash","-lc", "<command>"]` and always set the `workdir`.
- Sandbox defaults: workspace-only writes, restricted network. Request elevation only when necessary and justified.
- Avoid destructive git commands (for example, `git reset --hard`) and never revert changes you did not author.
- Prefer `rg`/`rg --files` for search. Avoid `find`/`grep` unless ripgrep is unavailable.
- Use `apply_patch` for targeted edits; do not combine with other tools simultaneously. Reserve auto-generated files for dedicated tooling commands.

## Repository Workflow for AI Assistants
### 1. Initial Analysis
- Clarify the user's intent and check existing context (`README.md`, `AX-GUIDE.md`, issue references).
- Inspect relevant files before editing; keep diffs tight and ASCII-only unless otherwise required.

### 2. Planning
- Create a plan for non-trivial work (more than the simplest ~25%). Never produce single-step plans.
- Update the plan after completing each step to reflect current progress.

### 3. Editing & Coding
- Follow 2-space indentation and explicit return types on exported helpers.
- Route logs through repository utilities and scope new modules under the closest domain folder (`src/agents`, `src/core`, etc.).
- Keep comments concise and purposeful. Avoid boilerplate commentary and redundant explanations.
- When tests or scripts touch directories outside the workspace sandbox, pause and seek approval instead of forcing execution.

### 4. Validation & Handoff
- Run targeted `npm` scripts when feasible; capture the important results in the response rather than dumping full logs.
- If testing cannot be executed, provide clear manual steps so maintainers can verify locally.
- Summaries must lead with the change rationale, then detail modified files and behaviors, ending with suggested follow-ups where appropriate.

## Key Project Directories
- `src/` – TypeScript sources (`src/cli/index.ts` is the CLI entrypoint; domain modules live under `agents/`, `core/`, `providers/`, `mcp/`, `workers/`).
- `tests/` – Vitest suites (`unit`, `integration`, `e2e`, `reliability`, `smoke`) plus fixtures in `tests/fixtures/`.
- `schema/` – Configuration validation schemas; regenerate alongside template updates.
- `examples/` & `templates/` – Runnable scenarios and scaffolding material.
- `automatosx/PRD/` – Long-lived product requirements and design docs.
- `automatosx/tmp/` – Scratch space ignored by git; safe for transient outputs.

## Build, Test, and Verification Commands

| Command | Purpose | Notes |
|---------|---------|-------|
| `npm run dev` | Run the CLI via `tsx` with live TypeScript execution | Ideal for rapid iteration |
| `npm run build` | Regenerate config stubs and bundle with `tsup` | Required before publishing artifacts |
| `npm run typecheck` | Perform TypeScript checks without emitting JS | Use for early failure detection |
| `npm run lint` / `npm run lint:fix` | Lint (or auto-fix) `src/` and `tests/` | Keep style violations out of PRs |
| `npm run test` | Execute full Vitest suite | Combine with filters for focused runs |
| `npm run test:unit` / `:integration` / `:smoke` | Targeted suite execution | Smoke tests call `tests/smoke/smoke-test.sh` |
| `npm run verify` | Run typecheck, build, and unit tests | Mandatory pre-PR checklist |

## Code Style & Naming
- Match ESLint + `@typescript-eslint` configuration; rely on repo lints to confirm compliance.
- Name files in kebab-case (`vector-store.service.ts`); pair tests as `<name>.test.ts` in the matching suite directory.
- Prefer `async/await` and existing utility wrappers for logging, configuration, and environment resolution.
- Never commit secrets; use helpers from `src/utils/` for environment lookups.

## Testing Expectations
- Place tests according to scope: unit (logic), integration (I/O), e2e/reliability (workflow orchestration), smoke (CLI sanity).
- Mirror feature names in `describe` blocks. Mock external services with helpers under `tests/helpers/` for deterministic outcomes.
- Run `npm run test:coverage` before releases. Keep smoke tests green prior to shipping CLI changes.
- Document skipped or pending tests with rationale and follow-up plans.

## Commit & PR Hygiene
- Follow Conventional Commits; use `npm run commit` (Commitizen) for scoped messages (e.g., `feat(core):`, `fix(cli):`).
- PRs should include: summary, linked issue or PRD, test evidence (commands + outcomes), and updated docs when behavior shifts.
- Record breaking config changes in `docs/` and `CHANGELOG.md`; update `schema/` and regenerate templates as needed.

---

<!-- AutomatosX Integration v6.3.8 - Generated 2025-10-31 -->

#

# AutomatosX Integration

This repository uses [AutomatosX](https://github.com/defai-digital/automatosx), an AI agent orchestration platform with persistent memory and multi-agent collaboration.

📚 Comprehensive end-user documentation lives in [AX-GUIDE.md](AX-GUIDE.md).

## Quick Start

```bash
# List available agents
ax list agents

# Run an agent task
ax run <agent-name> "your task description"

# Example: backend automation
ax run backend "create a REST API for user management"

# Search past conversations
ax memory search "keyword"

# Check system status
ax status
```

## Working with AI Assistants

This project follows the [AGENTS.md standard](https://agents.md) for cross-tool compatibility.

- Any AI assistant with shell access can issue `ax` commands; wrap them in `bash -lc` when using the Codex CLI harness.
- For Cursor/Copilot/Codeium/Windsurf style tools, instruct the assistant to run the desired `ax run ...` command verbatim.
- Use AutomatosX agents for parallelized work (e.g., `quality` to draft tests while coding continues).

## Available Agents

| Agent | Persona | Expertise |
|-------|---------|-----------|
| `backend` | Bob | Go, Rust, Python, APIs, databases |
| `frontend` | Frank | React, Next.js, Vue, Swift UI |
| `fullstack` | Felix | Node.js, TypeScript, full-stack web apps |
| `mobile` | Maya | iOS, Android, Flutter, React Native |
| `devops` | Oliver | Kubernetes, Docker, CI/CD, infrastructure |
| `security` | Steve | Security audits, threat modeling, OWASP |
| `quality` | Queenie | Test planning, QA, E2E testing |
| `product` | Paris | Requirements, roadmaps, feature design |
| `writer` | Wendy | Technical writing, API docs, tutorials |
| `standard` | Stan | Best practices, design patterns, code review |

Run `ax list agents --format json` for metadata and availability across providers.

## Workspace Conventions

- `automatosx/PRD/` stores long-lived product and design documents committed to git.
- `automatosx/tmp/` is a scratchpad for drafts, logs, and generated artifacts (auto-cleaned, ignored by git).
- Use `--output` to redirect agent results into either directory depending on permanence requirements.

```bash
# Save planning document
ax run product "Design auth system" --output automatosx/PRD/auth-design.md

# Save temporary draft
ax run backend "Draft implementation" --output automatosx/tmp/draft.ts
```

## Memory System

- All `ax run` executions persist to `.automatosx/memory/memories.db` (SQLite FTS5, private/local).
- Retrieve past insights with `ax memory search "<keywords>"` or list recent sessions via `ax memory list --limit 10`.
- Manage retention: export with `ax memory export > backup.json` or prune via `ax memory clear --before "YYYY-MM-DD"`.

## Common AutomatosX Commands

| Command | Description |
|---------|-------------|
| `ax setup` | Initialize AutomatosX in the current project |
| `ax list agents` | List available agents |
| `ax run <agent> "task"` | Execute an agent task |
| `ax memory search "keyword"` | Search conversation history |
| `ax status` | Check provider/system status |
| `ax config show` | Display current configuration |
| `ax config get <path>` | Read a specific config value |
| `ax agent create my-agent --template developer --interactive` | Scaffold a custom agent |
| `ax --debug run <agent> "task"` | Run with verbose logging |

## Configuration & Troubleshooting

- Primary configuration file: `automatosx.config.json`; view via `ax config show`.
- **Agent not found**: verify case-sensitive names with `ax list agents`.
- **Provider unavailable**: inspect `ax status` and `ax config show` for provider priorities.
- **Memory pressure**: run `ax cache stats` or clear old entries (`ax memory clear --before "2024-01-01"`).
- Enable verbose diagnostics with `ax --debug run <agent> "task"`.

## Additional References

- AutomatosX documentation: https://github.com/defai-digital/automatosx
- NPM package: https://www.npmjs.com/package/@defai.digital/automatosx
- Agent definitions: `.automatosx/agents/`
- Memory database: `.automatosx/memory/memories.db`
- Platform-specific guides: `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI)


# List available agents
ax list agents

# Run an agent task
ax run <agent-name> "your task description"

# Example: backend automation
ax run backend "create a REST API for user management"

# Search past conversations
ax memory search "keyword"

# Check system status
ax status
```

### Working with AI Assistants
- Any AI assistant with shell access can issue `ax` commands; wrap them in `bash -lc` when using the Codex CLI harness.
- For Cursor/Copilot/Codeium style tools, instruct the assistant to run the desired `ax run ...` command verbatim.
- Use AutomatosX agents for parallelized work (e.g., `quality` to draft tests while coding continues).

### Available Agents

| Agent | Persona | Expertise |
|-------|---------|-----------|
| `backend` | Bob | Go, Rust, Python, APIs, databases |
| `frontend` | Frank | React, Next.js, Vue, Swift UI |
| `fullstack` | Felix | Node.js, TypeScript, full-stack web apps |
| `mobile` | Maya | iOS, Android, Flutter, React Native |
| `devops` | Oliver | Kubernetes, Docker, CI/CD, infrastructure |
| `security` | Steve | Security audits, threat modeling, OWASP |
| `quality` | Queenie | Test planning, QA, E2E testing |
| `product` | Paris | Requirements, roadmaps, feature design |
| `writer` | Wendy | Technical writing, API docs, tutorials |
| `standard` | Stan | Best practices, design patterns, code review |

Run `ax list agents --format json` for metadata and availability across providers.

### Workspace Conventions
- `automatosx/PRD/` stores long-lived product and design documents committed to git.
- `automatosx/tmp/` is a scratchpad for drafts, logs, and generated artifacts (auto-cleaned, ignored by git).
- Use `--output` to redirect agent results into either directory depending on permanence requirements.

```bash
# Save planning document
ax run product "Design auth system" --output automatosx/PRD/auth-design.md

# Save temporary draft
ax run backend "Draft implementation" --output automatosx/tmp/draft.ts
```

### Memory System
- All `ax run` executions persist to `.automatosx/memory/memories.db` (SQLite FTS5, private/local).
- Retrieve past insights with `ax memory search "<keywords>"` or list recent sessions via `ax memory list --limit 10`.
- Manage retention: export with `ax memory export > backup.json` or prune via `ax memory clear --before "YYYY-MM-DD"`.

### Common AutomatosX Commands

| Command | Description |
|---------|-------------|
| `ax init` | Initialize AutomatosX in the current project |
| `ax list agents` | List available agents |
| `ax run <agent> "task"` | Execute an agent task |
| `ax memory search "keyword"` | Search conversation history |
| `ax status` | Check provider/system status |
| `ax config show` | Display current configuration |
| `ax config get <path>` | Read a specific config value |
| `ax agent create my-agent --template developer --interactive` | Scaffold a custom agent |
| `ax --debug run <agent> "task"` | Run with verbose logging |

### Configuration & Troubleshooting
- Primary configuration file: `automatosx.config.json`; view via `ax config show`.
- **Agent not found**: verify case-sensitive names with `ax list agents`.
- **Provider unavailable**: inspect `ax status` and `ax config show` for provider priorities.
- **Memory pressure**: run `ax cache stats` or clear old entries (`ax memory clear --before "2024-01-01"`).
- Enable verbose diagnostics with `ax --debug run <agent> "task"`.

### Additional References
- AutomatosX documentation: https://github.com/defai-digital/automatosx
- NPM package: https://www.npmjs.com/package/@defai.digital/automatosx
- Agent definitions: `.automatosx/agents/`
- Memory database: `.automatosx/memory/memories.db`
- Platform-specific guides: `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI)
