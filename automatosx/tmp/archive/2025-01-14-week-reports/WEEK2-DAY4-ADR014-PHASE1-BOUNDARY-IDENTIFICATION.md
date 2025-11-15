# ADR-014 Phase 1: Validation Boundary Identification

**Date**: 2025-01-14
**Phase**: Week 2 Day 4 Morning
**Status**: ✅ Complete
**Duration**: 2 hours

---

## Executive Summary

This document maps all data validation boundaries in AutomatosX v8.0.0 and identifies coverage gaps where Zod validation is missing. The analysis reveals **8 major boundaries** with **60% coverage** (5/8 boundaries have Zod schemas).

**Key Findings**:
- ✅ **Good Coverage**: CLI commands, Memory system, Providers, Workflows, Telemetry
- ⚠️ **Missing Coverage**: Parser outputs, Database DAO inputs, Configuration loading
- 🎯 **Priority Gaps**: Parser → Database boundary (critical data flow)

---

## Boundary Mapping Methodology

### 1. Static Analysis

Searched codebase for:
- Existing Zod schemas: `**/*.schema.ts`, `**/*Schema.ts`
- Import patterns: `import.*zod`
- Interface definitions: `interface.*Input`, `interface.*Record`
- Data entry points: `process.argv`, `fs.readFile`, `JSON.parse`

### 2. Data Flow Tracing

Identified 4 primary data flows:
1. **CLI → Services** (user input validation)
2. **Parser → Database** (code intelligence indexing)
3. **Database → Services** (query results)
4. **Services → Providers** (AI API calls)

### 3. Coverage Analysis

For each boundary:
- ✅ **Covered**: Zod schema exists and is used
- ⚠️ **Partial**: Schema exists but not consistently used
- ❌ **Missing**: No validation schema

---

## Boundary 1: CLI Input ✅

**Status**: ✅ **COVERED**
**Location**: `src/cli/schemas/`
**Schemas**: 6 command schemas

### Existing Schemas

1. **`RunCommandSchema.ts`** - `ax run <agent> "<task>"` validation
   - Agent name validation
   - Task description (min 1 char)
   - Provider enum validation
   - Timeout bounds (max 600000ms)
   - Memory limits (max 50 results)
   - Retry limits (max 5 attempts)
   - Boolean flags (streaming, parallel, resumable)

2. **`MemorySearchSchema.ts`** - Memory search command validation
   - UUID validation for conversationId
   - Enum validation for roles, sortBy, sortOrder
   - Limit bounds (max 100)
   - Offset validation (non-negative)

3. **`StatusSchema.ts`** - System status command validation
   - Boolean flags (verbose, json, watch)
   - Interval bounds (watch mode)

4. **`ListAgentsSchema.ts`** - Agent listing validation
   - Filter validation (category, expertise, tags)
   - Format validation (table, json, yaml)

5. **`ConfigShowSchema.ts`** - Configuration display validation
   - Key validation (optional path segments)
   - Format validation

6. **`ChaosCommandSchema.ts`** - Chaos engineering validation
   - Chaos type enum
   - Intensity bounds (0-1)
   - Duration validation

### Common Base Schema

**`common.ts`**:
```typescript
export const BaseCommandSchema = z.object({
  verbose: z.boolean().optional().default(false),
  debug: z.boolean().optional().default(false),
  quiet: z.boolean().optional().default(false),
  json: z.boolean().optional().default(false),
});

export const AgentNameSchema = z.string().min(1, 'Agent name is required');
export const TaskDescriptionSchema = z.string().min(1, 'Task description is required');
export const ProviderSchema = z.enum(['claude', 'gemini', 'openai']);
export const TimeoutSchema = z.number().int().positive().max(600000).default(300000);
```

### Coverage Assessment

- ✅ All CLI commands validated
- ✅ Consistent error handling via helper functions
- ✅ Type-safe result types via `z.infer`

### Gaps Identified

**None** - CLI validation is comprehensive.

---

## Boundary 2: Parser Output ❌

**Status**: ❌ **MISSING**
**Location**: `src/parser/LanguageParser.ts`
**Priority**: 🔴 **HIGH** (critical data flow)

### Current Implementation

**`LanguageParser.ts`** (Lines 13-47):
```typescript
export interface Symbol {
  name: string;
  kind: SymbolKind;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  metadata?: Record<string, any>; // ⚠️ Unvalidated `any`
}

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'variable'
  | 'constant'
  | 'method'
  | 'enum'
  | 'struct'
  | 'trait'
  | 'module';

export interface ParseResult {
  symbols: Symbol[];
  parseTime: number; // milliseconds
  nodeCount: number;
}
```

