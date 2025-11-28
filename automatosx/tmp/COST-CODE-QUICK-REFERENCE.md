# Cost-Related Code - Quick Reference

## Files to Modify/Remove

### Absolute Paths (Copy-Paste Ready)

```
/Users/akiralam/code/AutomatosX/packages/schemas/src/common.ts
  - Lines 129-134: Remove TokenUsage schema

/Users/akiralam/code/AutomatosX/packages/schemas/src/provider.ts
  - Line 65: Remove rateLimit from Provider interface
  - Line 135: Remove tokens field from ExecutionMetadataSchema
  - Line 184: Remove totalTokens from ProviderRegistrationSchema

/Users/akiralam/code/AutomatosX/packages/schemas/src/agent.ts
  - Line 7: Remove TokenUsage import
  - Line 161: Remove tokens field from AgentResponseSchema

/Users/akiralam/code/AutomatosX/packages/providers/src/base.ts
  - Line 351: Remove tokens parameter from createSuccessResponse()
  - Line 360: Remove tokens from metadata object

/Users/akiralam/code/AutomatosX/packages/core/src/router/provider-router.ts
  - Line 433: Remove rateLimit: 0 assignment (or implement tracking)

/Users/akiralam/code/AutomatosX/packages/algorithms/src/bindings/routing.ts
  - Line 20: Remove RATE_LIMIT_SCORE_MULTIPLIER constant
  - Line 65: Remove rateLimit from Provider interface
  - Lines 118-119: Remove rate limit scoring logic
  - Line 135: Remove rate limit from score calculation

/Users/akiralam/code/AutomatosX/packages/algorithms/src/Routing.res
  - Line 25: Remove rateLimit field from provider type
  - Line 69: Remove rateLimitScore calculation
  - Line 91: Remove rateLimitScore from final score

/Users/akiralam/code/AutomatosX/packages/algorithms/src/bindings/routing.test.ts
  - Line 23: Remove rateLimit from test provider
  - Lines 89-90: Remove rate limit scoring tests
```

## Key Files Affected

### Schema Files (3 files)
1. `packages/schemas/src/common.ts` - TokenUsage definition
2. `packages/schemas/src/provider.ts` - Provider interface, token fields
3. `packages/schemas/src/agent.ts` - Token field in responses

### Implementation Files (3 files)
1. `packages/providers/src/base.ts` - Token collection
2. `packages/core/src/router/provider-router.ts` - Rate limit tracking (TODO)
3. `packages/algorithms/src/bindings/routing.ts` - Rate limit scoring

### Algorithm Files (2 files)
1. `packages/algorithms/src/Routing.res` - ReScript algorithm
2. `packages/algorithms/src/bindings/routing.test.ts` - Tests

## Cost-Related Code Statistics

| Metric | Count |
|--------|-------|
| Files with cost code | 8 |
| Schema changes needed | 3 files, 6 locations |
| Implementation changes | 3 files, 4 locations |
| Algorithm changes | 2 files, 6 locations |
| Test changes | 1 file, 3 locations |
| Lines to remove/modify | ~25 lines |

## What's NOT in the codebase

- No cost calculation
- No pricing configuration
- No billing system
- No budget enforcement
- No cost reports
- No cost-based routing

## What IS in the codebase

- Token usage schema (informational)
- Rate limit field in provider state
- Rate limit scoring in routing algorithm
- Total tokens counter (schema only)

## Implementation Status

- Token schema: ✓ Complete
- Rate limit scoring: ✓ Complete
- Rate limit tracking: ✗ TODO (line 433, provider-router.ts)
- Cost calculation: ✗ Not started
- Billing system: ✗ Not started

## Quick Decision Matrix

| If You Want To... | Action |
|------------------|--------|
| Remove cost completely | Remove all 8 files' cost code |
| Keep for future | Keep as-is, implement rate limit tracking first |
| Add billing | Keep token schema, add cost models |
| Simplify routing | Remove rate limit scoring, keep latency/health |

## Verification Checklist

- [ ] Review all file locations listed above
- [ ] Decide on cost infrastructure approach (remove/keep/enhance)
- [ ] Update tests if removing rate limit scoring
- [ ] Update dist/ files (auto-generated, will be overwritten on build)
- [ ] Run test suite to verify no breakage
- [ ] Update documentation about provider selection criteria

## Report Location

Full analysis: `/Users/akiralam/code/AutomatosX/automatosx/tmp/COST-RELATED-CODE-ANALYSIS.md`
