# AutomatosX v11 - Product Requirements Document

**Version:** 1.1
**Date:** 2024-11-24
**Author:** Architecture Team
**Status:** Draft - Pending Review

---

## Executive Summary

This PRD defines the complete revamp of AutomatosX from v10.3.3 to v11.0.0. The revamp aims to modernize the codebase using TypeScript with Zod for runtime validation, ReScript for performance-critical algorithms (including future patching engine with ML), and industry best practices for project organization.

### Key Objectives

1. **Modernize Architecture** - Restructure 274 files into a clean, modular monorepo
2. **Simplify Configuration** - Reduce 300+ config keys to sensible defaults with opt-in complexity
3. **Enhance Type Safety** - Unified Zod-based validation with branded types
4. **Performance Optimization** - ReScript for algorithms, future ML-based patching engine
5. **Developer Experience** - Cleaner APIs, better documentation, faster onboarding
6. **MCP-First Integration** - All providers (Claude Code, Gemini CLI, ax-cli) via MCP

### Scope

| Aspect | In Scope | Out of Scope |
|--------|----------|--------------|
| Core Engine | Complete rewrite | - |
| Agent System | Retain 20+ agents, enhance orchestration | Adding new agent types |
| Memory System | FTS5 only | Vector search (future) |
| Providers | Claude Code (MCP), Gemini CLI (MCP), ax-cli (SDK+MCP), OpenAI Codex (Bash) | Other providers |
| CLI | Restructured commands | GUI/Web interface |
| MCP Server | Enhanced integration | Multi-transport protocols |
| Patching Engine | Architecture placeholder | Full ML implementation (future) |

### Key Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backward Compatibility | **No** | Clean-slate design, fresh start |
| ax-cli Integration | **SDK mode** | Use ax-cli SDK for native integration |
| Target Providers | Claude Code, Gemini CLI, ax-cli (MCP); OpenAI Codex (Bash) | OpenAI MCP has bugs |
| Node.js Version | **24+** | Latest features, ES modules |
| Vector Search | **Not now** | Defer to future release |
| ReScript Scope | **Broad** | Routing, DAG, ranking, future ML patching |

---

## 1. Current State Analysis

### 1.1 Codebase Statistics (v10.3.3)

| Metric | Value |
|--------|-------|
| Total Files | 274 TypeScript files |
| Lines of Code | 96,001 |
| Agent Profiles | 20+ YAML definitions |
| Test Suites | 109 unit, integration, e2e |
| Dependencies | 45+ npm packages |
| Configuration Keys | 300+ in ax.config.json |

### 1.2 Architectural Issues Identified

#### Issue 1: Over-Complex Module Structure
```
Current Structure:
src/
├── cli/commands/ (33 separate command files)
├── core/ (54 modules with cross-dependencies)
├── providers/ (17 files with redundant abstractions)
├── integrations/ (5 provider-specific directories)
└── types/ (24 separate type files)
```

**Problem:** High cognitive load, circular dependency risks, difficult to navigate.

#### Issue 2: Dual Validation Systems
- Zod (v4.1.12) for TypeScript validation
- ajv (v8.17.1) for JSON Schema validation
- TypeScript for compile-time checking

**Problem:** Inconsistent validation, maintenance burden, runtime overhead.

#### Issue 3: Configuration Complexity
The `ax.config.json` has 300+ keys across nested objects, making it overwhelming for new users.

#### Issue 4: Provider Abstraction Sprawl
Five different integration patterns with inconsistent implementations.

**Problem:** Each provider has unique code paths, testing complexity.

### 1.3 Strengths to Preserve

1. **Agent System** - Well-designed YAML profiles, personality system
2. **Memory Persistence** - Fast FTS5 search, local-only privacy
3. **Multi-Provider Routing** - Circuit breaker, health checks, fallback
4. **Checkpoint System** - Resumable workflows, delegation tracking
5. **MCP Integration** - 19 tools, Claude Code native support
6. **Test Coverage** - 2,423+ tests, comprehensive suites

---

## 2. Proposed Architecture

### 2.1 Project Structure

