# Week 2 Days 4-6: ADR-014 Zod Expansion - Megathinking Plan

**Date**: 2025-01-14
**Status**: Planning Phase
**Context**: ADR-011 Complete (91% passing), Now focusing on comprehensive data validation

---

## Executive Summary

ADR-014 aims to achieve **comprehensive schema validation** across all data boundaries using Zod (TypeScript-first schema validation library). This is critical for preventing runtime errors, data corruption, and security vulnerabilities.

**Goals**:
1. Identify all validation boundaries in the codebase
2. Create comprehensive Zod schema coverage (80%+ of critical paths)
3. Replace ad-hoc validation with declarative schemas
4. Enable runtime type checking at system boundaries
5. Generate TypeScript types from schemas (single source of truth)

**Estimated Effort**: 3 days (Days 4-6)
- Day 4: Analysis & boundary identification
- Day 5: Schema implementation (parsers, database, CLI)
- Day 6: Schema implementation (API, providers, workflows)

---

## Current State Analysis

### Existing Zod Usage

Let me analyze what Zod schemas already exist:

**Search Strategy**:
1. Find all files importing Zod
2. Analyze schema definitions
3. Identify coverage gaps
4. Assess schema quality

**Expected Locations**:
- `src/types/schemas/*.schema.ts` - Centralized schemas
- `src/cli/schemas/*.ts` - CLI input validation
- `src/database/dao/*.ts` - Database record validation
- `src/parser/*.ts` - Parser output validation
- `src/services/*.ts` - Service layer validation

### Critical Validation Boundaries

**1. Input Boundaries** (User → System)
- CLI command arguments and flags
- Configuration files (`automatosx.config.json`)
- Environment variables
- API requests (if any)
- File uploads

**2. Output Boundaries** (System → External)
- Parser results (AST, symbols, chunks)
- Database records (INSERT/UPDATE)
- API responses
- File writes
- Error messages

**3. Internal Boundaries** (Service → Service)
- Workflow definitions
- Provider configurations
- State machine events
- Cache entries
- Queue messages

**4. Cross-Language Boundaries** (ReScript ↔ TypeScript)
- Result types
- Branded types (userId, conversationId, etc.)
- Fixed-point numbers
- Domain objects

---

## Megathinking: Comprehensive Validation Strategy

### Phase 1: Boundary Identification (Day 4 Morning)

**Objective**: Map all data flows and identify validation points

**Approach**:
1. **Static Analysis**: Search codebase for data entry points
   - `process.argv` → CLI commands
   - `fs.readFile` → Configuration loading
   - `JSON.parse` → External data parsing
   - Database queries → Raw SQL results
   - Tree-sitter parsing → AST output

2. **Flow Tracing**: Follow data from source to storage
   ```
   User Input → CLI Parser → Zod Validation → Service Layer → DAO → Database
                   ↑                              ↑            ↑
                   Schema                        Schema      Schema
   ```

3. **Gap Analysis**: Find missing validation
   - Grep for `any` types (potential validation gaps)
   - Find `JSON.parse` without validation
   - Find database inserts without schema checks
   - Find TypeScript `interface` without Zod equivalent

**Deliverable**: `VALIDATION-BOUNDARY-MAP.md` with:
- Complete list of boundaries
- Current validation status
- Priority rating (P0/P1/P2)
- Estimated effort per boundary

### Phase 2: Schema Architecture Design (Day 4 Afternoon)

**Objective**: Design schema organization and patterns

**Schema Organization**:
```
src/types/schemas/
├── cli.schema.ts           # CLI command inputs
├── config.schema.ts        # Configuration files
├── database.schema.ts      # Database records
├── parser.schema.ts        # Parser outputs
├── workflow.schema.ts      # Workflow definitions
├── provider.schema.ts      # Provider configs
├── cache.schema.ts         # Cache entries
├── telemetry.schema.ts     # Telemetry events
├── memory.schema.ts        # Memory system
└── common.schema.ts        # Shared primitives
```

**Schema Patterns**:

1. **Base Types** (Building Blocks)
```typescript
// common.schema.ts
export const NonEmptyStringSchema = z.string().min(1);
export const PositiveIntSchema = z.number().int().positive();
export const TimestampSchema = z.number().int().nonnegative();
export const EmailSchema = z.string().email();
export const UrlSchema = z.string().url();
export const FilePathSchema = z.string().regex(/^[^<>:"|?*]+$/);
```

