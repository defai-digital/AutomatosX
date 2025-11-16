# Gemini CLI Integration Guide

**Version**: v6.0.1+
**Status**: Production Ready
**Cost Savings**: 99.6% vs traditional providers

---

## Overview

Gemini CLI is AutomatosX's **most cost-effective** provider, offering 96-99.6% lower costs compared to OpenAI and Claude. This guide covers setup, configuration, best practices, and troubleshooting for Gemini integration.

---

## Why Gemini?

### Cost Comparison

| Scenario | OpenAI | Claude Code | Gemini CLI | Savings |
|----------|--------|-------------|------------|---------|
| **1,000 requests/month** | $62,500 | $90,000 | **$50** | **99.6%** |
| **Per 1M tokens** | $6.25 | $9.00 | **$0.25** | **96%** |
| **Free tier** | None | None | **1,500 req/day** | **100%** |

### Free Tier Benefits

Gemini offers the most generous free tier in the industry:

- **1,500 requests per day** (45,000/month)
- **1 million tokens per day** (30M/month)
- **Automatic resets** at midnight UTC
- **No credit card** required for free tier
- **Production-ready** quality

**Real-world impact**: Most small to medium projects run **100% free** on Gemini.

---

## Quick Start

### 1. Install Gemini CLI

```bash
# macOS/Linux
curl -fsSL https://gemini.google.com/install.sh | sh

# Or with package managers
brew install gemini-cli  # macOS
apt install gemini-cli   # Ubuntu

# Verify installation
gemini --version
```

### 2. Authenticate

```bash
# Login to Google account
gemini login

# Verify authentication
gemini whoami
```

### 3. Enable in AutomatosX

```bash
# Check current providers
ax providers list

# Gemini should appear if installed correctly
# If not, add to automatosx.config.json:
```

```json
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1,  // Highest priority for cost optimization
      "timeout": 2700000,
      "command": "gemini",
      "gemini": {
        "approvalMode": "auto_edit",  // Auto-approve file edits
        "embeddingModel": "text-embedding-004"
      }
    }
  }
}
```

### 4. Test Integration

```bash
# Test Gemini directly
ax providers test --provider gemini-cli

# Should output:
# ✓ gemini-cli: Available (authenticated, responsive)

# Run a simple task
ax run backend "create hello world function"

# Check that Gemini was used
ax providers trace --follow
```

---

## Configuration

### Provider Settings

```json
{
  "providers": {
    "gemini-cli": {
      // Basic settings
      "enabled": true,
      "priority": 1,
      "timeout": 2700000,  // 45 minutes
      "command": "gemini",

      // Health checks
      "healthCheck": {
        "enabled": true,
        "interval": 300000,  // 5 minutes
        "timeout": 5000
      },

      // Circuit breaker (automatic failover)
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,
        "recoveryTimeout": 60000
      },

      // Gemini-specific
      "gemini": {
        "approvalMode": "auto_edit",
        "embeddingModel": "text-embedding-004",
        "enableRealEmbeddings": false
      },

      // Limit tracking
      "limitTracking": {
        "enabled": true,
        "window": "daily",
        "resetHourUtc": 0
      }
    }
  }
}
```

### Approval Modes

Controls how Gemini CLI handles file modifications:

| Mode | Behavior | Best For |
|------|----------|----------|
| `auto_edit` | Auto-approve all file changes | **Recommended**: Automated workflows |
| `prompt` | Ask before each file change | Interactive sessions |
| `none` | No file operations | Read-only tasks |

**Example**:
```json
{
  "gemini": {
    "approvalMode": "prompt"  // Ask before file edits
  }
}
```

---

## Cost Optimization

### Automatic Free Tier Utilization

AutomatosX **automatically uses Gemini's free tier** when available, achieving 99.6% cost reduction.

**No configuration needed** - works out of the box!

#### How It Works

1. **Request arrives**: User runs `ax run backend "task"`
2. **Free tier check**: AutomatosX checks Gemini quota
3. **Automatic routing**:
   - If quota available → Use Gemini (free)
   - If quota exhausted → Fallback to paid or other provider
4. **Tracking**: Usage tracked in `.automatosx/usage/usage-tracker.db`

#### Monitor Free Tier Usage

```bash
# Current status
ax free-tier status

# Output:
# 📊 Gemini CLI Free Tier Status
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Daily Requests:  342 / 1,500 (23%)
# ████░░░░░░░░░░░░░░░░░░░░░░░░░░░
#
# Daily Tokens:    256,789 / 1,000,000 (26%)
# █████░░░░░░░░░░░░░░░░░░░░░░░░░░
#
# Resets in: 14h 23m
# Status: ✅ Healthy (77% available)
```

```bash
# Usage history (last 7 days)
ax free-tier history --days 7

# Summary statistics
ax free-tier summary
```

### Workload-Aware Routing

AutomatosX analyzes request characteristics and routes optimally:

