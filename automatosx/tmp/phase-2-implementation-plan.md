# AutomatosX v11 - Phase 2 Implementation Plan

**Date**: 2024-11-24
**Author**: Claude (Architecture Assistant)
**Status**: Ready for Implementation
**Phase 1 Completion**: ~90%

---

## Executive Summary

Phase 2 builds upon the solid Phase 1 foundation to deliver a fully functional CLI tool and complete the core orchestration engine. The focus is on:

1. **CLI Implementation** - All `ax` commands working
2. **Provider Integration Testing** - Validate all 4 providers with real-world tests
3. **Session & Agent Execution** - Complete the orchestration engine
4. **Router Integration** - Connect ReScript algorithms to TypeScript runtime
5. **MCP Server Foundation** - Basic server structure for IDE integration

---

## Current State Assessment

### Phase 1 Completed (Foundation)

| Component | Status | Notes |
|-----------|--------|-------|
| `@ax/schemas` | 100% | Zod schemas, branded types, validation |
| `@ax/core/memory` | 100% | FTS5 memory manager with cleanup |
| `@ax/core/config` | 100% | Config loader with env overrides |
| `@ax/providers` | 100% | All 4 providers implemented |
| `@ax/algorithms` | 100% | ReScript routing, DAG, ranking |
| Bug Fixes | 83 fixed | 8 analysis passes completed |
| Build Pipeline | Working | All packages build successfully |

### Phase 1 Remaining (~10%)

| Component | Status | Work Needed |
|-----------|--------|-------------|
| `@ax/core/router` | Stub | Connect ReScript algorithms |
| `@ax/core/session` | Stub | Session management |
| `@ax/core/agent` | Stub | Agent execution engine |
| `@ax/core/checkpoint` | Stub | Checkpoint system |
| `@ax/cli` | Empty | All commands |
| `@ax/mcp` | Empty | MCP server |

---

## Phase 2 Implementation Plan

### Work Stream 1: Router Implementation (Priority: HIGH)

**Goal**: Connect ReScript routing algorithms to TypeScript runtime

**Files to Create/Modify**:
```
packages/core/src/router/
├── index.ts           # Router exports
├── provider-router.ts # Main router class
├── health-monitor.ts  # Provider health monitoring
└── load-balancer.ts   # Request distribution
```

**Key Features**:
1. Provider selection using ReScript `Routing.selectProvider`
2. Health-aware routing with circuit breaker
3. Fallback chain execution
4. Rate limit tracking
5. Provider priority management

**Implementation Details**:

```typescript
// packages/core/src/router/provider-router.ts

import { selectProvider, type RoutingContext } from '@ax/algorithms';
import { BaseProvider, createProvider } from '@ax/providers';
import { type Config, type ProviderType } from '@ax/schemas';

export class ProviderRouter {
  private providers: Map<ProviderType, BaseProvider>;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.providers = new Map();
    this.initializeProviders();
  }

  async route(task: string, context?: RoutingContext): Promise<ExecutionResponse> {
    const providerStates = this.getProviderStates();
    const selected = selectProvider(providerStates, context ?? this.defaultContext);

    if (!selected) {
      throw new Error('No healthy providers available');
    }

    const provider = this.providers.get(selected.id as ProviderType);
    return provider!.executeWithTracking({ task });
  }

  private getProviderStates() {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({
      id,
      priority: this.config.providers.priorities?.[id] ?? 99,
      healthy: provider.isHealthy(),
      rateLimit: 0.0, // TODO: track rate limits
      latencyMs: provider.getHealth().latencyMs,
      successRate: provider.getHealth().successRate,
      integrationMode: provider.integrationMode,
    }));
  }
}
```

**Estimated Complexity**: Medium
**Dependencies**: `@ax/providers`, `@ax/algorithms`, `@ax/schemas`

---

### Work Stream 2: Session Management (Priority: HIGH)

**Goal**: Implement session lifecycle and state management

**Files to Create/Modify**:
```
packages/core/src/session/
├── index.ts           # Session exports
├── manager.ts         # Session lifecycle management
├── state.ts           # Session state handling
└── storage.ts         # Session persistence (filesystem)
```