### Issues

1. **No Runtime Validation**: Parser outputs are **not validated** before database insertion
2. **Metadata Any**: `metadata?: Record<string, any>` allows arbitrary untyped data
3. **No Bounds Checking**: Line/column numbers not validated (could be negative)
4. **Missing Error Handling**: Parse failures return empty arrays, not typed errors

### Impact

**Data Integrity Risk**:
- Malformed parser output could corrupt database
- Invalid line numbers could break symbol lookups
- Unvalidated metadata could cause downstream errors

### Recommended Schema

```typescript
// src/types/schemas/parser.schema.ts

import { z } from 'zod';

export const SymbolKindSchema = z.enum([
  'function',
  'class',
  'interface',
  'type',
  'variable',
  'constant',
  'method',
  'enum',
  'struct',
  'trait',
  'module',
]);

export const SymbolSchema = z.object({
  name: z.string().min(1, 'Symbol name cannot be empty'),
  kind: SymbolKindSchema,
  line: z.number().int().positive(),
  column: z.number().int().nonnegative(),
  endLine: z.number().int().positive().optional(),
  endColumn: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ParseResultSchema = z.object({
  symbols: z.array(SymbolSchema),
  parseTime: z.number().nonnegative(),
  nodeCount: z.number().int().nonnegative(),
});

export type Symbol = z.infer<typeof SymbolSchema>;
export type ParseResult = z.infer<typeof ParseResultSchema>;
```

---

## Boundary 3: Database DAO Inputs ❌

**Status**: ❌ **MISSING**
**Location**: `src/database/dao/*.ts`
**Priority**: 🔴 **HIGH** (data integrity)

### Current Implementation

**`FileDAO.ts`** (Lines 29-41):
```typescript
export interface FileInput {
  path: string;
  content: string;
  language?: string;
}

export interface FileUpdate {
  content?: string;
  language?: string;
}
```

**`SymbolDAO.ts`** (Lines 29-37):
```typescript
export interface SymbolInput {
  file_id: number;
  name: string;
  kind: string;
  line: number;
  column: number;
  end_line?: number;
  end_column?: number;
}
```

### Issues

1. **No Validation**: DAO inputs are **not validated** before SQL execution
2. **Weak Typing**: `kind: string` allows any string, not just valid SymbolKind values
3. **No Bounds Checking**: No validation of file_id existence, line/column bounds
4. **Missing Constraints**: No path format validation, content size limits

### Impact

**SQL Injection Risk** (Low - using prepared statements)
**Data Corruption Risk** (High - invalid data can be inserted)
**Constraint Violation Risk** (Medium - foreign key failures)

### Recommended Schemas

```typescript
// src/types/schemas/database.schema.ts

import { z } from 'zod';
import { SymbolKindSchema } from './parser.schema.js';

// File DAO Schemas
export const FileInputSchema = z.object({
  path: z.string().min(1, 'File path cannot be empty'),
  content: z.string().max(10_000_000, 'File content exceeds 10MB limit'),
  language: z.string().optional(),
});

export const FileUpdateSchema = z.object({
  content: z.string().max(10_000_000, 'File content exceeds 10MB limit').optional(),
  language: z.string().optional(),
}).refine(data => data.content !== undefined || data.language !== undefined, {
  message: 'At least one field must be provided',
});

// Symbol DAO Schemas
export const SymbolInputSchema = z.object({
  file_id: z.number().int().positive(),
  name: z.string().min(1, 'Symbol name cannot be empty'),
  kind: SymbolKindSchema,
  line: z.number().int().positive(),
  column: z.number().int().nonnegative(),
  end_line: z.number().int().positive().optional(),
  end_column: z.number().int().nonnegative().optional(),
});

// Chunk DAO Schemas
export const ChunkInputSchema = z.object({
  file_id: z.number().int().positive(),
  text: z.string().min(1, 'Chunk text cannot be empty'),
  start_line: z.number().int().positive(),
  end_line: z.number().int().positive(),
  embedding: z.string().optional(), // JSON blob
});
```

---

## Boundary 4: Memory System ✅

**Status**: ✅ **COVERED**
**Location**: `src/types/schemas/memory.schema.ts`
**Schemas**: 19 schemas (comprehensive)

### Existing Coverage

