# AutomatosX Architecture

## Overview

AutomatosX is an **orchestration layer** that sits between you and multiple AI CLI tools. It is **NOT** a standalone AI—it coordinates existing AI tools to provide:

- **Intelligent Routing** — Automatically select the best available provider
- **Persistent Memory** — Remember past conversations across sessions
- **Specialized Agents** — Route tasks to domain-expert personas
- **Session Management** — Track multi-step workflows

---

## The Four AI CLI Tools

AutomatosX integrates with four AI coding assistants:

| CLI Tool | Backend Providers | Integration | Command |
|----------|-------------------|-------------|---------|
| **Claude Code** | Anthropic Claude | MCP (stdin/stdout) | `claude mcp` |
| **Gemini CLI** | Google Gemini | MCP (stdin/stdout) | `gemini mcp` |
| **OpenAI Codex** | OpenAI | Bash (subprocess) | `codex -p` |
| **ax-cli** | GLM, Grok, DeepSeek, Ollama, Qwen, Mistral, etc. | SDK (native) | SDK calls |

### Integration Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        How AutomatosX Connects to Providers                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐      MCP Protocol       ┌─────────────────────────┐   │
│   │  Claude Code    │◄═══════════════════════►│                         │   │
│   │  (claude mcp)   │      stdin/stdout       │                         │   │
│   └─────────────────┘                         │                         │   │
│                                               │                         │   │
│   ┌─────────────────┐      MCP Protocol       │     AutomatosX          │   │
│   │  Gemini CLI     │◄═══════════════════════►│     Provider            │   │
│   │  (gemini mcp)   │      stdin/stdout       │     Router              │   │
│   └─────────────────┘                         │                         │   │
│                                               │                         │   │
│   ┌─────────────────┐      Bash Subprocess    │                         │   │
│   │  OpenAI Codex   │◄═══════════════════════►│                         │   │
│   │  (codex -p)     │      spawn + pipe       │                         │   │
│   └─────────────────┘                         │                         │   │
│                                               │                         │   │
│   ┌─────────────────┐      Native SDK         │                         │   │
│   │  ax-cli         │◄═══════════════════════►│                         │   │
│   │  (SDK calls)    │      function calls     │                         │   │
│   └─────────────────┘                         └─────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## System Architecture