```
AutomatosX/
├── packages/                      # Monorepo packages
│   ├── core/                      # Core orchestration engine
│   │   ├── src/
│   │   │   ├── agent/             # Agent execution
│   │   │   ├── memory/            # Memory management (FTS5)
│   │   │   ├── router/            # Provider routing
│   │   │   ├── session/           # Session management
│   │   │   ├── checkpoint/        # Checkpoint system
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                       # CLI application
│   │   ├── src/
│   │   │   ├── commands/          # Grouped commands
│   │   │   │   ├── agent.ts       # ax agent [create|list|update|info]
│   │   │   │   ├── memory.ts      # ax memory [search|list|export|import]
│   │   │   │   ├── run.ts         # ax run <agent> "task"
│   │   │   │   ├── session.ts     # ax session [create|list|complete]
│   │   │   │   ├── spec.ts        # ax spec [run|status]
│   │   │   │   └── system.ts      # ax [status|doctor|config]
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── providers/                 # Provider implementations
│   │   ├── src/
│   │   │   ├── base.ts            # Abstract provider interface
│   │   │   ├── claude.ts          # Claude Code (MCP)
│   │   │   ├── gemini.ts          # Gemini CLI (MCP)
│   │   │   ├── ax-cli.ts          # ax-cli (SDK + MCP)
│   │   │   ├── openai.ts          # OpenAI Codex (Bash mode)
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mcp/                       # MCP server
│   │   ├── src/
│   │   │   ├── server.ts          # Main server
│   │   │   ├── tools/             # MCP tools
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── schemas/                   # Zod schemas (shared)
│   │   ├── src/
│   │   │   ├── agent.ts           # Agent schemas
│   │   │   ├── config.ts          # Config schemas
│   │   │   ├── memory.ts          # Memory schemas
│   │   │   ├── provider.ts        # Provider schemas
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── algorithms/                # ReScript algorithms
│   │   ├── src/
│   │   │   ├── Routing.res        # Multi-factor routing algorithm
│   │   │   ├── DagScheduler.res   # DAG execution scheduler
│   │   │   ├── MemoryRank.res     # Memory relevance ranking
│   │   │   ├── Patching.res       # Future: ML patching engine
│   │   │   └── bindings/          # TypeScript bindings
│   │   ├── rescript.json
│   │   └── package.json
│   │
│   └── patching/                  # Future: ML Patching Engine
│       ├── src/
│       │   ├── engine.ts          # Patching engine orchestrator
│       │   ├── diff.ts            # Diff analysis
│       │   ├── prediction.ts      # ML prediction interface
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── .automatosx/                   # System data (gitignored)
│   ├── agents/                    # Agent profiles (YAML)
│   ├── abilities/                 # Ability definitions
│   ├── memory/                    # SQLite database (FTS5)
│   ├── sessions/                  # Session data
│   ├── checkpoints/               # Checkpoint storage
│   ├── logs/                      # Execution logs
│   └── cache/                     # Cache storage
│
├── templates/                     # Agent & ability templates
├── examples/                      # Example configurations
├── docs/                          # Documentation
│
├── ax.config.json                 # Main configuration
├── package.json                   # Root workspace
├── pnpm-workspace.yaml            # PNPM workspace config
├── tsconfig.base.json             # Base TypeScript config
└── vitest.workspace.ts            # Test workspace
```

### 2.2 Package Dependency Graph

```
                    ┌─────────────────┐
                    │   @ax/schemas   │
                    │  (Zod schemas)  │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  @ax/core    │  │ @ax/providers│  │ @ax/algorithms│
    │              │◄─┤              │  │  (ReScript)   │
    └──────┬───────┘  └──────────────┘  └───────┬───────┘
           │                 │                  │
           │    ┌────────────┴──────────────────┘
           │    │
           ▼    ▼
    ┌──────────────┐         ┌──────────────┐
    │   @ax/cli    │         │   @ax/mcp    │
    │              │         │              │
    └──────────────┘         └──────────────┘
                                    │
                             ┌──────┴──────┐
                             │ @ax/patching│
                             │  (Future)   │
                             └─────────────┘
```

