# ADR-014: Runtime Validation with Zod

**Status**: Accepted
**Date**: 2025-11-07
**Deciders**: Architecture Team
**Context**: Phase 0-1 (P0/P1) Implementation

---

## Context and Problem Statement

AutomatosX v2 operates at critical boundaries where data integrity is essential:
- **CLI Input**: User-provided arguments and flags
- **Configuration Files**: `automatosx.config.json` and other configs
- **Parser Output**: Symbols and chunks from language parsers
- **Database Records**: SQLite query results
- **External APIs**: Future integrations with language servers and tools

TypeScript provides **compile-time** type safety, but cannot prevent:
- Invalid configuration files with wrong types
- CLI arguments that don't match expected formats
- Malformed data from external sources
- Runtime type coercion errors

**Key Questions**:
1. How do we validate data at runtime boundaries?
2. How do we maintain consistency between TypeScript types and runtime validators?
3. How do we provide helpful error messages for validation failures?
4. How do we balance validation strictness with developer experience?

---

## Decision Drivers

- **Runtime Safety**: Catch invalid data before it causes crashes
- **Type Consistency**: Runtime validators must match TypeScript types
- **Developer Experience**: Clear error messages, easy to define schemas
- **Performance**: Validation overhead must be minimal (< 1ms per validation)
- **Ecosystem**: Leverage existing, well-maintained libraries
- **Extensibility**: Easy to add new schemas as features grow
- **TypeScript Integration**: Generate TypeScript types from schemas

---

## Considered Options

### Option 1: Manual Validation (No Library)

**Approach**: Write custom validation functions for each type

**Example**:
```typescript
function validateConfig(config: unknown): Config {
  if (typeof config !== 'object' || config === null) {
    throw new Error('Config must be an object');
  }
  if (typeof config.cacheDir !== 'string') {
    throw new Error('cacheDir must be a string');
  }
  // ... 50 more checks
}
```

**Pros**:
- No dependencies
- Full control over error messages

**Cons**:
- ❌ Extremely verbose (100+ lines per schema)
- ❌ No type inference
- ❌ Error-prone (easy to miss validation)
- ❌ Hard to maintain as schemas evolve

**Verdict**: ❌ Rejected - Too much boilerplate

### Option 2: JSON Schema with ajv

**Approach**: Use JSON Schema standard with ajv validator

**Example**:
```typescript
const configSchema = {
  type: 'object',
  properties: {
    cacheDir: { type: 'string' },
    maxCacheSize: { type: 'number' }
  },
  required: ['cacheDir']
};

const validate = ajv.compile(configSchema);
if (!validate(config)) {
  throw new Error(ajv.errorsText(validate.errors));
}
```

**Pros**:
- Industry standard (JSON Schema spec)
- Mature ecosystem
- Good performance

**Cons**:
- ❌ Verbose schema definitions
- ❌ No native TypeScript type inference
- ❌ Requires separate type definitions
- ❌ Error messages are cryptic

**Verdict**: ❌ Rejected - Poor TypeScript integration

### Option 3: io-ts (Functional Validation)

**Approach**: Use io-ts for functional runtime validation

**Example**:
```typescript
import * as t from 'io-ts';

const ConfigCodec = t.type({
  cacheDir: t.string,
  maxCacheSize: t.number
});

type Config = t.TypeOf<typeof ConfigCodec>;
```

**Pros**:
- ✅ TypeScript type inference
- ✅ Functional programming style
- ✅ Composable validators

**Cons**:
- ❌ Steep learning curve (requires fp-ts knowledge)
- ❌ Complex type signatures
- ❌ Verbose for simple cases
- ❌ Smaller ecosystem

**Verdict**: ❌ Rejected - Unnecessary complexity

### Option 4: Zod (TypeScript-First Validation)

**Approach**: Use Zod for schema-first validation with type inference