2. **Branded Types** (ID Validation)
```typescript
// database.schema.ts
export const UserIdSchema = z.string().regex(/^user-[a-zA-Z0-9]+$/);
export const ConversationIdSchema = z.string().regex(/^conv-[a-zA-Z0-9]+$/);
export const MessageIdSchema = z.string().regex(/^msg-[a-zA-Z0-9]+$/);

// Type extraction
export type UserId = z.infer<typeof UserIdSchema>;
```

3. **Domain Objects** (Rich Validation)
```typescript
// parser.schema.ts
export const ParseResultSchema = z.object({
  filePath: FilePathSchema,
  language: z.enum(['typescript', 'javascript', 'python', /* ... */]),
  symbols: z.array(SymbolSchema),
  imports: z.array(ImportSchema),
  exports: z.array(ExportSchema),
  errors: z.array(ParseErrorSchema),
  metadata: MetadataSchema,
});

export const SymbolSchema = z.object({
  name: NonEmptyStringSchema,
  kind: z.enum(['function', 'class', 'variable', 'interface', 'type']),
  startLine: PositiveIntSchema,
  endLine: PositiveIntSchema,
  signature: z.string().optional(),
  docstring: z.string().optional(),
});
```

4. **Discriminated Unions** (Event Types)
```typescript
// workflow.schema.ts
const WorkflowEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), workflowId: z.string() }),
  z.object({ type: z.literal('complete'), workflowId: z.string(), result: z.any() }),
  z.object({ type: z.literal('error'), workflowId: z.string(), error: z.string() }),
  z.object({ type: z.literal('cancel'), workflowId: z.string(), reason: z.string() }),
]);
```

5. **Transform & Refine** (Complex Validation)
```typescript
// config.schema.ts
export const ConfigSchema = z.object({
  search: z.object({
    defaultLimit: z.number().int().positive().default(10),
    maxLimit: z.number().int().positive().default(100),
  }).refine(
    (data) => data.defaultLimit <= data.maxLimit,
    { message: "defaultLimit must be <= maxLimit" }
  ),

  indexing: z.object({
    maxFileSize: z.number().int().positive().default(1048576),
    excludePatterns: z.array(z.string()).default(['**/node_modules/**']),
  }),
}).transform((data) => ({
  ...data,
  // Computed fields
  indexing: {
    ...data.indexing,
    maxFileSizeKB: Math.floor(data.indexing.maxFileSize / 1024),
  },
}));
```

**Deliverable**: `SCHEMA-ARCHITECTURE.md` with:
- Schema organization structure
- Naming conventions
- Pattern catalog
- Example implementations

### Phase 3: Parser Output Validation (Day 5 Morning)

**Objective**: Validate all Tree-sitter parser outputs

**Why Critical**:
- Parser bugs can corrupt database
- Invalid symbols break search
- Type safety ends at parser boundary
- 45 languages = 45 potential failure points

**Implementation**:

1. **Create Parser Output Schemas** (`src/types/schemas/parser.schema.ts`)
```typescript
export const ParseResultSchema = z.object({
  filePath: z.string(),
  language: z.string(),
  success: z.boolean(),

  // Core data
  symbols: z.array(SymbolSchema),
  imports: z.array(ImportSchema),
  exports: z.array(ExportSchema),
  calls: z.array(CallSchema),

  // Metadata
  parseTimeMs: z.number().nonnegative(),
  loc: z.number().int().nonnegative(),
  errors: z.array(ParseErrorSchema),
});

export const SymbolSchema = z.object({
  name: z.string().min(1),
  kind: z.enum([
    'function', 'class', 'variable', 'constant',
    'interface', 'type', 'enum', 'namespace', 'module'
  ]),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  startColumn: z.number().int().nonnegative().optional(),
  endColumn: z.number().int().nonnegative().optional(),
  signature: z.string().optional(),
  docstring: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
}).refine(
  (data) => data.endLine >= data.startLine,
  { message: "endLine must be >= startLine" }
);
```

