# Core Systems - Developer Guide

This file provides guidance for working with AutomatosX core systems: Router, Memory Manager, Session Manager, and Spec-Kit.

---

## Memory System (`memory-manager.ts`)

### Architecture

- **Storage:** SQLite + FTS5 for full-text search
- **Performance:** < 1ms search with prepared statements
- **Capacity:** 10,000 entries with auto-cleanup
- **Persistence:** Debounced saves (reduces I/O)

### Key Operations

```typescript
// Search memory (FTS5 full-text search)
const results = await memoryManager.search('authentication', { limit: 10 });

// Add memory entry
await memoryManager.add({
  content: 'Implemented JWT authentication',
  agent: 'backend',
  metadata: { tags: ['security', 'auth'] }
});

// Auto-cleanup strategies
cleanup: 'oldest' | 'least_accessed' | 'hybrid'
```

### Best Practices

1. **Use Prepared Statements:** Always use prepared statements for SQL operations
   ```typescript
   const stmt = db.prepare('SELECT * FROM memories WHERE id = ?');
   stmt.get(id);  // Safe from SQL injection
   ```

2. **Debounce Saves:** Use debouncing to reduce I/O
   ```typescript
   private debouncedSave = debounce(() => this.persist(), 1000);
   ```

3. **Handle Concurrent Access:** Set busyTimeout for SQLite
   ```typescript
   db.pragma('busy_timeout = 5000');  // 5 second timeout
   ```

4. **Index FTS5 Properly:** Ensure FTS5 virtual table is created correctly
   ```sql
   CREATE VIRTUAL TABLE memories_fts USING fts5(content, tokenize='porter')
   ```

### Common Issues

**Issue:** Slow search performance
- **Solution:** Ensure FTS5 index is properly built and maintained

**Issue:** Database locked errors
- **Solution:** Increase busyTimeout or use read-only connections

**Issue:** Memory cleanup not triggering
- **Solution:** Check maxEntries config and cleanup strategy

---

## Router (`router.ts`)

### Architecture

- **Policy-Driven:** Uses PolicyEvaluator for provider selection
- **Multi-Provider:** Claude, Gemini, OpenAI with fallback
- **Circuit Breaker:** Configurable failure thresholds (default 3)
- **Trace Logging:** JSONL logs in .automatosx/logs/

### Routing Flow

```
1. PolicyEvaluator filters providers by constraints
2. Score providers (latency, cost, privacy)
3. Select optimal provider
4. Execute with circuit breaker
5. Log decision to trace logs
6. Handle fallback if needed
```

### Policy Evaluation

```typescript
// Policy constraints
constraints: {
  maxLatency: 5000,       // ms
  maxCost: 0.10,          // per request
  privacy: 'private',     // private | public | team
  requiredCapabilities: ['streaming', 'vision']
}

// Provider scoring
score = (0.5 * latencyScore) + (0.3 * costScore) + (0.2 * reliabilityScore)
```

### Best Practices

1. **Free-Tier Optimization:** Prioritize free providers (Gemini 1,500 req/day)
   ```typescript
   freeTier: {
     enabled: true,
     providers: ['gemini-cli']
   }
   ```

2. **Circuit Breaker Configuration:**
   ```typescript
   circuitBreaker: {
     failureThreshold: 3,
     resetTimeout: 60000,    // 1 minute
     halfOpenRetries: 1
   }
   ```

3. **Trace Logging:** Always log routing decisions
   ```typescript
   RouterTraceLogger.log({
     provider: selected.name,
     reason: 'policy match',
     score: selected.score,
     alternatives: rejected.map(p => p.name)
   });
   ```

### Common Issues

**Issue:** Provider always fails
- **Solution:** Check circuit breaker state, reset if needed

**Issue:** Wrong provider selected
- **Solution:** Review policy constraints and scoring weights

**Issue:** Trace logs not writing
- **Solution:** Check filesystem permissions for .automatosx/logs/

---

## Session Manager (`session-manager.ts`)

### Architecture

- **Multi-Agent:** Support for collaborative sessions
- **UUID Validation:** Secure session IDs
- **Atomic Saves:** Temp file + rename pattern
- **Auto-Cleanup:** Old session removal
- **Metadata Limits:** 10KB max task metadata

### Session Lifecycle

```
create() → active → complete() / fail() → cleanup
```

### Key Operations

```typescript
// Create session
const session = await sessionManager.create('auth-task', 'backend');

// Add task to session
await sessionManager.addTask(sessionId, {
  agent: 'security',
  task: 'audit authentication',
  status: 'pending'
});

// Complete session
await sessionManager.complete(sessionId);
```

### Best Practices

1. **Atomic Saves:** Use temp file + rename for safety
   ```typescript
   const tmpPath = `${sessionPath}.tmp`;
   await fs.writeFile(tmpPath, data);
   await fs.rename(tmpPath, sessionPath);  // Atomic
   ```

2. **Debounced Persistence:** Reduce I/O with debouncing
   ```typescript
   private debouncedSave = debounce(() => this.persist(), 1000);
   ```

3. **Metadata Validation:** Enforce size limits
   ```typescript
   if (JSON.stringify(metadata).length > 10240) {
     throw new SessionError('Metadata too large (max 10KB)');
   }
   ```