### High-Level View

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                              USER ENTRY POINTS                               ║
╠═════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   You can interact with AutomatosX through ANY of these:                     ║
║                                                                              ║
║   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    ║
║   │   ax CLI     │  │ Claude Code  │  │  Gemini CLI  │  │   VS Code    │    ║
║   │              │  │  (via MCP)   │  │  (via MCP)   │  │  Extension   │    ║
║   │  ax run ...  │  │              │  │              │  │              │    ║
║   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    ║
║          │                 │                 │                 │             ║
║          │                 └────────┬────────┘                 │             ║
║          │                          │                          │             ║
║          │                 ┌────────▼────────┐                 │             ║
║          │                 │   MCP Server    │                 │             ║
║          │                 │   (@ax/mcp)     │                 │             ║
║          │                 └────────┬────────┘                 │             ║
║          │                          │                          │             ║
║          └──────────────────────────┼──────────────────────────┘             ║
║                                     │                                        ║
╠═════════════════════════════════════▼════════════════════════════════════════╣
║                           AUTOMATOSX CORE ENGINE                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   ┌────────────────────────────────────────────────────────────────────┐    ║
║   │                         @ax/core                                    │    ║
║   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │    ║
║   │  │   Agent     │  │   Memory    │  │   Session   │  │  Config   │  │    ║
║   │  │  Registry   │  │  Manager    │  │  Manager    │  │  Loader   │  │    ║
║   │  │             │  │             │  │             │  │           │  │    ║
║   │  │ 20+ agents  │  │ SQLite FTS5 │  │ Workflows   │  │ Settings  │  │    ║
║   │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │    ║
║   │         │                │                │                │        │    ║
║   │         └────────────────┼────────────────┼────────────────┘        │    ║
║   │                          │                │                         │    ║
║   │                  ┌───────▼────────────────▼───────┐                 │    ║
║   │                  │      Provider Router           │                 │    ║
║   │                  │  • Health monitoring           │                 │    ║
║   │                  │  • Latency scoring             │                 │    ║
║   │                  │  • Automatic fallback          │                 │    ║
║   │                  │  • Circuit breaker             │                 │    ║
║   │                  └───────────────┬───────────────┘                 │    ║
║   └──────────────────────────────────┼──────────────────────────────────┘    ║
║                                      │                                       ║
╠══════════════════════════════════════▼═══════════════════════════════════════╣
║                           PROVIDER LAYER (@ax/providers)                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   AutomatosX spawns these as subprocesses and communicates via:              ║
║                                                                              ║
║   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
║   │  ClaudeProvider │  │ GeminiProvider  │  │ OpenAIProvider  │  │  AxCliProvider  │
║   │                 │  │                 │  │                 │  │                 │
║   │  Integration:   │  │  Integration:   │  │  Integration:   │  │  Integration:   │
║   │  MCP Protocol   │  │  MCP Protocol   │  │  Bash Spawn     │  │  Native SDK     │
║   │                 │  │                 │  │                 │  │                 │
║   │  Command:       │  │  Command:       │  │  Command:       │  │  Providers:     │
║   │  claude mcp     │  │  gemini mcp     │  │  codex -p       │  │  GLM, Grok,     │
║   │                 │  │                 │  │                 │  │  DeepSeek,      │
║   │  Transport:     │  │  Transport:     │  │  Transport:     │  │  Ollama, etc.   │
║   │  stdin/stdout   │  │  stdin/stdout   │  │  pipe           │  │                 │
║   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
║            │                    │                    │                    │        ║
║            │                    │                    │                    │        ║
╠════════════▼════════════════════▼════════════════════▼════════════════════▼════════╣
║                              EXTERNAL AI SERVICES                                  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                    ║
║   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐  ║
║   │   Anthropic   │  │    Google     │  │    OpenAI     │  │   ax-cli Multi-   │  ║
║   │   Claude API  │  │  Gemini API   │  │   Codex API   │  │   Provider Hub    │  ║
║   └───────────────┘  └───────────────┘  └───────────────┘  └─────────┬─────────┘  ║
║                                                                      │             ║
║                                              ┌───────────────────────┼───────────┐ ║
║                                              │                       │           │ ║
║                                              ▼                       ▼           ▼ ║
║                                         ┌─────────┐  ┌─────────┐  ┌─────────────┐ ║
║                                         │  GLM    │  │  Grok   │  │  DeepSeek   │ ║
║                                         │(Zhipu)  │  │  (xAI)  │  │             │ ║
║                                         └─────────┘  └─────────┘  └─────────────┘ ║
║                                              │           │              │          ║
║                                              ▼           ▼              ▼          ║
║                                         ┌─────────┐  ┌─────────┐  ┌─────────────┐ ║
║                                         │ Ollama  │  │ Qwen    │  │  Mistral    │ ║
║                                         │ (local) │  │(Alibaba)│  │             │ ║
║                                         └─────────┘  └─────────┘  └─────────────┘ ║
║                                                                                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Bidirectional Relationship

### Key Insight: CLIs as Both Entry Points AND Backends