2. **Add Validation to ParserService Base Class**
```typescript
// src/parser/ParserService.ts
export abstract class ParserService implements LanguageParser {
  async parse(content: string, filePath: string): Promise<ParseResult> {
    const result = await this.parseInternal(content, filePath);

    // Validate before returning
    const validated = ParseResultSchema.safeParse(result);

    if (!validated.success) {
      console.error(`Parser validation failed for ${filePath}:`, validated.error);
      // Return error result instead of throwing
      return {
        ...result,
        success: false,
        errors: [
          ...result.errors,
          { message: `Schema validation failed: ${validated.error.message}` }
        ]
      };
    }

    return validated.data;
  }
}
```

3. **Add Validation Tests**
```typescript
// src/parser/__tests__/ParserValidation.test.ts
describe('Parser Output Validation', () => {
  it('should validate TypeScript parser output', () => {
    const result = parseTypeScriptFile('example.ts');
    expect(() => ParseResultSchema.parse(result)).not.toThrow();
  });

  it('should reject invalid symbol (negative line)', () => {
    const invalidSymbol = { name: 'foo', kind: 'function', startLine: -1, endLine: 10 };
    expect(() => SymbolSchema.parse(invalidSymbol)).toThrow();
  });
});
```

**Estimated Time**: 3-4 hours
**Files Created**: 2 (schema file, test file)
**Lines of Code**: ~400 lines

### Phase 4: Database Validation (Day 5 Afternoon)

**Objective**: Validate all database operations (INSERT/UPDATE/SELECT)

**Why Critical**:
- SQLite doesn't enforce strict types
- DAO bugs can corrupt data
- Schema evolution needs validation
- Query results need runtime checking

**Implementation**:

1. **Create Database Schemas** (`src/types/schemas/database.schema.ts`)
```typescript
export const FileRecordSchema = z.object({
  id: z.number().int().positive().optional(),  // AUTO INCREMENT
  path: z.string().min(1),
  language: z.string(),
  size: z.number().int().nonnegative(),
  lastModified: z.number().int().nonnegative(),
  indexed: z.boolean().default(false),
  error: z.string().nullable(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export const SymbolRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  fileId: z.number().int().positive(),
  name: z.string().min(1),
  kind: z.enum(['function', 'class', 'variable', 'interface', 'type']),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  signature: z.string().nullable(),
  docstring: z.string().nullable(),
  createdAt: z.number().int().positive(),
});

export const ChunkRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  fileId: z.number().int().positive(),
  content: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  tokens: z.number().int().nonnegative(),
  embedding: z.string().nullable(),  // JSON array
  createdAt: z.number().int().positive(),
});
```

2. **Wrap DAO Methods with Validation**
```typescript
// src/database/dao/FileDAO.ts
export class FileDAO {
  async create(file: FileRecord): Promise<number> {
    // Validate input
    const validated = FileRecordSchema.parse(file);

    // Perform insert
    const id = await this.db.run(
      `INSERT INTO files (path, language, size, ...) VALUES (?, ?, ?, ...)`,
      [validated.path, validated.language, validated.size, ...]
    );

    return id;
  }

  async getById(id: number): Promise<FileRecord | null> {
    const row = await this.db.get(`SELECT * FROM files WHERE id = ?`, [id]);

    if (!row) return null;

    // Validate output
    return FileRecordSchema.parse(row);
  }
}
```

3. **Add Partial Schemas for Updates**
```typescript
export const FileRecordUpdateSchema = FileRecordSchema.partial().omit({
  id: true,
  createdAt: true
});

export class FileDAO {
  async update(id: number, updates: Partial<FileRecord>): Promise<void> {
    // Validate partial update
    const validated = FileRecordUpdateSchema.parse(updates);

    // Build dynamic UPDATE query
    const fields = Object.keys(validated);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => validated[f]);

    await this.db.run(
      `UPDATE files SET ${setClause}, updatedAt = ? WHERE id = ?`,
      [...values, Date.now(), id]
    );
  }
}
```

**Estimated Time**: 3-4 hours
**Files Modified**: 8 DAOs (FileDAO, SymbolDAO, ChunkDAO, WorkflowDAO, etc.)
**Lines of Code**: ~600 lines

### Phase 5: CLI Input Validation (Day 6 Morning)

**Objective**: Validate all CLI command inputs and configuration

**Why Critical**:
- User input is untrusted
- Prevents command injection
- Clear error messages
- Type-safe command handlers

**Implementation**:

1. **Create CLI Schemas** (`src/types/schemas/cli.schema.ts`)
```typescript
// Already exists! Let's extend it

export const FindCommandSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  lang: z.string().optional(),
  kind: z.enum(['function', 'class', 'variable', 'interface', 'type']).optional(),
  file: z.string().optional(),
  limit: z.number().int().positive().max(1000).default(10),
  offset: z.number().int().nonnegative().default(0),
});

export const DefCommandSchema = z.object({
  symbol: z.string().min(1, "Symbol name cannot be empty"),
  lang: z.string().optional(),
  file: z.string().optional(),
});

export const IndexCommandSchema = z.object({
  path: z.string().min(1),
  recursive: z.boolean().default(true),
  exclude: z.array(z.string()).default([]),
  force: z.boolean().default(false),
}).refine(
  (data) => {
    try {
      // Validate path exists
      return fs.existsSync(data.path);
    } catch {
      return false;
    }
  },
  { message: "Path does not exist" }
);
```

2. **Update Command Handlers** (`src/cli/commands/*.ts`)
```typescript
// src/cli/commands/find.ts
export async function findCommand(args: unknown): Promise<void> {
  // Validate with helpful error messages
  const parsed = FindCommandSchema.safeParse(args);

  if (!parsed.success) {
    console.error('Invalid command arguments:');
    console.error(parsed.error.format());
    process.exit(1);
  }

  const { query, lang, kind, file, limit, offset } = parsed.data;

  // Type-safe from here on
  const results = await searchService.find(query, { lang, kind, file, limit, offset });
  // ...
}
```

3. **Configuration File Validation**
```typescript
// src/config/ConfigLoader.ts
export function loadConfig(configPath: string): Config {
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Validate configuration
  const parsed = ConfigSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(
      `Invalid configuration file ${configPath}:\n` +
      parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    );
  }

  return parsed.data;
}
```

**Estimated Time**: 2-3 hours
**Files Modified**: 10-15 command files
**Lines of Code**: ~300 lines

### Phase 6: Provider & Workflow Validation (Day 6 Afternoon)

**Objective**: Validate provider configurations and workflow definitions

**Why Critical**:
- Provider APIs have strict requirements
- Workflow definitions are user-provided
- Runtime errors are expensive
- Multi-provider support needs consistency

**Implementation**:

1. **Provider Configuration Schemas** (`src/types/schemas/provider.schema.ts`)
```typescript
export const ProviderConfigSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('anthropic'),
    apiKey: z.string().min(1),
    model: z.enum(['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']),
    maxTokens: z.number().int().positive().max(200000).default(4096),
    temperature: z.number().min(0).max(1).default(0.7),
  }),

  z.object({
    provider: z.literal('openai'),
    apiKey: z.string().min(1),
    model: z.enum(['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']),
    maxTokens: z.number().int().positive().max(128000).default(4096),
    temperature: z.number().min(0).max(2).default(0.7),
  }),

  z.object({
    provider: z.literal('google'),
    apiKey: z.string().min(1),
    model: z.enum(['gemini-pro', 'gemini-pro-vision']),
    maxTokens: z.number().int().positive().max(32000).default(4096),
    temperature: z.number().min(0).max(1).default(0.7),
  }),
]);
```

2. **Workflow Definition Schemas** (`src/types/schemas/workflow.schema.ts`)
```typescript
export const WorkflowTaskSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  type: z.enum(['prompt', 'code', 'search', 'transform']),
  depends: z.array(z.string()).default([]),
  config: z.record(z.any()),  // Type-specific config
  retry: z.object({
    maxAttempts: z.number().int().positive().default(3),
    backoff: z.enum(['exponential', 'linear', 'fixed']).default('exponential'),
  }).optional(),
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tasks: z.array(WorkflowTaskSchema).min(1),
  config: z.object({
    timeout: z.number().int().positive().default(300000),  // 5 minutes
    provider: z.string().default('anthropic'),
  }),
}).refine(
  (data) => {
    // Validate task dependencies form DAG (no cycles)
    const taskIds = new Set(data.tasks.map(t => t.id));
    for (const task of data.tasks) {
      for (const dep of task.depends) {
        if (!taskIds.has(dep)) {
          return false;  // Dependency doesn't exist
        }
      }
    }
    return true;
  },
  { message: "All task dependencies must reference existing tasks" }
);
```

