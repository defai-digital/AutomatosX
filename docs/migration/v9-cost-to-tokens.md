# Migration Guide: Cost-Based to Token-Based Limits (v8.6.0 → v9.0.0)

**Effective**: v8.6.0 (Deprecation), v9.0.0 (Removal)
**Impact**: Iterate mode budget control
**Breaking**: v9.0.0 only

---

## Overview

AutomatosX is migrating from **cost-based budget limits** to **token-based limits** for iterate mode because:

- ❌ **Cost-based limits are unreliable**: Provider pricing changes frequently without notice
- ❌ **Complex pricing models**: Tiered pricing, volume discounts, regional differences
- ❌ **No authoritative source**: No API provides real-time pricing data
- ✅ **Token counts are stable**: Never change, unlike prices
- ✅ **Accurate tracking**: Actual usage from provider API responses

---

## Timeline

### v8.6.0 (Current - Deprecation)
- ✅ New token-based flags available
- ⚠️ Cost-based flags deprecated (but still work)
- ✅ Deprecation warnings guide migration
- ✅ Full backward compatibility

### v8.7.0 (Next Release)
- ✅ Full documentation updated
- ✅ All examples use token-based limits
- ⚠️ Cost-based flags still functional

### v9.0.0 (Breaking Change)
- ❌ Cost-based flags removed
- ❌ `--iterate-max-cost` deleted
- ❌ `maxEstimatedCostUsd` removed from types
- ✅ Token-based limits only

---

## Quick Migration

### Before (v8.5.x and earlier)
```bash
ax run security "audit code" --iterate --iterate-max-cost 5.0
```

### After (v8.6.0+)
```bash
ax run security "audit code" --iterate --iterate-max-tokens 1000000
```

**That's it!** One flag change.

---

## Detailed Migration

### CLI Flags

| Old Flag | Status | New Flag | Default | Notes |
|----------|--------|----------|---------|-------|
| `--iterate-max-cost` | Deprecated v8.6.0 | `--iterate-max-tokens` | 1,000,000 | More reliable |
| N/A | New v8.6.0 | `--iterate-max-tokens-per-iteration` | 100,000 | Per-call limit |

### Configuration

#### Before (ax.config.json)
```json
{
  "iterate": {
    "defaults": {
      "maxEstimatedCostUsd": 5.0
    }
  }
}
```

#### After (v8.6.0+)
```json
{
  "iterate": {
    "defaults": {
      "maxTotalTokens": 1000000,
      "maxTokensPerIteration": 100000,
      "warnAtTokenPercent": [75, 90]
    }
  }
}
```

### TypeScript Types

#### Before
```typescript
interface IterateDefaults {
  maxEstimatedCostUsd: number;  // Deprecated v8.6.0, removed v9.0.0
}
```

#### After
```typescript
interface IterateDefaults {
  maxTotalTokens?: number;              // v8.6.0+
  maxTokensPerIteration?: number;       // v8.6.0+
  warnAtTokenPercent?: number[];        // v8.6.0+
}
```

---

## Converting Cost Budgets to Token Budgets

### Formula

```
tokens = (cost_usd / avg_cost_per_1k_tokens) * 1000
```

### Quick Reference Table

| Old Cost Budget | Approximate Token Budget | Provider |
|----------------|--------------------------|----------|
| $0.50 | 125,000 tokens | GPT-4o-mini |
| $1.00 | 250,000 tokens | GPT-4o-mini |
| $2.00 | 500,000 tokens | GPT-4o-mini |
| $5.00 | 1,250,000 tokens | GPT-4o-mini |
| $10.00 | 2,500,000 tokens | GPT-4o-mini |

**Note**: Token equivalents vary by provider and pricing tier. Use as rough estimates only.

### Recommended Defaults

| Use Case | Token Budget | Reason |
|----------|--------------|--------|
| **Small tasks** | 100,000 | Quick code reviews |
| **Medium tasks** | 500,000 | Standard features |
| **Large tasks** | 1,000,000 | Complex audits (recommended default) |
| **XLarge tasks** | 5,000,000 | Full codebase analysis |

---

## Migration Steps

### Step 1: Update CLI Commands

**Find all uses of**:
```bash
grep -r "iterate-max-cost" .
```

**Replace with**:
```bash
--iterate-max-cost 5.0    →    --iterate-max-tokens 1000000
```

### Step 2: Update Configuration Files

**Edit `ax.config.json`**:
```diff
{
  "iterate": {
    "defaults": {
-     "maxEstimatedCostUsd": 5.0
+     "maxTotalTokens": 1000000,
+     "maxTokensPerIteration": 100000,
+     "warnAtTokenPercent": [75, 90]
    }
  }
}
```

### Step 3: Update Scripts and Documentation

**Search and replace**:
- `--iterate-max-cost` → `--iterate-max-tokens`
- `maxEstimatedCostUsd` → `maxTotalTokens`
- Dollar amounts → Token counts

### Step 4: Test

```bash
# Test with token limits
ax run backend "test task" --iterate --iterate-max-tokens 100000

# Verify warnings at 75% (~75k tokens) and 90% (~90k tokens)
# Verify execution stops at 100k tokens
```

---

## Backward Compatibility (v8.6.0 - v8.7.x)

### Both Work During Transition

