# Provider Comparison Guide

**Version**: v6.0.1+
**Status**: Stable

---

## Overview

AutomatosX supports three AI provider CLIs, each with distinct strengths. This guide helps you understand when to use each provider and how AutomatosX's intelligent routing optimizes for your goals.

---

## Quick Comparison

| Feature | OpenAI (Codex) | Claude Code | Gemini CLI |
|---------|---------------|-------------|------------|
| **Cost (per 1M tokens)** | $2.50-$10.00 | $3.00-$15.00 | $0.125-$0.375 |
| **Speed (P95 latency)** | 2000ms | 2500ms | 3000ms |
| **Streaming Support** | ✅ Yes | ✅ Yes | ✅ Yes (gradual rollout) |
| **Vision Support** | ✅ Yes | ❌ No | ✅ Yes |
| **Function Calling** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Parameter Control** | ✅ Full | ❌ Limited | ❌ Not supported |
| **Free Tier** | ❌ No | ❌ No | ✅ **1,500 req/day** |
| **Best For** | Speed-critical tasks | High-quality reasoning | **Cost optimization** |
| **Reliability** | 99.9% uptime | 99.8% uptime | 99.7% uptime |

---

## Detailed Comparison

### Cost Analysis

#### Per-Request Costs

| Provider | Input (per 1K tokens) | Output (per 1K tokens) | Average |
|----------|----------------------|------------------------|---------|
| **Gemini CLI** | $0.000125 | $0.000375 | **$0.000250** |
| **OpenAI** | $0.0025 | $0.0100 | $0.006250 |
| **Claude Code** | $0.0030 | $0.0150 | $0.009000 |

**Cost Multiplier** (vs Gemini):
- OpenAI: **25x more expensive**
- Claude Code: **36x more expensive**

#### Real-World Impact

For a typical workload of **1,000 requests/month** at **10K tokens each**:

| Provider | Monthly Cost | Annual Cost |
|----------|-------------|-------------|
| **Gemini CLI (Free Tier)** | **$0-50** | **$0-600** |
| **Gemini CLI (Paid)** | $2,500 | $30,000 |
| **OpenAI** | $62,500 | $750,000 |
| **Claude Code** | $90,000 | $1,080,000 |

**With AutomatosX Cost Optimization**:
- Free tier utilization: 1,500 requests/day automatically
- Workload-aware routing: Large tasks → Gemini (99.6% cheaper)
- **Actual monthly cost**: $50 (99.6% reduction!)

---

### Performance Analysis

#### Latency (P50/P95/P99)

| Provider | P50 | P95 | P99 | Best Use Case |
|----------|-----|-----|-----|---------------|
| **OpenAI** | 1500ms | 2000ms | 2500ms | Interactive CLI tools |
| **Claude Code** | 1800ms | 2500ms | 3200ms | Complex reasoning |
| **Gemini CLI** | 2200ms | 3000ms | 3800ms | Batch processing |

**When Speed Matters**:
- Real-time user interactions → OpenAI
- Background tasks → Gemini
- Complex analysis → Claude Code

---

### Feature Matrix

#### Streaming Support

| Provider | Support | Status | Notes |
|----------|---------|--------|-------|
| **OpenAI** | ✅ Yes | Stable | Always enabled |
| **Claude Code** | ✅ Yes | Stable | Always enabled |
| **Gemini CLI** | ✅ Yes | Gradual rollout | Controlled by feature flag |

**Check Gemini streaming status**:
```bash
ax flags list
# Shows: gemini_streaming rollout percentage
```

#### Vision/Multimodal

| Provider | Support | Use Cases |
|----------|---------|-----------|
| **OpenAI** | ✅ Yes | Image analysis, OCR, visual debugging |
| **Gemini CLI** | ✅ Yes | Image analysis, OCR, diagrams |
| **Claude Code** | ❌ No | Text-only |

#### Model Parameter Control

