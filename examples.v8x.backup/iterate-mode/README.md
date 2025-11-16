# Iterate Mode Examples

Real-world workflow examples demonstrating AutomatosX Iterate Mode autonomous retry capabilities.

---

## Examples Overview

| Example | Use Case | Strategy Demonstrated | Difficulty |
|---------|----------|----------------------|------------|
| **data-pipeline.yaml** | ETL data processing | aggressive-timeout, fallback-providers | Beginner |
| **api-integration.yaml** | Third-party API calls | fallback-providers | Beginner |
| **deployment.yaml** | Production deployment | reduced-parallelism, default | Intermediate |
| **batch-processing.yaml** | Large file processing | aggressive-timeout, reduced-parallelism | Intermediate |
| **ml-training.yaml** | AI model training | aggressive-timeout, skip-optional | Advanced |

---

## Quick Start

```bash
# Run any example with iterate mode
ax workflow run examples/iterate-mode/data-pipeline.yaml --iterate

# With custom limits
ax workflow run examples/iterate-mode/deployment.yaml \
  --iterate \
  --max-iterations 5 \
  --safety paranoid \
  --max-cost 10

# Verbose output
ax workflow run examples/iterate-mode/api-integration.yaml \
  --iterate \
  --verbose
```

---

## Example 1: Data Pipeline

**File**: `data-pipeline.yaml`

**Scenario**: ETL pipeline that fetches data from API, transforms it, and loads to database

**Common Failures**:
- API timeouts during large data fetches
- Rate limits on API calls
- Database connection timeouts

**Strategies Demonstrated**:
- `default` - Initial attempt
- `aggressive-timeout` - Handles slow API responses
- `fallback-providers` - Switches providers on rate limits

**Expected Outcome**: Succeeds after 2-3 iterations

---

## Example 2: API Integration

**File**: `api-integration.yaml`

**Scenario**: Workflow calling multiple third-party APIs sequentially

**Common Failures**:
- Rate limits (429 errors)
- Network timeouts
- Provider quota exhaustion

**Strategies Demonstrated**:
- `fallback-providers` - Primary strategy for rate limits
- `default` - Standard retry with backoff

**Expected Outcome**: Succeeds after provider fallback

---

## Example 3: Production Deployment

**File**: `deployment.yaml`

**Scenario**: Multi-stage deployment with health checks

**Common Failures**:
- Resource contention during deployment
- Slow health check responses
- Temporary service unavailability

**Strategies Demonstrated**:
- `reduced-parallelism` - Sequential deployment stages
- `aggressive-timeout` - Extended health check timeouts
- `default` - Standard retry

**Expected Outcome**: Succeeds with sequential execution

---

## Example 4: Batch Processing

**File**: `batch-processing.yaml`

**Scenario**: Process 1000+ files with AI model inference

**Common Failures**:
- Timeout on large files
- Resource exhaustion (memory, file descriptors)
- Intermittent inference failures

**Strategies Demonstrated**:
- `aggressive-timeout` - Handle large file processing
- `reduced-parallelism` - Reduce resource contention
- `skip-optional` - Skip failed optional files

**Expected Outcome**: Partial success with optional skips

---

## Example 5: ML Training

**File**: `ml-training.yaml`

**Scenario**: Train ML model with multiple optional evaluation steps

**Common Failures**:
- Long training timeout
- Optional evaluation failures
- Provider rate limits

**Strategies Demonstrated**:
- `aggressive-timeout` - Extended training time
- `skip-optional` - Skip failed evaluations
- `fallback-providers` - Alternative inference providers

**Expected Outcome**: Core training succeeds, optional steps skipped

---

## Running Examples

### Basic Execution

```bash
# Run with default settings
ax workflow run examples/iterate-mode/data-pipeline.yaml --iterate
```

### Conservative (Recommended for Production)

```bash
ax workflow run examples/iterate-mode/deployment.yaml \
  --iterate \
  --safety paranoid \
  --max-iterations 5 \
  --max-cost 10
```

### Aggressive (Development/Testing)

```bash
ax workflow run examples/iterate-mode/batch-processing.yaml \
  --iterate \
  --safety permissive \
  --max-iterations 20 \
  --max-cost 100
```

