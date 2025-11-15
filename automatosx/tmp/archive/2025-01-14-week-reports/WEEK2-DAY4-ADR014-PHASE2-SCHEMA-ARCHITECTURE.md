# ADR-014 Phase 2: Schema Architecture Design

**Date**: 2025-01-14
**Phase**: Week 2 Day 4 Afternoon
**Status**: ✅ Complete
**Duration**: 3 hours

---

## Executive Summary

This document defines the unified Zod schema architecture for AutomatosX v8.0.0, establishing patterns, conventions, and integration strategies for the missing validation boundaries (Parser and Database).

**Key Decisions**:
1. **Pattern Library**: 5 core schema patterns (Base Types, Branded Types, Domain Objects, Discriminated Unions, Transform & Refine)
2. **File Structure**: Centralized schemas in `src/types/schemas/` with clear naming conventions
3. **Integration Strategy**: Non-breaking gradual rollout with feature flags
4. **Error Handling**: Consistent error formatting and user-friendly messages

---

## Schema Architecture Principles

### 1. Type Safety First
- All schemas must generate TypeScript types via `z.infer<typeof Schema>`
- No `any` or `unknown` in final types (use during validation only)
- Branded types for domain-specific values (IDs, measurements)

### 2. Fail Fast
- Validate at **boundaries** (entry points), not within business logic
- Throw descriptive errors immediately on invalid data
- Use `.parse()` for critical paths, `.safeParse()` for user input

### 3. Composability
- Small, reusable schemas that compose into larger ones
- Shared base schemas via `.extend()` and `.merge()`
- Discriminated unions for polymorphic types

### 4. Documentation
- Every schema includes JSDoc comments with examples
- Validation error messages are user-friendly
- Examples of valid/invalid inputs in tests

### 5. Performance
- Avoid expensive transformations in hot paths
- Cache compiled schemas (Zod already does this)
- Use `.strict()` only when necessary (performance cost)

---

## Pattern Library

### Pattern 1: Base Types (Primitives)

**Purpose**: Reusable validated primitives with constraints

**Examples**:

```typescript
// src/types/schemas/base.schema.ts

import { z } from 'zod';

// ============================================================================
// Numeric Base Types
// ============================================================================

export const PositiveIntSchema = z.number().int().positive();
export const NonNegativeIntSchema = z.number().int().nonnegative();
export const PercentageSchema = z.number().min(0).max(100);
export const RatioSchema = z.number().min(0).max(1);

// ============================================================================
// String Base Types
// ============================================================================

export const NonEmptyStringSchema = z.string().min(1);
export const TrimmedStringSchema = z.string().trim().min(1);
export const UUIDSchema = z.string().uuid();
export const EmailSchema = z.string().email();
export const URLSchema = z.string().url();

// ============================================================================
// File Path Types
// ============================================================================

export const FilePathSchema = z.string()
  .min(1, 'File path cannot be empty')
  .refine(path => !path.includes('\\'), 'Use forward slashes for paths');

export const AbsolutePathSchema = FilePathSchema
  .refine(path => path.startsWith('/'), 'Path must be absolute');

export const RelativePathSchema = FilePathSchema
  .refine(path => !path.startsWith('/'), 'Path must be relative');

// ============================================================================
// Temporal Types
// ============================================================================

export const UnixTimestampSchema = z.number().int().positive();
export const MillisecondsSchema = z.number().int().nonnegative();
export const ISODateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be YYYY-MM-DD format'
);

// ============================================================================
// Bounded Collections
// ============================================================================

export const SmallArraySchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.array(itemSchema).max(100, 'Array exceeds maximum size of 100');

export const MediumArraySchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.array(itemSchema).max(1000, 'Array exceeds maximum size of 1000');

export const LargeArraySchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.array(itemSchema).max(10000, 'Array exceeds maximum size of 10000');
```