**Key Features**:
1. Session creation with unique IDs
2. Session state tracking (active, paused, completed, failed)
3. Task queue management per session
4. Session persistence to `.automatosx/sessions/`
5. Session resumption from checkpoint

**Implementation Details**:

```typescript
// packages/core/src/session/manager.ts

import { randomUUID } from 'node:crypto';
import { type Session, type SessionState, SessionSchema, createSessionId } from '@ax/schemas';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  create(options: { agentId?: string; metadata?: Record<string, unknown> }): Session {
    const session: Session = SessionSchema.parse({
      id: createSessionId(),
      state: 'active',
      agentId: options.agentId,
      metadata: options.metadata ?? {},
      tasks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.sessions.set(session.id, session);
    return session;
  }

  complete(sessionId: string): Session {
    const session = this.getSession(sessionId);
    session.state = 'completed';
    session.completedAt = new Date();
    session.updatedAt = new Date();
    this.persist(session);
    return session;
  }

  async list(filter?: { state?: SessionState }): Promise<Session[]> {
    const sessions = Array.from(this.sessions.values());
    if (filter?.state) {
      return sessions.filter(s => s.state === filter.state);
    }
    return sessions;
  }
}
```

**Estimated Complexity**: Medium
**Dependencies**: `@ax/schemas`

---

### Work Stream 3: Agent Execution Engine (Priority: HIGH)

**Goal**: Implement agent task execution with delegation support

**Files to Create/Modify**:
```
packages/core/src/agent/
├── index.ts           # Agent exports
├── executor.ts        # Task execution engine
├── loader.ts          # Agent profile loader (YAML)
├── registry.ts        # Agent registry
└── delegation.ts      # Agent-to-agent delegation
```

**Key Features**:
1. Load agent profiles from `.automatosx/agents/`
2. Execute tasks against agent system prompts
3. Support agent delegation (maxDelegationDepth)
4. Ability selection based on task type
5. Integration with session manager

**Implementation Details**:

```typescript
// packages/core/src/agent/executor.ts

import { type AgentProfile, type ExecutionRequest, type ExecutionResponse } from '@ax/schemas';
import { ProviderRouter } from '../router/provider-router.js';
import { SessionManager } from '../session/manager.js';

export class AgentExecutor {
  private router: ProviderRouter;
  private sessionManager: SessionManager;
  private agentRegistry: AgentRegistry;

  constructor(
    router: ProviderRouter,
    sessionManager: SessionManager,
    agentRegistry: AgentRegistry
  ) {
    this.router = router;
    this.sessionManager = sessionManager;
    this.agentRegistry = agentRegistry;
  }

  async execute(agentId: string, task: string, sessionId?: string): Promise<ExecutionResponse> {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Create or get session
    const session = sessionId
      ? this.sessionManager.getSession(sessionId)
      : this.sessionManager.create({ agentId });

    // Build execution request with agent context
    const request: ExecutionRequest = {
      task,
      agent: agentId,
      context: {
        systemPrompt: agent.systemPrompt,
        abilities: agent.abilities,
        personality: agent.personality,
      },
      sessionId: session.id,
    };

    // Route to provider
    const response = await this.router.route(task, {
      taskType: this.inferTaskType(task),
      complexity: this.estimateComplexity(task),
      preferMcp: true,
    });

    // Update session
    this.sessionManager.addTask(session.id, {
      task,
      response,
      timestamp: new Date(),
    });

    return response;
  }
}
```

**Estimated Complexity**: High
**Dependencies**: `@ax/providers`, `@ax/schemas`, router, session

---

### Work Stream 4: CLI Implementation (Priority: CRITICAL)

**Goal**: Implement all CLI commands per PRD specification

**Files to Create**:
```
packages/cli/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── cli.ts             # Main CLI setup (yargs)
│   ├── commands/
│   │   ├── run.ts         # ax run <agent> "task"
│   │   ├── agent.ts       # ax agent [list|info|create|update]
│   │   ├── memory.ts      # ax memory [search|list|export|import|stats]
│   │   ├── session.ts     # ax session [create|list|complete]
│   │   ├── spec.ts        # ax spec [run|status]
│   │   ├── provider.ts    # ax provider [list|status|test]
│   │   ├── config.ts      # ax config [show|set]
│   │   └── system.ts      # ax [status|doctor|mcp]
│   ├── output/
│   │   ├── formatter.ts   # Output formatting (table, json, text)
│   │   ├── spinner.ts     # Progress indicators
│   │   └── colors.ts      # Terminal colors
│   └── utils/
│       ├── validation.ts  # Input validation
│       └── errors.ts      # Error handling
├── package.json
└── tsconfig.json
```