### 2.3 Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| Language | TypeScript 5.4+ | Type safety, ecosystem |
| Runtime | **Node.js 24+** | Latest features, ES modules |
| Validation | Zod 3.x | Runtime types, inference |
| Algorithms | ReScript 11.x | Performance, immutability, ML prep |
| Database | better-sqlite3 | Speed, simplicity |
| Search | **FTS5 only** | Text search (no vector for now) |
| CLI | yargs | Mature, extensible |
| Testing | Vitest | Fast, native ESM |
| Bundler | tsup | Simple, fast |
| Monorepo | pnpm workspaces | Speed, disk efficiency |

---

## 3. Provider Architecture

### 3.1 Provider Integration Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Provider Integration Matrix                   │
├─────────────────┬──────────────┬────────────────────────────────┤
│ Provider        │ Integration  │ Notes                          │
├─────────────────┼──────────────┼────────────────────────────────┤
│ Claude Code     │ MCP          │ Native MCP support             │
│ Gemini CLI      │ MCP          │ MCP auto-configuration         │
│ ax-cli          │ SDK + MCP    │ Use ax-cli SDK for execution   │
│ OpenAI Codex    │ Bash         │ MCP has bugs, use process spawn│
└─────────────────┴──────────────┴────────────────────────────────┘
```

### 3.2 Provider Base Interface

```typescript
// packages/providers/src/base.ts
import { z } from 'zod';

export const ProviderTypeSchema = z.enum(['claude', 'gemini', 'ax-cli', 'openai']);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export const IntegrationModeSchema = z.enum(['mcp', 'sdk', 'bash']);
export type IntegrationMode = z.infer<typeof IntegrationModeSchema>;

export const ExecutionRequestSchema = z.object({
  task: z.string(),
  agent: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  timeout: z.number().default(300000),
  stream: z.boolean().default(false),
});

export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;

export const ExecutionResponseSchema = z.object({
  success: z.boolean(),
  output: z.string(),
  metadata: z.object({
    provider: ProviderTypeSchema,
    integrationMode: IntegrationModeSchema,
    duration: z.number(),
    tokens: z.number().optional(),
  }),
  error: z.string().optional(),
});

export type ExecutionResponse = z.infer<typeof ExecutionResponseSchema>;

export interface ProviderHealth {
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  latencyMs: number;
}

export abstract class BaseProvider {
  abstract readonly id: ProviderType;
  abstract readonly name: string;
  abstract readonly integrationMode: IntegrationMode;

  protected health: ProviderHealth = {
    healthy: true,
    lastCheck: new Date(),
    consecutiveFailures: 0,
    latencyMs: 0,
  };

  abstract execute(request: ExecutionRequest): Promise<ExecutionResponse>;
  abstract checkHealth(): Promise<boolean>;

  getHealth(): ProviderHealth {
    return { ...this.health };
  }

  protected updateHealth(success: boolean, latencyMs: number): void {
    this.health.lastCheck = new Date();
    this.health.latencyMs = latencyMs;

    if (success) {
      this.health.consecutiveFailures = 0;
      this.health.healthy = true;
    } else {
      this.health.consecutiveFailures++;
      if (this.health.consecutiveFailures >= 3) {
        this.health.healthy = false;
      }
    }
  }
}
```

### 3.3 Claude Code Provider (MCP)

```typescript
// packages/providers/src/claude.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BaseProvider, ExecutionRequest, ExecutionResponse } from './base.js';

export class ClaudeProvider extends BaseProvider {
  readonly id = 'claude' as const;
  readonly name = 'Claude Code';
  readonly integrationMode = 'mcp' as const;

  private client: Client | null = null;

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const start = Date.now();