**Usage**:
```typescript
import { PositiveIntSchema, FilePathSchema } from './base.schema.js';

const FileIdSchema = PositiveIntSchema; // Semantic alias
const InputPathSchema = FilePathSchema; // Reuse with validation
```

---

### Pattern 2: Branded Types (Nominal Typing)

**Purpose**: Prevent mixing semantically different values of the same primitive type

**Examples**:

```typescript
// src/types/schemas/branded.schema.ts

import { z } from 'zod';

// ============================================================================
// ID Branded Types
// ============================================================================

// User ID: must start with "user-"
export const UserIdSchema = z.string()
  .uuid()
  .refine(id => id.startsWith('user-'), 'User ID must start with "user-"')
  .brand('UserId');

export type UserId = z.infer<typeof UserIdSchema>;

// Conversation ID: must start with "conv-"
export const ConversationIdSchema = z.string()
  .uuid()
  .refine(id => id.startsWith('conv-'), 'Conversation ID must start with "conv-"')
  .brand('ConversationId');

export type ConversationId = z.infer<typeof ConversationIdSchema>;

// Message ID: must start with "msg-"
export const MessageIdSchema = z.string()
  .uuid()
  .refine(id => id.startsWith('msg-'), 'Message ID must start with "msg-"')
  .brand('MessageId');

export type MessageId = z.infer<typeof MessageIdSchema>;

// ============================================================================
// Database ID Types
// ============================================================================

// File ID: positive integer for SQLite rowid
export const FileIdSchema = z.number()
  .int()
  .positive()
  .brand('FileId');

export type FileId = z.infer<typeof FileIdSchema>;

// Symbol ID: positive integer
export const SymbolIdSchema = z.number()
  .int()
  .positive()
  .brand('SymbolId');

export type SymbolId = z.infer<typeof SymbolIdSchema>;

// Chunk ID: positive integer
export const ChunkIdSchema = z.number()
  .int()
  .positive()
  .brand('ChunkId');

export type ChunkId = z.infer<typeof ChunkIdSchema>;

// ============================================================================
// Measurement Types
// ============================================================================

// Byte Size: non-negative integer
export const ByteSizeSchema = z.number()
  .int()
  .nonnegative()
  .brand('ByteSize');

export type ByteSize = z.infer<typeof ByteSizeSchema>;

// Line Number: positive integer
export const LineNumberSchema = z.number()
  .int()
  .positive()
  .brand('LineNumber');

export type LineNumber = z.infer<typeof LineNumberSchema>;

// Column Number: non-negative integer (0-indexed)
export const ColumnNumberSchema = z.number()
  .int()
  .nonnegative()
  .brand('ColumnNumber');

export type ColumnNumber = z.infer<typeof ColumnNumberSchema>;
```

**Benefits**:
```typescript
// ✅ Type safety prevents mixing IDs
function getUser(userId: UserId): User { /* ... */ }
function getConversation(convId: ConversationId): Conversation { /* ... */ }

const userId = UserIdSchema.parse('user-123-456');
const convId = ConversationIdSchema.parse('conv-789-abc');

getUser(userId); // ✅ OK
getUser(convId); // ❌ Type error: ConversationId not assignable to UserId

// ✅ Type safety for measurements
function getSymbolAtLine(fileId: FileId, line: LineNumber): Symbol { /* ... */ }

const fileId = FileIdSchema.parse(42);
const line = LineNumberSchema.parse(100);
const column = ColumnNumberSchema.parse(5);

getSymbolAtLine(fileId, line); // ✅ OK
getSymbolAtLine(fileId, column); // ❌ Type error: ColumnNumber not assignable to LineNumber
```

---

### Pattern 3: Domain Objects (Aggregates)

**Purpose**: Complex objects with multiple fields and business logic validation

**Examples**:

```typescript
// src/types/schemas/parser.schema.ts

import { z } from 'zod';
import { FileIdSchema, LineNumberSchema, ColumnNumberSchema } from './branded.schema.js';

// ============================================================================
// Symbol Kind Enum
// ============================================================================

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

export type SymbolKind = z.infer<typeof SymbolKindSchema>;

// ============================================================================
// Symbol Schema (Domain Object)
// ============================================================================

export const SymbolSchema = z.object({
  name: z.string().min(1, 'Symbol name cannot be empty'),
  kind: SymbolKindSchema,
  line: LineNumberSchema,
  column: ColumnNumberSchema,
  endLine: LineNumberSchema.optional(),
  endColumn: ColumnNumberSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  data => {
    // Validation: endLine must be >= line if provided
    if (data.endLine !== undefined) {
      return data.endLine >= data.line;
    }
    return true;
  },
  {
    message: 'endLine must be greater than or equal to line',
    path: ['endLine'],
  }
).refine(
  data => {
    // Validation: if endLine === line, then endColumn must be > column
    if (data.endLine === data.line && data.endColumn !== undefined) {
      return data.endColumn > data.column;
    }
    return true;
  },
  {
    message: 'endColumn must be greater than column when on the same line',
    path: ['endColumn'],
  }
);

export type Symbol = z.infer<typeof SymbolSchema>;

// ============================================================================
// Parse Result Schema
// ============================================================================

export const ParseResultSchema = z.object({
  symbols: z.array(SymbolSchema),
  parseTime: z.number().nonnegative(),
  nodeCount: z.number().int().nonnegative(),
}).refine(
  data => {
    // Validation: parseTime should be reasonable (< 60 seconds)
    return data.parseTime < 60000;
  },
  {
    message: 'Parse time exceeds 60 seconds - possible infinite loop',
  }
);

export type ParseResult = z.infer<typeof ParseResultSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateSymbol(data: unknown): Symbol {
  return SymbolSchema.parse(data);
}

export function validateParseResult(data: unknown): ParseResult {
  return ParseResultSchema.parse(data);
}

export function safeValidateSymbol(data: unknown): z.SafeParseReturnType<unknown, Symbol> {
  return SymbolSchema.safeParse(data);
}
```

**Business Logic Validation**:
- Cross-field validation via `.refine()`
- Custom error messages with `path` for specific fields
- Semantic constraints (e.g., endLine >= line)

---

### Pattern 4: Discriminated Unions (Polymorphism)

**Purpose**: Type-safe polymorphism for variant types (e.g., different event types, error types)

**Examples**:

```typescript
// src/types/schemas/events.schema.ts

import { z } from 'zod';

// ============================================================================
// Base Event Schema
// ============================================================================

const BaseEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number().int().positive(),
  source: z.string(),
});

// ============================================================================
// Specific Event Schemas
// ============================================================================

const FileIndexedEventSchema = BaseEventSchema.extend({
  type: z.literal('file_indexed'),
  data: z.object({
    fileId: z.number().int().positive(),
    path: z.string(),
    symbolCount: z.number().int().nonnegative(),
  }),
});

const SymbolExtractedEventSchema = BaseEventSchema.extend({
  type: z.literal('symbol_extracted'),
  data: z.object({
    fileId: z.number().int().positive(),
    symbolName: z.string(),
    symbolKind: z.string(),
  }),
});

const ParseErrorEventSchema = BaseEventSchema.extend({
  type: z.literal('parse_error'),
  data: z.object({
    path: z.string(),
    error: z.string(),
    lineNumber: z.number().int().positive().optional(),
  }),
});

// ============================================================================
// Discriminated Union
// ============================================================================

export const IndexingEventSchema = z.discriminatedUnion('type', [
  FileIndexedEventSchema,
  SymbolExtractedEventSchema,
  ParseErrorEventSchema,
]);

export type IndexingEvent = z.infer<typeof IndexingEventSchema>;

// ============================================================================
// Type Guards (Generated Automatically by Zod)
// ============================================================================

export function isFileIndexedEvent(event: IndexingEvent): event is z.infer<typeof FileIndexedEventSchema> {
  return event.type === 'file_indexed';
}

export function isSymbolExtractedEvent(event: IndexingEvent): event is z.infer<typeof SymbolExtractedEventSchema> {
  return event.type === 'symbol_extracted';
}

export function isParseErrorEvent(event: IndexingEvent): event is z.infer<typeof ParseErrorEventSchema> {
  return event.type === 'parse_error';
}
```