**Command Implementation Priority**:

1. **Critical (Day 1-2)**:
   - `ax run <agent> "task"` - Core functionality
   - `ax status` - System overview
   - `ax agent list` - List agents

2. **High (Day 3-4)**:
   - `ax memory search "query"` - Memory search
   - `ax memory list` - Recent memories
   - `ax provider list` - Provider status
   - `ax provider status` - Health check

3. **Medium (Day 5-6)**:
   - `ax agent info <name>` - Agent details
   - `ax session list` - Session list
   - `ax session create` - New session
   - `ax config show` - Show config

4. **Lower (Day 7+)**:
   - `ax agent create` - Create agent
   - `ax memory export/import` - Backup
   - `ax spec run/status` - Workflow execution
   - `ax doctor` - Diagnostics
   - `ax mcp` - Start MCP server

**CLI Architecture**:

```typescript
// packages/cli/src/cli.ts

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export function createCli() {
  return yargs(hideBin(process.argv))
    .scriptName('ax')
    .usage('$0 <command> [options]')
    .command(runCommand)
    .command(agentCommand)
    .command(memoryCommand)
    .command(sessionCommand)
    .command(specCommand)
    .command(providerCommand)
    .command(configCommand)
    .command(statusCommand)
    .command(doctorCommand)
    .command(mcpCommand)
    .demandCommand(1, 'You need at least one command')
    .strict()
    .help()
    .version();
}

// packages/cli/src/commands/run.ts
export const runCommand: CommandModule = {
  command: 'run <agent> [task]',
  describe: 'Execute a task with an agent',
  builder: (yargs) => yargs
    .positional('agent', {
      describe: 'Agent name',
      type: 'string',
    })
    .positional('task', {
      describe: 'Task to execute',
      type: 'string',
    })
    .option('session', {
      alias: 's',
      describe: 'Session ID to use',
      type: 'string',
    })
    .option('timeout', {
      alias: 't',
      describe: 'Timeout in milliseconds',
      type: 'number',
      default: 300000,
    })
    .option('streaming', {
      describe: 'Enable streaming output',
      type: 'boolean',
      default: false,
    }),
  handler: async (argv) => {
    const { agent, task, session, timeout, streaming } = argv;

    const core = await initializeCore();
    const response = await core.executor.execute(agent, task, {
      sessionId: session,
      timeout,
      stream: streaming,
    });

    outputResponse(response);
  },
};
```

**Estimated Complexity**: High
**Dependencies**: `@ax/core`, `@ax/providers`, `@ax/schemas`

---

### Work Stream 5: Checkpoint System (Priority: MEDIUM)

**Goal**: Enable resumable long-running workflows

**Files to Create**:
```
packages/core/src/checkpoint/
├── index.ts           # Checkpoint exports
├── manager.ts         # Checkpoint lifecycle
├── storage.ts         # Filesystem persistence
└── recovery.ts        # Checkpoint restoration
```

**Key Features**:
1. Checkpoint creation at task boundaries
2. State serialization to `.automatosx/checkpoints/`
3. Checkpoint metadata (session, agent, progress)
4. Resume from checkpoint with state restoration
5. Checkpoint cleanup policies

**Estimated Complexity**: Medium
**Dependencies**: `@ax/schemas`, session manager

---

### Work Stream 6: MCP Server Foundation (Priority: LOW for Phase 2)

**Goal**: Basic MCP server structure for IDE integration

**Files to Create**:
```
packages/mcp/
├── src/
│   ├── index.ts       # Entry point
│   ├── server.ts      # MCP server setup
│   ├── tools/
│   │   ├── run-task.ts    # Execute task tool
│   │   ├── search-memory.ts
│   │   ├── list-agents.ts
│   │   └── get-status.ts
│   └── handlers/
│       ├── tool-handler.ts
│       └── resource-handler.ts
├── package.json
└── tsconfig.json
```