4. **UUID Validation:** Always validate session IDs
   ```typescript
   const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
   if (!UUID_REGEX.test(id)) {
     throw new SessionError('Invalid session ID');
   }
   ```

### Common Issues

**Issue:** Sessions not persisting
- **Solution:** Check debounce timing and filesystem permissions

**Issue:** Session ID validation fails
- **Solution:** Ensure UUIDs are properly formatted (v4)

**Issue:** Metadata size exceeded
- **Solution:** Reduce task metadata or increase limit in config

---

## Spec-Kit System (`spec/`)

### Components

1. **SpecLoader** - Loads and validates YAML specs
2. **PolicyParser** - Parses policy constraints
3. **PolicyEvaluator** - Selects providers based on policy
4. **PlanGenerator** - Creates execution plans
5. **DagGenerator** - Builds dependency graphs
6. **ScaffoldGenerator** - Generates project scaffolds
7. **TestGenerator** - Auto-generates tests
8. **SpecExecutor** - Orchestrates spec execution

### Workflow

```
YAML Spec → Validation → Policy Eval → Plan → DAG → Execute → Memory
```

### YAML Spec Format

```yaml
name: Authentication System
policy:
  constraints:
    maxLatency: 5000
    privacy: private
tasks:
  - name: design
    agent: architecture
    dependencies: []
  - name: implement
    agent: backend
    dependencies: [design]
  - name: test
    agent: quality
    dependencies: [implement]
```

### Best Practices

1. **Validate Early:** Use Zod schemas for runtime validation
   ```typescript
   const SpecSchema = z.object({
     name: z.string(),
     policy: PolicySchema,
     tasks: z.array(TaskSchema)
   });
   ```

2. **Detect Cycles:** Check for circular dependencies
   ```typescript
   // Use topological sort to detect cycles
   if (hasCycle(dag)) {
     throw new SpecError('Circular dependency detected');
   }
   ```

3. **Change Detection:** Use content hashing for DAG updates
   ```typescript
   const hash = crypto.createHash('sha256').update(content).digest('hex');
   if (hash !== previousHash) {
     // Regenerate DAG
   }
   ```

4. **Error Handling:** Provide clear error messages for spec validation
   ```typescript
   if (!spec.tasks || spec.tasks.length === 0) {
     throw new SpecError('Spec must contain at least one task');
   }
   ```

### Common Issues

**Issue:** YAML parsing fails
- **Solution:** Validate YAML syntax, check for tabs vs spaces

**Issue:** Circular dependencies detected
- **Solution:** Review task dependencies, remove cycles

**Issue:** Policy evaluation returns no providers
- **Solution:** Relax constraints or enable more providers

---

## Runtime Validation with Zod

All core systems use Zod for runtime validation. Always validate external data:

```typescript
import { z } from 'zod';

// Define schema
const MemoryEntrySchema = z.object({
  content: z.string().max(10000),
  agent: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

// Safe parsing
const result = MemoryEntrySchema.safeParse(rawData);
if (!result.success) {
  logger.error('Validation failed', { error: result.error });
  throw new ValidationError(result.error.message);
}
const validated = result.data;  // Type-safe!
```

**When to Use Zod:**
- External API responses
- User configuration files
- CLI arguments
- YAML spec parsing
- Any data from files or network

---

## Testing Core Systems

### Memory Manager Tests

```typescript
describe('MemoryManager', () => {
  beforeEach(() => {
    memoryManager = new MemoryManager(':memory:');
  });

  afterEach(async () => {
    await memoryManager.close();  // Clean up!
  });

  it('should search memories', async () => {
    await memoryManager.add({ content: 'test' });
    const results = await memoryManager.search('test');
    expect(results).toHaveLength(1);
  });
});
```

### Router Tests

```typescript
describe('Router', () => {
  beforeEach(() => {
    vi.useFakeTimers();  // For circuit breaker testing
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should select optimal provider', async () => {
    const provider = await router.selectProvider({ task: 'test' });
    expect(provider).toBe('gemini-cli');  // Free tier
  });
});
```

---

## Performance Optimization

1. **Cache Expensive Operations:**
   - Provider availability (60s TTL)
   - Version detection (5min TTL)
   - Profile loading (adaptive TTL)

2. **Use Prepared Statements:**
   - Compile once, execute many times
   - Prevents SQL injection
   - Faster than raw SQL

3. **Debounce I/O:**
   - Session saves (1s debounce)
   - Memory persistence (1s debounce)
   - Reduces syscalls

4. **Lazy Loading:**
   - Load configs on demand
   - Cache after first load
   - Clear cache on invalidation

---

## Debugging

### Enable Debug Logging

```bash
export AUTOMATOSX_LOG_LEVEL=debug
ax run backend "task"
```

### Check Trace Logs

```bash
# View routing decisions
cat .automatosx/logs/router-trace-*.jsonl | jq

# Follow in real-time
tail -f .automatosx/logs/router-trace-*.jsonl | jq
```

### Memory Inspection

```bash
# Check database integrity
sqlite3 .automatosx/memory/memories.db "PRAGMA integrity_check;"

# View FTS5 index
sqlite3 .automatosx/memory/memories.db "SELECT * FROM memories_fts LIMIT 10;"
```

---

For questions or issues with core systems, see:
- Main CLAUDE.md (project root)
- GitHub Issues: https://github.com/defai-digital/automatosx/issues