1. **State Machine**: `MemoryStateSchema`, `MemoryEventSchema`
2. **Messages**: `MessageSchema`, `CreateMessageSchema`, `MessageRoleSchema`
3. **Conversations**: `ConversationSchema`, `CreateConversationSchema`, `UpdateConversationSchema`
4. **Agents**: `AgentSchema`, `CreateAgentSchema`, `AgentStateSchema`
5. **Search**: `MemorySearchOptionsSchema`, `MemorySearchResultSchema`
6. **Statistics**: `MemoryStatsSchema`
7. **Export**: `MemoryExportOptionsSchema`, `MemoryExportSchema`
8. **Lists**: `ConversationListOptionsSchema`, `MessageListOptionsSchema`

### Validation Helpers

```typescript
export function validateConversation(data: unknown): Conversation;
export function validateMessage(data: unknown): Message;
export function validateAgent(data: unknown): Agent;
export function validateMemorySearchOptions(data: unknown): MemorySearchOptions;
```

### Coverage Assessment

- ✅ Complete schema coverage
- ✅ UUID validation for IDs
- ✅ Enum validation for states and roles
- ✅ Bounds checking (limits, offsets, token counts)
- ✅ Validation helper functions

### Gaps Identified

**None** - Memory validation is production-ready.

---

## Boundary 5: Provider Integration ✅

**Status**: ✅ **COVERED**
**Location**: `src/types/schemas/provider.schema.ts`
**Schemas**: 20+ schemas

### Existing Coverage

1. **Request/Response**: `ProviderRequestSchema`, `ProviderResponseSchema`
2. **Streaming**: `StreamingRequestSchema`, `StreamChunkSchema`
3. **Error Handling**: `ProviderErrorSchema`, `ProviderErrorCodeSchema`
4. **Retry Logic**: `RetryConfigSchema`, `RetryInfoSchema`, `RetryStrategySchema`
5. **Rate Limiting**: `RateLimitInfoSchema`
6. **Fallback**: `FallbackConfigSchema`, `FallbackInfoSchema`
7. **State Management**: `ProviderStateSchema`, `ProviderContextSchema`
8. **Metrics**: `ProviderMetricsSchema`, `TokenUsageSchema`
9. **Logging**: `ProviderLogSchema`

### Validation Helpers

```typescript
export const validateProviderRequest = (data: unknown): ProviderRequest;
export const validateProviderResponse = (data: unknown): ProviderResponse;
export const validateStreamChunk = (data: unknown): StreamChunk;
export const validateProviderError = (data: unknown): ProviderError;
```

### Type Guards

```typescript
export const isStreamingRequest = (req: ProviderRequest): req is StreamingRequest;
export const isRetryableError = (error: ProviderError): boolean;
export const isTerminalState = (state: ProviderState): boolean;
```

### Coverage Assessment

- ✅ Comprehensive provider lifecycle validation
- ✅ Strong type safety with branded types
- ✅ Error handling with retry strategies
- ✅ Rate limiting and fallback logic

### Gaps Identified

**None** - Provider validation is production-ready.

---

## Boundary 6: Workflow Engine ✅

**Status**: ✅ **COVERED**
**Location**: `src/types/schemas/workflow.schema.ts`
**Schemas**: 24 schemas (comprehensive)

### Existing Coverage

1. **Workflow Definition**: `WorkflowDefinitionSchema`, `WorkflowStepSchema`, `WorkflowConfigSchema`
2. **Execution**: `WorkflowExecutionSchema`, `WorkflowStepExecutionSchema`, `StepExecutionStateSchema`
3. **State Machine**: `WorkflowStateSchema`, `WorkflowEventSchema`, `WorkflowEventTypeSchema`
4. **Checkpoints**: `WorkflowCheckpointSchema`
5. **Scheduling**: `StepScheduleSchema`, `DependencyGraphSchema`, `DependencyNodeSchema`
6. **Statistics**: `WorkflowStatsSchema`, `WorkflowResultSchema`
7. **Configuration**: `RetryPolicySchema`, `WorkflowExecutionOptionsSchema`

### Validation Helpers

```typescript
export function parseWorkflowDefinition(jsonString: string): WorkflowDefinition;
export function validateWorkflowDefinition(definition: unknown): WorkflowDefinition;
export function validateExecutionOptions(options: unknown): WorkflowExecutionOptions;
export function isTerminalState(state: WorkflowState): boolean;
export function canResumeFromState(state: WorkflowState): boolean;
```

### Coverage Assessment

- ✅ Complete workflow lifecycle validation
- ✅ Dependency graph validation
- ✅ Checkpoint integrity checks
- ✅ Step-level retry policies

### Gaps Identified

**None** - Workflow validation is production-ready.

---

## Boundary 7: Telemetry System ✅

**Status**: ✅ **COVERED**
**Location**: `src/types/schemas/telemetry.schema.ts`
**Schemas**: 17 schemas

