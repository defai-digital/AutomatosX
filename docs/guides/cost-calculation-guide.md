# Cost Calculation Configuration Guide

## Important: Cost Estimation is Disabled by Default

As of **AutomatosX v6.5.11**, cost estimation is **disabled by default**. This guide explains why, how the system behaves with cost estimation disabled, and how to enable it if needed.

---

## Why Cost Estimation is Disabled

### User Feedback

Users reported that cost estimates were often inaccurate due to:
1. **Frequent Pricing Changes**: AI providers update pricing regularly
2. **Outdated Data**: Hardcoded pricing data becomes stale quickly
3. **Regional Variations**: Different regions have different pricing
4. **Promotional Rates**: Free tiers and promotions change frequently

### Our Response

Based on this feedback, we've made cost estimation **opt-in** rather than opt-out:
- **Default**: Cost estimation disabled, system focuses on routing quality
- **Optional**: Users can enable if they need cost tracking
- **Transparent**: Clear messaging when cost features are disabled

---

## Current Behavior (Cost Estimation Disabled)

When cost estimation is disabled (the default):

### 1. Provider Costs Return $0

```bash
ax providers list
```

Output:
```
Provider         Status      Cost
─────────────────────────────────
gemini-cli       ✓ Ready     $0.00 (cost estimation disabled)
claude           ✓ Ready     $0.00 (cost estimation disabled)
openai           ✓ Ready     $0.00 (cost estimation disabled)
```

### 2. Policy Constraints Skip Cost Checks

Spec files with cost constraints are accepted but ignored:

```yaml
# This spec works, but cost constraints are not enforced
policy:
  goals: [cost, reliability]
  constraints:
    cost:
      maxPerRequest: 0.10  # Ignored when disabled
      maxPerDay: 5.00      # Ignored when disabled
```

**Behavior**: System selects providers based on other factors (latency, reliability, availability)

### 3. Plan Generation Shows "N/A"

```bash
ax gen plan my-spec.yaml
```

Output:
```
Task: design
  Agent: architecture
  Cost: N/A (cost estimation disabled)

Task: implement
  Agent: backend
  Cost: N/A (cost estimation disabled)

Total Estimated Cost: N/A (cost estimation disabled)
```

### 4. CLI Commands Show Disabled Messages

```bash
ax cache stats
```

Output:
```
Cache Statistics
  Hit Rate: 85%
  Cost Savings: N/A (cost estimation disabled)
```

---

## Enabling Cost Estimation

### Step 1: Edit Configuration

Open `ax.config.json` in your project root:

```json
{
  "costEstimation": {
    "enabled": true,
    "disclaimer": "Cost estimates are approximate and may be outdated. Always verify current pricing on provider websites."
  }
}
```

### Step 2: Restart AutomatosX

Cost estimation settings are loaded at startup:

```bash
# If using ax daemon
ax restart

# Otherwise, just run your next command
ax providers list
```

### Step 3: Verify Enabled

```bash
ax providers list
```

Output (with estimation enabled):
```
Provider         Status      Cost (per 1M tokens)
──────────────────────────────────────────────────
gemini-cli       ✓ Ready     $0.00 (free tier: 1500 req/day)
claude           ✓ Ready     Input: $3.00, Output: $15.00
openai           ✓ Ready     Input: $5.00, Output: $15.00
```

---

## When Enabled: What You Get

### 1. Full Cost Tracking

```bash
ax run backend "Implement feature" --debug
```

Output includes cost breakdown:
```
📊 Execution Summary
  Model: claude-sonnet-3-5
  Tokens: Input: 1,234, Output: 5,678
  Cost: $0.12
```

### 2. Policy Cost Constraints Enforced

Specs with cost constraints now filter providers:

```yaml
policy:
  goals: [cost]
  constraints:
    cost:
      maxPerRequest: 0.05  # Enforced! Expensive providers filtered
```

**Result**: Only providers meeting cost constraints are considered