The same CLI tools serve **two roles**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     BIDIRECTIONAL RELATIONSHIP                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ROLE 1: As Entry Points (User → AutomatosX)                               │
│   ════════════════════════════════════════════                               │
│                                                                              │
│   When you use Claude Code or Gemini CLI, they can call AutomatosX          │
│   MCP server tools to leverage agents, memory, and sessions:                 │
│                                                                              │
│       User                                                                   │
│         │                                                                    │
│         ▼                                                                    │
│   ┌───────────────┐        MCP Tool Call        ┌───────────────────┐       │
│   │  Claude Code  │ ══════════════════════════► │  AutomatosX MCP   │       │
│   │  or           │    ax_run, ax_memory_*,     │  Server           │       │
│   │  Gemini CLI   │    ax_session_*, etc.       │                   │       │
│   └───────────────┘                             └───────────────────┘       │
│                                                                              │
│                                                                              │
│   ROLE 2: As Execution Backends (AutomatosX → CLIs)                         │
│   ═════════════════════════════════════════════════                          │
│                                                                              │
│   When AutomatosX needs to execute a task, it spawns these CLIs             │
│   as subprocesses to do the actual AI work:                                  │
│                                                                              │
│   ┌───────────────────┐        Subprocess        ┌───────────────┐          │
│   │  AutomatosX       │ ════════════════════════►│  Claude Code  │          │
│   │  Provider Router  │     claude mcp           │  (execution)  │          │
│   │                   │     gemini mcp           ├───────────────┤          │
│   │                   │     codex -p             │  Gemini CLI   │          │
│   │                   │     SDK calls            │  (execution)  │          │
│   └───────────────────┘                          ├───────────────┤          │
│                                                  │  OpenAI Codex │          │
│                                                  │  (execution)  │          │
│                                                  ├───────────────┤          │
│                                                  │  ax-cli       │          │
│                                                  │  (execution)  │          │
│                                                  └───────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example Flows

**Flow A: Using ax CLI directly**
```
User: ax run backend "Create REST API"
         │
         ▼
    AutomatosX CLI
         │
         ▼
    Agent Registry (selects "backend" agent)
         │
         ▼
    Provider Router (selects best provider)
         │
         ├── Claude healthy? ──► claude mcp ──► Execute
         │
         ├── Gemini healthy? ──► gemini mcp ──► Execute
         │
         └── OpenAI healthy? ──► codex -p ──► Execute
```

**Flow B: Using Claude Code with AutomatosX MCP tools**
```
User: (in Claude Code) "Use AutomatosX backend agent to create an API"
         │
         ▼
    Claude Code
         │
         ▼
    Calls MCP tool: ax_run(agent="backend", task="Create API")
         │
         ▼
    AutomatosX MCP Server
         │
         ▼
    Agent Registry + Provider Router
         │
         ▼
    (May use Claude itself, or Gemini, or OpenAI as backend)
```

---

## Package Architecture

### Monorepo Structure

```
AutomatosX/
├── packages/
│   ├── schemas/          # @ax/schemas - Zod types (base layer)
│   ├── algorithms/       # @ax/algorithms - ReScript performance code
│   ├── providers/        # @ax/providers - CLI integrations
│   ├── core/             # @ax/core - Orchestration engine
│   ├── cli/              # @ax/cli - Command-line interface
│   ├── mcp/              # @ax/mcp - MCP server for IDE integration
│   └── vscode-extension/ # VS Code extension
```

### Dependency Graph

```
                    @ax/schemas
                    (Zod types, branded IDs)
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    @ax/algorithms  @ax/providers  better-sqlite3
    (ReScript)      (CLI integrations)
          │              │              │
          └──────────────┼──────────────┘
                         │
                         ▼
                     @ax/core
                (Orchestration engine)
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
       @ax/cli                      @ax/mcp
  (Direct CLI usage)          (MCP server for IDEs)
```

---

## Provider Details

### Claude Code Provider

```typescript
// Integration via MCP Protocol
class ClaudeProvider extends BaseProvider {
  id = 'claude';
  name = 'Claude Code';
  integrationMode = 'mcp';

  // Spawns: claude mcp
  // Transport: StdioClientTransport (stdin/stdout)
  // Protocol: JSON-RPC 2.0 over MCP
}
```

**Execution flow:**
```
ClaudeProvider.execute(request)
         │
         ▼
    Spawn subprocess: claude mcp
         │
         ▼
    MCP Client connects via stdin/stdout
         │
         ▼
    Call MCP tool: run_task(prompt)
         │
         ▼
    Claude processes request
         │
         ▼
    Return response via MCP
```

### Gemini CLI Provider

```typescript
// Integration via MCP Protocol
class GeminiProvider extends BaseProvider {
  id = 'gemini';
  name = 'Gemini CLI';
  integrationMode = 'mcp';

  // Spawns: gemini mcp
  // Transport: StdioClientTransport (stdin/stdout)
  // Protocol: JSON-RPC 2.0 over MCP
}
```