### Existing Coverage

1. **Events**: `TelemetryEventSchema`, `EventTypeSchema`
2. **Command Events**: `CommandEventDataSchema`
3. **Query Events**: `QueryEventDataSchema`
4. **Parser Events**: `ParserEventDataSchema`
5. **Error Events**: `ErrorEventDataSchema`
6. **Performance**: `PerformanceMetricSchema`
7. **Feature Usage**: `FeatureUsageSchema`
8. **Configuration**: `TelemetryConfigSchema`
9. **Statistics**: `TelemetryStatsSchema`
10. **Remote Submission**: `SubmissionConfigSchema`, `SubmissionResultSchema`, `ServerInfoSchema`

### Privacy Controls

- ✅ Query truncation (max 100 chars)
- ✅ Error message truncation (max 200 chars)
- ✅ Stack trace truncation (max 500 chars)
- ✅ No file paths (only extensions)
- ✅ UUID-based session IDs

### Coverage Assessment

- ✅ Comprehensive telemetry validation
- ✅ Privacy-first design
- ✅ Aggregation support

### Gaps Identified

**None** - Telemetry validation is production-ready.

---

## Boundary 8: Configuration Loading ⚠️

**Status**: ⚠️ **PARTIAL**
**Location**: `src/types/Config.ts`, `src/services/ConfigLoader.ts`
**Priority**: 🟡 **MEDIUM** (non-critical but important)

### Current Implementation

**`Config.ts`** uses Zod extensively:
```typescript
export const ConfigSchema = z.object({
  languages: z.record(z.string(), z.object({
    enabled: z.boolean().default(true),
  })).default({}),

  search: z.object({
    defaultLimit: z.number().int().positive().default(10),
    maxLimit: z.number().int().positive().default(100),
  }).default({
    defaultLimit: 10,
    maxLimit: 100,
  }),

  // ... more config sections
});
```

### Issues

1. **Partial Validation**: Some config sections validated, others not
2. **No File Format Validation**: JSON parsing errors not wrapped in Zod errors
3. **No Default Merging**: Manual default merging instead of `.default()` usage

### Recommended Improvements

1. Add file format validation:
```typescript
export const ConfigFileSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  config: ConfigSchema,
});
```

2. Improve error messages:
```typescript
try {
  return ConfigFileSchema.parse(JSON.parse(fileContent));
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new Error(`Invalid config file:\n${formatZodErrors(error)}`);
  }
  throw error;
}
```

---

## Summary: Coverage Matrix

| Boundary | Status | Schemas | Priority | Phase |
|----------|--------|---------|----------|-------|
| CLI Input | ✅ Complete | 6 schemas | ✅ P0 | N/A (done) |
| Memory System | ✅ Complete | 19 schemas | ✅ P0 | N/A (done) |
| Provider Integration | ✅ Complete | 20+ schemas | ✅ P0 | N/A (done) |
| Workflow Engine | ✅ Complete | 24 schemas | ✅ P0 | N/A (done) |
| Telemetry System | ✅ Complete | 17 schemas | ✅ P0 | N/A (done) |
| Configuration | ⚠️ Partial | Config only | 🟡 P1 | Day 6 |
| **Parser Output** | ❌ Missing | 0 schemas | 🔴 P0 | **Day 5 AM** |
| **Database DAO** | ❌ Missing | 0 schemas | 🔴 P0 | **Day 5 PM** |

**Overall Coverage**: 60% (5/8 boundaries complete)

---

## Phase 1 Deliverables ✅

1. ✅ **Boundary Map**: 8 boundaries identified and categorized
2. ✅ **Coverage Analysis**: 60% coverage, 40% gaps
3. ✅ **Priority Ranking**: 2 high-priority gaps (Parser, Database)
4. ✅ **Schema Inventory**: 86+ existing schemas catalogued
5. ✅ **Gap Identification**: 2 critical missing boundaries documented

---

## Next Steps: Phase 2 - Schema Architecture Design

**Timeline**: Week 2 Day 4 Afternoon (2-3 hours)

**Objectives**:
1. Design unified schema architecture for missing boundaries
2. Define schema patterns (Base Types, Branded Types, Transforms, Refinements)
3. Create schema file structure and naming conventions
4. Plan integration points with existing code

**Deliverables**:
- Schema architecture document
- Pattern library with examples
- File structure and naming conventions
- Integration strategy for Parser and Database boundaries

---

**Phase 1 Status**: ✅ **COMPLETE**
**Time Taken**: 2 hours
**Next Phase**: Phase 2 - Schema Architecture Design
**ETA**: Week 2 Day 4 Afternoon