**Example**:
```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  cacheDir: z.string(),
  maxCacheSize: z.number().min(0).optional()
});

type Config = z.infer<typeof ConfigSchema>;

const config = ConfigSchema.parse(userInput); // Throws if invalid
```

**Pros**:
- ✅ Excellent TypeScript integration
- ✅ Concise, readable schema definitions
- ✅ Type inference via `z.infer<>`
- ✅ Helpful error messages
- ✅ Rich ecosystem (plugins, extensions)
- ✅ Fast performance (< 1ms for typical schemas)
- ✅ Built-in refinements (min, max, email, url, etc.)

**Cons**:
- Adds ~40KB to bundle size (acceptable for CLI)

**Verdict**: ✅ **SELECTED**

---

## Decision Outcome

**Chosen Option**: **Option 4 - Zod (TypeScript-First Validation)**

### Architecture

#### 1. Schema Organization

**Location**: `src/types/schemas/`

**Structure**:
```
src/types/schemas/
├── config.schema.ts       # Configuration file schemas
├── cli.schema.ts          # CLI argument schemas
├── parser.schema.ts       # Parser output schemas
├── database.schema.ts     # Database record schemas
└── index.ts               # Re-exports all schemas
```

#### 2. Configuration Validation

**Schema**: `src/types/schemas/config.schema.ts`

**Example**:
```typescript
import { z } from 'zod';

export const ConfigSchema = z.object({
  cacheDir: z.string().default('.automatosx/cache'),
  dbPath: z.string().default('.automatosx/index.db'),
  maxCacheSize: z.number().min(0).default(100 * 1024 * 1024), // 100MB
  languages: z.array(z.string()).optional(),
  exclude: z.array(z.string()).default([
    '**/node_modules/**',
    '**/dist/**',
    '**/.git/**'
  ]),
  semgrep: z.object({
    enabled: z.boolean().default(true),
    rulePacks: z.array(z.string()).default(['security', 'performance'])
  }).optional()
});

export type Config = z.infer<typeof ConfigSchema>;
```

**Usage**:
```typescript
import { ConfigSchema } from './types/schemas/config.schema.js';
import fs from 'fs';

function loadConfig(path: string): Config {
  const raw = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return ConfigSchema.parse(raw); // Throws ZodError if invalid
}
```

#### 3. CLI Argument Validation

**Schema**: `src/types/schemas/cli.schema.ts`

**Example**:
```typescript
export const FindOptionsSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  language: z.enum([
    'typescript', 'python', 'go', 'java', 'rust',
    'ruby', 'csharp', 'cpp', 'php', 'kotlin',
    'swift', 'sql', 'assemblyscript'
  ]).optional(),
  type: z.enum(['symbol', 'text', 'hybrid']).default('hybrid'),
  limit: z.number().int().min(1).max(1000).default(50),
  offset: z.number().int().min(0).default(0)
});

export type FindOptions = z.infer<typeof FindOptionsSchema>;
```

**Usage in CLI Command**:
```typescript
import { FindOptionsSchema } from '../types/schemas/cli.schema.js';

async function findCommand(rawOptions: unknown) {
  try {
    const options = FindOptionsSchema.parse(rawOptions);
    // options is now fully typed and validated
    const results = await queryService.find(options);
    console.log(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Invalid options:', error.errors);
      process.exit(1);
    }
    throw error;
  }
}
```

#### 4. Parser Output Validation

**Schema**: `src/types/schemas/parser.schema.ts`

**Example**:
```typescript
export const SymbolSchema = z.object({
  name: z.string(),
  kind: z.enum(['function', 'class', 'method', 'interface', 'type', 'variable']),
  signature: z.string(),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  docstring: z.string().optional()
});

export const ParseResultSchema = z.object({
  symbols: z.array(SymbolSchema),
  chunks: z.array(z.object({
    content: z.string(),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1)
  }))
});

export type Symbol = z.infer<typeof SymbolSchema>;
export type ParseResult = z.infer<typeof ParseResultSchema>;
```