### With Checkpoints

```bash
ax workflow run examples/iterate-mode/ml-training.yaml \
  --iterate \
  --checkpoint-interval 3 \
  --max-iterations 15
```

---

## Customizing Examples

### Modify Workflow

Edit workflow YAML to change steps, providers, or configuration:

```yaml
# data-pipeline.yaml
steps:
  - name: fetch-data
    provider: claude
    timeout: 30000
    required: true

  - name: transform-data
    provider: gemini
    timeout: 15000
    required: true

  - name: load-data
    provider: openai
    timeout: 20000
    required: false  # Make optional
```

### Override CLI Options

```bash
# Override timeout
ax workflow run examples/iterate-mode/data-pipeline.yaml \
  --iterate \
  --timeout 1800

# Override cost limit
ax workflow run examples/iterate-mode/ml-training.yaml \
  --iterate \
  --max-cost 50

# Change safety level
ax workflow run examples/iterate-mode/deployment.yaml \
  --iterate \
  --safety permissive
```

---

## Expected Output

### Successful Run

```bash
$ ax workflow run examples/iterate-mode/data-pipeline.yaml --iterate

🔄 Iterate Mode Started
   Workflow: data-pipeline.yaml
   Max iterations: 10
   Safety level: normal
   Initial strategy: default

🔄 Iteration 1/10
   Strategy: default
   ❌ Failed: Request timeout
   Error type: timeout
   Transient: true
   Severity: medium
   → Switching to: aggressive-timeout
      Increase timeouts for slow operations

🔄 Iteration 2/10
   Strategy: aggressive-timeout
   ✓ Iteration 2 succeeded

✅ Workflow completed successfully with Iterate Mode!

Results:
  Iterations: 2
  Duration: 47s
  Total Cost: $0.85
  Final Strategy: aggressive-timeout
  Stop Reason: success
```

### Failed Run (Max Iterations)

```bash
$ ax workflow run examples/iterate-mode/deployment.yaml --iterate --max-iterations 3

🔄 Iterate Mode Started
   Workflow: deployment.yaml
   Max iterations: 3
   Safety level: normal
   Initial strategy: default

🔄 Iteration 1/10
   Strategy: default
   ❌ Failed: Resource exhausted

🔄 Iteration 2/10
   Strategy: reduced-parallelism
   ❌ Failed: Resource exhausted

🔄 Iteration 3/10
   Strategy: reduced-parallelism
   ❌ Failed: Resource exhausted

❌ Workflow failed after 3 iterations

Results:
  Iterations: 3
  Duration: 125s
  Total Cost: $0.00
  Final Strategy: reduced-parallelism
  Stop Reason: max_iterations
```

---

## Troubleshooting Examples

### Example Fails Immediately

**Problem**: Workflow fails on first iteration with permanent error

**Solution**:
1. Check workflow definition for errors
2. Verify credentials and configuration
3. Run without `--iterate` to see raw error
4. Fix underlying issue before retrying

```bash
# Debug without iterate
ax workflow run examples/iterate-mode/data-pipeline.yaml
```

### Example Exhausts All Iterations

**Problem**: Workflow uses all iterations without success

**Solution**:
1. Increase `--max-iterations`
2. Use `--safety permissive` for more tolerance
3. Check if error is actually permanent (authentication, validation)
4. Review error messages in verbose mode

```bash
# Increase iterations and enable verbose
ax workflow run examples/iterate-mode/deployment.yaml \
  --iterate \
  --max-iterations 20 \
  --verbose
```

### Example Hits Cost Limit

**Problem**: Stops with `cost_limit` reason

**Solution**:
1. Increase `--max-cost`
2. Optimize workflow to use cheaper providers
3. Review cost per iteration in output

```bash
# Increase cost limit
ax workflow run examples/iterate-mode/ml-training.yaml \
  --iterate \
  --max-cost 100
```

---

## Next Steps

- Read [Iterate Mode User Guide](../../docs/iterate-mode-guide.md)
- Review [Strategy Reference](../../docs/iterate-strategies.md)
- Check [API Documentation](../../docs/iterate-api.md)

---

**Questions?** Report issues at https://github.com/automatosx/automatosx/issues