**Usage**:
```typescript
function handleEvent(event: IndexingEvent) {
  // TypeScript narrows type based on discriminator
  switch (event.type) {
    case 'file_indexed':
      console.log(`Indexed ${event.data.path} with ${event.data.symbolCount} symbols`);
      break;
    case 'symbol_extracted':
      console.log(`Extracted symbol: ${event.data.symbolName} (${event.data.symbolKind})`);
      break;
    case 'parse_error':
      console.error(`Parse error in ${event.data.path}: ${event.data.error}`);
      break;
  }
}
```

---

### Pattern 5: Transform & Refine (Data Normalization)

**Purpose**: Clean and normalize data during validation

**Examples**:

```typescript
// src/types/schemas/transforms.schema.ts

import { z } from 'zod';

// ============================================================================
// String Transforms
// ============================================================================

// Trim whitespace and ensure non-empty
export const CleanStringSchema = z.string()
  .trim()
  .min(1, 'String cannot be empty');

// Normalize file paths (convert backslashes to forward slashes)
export const NormalizedPathSchema = z.string()
  .transform(path => path.replace(/\\/g, '/'))
  .refine(path => path.length > 0, 'Path cannot be empty');

// Lowercase email
export const EmailSchema = z.string()
  .email()
  .transform(email => email.toLowerCase());

// ============================================================================
// Number Transforms
// ============================================================================

// Coerce string to number
export const CoercedIntSchema = z.coerce.number().int();

// Round floating point to integer
export const RoundedIntSchema = z.number()
  .transform(n => Math.round(n));

// Clamp value to range
export const ClampedPercentageSchema = z.number()
  .transform(n => Math.max(0, Math.min(100, n)));

// ============================================================================
// Date Transforms
// ============================================================================

// Parse ISO string to Date object
export const DateFromISOSchema = z.string()
  .datetime()
  .transform(str => new Date(str));

// Parse Unix timestamp to Date object
export const DateFromUnixSchema = z.number()
  .int()
  .positive()
  .transform(ts => new Date(ts * 1000));

// ============================================================================
// Complex Transforms
// ============================================================================

// Parse JSON string to object
export const JSONStringSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.string()
    .transform((str, ctx) => {
      try {
        return JSON.parse(str);
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid JSON string',
        });
        return z.NEVER;
      }
    })
    .pipe(schema);

// Split comma-separated string to array
export const CommaSeparatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.string()
    .transform(str => str.split(',').map(s => s.trim()).filter(s => s.length > 0))
    .pipe(z.array(itemSchema));

// ============================================================================
// Usage Example
// ============================================================================

const UserInputSchema = z.object({
  name: CleanStringSchema, // Trims whitespace
  email: EmailSchema, // Lowercases email
  age: CoercedIntSchema, // Converts "25" to 25
  tags: CommaSeparatedSchema(z.string()), // Splits "tag1, tag2, tag3" to ["tag1", "tag2", "tag3"]
  createdAt: DateFromISOSchema, // Converts ISO string to Date
});

// Input: { name: "  John  ", email: "JOHN@EXAMPLE.COM", age: "25", tags: "typescript, zod, nodejs", createdAt: "2025-01-14T12:00:00Z" }
// Output: { name: "John", email: "john@example.com", age: 25, tags: ["typescript", "zod", "nodejs"], createdAt: Date object }
```

