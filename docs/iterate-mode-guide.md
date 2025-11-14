# Iterate Mode User Guide

**AutomatosX v8.0.0 - Autonomous Retry System**

---

## Table of Contents

1. [What is Iterate Mode?](#what-is-iterate-mode)
2. [When to Use Iterate Mode](#when-to-use-iterate-mode)
3. [Quick Start](#quick-start)
4. [CLI Usage](#cli-usage)
5. [Safety Levels](#safety-levels)
6. [Configuration Options](#configuration-options)
7. [Understanding Output](#understanding-output)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## What is Iterate Mode?

Iterate Mode is an **autonomous retry system** that automatically retries failed workflows with adaptive strategies until they succeed or configured limits are reached.

### Key Features

- **Automatic Retry** - No manual intervention needed
- **Adaptive Strategies** - Switches strategies based on failure types
- **Safety Constraints** - Cost and duration limits prevent runaway execution
- **Failure Analysis** - Intelligent error classification and pattern detection
- **Progress Tracking** - Checkpoints and detailed logging

### How It Works

```
┌─────────────────────────────────────────────┐
│  User runs: ax workflow run file.yaml      │
│             --iterate                        │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│  IterateEngine starts with default strategy │
└────────────────┬────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │ Execute Attempt │
        └────────┬────────┘
                 │
         ┌───────┴───────┐
         │               │
    ✅ Success      ❌ Failure
         │               │
         │               ▼
         │      ┌─────────────────┐
         │      │ Analyze Failure  │
         │      └────────┬─────────┘
         │               │
         │               ▼
         │      ┌─────────────────┐
         │      │ Adapt Strategy   │
         │      └────────┬─────────┘
         │               │
         │               ▼
         │      ┌─────────────────┐
         │      │ Check Safety     │
         │      └────────┬─────────┘
         │               │
         │         ┌─────┴─────┐
         │         │           │
         │      Safe?      Unsafe
         │         │           │
         │         └────┬      └──▶ Stop
         │              │
         │              ▼
         └──────▶  Loop Again
                       │
                       ▼
                 ┌──────────┐
                 │  DONE!   │
                 └──────────┘
```

---

## When to Use Iterate Mode

### ✅ Use Iterate Mode When:

1. **Workflows fail intermittently** due to:
   - Network timeouts
   - API rate limits
   - Temporary service outages
   - Resource contention

2. **Long-running workflows** that might encounter:
   - Transient errors
   - Provider API limits
   - Infrastructure issues

3. **Mission-critical workflows** where:
   - Success is essential
   - Manual retry is impractical
   - Cost of failure is high

### ❌ Don't Use Iterate Mode When:

1. **Permanent errors** are expected:
   - Invalid configuration
   - Missing credentials
   - Logic errors in workflow

2. **Quick workflows** that:
   - Complete in seconds
   - Rarely fail
   - Are easy to manually retry

3. **Development/Testing** where:
   - You need immediate feedback
   - Costs should be minimized
   - Failures indicate bugs to fix

---

## Quick Start

### Basic Usage

```bash
# Enable iterate mode for any workflow
ax workflow run my-workflow.yaml --iterate
```

### With Custom Limits

```bash
# Set max iterations and cost limit
ax workflow run data-pipeline.yaml \
  --iterate \
  --max-iterations 15 \
  --max-cost 25
```

### With Safety Level

```bash
# Use paranoid mode for production
ax workflow run production-deploy.yaml \
  --iterate \
  --safety paranoid \
  --max-iterations 5
```

---

## CLI Usage

### Command Syntax

```bash
ax workflow run <file> [options]
```

### Iterate Mode Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--iterate` | flag | false | Enable autonomous retry loop |
| `--max-iterations <n>` | number | 10 | Maximum retry attempts |
| `--safety <level>` | string | normal | Safety level (permissive/normal/paranoid) |
| `--max-cost <amount>` | number | none | Maximum cost in USD |
| `--timeout <seconds>` | number | none | Total timeout in seconds |

### Examples

#### Example 1: Basic Retry
```bash
ax workflow run deploy.yaml --iterate
```

**When to use**: Simple workflows that occasionally fail

#### Example 2: Aggressive Retry
```bash
ax workflow run data-pipeline.yaml \
  --iterate \
  --max-iterations 20 \
  --safety permissive
```

**When to use**: Long-running data pipelines with acceptable cost tolerance

#### Example 3: Conservative Retry
```bash
ax workflow run production-release.yaml \
  --iterate \
  --max-iterations 5 \
  --safety paranoid \
  --max-cost 5
```

**When to use**: Production deployments where costs must be controlled

#### Example 4: Time-Limited Retry
```bash
ax workflow run nightly-build.yaml \
  --iterate \
  --timeout 3600 \
  --max-iterations 15
```

**When to use**: Scheduled jobs with time constraints

---

## Safety Levels

Safety levels control risk tolerance and automatic limits.

### Permissive

**Best for**: Development, experimentation, non-critical workflows

```bash
--safety permissive
```

**Limits**:
- Max cost per iteration: $10
- Max total cost: $100
- Max duration: 1 hour
- Max consecutive failures: 10
- Risk tolerance: 0.8 (80%)

**Use when**:
- Cost is not a primary concern
- Success is more important than efficiency
- Workflows may need many retries

### Normal (Default)

**Best for**: General use, most production workflows

```bash
--safety normal
```

**Limits**:
- Max cost per iteration: $5
- Max total cost: $50
- Max duration: 30 minutes
- Max consecutive failures: 5
- Risk tolerance: 0.5 (50%)

**Use when**:
- Balanced cost and success trade-off needed
- Standard production workflows
- Moderate risk is acceptable

### Paranoid

**Best for**: Cost-sensitive, high-stakes workflows

```bash
--safety paranoid
```

**Limits**:
- Max cost per iteration: $1
- Max total cost: $10
- Max duration: 10 minutes
- Max consecutive failures: 3
- Risk tolerance: 0.2 (20%)

**Use when**:
- Every dollar counts
- Quick failure is preferable to high cost
- Testing new workflows

---

## Configuration Options

### Max Iterations

Controls how many times to retry before giving up.

```bash
--max-iterations 15
```

**Recommendations**:
- **Quick workflows**: 5-10 iterations
- **Medium workflows**: 10-15 iterations
- **Long workflows**: 15-20 iterations

### Max Cost

Set maximum cost in USD to prevent runaway spending.

```bash
--max-cost 50.0
```

**Recommendations**:
- Development: $5-10
- Production (normal): $25-50
- Production (critical): $50-100

### Timeout

Set total time limit in seconds.

```bash
--timeout 1800  # 30 minutes
```

**Recommendations**:
- Quick workflows: 300s (5 min)
- Medium workflows: 1800s (30 min)
- Long workflows: 3600s (1 hour)

---

## Understanding Output

### Console Output

Iterate Mode provides detailed progress information:

```bash
🔄 Iterate Mode Started
   Workflow: security-audit.yaml
   Max iterations: 10
   Safety level: normal
   Initial strategy: default

🔄 Iteration 1/10
   Strategy: default
   ❌ Failed: Network timeout
   Error type: timeout
   Transient: true
   Severity: low
   → Switching to: aggressive-timeout
      Increase timeouts for slow operations

🔄 Iteration 2/10
   Strategy: aggressive-timeout
   ✓ Iteration 2 succeeded

✅ Workflow completed successfully with Iterate Mode!

Results:
  Iterations: 2
  Duration: 145s
  Total Cost: $2.30
  Final Strategy: aggressive-timeout
  Stop Reason: success
```

### Status Indicators

| Indicator | Meaning |
|-----------|---------|
| 🔄 | Iteration in progress |
| ✅ | Success |
| ❌ | Failure |
| ⚠️ | Warning |
| → | Strategy change |

### Stop Reasons

| Reason | Description |
|--------|-------------|
| `success` | Workflow completed successfully |
| `max_iterations` | Reached maximum retry limit |
| `timeout` | Total time limit exceeded |
| `safety_violation` | Safety constraints violated |
| `cost_limit` | Cost limit exceeded |

---

## Best Practices

### 1. Start Conservative

Begin with paranoid mode and increase tolerance as needed:

```bash
# Start here
ax workflow run new-workflow.yaml --iterate --safety paranoid

# If too restrictive, try normal
ax workflow run new-workflow.yaml --iterate --safety normal

# If still failing, try permissive
ax workflow run new-workflow.yaml --iterate --safety permissive
```

### 2. Set Appropriate Limits

Match limits to workflow characteristics:

| Workflow Type | Max Iterations | Safety Level | Max Cost |
|--------------|----------------|--------------|----------|
| API integration | 10 | normal | $20 |
| Data pipeline | 15 | permissive | $50 |
| Deployment | 5 | paranoid | $10 |
| Testing | 3 | paranoid | $5 |

### 3. Monitor First Run

Watch the first iteration closely to understand:
- Typical duration
- Typical cost
- Common failure modes

Then adjust limits accordingly.

### 4. Use Timeouts Wisely

Set timeouts based on expected duration × 2-3:

```bash
# Workflow normally takes 5 minutes
# Set timeout to 15 minutes (3x)
ax workflow run workflow.yaml --iterate --timeout 900
```

### 5. Review Logs

After completion, review the output to:
- Identify which strategies worked
- Understand failure patterns
- Optimize future runs

---

## Troubleshooting

### Problem: Too Many Iterations

**Symptoms**: Workflow uses all iterations but still fails

**Solutions**:
1. Increase `--max-iterations`
2. Check for permanent errors (fix workflow)
3. Use `--safety permissive` for more tolerance

```bash
# Increase iterations
ax workflow run workflow.yaml --iterate --max-iterations 20
```

### Problem: Cost Limit Exceeded

**Symptoms**: Stops with `cost_limit` reason

**Solutions**:
1. Increase `--max-cost`
2. Use cheaper models/providers
3. Optimize workflow to use fewer resources

```bash
# Increase cost limit
ax workflow run workflow.yaml --iterate --max-cost 75
```

### Problem: Timeout Exceeded

**Symptoms**: Stops with `timeout` reason

**Solutions**:
1. Increase `--timeout`
2. Optimize workflow for speed
3. Break into smaller workflows

```bash
# Increase timeout to 1 hour
ax workflow run workflow.yaml --iterate --timeout 3600
```

### Problem: Safety Violations

**Symptoms**: Stops with `safety_violation` reason

**Solutions**:
1. Review warnings in output
2. Adjust safety level
3. Fix underlying issues

```bash
# Use less restrictive safety
ax workflow run workflow.yaml --iterate --safety permissive
```

### Problem: Same Error Repeatedly

**Symptoms**: Error type doesn't change across iterations

**Solutions**:
1. This may indicate a permanent error
2. Review error message carefully
3. Fix root cause instead of retrying

```bash
# Check error details
ax workflow status <execution-id>
```

---

## FAQ

### Q: How much does Iterate Mode cost?

**A**: Iterate Mode itself is free. You only pay for the workflow executions (AI provider costs). Use `--max-cost` to control spending.

### Q: Can I stop an iterate loop manually?

**A**: Yes, use Ctrl+C to cancel. The workflow will stop at the current iteration.

### Q: Are checkpoints created automatically?

**A**: No, checkpoints are optional. Use `--checkpoint-interval N` to create checkpoints every N iterations (feature in CLI).

### Q: What happens to partial progress?

**A**: Each iteration starts fresh unless resuming from a checkpoint. Progress from failed iterations is not preserved.

### Q: Can I customize strategies?

**A**: Currently, only built-in strategies are supported. Custom strategies are planned for a future release.

### Q: Does Iterate Mode work with all workflow types?

**A**: Yes, it works with any workflow that can be run via `ax workflow run`.

### Q: How do I know which strategy to use?

**A**: You don't need to choose - Iterate Mode automatically selects strategies based on failure types.

### Q: Can I use Iterate Mode programmatically?

**A**: Yes, use the `IterateEngine` class. See [API Documentation](./iterate-api.md).

### Q: What's the difference between max-iterations and safety level?

**A**:
- `max-iterations` is a hard limit on retry attempts
- Safety levels control cost, duration, and risk tolerance

---

## Next Steps

- **Learn about strategies**: See [Strategy Reference](./iterate-strategies.md)
- **API documentation**: See [API Documentation](./iterate-api.md)
- **Architecture details**: See [Architecture Documentation](./iterate-architecture.md)

---

**Need Help?** Report issues at https://github.com/automatosx/automatosx/issues