### 3. Plan Generation Shows Cost Estimates

```bash
ax gen plan my-spec.yaml
```

Output:
```
Task: design
  Agent: architecture
  Provider: gemini-cli (cost optimization)
  Estimated Cost: $0.00 (free tier)

Task: implement
  Agent: backend
  Provider: gemini-cli
  Estimated Cost: $0.00 (free tier)

Total Estimated Cost: $0.00
```

### 4. Provider Comparison Includes Pricing

```bash
ax providers list --sort-by cost
```

Output:
```
Provider      Status    Cost (per 1M tokens)    Free Tier
───────────────────────────────────────────────────────────
gemini-cli    ✓ Ready   $0.00                   1500 req/day
claude        ✓ Ready   $3.00 / $15.00          No
openai        ✓ Ready   $5.00 / $15.00          No
```

### 5. Analytics Include Cost Metrics

```bash
ax cache stats
```

Output:
```
Cache Statistics
  Hit Rate: 85%
  Requests Cached: 1,234
  Cost Savings: $45.67 (estimated)
  Provider Cost Avoided: Claude: $30.50, OpenAI: $15.17
```

---

## Important Disclaimers

### Pricing Data is From October 2024

The embedded pricing data was accurate as of October 2024. Since then:
- Providers may have changed pricing
- New pricing tiers may have been introduced
- Free tier limits may have changed
- Regional pricing may differ

### Always Verify Current Pricing

Before relying on cost estimates, check official provider pricing pages:

- **Anthropic Claude**: https://www.anthropic.com/pricing
- **Google Gemini**: https://ai.google.dev/pricing
- **OpenAI**: https://openai.com/pricing

### Cost Estimates Are APPROXIMATE

Even with accurate pricing data, estimates can vary due to:
- Token counting differences
- Caching effects
- Batching optimizations
- Provider-side optimizations
- Network retries and failures

**Use estimates for guidance only, not for precise billing.**

---

## Cost-Related CLI Commands

### View Provider Pricing

```bash
# List all providers with pricing
ax providers list

# Sort by cost
ax providers list --sort-by cost

# Show detailed pricing info
ax providers info gemini-cli
```

### See Cost Estimates for Specs

```bash
# Generate execution plan with cost estimates
ax gen plan my-spec.yaml

# Compare costs across different policy goals
ax gen plan my-spec.yaml --goal cost
ax gen plan my-spec.yaml --goal latency
```

### View Cost Savings from Caching

```bash
# Cache statistics with cost savings
ax cache stats

# Reset cache (and cost savings tracking)
ax cache clear
```

### Check Free-Tier Quota Usage

```bash
# View free-tier status (works regardless of cost estimation setting)
ax free-tier status

# View quota history
ax free-tier history --provider gemini-cli
```

---

## Policy Configuration with Cost Constraints

When cost estimation is enabled, you can use cost constraints in spec files:

### Example 1: Strict Cost Budget

```yaml
metadata:
  name: budget-aware-project
  version: 1.0.0

policy:
  goals: [cost]  # Prioritize cost optimization
  constraints:
    cost:
      maxPerRequest: 0.10    # Max $0.10 per request
      maxPerDay: 5.00        # Max $5.00 per day

actors:
  implement:
    agent: backend
    task: Implement feature
```

**Result**: Only free-tier or very cheap providers selected

### Example 2: Balanced Cost and Latency

```yaml
policy:
  goals: [cost, latency]  # Balance both
  constraints:
    cost:
      maxPerRequest: 0.25
    latency:
      p95: 30000  # 30 seconds max
```

**Result**: System finds cheapest provider that meets latency constraint

### Example 3: Cost-Aware with Privacy

```yaml
policy:
  goals: [cost, reliability]
  constraints:
    cost:
      maxPerDay: 10.00
    privacy:
      allowedClouds: [aws]  # Only AWS providers
```

**Result**: Cheapest AWS-based provider (likely Claude)

---