    try {
      const client = await this.getClient();

      const result = await client.callTool({
        name: 'run_task',
        arguments: {
          task: request.task,
          agent: request.agent,
          timeout: request.timeout,
        },
      });

      const duration = Date.now() - start;
      this.updateHealth(true, duration);

      return {
        success: true,
        output: String(result.content[0]?.text ?? ''),
        metadata: {
          provider: this.id,
          integrationMode: this.integrationMode,
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      this.updateHealth(false, duration);

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: this.id,
          integrationMode: this.integrationMode,
          duration,
        },
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async getClient(): Promise<Client> {
    if (!this.client) {
      const transport = new StdioClientTransport({
        command: 'claude',
        args: ['mcp'],
      });

      this.client = new Client({
        name: 'automatosx',
        version: '11.0.0',
      }, {
        capabilities: {},
      });

      await this.client.connect(transport);
    }

    return this.client;
  }
}
```

### 3.4 ax-cli Provider (SDK + MCP)

```typescript
// packages/providers/src/ax-cli.ts
import { AxCliSDK } from '@anthropic/ax-cli-sdk'; // ax-cli SDK
import { BaseProvider, ExecutionRequest, ExecutionResponse } from './base.js';

export class AxCliProvider extends BaseProvider {
  readonly id = 'ax-cli' as const;
  readonly name = 'ax-cli';
  readonly integrationMode = 'sdk' as const;

  private sdk: AxCliSDK | null = null;

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const start = Date.now();

    try {
      const sdk = await this.getSDK();

      // Use ax-cli SDK for execution
      const result = await sdk.execute({
        prompt: request.task,
        agent: request.agent,
        timeout: request.timeout,
        stream: request.stream,
        // SDK handles MCP internally
        useMcp: true,
      });

      const duration = Date.now() - start;
      this.updateHealth(true, duration);

      return {
        success: result.success,
        output: result.output,
        metadata: {
          provider: this.id,
          integrationMode: this.integrationMode,
          duration,
          tokens: result.tokensUsed,
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      this.updateHealth(false, duration);

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: this.id,
          integrationMode: this.integrationMode,
          duration,
        },
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const sdk = await this.getSDK();
      return await sdk.healthCheck();
    } catch {
      return false;
    }
  }

  private async getSDK(): Promise<AxCliSDK> {
    if (!this.sdk) {
      this.sdk = new AxCliSDK({
        // SDK configuration
        enableCheckpoints: true,
        enableSubagents: true,
      });
      await this.sdk.initialize();
    }

    return this.sdk;
  }
}
```

### 3.5 OpenAI Codex Provider (Bash Mode)

```typescript
// packages/providers/src/openai.ts
import { spawn } from 'node:child_process';
import { BaseProvider, ExecutionRequest, ExecutionResponse } from './base.js';

/**
 * OpenAI Codex Provider - Uses Bash mode due to MCP bugs
 *
 * Note: OpenAI's MCP implementation has known issues.
 * Using process spawn (bash mode) for reliability.
 */
export class OpenAIProvider extends BaseProvider {
  readonly id = 'openai' as const;
  readonly name = 'OpenAI Codex';
  readonly integrationMode = 'bash' as const;

  private command = 'codex';

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const start = Date.now();

    try {
      const output = await this.runCommand(request.task, request.timeout);
      const duration = Date.now() - start;

      this.updateHealth(true, duration);

      return {
        success: true,
        output,
        metadata: {
          provider: this.id,
          integrationMode: this.integrationMode,
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      this.updateHealth(false, duration);

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: this.id,
          integrationMode: this.integrationMode,
          duration,
        },
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const output = await this.runCommand('--version', 5000);
      return output.includes('codex') || output.includes('openai');
    } catch {
      return false;
    }
  }

  private runCommand(input: string, timeout = 300000): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.command, ['-p', input], {
        timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data; });
      proc.stderr.on('data', (data) => { stderr += data; });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Process exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }
}
```

### 3.6 Gemini CLI Provider (MCP)

```typescript
// packages/providers/src/gemini.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BaseProvider, ExecutionRequest, ExecutionResponse } from './base.js';

export class GeminiProvider extends BaseProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Gemini CLI';
  readonly integrationMode = 'mcp' as const;

  private client: Client | null = null;

  async execute(request: ExecutionRequest): Promise<ExecutionResponse> {
    const start = Date.now();

    try {
      const client = await this.getClient();

      const result = await client.callTool({
        name: 'execute',
        arguments: {
          prompt: request.task,
          agent: request.agent,
        },
      });

      const duration = Date.now() - start;
      this.updateHealth(true, duration);

      return {
        success: true,
        output: String(result.content[0]?.text ?? ''),
        metadata: {
          provider: this.id,
          integrationMode: this.integrationMode,
          duration,
        },
      };
    } catch (error) {
      const duration = Date.now() - start;
      this.updateHealth(false, duration);

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          provider: this.id,
          integrationMode: this.integrationMode,
          duration,
        },
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async getClient(): Promise<Client> {
    if (!this.client) {
      const transport = new StdioClientTransport({
        command: 'gemini',
        args: ['mcp'],
      });

      this.client = new Client({
        name: 'automatosx',
        version: '11.0.0',
      }, {
        capabilities: {},
      });

      await this.client.connect(transport);
    }

    return this.client;
  }
}
```

---

## 4. Technical Specifications

### 4.1 Schema System (Zod-Only)

Remove ajv dependency. Use Zod exclusively for all validation.

```typescript
// packages/schemas/src/agent.ts
import { z } from 'zod';

