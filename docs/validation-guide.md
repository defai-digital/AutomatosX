# Validation System User Guide

**Version**: v8.0.0
**Status**: Production
**Last Updated**: 2025-01-14

---

## Overview

AutomatosX v8.0.0 includes a comprehensive validation system powered by Zod v4 that ensures type safety and data integrity across parser outputs and database operations.

### Key Features

- ✅ **20 validation schemas** (parser + database boundaries)
- ✅ **87.5% validation coverage** across all data boundaries
- ✅ **Feature flags** for gradual rollout and safe deployment
- ✅ **Metrics collection** for monitoring validation performance
- ✅ **Three validation modes**: disabled, log-only, enforce
- ✅ **Sampling support** for performance control (0-100%)

### Performance Characteristics

| Operation | Latency (P95) | Throughput |
|-----------|---------------|------------|
| Single validation | < 0.01ms | > 100k ops/sec |
| Batch (100 items) | < 0.1ms | > 10k batches/sec |
| Batch (1000 items) | < 1ms | > 1k batches/sec |

---

## Quick Start

### Environment Variables

```bash
# Global kill switch
VALIDATION_ENABLED=true

# Per-boundary modes
VALIDATION_PARSER_MODE=enforce
VALIDATION_DATABASE_MODE=enforce

# Sampling rate (0.0 to 1.0)
VALIDATION_SAMPLE_RATE=1.0  # 100%
```

### Basic Usage

```typescript
import { validateParseResult } from './types/schemas/parser.schema.js';
import { validateSymbolInput } from './types/schemas/database.schema.js';

// Validate parser output
const parseResult = parser.parse(content);
const validated = validateParseResult(parseResult);

// Validate database input
const symbolInput = {
  file_id: 1,
  name: 'getUserById',
  kind: 'function',
  line: 10,
  column: 2,
};
const validatedSymbol = validateSymbolInput(symbolInput);
```

---

## Configuration

### Validation Modes

#### 1. **disabled** - No Validation
- Validation completely skipped
- Zero performance overhead
- **Use case**: Emergency rollback

#### 2. **log_only** - Log Errors Only
- Validation runs but doesn't block
- Errors logged for monitoring
- **Use case**: Initial rollout, testing

#### 3. **enforce** - Block on Errors
- Validation runs and throws on errors
- Operations fail if validation fails
- **Use case**: Production (after validation)

### Sampling Strategies

- **Development**: 100% (catch all issues)
- **Staging**: 50-100% (validate at scale)
- **Production canary**: 10% (minimize risk)
- **Production ramp**: 50% (balanced)
- **Production full**: 100% (maximum safety)

---

## API Reference

### Parser Validation

#### `validateParseResult(data: unknown): ParseResult`

Validates Tree-sitter parser output.

**Schema**:
```typescript
{
  symbols: Symbol[],
  parseTime: number,      // Non-negative, < 60000ms
  nodeCount: number,      // Non-negative integer
}
```

**Example**:
```typescript
const parseResult = {
  symbols: [{
    name: 'getUserById',
    kind: 'function',
    line: 10,
    column: 2,
    endLine: 15,
    endColumn: 1,
  }],
  parseTime: 12.5,
  nodeCount: 145,
};

const validated = validateParseResult(parseResult);
```

#### `validateSymbol(data: unknown): Symbol`

Validates a single symbol.

**Schema**:
```typescript
{
  name: string,           // Non-empty
  kind: SymbolKind,       // Enum: function, class, interface, etc.
  line: number,           // Positive (1-indexed)
  column: number,         // Non-negative (0-indexed)
  endLine?: number,       // Optional, >= line
  endColumn?: number,     // Optional
  metadata?: Record<string, unknown>,
}
```

### Database Validation

#### `validateFileInput(data: unknown): FileInput`

Validates file data before database insertion.

**Schema**:
```typescript
{
  path: string,           // Non-empty
  content: string,        // Max 10MB
  language?: string,      // Optional
}
```

#### `validateSymbolInput(data: unknown): SymbolInput`

Validates symbol data before database insertion.

**Schema**:
```typescript
{
  file_id: number,        // Positive integer
  name: string,           // Non-empty
  kind: SymbolKind,
  line: number,           // Positive (1-indexed)
  column: number,         // Non-negative (0-indexed)
  end_line?: number,
  end_column?: number,
}
```

### Batch Validation

#### `validateSymbolInputBatch(data: unknown[])`

Validates multiple symbols efficiently.