| Request Type | Size | Routing Decision | Reasoning |
|--------------|------|------------------|-----------|
| Interactive UI change | Small (300 tokens) | **OpenAI** | Speed-critical |
| Large refactoring | Large (15K tokens) | **Gemini CLI** | Cost-optimal |
| Security audit | Medium (5K tokens) | **Claude Code** | Quality-critical |
| Batch documentation | XLarge (50K tokens) | **Gemini CLI** | Massive cost savings |

**Example**:
```bash
# Small, streaming → OpenAI (fast)
ax run frontend "add button"
# Cost: $0.002, Time: 1.2s

# Large batch → Gemini (cheap)
ax run backend "refactor authentication system"
# Cost: $0.004, Time: 4.5s (vs $0.15 with OpenAI!)
```

### Policy-Driven Cost Control

Set explicit cost constraints:

```yaml
# workflow.ax.yaml
policy:
  goal: cost
  constraints:
    cost:
      maxPerRequest: 0.01    # Max $0.01 per request
      maxDaily: 1.00         # Max $1.00 per day
```

AutomatosX will:
1. Filter providers by cost constraint
2. Select Gemini CLI (cheapest)
3. Track daily spend
4. Fallback if daily budget exceeded

---

## Features and Capabilities

### Streaming Support

**Status**: ✅ **Enabled** (gradual rollout)

Gemini streaming is controlled by feature flags for safe deployment:

```bash
# Check streaming status
ax flags list

# Output:
# gemini_streaming: 100% rollout (ENABLED for all requests)

# View provider capabilities
ax providers info gemini-cli

# Features section shows:
# Streaming: ✓ (enabled)
```

**Note**: Streaming was rolled out gradually (0% → 1% → 10% → 50% → 100%) to ensure stability. Now fully enabled.

### Vision/Multimodal

**Status**: ✅ **Fully Supported**

Gemini supports image analysis, OCR, diagram understanding:

```bash
# Analyze image
ax run vision "analyze this screenshot and suggest improvements" --attach screenshot.png

# OCR use case
ax run data "extract table data from this PDF" --attach report.pdf

# Diagram understanding
ax run architecture "review this system diagram" --attach architecture.png
```

### Function Calling

**Status**: ✅ **Fully Supported**

Gemini can call external functions and tools:

```yaml
# .automatosx/agents/backend.yaml
name: backend
capabilities:
  - file_operations
  - code_generation
  - function_calling

# Functions automatically available to Gemini
```

---

## Limitations

### 1. Model Parameter Control

**Status**: ❌ **Not Supported**

Gemini CLI does not currently support `maxTokens`, `temperature`, or `topP` parameters.

