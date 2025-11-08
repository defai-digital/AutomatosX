# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.
Following the open AGENTS.md standard (https://agents.md) for cross-tool compatibility.

---

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