**Usage in Parser**:
```typescript
export abstract class BaseLanguageParser {
  public parse(code: string, filePath: string): ParseResult {
    const rawResult = this.parseInternal(code, filePath);

    // Validate parser output
    return ParseResultSchema.parse(rawResult);
  }
}
```

#### 5. Database Record Validation

**Schema**: `src/types/schemas/database.schema.ts`

**Example**:
```typescript
export const FileRecordSchema = z.object({
  id: z.number().int().positive(),
  path: z.string(),
  language: z.string(),
  size: z.number().int().min(0),
  lastModified: z.number().int(),
  lastIndexed: z.number().int()
});

export const SymbolRecordSchema = z.object({
  id: z.number().int().positive(),
  file_id: z.number().int().positive(),
  name: z.string(),
  kind: z.string(),
  signature: z.string(),
  start_line: z.number().int().min(1),
  end_line: z.number().int().min(1),
  docstring: z.string().nullable()
});
```

**Usage in DAO**:
```typescript
export class SymbolDao {
  getById(id: number): Symbol | null {
    const row = this.db.prepare('SELECT * FROM symbols WHERE id = ?').get(id);
    if (!row) return null;

    // Validate database record
    return SymbolRecordSchema.parse(row);
  }
}
```

---

## Validation Strategies

### 1. Parse vs SafeParse

**Parse (Throws on Error)**:
```typescript
const config = ConfigSchema.parse(raw); // Throws ZodError
```

**Use When**: Early in the application lifecycle (startup, CLI parsing)

**SafeParse (Returns Result)**:
```typescript
const result = ConfigSchema.safeParse(raw);
if (!result.success) {
  console.error(result.error.errors);
  return null;
}
const config = result.data;
```

**Use When**: Validating external data where errors should be handled gracefully

### 2. Refinements and Custom Validation

**Example**:
```typescript
const PathSchema = z.string().refine(
  (path) => !path.includes('..'),
  { message: 'Path traversal not allowed' }
);

const ConfigSchema = z.object({
  cacheDir: PathSchema
});
```

### 3. Transformations

**Example**:
```typescript
const TimestampSchema = z.string().transform((val) => new Date(val));

const LogEntrySchema = z.object({
  message: z.string(),
  timestamp: TimestampSchema
});

// Input: { message: "Hello", timestamp: "2025-11-07T10:00:00Z" }
// Output: { message: "Hello", timestamp: Date object }
```

### 4. Partial and Optional Schemas

**Example**:
```typescript
const UpdateConfigSchema = ConfigSchema.partial(); // All fields optional
const PartialConfigSchema = ConfigSchema.pick({ cacheDir: true, dbPath: true });
```

---

## Error Handling

### Zod Error Structure

**Example Error**:
```typescript
try {
  ConfigSchema.parse({ cacheDir: 123 }); // Invalid type
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log(error.errors);
    /*
    [
      {
        code: "invalid_type",
        expected: "string",
        received: "number",
        path: ["cacheDir"],
        message: "Expected string, received number"
      }
    ]
    */
  }
}
```

### User-Friendly Error Messages

**Helper Function**:
```typescript
export function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join('\n');
}

// Usage in CLI
try {
  const options = FindOptionsSchema.parse(rawOptions);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Validation failed:\n' + formatZodError(error));
    process.exit(1);
  }
  throw error;
}
```

---

## Performance Characteristics

### Benchmarks

| Schema Type | Validation Time | Notes |
|-------------|-----------------|-------|
| Simple object (5 fields) | ~0.01ms | Negligible overhead |
| Complex object (20 fields) | ~0.05ms | Still very fast |
| Array of 100 objects | ~1.5ms | Scales linearly |
| Nested object (3 levels) | ~0.08ms | Minimal impact |

**Assessment**: Zod validation overhead is negligible for AutomatosX use cases (< 1ms per validation)

### Optimization Tips

