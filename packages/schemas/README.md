# @ax/schemas

Zod schemas and TypeScript types for AutomatosX.

## Installation

```bash
pnpm add @ax/schemas
```

## Overview

This package provides type-safe schema validation for all AutomatosX data
structures using [Zod](https://zod.dev/).

## Exports

### Branded Types

Type-safe identifiers to prevent mixing different ID types:

```typescript
import { AgentId, SessionId, MemoryId, CheckpointId } from '@ax/schemas';

const agentId: AgentId = AgentId.parse('backend');
const sessionId: SessionId = SessionId.parse('550e8400-e29b-41d4-a716-446655440000');
```

### Enums

```typescript
import {
  ProviderType,    // 'claude' | 'gemini' | 'ax-cli' | 'openai'
  IntegrationMode, // 'mcp' | 'sdk' | 'bash'
  TaskStatus,      // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  MemoryType,      // 'conversation' | 'code' | 'document' | 'task' | 'decision'
  LogLevel,        // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
} from '@ax/schemas';
```

### Agent Schemas

```typescript
import {
  AgentProfileSchema,
  PersonalitySchema,
  OrchestrationSchema,
  ExecutionContextSchema,
  type AgentProfile,
} from '@ax/schemas';

const agent = AgentProfileSchema.parse({
  name: 'backend',
  displayName: 'Bob',
  role: 'Backend Developer',
  // ...
});
```

### Provider Schemas

```typescript
import {
  ExecutionRequestSchema,
  ExecutionResponseSchema,
  ProviderConfigSchema,
  RoutingContextSchema,
} from '@ax/schemas';
```

### Memory Schemas

```typescript
import {
  MemoryEntrySchema,
  MemorySearchOptionsSchema,
  MemoryFilterSchema,
} from '@ax/schemas';
```

### Session Schemas

```typescript
import {
  SessionSchema,
  SessionStateSchema,
  TaskSchema,
} from '@ax/schemas';
```

### Config Schemas

```typescript
import {
  AutomatosXConfigSchema,
  ProviderConfigSchema,
  ExecutionConfigSchema,
} from '@ax/schemas';
```

### Utility Types

```typescript
import {
  TokenUsage,
  ErrorInfo,
  Result,
  Metadata,
  ISODateString,
  DurationMs,
  Percentage,
  NormalizedScore,
} from '@ax/schemas';

// Result type for operations that can fail
const result = Result(z.string()).parse({
  success: true,
  data: 'hello',
});
```

### Validation Helpers

```typescript
import { safeParse, parseOrThrow, ValidationError } from '@ax/schemas';

// Safe parsing (returns result object)
const result = safeParse(AgentProfileSchema, data);
if (result.success) {
  console.log(result.data);
}

// Throws on error with custom message
const agent = parseOrThrow(AgentProfileSchema, data, 'Invalid agent profile');
```

## License

Apache-2.0