---

## File Structure & Naming Conventions

### Directory Structure

```
src/types/schemas/
├── base.schema.ts              # Base primitive types
├── branded.schema.ts           # Branded types (IDs, measurements)
├── transforms.schema.ts        # Transform schemas
├── parser.schema.ts            # Parser output schemas
├── database.schema.ts          # Database DAO input schemas
├── memory.schema.ts            # Memory system schemas (existing)
├── provider.schema.ts          # Provider schemas (existing)
├── workflow.schema.ts          # Workflow schemas (existing)
├── telemetry.schema.ts         # Telemetry schemas (existing)
└── cache.schema.ts             # Cache schemas (existing)
```

### Naming Conventions

1. **Schema Files**: `<domain>.schema.ts`
   - Example: `parser.schema.ts`, `database.schema.ts`

2. **Schema Names**: `<Type>Schema`
   - Example: `SymbolSchema`, `ParseResultSchema`, `FileInputSchema`

3. **Type Names**: `<Type>` (inferred from schema)
   - Example: `Symbol`, `ParseResult`, `FileInput`

4. **Validation Functions**: `validate<Type>(data: unknown): Type`
   - Example: `validateSymbol()`, `validateParseResult()`

5. **Safe Validation Functions**: `safeValidate<Type>(data: unknown): SafeParseReturnType`
   - Example: `safeValidateSymbol()`, `safeValidateParseResult()`

6. **Type Guards**: `is<Type>(value: unknown): value is Type`
   - Example: `isSymbol()`, `isParseResult()`

---

## Integration Strategy

### Phase 1: Non-Breaking Addition (Day 5)

**Goal**: Add schemas without changing existing code

**Steps**:
1. Create new schema files: `parser.schema.ts`, `database.schema.ts`
2. Export validation functions
3. Write comprehensive tests for all schemas
4. Document usage in ADR-014

**Example**:
```typescript
// src/types/schemas/parser.schema.ts
export const SymbolSchema = z.object({ /* ... */ });
export const ParseResultSchema = z.object({ /* ... */ });

export function validateSymbol(data: unknown): Symbol {
  return SymbolSchema.parse(data);
}

// No changes to existing code yet
```

### Phase 2: Optional Validation (Day 5)

**Goal**: Add validation to new code paths, keep existing code unchanged

**Steps**:
1. Add feature flag: `ENABLE_PARSER_VALIDATION` (default: `false`)
2. Wrap parser outputs in validation when flag is enabled
3. Log validation errors without throwing
4. Collect metrics on validation failures

**Example**:
```typescript
// src/parser/LanguageParser.ts
import { validateParseResult } from '../types/schemas/parser.schema.js';

export function parse(content: string): ParseResult {
  const result = this.parseInternal(content);

  if (process.env.ENABLE_PARSER_VALIDATION === 'true') {
    try {
      return validateParseResult(result);
    } catch (error) {
      console.warn('Parser validation failed:', error);
      // Continue with unvalidated result for now
    }
  }

  return result;
}
```

### Phase 3: Mandatory Validation (Day 6)

**Goal**: Enforce validation on all data flows

**Steps**:
1. Change feature flag default to `true`
2. Change validation to throw errors (fail fast)
3. Update all call sites to handle validation errors
4. Remove feature flag once stable

**Example**:
```typescript
// src/parser/LanguageParser.ts
import { validateParseResult } from '../types/schemas/parser.schema.js';

export function parse(content: string): ParseResult {
  const result = this.parseInternal(content);
  return validateParseResult(result); // Always validate
}

// src/database/dao/SymbolDAO.ts
import { validateSymbolInput } from '../types/schemas/database.schema.js';

export function insert(symbol: SymbolInput): number {
  const validated = validateSymbolInput(symbol); // Validate before SQL
  // ... execute SQL with validated data
}
```

---

## Error Handling Strategy