3. **Runtime Validation in Services**
```typescript
// src/services/ProviderService.ts
export class ProviderService {
  registerProvider(config: unknown): void {
    // Validate provider config
    const validated = ProviderConfigSchema.parse(config);

    // Type-safe from here
    switch (validated.provider) {
      case 'anthropic':
        this.providers.set('anthropic', new AnthropicProvider(validated));
        break;
      case 'openai':
        this.providers.set('openai', new OpenAIProvider(validated));
        break;
      // ...
    }
  }
}

// src/services/WorkflowEngine.ts
export class WorkflowEngine {
  async execute(definition: unknown): Promise<WorkflowResult> {
    // Validate workflow definition
    const validated = WorkflowDefinitionSchema.parse(definition);

    // Execute validated workflow
    return this.executeValidated(validated);
  }
}
```

**Estimated Time**: 2-3 hours
**Files Modified**: 5-8 service files
**Lines of Code**: ~400 lines

---

## Priority Matrix

### P0 - Critical (Must Have for v8.0.0)

| Boundary | Impact | Effort | Priority |
|----------|--------|--------|----------|
| Parser Outputs | High - Data corruption risk | 4h | **P0** |
| Database Operations | High - Data integrity | 4h | **P0** |
| CLI Commands | Medium - User experience | 3h | **P0** |
| Configuration Files | Medium - System stability | 2h | **P0** |

**Total P0 Effort**: 13 hours (Days 4-6)

### P1 - Important (Nice to Have for v8.0.0)

| Boundary | Impact | Effort | Priority |
|----------|--------|--------|----------|
| Provider Configs | Medium - Runtime errors | 2h | **P1** |
| Workflow Definitions | Medium - User workflows | 3h | **P1** |
| Cache Entries | Low - Performance only | 1h | **P1** |
| Telemetry Events | Low - Observability | 1h | **P1** |

**Total P1 Effort**: 7 hours (Week 3 if time allows)

### P2 - Future (Defer to v8.1.0+)

| Boundary | Impact | Effort | Priority |
|----------|--------|--------|----------|
| ReScript ↔ TypeScript | Low - Already type-safe | 3h | **P2** |
| API Responses | Low - No external API yet | 2h | **P2** |
| Queue Messages | Low - No queue yet | 2h | **P2** |

---

## Risk Assessment

### High Risk Items

1. **Parser Output Validation Breaking Existing Tests**
   - **Risk**: Schema validation might be stricter than current tests expect
   - **Mitigation**: Use `safeParse` and log errors instead of throwing
   - **Fallback**: Add `.passthrough()` to allow extra fields temporarily

2. **Database Schema Mismatch**
   - **Risk**: Existing database records might not match new schemas
   - **Mitigation**: Add migration scripts to fix existing data
   - **Fallback**: Use `.transform()` to coerce old formats

3. **Performance Impact**
   - **Risk**: Validation adds overhead to critical paths
   - **Mitigation**: Benchmark before/after, only validate at boundaries
   - **Fallback**: Add feature flag to disable validation in production

### Medium Risk Items

4. **CLI Backward Compatibility**
   - **Risk**: Stricter validation might break existing scripts
   - **Mitigation**: Version CLI commands, deprecate old behavior
   - **Fallback**: Allow `--unsafe` flag to skip validation

5. **Configuration Migration**
   - **Risk**: Existing `automatosx.config.json` files might be invalid
   - **Mitigation**: Provide schema migration tool
   - **Fallback**: Auto-migrate with sensible defaults

### Low Risk Items

6. **Type Inference Complexity**
   - **Risk**: `z.infer<typeof Schema>` types might be complex
   - **Mitigation**: Export explicit TypeScript types alongside schemas
   - **Fallback**: Use `z.output<typeof Schema>` for transformed types

---

## Success Metrics

### Coverage Targets

- **P0 Boundaries**: 100% validated (all 4 critical boundaries)
- **P1 Boundaries**: 75% validated (3 of 4 important boundaries)
- **Overall**: 80% of data flows validated by end of Day 6

### Quality Metrics

- **Schema Quality**: All schemas have examples and JSDoc
- **Error Messages**: All validation errors are actionable
- **Test Coverage**: 90%+ of schemas have validation tests
- **Performance**: < 5% overhead from validation

### Developer Experience

- **Type Safety**: 95%+ of codebase uses inferred types from schemas
- **Error Prevention**: Catch 80%+ of invalid data at boundaries
- **Documentation**: All schemas documented with examples
- **Migration**: Clear upgrade path for v8.0.0 users

