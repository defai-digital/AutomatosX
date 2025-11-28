# AutomatosX Architecture

## Overview

AutomatosX is a TypeScript monorepo providing AI agent orchestration with
persistent memory and multi-provider support.

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   CLI (ax)  │  │  MCP Server │  │  Natural Language (AI)  │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          └────────────────┼──────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Engine                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Agents    │  │   Memory    │  │       Sessions          │ │
│  │  Registry   │  │   Manager   │  │       Manager           │ │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘ │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Provider Router                          ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐││
│  │  │ Claude  │  │ Gemini  │  │ OpenAI  │  │     ax-cli      │││
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘││
│  └───────┼────────────┼───────────┼─────────────────┼──────────┘│
└──────────┼────────────┼───────────┼─────────────────┼───────────┘
           │            │           │                 │
           └────────────┴───────────┴─────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │    AI Providers       │
                    │  (External APIs)      │
                    └───────────────────────┘
```

## Package Structure

```
packages/
├── schemas/      # Zod schemas, type definitions
├── algorithms/   # ReScript algorithms (routing, ranking, DAG)
├── providers/    # AI provider integrations
├── core/         # Orchestration engine
├── cli/          # Command-line interface
└── mcp/          # Model Context Protocol server
```

### Dependency Graph

```
@ax/schemas (base - no dependencies)
     │
     ├──────────────────────────┐
     ▼                          ▼
@ax/algorithms            @ax/providers
     │                          │
     └──────────┬───────────────┘
                ▼
           @ax/core
                │
     ┌──────────┴──────────┐
     ▼                     ▼
  @ax/cli              @ax/mcp
```

## Core Components

### 1. Agent System

**Location:** `packages/core/src/agent/`

The agent system manages AI agent definitions and execution.

```typescript
// Agent lifecycle
AgentLoader → AgentRegistry → AgentExecutor
     │              │               │
     │              │               └── Execute tasks
     │              └── Store/lookup agents
     └── Load from YAML files