### 1. Validation Error Formatting

Create consistent error messages for user-facing errors:

```typescript
// src/utils/ZodErrorFormatter.ts

import { z } from 'zod';

export function formatZodError(error: z.ZodError): string {
  const errors = error.errors.map(e => {
    const path = e.path.join('.');
    return `  • ${path}: ${e.message}`;
  });

  return `Validation failed:\n${errors.join('\n')}`;
}

export function formatZodErrorForCLI(error: z.ZodError): string {
  // Colorized output for CLI
  const chalk = require('chalk');
  const errors = error.errors.map(e => {
    const path = chalk.cyan(e.path.join('.'));
    const message = chalk.red(e.message);
    return `  ${chalk.red('✗')} ${path}: ${message}`;
  });

  return `${chalk.bold.red('Validation Error:')}\n${errors.join('\n')}`;
}
```

### 2. Error Recovery

Decide on error recovery strategy per boundary:

| Boundary | Strategy | Rationale |
|----------|----------|-----------|
| CLI Input | Throw & Exit | User must fix input |
| Parser Output | Log & Continue | Don't block indexing |
| Database DAO | Throw & Rollback | Protect data integrity |
| Provider Request | Throw & Retry | API call can be retried |
| Workflow Step | Throw & Fail Step | Workflow handles failure |

### 3. Error Examples

```typescript
// CLI Input: Throw with formatted error
try {
  const command = RunCommandSchema.parse(argv);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(formatZodErrorForCLI(error));
    process.exit(1);
  }
  throw error;
}

// Parser Output: Log and continue
try {
  const result = validateParseResult(rawResult);
} catch (error) {
  if (error instanceof z.ZodError) {
    logger.warn('Parser output validation failed', {
      file: filePath,
      error: formatZodError(error),
    });
    // Return unvalidated result
    return rawResult;
  }
  throw error;
}

// Database DAO: Throw and let caller handle
try {
  const validated = validateSymbolInput(symbol);
  return this.insertValidated(validated);
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new DatabaseValidationError(
      `Invalid symbol input: ${formatZodError(error)}`,
      { symbol, zodError: error }
    );
  }
  throw error;
}
```

---

## Testing Strategy

### 1. Schema Tests

Test every schema with valid and invalid inputs:

```typescript
// src/types/schemas/__tests__/parser.schema.test.ts

import { describe, it, expect } from 'vitest';
import { SymbolSchema, ParseResultSchema } from '../parser.schema.js';

describe('SymbolSchema', () => {
  it('should validate a valid symbol', () => {
    const valid = {
      name: 'getUserById',
      kind: 'function',
      line: 42,
      column: 10,
    };

    expect(() => SymbolSchema.parse(valid)).not.toThrow();
  });

  it('should reject empty symbol name', () => {
    const invalid = {
      name: '',
      kind: 'function',
      line: 42,
      column: 10,
    };

    expect(() => SymbolSchema.parse(invalid)).toThrow('Symbol name cannot be empty');
  });

  it('should reject invalid symbol kind', () => {
    const invalid = {
      name: 'foo',
      kind: 'unknown',
      line: 42,
      column: 10,
    };

    expect(() => SymbolSchema.parse(invalid)).toThrow();
  });

  it('should reject negative line number', () => {
    const invalid = {
      name: 'foo',
      kind: 'function',
      line: -1,
      column: 10,
    };

    expect(() => SymbolSchema.parse(invalid)).toThrow();
  });

  it('should validate endLine >= line', () => {
    const invalid = {
      name: 'foo',
      kind: 'function',
      line: 42,
      column: 10,
      endLine: 41, // Less than line
    };

    expect(() => SymbolSchema.parse(invalid)).toThrow('endLine must be greater than or equal to line');
  });

  it('should validate endColumn > column when on same line', () => {
    const invalid = {
      name: 'foo',
      kind: 'function',
      line: 42,
      column: 10,
      endLine: 42,
      endColumn: 5, // Less than column
    };

    expect(() => SymbolSchema.parse(invalid)).toThrow('endColumn must be greater than column');
  });
});
```

