# AutomatosX

**AI orchestration through MCP - Supercharge your AI coding assistant**

[![Version](https://img.shields.io/badge/version-13.2.7-green.svg)](https://github.com/defai-digital/automatosx/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-blue.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-BSL--1.1-blue.svg)](LICENSE)

---

## What is AutomatosX?

AutomatosX adds **44 specialized tools** to your AI coding assistant through MCP (Model Context Protocol). Instead of just chatting with Claude, Gemini, or Codex, you get:

- **22 specialized agents** (fullstack, security, devops, ml-engineer, etc.)
- **Multi-model discussions** (ask Claude AND Gemini AND Grok the same question)
- **Code review with focus areas** (security, performance, architecture)
- **Persistent memory** across sessions
- **Governance gates** to check AI-generated code
- **Execution tracing** for full audit trails

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

After running `ax init`, your AI assistant gains access to 44 new tools. Here's how to use them:

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
Available agents (22 total):
- fullstack: Senior Fullstack Engineer
- backend: Backend Engineer
- security: Security Engineer
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

## Available MCP Tools (44 total)

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

## Available Agents (22)

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
| `researcher` | Literature review, analysis | Technology research |
| `cto` | Strategy, leadership | Technical direction |
| `ceo` | Business strategy | Business decisions |
| `product` | Requirements, roadmaps | Product planning |
| `quantum-engineer` | Quantum algorithms | Quantum computing |
| `aerospace-scientist` | Aerospace systems | Aerospace engineering |
| `creative-marketer` | Marketing, content | Marketing campaigns |
| `quality` | Testing, QA | Test planning |
| `writer` | Documentation, API docs | Technical writing |
| `reviewer` | Code review, patterns | Pull request reviews |
| `standard` | General assistance | Simple tasks |

---

## CLI Commands (Optional)

You can also use AutomatosX directly from the command line, though MCP integration provides a better experience:

```bash
# System
ax setup                    # Global setup (one-time)
ax init                     # Project initialization (per-project)
ax doctor                   # Check provider health

# Direct provider calls (command mode)
ax call claude "Explain this code"
ax call gemini --file ./src/api.ts "Review this"

# Agents
ax agent list               # List agents
ax agent run security --input '{"query": "audit auth"}'

# Review
ax review analyze src/ --focus security

# Discussion
ax discuss "REST vs GraphQL"

# Guard
ax guard check --policy bugfix --changed-paths src/
```

---

## Provider Installation

Install at least one AI provider CLI:

| Provider | CLI Command | Installation |
|----------|-------------|--------------|
| Claude | `claude` | [Claude Code](https://github.com/anthropics/claude-code) |
| Gemini | `gemini` | [Gemini CLI](https://github.com/google-gemini/gemini-cli) |
| Codex | `codex` | [Codex CLI](https://github.com/openai/codex) |
| Grok | `ax-grok` | [ax-cli](https://github.com/defai-digital/ax-cli) (requires XAI_API_KEY) |
| OpenCode | `opencode` | [OpenCode](https://github.com/opencode-ai/opencode) |

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

**v13.2.7** - MCP fix: Agents now load correctly regardless of working directory (was returning empty when called from Codex/other CLIs)

**v13.2.6** - Provider reliability: Fixed ax-grok timeout handling, fixed opencode stdin/JSON error parsing, improved error messages for missing credentials

**v13.2.5** - Provider fixes: Fixed OpenCode CLI args, fixed Grok CLI args, removed Antigravity, improved parallelization

**v13.2.4** - Security hardening: command injection fix, SQL injection prevention, async I/O improvements

[Full Changelog](https://github.com/defai-digital/automatosx/releases)

---

## License

**Business Source License 1.1** - see [LICENSE](LICENSE)

- **Free for non-production use**: Development, testing, personal projects
- **Free for small production**: Organizations with < $2M annual revenue
- **Commercial license required**: Production use by organizations with >= $2M annual revenue
- **Converts to Apache 2.0**: On January 1, 2030 (or 4 years after each version's release)

For commercial licensing inquiries, contact: licensing@defai.digital

See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) for full details

---

[GitHub](https://github.com/defai-digital/automatosx) | [Documentation](docs/) | [Issues](https://github.com/defai-digital/automatosx/issues)