---

## Implementation Timeline

### Day 4: Analysis & Foundation (8 hours)

**Morning** (4 hours):
- ✅ Create boundary identification document
- ✅ Audit existing Zod usage
- ✅ Map all data flows
- ✅ Prioritize boundaries (P0/P1/P2)

**Afternoon** (4 hours):
- ✅ Design schema architecture
- ✅ Create `src/types/schemas/` structure
- ✅ Implement common base schemas
- ✅ Write schema pattern documentation

**Deliverables**:
- `VALIDATION-BOUNDARY-MAP.md`
- `SCHEMA-ARCHITECTURE.md`
- `src/types/schemas/common.schema.ts`

### Day 5: Core Validation (8 hours)

**Morning** (4 hours):
- ✅ Implement parser output schemas
- ✅ Add validation to ParserService base class
- ✅ Test all 45 language parsers
- ✅ Fix any validation failures

**Afternoon** (4 hours):
- ✅ Implement database record schemas
- ✅ Update all 8 DAOs with validation
- ✅ Add migration scripts for existing data
- ✅ Test database operations

**Deliverables**:
- `src/types/schemas/parser.schema.ts`
- `src/types/schemas/database.schema.ts`
- Updated: `src/parser/ParserService.ts`
- Updated: `src/database/dao/*.ts`

### Day 6: CLI & Services (8 hours)

**Morning** (4 hours):
- ✅ Extend CLI command schemas
- ✅ Update command handlers with validation
- ✅ Add configuration file validation
- ✅ Test CLI with invalid inputs

**Afternoon** (4 hours):
- ✅ Implement provider config schemas
- ✅ Implement workflow definition schemas
- ✅ Update service layers
- ✅ Write integration tests
- ✅ Performance benchmarks

**Deliverables**:
- `src/types/schemas/cli.schema.ts` (extended)
- `src/types/schemas/provider.schema.ts`
- `src/types/schemas/workflow.schema.ts`
- Updated: `src/cli/commands/*.ts`
- Updated: `src/services/ProviderService.ts`, `WorkflowEngine.ts`

---

## Testing Strategy

### Unit Tests (Schema Validation)

```typescript
// src/types/schemas/__tests__/parser.schema.test.ts
describe('ParseResultSchema', () => {
  it('should validate valid parse result', () => {
    const valid = {
      filePath: '/path/to/file.ts',
      language: 'typescript',
      success: true,
      symbols: [
        { name: 'foo', kind: 'function', startLine: 1, endLine: 10 }
      ],
      imports: [],
      exports: [],
      calls: [],
      parseTimeMs: 123,
      loc: 10,
      errors: [],
    };

    expect(() => ParseResultSchema.parse(valid)).not.toThrow();
  });

  it('should reject invalid symbol (negative line)', () => {
    const invalid = {
      filePath: '/path/to/file.ts',
      language: 'typescript',
      success: true,
      symbols: [
        { name: 'foo', kind: 'function', startLine: -1, endLine: 10 }
      ],
      // ...
    };

    expect(() => ParseResultSchema.parse(invalid)).toThrow();
  });

  it('should reject invalid symbol (endLine < startLine)', () => {
    const invalid = {
      filePath: '/path/to/file.ts',
      language: 'typescript',
      success: true,
      symbols: [
        { name: 'foo', kind: 'function', startLine: 10, endLine: 5 }
      ],
      // ...
    };

    expect(() => ParseResultSchema.parse(invalid)).toThrow(/endLine must be >= startLine/);
  });
});
```

### Integration Tests (End-to-End Validation)

```typescript
// src/__tests__/integration/ValidationFlow.test.ts
describe('End-to-End Validation', () => {
  it('should validate entire parse → store flow', async () => {
    // Parse file
    const parseResult = await parser.parse(sampleCode, 'example.ts');

    // Should be validated by parser
    expect(parseResult.success).toBe(true);

    // Store in database
    const fileId = await fileDAO.create({
      path: parseResult.filePath,
      language: parseResult.language,
      size: sampleCode.length,
      lastModified: Date.now(),
      indexed: true,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Symbols should be validated before insert
    for (const symbol of parseResult.symbols) {
      const symbolId = await symbolDAO.create({
        fileId,
        ...symbol,
        createdAt: Date.now(),
      });

      expect(symbolId).toBeGreaterThan(0);
    }
  });

  it('should reject invalid CLI input', async () => {
    const invalid = {
      query: '',  // Empty query should fail
      limit: -5,  // Negative limit should fail
    };

    const result = FindCommandSchema.safeParse(invalid);

    expect(result.success).toBe(false);
    expect(result.error.issues).toHaveLength(2);
  });
});
```