// Branded types for type safety
export const AgentId = z.string().brand<'AgentId'>();
export type AgentId = z.infer<typeof AgentId>;

export const PersonalitySchema = z.object({
  traits: z.array(z.string()).min(1).max(5),
  catchphrase: z.string().optional(),
  communicationStyle: z.enum(['formal', 'casual', 'technical']).default('technical'),
  decisionMaking: z.enum(['data-driven', 'intuitive', 'collaborative']).default('data-driven'),
});

export const AbilitySelectionSchema = z.object({
  core: z.array(z.string()).default([]),
  taskBased: z.record(z.string(), z.array(z.string())).default({}),
});

export const OrchestrationSchema = z.object({
  maxDelegationDepth: z.number().int().min(0).max(3).default(0),
  canReadWorkspaces: z.array(z.string()).default([]),
  canWriteToShared: z.boolean().default(false),
});

export const AgentProfileSchema = z.object({
  name: AgentId,
  displayName: z.string().min(1).max(50),
  role: z.string().min(1).max(100),
  team: z.string().default('default'),
  description: z.string().optional(),
  abilities: z.array(z.string()).default([]),
  abilitySelection: AbilitySelectionSchema.optional(),
  personality: PersonalitySchema.optional(),
  orchestration: OrchestrationSchema.default({}),
  systemPrompt: z.string().min(10),
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;
```

### 4.2 Configuration Simplification

```typescript
// packages/schemas/src/config.ts
import { z } from 'zod';

export const ProviderConfigSchema = z.object({
  default: z.enum(['claude', 'gemini', 'ax-cli', 'openai']).default('claude'),
  enabled: z.array(z.enum(['claude', 'gemini', 'ax-cli', 'openai'])).default(['claude']),
  fallbackOrder: z.array(z.enum(['claude', 'gemini', 'ax-cli', 'openai'])).optional(),
});

export const ConfigSchema = z.object({
  providers: ProviderConfigSchema.default({}),

  execution: z.object({
    timeout: z.number().default(300000), // 5 minutes
    maxRetries: z.number().default(3),
    concurrency: z.number().default(4),
  }).default({}),

  memory: z.object({
    enabled: z.boolean().default(true),
    maxEntries: z.number().default(10000),
    retentionDays: z.number().default(30),
    cleanupStrategy: z.enum(['oldest', 'least_accessed', 'hybrid']).default('hybrid'),
  }).default({}),

  workspace: z.object({
    prdPath: z.string().default('automatosx/PRD'),
    tmpPath: z.string().default('automatosx/tmp'),
  }).default({}),

  router: z.object({
    healthCheckInterval: z.number().default(60000),
    circuitBreakerThreshold: z.number().default(3),
    cooldownMs: z.number().default(30000),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
```

**Example ax.config.json (minimal):**
```json
{
  "providers": {
    "default": "claude"
  }
}
```

**Example ax.config.json (full):**
```json
{
  "providers": {
    "default": "claude",
    "enabled": ["claude", "gemini", "ax-cli"],
    "fallbackOrder": ["claude", "ax-cli", "gemini"]
  },
  "execution": {
    "timeout": 600000,
    "concurrency": 8
  },
  "memory": {
    "retentionDays": 90
  }
}
```

### 4.3 ReScript Algorithms

Performance-critical algorithms in ReScript:
1. **Multi-factor routing** - Provider selection algorithm
2. **DAG scheduling** - Parallel task execution planning
3. **Memory ranking** - Relevance scoring for search results
4. **Future: Patching engine** - ML-based code patching algorithms

```rescript
// packages/algorithms/src/Routing.res

type provider = {
  id: string,
  priority: int,
  healthy: bool,
  rateLimit: float,  // 0.0 - 1.0 (usage ratio)
  latencyMs: int,
  successRate: float,
  integrationMode: string, // "mcp" | "sdk" | "bash"
}

type routingContext = {
  taskType: string,
  complexity: int,  // 1-10
  preferMcp: bool,  // Prefer MCP providers
}

// Multi-factor scoring algorithm
let calculateScore = (provider: provider, ctx: routingContext): float => {
  if (!provider.healthy) {
    -1000.0  // Effectively disable unhealthy providers
  } else {
    let priorityScore = 100.0 -. float_of_int(provider.priority) *. 10.0
    let rateLimitScore = (1.0 -. provider.rateLimit) *. 50.0
    let latencyScore = 50.0 -. float_of_int(provider.latencyMs) /. 100.0
    let successScore = provider.successRate *. 100.0

    // Prefer MCP providers when requested
    let mcpBonus = if ctx.preferMcp && provider.integrationMode == "mcp" {
      25.0
    } else {
      0.0
    }

    priorityScore +. rateLimitScore +. latencyScore +. successScore +. mcpBonus
  }
}

// Select best provider
let selectProvider = (providers: array<provider>, ctx: routingContext): option<provider> => {
  providers
  ->Array.map(p => (p, calculateScore(p, ctx)))
  ->Array.filter(((_, score)) => score > 0.0)
  ->Array.toSorted(((_, a), (_, b)) =>
      if a > b { -1.0 } else if a < b { 1.0 } else { 0.0 }
    )
  ->Array.get(0)
  ->Option.map(((p, _)) => p)
}
```

```rescript
// packages/algorithms/src/DagScheduler.res

type dagNode = {
  id: string,
  deps: array<string>,
  estimatedDuration: int,
}

type scheduleGroup = {
  nodes: array<string>,
  parallelizable: bool,
}

// Topological sort with parallel grouping
let scheduleParallel = (nodes: array<dagNode>): array<scheduleGroup> => {
  let remaining = ref(nodes)
  let completed = ref(Set.make())
  let schedule = ref([])

  while Array.length(remaining.contents) > 0 {
    // Find all nodes whose dependencies are complete
    let ready = remaining.contents
      ->Array.filter(node =>
          node.deps->Array.every(dep =>
            completed.contents->Set.has(dep)
          )
        )

    if Array.length(ready) == 0 {
      Exn.raiseError("Cycle detected in DAG")
    }

    let readyIds = ready->Array.map(n => n.id)

    schedule.contents = schedule.contents->Array.concat([{
      nodes: readyIds,
      parallelizable: Array.length(readyIds) > 1,
    }])

    completed.contents = readyIds->Array.reduce(completed.contents, (set, id) =>
      set->Set.add(id)
    )

    remaining.contents = remaining.contents->Array.filter(n =>
      !(readyIds->Array.includes(n.id))
    )
  }

  schedule.contents
}
```

```rescript
// packages/algorithms/src/Patching.res
// Future: ML-based patching engine

type patchType =
  | Addition
  | Deletion
  | Modification
  | Refactor

type codePatch = {
  id: string,
  patchType: patchType,
  startLine: int,
  endLine: int,
  originalContent: string,
  patchedContent: string,
  confidence: float,  // 0.0 - 1.0 (ML confidence score)
}

type patchContext = {
  fileType: string,
  surroundingLines: int,
  semanticContext: string,
}

// Placeholder for future ML integration
// Will use ReScript for efficient patch diffing and ranking
let rankPatches = (patches: array<codePatch>): array<codePatch> => {
  patches
  ->Array.toSorted((a, b) =>
      if a.confidence > b.confidence { -1.0 }
      else if a.confidence < b.confidence { 1.0 }
      else { 0.0 }
    )
}

// Future: ML model inference interface
type mlModel = {
  predict: (. patchContext, string) => array<codePatch>,
}

// Will be implemented when ML integration is added
let applyMlPrediction = (_model: mlModel, _context: patchContext, _code: string): array<codePatch> => {
  [] // Placeholder
}
```

### 4.4 Memory System (FTS5 Only)

```typescript
// packages/core/src/memory/manager.ts
import Database from 'better-sqlite3';
import { z } from 'zod';

export const MemoryEntrySchema = z.object({
  id: z.number(),
  content: z.string(),
  metadata: z.object({
    type: z.enum(['conversation', 'code', 'document', 'task']),
    source: z.string(),
    agentId: z.string().optional(),
    sessionId: z.string().optional(),
    tags: z.array(z.string()).optional(),
    importance: z.number().min(0).max(1).optional(),
  }),
  createdAt: z.date(),
  lastAccessedAt: z.date().optional(),
  accessCount: z.number().default(0),
});

export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  filter?: {
    type?: string;
    agentId?: string;
    tags?: string[];
    minImportance?: number;
  };
}

export class MemoryManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');

    // Create tables - FTS5 only, no vector search
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TEXT,
        access_count INTEGER DEFAULT 0
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
        USING fts5(content, metadata, content=memories, content_rowid=id);

      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, metadata)
        VALUES (new.id, new.content, new.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, metadata)
        VALUES ('delete', old.id, old.content, old.metadata);
      END;

      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_memories_access ON memories(access_count, last_accessed_at);
    `);
  }

  async add(content: string, metadata: MemoryEntry['metadata']): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO memories (content, metadata)
      VALUES (?, ?)
    `);

    const result = stmt.run(content, JSON.stringify(metadata));
    return result.lastInsertRowid as number;
  }

  async search(options: SearchOptions): Promise<MemoryEntry[]> {
    const { query, limit = 10, offset = 0, filter } = options;

    let sql = `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories m
      JOIN memories_fts ON m.id = memories_fts.rowid
      WHERE memories_fts MATCH ?
    `;

    const params: unknown[] = [this.sanitizeQuery(query)];

    if (filter?.type) {
      sql += ` AND json_extract(m.metadata, '$.type') = ?`;
      params.push(filter.type);
    }

    if (filter?.agentId) {
      sql += ` AND json_extract(m.metadata, '$.agentId') = ?`;
      params.push(filter.agentId);
    }

    sql += ` ORDER BY rank LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<Record<string, unknown>>;

    this.updateAccessTracking(rows.map(r => r.id as number));

    return rows.map(this.rowToEntry);
  }

  private sanitizeQuery(query: string): string {
    return query.replace(/[*"(){}[\]^~\\:]/g, ' ').trim();
  }

  private updateAccessTracking(ids: number[]): void {
    if (ids.length === 0) return;

    const stmt = this.db.prepare(`
      UPDATE memories
      SET access_count = access_count + 1,
          last_accessed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const tx = this.db.transaction(() => {
      for (const id of ids) {
        stmt.run(id);
      }
    });

    tx();
  }

  private rowToEntry(row: Record<string, unknown>): MemoryEntry {
    return MemoryEntrySchema.parse({
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata as string),
      createdAt: new Date(row.created_at as string),
      lastAccessedAt: row.last_accessed_at
        ? new Date(row.last_accessed_at as string)
        : undefined,
      accessCount: row.access_count ?? 0,
    });
  }
}
```

---

## 5. Features Specification

### 5.1 Features to Retain

| Feature | Reason |
|---------|--------|
| 20+ Agent Profiles | Well-designed, proven useful |
| YAML Agent Format | Easy to edit, extensible |
| FTS5 Search | Fast, reliable, zero-cost |
| Checkpoint System | Essential for long tasks |
| MCP Integration | Primary integration method |
| Circuit Breaker | Reliability pattern |

### 5.2 Features to Enhance

| Feature | Current | Proposed Enhancement |
|---------|---------|----------------------|
| Configuration | 300+ keys | Tiered config (simplified) |
| Type Validation | Zod + ajv | Zod-only with branded types |
| Provider Routing | Ad-hoc scoring | ReScript multi-factor algorithm |
| CLI Commands | 33 flat commands | Grouped subcommands |
| Error Messages | Basic | Structured with recovery suggestions |

### 5.3 Features to Deprecate/Remove

| Feature | Reason |
|---------|--------|
| ajv JSON Schema | Redundant with Zod |
| Legacy provider modes | Using MCP/SDK/Bash only |
| Iterate mode hooks | Rarely used |
| Team configurations | Over-engineered |
| Vector search | Deferred to future |
| Backward compatibility | Clean-slate design |

### 5.4 Future Features (Architecture Placeholder)

| Feature | Description | Phase |
|---------|-------------|-------|
| Patching Engine | ML-based code patching | v11.x |
| Vector Search | Semantic search via embeddings | v12.x |
| Plugin System | Extensible provider hooks | v12.x |

---

## 6. CLI Command Structure

```
ax
├── run <agent> "task"         # Execute agent
├── agent                      # Agent management
│   ├── list                   # List agents
│   ├── info <name>            # Show agent details
│   ├── create                 # Create agent
│   └── update <name>          # Update agent
├── memory                     # Memory management
│   ├── search "query"         # Search memory (FTS5)
│   ├── list                   # List recent
│   ├── export                 # Export backup
│   ├── import                 # Import backup
│   └── stats                  # View statistics
├── session                    # Session management
│   ├── create                 # Start session
│   ├── list                   # List sessions
│   └── complete               # End session
├── spec                       # Workflow execution
│   ├── run                    # Execute spec
│   └── status                 # Show status
├── provider                   # Provider management
│   ├── list                   # List providers
│   ├── status                 # Health status
│   └── test <name>            # Test provider
├── status                     # System status
├── config                     # Configuration
│   ├── show                   # Show config
│   └── set <key> <value>      # Set value
├── doctor                     # Diagnostics
└── mcp                        # Start MCP server
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation
- Set up monorepo structure with pnpm
- Create @ax/schemas package with Zod schemas
- Implement @ax/core with memory manager (FTS5)
- Basic provider abstraction