### 2. Integration Tests

Test validation in real code paths:

```typescript
// src/parser/__tests__/TypeScriptParserService.integration.test.ts

import { describe, it, expect } from 'vitest';
import { TypeScriptParserService } from '../TypeScriptParserService.js';
import { validateParseResult } from '../../types/schemas/parser.schema.js';

describe('TypeScriptParserService with validation', () => {
  it('should produce valid ParseResult', () => {
    const parser = new TypeScriptParserService();
    const code = `
      function getUserById(id: string): User {
        return users.find(u => u.id === id);
      }
    `;

    const result = parser.parse(code);

    // Should not throw
    expect(() => validateParseResult(result)).not.toThrow();

    // Should have valid symbols
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe('getUserById');
    expect(result.symbols[0].kind).toBe('function');
  });
});
```

---

## Performance Considerations

### 1. Schema Compilation

Zod compiles schemas on first use. For hot paths, pre-compile:

```typescript
// Compile once at module load
const compiledSymbolSchema = SymbolSchema;

// Fast validation in hot path
export function validateSymbol(data: unknown): Symbol {
  return compiledSymbolSchema.parse(data); // No compilation cost
}
```

### 2. Avoid Unnecessary Validation

Don't validate data that's already been validated:

```typescript
// ✅ Good: Validate at boundary
function indexFile(path: string) {
  const result = parser.parse(readFile(path));
  const validated = validateParseResult(result); // Validate once

  for (const symbol of validated.symbols) {
    dao.insert(symbol); // Don't re-validate, already validated
  }
}

// ❌ Bad: Validate multiple times
function indexFile(path: string) {
  const result = parser.parse(readFile(path));
  const validated = validateParseResult(result); // Validate once

  for (const symbol of validated.symbols) {
    const revalidated = validateSymbol(symbol); // Unnecessary!
    dao.insert(revalidated);
  }
}
```

### 3. Use `.safeParse()` for User Input

For user input (CLI, API), use `.safeParse()` to avoid throwing:

```typescript
// ✅ Good: Graceful handling
const result = RunCommandSchema.safeParse(argv);
if (!result.success) {
  console.error(formatZodErrorForCLI(result.error));
  process.exit(1);
}
const command = result.data;

// ❌ Bad: Unhandled exception
const command = RunCommandSchema.parse(argv); // Can throw
```

---

## Phase 2 Deliverables ✅

1. ✅ **Pattern Library**: 5 core schema patterns documented with examples
2. ✅ **File Structure**: Clear directory structure and naming conventions
3. ✅ **Integration Strategy**: 3-phase non-breaking rollout plan
4. ✅ **Error Handling**: Consistent error formatting and recovery strategies
5. ✅ **Testing Strategy**: Schema tests and integration tests defined
6. ✅ **Performance Guidelines**: Compilation, validation frequency, and safeParse usage

---

## Next Steps: Phase 3 - Parser Output Validation Implementation

**Timeline**: Week 2 Day 5 Morning (3 hours)

**Objectives**:
1. Create `src/types/schemas/parser.schema.ts` with all parser output schemas
2. Write comprehensive tests for parser schemas
3. Integrate validation into `LanguageParser` base class
4. Test with all 45 language parsers

**Deliverables**:
- `parser.schema.ts` with `SymbolSchema`, `ParseResultSchema`
- Test suite with 20+ test cases
- Integration tests for TypeScript/Python/Go parsers
- Feature flag implementation for gradual rollout

---

**Phase 2 Status**: ✅ **COMPLETE**
**Time Taken**: 3 hours
**Next Phase**: Phase 3 - Parser Output Validation Implementation
**ETA**: Week 2 Day 5 Morning