1. **Reuse Schemas**: Define schemas once, import everywhere
2. **Avoid Deep Nesting**: Keep schemas flat when possible
3. **Use Lazy Schemas**: For recursive types (e.g., tree structures)

---

## Integration with TypeScript

### Type Inference

**Zod Schema → TypeScript Type**:
```typescript
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email()
});

type User = z.infer<typeof UserSchema>;
// Equivalent to:
// type User = { id: number; name: string; email: string; }
```

### Type Safety at Boundaries

**Pattern**:
```typescript
// 1. Define schema
const InputSchema = z.object({ /* ... */ });

// 2. Infer TypeScript type
type Input = z.infer<typeof InputSchema>;

// 3. Validate at boundary
function processInput(raw: unknown): Result {
  const input: Input = InputSchema.parse(raw); // Type-safe after parse
  return doSomething(input); // input is fully typed
}
```

---

## Consequences

### Positive

1. **✅ Runtime Safety**: Invalid data caught before causing crashes
2. **✅ Type Consistency**: TypeScript types generated from schemas (single source of truth)
3. **✅ Developer Experience**: Concise, readable schema definitions
4. **✅ Error Messages**: Clear, actionable error messages for users
5. **✅ Performance**: < 1ms validation overhead (negligible)
6. **✅ Ecosystem**: Rich plugin ecosystem (zod-to-openapi, zod-mock, etc.)
7. **✅ Maintainability**: Easy to evolve schemas as features change

### Negative

1. **⚠️ Bundle Size**: Adds ~40KB to distribution
   - **Mitigation**: Acceptable for CLI tool (not browser bundle)

2. **⚠️ Learning Curve**: Team needs to learn Zod API
   - **Mitigation**: Zod API is intuitive, similar to TypeScript types

3. **⚠️ Validation Cost**: Every boundary adds ~0.01-1ms latency
   - **Mitigation**: Negligible for CLI operations (not hot path)

### Neutral

1. **Zod Dependency**: Core dependency on Zod library
   - **Assessment**: Zod is mature, widely adopted (>5M npm downloads/week)

2. **Schema Duplication**: Need to define schemas for existing TypeScript types
   - **Assessment**: Schemas serve as documentation and runtime safety

---

## Adoption Status (P0/P1 Complete)

### Current Implementation

| Schema Type | Status | Location | Usage |
|-------------|--------|----------|-------|
| Configuration | ✅ Partial | `src/types/schemas/config.schema.ts` | Config loading |
| CLI Arguments | ✅ Partial | CLI commands | Input validation |
| Parser Output | ⚠️ Minimal | Not formalized yet | Symbol validation |
| Database Records | ⚠️ Minimal | Not formalized yet | DAO layer |

**Assessment**: Zod is used pragmatically for critical paths (config, CLI). Full validation coverage is P2/P3 work.

### Future Work (P2/P3)

1. **Comprehensive Schema Coverage**:
   - Formalize all parser output schemas
   - Add database record validation to DAOs
   - Create API response schemas for future integrations

2. **Schema Registry**:
   - Central registry of all schemas
   - Schema versioning for backward compatibility
   - Auto-generate OpenAPI specs from Zod schemas

3. **Testing**:
   - Generate mock data from schemas (zod-mock)
   - Property-based testing with schema-derived inputs

---

## Related Decisions

- **ADR-011**: ReScript Integration Strategy - Zod provides TypeScript-side validation for ReScript interop
- **ADR-013**: Parser Orchestration - Zod validates parser outputs for consistency

---

## References

- **Zod Documentation**: https://zod.dev/
- **Schema Implementations**: `src/types/schemas/`
- **Usage Examples**: CLI commands in `src/cli/commands/`
- **TypeScript Integration Guide**: https://zod.dev/?id=type-inference

---

**Status**: ✅ **Accepted and Partially Implemented**
**Current Coverage**: Config and CLI validation (critical paths)
**Future Work**: Comprehensive schema coverage (P2/P3)
**Performance**: < 1ms validation overhead (exceeds requirements)