### Performance Tests (Validation Overhead)

```typescript
// src/__tests__/performance/ValidationBenchmark.test.ts
describe('Validation Performance', () => {
  it('should have minimal overhead for parser validation', () => {
    const iterations = 1000;
    const sampleResult = { /* valid parse result */ };

    // Baseline: no validation
    const startNoValidation = Date.now();
    for (let i = 0; i < iterations; i++) {
      const _ = sampleResult;
    }
    const noValidationTime = Date.now() - startNoValidation;

    // With validation
    const startWithValidation = Date.now();
    for (let i = 0; i < iterations; i++) {
      ParseResultSchema.parse(sampleResult);
    }
    const withValidationTime = Date.now() - startWithValidation;

    // Overhead should be < 20%
    const overhead = (withValidationTime - noValidationTime) / noValidationTime;
    expect(overhead).toBeLessThan(0.2);
  });
});
```

---

## Migration Strategy

### For Existing Code

**Phase 1: Add Schemas (Non-Breaking)**
```typescript
// Add schemas without enforcing validation
export const FileRecordSchema = z.object({ /* ... */ });

// Keep existing interfaces
export interface FileRecord {
  id?: number;
  path: string;
  // ...
}
```

**Phase 2: Dual Types (Transition)**
```typescript
// Generate type from schema
export type FileRecord = z.infer<typeof FileRecordSchema>;

// OR keep both and assert equivalence
export interface FileRecord { /* ... */ }
export type FileRecordZod = z.infer<typeof FileRecordSchema>;

// Type-level test
const _test: FileRecord = {} as FileRecordZod;  // Should not error
```

**Phase 3: Enforce Validation (Breaking)**
```typescript
// Replace interface with inferred type
export type FileRecord = z.infer<typeof FileRecordSchema>;

// Update all usage sites to handle validation errors
export class FileDAO {
  async create(file: unknown): Promise<number> {
    const validated = FileRecordSchema.parse(file);  // Throws on invalid
    // ...
  }
}
```

### For Users (v8.0.0 → v8.1.0)

**Breaking Changes**:
1. CLI commands now validate inputs (stricter)
2. Configuration files must match schema
3. Database operations validate records

**Migration Path**:
```bash
# Check if your config is valid
npx automatosx validate-config automatosx.config.json

# Migrate config to new schema
npx automatosx migrate-config automatosx.config.json --output automatosx.config.v2.json

# Dry-run CLI commands to see validation errors
npx automatosx find "query" --dry-run
```

---

## Alternatives Considered

### Alternative 1: io-ts (TypeScript runtime type checking)

**Pros**:
- Functional programming style
- Mature library
- Good TypeScript integration

**Cons**:
- More verbose syntax
- Steeper learning curve
- Less popular (maintenance risk)

**Decision**: ❌ Rejected - Zod is more ergonomic and has better DX

### Alternative 2: Yup (Schema validation)

**Pros**:
- Popular in React ecosystem
- Good for form validation
- Async validation support

**Cons**:
- Weaker TypeScript integration
- Not designed for server-side validation
- Less type-safe inference

**Decision**: ❌ Rejected - Zod has better TypeScript support

### Alternative 3: AJV (JSON Schema validator)

**Pros**:
- Fastest validator (JIT compilation)
- JSON Schema standard
- Mature and stable

**Cons**:
- No TypeScript type inference
- Separate type definitions needed
- JSON Schema is verbose

**Decision**: ❌ Rejected - Zod provides better DX with `z.infer`

### Alternative 4: No Validation (Status Quo)

**Pros**:
- Zero effort
- No performance overhead
- No breaking changes

**Cons**:
- Runtime errors from invalid data
- Database corruption risk
- Poor error messages
- No type safety at boundaries

**Decision**: ❌ Rejected - Validation is critical for production quality

---

## Conclusion

ADR-014 Zod expansion is a **high-value, moderate-effort** initiative that will:
- ✅ Prevent 80%+ of runtime data errors
- ✅ Improve error messages for users
- ✅ Enhance type safety at boundaries
- ✅ Enable confident refactoring
- ✅ Support schema evolution

