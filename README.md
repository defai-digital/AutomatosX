# AutomatosX

**AI orchestration through MCP - Supercharge your AI coding assistant**

[![Version](https://img.shields.io/badge/version-13.4.11-green.svg)](https://github.com/defai-digital/automatosx/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-BSL--1.1-blue.svg)](LICENSE)

---

## What is AutomatosX?

AutomatosX adds **73+ specialized tools** to your AI coding assistant through MCP (Model Context Protocol). Instead of just chatting with Claude, Gemini, or Codex, you get:

- **28 specialized agents** (fullstack, security, devops, ml-engineer, meta-agents, etc.)
- **Multi-model discussions** (ask Claude AND Gemini AND Grok the same question)
- **Code review with focus areas** (security, performance, architecture)
- **Persistent memory** across sessions
- **Governance gates** to check AI-generated code
- **Execution tracing** for full audit trails
- **Real-time web dashboard** for monitoring (`ax monitor`)

---

## Quick Start (3 Steps)

```bash
# 1. Install AutomatosX
npm install -g @defai.digital/automatosx

# 2. Global setup (one-time)
ax setup

# 3. Initialize your project (registers MCP with your AI CLI)
cd your-project
ax init
```

Now use your AI CLI - it has access to all AutomatosX tools.

---

## Using AutomatosX with Your AI CLI

After running `ax init`, your AI assistant gains access to 73+ new tools. Here's how to use them:

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
# Start Gemini CLI in your project
gemini

# Use AutomatosX tools in conversation:
```

**Example conversations with Gemini:**

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
# Start Codex CLI in your project
codex

# Use AutomatosX tools:
```

**Example:**

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
# Start Grok CLI in your project
ax-grok

# Use AutomatosX tools:
```

**Example:**

```
You: Use ax_guard_check with policy "bugfix" on the files I changed

Grok: [Uses ax_guard_check tool]
Guard check passed: All changes within policy boundaries.
```

---

### With OpenCode

```bash
# Start OpenCode in your project
opencode

# Use AutomatosX tools:
```

---

### With Antigravity

[Google Antigravity](https://antigravity.google) is Google's AI-first IDE (VSCode fork). AutomatosX automatically configures MCP at `~/.gemini/antigravity/mcp_config.json`.

1. Run `ax init` in any project (configures Antigravity globally)
2. Open Antigravity
3. Use AutomatosX tools via the `@` menu or in agent conversations

**Example in Antigravity:**

```
You: @automatosx Use ax_agent_recommend for "implement real-time notifications"

Antigravity: [Uses ax_agent_recommend tool]
Recommended agent: fullstack (confidence: 0.87)
Reason: Task involves frontend, backend, and WebSocket integration...

You: Run ax_discuss_quick on "WebSockets vs Server-Sent Events for notifications"

Antigravity: [Uses ax_discuss_quick tool]
Multi-model consensus: SSE is recommended for this use case because...
```

---

### With Cursor IDE

Cursor IDE automatically detects the `.cursor/mcp.json` config created by `ax init`.

1. Run `ax init` in your project
2. Open the project in Cursor
3. Use AutomatosX tools in Cursor's AI chat

**Example conversations in Cursor:**

```
You: Use ax_agent_recommend to find the best agent for implementing a REST API

Cursor: [Uses ax_agent_recommend tool]
The recommended agent is "backend" with 0.89 confidence...

You: Run ax_review_analyze on my recent changes with focus on security

Cursor: [Uses ax_review_analyze tool]
Found 1 issue: Missing input validation in...
```

---

## Available MCP Tools (73+ total)

After `ax init`, your AI assistant can use these tools:

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

**Review Performance Features:**
- **Smart batching**: Groups files by relevance to focus mode (e.g., auth files first for security reviews)
- **Incremental reviews**: Use `--since <commit>` to only review changed files
- **Provider-aware timeouts**: Automatic timeout calculation based on provider and file count
- **Dependency ordering**: Review files with more dependents first (`--dependency-ordering`)
- **Partial recovery**: Resume failed reviews without losing progress (`enableRecovery`)

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

## Standard Workflow Library

AutomatosX includes a library of reusable workflow templates in `workflows/std/`:

| Workflow | Purpose |
|----------|---------|
| `analysis.yaml` | Code analysis and exploration |
| `code-review.yaml` | Structured code review |
| `debugging.yaml` | Bug investigation and fixing |
| `documentation.yaml` | Documentation generation |
| `implementation.yaml` | Feature implementation |
| `refactoring.yaml` | Code refactoring |
| `testing.yaml` | Test writing and validation |

Use via MCP tools:

```
You: Run ax_workflow_run with workflowId "workflows/std/code-review.yaml"

AI: [Uses ax_workflow_run tool]
Running code review workflow...
```

Or via CLI:

```bash
ax workflow run workflows/std/code-review.yaml
```

---

## CLI Commands (Optional)

You can also use AutomatosX directly from the command line, though MCP integration provides a better experience:

```bash
# System
ax setup                    # Global setup (one-time)
ax init                     # Project initialization (per-project)
ax doctor                   # Check provider health
ax monitor                  # Launch web dashboard

# Direct provider calls (command mode)
ax call claude "Explain this code"
ax call gemini --file ./src/api.ts "Review this"

# Agents
ax agent list               # List agents
ax agent run security --input '{"query": "audit auth"}'

# Review
ax review analyze src/ --focus security
ax review analyze src/ --since main           # Only files changed since main
ax review analyze src/ --dependency-ordering  # Order by dependency graph

# Discussion
ax discuss "REST vs GraphQL"

# Guard
ax guard check --policy bugfix --changed-paths src/
```

---

## Web Dashboard

AutomatosX includes a real-time web dashboard for monitoring AI operations, execution traces, and system health.

### Quick Start

```bash
# Launch dashboard (auto-opens browser)
ax monitor

# Use specific port
ax monitor --port 8080

# Don't auto-open browser
ax monitor --no-open
```

The dashboard runs at `http://localhost:<port>` and is **only accessible from localhost** for security.

### Dashboard Features

#### System Overview
- **Provider Status** - Real-time health and availability of all AI providers (Claude, Gemini, Codex, Grok, etc.)
- **System Metrics** - Memory usage, uptime, active sessions
- **Provider Usage Histogram** - Visual breakdown of provider utilization

#### Execution Stats (Last 200 Records)
- **Total Runs** - Number of executions
- **Success Rate** - Percentage with progress bar
- **Average Duration** - Mean execution time
- **Providers Used** - Count of distinct providers

#### Execution Traces
- **Trace List** - All recent executions with status indicators
- **Command Types** - Visual icons for call (💬), agent (🤖), workflow (⚙), discuss (📞)
- **Status Badges** - Success/failure/running states
- **Provider Badges** - Which AI providers were used
- **Duration & Events** - Timing and event count

#### Trace Details
- **Conversation View** - Chat-style display of prompts and responses
- **Code Block Detection** - Automatic syntax highlighting for code in responses
- **Copy Support** - One-click copy for content and code blocks
- **Timeline View** - Full event timeline with payloads
- **Input/Output** - Complete request/response data

#### Navigation Views
- **Providers** - Detailed provider status and history
- **Agents** - List of specialized agents with execution stats
- **Workflows** - Available workflows and DAG visualization
- **Traces** - Searchable execution history

### Configuration

Configure via `ax config set`:

```bash
# Set port range for auto-selection
ax config set monitor.portMin 3000
ax config set monitor.portMax 3999

# Disable auto-open browser
ax config set monitor.autoOpen false
```

| Config Key | Default | Description |
|------------|---------|-------------|
| `monitor.portMin` | 3000 | Minimum port for auto-selection |
| `monitor.portMax` | 3999 | Maximum port for auto-selection |
| `monitor.autoOpen` | true | Auto-open browser on launch |

### Security

The dashboard implements multiple security layers:

1. **Network Binding** - Server binds to `127.0.0.1` only, blocking external network access
2. **Request Validation** - All requests verified to originate from localhost
3. **CORS Restriction** - Cross-origin requests only allowed from localhost origins
4. **No Authentication** - Since localhost-only, no password required

> **Note**: The dashboard is designed for local development use. It does not support remote access or authentication.

### API Endpoints

The dashboard exposes a REST API at `/api/*`:

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Full system status with providers, agents, traces |
| `GET /api/providers` | Provider health status |
| `GET /api/agents` | List of agents with stats |
| `GET /api/traces` | Recent execution traces (last 200) |
| `GET /api/traces/:id` | Detailed trace with timeline |
| `GET /api/traces/:id/tree` | Hierarchical trace tree |
| `GET /api/traces/search?...` | Search traces by provider/agent/type |
| `GET /api/workflows` | List available workflows |
| `GET /api/workflows/:id` | Workflow definition with DAG |
| `GET /api/sessions` | Active collaboration sessions |
| `GET /api/metrics` | System metrics (memory, uptime) |
| `GET /api/health` | Health check endpoint |
| `GET /api/providers/:id/history` | Provider execution history |
| `GET /api/agents/:id/history` | Agent execution history |

### Auto-Refresh

The dashboard auto-refreshes data every 5 seconds to show real-time updates. No manual refresh needed.

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

AutomatosX also integrates with AI-powered IDEs via MCP:

| IDE | Installation | MCP Config Location |
|-----|--------------|---------------------|
| [Cursor](https://cursor.com/) | Desktop app | `.cursor/mcp.json` (per-project) |
| [Antigravity](https://antigravity.google) | Desktop app | `~/.gemini/antigravity/mcp_config.json` (global) |

`ax init` automatically configures MCP for all detected providers and IDEs.

Verify installation:

```bash
ax doctor
```

---

## Setup vs Init

- **`ax setup`** - Global, one-time setup
  - Detects installed provider CLIs
  - Creates global config at `~/.automatosx/`
  - Run once after installing AutomatosX

- **`ax init`** - Per-project initialization
  - Creates `.automatosx/` in current directory
  - Registers MCP server with all detected provider CLIs
  - Run in each project directory

When switching projects, just run `ax init` in the new project.

---

## What's New

- **Web Dashboard** - Real-time monitoring dashboard for AI operations, execution traces, and system health. Launch with `ax monitor`.

- **IDE Integration** - Now supports [Google Antigravity](https://antigravity.google) and [Cursor](https://cursor.com/) IDEs. Run `ax init` to automatically configure MCP for your IDE.

- **OpenCode Provider** - Added support for [OpenCode](https://github.com/opencode-ai/opencode) as a new AI provider.

[Full Changelog](https://github.com/defai-digital/automatosx/releases)

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

[GitHub](https://github.com/defai-digital/automatosx) | [Documentation](docs/) | [Issues](https://github.com/defai-digital/automatosx/issues)