**Deliverables:**
- Working monorepo build
- Validated schema system
- Memory manager with FTS5

### Phase 2: Providers
- Implement Claude Code provider (MCP)
- Implement Gemini CLI provider (MCP)
- Implement ax-cli provider (SDK)
- Implement OpenAI Codex provider (Bash)
- Add ReScript routing algorithm

**Deliverables:**
- All 4 providers working
- Multi-provider routing
- Integration tests passing

### Phase 3: CLI & Core Features
- Implement CLI commands
- Agent execution flow
- Session management
- Checkpoint system

**Deliverables:**
- Fully functional CLI
- `ax run` working
- Session/checkpoint working

### Phase 4: MCP Server & Integration
- MCP server implementation
- Auto-installation for providers
- E2E tests
- Documentation

**Deliverables:**
- MCP server working
- Provider integrations complete
- Documentation complete

### Phase 5: Polish & Release
- Performance optimization
- Bug fixes
- Release preparation

**Deliverables:**
- v11.0.0 release
- Updated documentation

### Future Phase: Patching Engine
- ML model integration
- ReScript patching algorithms
- Code analysis tools

---

## 8. Success Metrics

### 8.1 Technical Metrics

| Metric | Target |
|--------|--------|
| Build time | < 30 seconds |
| Test suite runtime | < 2 minutes |
| Bundle size (CLI) | < 5MB |
| Memory usage (idle) | < 50MB |
| Node.js version | 24+ |