### OpenAI Codex Provider

```typescript
// Integration via Bash subprocess
class OpenAIProvider extends BaseProvider {
  id = 'openai';
  name = 'OpenAI Codex';
  integrationMode = 'bash';

  // Spawns: codex -p "prompt"
  // Transport: Process spawn with pipe
  // Output: stdout capture
}
```

**Execution flow:**
```
OpenAIProvider.execute(request)
         │
         ▼
    Spawn subprocess: codex -p "prompt"
         │
         ▼
    Capture stdout/stderr
         │
         ▼
    Parse output
         │
         ▼
    Return response
```

### ax-cli Provider

```typescript
// Integration via Native SDK
class AxCliProvider extends BaseProvider {
  id = 'ax-cli';
  name = 'ax-cli';
  integrationMode = 'sdk';

  // Uses: @anthropic/agent-sdk (when available)
  // Features: Checkpoints, subagent delegation
}
```

---

## Provider Router

### Routing Algorithm

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROVIDER SELECTION ALGORITHM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. Get all configured providers                                            │
│      ┌──────────────────────────────────────────────────────────────┐       │
│      │  Providers: [claude, gemini, openai, ax-cli]                 │       │
│      └──────────────────────────────────────────────────────────────┘       │
│                              │                                               │
│                              ▼                                               │
│   2. Filter by health status                                                 │
│      ┌──────────────────────────────────────────────────────────────┐       │
│      │  Healthy: [claude ✓, gemini ✓, openai ✗]                     │       │
│      │  (OpenAI circuit breaker is OPEN)                            │       │
│      └──────────────────────────────────────────────────────────────┘       │
│                              │                                               │
│                              ▼                                               │
│   3. Score each healthy provider                                             │
│      ┌──────────────────────────────────────────────────────────────┐       │
│      │  Score = Health(40%) + Latency(30%) + Success(20%) + Prio(10%)│       │
│      │                                                               │       │
│      │  claude:  0.40 × 1.0 + 0.30 × 0.9 + 0.20 × 0.99 + 0.10 × 1.0 │       │
│      │         = 0.40 + 0.27 + 0.198 + 0.10 = 0.968                  │       │
│      │                                                               │       │
│      │  gemini:  0.40 × 1.0 + 0.30 × 0.7 + 0.20 × 0.95 + 0.10 × 0.8 │       │
│      │         = 0.40 + 0.21 + 0.19 + 0.08 = 0.88                    │       │
│      └──────────────────────────────────────────────────────────────┘       │
│                              │                                               │
│                              ▼                                               │
│   4. Select highest score                                                    │
│      ┌──────────────────────────────────────────────────────────────┐       │
│      │  Selected: claude (score: 0.968)                             │       │
│      └──────────────────────────────────────────────────────────────┘       │
│                              │                                               │
│                              ▼                                               │
│   5. Execute with fallback                                                   │
│      ┌──────────────────────────────────────────────────────────────┐       │
│      │  Try claude → Success? Return result                         │       │
│      │            → Failure? Try gemini (next highest score)        │       │
│      └──────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Circuit Breaker Pattern

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
              ┌──────────┐                                │
              │  CLOSED  │ ◄── Normal operation           │
              │ (healthy)│     Accepting requests         │
              └────┬─────┘                                │
                   │                                      │
        Failures exceed threshold                         │
        (default: 3 consecutive)                          │
                   │                                      │
                   ▼                                      │
              ┌──────────┐                                │
              │   OPEN   │ ◄── Failure mode               │
              │(unhealthy)│    Rejecting requests         │
              └────┬─────┘     Using alternatives         │
                   │                                      │
        Recovery timeout expires                          │
        (default: 60 seconds)                             │
                   │                                      │
                   ▼                                      │
              ┌──────────┐                                │
              │HALF-OPEN │ ◄── Testing recovery           │
              │ (testing) │    Allow one request          │
              └────┬─────┘                                │
                   │                                      │
        ┌──────────┴──────────┐                           │
        │                     │                           │
    Success                Failure                        │
        │                     │                           │
        │                     ▼                           │
        │               ┌──────────┐                      │
        │               │   OPEN   │                      │
        │               └──────────┘                      │
        │                                                 │
        └─────────────────────────────────────────────────┘