## Best Practices

### 1. Keep Cost Estimation Disabled Unless Needed

**Recommendation**: Only enable if you specifically need cost tracking

**Why?**
- Avoids confusion from outdated pricing
- Reduces cognitive overhead
- Focuses on quality and reliability
- Free-tier optimization works regardless

### 2. If Enabled, Regularly Update Pricing

If you enable cost estimation:

1. **Check pricing monthly**: Visit provider websites
2. **Update metadata**: Edit `src/core/provider-metadata-registry.ts`
3. **Test estimates**: Compare with actual provider bills
4. **Document assumptions**: Note pricing data date in commits

### 3. Use Free-Tier Optimization Regardless

**Good News**: Free-tier prioritization works even with cost estimation disabled!

```bash
# This works regardless of cost estimation setting:
ax run backend "task"  # Automatically uses Gemini free tier if available
```

AutomatosX always prioritizes free tiers when available.

### 4. Monitor Actual Provider Bills

**Don't rely solely on estimates** for budget tracking:

1. **Set up billing alerts** on provider dashboards
2. **Track actual costs** from provider invoices
3. **Compare** estimates vs actuals monthly
4. **Update AutomatosX pricing** if large discrepancies

### 5. Document Your Configuration

In your project README, document:

```markdown
## Cost Estimation

This project has cost estimation **enabled** (see ax.config.json).

**Last Updated**: 2025-11-01
**Pricing Data Source**: Provider official websites
**Known Limitations**:
- Gemini free tier: 1500 requests/day
- Estimates ±20% accuracy
```

---

## Troubleshooting

### "Cost estimates seem way off"

**Check:**
1. When was pricing data last updated?
2. Are you using promotional/free tier pricing?
3. Is caching affecting token counts?

**Fix:**
- Verify current pricing on provider websites
- Update `provider-metadata-registry.ts` if needed
- Compare with actual provider bill

### "Cost constraints not working"

**Check:**
```bash
# Verify cost estimation is enabled
grep -A 2 "costEstimation" ax.config.json
```

**Expected** (if you want constraints enforced):
```json
"costEstimation": {
  "enabled": true
}
```

### "Free tier not being used"

Free-tier prioritization works **independently** of cost estimation:

```bash
# Check free-tier status
ax free-tier status

# Verify provider is available
ax doctor gemini-cli
```

If Gemini is available, it should be automatically prioritized.

### "Cost field shows N/A even though enabled"

**Possible Causes:**
1. Configuration not reloaded
2. Invalid config JSON
3. Provider doesn't have pricing metadata

**Debug:**
```bash
# Check config is valid
cat ax.config.json | jq .

# Reload configuration
ax restart  # If using daemon

# Check provider metadata
ax providers info <provider-name>
```

---

## Migration Guide: Enabling Cost Estimation

If you're upgrading from an older version where cost estimation was always on:

### Before (v6.5.10 and earlier)

Cost estimation was always active:
- All providers showed pricing
- Cost constraints always enforced
- No configuration needed

### After (v6.5.11+)

Cost estimation is opt-in:

**Step 1**: Add to `ax.config.json`:
```json
{
  "costEstimation": {
    "enabled": true
  }
}
```

**Step 2**: Verify behavior matches your expectations:
```bash
ax providers list  # Should show pricing
ax gen plan spec.yaml  # Should show cost estimates
```

**Step 3**: Document for your team:
- Update project README
- Note in AGENTS.md, CLAUDE.md, or GEMINI.md if present
- Communicate to team members

---

## Next Steps

- [Spec-Kit Guide](./spec-kit-guide.md) - Use cost policies in specs
- [Iteration Mode Guide](./iteration-mode-guide.md) - Understand iteration cost impact
- [Provider Comparison](../providers/overview.md) - Compare providers
- [CLI Commands Reference](../reference/cli-commands.md) - Complete command documentation

---

**Version**: 6.5.13
**Last Updated**: 2025-11-01