### 8.2 Code Quality Metrics

| Metric | Target |
|--------|--------|
| TypeScript strict mode | Enabled |
| ESLint errors | 0 |
| Test coverage | > 85% |
| Cyclomatic complexity | < 10 per function |

---

## Appendix A: Dependency Changes

### Removed Dependencies
- `ajv` (replaced by Zod)
- `effect` (simplify async handling)
- `sqlite-vec` (no vector search)

### Core Dependencies
- `zod` ^3.23.x
- `better-sqlite3` ^11.x
- `yargs` ^18.x
- `@modelcontextprotocol/sdk` ^1.x
- `typescript` ^5.4+
- `@rescript/core` ^1.x

### Dev Dependencies
- `vitest` ^2.x
- `tsup` ^8.x
- `tsx` ^4.x

---

## Appendix B: Provider Comparison

| Provider | Mode | Reliability | Speed | Features |
|----------|------|-------------|-------|----------|
| Claude Code | MCP | High | Fast | Full MCP tools |
| Gemini CLI | MCP | High | Fast | MCP support |
| ax-cli | SDK+MCP | High | Fast | Checkpoints, subagents |
| OpenAI Codex | Bash | Medium | Medium | Basic (MCP buggy) |

---

**Document Status:** Draft - Updated with User Requirements
**Version:** 1.1
**Next Steps:** Begin Phase 1 implementation