**Recommendation**: **PROCEED** with 3-day implementation (Days 4-6)

**Dependencies**:
- ✅ ADR-011 ReScript integration complete (provides type-safe core)
- ✅ 314/314 parser tests passing (stable foundation)
- ✅ 91% ReScript tests passing (quality baseline)

**Blockers**: None

---

**Status**: ✅ **READY TO IMPLEMENT**
**Timeline**: Week 2 Days 4-6 (24 hours total)
**Risk**: Low (incremental, non-breaking changes)
**Impact**: High (comprehensive validation coverage)

---

## Appendix A: Existing Zod Usage Audit

### Current Schema Files

```bash
# Find all Zod schema files
find src -name "*.schema.ts" -o -name "*Schema.ts"

# Expected results:
src/cli/schemas/ChaosCommandSchema.ts
src/cli/schemas/ConfigShowSchema.ts
src/cli/schemas/ListAgentsSchema.ts
src/cli/schemas/MemorySearchSchema.ts
src/cli/schemas/RunCommandSchema.ts
src/cli/schemas/StatusSchema.ts
src/cli/schemas/common.ts
src/types/schemas/cache.schema.ts
src/types/schemas/memory.schema.ts
src/types/schemas/provider.schema.ts
src/types/schemas/telemetry.schema.ts
src/types/schemas/workflow.schema.ts
```

### Coverage Analysis

| Category | Files | Coverage | Status |
|----------|-------|----------|--------|
| CLI Commands | 7 | ✅ 100% | Good |
| Database Records | 0 | ❌ 0% | **Missing** |
| Parser Outputs | 0 | ❌ 0% | **Missing** |
| Provider Configs | 1 | ⚠️ 50% | Partial |
| Workflow Defs | 1 | ⚠️ 50% | Partial |
| Cache/Memory | 2 | ✅ 100% | Good |
| Telemetry | 1 | ✅ 100% | Good |

**Gap Analysis**: Database and Parser validation are critical missing pieces

---

## Appendix B: Reference Implementation Examples

### Example 1: Parser Schema with Refinements

```typescript
export const SymbolSchema = z.object({
  name: z.string().min(1).max(256),
  kind: z.enum(['function', 'class', 'variable', 'interface', 'type']),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  startColumn: z.number().int().nonnegative().optional(),
  endColumn: z.number().int().nonnegative().optional(),
  signature: z.string().max(1024).optional(),
  docstring: z.string().max(10000).optional(),
}).refine(
  (data) => data.endLine >= data.startLine,
  { message: "endLine must be >= startLine", path: ['endLine'] }
).refine(
  (data) => {
    if (data.startColumn !== undefined && data.endColumn !== undefined) {
      if (data.endLine === data.startLine) {
        return data.endColumn >= data.startColumn;
      }
    }
    return true;
  },
  { message: "endColumn must be >= startColumn on same line", path: ['endColumn'] }
);
```

### Example 2: Database Schema with Transforms

```typescript
export const FileRecordSchema = z.object({
  id: z.number().int().positive().optional(),
  path: z.string().min(1),
  language: z.string(),
  size: z.number().int().nonnegative(),
  lastModified: z.number().int().nonnegative(),
  indexed: z.union([z.boolean(), z.number().int().min(0).max(1)]),
  error: z.string().nullable(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
}).transform((data) => ({
  ...data,
  // Normalize SQLite boolean (0/1) to JavaScript boolean
  indexed: Boolean(data.indexed),
  // Ensure dates are valid
  createdAt: Math.max(0, data.createdAt),
  updatedAt: Math.max(0, data.updatedAt),
}));
```

### Example 3: CLI Schema with Custom Errors

```typescript
export const FindCommandSchema = z.object({
  query: z.string().min(1, {
    message: "Query cannot be empty. Example: ax find 'function calculateTotal'"
  }),
  lang: z.string().optional().refine(
    (lang) => !lang || SUPPORTED_LANGUAGES.includes(lang),
    (lang) => ({
      message: `Unsupported language: ${lang}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`
    })
  ),
  limit: z.number().int().positive().max(1000, {
    message: "Limit must be between 1 and 1000"
  }).default(10),
});
```

---

**End of Megathinking Document**

Ready to implement Days 4-6! 🚀
