# CLI ⇄ TypeScript Bridge Interface Design

**Sprint 2 Day 11 Deliverable**
**Purpose**: Define the translation layer between CLI and TypeScript handlers with Zod-based runtime validation
**Owner**: CLI/TypeScript Squad (TS1, TS2, TS3)

---

## Executive Summary

The CLI Bridge is the critical integration layer that:
1. **Translates** CLI arguments → TypeScript data structures
2. **Validates** all inputs with Zod schemas before processing
3. **Consumes** ReScript-generated types for state machine integration
4. **Streams** realtime output to users (logs, progress, results)
5. **Handles** errors gracefully with user-friendly messages

**Architecture Pattern**:
```
CLI Command → Zod Validation → TS Handler → ReScript Runtime → Response Formatter → User
```

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Zod Schema Patterns](#zod-schema-patterns)
3. [Top 5 CLI Commands Schemas](#top-5-cli-commands-schemas)
4. [ReScript Type Integration](#rescript-type-integration)
5. [Error Envelope Structure](#error-envelope-structure)
6. [Streaming Logger Interface](#streaming-logger-interface)
7. [Type Generation Pipeline](#type-generation-pipeline)
8. [Implementation Plan](#implementation-plan)

---

## Architecture Overview

### High-Level Data Flow

```
┌─────────────────┐
│   CLI Layer     │  (oclif / commander + ink for TUI)
│                 │
│  ax run backend │
│  "Implement X"  │
└────────┬────────┘
         │
         │ Parse flags/args
         ▼
┌─────────────────┐
│  Zod Validation │  Runtime schema enforcement
│                 │
│  CommandSchema  │  ← Validate all inputs
│  .parse(args)   │  ← Type-safe at runtime
└────────┬────────┘
         │
         │ Validated data
         ▼
┌─────────────────┐
│  TS Handler     │  Business logic layer
│                 │
│  runAgent()     │  ← Orchestrate execution
│  memorySearch() │  ← Service integrations
└────────┬────────┘
         │
         │ Call ReScript runtime
         ▼
┌─────────────────┐
│ ReScript Core   │  Compiled .bs.js modules
│                 │
│ StateMachine    │  ← Deterministic transitions
│ RuleEngine      │  ← Decision logic
│ EffectRuntime   │  ← Async operations
└────────┬────────┘
         │
         │ Results + Effects
         ▼
┌─────────────────┐
│ Response Format │  Streaming or batch output
│                 │
│ StreamingLogger │  ← Realtime updates
│ ErrorEnvelope   │  ← User-friendly errors
└────────┬────────┘
         │
         │ Display to user
         ▼
┌─────────────────┐
│   User Output   │  Terminal rendering
│                 │
│  stdout/stderr  │
│  ANSI colors    │
└─────────────────┘
```

### Component Responsibilities

**CLI Layer**:
- Parse command-line arguments with oclif/commander
- Render TUI with ink (for interactive commands)
- Delegate to bridge for validation

**Zod Validation Layer**:
- Runtime type checking (catches invalid inputs before processing)
- Schema definitions for all CLI commands
- Generate TypeScript types from Zod schemas

**TypeScript Handler Layer**:
- Business logic orchestration
- Service integrations (HTTP, file I/O, NATS, database)
- Consume ReScript types via `.bs.js` imports

**ReScript Runtime**:
- Core state machines (deterministic task orchestration)
- Rule engine (agent decision-making)
- Effect handling (async operations, retry logic)

**Response Formatting**:
- Streaming logger for realtime feedback
- Error envelopes for user-friendly messages
- ANSI color formatting for terminal

---

## Zod Schema Patterns

### Pattern 1: Basic Command Schema

All CLI commands follow this base structure:

```typescript
import { z } from 'zod'

// Base schema for all commands
export const BaseCommandSchema = z.object({
  // Global flags available to all commands
  debug: z.boolean().optional().default(false),
  verbose: z.boolean().optional().default(false),
  quiet: z.boolean().optional().default(false),
  json: z.boolean().optional().default(false), // JSON output mode
})

// Infer TypeScript type from schema
export type BaseCommand = z.infer<typeof BaseCommandSchema>
```

### Pattern 2: String Validation with Constraints

```typescript
// Agent name validation
export const AgentNameSchema = z.string()
  .min(1, "Agent name cannot be empty")
  .max(50, "Agent name too long (max 50 chars)")
  .regex(/^[a-z][a-z0-9-]*$/, "Agent name must be lowercase alphanumeric with hyphens")
  .refine(
    (name) => !name.startsWith('-') && !name.endsWith('-'),
    "Agent name cannot start or end with hyphen"
  )

// Task description validation
export const TaskDescriptionSchema = z.string()
  .min(3, "Task description too short (min 3 chars)")
  .max(5000, "Task description too long (max 5000 chars)")
  .refine(
    (task) => task.trim().length > 0,
    "Task description cannot be only whitespace"
  )
```

### Pattern 3: Enum Validation

```typescript
// Provider selection
export const ProviderSchema = z.enum([
  'claude',
  'claude-code',
  'gemini',
  'gemini-cli',
  'openai',
  'gpt'
], {
  errorMap: () => ({ message: "Invalid provider. Must be one of: claude, gemini, openai" })
})

// Output format
export const OutputFormatSchema = z.enum(['text', 'json', 'table', 'yaml'], {
  errorMap: () => ({ message: "Invalid format. Must be: text, json, table, or yaml" })
})
```

### Pattern 4: Nested Object Validation

```typescript
// Memory query options
export const MemoryQueryOptionsSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  agent: AgentNameSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
})

export type MemoryQueryOptions = z.infer<typeof MemoryQueryOptionsSchema>
```

### Pattern 5: Union Types for Conditional Schemas

```typescript
// Run command can be --streaming OR --resumable, but not both
export const RunCommandFlagsSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('streaming'),
    streaming: z.literal(true),
    parallel: z.boolean().optional(),
  }),
  z.object({
    mode: z.literal('resumable'),
    resumable: z.literal(true),
    checkpointInterval: z.number().positive().default(60000), // 1 minute
  }),
  z.object({
    mode: z.literal('default'),
  }),
])
```

### Pattern 6: Custom Validators with `.refine()`

```typescript
// File path validation
export const FilePathSchema = z.string()
  .min(1, "File path cannot be empty")
  .refine(
    (path) => !path.includes('..'),
    "File path cannot contain '..' (directory traversal)"
  )
  .refine(
    async (path) => {
      try {
        await fs.access(path)
        return true
      } catch {
        return false
      }
    },
    "File does not exist or is not accessible"
  )
```

---

## Top 5 CLI Commands Schemas

### 1. `ax run` - Execute Agent Task

**Command**: `ax run <agent> "<task>" [flags]`

**Zod Schema**:

```typescript
// src/cli/schemas/RunCommandSchema.ts
import { z } from 'zod'
import { AgentNameSchema, TaskDescriptionSchema, ProviderSchema } from './common'

export const RunCommandSchema = z.object({
  // Positional arguments
  agent: AgentNameSchema,
  task: TaskDescriptionSchema,

  // Optional flags
  streaming: z.boolean().optional().default(false),
  parallel: z.boolean().optional().default(false),
  resumable: z.boolean().optional().default(false),

  // Provider override
  provider: ProviderSchema.optional(),

  // Timeout in milliseconds
  timeout: z.number().int().positive().max(30 * 60 * 1000).optional(), // Max 30 min

  // Memory context
  useMemory: z.boolean().optional().default(true),
  memoryLimit: z.number().int().positive().max(50).optional().default(10),

  // Output control
  verbose: z.boolean().optional().default(false),
  debug: z.boolean().optional().default(false),
  quiet: z.boolean().optional().default(false),
  json: z.boolean().optional().default(false),
})

export type RunCommand = z.infer<typeof RunCommandSchema>

// Usage example:
// const parsed = RunCommandSchema.parse({
//   agent: 'backend',
//   task: 'Implement user authentication',
//   streaming: true,
//   provider: 'claude',
// })
```

**TypeScript Handler**:

```typescript
// src/cli/handlers/runCommand.ts
import { RunCommandSchema, RunCommand } from '../schemas/RunCommandSchema'
import { AgentOrchestrator } from '../../services/AgentOrchestrator'
import { StreamingLogger } from '../../utils/StreamingLogger'

export async function runCommand(rawArgs: unknown): Promise<void> {
  // 1. Validate inputs with Zod
  let args: RunCommand
  try {
    args = RunCommandSchema.parse(rawArgs)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid command arguments', error.errors)
    }
    throw error
  }

  // 2. Initialize streaming logger if requested
  const logger = args.streaming ? new StreamingLogger() : null

  // 3. Execute via orchestrator (integrates with ReScript runtime)
  const orchestrator = new AgentOrchestrator({
    agentName: args.agent,
    provider: args.provider,
    useMemory: args.useMemory,
    logger,
  })

  try {
    const result = await orchestrator.execute(args.task, {
      timeout: args.timeout,
      parallel: args.parallel,
      resumable: args.resumable,
    })

    // 4. Format output
    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(result.output)
    }
  } catch (error) {
    throw new ExecutionError(`Agent execution failed: ${error.message}`, { cause: error })
  }
}
```

---

### 2. `ax memory search` - Search Memory Database

**Command**: `ax memory search "<query>" [flags]`

**Zod Schema**:

```typescript
// src/cli/schemas/MemorySearchSchema.ts
import { z } from 'zod'
import { AgentNameSchema, OutputFormatSchema } from './common'

export const MemorySearchSchema = z.object({
  // Positional argument
  query: z.string().min(1, "Search query cannot be empty").max(500),

  // Optional filters
  agent: AgentNameSchema.optional(),
  limit: z.number().int().positive().max(100).default(10),
  offset: z.number().int().nonnegative().default(0),

  // Date range filters
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),

  // Tag filtering
  tags: z.array(z.string()).optional(),

  // Output formatting
  format: OutputFormatSchema.default('text'),
  verbose: z.boolean().optional().default(false),
})

export type MemorySearch = z.infer<typeof MemorySearchSchema>

// FTS5 query builder integration
export const MemorySearchQuerySchema = z.object({
  matchQuery: z.string(), // FTS5 MATCH syntax
  limit: z.number(),
  offset: z.number(),
  filters: z.object({
    agent: z.string().optional(),
    dateRange: z.object({
      from: z.date().optional(),
      to: z.date().optional(),
    }).optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
})
```

**TypeScript Handler**:

```typescript
// src/cli/handlers/memorySearchCommand.ts
import { MemorySearchSchema, MemorySearch } from '../schemas/MemorySearchSchema'
import { MemoryService } from '../../services/MemoryService'

export async function memorySearchCommand(rawArgs: unknown): Promise<void> {
  // Validate
  const args = MemorySearchSchema.parse(rawArgs)

  // Execute FTS5 query
  const memoryService = new MemoryService()
  const results = await memoryService.search({
    query: args.query,
    limit: args.limit,
    offset: args.offset,
    agent: args.agent,
    dateFrom: args.dateFrom ? new Date(args.dateFrom) : undefined,
    dateTo: args.dateTo ? new Date(args.dateTo) : undefined,
    tags: args.tags,
  })

  // Format output
  switch (args.format) {
    case 'json':
      console.log(JSON.stringify(results, null, 2))
      break
    case 'table':
      printTable(results)
      break
    case 'text':
    default:
      printTextResults(results, args.verbose)
  }
}
```

---

### 3. `ax list agents` - List Available Agents

**Command**: `ax list agents [flags]`

**Zod Schema**:

```typescript
// src/cli/schemas/ListAgentsSchema.ts
import { z } from 'zod'
import { OutputFormatSchema } from './common'

export const ListAgentsSchema = z.object({
  // Filtering
  category: z.enum(['development', 'operations', 'leadership', 'creative', 'all']).optional().default('all'),
  enabled: z.boolean().optional(), // Filter by enabled status

  // Sorting
  sortBy: z.enum(['name', 'category', 'priority']).optional().default('name'),

  // Output
  format: OutputFormatSchema.default('table'),
  verbose: z.boolean().optional().default(false),
})

export type ListAgents = z.infer<typeof ListAgentsSchema>
```

**TypeScript Handler**:

```typescript
// src/cli/handlers/listAgentsCommand.ts
import { ListAgentsSchema } from '../schemas/ListAgentsSchema'
import { AgentCatalog } from '../../services/AgentCatalog'

export async function listAgentsCommand(rawArgs: unknown): Promise<void> {
  const args = ListAgentsSchema.parse(rawArgs)

  // Load agent catalog
  const catalog = new AgentCatalog()
  let agents = await catalog.loadAll()

  // Apply filters
  if (args.category !== 'all') {
    agents = agents.filter(a => a.category === args.category)
  }
  if (args.enabled !== undefined) {
    agents = agents.filter(a => a.enabled === args.enabled)
  }

  // Sort
  agents.sort((a, b) => {
    switch (args.sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'category': return a.category.localeCompare(b.category)
      case 'priority': return b.priority - a.priority
      default: return 0
    }
  })

  // Format output
  switch (args.format) {
    case 'json':
      console.log(JSON.stringify(agents, null, 2))
      break
    case 'table':
      printAgentTable(agents, args.verbose)
      break
    case 'text':
    default:
      agents.forEach(a => {
        console.log(`${a.name} (${a.category})${args.verbose ? ' - ' + a.description : ''}`)
      })
  }
}
```

---

### 4. `ax status` - Show System Status

**Command**: `ax status [flags]`

**Zod Schema**:

```typescript
// src/cli/schemas/StatusSchema.ts
import { z } from 'zod'
import { OutputFormatSchema } from './common'

export const StatusSchema = z.object({
  // Health check components
  checkMemory: z.boolean().optional().default(true),
  checkProviders: z.boolean().optional().default(true),
  checkAgents: z.boolean().optional().default(true),

  // Output
  format: OutputFormatSchema.default('text'),
  verbose: z.boolean().optional().default(false),
})

export type Status = z.infer<typeof StatusSchema>
```

**TypeScript Handler**:

```typescript
// src/cli/handlers/statusCommand.ts
import { StatusSchema } from '../schemas/StatusSchema'
import { SystemHealthCheck } from '../../services/SystemHealthCheck'

export async function statusCommand(rawArgs: unknown): Promise<void> {
  const args = StatusSchema.parse(rawArgs)

  const healthCheck = new SystemHealthCheck()
  const status = await healthCheck.run({
    checkMemory: args.checkMemory,
    checkProviders: args.checkProviders,
    checkAgents: args.checkAgents,
  })

  switch (args.format) {
    case 'json':
      console.log(JSON.stringify(status, null, 2))
      break
    case 'text':
    default:
      printHealthStatus(status, args.verbose)
  }
}
```

---

### 5. `ax config show` - Display Configuration

**Command**: `ax config show [key] [flags]`

**Zod Schema**:

```typescript
// src/cli/schemas/ConfigShowSchema.ts
import { z } from 'zod'
import { OutputFormatSchema } from './common'

export const ConfigShowSchema = z.object({
  // Optional key to show specific config value
  key: z.string().optional(),

  // Output
  format: OutputFormatSchema.default('text'),
  verbose: z.boolean().optional().default(false),
})

export type ConfigShow = z.infer<typeof ConfigShowSchema>
```

**TypeScript Handler**:

```typescript
// src/cli/handlers/configShowCommand.ts
import { ConfigShowSchema } from '../schemas/ConfigShowSchema'
import { ConfigService } from '../../services/ConfigService'

export async function configShowCommand(rawArgs: unknown): Promise<void> {
  const args = ConfigShowSchema.parse(rawArgs)

  const configService = new ConfigService()
  const config = await configService.load()

  if (args.key) {
    const value = config.get(args.key)
    if (value === undefined) {
      throw new NotFoundError(`Config key "${args.key}" not found`)
    }
    console.log(args.format === 'json' ? JSON.stringify(value, null, 2) : String(value))
  } else {
    switch (args.format) {
      case 'json':
        console.log(JSON.stringify(config.getAll(), null, 2))
        break
      case 'yaml':
        console.log(yaml.stringify(config.getAll()))
        break
      case 'text':
      default:
        printConfigTree(config.getAll(), args.verbose)
    }
  }
}
```

---

## ReScript Type Integration

### Consuming ReScript-Generated Types

ReScript compiles to `.bs.js` files with TypeScript definitions (`.d.ts` via `genType`).

**Example: State Machine Types**:

```rescript
// packages/rescript-core/src/runtime/StateMachine.res
@genType
type state =
  | @as("Idle") Idle
  | @as("Preparing") Preparing
  | @as("Executing") Executing
  | @as("Completed") Completed
  | @as("Failed") Failed

@genType
type event =
  | @as("TaskSubmitted") TaskSubmitted({taskId: string})
  | @as("DependenciesReady") DependenciesReady
  | @as("Timeout") Timeout(int)

@genType
let transition: (state, event) => transitionOutcome
```

**TypeScript Consumption**:

```typescript
// src/services/AgentOrchestrator.ts
import * as StateMachine from '../../packages/rescript-core/src/runtime/StateMachine.bs.js'

// Use ReScript types directly
type State = StateMachine.state
type Event = StateMachine.event

class AgentOrchestrator {
  private currentState: State = "Idle"

  async handleEvent(event: Event): Promise<void> {
    // Call ReScript transition function
    const outcome = StateMachine.transition(this.currentState, event)

    if (outcome.status === "Transitioned") {
      this.currentState = outcome.toState
      await this.executeEffects(outcome.effects)
    }
  }
}
```

### Type Generation Pipeline

```bash
# ReScript compilation
npm run build:rescript
# → Generates .bs.js files with @genType annotations → .gen.tsx types

# TypeScript compilation
npm run build:typescript
# → Consumes .bs.js modules + generated types

# Zod schema generation (optional)
npm run generate:zod-schemas
# → Generate Zod schemas from TypeScript types via ts-to-zod
```

---

## Error Envelope Structure

### Standard Error Format

All errors are wrapped in a consistent envelope for user-friendly messaging:

```typescript
// src/utils/ErrorEnvelope.ts
import { z } from 'zod'

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(), // Machine-readable error code
    message: z.string(), // Human-readable message
    details: z.unknown().optional(), // Additional context
    stackTrace: z.string().optional(), // Only in debug mode
    suggestions: z.array(z.string()).optional(), // Actionable suggestions
  }),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid().optional(),
})

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>

// Error helper factory
export function createErrorEnvelope(
  code: string,
  message: string,
  options?: {
    details?: unknown
    stackTrace?: string
    suggestions?: string[]
    requestId?: string
  }
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      details: options?.details,
      stackTrace: options?.stackTrace,
      suggestions: options?.suggestions,
    },
    timestamp: new Date().toISOString(),
    requestId: options?.requestId,
  }
}
```

### Error Categories

```typescript
// src/utils/ErrorCodes.ts
export const ErrorCodes = {
  // Validation errors (400-level)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_AGENT: 'INVALID_AGENT',
  INVALID_TASK: 'INVALID_TASK',

  // Not found errors (404-level)
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  MEMORY_NOT_FOUND: 'MEMORY_NOT_FOUND',

  // Provider errors (500-level)
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMIT: 'PROVIDER_RATE_LIMIT',

  // System errors (500-level)
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_SYSTEM_ERROR: 'FILE_SYSTEM_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',

  // Runtime errors (500-level)
  STATE_MACHINE_ERROR: 'STATE_MACHINE_ERROR',
  EFFECT_EXECUTION_ERROR: 'EFFECT_EXECUTION_ERROR',
  RULE_ENGINE_ERROR: 'RULE_ENGINE_ERROR',
} as const
```

### Error Handler Middleware

```typescript
// src/cli/middleware/errorHandler.ts
import { ZodError } from 'zod'
import { createErrorEnvelope, ErrorCodes } from '../../utils/ErrorEnvelope'

export async function errorHandler(error: unknown): Promise<never> {
  let envelope: ErrorEnvelope

  if (error instanceof ZodError) {
    envelope = createErrorEnvelope(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid command arguments',
      {
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        suggestions: [
          'Run the command with --help to see valid arguments',
          'Check the documentation at https://docs.automatosx.com',
        ],
      }
    )
  } else if (error instanceof NotFoundError) {
    envelope = createErrorEnvelope(
      error.code,
      error.message,
      {
        suggestions: error.suggestions,
      }
    )
  } else {
    envelope = createErrorEnvelope(
      ErrorCodes.UNKNOWN_ERROR,
      'An unexpected error occurred',
      {
        details: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
      }
    )
  }

  // Print error envelope
  console.error(JSON.stringify(envelope, null, 2))
  process.exit(1)
}
```

---

## Streaming Logger Interface

### Real-Time Output for Long-Running Tasks

```typescript
// src/utils/StreamingLogger.ts
import { EventEmitter } from 'events'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogEvent = {
  level: LogLevel
  message: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export class StreamingLogger extends EventEmitter {
  private buffer: LogEvent[] = []
  private isStreaming: boolean

  constructor(options?: { bufferSize?: number }) {
    super()
    this.isStreaming = true
  }

  log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const event: LogEvent = {
      level,
      message,
      timestamp: new Date(),
      metadata,
    }

    this.buffer.push(event)

    if (this.isStreaming) {
      this.emit('log', event)
      this.printToConsole(event)
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata)
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata)
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata)
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata)
  }

  private printToConsole(event: LogEvent): void {
    const timestamp = event.timestamp.toISOString()
    const level = event.level.toUpperCase().padEnd(5)
    const message = event.message

    // ANSI color codes
    const colors = {
      debug: '\x1b[90m', // Gray
      info: '\x1b[36m',  // Cyan
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    }
    const reset = '\x1b[0m'

    const colored = `${colors[event.level]}[${timestamp}] ${level}${reset} ${message}`
    console.log(colored)

    if (event.metadata) {
      console.log('  ', JSON.stringify(event.metadata, null, 2))
    }
  }

  getBuffer(): LogEvent[] {
    return [...this.buffer]
  }

  clearBuffer(): void {
    this.buffer = []
  }
}
```

**Usage in Handlers**:

```typescript
// src/cli/handlers/runCommand.ts
const logger = new StreamingLogger()

logger.info('Initializing agent orchestrator...')
logger.debug('Loading agent configuration', { agentName: args.agent })

orchestrator.on('state-change', (state) => {
  logger.info(`State transition: ${state.from} → ${state.to}`)
})

orchestrator.on('effect-executed', (effect) => {
  logger.debug(`Effect executed: ${effect.name}`, { duration: effect.duration })
})
```

---

## Type Generation Pipeline

### Step 1: ReScript → JavaScript + TypeScript Types

```json
// packages/rescript-core/bsconfig.json
{
  "name": "rescript-core",
  "sources": ["src"],
  "gentypeconfig": {
    "language": "typescript",
    "shims": {},
    "debug": {
      "all": false,
      "basic": false
    }
  }
}
```

**Output**:
- `StateMachine.res` → `StateMachine.bs.js` + `StateMachine.gen.tsx`

### Step 2: TypeScript Types → Zod Schemas (Optional)

Use `ts-to-zod` to generate Zod schemas from TypeScript interfaces:

```bash
npm install --save-dev ts-to-zod
```

```typescript
// scripts/generate-zod-schemas.ts
import { generate } from 'ts-to-zod'
import * as fs from 'fs'

const sourceFile = './src/types/generated/ReScriptTypes.gen.tsx'
const outputFile = './src/schemas/generated/ReScriptSchemas.ts'

const { getZodSchemasFile } = generate({
  sourceText: fs.readFileSync(sourceFile, 'utf-8'),
})

fs.writeFileSync(outputFile, getZodSchemasFile('StateMachine'))
```

**Output**:
- TypeScript types → Zod schemas for runtime validation

### Step 3: Zod Schemas → TypeScript Types (Reverse)

```typescript
import { z } from 'zod'

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
})

// Extract TypeScript type from Zod schema
type User = z.infer<typeof UserSchema>
// → { id: string; name: string; email: string }
```

---

## Implementation Plan

### Sprint 2 Day 11 (Today)

**CLI/TS Squad Tasks**:

1. **TS1: Zod Schema Foundations** (4h)
   - Create `src/cli/schemas/common.ts` with base schemas
   - Implement `AgentNameSchema`, `TaskDescriptionSchema`, `ProviderSchema`
   - Implement `OutputFormatSchema`, `BaseCommandSchema`
   - Write unit tests for schema validation

2. **TS2: Top 5 Command Schemas** (4h)
   - Implement `RunCommandSchema.ts`
   - Implement `MemorySearchSchema.ts`
   - Implement `ListAgentsSchema.ts`
   - Implement `StatusSchema.ts`
   - Implement `ConfigShowSchema.ts`
   - Write unit tests for each schema

3. **TS3: Error Envelope + Streaming Logger** (4h)
   - Implement `ErrorEnvelope.ts` with Zod validation
   - Implement `StreamingLogger.ts` with event emitter
   - Implement error handler middleware
   - Write integration tests

**Deliverables**:
- 5 Zod schemas ready for CLI commands
- Error envelope structure defined
- Streaming logger implemented
- Unit + integration tests passing

### Sprint 2 Day 12

**CLI/TS Squad Tasks**:

1. **TS1: Wire Top 5 Command Handlers** (4h)
   - Implement `runCommand.ts` handler with Zod validation
   - Implement `memorySearchCommand.ts` handler
   - Integrate with ReScript `StateMachine.bs.js`

2. **TS2: Remaining Command Handlers** (4h)
   - Implement `listAgentsCommand.ts`
   - Implement `statusCommand.ts`
   - Implement `configShowCommand.ts`

3. **TS3: Type Generation Pipeline** (4h)
   - Set up `genType` configuration for ReScript → TS types
   - Create `generate-zod-schemas.ts` script
   - Document type generation workflow

**Deliverables**:
- Top 5 CLI commands fully wired with Zod validation
- ReScript type integration working
- Type generation pipeline documented

### Sprint 2 Day 13

**CLI/TS Squad Tasks**:

1. **CLI Snapshot Tests** (6h)
   - Implement snapshot tests for all 5 commands
   - Test error cases and validation failures
   - Test streaming output capture

2. **Command Execution Mocks** (3h)
   - Mock provider responses for deterministic testing
   - Mock file system operations
   - Mock database queries

**Deliverables**:
- 50 CLI snapshot tests passing
- Mocking infrastructure ready for golden trace testing

---

## Success Criteria

**Day 11 (Today)**:
- ✅ 5 Zod schemas implemented and tested
- ✅ Error envelope structure defined
- ✅ Streaming logger working
- ✅ Unit tests passing

**Day 12**:
- ✅ Top 5 CLI commands wired with handlers
- ✅ ReScript integration working (consuming `.bs.js` types)
- ✅ Type generation pipeline documented

**Day 13**:
- ✅ 50 CLI snapshot tests passing
- ✅ Command execution mocks in place
- ✅ Ready for golden trace harness integration

---

## References

**Zod Documentation**: https://zod.dev/
**ReScript GenType**: https://rescript-lang.org/docs/manual/latest/typescript-integration
**oclif CLI Framework**: https://oclif.io/
**Ink TUI Framework**: https://github.com/vadimdemedes/ink

---

## Document Control

**Created**: Sprint 2 Day 11
**Last Updated**: Sprint 2 Day 11
**Next Review**: Sprint 2 Day 12 standup
**Owner**: CLI/TypeScript Squad (TS1, TS2, TS3)
**Location**: `automatosx/tmp/sprint2/cli-typescript-bridge-interface.md`