| Provider | maxTokens | temperature | topP | Notes |
|----------|-----------|-------------|------|-------|
| **OpenAI** | ✅ Yes | ✅ Yes | ✅ Yes | Full control via CLI flags |
| **Claude Code** | ❌ No | ❌ No | ❌ No | Uses provider defaults |
| **Gemini CLI** | ❌ No | ❌ No | ❌ No | CLI limitation ([Issue #5280](https://github.com/google-gemini/gemini-cli/issues/5280)) |

**When Parameter Control Matters**:
- ✅ QA/testing (deterministic output) → OpenAI
- ✅ Cost control (limit output tokens) → OpenAI
- ❌ General usage → All providers (use role/prompt instead)

---

## Provider Selection Strategy

### AutomatosX Routing Algorithm

AutomatosX uses a **multi-phase routing algorithm** to select the optimal provider:

#### Phase 1: Policy Evaluation
```yaml
policy:
  goal: cost  # Options: cost, latency, reliability, balanced
  constraints:
    cost:
      maxPerRequest: 0.01
    latency:
      p95: 5000
```

**Filters providers** that meet all constraints, scores by goal.

#### Phase 2: Free Tier Prioritization
```
IF gemini_free_tier_available AND workload_suitable:
  RETURN gemini-cli (0% cost!)
```

Automatically uses Gemini free tier (1,500 req/day) when available.

#### Phase 3: Workload Analysis
```
Analyze:
  - Request size (tiny/small/medium/large/xlarge)
  - Streaming requirement
  - Vision requirement
  - Complexity (simple/medium/complex)

Route:
  - tiny + streaming → OpenAI (speed)
  - large + cost goal → Gemini (cost)
  - complex + reliability → Claude (quality)
```

#### Phase 4: Multi-Factor Scoring
```
Score = (cost_weight * cost_score) +
        (latency_weight * latency_score) +
        (reliability_weight * reliability_score)
```

Select highest-scoring provider.

---

## Use Case Recommendations

### 1. Cost-Sensitive Projects

**Scenario**: Indie developer, tight budget, large workloads

**Configuration**:
```yaml
policy:
  goal: cost
  constraints:
    cost:
      maxDaily: 1.00  # $1/day budget
```

**Expected Routing**:
- 99% → Gemini CLI (free tier + paid)
- 1% → OpenAI (speed-critical only)

**Monthly Cost**: ~$30 (vs $1,500 without optimization)

---

### 2. Speed-Critical Applications

**Scenario**: Interactive CLI tools, real-time user feedback

**Configuration**:
```yaml
policy:
  goal: latency
  constraints:
    latency:
      p95: 2000  # Max 2 seconds
```

**Expected Routing**:
- 70% → OpenAI (fastest)
- 30% → Gemini (when speed acceptable)

**Monthly Cost**: ~$500 (balanced speed/cost)

---

### 3. High-Quality Reasoning

**Scenario**: Code reviews, security audits, architectural decisions

**Configuration**:
```yaml
policy:
  goal: reliability
  constraints:
    reliability:
      minAvailability: 0.998
```

**Expected Routing**:
- 60% → Claude Code (best reasoning)
- 40% → OpenAI (fallback)

**Monthly Cost**: ~$800 (prioritize quality)

---

### 4. Balanced Workload

**Scenario**: General development, mixed requirements

**Configuration**:
```yaml
policy:
  goal: balanced  # Equal weight to all factors
```

**Expected Routing**:
- 50% → Gemini (cost-effective)
- 30% → OpenAI (speed)
- 20% → Claude (quality)

**Monthly Cost**: ~$200 (optimized mix)

---

## Cost Optimization Strategies

### 1. Maximize Free Tier Utilization

Gemini offers **1,500 requests/day** and **1M tokens/day** free.

**Strategy**:
- Enable Gemini provider
- Set `policy.goal: cost`
- Let AutomatosX automatically use free tier

**Check free tier status**:
```bash
ax free-tier status

# Output:
# 📊 Gemini CLI Free Tier Status
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Daily Requests:  234 / 1,500 (16%)
# ████░░░░░░░░░░░░░░░░░░░░░░░░░░░
# Daily Tokens:    145,890 / 1,000,000 (15%)
# ████░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

**Expected Impact**: 99.6% cost reduction for typical workloads

---

### 2. Workload-Aware Routing

AutomatosX analyzes each request and routes optimally.

**Example**:
```bash
# Small, streaming request → OpenAI (speed)
ax run frontend "Add dark mode toggle"
# → OpenAI (300 tokens, streaming, 1.2s)

# Large batch task → Gemini (cost)
ax run backend "Refactor entire authentication system"
# → Gemini CLI (15K tokens, batch, 4.5s, $0.004 vs $0.15)
```

**No configuration needed** - works automatically!

---

### 3. Per-Agent Provider Override

Assign providers by agent role:

```yaml
# .automatosx/agents/qa-specialist.yaml
name: qa-specialist
role: QA Specialist

provider:
  primary: openai  # Need parameter control for determinism
  defaults:
    temperature: 0  # Fully deterministic output
```

```yaml
# .automatosx/agents/docs-writer.yaml
name: docs-writer
role: Documentation Writer

provider:
  primary: gemini-cli  # Cost-effective for large content
```

---

## Testing Provider Switch

Temporarily override provider for testing:

```bash
# Force all requests to Gemini
ax providers switch gemini-cli

# Test your workflow
ax run backend "implement feature X"

# Reset to normal routing
ax providers reset
```

**Use case**: Testing provider compatibility, debugging routing issues.

---

## Monitoring and Observability

### View Routing Decisions

```bash
# Real-time trace log
ax providers trace --follow

# Output:
# 18:26:49  POLICY       gemini-cli      goal=cost, passed=2/3
# 18:26:49  FREE_TIER    gemini-cli      1234/1500 requests used (82% available)
# 18:26:49  WORKLOAD     gemini-cli      size=large (12K tokens), complexity=medium
# 18:26:50  SELECTION    gemini-cli      score=0.95 (cost-optimal)
# 18:26:51  EXECUTION    gemini-cli      ✓ 3456ms, $0.003, tokens=12K
```

### View Provider Metadata

```bash
# Detailed provider info
ax providers info gemini-cli

# Output:
# 📊 Provider: gemini-cli
# Cost: $0.000125/1K tokens (input), $0.000375/1K tokens (output)
# Latency: P50=2200ms, P95=3000ms, P99=3800ms
# Reliability: 99.7% availability
# Features: Streaming ✓, Vision ✓, Function Calling ✓
```

### Free Tier Analytics

```bash
# Current status
ax free-tier status

# Usage history (last 7 days)
ax free-tier history --days 7

# Summary report
ax free-tier summary
```

---

## Migration Guide

### From Single Provider to Multi-Provider

**Before** (all Claude):
```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 1
    }
  }
}
```

**After** (optimized routing):
```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1  // Highest = cost-optimal
    },
    "openai": {
      "enabled": true,
      "priority": 2  // Speed fallback
    },
    "claude-code": {
      "enabled": true,
      "priority": 3  // Quality fallback
    }
  }
}
```

**Impact**: 60-99% cost reduction, maintained quality

---

## Troubleshooting

### Provider Not Being Used

**Symptom**: Policy set to `cost` but OpenAI still being used

**Causes**:
1. Provider not enabled in config
2. Policy constraints too strict (no provider meets them)
3. Free tier exhausted
4. Provider override active

**Debug**:
```bash
# Check provider status
ax providers list

# View routing trace
ax providers trace --follow

# Check for override
cat .automatosx/session/provider-override.json
```

---

### Unexpected Costs

**Symptom**: Costs higher than expected

**Causes**:
1. Free tier exhausted early in day
2. Large requests exceeding free tier token limit
3. Policy goal not set to `cost`

**Fix**:
```bash
# Check free tier status
ax free-tier status

# Verify policy configuration
cat workflow.ax.yaml | grep -A5 "policy:"

# View cost breakdown
ax providers trace | grep "EXECUTION"
```

---

## See Also

- [Gemini Integration Guide](./gemini-integration.md) - Gemini-specific details
- [Provider Parameters](./provider-parameters.md) - Parameter control
- [Cost Optimization](../../README.md#-policy-driven-cost-optimization) - Main README section

---

**Last Updated**: 2025-10-31
**Version**: v6.0.1