```

---

## Core Components

### Agent Registry

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             AGENT REGISTRY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   .automatosx/agents/                                                        │
│   ├── backend.yaml      → Bob (Go, Rust, Python - backend systems, APIs)    │
│   ├── fullstack.yaml    → Felix (Node.js, TypeScript, React - full-stack)   │
│   ├── frontend.yaml     → Frank (React, Next.js, Vue, Swift - UI)           │
│   ├── devops.yaml       → Oliver (K8s, Docker, CI/CD)                       │
│   ├── security.yaml     → Steve (Audits, OWASP, Threats)                    │
│   ├── quality.yaml      → Queenie (Testing, QA)                             │
│   ├── architect.yaml    → Alex (System design)                              │
│   ├── performance.yaml  → Peter (Optimization)                              │
│   ├── product.yaml      → Paris (Requirements)                              │
│   └── ... (20+ agents)                                                       │
│                                                                              │
│   Language Routing:                                                          │
│   • Go/Rust/Python  → Bob (backend) - APIs, microservices, systems          │
│   • JS/TS/Node.js   → Felix (fullstack) - Full-stack features, React APIs   │
│   • React/Vue/Swift → Frank (frontend) - UI components, state management    │
│                                                                              │
│   AgentLoader ──► AgentRegistry ──► AgentExecutor                           │
│       │               │                  │                                   │
│       │               │                  └── Execute with provider           │
│       │               └── In-memory lookup                                   │
│       └── Parse YAML files                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Memory Manager

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MEMORY MANAGER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   SQLite Database with FTS5 (Full-Text Search)                              │
│   Location: .automatosx/memory/memories.db                                   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  Memory Entry                                                        │   │
│   │  ┌─────────────────────────────────────────────────────────────┐    │   │
│   │  │  id: "mem_abc123..."                                         │    │   │
│   │  │  type: "execution" | "decision" | "code"                     │    │   │
│   │  │  agentId: "backend"                                          │    │   │
│   │  │  sessionId: "sess_xyz..."                                    │    │   │
│   │  │  input: { task, provider, context }                          │    │   │
│   │  │  output: { response, duration, success }                     │    │   │
│   │  │  metadata: { tags, importance, accessCount }                 │    │   │
│   │  │  createdAt: "2024-11-28T10:30:00Z"                          │    │   │
│   │  └─────────────────────────────────────────────────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Operations:                                                                │
│   • add(entry)     → Insert with FTS5 indexing                              │
│   • search(query)  → Full-text search with ranking                          │
│   • get(id)        → Retrieve by ID                                         │
│   • clear(options) → Filtered deletion (by date, agent, type)               │
│   • export/import  → Backup and restore                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Session Manager

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SESSION MANAGER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Session Lifecycle:                                                         │
│                                                                              │
│       created ──► active ──► completed                                       │
│                      │                                                       │
│                      └──► failed                                             │
│                                                                              │
│   Session Structure:                                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  {                                                                   │   │
│   │    id: "sess_abc123",                                               │   │
│   │    primaryAgent: "backend",                                         │   │
│   │    task: "Build user authentication",                               │   │
│   │    state: "active",                                                 │   │
│   │    tasks: [                                                         │   │
│   │      { id: "task_1", description: "Design schema", status: "done" },│   │
│   │      { id: "task_2", description: "Implement API", status: "active"}│   │
│   │    ],                                                               │   │
│   │    delegations: ["quality", "security"],                            │   │
│   │    createdAt: "2024-11-28T10:00:00Z"                               │   │
│   │  }                                                                  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Storage: .automatosx/sessions/                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## MCP Server

### Tools Exposed to Claude Code / Gemini CLI

When Claude Code or Gemini CLI connects to AutomatosX MCP server, these tools become available:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MCP SERVER TOOLS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Agent Tools:                                                               │
│   • ax_run           Execute task with agent                                 │
│   • ax_agent_list    List available agents                                   │
│   • ax_agent_info    Get agent details                                       │
│                                                                              │
│   Memory Tools:                                                              │
│   • ax_memory_search Search past conversations                               │
│   • ax_memory_add    Add memory entry                                        │
│   • ax_memory_list   List recent entries                                     │
│                                                                              │
│   Session Tools:                                                             │
│   • ax_session_create  Start new session                                     │
│   • ax_session_list    List sessions                                         │
│   • ax_session_complete Mark session done                                    │
│                                                                              │
│   Provider Tools:                                                            │
│   • ax_provider_list   List providers                                        │
│   • ax_provider_health Check provider status                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Example: Claude Code calling AutomatosX

```
User (in Claude Code): "Use the backend agent to create an API"