**GitHub Issue**: [google-gemini/gemini-cli#5280](https://github.com/google-gemini/gemini-cli/issues/5280)

**Workaround**: Use role/prompt engineering instead of parameters:

```yaml
# ❌ Won't work (parameters ignored)
provider:
  primary: gemini-cli
  defaults:
    temperature: 0    # Ignored by Gemini CLI
    maxTokens: 4096   # Ignored by Gemini CLI

# ✅ Use role definition instead
name: qa-specialist
role: Deterministic QA Specialist
systemPrompt: |
  You are a QA specialist who provides consistent, deterministic output.
  Always follow the same testing patterns and provide reproducible results.
```

**Impact**:
- ✅ Most use cases unaffected (role/prompt is more effective)
- ⚠️ QA/testing requiring exact determinism → Use OpenAI instead
- ⚠️ Strict token budgets → Use OpenAI `maxTokens` control

### 2. Model Selection

**Status**: ❌ **Not Supported**

Gemini CLI automatically selects the best model for each request.

**Impact**:
- ✅ Positive: Always get latest, best model
- ⚠️ Potential: Model changes may affect output consistency

### 3. Rate Limits

**Free Tier Limits**:
- 1,500 requests per day
- 1 million tokens per day
- Resets at midnight UTC

**Paid Tier Limits**:
- 10,000 requests per day
- 10 million tokens per day

**AutomatosX Handling**:
- Automatic tracking and monitoring
- Predictive quota management
- Graceful fallback to other providers

---

## Best Practices

### 1. Maximize Free Tier Utilization

```json
// ✅ Good: Enable Gemini with highest priority
{
  "providers": {
    "gemini-cli": {
      "enabled": true,
      "priority": 1  // Use first (free tier!)
    },
    "openai": {
      "enabled": true,
      "priority": 2  // Fallback when free tier exhausted
    }
  }
}
```

```json
// ❌ Bad: Gemini disabled or low priority
{
  "providers": {
    "openai": {
      "priority": 1  // Expensive, used first
    },
    "gemini-cli": {
      "priority": 3  // Rarely used
    }
  }
}
```

### 2. Set Cost Goals

```yaml
# ✅ Good: Explicit cost optimization
policy:
  goal: cost
  constraints:
    cost:
      maxDaily: 1.00  # Will use free tier + cheap providers
```

### 3. Monitor Usage

```bash
# ✅ Good: Regular monitoring
ax free-tier status    # Check daily
ax providers trace     # Debug routing
ax free-tier summary   # Weekly review
```

### 4. Use Workload-Aware Routing

```bash
# ✅ Good: Let AutomatosX decide
ax run backend "large refactoring task"
# → Automatically routes to Gemini (cost-optimal for large tasks)

# ❌ Bad: Force OpenAI for everything
ax providers switch openai
ax run backend "large refactoring task"
# → Expensive ($0.15 vs $0.004)
```

---

## Troubleshooting

### Free Tier Not Working

**Symptom**: Gemini always shows paid usage, never uses free tier

**Causes**:
1. Free tier quota already exhausted
2. Gemini CLI not authenticated
3. Free tier tracking disabled

**Fix**:
```bash
# Check authentication
gemini whoami

# Check free tier status
ax free-tier status

# Check tracking config
cat automatosx.config.json | grep -A3 "limitTracking"

# Should show:
# "limitTracking": {
#   "enabled": true,
#   "window": "daily"
# }
```

---

### Provider Not Being Used

**Symptom**: Policy set to `cost` but Gemini never selected

**Causes**:
1. Gemini CLI not installed
2. Not authenticated
3. Provider disabled in config
4. Circuit breaker tripped (too many failures)

**Fix**:
```bash
# Check provider status
ax providers list

# Should show:
# ✅ gemini-cli  (Priority: 1)

# If not available:
ax providers test --provider gemini-cli

# Test authentication
gemini whoami
```

---

### Streaming Not Working

**Symptom**: Gemini responses come all at once, not streamed

**Causes**:
1. Feature flag not enabled
2. Request doesn't require streaming
3. Client doesn't support streaming

**Fix**:
```bash
# Check feature flag
ax flags list

# Should show:
# gemini_streaming: 100% rollout

# If not 100%, gradually increase:
ax flags rollout gemini_streaming 100

# Verify streaming in provider info
ax providers info gemini-cli
# Features → Streaming: ✓
```

---

### Unexpected Errors

**Symptom**: Gemini returns errors, other providers work fine

**Common Errors**:

#### 1. "Rate limit exceeded"
```
Solution: Free tier exhausted, wait for midnight UTC reset
Check: ax free-tier status
```

#### 2. "Authentication failed"
```
Solution: Re-authenticate with Gemini CLI
Fix: gemini login
```

#### 3. "Model not available"
```
Solution: Gemini CLI selecting unavailable model
Fix: Update Gemini CLI: gemini update
```

#### 4. "Request too large"
```
Solution: Request exceeds token limit (1M/day free tier)
Fix: Split into smaller requests or wait for reset
```

---

## Advanced Configuration

### Per-Agent Provider Override

Force specific agents to use Gemini:

```yaml
# .automatosx/agents/docs-writer.yaml
name: docs-writer
role: Documentation Writer

provider:
  primary: gemini-cli  # Always use Gemini (cost-effective for docs)
  fallbackChain: []    # No fallback (docs not time-critical)
```

### Team-Level Configuration

Set Gemini as default for entire team:

```yaml
# .automatosx/teams/backend.yaml
name: backend
displayName: "Backend Team"

provider:
  primary: gemini-cli
  fallbackChain: [openai, claude-code]
```

### Temporary Provider Override

Test workflows with Gemini:

```bash
# Force all requests to Gemini
ax providers switch gemini-cli

# Run your workflow
ax run backend "implement feature X"

# Reset to normal routing
ax providers reset
```

---

## Cost Savings Calculator

Estimate your savings with Gemini:

### Current Costs (Example: Medium Project)

**Assumptions**:
- 500 requests/month
- 8,000 tokens per request (average)
- Current provider: OpenAI ($6.25 per 1M tokens)

**Current Monthly Cost**:
```
500 requests × 8K tokens = 4,000,000 tokens
4M tokens × $6.25 / 1M = $25.00/month
```

### With Gemini Free Tier

**Free tier capacity**:
- 1,500 requests/day × 30 days = 45,000 requests/month
- 1M tokens/day × 30 days = 30,000,000 tokens/month

**Your usage**: 500 requests × 8K tokens = 4M tokens/month

**Cost with AutomatosX + Gemini**:
```
4M tokens < 30M tokens (free tier)
Cost: $0/month (100% free!)

Annual savings: $25 × 12 = $300/year
```

### Large Project Example

**Assumptions**:
- 10,000 requests/month
- 15,000 tokens per request
- Current: Claude Code ($9.00 per 1M tokens)

**Current Cost**:
```
10,000 × 15K = 150,000,000 tokens
150M × $9.00 / 1M = $1,350/month
```

**With Gemini** (mix of free + paid):
```
Free tier: 30M tokens/month = $0
Paid: 120M tokens × $0.25 / 1M = $30
Total: $30/month

Savings: $1,350 - $30 = $1,320/month (98% reduction!)
Annual savings: $15,840/year
```

---

## See Also

- [Provider Comparison](./provider-comparison.md) - Compare all providers
- [Provider Parameters](./provider-parameters.md) - Parameter limitations
- [Cost Optimization](../../README.md#-policy-driven-cost-optimization) - Main guide

---

**Last Updated**: 2025-10-31
**Version**: v6.0.1
**Status**: Production Ready