```bash
# Old way (shows deprecation warning)
ax run agent "task" --iterate --iterate-max-cost 5.0
# ⚠️  Warning: --iterate-max-cost is deprecated...
#     Please use --iterate-max-tokens instead

# New way (recommended)
ax run agent "task" --iterate --iterate-max-tokens 1000000
```

### Mixing Old and New

```bash
# Both flags can coexist (token takes precedence)
ax run agent "task" --iterate \
  --iterate-max-cost 5.0 \        # Ignored if token flag present
  --iterate-max-tokens 1000000     # Used
```

### Gradual Migration

1. **v8.6.0**: Add new token flags alongside old cost flags
2. **Test**: Verify token limits work as expected
3. **v8.7.0**: Remove cost flags from configs
4. **v9.0.0**: Upgrade when ready (cost flags removed)

---

## What Changes in v9.0.0

### Removed

- ❌ `--iterate-max-cost` CLI flag
- ❌ `maxEstimatedCostUsd` config field
- ❌ `totalCost` in IterateStats (kept in v8.6.0 for compat)
- ❌ `cost_limit_exceeded` pause reason (use `token_limit_exceeded`)
- ❌ CostTracker class (~1,200 lines)
- ❌ Cost-related types and schemas

### Added

- ✅ Token-only budget enforcement
- ✅ Simpler codebase (~1,200 lines removed)
- ✅ No maintenance burden for pricing updates

### Breaking Changes

**Code using cost fields will break**:
```typescript
// ❌ Will fail in v9.0.0
const cost = stats.totalCost;  // Property doesn't exist
const limit = config.maxEstimatedCostUsd;  // Property doesn't exist

// ✅ Use tokens instead
const tokens = stats.totalTokens;
const limit = config.maxTotalTokens;
```

**CLI commands using cost flags will fail**:
```bash
# ❌ Will fail in v9.0.0
ax run agent "task" --iterate --iterate-max-cost 5.0
# Error: Unknown option '--iterate-max-cost'

# ✅ Use tokens instead
ax run agent "task" --iterate --iterate-max-tokens 1000000
```

---

## Benefits of Token-Based Limits

### Reliability
- ✅ Token counts never change
- ✅ Consistent across all providers
- ✅ No need for pricing updates

### Accuracy
- ✅ Real usage from API responses
- ✅ No estimation errors
- ✅ Predictable budget enforcement

### Simplicity
- ✅ Easier to understand ("1M tokens" vs "$5.00?")
- ✅ Universal metric
- ✅ No regional pricing differences

### Maintainability
- ✅ ~1,200 lines of code removed
- ✅ No pricing data to update
- ✅ Simpler codebase

---

## FAQ

### Q: Why remove cost-based limits?

**A**: Provider pricing changes frequently (OpenAI changed GPT-4 pricing 3x in 2024), making cost estimates unreliable. Users complained about wrong estimates. Token-based limits are accurate and stable.

### Q: How do I know how many tokens I need?

**A**: Start with the default (1M tokens ≈ $0.40-0.60 for most providers). Monitor actual usage in logs. Adjust as needed.

**Example**:
```bash
# Run with default
ax run backend "task" --iterate

# Check logs
[2025-11-18T14:30:00.000Z] INFO Iterate mode execution completed
{
  "totalTokens": 342567,
  "totalIterations": 12,
  "avgTokensPerIteration": 28547
}

# Adjust for future runs
ax run backend "task" --iterate --iterate-max-tokens 500000
```

### Q: Can I still track costs?

**A**: Yes! Track token usage and multiply by current pricing:
```bash
# Get token usage from logs
tokens_used=342567

# Calculate cost (example: $0.40 per 1M tokens)
cost=$(echo "scale=4; $tokens_used * 0.40 / 1000000" | bc)
echo "Approximate cost: \$$cost"
```

### Q: What if I need both cost and token limits?

**A**: In v8.6.0-v8.7.x, both work. In v9.0.0, only token limits exist. Track costs manually if needed.

### Q: Will this break my existing workflows?

**A**: Not until v9.0.0 (breaking change). v8.6.0 and v8.7.x are fully backward compatible with deprecation warnings.

### Q: How long do I have to migrate?

**A**: Recommended timeline:
- **Now (v8.6.0)**: Start using token flags
- **v8.7.0 (1 week)**: Complete migration
- **v9.0.0 (4-6 weeks)**: Upgrade when ready

---

## Support

### Issues?

- **GitHub**: https://github.com/defai-digital/automatosx/issues
- **Email**: support@defai.digital
- **Documentation**: https://docs.automatosx.com

### More Help?

- [Iteration Mode Guide](../guides/iteration-mode-guide.md)
- [Token Budget Calculator](../tools/token-budget-calculator.md)
- [API Reference](../reference/cli-commands.md)

---

## Summary

**Old** (v8.5.x):
```bash
ax run agent "task" --iterate --iterate-max-cost 5.0
```

**New** (v8.6.0+):
```bash
ax run agent "task" --iterate --iterate-max-tokens 1000000
```

**Why**: Token counts are stable and accurate. Costs change frequently and cause confusion.

**Timeline**: Deprecated v8.6.0 → Removed v9.0.0 (4-6 weeks)

**Impact**: One flag change per command. Full backward compat until v9.0.0.

---

**Ready to migrate?** Start using `--iterate-max-tokens` today!