**Estimated Complexity**: Medium
**Dependencies**: `@modelcontextprotocol/sdk`, `@ax/core`

---

## Implementation Schedule

### Week 1: Core Engine Completion

| Day | Tasks |
|-----|-------|
| 1 | Router implementation + provider state management |
| 2 | Session manager + persistence |
| 3 | Agent loader + registry |
| 4 | Agent executor + delegation |
| 5 | Integration testing of core engine |

### Week 2: CLI Implementation

| Day | Tasks |
|-----|-------|
| 1 | CLI skeleton + `ax run` command |
| 2 | `ax agent` and `ax provider` commands |
| 3 | `ax memory` commands |
| 4 | `ax session` and `ax config` commands |
| 5 | `ax status`, `ax doctor`, polish |

### Week 3: Testing & MCP Foundation

| Day | Tasks |
|-----|-------|
| 1 | Provider integration tests (Claude) |
| 2 | Provider integration tests (Gemini, ax-cli) |
| 3 | E2E CLI tests |
| 4 | MCP server foundation |
| 5 | Documentation + bug fixes |

---

## Dependencies to Add

```json
// packages/cli/package.json
{
  "dependencies": {
    "@ax/core": "workspace:*",
    "@ax/providers": "workspace:*",
    "@ax/schemas": "workspace:*",
    "yargs": "^18.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "cli-table3": "^0.6.5"
  },
  "devDependencies": {
    "@types/yargs": "^17.0.32"
  }
}
```

---

## Testing Strategy

### Unit Tests
- Router provider selection
- Session lifecycle
- Agent loading
- CLI command parsing

### Integration Tests
- Full task execution flow
- Memory search + storage
- Provider fallback chain
- Session persistence

### E2E Tests
- `ax run backend "hello"` flow
- `ax memory search` with real data
- `ax provider test claude`

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider API changes | High | Abstract via base provider |
| MCP SDK instability | Medium | Pin versions, fallback modes |
| Performance issues | Medium | ReScript algorithms, caching |
| Configuration complexity | Low | Smart defaults, validation |

---

## Success Criteria

### Phase 2 Complete When:

1. **CLI Functional**: All core commands working
   - `ax run <agent> "task"` executes successfully
   - `ax memory search` returns results
   - `ax provider status` shows health

2. **Provider Integration**: At least 2 providers tested
   - Claude Code (MCP) verified working
   - One fallback provider working

3. **Session Management**: Basic workflows work
   - Sessions created and tracked
   - Tasks logged to memory

4. **Build Quality**:
   - All packages build without errors
   - TypeScript strict mode passes
   - Core unit tests pass (>80% coverage)

---

## Next Steps After Phase 2

### Phase 3 Focus:
- Checkpoint system completion
- Spec-driven workflows (`ax spec run`)
- Advanced CLI features (streaming, parallel)

### Phase 4 Focus:
- MCP server completion
- IDE integration testing
- Provider auto-discovery

---

## Appendix: File Tree After Phase 2

```
packages/
├── schemas/           # COMPLETE (Phase 1)
├── algorithms/        # COMPLETE (Phase 1)
├── providers/         # COMPLETE (Phase 1)
├── core/
│   ├── src/
│   │   ├── memory/    # COMPLETE (Phase 1)
│   │   ├── config/    # COMPLETE (Phase 1)
│   │   ├── router/    # NEW (Phase 2)
│   │   ├── session/   # NEW (Phase 2)
│   │   ├── agent/     # NEW (Phase 2)
│   │   ├── checkpoint/# NEW (Phase 2)
│   │   └── index.ts
│   └── package.json
├── cli/               # NEW (Phase 2)
│   ├── src/
│   │   ├── commands/
│   │   ├── output/
│   │   └── index.ts
│   └── package.json
└── mcp/               # FOUNDATION (Phase 2)
    ├── src/
    │   ├── server.ts
    │   └── tools/
    └── package.json
```

---

**Document Version**: 1.0
**Created**: 2024-11-24
**Ready for**: Implementation
