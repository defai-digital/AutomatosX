# AutomatosX OSS

**AI orchestration through MCP - Supercharge your AI coding assistant**

[![Version](https://img.shields.io/badge/version-14.0.0-green.svg)](https://github.com/defai-digital/AutomatosX/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.5.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-BSL--1.1-blue.svg)](LICENSE)

---

## What is AutomatosX?

AutomatosX adds **80+ specialized tools** to your AI coding assistant through MCP (Model Context Protocol). Instead of just chatting with Claude, Gemini, or Codex, you get:

- **28 specialized agents** (fullstack, security, devops, ml-engineer, meta-agents, etc.)
- **Multi-model discussions** (ask Claude AND Gemini AND Grok the same question)
- **Code review with focus areas** (security, performance, architecture)
- **Persistent memory** across sessions
- **Governance gates** to check AI-generated code
- **Execution tracing** for full audit trails
- **Workflow engine** with delegate steps, guard policies, and retry logic
- **SQLite-backed stores** for memory, traces, and state

---

## Quick Start (3 Steps)

```bash
# 1. Install AutomatosX
npm install -g @defai.digital/cli

# 2. Bootstrap your project
cd your-project
ax setup
```

Now use your AI CLI - it has access to all AutomatosX tools.

---

## Using AutomatosX with Your AI CLI

After running `ax setup`, your AI assistant gains access to 80+ new tools. Here's how to use them:

### With Claude Code

```bash
# Start Claude Code in your project
claude

# Now you can use AutomatosX tools in conversation:
```

**Example conversations with Claude:**

```
You: Use ax_agent_recommend to find the best agent for "implement OAuth2 login"

Claude: [Uses ax_agent_recommend tool]
The recommended agent is "security" with 0.85 confidence because...

You: Run that agent with ax_agent_run

Claude: [Uses ax_agent_run tool with agentId: "security"]
Here's the OAuth2 implementation plan...
```

```
You: Use ax_discuss to get multiple AI perspectives on "REST vs GraphQL for mobile app"

Claude: [Uses ax_discuss tool]
After synthesizing perspectives from Claude, Gemini, and Grok:
- REST is recommended for... [consensus summary]
```

```
You: Run ax_review_analyze on src/api/ with focus on security

Claude: [Uses ax_review_analyze tool]
Found 3 security issues:
1. SQL injection risk in users.ts:45...
```

---

### With Gemini CLI

```bash
gemini
```

```
You: I need to build a caching layer. Use ax_agent_run with the architecture agent.

Gemini: [Uses ax_agent_run tool]
Here's a recommended caching architecture...

You: Now use ax_discuss_quick to validate this approach with other models

Gemini: [Uses ax_discuss_quick tool]
Multi-model consensus: The proposed approach is sound, with these refinements...
```

---

### With Codex CLI

```bash
codex
```

```
You: Use ax_agent_list to show me available agents

Codex: [Uses ax_agent_list tool]
Available agents (28 total):
- fullstack: Senior Fullstack Engineer
- backend: Backend Engineer
- security: Security Engineer
- architect: Strategic Technology Leader (meta-agent)
...
```

---

### With Grok (via ax-cli)

```bash
ax-grok
```

```
You: Use ax_guard_check with policy "bugfix" on the files I changed

Grok: [Uses ax_guard_check tool]
Guard check passed: All changes within policy boundaries.
```

---

### With Cursor IDE

Cursor IDE automatically detects the `.cursor/mcp.json` config created by `ax setup`.

1. Run `ax setup` in your project
2. Open the project in Cursor
3. Use AutomatosX tools in Cursor's AI chat

---

## Available MCP Tools (80+ total)

### Agent Tools
| Tool | Description |
|------|-------------|
| `ax_agent_list` | List all specialized agents |
| `ax_agent_run` | Execute an agent with input |
| `ax_agent_get` | Get agent details |
| `ax_agent_recommend` | Find best agent for a task |
| `ax_agent_register` | Create custom agent |
| `ax_agent_remove` | Remove an agent |
| `ax_agent_capabilities` | List all capabilities |

### Discussion Tools
| Tool | Description |
|------|-------------|
| `ax_discuss` | Multi-model discussion with synthesis |
| `ax_discuss_quick` | Quick 2-round consensus |
| `ax_discuss_recursive` | Multi-level recursive discussions with depth control |

### Review Tools
| Tool | Description |
|------|-------------|
| `ax_review_analyze` | Code review with focus (security, performance, architecture, etc.) |
| `ax_review_list` | List recent reviews |

### Guard Tools
| Tool | Description |
|------|-------------|
| `ax_guard_check` | Check changes against policy |
| `ax_guard_list` | List available policies |
| `ax_guard_apply` | Apply policy to session |

### Memory Tools
| Tool | Description |
|------|-------------|
| `ax_memory_store` | Store key-value data |
| `ax_memory_retrieve` | Retrieve stored data |
| `ax_memory_search` | Search memory |
| `ax_memory_list` | List all keys |
| `ax_memory_delete` | Delete a key |

### Session Tools
| Tool | Description |
|------|-------------|
| `ax_session_create` | Create collaboration session |
| `ax_session_join` | Join existing session |
| `ax_session_complete` | Mark session complete |
| `ax_session_status` | Check session status |
| `ax_session_list` | List sessions |
| `ax_session_leave` | Leave a session |
| `ax_session_fail` | Mark session failed |
| `ax_session_close_stuck` | Close stuck sessions |

### Workflow Tools
| Tool | Description |
|------|-------------|
| `ax_workflow_run` | Execute a workflow |
| `ax_workflow_list` | List workflows |
| `ax_workflow_describe` | Get workflow details |

### Trace Tools
| Tool | Description |
|------|-------------|
| `ax_trace_list` | List execution traces |
| `ax_trace_get` | Get trace details |
| `ax_trace_analyze` | Analyze trace for issues |
| `ax_trace_tree` | Get hierarchical trace tree |
| `ax_trace_by_session` | Get traces for a session |
| `ax_trace_close_stuck` | Close stuck traces |

### Scaffold Tools
| Tool | Description |
|------|-------------|
| `ax_scaffold_contract` | Generate Zod schema |
| `ax_scaffold_domain` | Generate domain package |
| `ax_scaffold_guard` | Generate guard policy |

### Config Tools
| Tool | Description |
|------|-------------|
| `ax_config_get` | Get config value |
| `ax_config_set` | Set config value |
| `ax_config_show` | Show full config |

### File System Tools
| Tool | Description |
|------|-------------|
| `ax_file_write` | Write file content |
| `ax_file_exists` | Check if file exists |
| `ax_directory_create` | Create directory |

### Ability Tools
| Tool | Description |
|------|-------------|
| `ax_ability_list` | List available abilities |
| `ax_ability_inject` | Inject abilities into prompt |

### Parallel Execution Tools
| Tool | Description |
|------|-------------|
| `ax_parallel_run` | Execute multiple agents in parallel with DAG dependencies |
| `ax_parallel_plan` | Preview execution plan without running |

### Semantic Search Tools
| Tool | Description |
|------|-------------|
| `ax_semantic_store` | Store content with vector embeddings |
| `ax_semantic_search` | Find similar content by meaning |
| `ax_semantic_get` | Retrieve specific item by key |
| `ax_semantic_list` | List stored items |
| `ax_semantic_delete` | Remove item from store |
| `ax_semantic_stats` | Storage statistics |
| `ax_semantic_clear` | Clear namespace |

### Research Tools
| Tool | Description |
|------|-------------|
| `ax_research_query` | Web search with AI synthesis |
| `ax_research_fetch` | Fetch and extract from URL |
| `ax_research_synthesize` | Combine sources into answer |

### Design Tools
| Tool | Description |
|------|-------------|
| `ax_design_api` | Generate OpenAPI/AsyncAPI specs |
| `ax_design_component` | Create component interface designs |
| `ax_design_schema` | Generate Zod/JSON schemas |
| `ax_design_architecture` | Create architecture diagrams (Mermaid, PlantUML, C4) |
| `ax_design_list` | List design artifacts |

### Git Tools
| Tool | Description |
|------|-------------|
| `ax_git_status` | Repository status |
| `ax_git_diff` | Show file changes |
| `ax_commit_prepare` | Stage files and generate commit message |
| `ax_pr_create` | Create GitHub pull request with AI description |
| `ax_pr_review` | Get PR details for review |

### Feedback Tools
| Tool | Description |
|------|-------------|
| `ax_feedback_submit` | Submit task feedback |
| `ax_feedback_history` | View feedback history |
| `ax_feedback_stats` | Agent feedback statistics |
| `ax_feedback_overview` | System-wide feedback summary |
| `ax_feedback_adjustments` | View score adjustments |

### MCP Ecosystem Tools
| Tool | Description |
|------|-------------|
| `ax_mcp_server_register` | Register external MCP server |
| `ax_mcp_server_list` | List registered servers |
| `ax_mcp_server_unregister` | Remove server registration |
| `ax_mcp_tools_discover` | Discover tools from servers |
| `ax_mcp_tool_invoke` | Call tool on external server |
| `ax_mcp_tools_list` | List discovered tools |

---

## Example Workflows

### 1. Get Multiple AI Perspectives

```
You: Use ax_discuss to analyze "Should we use microservices or monolith for a 5-person startup?"

AI: [Calls ax_discuss with topic and default providers: claude, gemini, grok]

Result: After 2 rounds of discussion, the consensus is:
- Start with a modular monolith (recommended by all 3 models)
- Claude emphasizes: Operational simplicity crucial for small teams
- Gemini adds: Consider service boundaries for future extraction
- Grok suggests: Use feature flags for gradual migration later
```

### 2. Security-Focused Code Review

```
You: Run ax_review_analyze on src/auth/ with focus "security"

AI: [Calls ax_review_analyze with paths: ["src/auth/"], focus: "security"]

Result: Found 2 issues:
1. HIGH: Potential SQL injection in src/auth/login.ts:45
   - User input concatenated directly in query
   - Recommendation: Use parameterized queries

2. MEDIUM: Missing rate limiting on src/auth/reset-password.ts
   - Endpoint vulnerable to brute force
   - Recommendation: Add rate limiting middleware
```

### 3. Find the Right Agent for Your Task

```
You: Use ax_agent_recommend for "set up Kubernetes deployment with auto-scaling"

AI: [Calls ax_agent_recommend with task]

Result:
- Recommended: devops (confidence: 0.92)
- Reason: Task involves K8s, deployment automation, infrastructure
- Alternatives:
  - backend (0.45) - can help with app configuration
  - architecture (0.38) - can review scaling strategy
```

### 4. Execute a Specialized Agent

```
You: Run ax_agent_run with agentId "devops" and input {"query": "Create Kubernetes deployment for Node.js app with HPA"}

AI: [Calls ax_agent_run]

Result: Here's your Kubernetes configuration:
[Agent generates deployment.yaml, service.yaml, hpa.yaml with explanations]
```

### 5. Check Changes Against Policy

```
You: Use ax_guard_check with policy "bugfix" and changedPaths from my git diff

AI: [Calls ax_guard_check with policy: "bugfix", changedPaths: ["src/api/users.ts", "src/utils/validate.ts"]]

Result:
- Status: PASS
- Changed packages: 2 (within limit of 3)
- No forbidden paths modified
- Dependency boundaries respected
```

---

## Available Agents (28)

### Meta-Agents (Dynamic Capability Loading)
| Agent | Expertise | Best For |
|-------|-----------|----------|
| `architect` | System design, tech strategy, product | High-level architecture and planning |
| `auditor` | Security, testing, compliance | Quality and security verification |
| `builder` | Fullstack, backend, frontend, ML | Implementation orchestration |
| `executor` | Task routing, workflow execution | Complex multi-step tasks |
| `operator` | DevOps, MLOps, deployment | Infrastructure and operations |
| `researcher` | Analysis, data science, writing | Research and documentation |
| `reviewer` | Code review, security, quality | Verification and validation |

### Specialist Agents
| Agent | Expertise | Best For |
|-------|-----------|----------|
| `fullstack` | React, Node.js, TypeScript | End-to-end features |
| `backend` | APIs, databases, microservices | Server-side development |
| `frontend` | React, Vue, CSS, accessibility | UI components |
| `architecture` | System design, patterns | Architecture decisions |
| `security` | OWASP, audits, secure coding | Security reviews |
| `devops` | Docker, K8s, CI/CD | Infrastructure |
| `mobile` | React Native, Flutter | Mobile apps |
| `blockchain-developer` | Solidity, DeFi, NFTs | Web3 development |
| `data-scientist` | Python, ML, statistics | Data analysis |
| `ml-engineer` | PyTorch, MLOps | Production ML |
| `mlops-engineer` | ML pipelines, deployment | ML infrastructure |
| `bug-hunter` | Bug detection, edge cases | Proactive bug hunting |
| `cto` | Strategy, leadership | Technical direction |
| `ceo` | Business strategy | Business decisions |
| `product` | Requirements, roadmaps | Product planning |
| `quantum-engineer` | Quantum algorithms | Quantum computing |
| `aerospace-scientist` | Aerospace systems | Aerospace engineering |
| `creative-marketer` | Marketing, content | Marketing campaigns |
| `quality` | Testing, QA | Test planning |
| `writer` | Documentation, API docs | Technical writing |
| `standard` | General assistance | Simple tasks |

---

## CLI Commands

```bash
# System
ax setup                    # Project bootstrap: workspace + MCP integration
ax doctor                   # Check provider health
ax status                   # Runtime status
ax monitor                  # Launch web dashboard

# Direct provider calls
ax call claude "Explain this code"
ax call gemini --file ./src/api.ts "Review this"
ax call --autonomous --goal "refactor auth module" --max-rounds 5

# Agents
ax agent list
ax agent run security --input '{"query": "audit auth"}'

# Review
ax review analyze src/ --focus security
ax review analyze src/ --since main

# Discussion
ax discuss "REST vs GraphQL"

# Guard
ax guard check --policy bugfix --changed-paths src/

# Workflows
ax run <workflow-id>
ax ship --scope <area>
ax architect --request "<requirement>"
ax audit --scope <path-or-area>
ax qa --target <service-or-feature> --url <url>
ax release --release-version <version>

# Traces
ax trace analyze <trace-id>
ax trace by-session <session-id>
ax trace tree <trace-id>

# Other
ax ability list
ax feedback submit
ax iterate <command> --max-iterations 3
ax resume <trace-id>
ax history
ax scaffold contract
ax update
```

---

## Workflow Engine (v14)

v14 ships a full workflow execution engine with support for all step types:

| Step Type | Description |
|-----------|-------------|
| `prompt` | LLM prompt execution |
| `tool` | MCP tool invocation |
| `conditional` | Branch on context values |
| `loop` | Iterate over collections |
| `parallel` | Concurrent step execution |
| `discuss` | Multi-model discussion step |
| `delegate` | Route to a registered agent (with depth + circular guards) |

Workflows are defined as YAML files and executed via `ax run` or `ax_workflow_run`.

---

## Provider Installation

Install at least one AI provider CLI:

| Provider | Command | Installation |
|----------|---------|--------------|
| Claude | `claude` | [Claude Code](https://github.com/anthropics/claude-code) |
| Gemini | `gemini` | [Gemini CLI](https://github.com/google-gemini/gemini-cli) |
| Codex | `codex` | [Codex CLI](https://github.com/openai/codex) |
| Grok | `ax-grok` | [ax-cli](https://github.com/defai-digital/ax-cli) (requires XAI_API_KEY) |
| OpenCode | `opencode` | [OpenCode](https://github.com/opencode-ai/opencode) |

---

## IDE Integration

| IDE | MCP Config Location |
|-----|---------------------|
| [Cursor](https://cursor.com/) | `.cursor/mcp.json` (per-project) |
| [Antigravity](https://antigravity.google) | `~/.gemini/antigravity/mcp_config.json` (global) |

`ax setup` automatically configures MCP for all detected providers and IDEs.

---

## Setup

- **`ax setup`** — Project bootstrap. Detects installed provider CLIs, creates `.automatosx/` in the current directory, writes `AGENTS.md`, and registers the MCP server with detected providers and IDEs.

---

## What's New in v14

- **Monorepo architecture** — Split into focused packages: `contracts`, `workflow-engine`, `shared-runtime`, `state-store`, `trace-store`, `mcp-server`, `monitoring`, `cli`
- **Workflow engine** — Full step type support including `delegate` with depth and circular delegation guards
- **SQLite backends** — Native `node:sqlite` storage for state-store and trace-store (WAL mode, FTS5 full-text search)
- **Unified runtime** — CLI and MCP share a single `shared-runtime`; no duplicated orchestration logic
- **New CLI commands** — `ability`, `feedback`, `history`, `iterate`, `monitor`, `scaffold`, `update`
- **Stronger guards** — Built-in `safe-filesystem` policy; secret leakage detection; prototype pollution protection
- **Legacy MCP aliases** — `ax_*` tool names from v13.5 continue to work

[Full Changelog](CHANGELOG.md)

---

## License

**Business Source License 1.1** - see [LICENSE](LICENSE)

- **Effective starting v13.3.0**: Source-available under BSL 1.1
- **Free for non-production use**: Development, testing, personal projects
- **Free for small production**: Organizations with < $2M annual revenue
- **Commercial license required**: Production use by organizations with >= $2M annual revenue
- **Converts to Apache 2.0**: Four years after each version's release date

For commercial licensing inquiries, contact: licensing@defai.digital

See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for full details

---

[GitHub](https://github.com/defai-digital/AutomatosX) | [Issues](https://github.com/defai-digital/AutomatosX/issues)