Claude Code internally:
         │
         ▼
    Calls MCP tool: ax_run
    {
      "agent": "backend",
      "task": "Create an API"
    }
         │
         ▼
    AutomatosX MCP Server receives call
         │
         ▼
    Routes to backend agent
         │
         ▼
    Provider Router selects best provider
    (might be Claude itself, or Gemini, or OpenAI)
         │
         ▼
    Executes and returns result
         │
         ▼
    Claude Code receives response
```

---

## Configuration

### ax.config.json

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 3,
      "command": "claude",
      "args": ["mcp"],
      "timeout": 2700000,
      "healthCheck": {
        "enabled": true,
        "interval": 300000
      },
      "circuitBreaker": {
        "failureThreshold": 3,
        "recoveryTimeout": 60000
      }
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2,
      "command": "gemini",
      "args": ["mcp"],
      "timeout": 2700000
    },
    "openai": {
      "enabled": true,
      "priority": 1,
      "command": "codex",
      "timeout": 300000
    },
    "ax-cli": {
      "enabled": true,
      "priority": 2,
      "useSDK": true
    }
  },
  "routing": {
    "weights": {
      "health": 0.4,
      "latency": 0.3,
      "successRate": 0.2,
      "priority": 0.1
    }
  },
  "memory": {
    "maxEntries": 10000,
    "persistPath": ".automatosx/memory"
  },
  "orchestration": {
    "delegation": {
      "maxDepth": 2,
      "enableCycleDetection": true
    }
  }
}
```

---

## Directory Structure

```
project/
├── ax.config.json              # Configuration
├── .automatosx/                # Runtime data (gitignored)
│   ├── agents/                 # Agent definitions (YAML)
│   │   ├── backend.yaml
│   │   ├── frontend.yaml
│   │   ├── devops.yaml
│   │   └── ...
│   ├── memory/                 # SQLite database
│   │   └── memories.db
│   ├── sessions/               # Session persistence
│   └── checkpoints/            # Resumable checkpoints
└── automatosx/                 # Workspace (gitignored)
    ├── PRD/                    # Planning documents
    └── tmp/                    # Temporary files
```

---

## Summary

AutomatosX orchestrates four AI CLI tools:

| Tool | Integration | How AutomatosX Connects | Backend Providers |
|------|-------------|------------------------|-------------------|
| **Claude Code** | MCP Protocol | Spawns `claude mcp`, stdin/stdout | Anthropic Claude |
| **Gemini CLI** | MCP Protocol | Spawns `gemini mcp`, stdin/stdout | Google Gemini |
| **OpenAI Codex** | Bash | Spawns `codex -p "prompt"`, stdout | OpenAI |
| **ax-cli** | Native SDK | Direct function calls with checkpoints | GLM, Grok, DeepSeek, Ollama, Qwen, Mistral, etc. |

**Key value adds:**
1. **Intelligent routing** — Automatically picks the healthiest, fastest provider
2. **Automatic fallback** — If one fails, seamlessly tries another
3. **Persistent memory** — Search across all past conversations
4. **Specialized agents** — Route tasks to domain experts
5. **Session tracking** — Manage multi-step workflows
6. **Multi-provider hub** — ax-cli gives access to many additional AI providers

**You continue using your favorite CLI.** AutomatosX works invisibly to make it smarter.