**Returns**:
```typescript
{
  valid: SymbolInput[],
  invalid: Array<{ index: number, error: ZodError }>,
  successRate: number,
}
```

**Example**:
```typescript
const symbols = [/* ... */];
const result = validateSymbolInputBatch(symbols);

if (result.successRate < 0.95) {
  console.error(`High error rate: ${result.invalid.length} failures`);
}

await insertSymbols(result.valid);
```

**Performance**: Batch validation is 10-100x faster than individual validation.

---

## Metrics & Monitoring

### Accessing Metrics

```typescript
import { getValidationMetrics } from './monitoring/ValidationMetrics.js';

const metrics = getValidationMetrics();
console.log(metrics.total);
// {
//   validations: 50000,
//   successes: 49998,
//   failures: 2,
//   successRate: 0.99996,
//   avgDurationMs: 0.003,
//   p95DurationMs: 0.008,
//   p99DurationMs: 0.015
// }
```

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Success rate | > 99.9% | < 99% |
| P95 latency | < 5ms | > 10ms |
| P99 latency | < 10ms | > 20ms |
| Error rate | < 0.1% | > 1% |

---

## Troubleshooting

### High Validation Error Rate

**Symptoms**: Error rate > 1%

**Solutions**:
1. Review error patterns in metrics
2. Fix data generators or parsers
3. Temporary: Switch to log-only mode
   ```bash
   export VALIDATION_PARSER_MODE=log_only
   ```

### Performance Degradation

**Symptoms**: P95 latency > 10ms

**Solutions**:
1. Reduce sampling rate to 50%
   ```bash
   export VALIDATION_SAMPLE_RATE=0.5
   ```
2. Use batch validation for bulk operations
3. Emergency: Disable validation
   ```bash
   export VALIDATION_ENABLED=false
   ```

### Memory Leak

**Symptoms**: Heap size grows over time

**Solutions**:
1. Metrics are capped at 10k results (LRU cache)
2. Reset metrics periodically:
   ```typescript
   import { resetValidationMetrics } from './monitoring/ValidationMetrics.js';
   setInterval(() => resetValidationMetrics(), 3600000); // Every hour
   ```

---

## Best Practices

### For Developers

1. **Always validate at boundaries**
   ```typescript
   // ✅ Good
   const parseResult = parser.parse(content);
   const validated = validateParseResult(parseResult);
   ```

2. **Use batch validation**
   ```typescript
   // ✅ Good: Batch
   const result = validateSymbolInputBatch(symbols);

   // ❌ Bad: Loop
   for (const symbol of symbols) {
     validateSymbolInput(symbol);
   }
   ```

3. **Handle errors gracefully**
   ```typescript
   try {
     const validated = validateSymbolInput(data);
   } catch (error) {
     if (error instanceof ZodError) {
       logger.error('Validation failed', { errors: error.errors });
     }
   }
   ```

### For Operations

1. **Use staged rollout**
   - Start with log-only at 10%
   - Monitor for 1 hour
   - Gradually increase: 10% → 50% → 100%

2. **Monitor key metrics**
   - Success rate (> 99.9%)
   - P95 latency (< 5ms)
   - Error patterns

3. **Have rollback plan**
   - Level 1: Kill switch (30 sec)
   - Level 2: Log-only mode (1 min)
   - Level 3: Reduce sampling (1 min)
   - Level 4: Code rollback (5 min)

---

## FAQ

### Q: Does validation impact performance?

**A**: Minimal impact. Validation overhead is < 0.01ms per operation. Load testing showed 488k ops/sec throughput.

### Q: Can I disable validation for specific operations?

**A**: Yes, use sampling:
```typescript
if (shouldValidate(sampleRate)) {
  const validated = validateSymbolInput(data);
}
```

### Q: What happens if validation fails?

**A**: Depends on mode:
- **log_only**: Error logged, operation continues
- **enforce**: ZodError thrown, operation fails
- **disabled**: Validation skipped

### Q: How do I add custom validation?

**A**: Use Zod refinements:
```typescript
const CustomSchema = SymbolSchema.refine(
  (data) => data.name.length <= 100,
  { message: 'Name too long' }
);
```

---

## Additional Resources

- **[ADR-014](../automatosx/PRD/ADR-014-zod-validation.md)**: Architecture decision record
- **[Performance Benchmarks](../automatosx/tmp/WEEK3-DAY1-COMPLETE-SUMMARY.md)**: Detailed results
- **Source Code**: `src/types/schemas/` directory

---

**Questions?** File an issue on GitHub or contact the AutomatosX team.