```

**Key Classes:**
- `AgentLoader` - Loads agent definitions from `.automatosx/agents/*.yaml`
- `AgentRegistry` - In-memory registry with filtering and lookup
- `AgentExecutor` - Executes tasks with timeout and retry handling
- `AgentRouter` - Keyword-based agent selection for auto-routing

**Agent Definition (YAML):**
```yaml
name: backend
displayName: Bob
role: Backend Developer
team: development
abilities:
  - api-design
  - database-modeling
orchestration:
  maxDelegationDepth: 1
  canDelegateTo: [quality, security]
```

### 2. Memory System

**Location:** `packages/core/src/memory/`

SQLite-based persistent memory with full-text search (FTS5).

```
┌─────────────────────────────────────────┐
│             MemoryManager               │
├─────────────────────────────────────────┤
│  add(entry)      → Insert new memory    │
│  search(query)   → FTS5 full-text       │
│  get(id)         → Retrieve by ID       │
│  clear(options)  → Filtered deletion    │
│  getStats()      → Database statistics  │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│         SQLite + FTS5 Database          │
│  .automatosx/memory/memories.db         │
└─────────────────────────────────────────┘
```

**Features:**
- Full-text search with relevance ranking
- Hybrid cleanup strategies (LRU, age, importance)
- Import/export for backup
- Access tracking and statistics

### 3. Session Management

**Location:** `packages/core/src/session/`

Multi-agent session lifecycle management.

```
Session Lifecycle:
  created → active → completed
              ↓
           failed
```

**Session Structure:**
```typescript
interface Session {
  id: SessionId;
  primaryAgent: string;
  task: string;
  state: 'created' | 'active' | 'completed' | 'failed';
  tasks: Task[];          // Sub-tasks
  metadata: Metadata;
  createdAt: ISODateString;
  completedAt?: ISODateString;
}
```

### 4. Provider Router

**Location:** `packages/core/src/router/`

Multi-provider orchestration with health monitoring and fallback.

```
Request → Router → Provider Selection → Execution → Response
             │              │
             │              ├── Health check
             │              ├── Latency scoring
             │              └── Priority order
             │
             └── On failure: Fallback to next provider
```

**Routing Algorithm:**
1. Score each healthy provider
2. Select highest score
3. Execute request
4. On failure, try alternatives
5. Track metrics

**Scoring Factors:**
- Provider health (40%)
- Recent latency (30%)
- Success rate (20%)
- Configuration priority (10%)

### 5. Algorithms (ReScript)

**Location:** `packages/algorithms/`

Performance-critical algorithms in ReScript with TypeScript bindings.

| Algorithm | Purpose |
|-----------|---------|
| Routing | Multi-factor provider selection |
| DAG Scheduler | Task dependency resolution |
| Memory Ranking | Relevance scoring for search |

### 6. CLI Commands

**Location:** `packages/cli/src/commands/`

| Command | Description |
|---------|-------------|
| `ax setup` | Initialize project |
| `ax run` | Execute agent task |
| `ax agent` | Manage agents |
| `ax memory` | Manage memory |
| `ax provider` | Manage providers |
| `ax session` | Manage sessions |
| `ax system` | System diagnostics |

### 7. MCP Server

**Location:** `packages/mcp/`

Model Context Protocol server for IDE integration.

```
MCP Client (Claude Code, Gemini CLI)
         │
         ▼
    MCP Server
         │
    ┌────┴────┐
    │ Tools   │
    ├─────────┤
    │ ax_run  │
    │ ax_memory_search │
    │ ax_session_create │
    │ ...     │
    └─────────┘
```

## Data Flow

### Task Execution

```
1. User: ax run backend "Create API"
                │
2. CLI parses command
                │
3. AgentRegistry.get("backend")
                │
4. AgentExecutor.execute(agent, task)
                │
5. ProviderRouter.route(request)
                │
6. Provider.execute(request)
                │
7. MemoryManager.add(result)
                │
8. Return response to user
```

### Memory Search

```
1. User: ax memory search "API design"
                │
2. MemoryManager.search("API design")
                │
3. SQLite FTS5 query
                │
4. MemoryRanking algorithm
                │
5. Return ranked results
```

## Configuration

**File:** `ax.config.json`

```json
{
  "providers": {
    "default": "claude",
    "fallbackOrder": ["claude", "gemini", "openai"]
  },
  "execution": {
    "timeout": 1500000,
    "retry": { "maxAttempts": 3 }
  },
  "memory": {
    "maxEntries": 10000,
    "autoCleanup": true
  },
  "agents": {
    "defaultAgent": "standard",
    "enableAutoSelection": true
  }
}
```

## Directory Structure

```
project/
├── ax.config.json           # Configuration
├── .automatosx/             # Runtime data (gitignored)
│   ├── agents/              # Agent definitions
│   │   ├── backend.yaml
│   │   ├── frontend.yaml
│   │   └── ...
│   ├── memory/              # SQLite database
│   │   └── memories.db
│   ├── sessions/            # Session files
│   └── abilities/           # Ability definitions
└── automatosx/              # Workspace (gitignored)
    ├── PRD/                 # Planning documents
    └── tmp/                 # Temporary files
```

## Error Handling

Custom error classes with helpful suggestions:

```typescript
class AutomatosXError extends Error {
  code: string;
  suggestion?: string;
  context?: Record<string, unknown>;
}

// Specialized errors
AgentNotFoundError      // Includes similar agent suggestions
ProviderUnavailableError // Suggests checking status
MemoryError             // Suggests cleanup
NotInitializedError     // Suggests ax setup
```

## Security Considerations

1. **Local-first** - Memory stays on disk, never uploaded
2. **No telemetry** - No data collection
3. **API keys** - Managed by individual providers
4. **Sandboxing** - Providers can run in sandboxed mode

## Performance

- **Memory search:** < 1ms (SQLite FTS5)
- **Agent lookup:** O(1) (hash map)
- **Provider routing:** O(n) where n = provider count
- **Task scheduling:** O(V + E) (topological sort)

## Future Considerations

1. **Distributed execution** - Multi-machine agent pools
2. **Real-time collaboration** - Shared sessions
3. **Plugin system** - Custom provider/agent extensions
4. **Web UI** - Browser-based dashboard
