# Iteration Mode Guide

## What is Iteration Mode?

Iteration Mode is AutomatosX's autonomous multi-iteration execution feature that allows agents to perform deep, thorough analysis by running multiple passes over a task. Instead of a single execution, the agent iteratively refines its work, catching issues missed in earlier passes.

### When to Use Iteration Mode

- **Complex Analysis**: Deep codebase reviews, architecture analysis
- **Bug Hunting**: Finding edge cases, logic errors, security vulnerabilities
- **Optimization Tasks**: Performance analysis, cost optimization
- **Quality Assurance**: Comprehensive testing, code review
- **Security Audits**: Thorough penetration testing, vulnerability scanning

### Benefits

- **Thorough Analysis**: Multiple passes catch issues missed in single runs
- **Self-Correction**: Agent can refine findings based on earlier iterations
- **Deeper Insights**: Progressive analysis reveals complex patterns
- **Higher Quality**: More iterations generally produce more comprehensive results
- **Autonomous Operation**: No manual intervention needed between iterations

---

## Basic Usage

### Command Syntax

```bash
ax run <agent> "task description" --iterate
```

### Default Behavior

Without additional flags, `--iterate` uses **balanced strictness** (5 iterations):

```bash
ax run quality "Find bugs in src/core" --iterate
```

This will:
- Run the quality agent 5 times
- Each iteration refines the previous analysis
- Total execution time: ~15-25 minutes

### Natural Language Usage

When using AutomatosX through AI assistants like Claude Code or Gemini CLI, you can request iteration mode naturally:

**In Claude Code:**
```
"Please use iterate mode with balanced strictness to find bugs in the authentication system"

"Run the security agent with strict iteration mode to audit the API endpoints"

"Use relaxed iteration mode to quickly check for obvious issues"
```

**What happens:**
- Claude Code interprets your request
- Translates to appropriate `ax` command with `--iterate` flags
- Monitors progress and reports results

---

## Iteration Parameters

### 1. Strictness Levels (`--iterate-strictness`)

Control how many iterations to perform:

```bash
# Relaxed: 2 iterations (~5-10 minutes)
ax run quality "task" --iterate --iterate-strictness relaxed

# Balanced: 5 iterations (~15-25 minutes) [DEFAULT]
ax run quality "task" --iterate --iterate-strictness balanced

# Strict: 10 iterations (~30-45 minutes)
ax run quality "task" --iterate --iterate-strictness strict
```

### 2. Custom Iteration Count (`--iterate-max`)

Override strictness with specific iteration count:

```bash
# Exactly 3 iterations
ax run quality "task" --iterate --iterate-max 3

# Exactly 20 iterations (for critical analysis)
ax run security "audit" --iterate --iterate-max 20
```

### 3. Total Timeout (`--iterate-timeout`)

Set maximum total time for all iterations:

```bash
# 30-minute timeout for all iterations
ax run quality "task" --iterate --iterate-timeout 30

# 1-hour timeout for deep analysis
ax run quality "task" --iterate --iterate-strictness strict --iterate-timeout 60
```

**Default Timeouts:**
- Relaxed: 10 minutes total
- Balanced: 25 minutes total
- Strict: 50 minutes total

### 4. Dry Run (`--iterate-dry-run`)

Estimate execution time without actually running:

```bash
ax run quality "Find bugs in src/" --iterate --iterate-dry-run
```

Output:
```
📊 Estimated: 952s (timeout: 2379s)
Dry-run mode enabled. Exiting without execution.
```

---

## Strictness Levels Explained

### Relaxed: Quick 2-Iteration Analysis

**Duration**: ~5-10 minutes
**Best For:**
- Quick checks for obvious issues
- Simple codebases
- Fast feedback loops
- Initial exploration

**Example:**
```bash
ax run quality "Check for obvious code smells" --iterate --iterate-strictness relaxed
```

**Typical Output:**
- First pass: High-level scan
- Second pass: Basic refinement
- Result: Surface-level issues identified

---

### Balanced: Thorough 5-Iteration Analysis [DEFAULT]

**Duration**: ~15-25 minutes
**Best For:**
- Bug hunting in production code
- Code review before merge
- Performance optimization
- Security scanning
- Most general use cases

**Example:**
```bash
ax run quality "Find bugs in authentication module" --iterate --iterate-strictness balanced
```

**Typical Output:**
- Pass 1: Broad scan
- Pass 2: Focus on suspicious areas
- Pass 3: Deep dive into complex logic
- Pass 4: Edge case analysis
- Pass 5: Final comprehensive review
- Result: Comprehensive issue list with severity ratings

---

### Strict: Deep 10-Iteration Analysis

**Duration**: ~30-45 minutes
**Best For:**
- Critical security audits
- Mission-critical systems
- Regulatory compliance checks
- Pre-release quality gates
- High-stakes deployments

**Example:**
```bash
ax run security "Comprehensive security audit" --iterate --iterate-strictness strict
```

**Typical Output:**
- Passes 1-3: Broad vulnerability scanning
- Passes 4-6: Deep logic analysis
- Passes 7-8: Attack surface mapping
- Passes 9-10: Final validation and edge cases
- Result: Extremely thorough security report

---

## Natural Language Usage Examples

### Basic Requests

```
"Please iterate through the codebase to find bugs"
→ ax run quality "find bugs" --iterate

"Use iteration mode to analyze performance"
→ ax run quality "analyze performance" --iterate

"Iterate over the authentication code for security issues"
→ ax run security "audit authentication" --iterate
```

### With Strictness Levels

```
"Use relaxed iteration to quickly check for obvious issues"
→ ax run quality "quick check" --iterate --iterate-strictness relaxed

"Run balanced iteration mode to find bugs"
→ ax run quality "find bugs" --iterate --iterate-strictness balanced

"Perform strict iteration audit of the payment system"
→ ax run security "audit payments" --iterate --iterate-strictness strict
```

### Combining with Other Features

```
"Use iterate mode with parallel execution to analyze multiple modules"
→ ax run quality "analyze modules" --iterate --parallel

"Iterate with streaming output so I can see progress"
→ ax run quality "find bugs" --iterate --streaming

"Run iteration mode and save results to memory"
→ ax run quality "audit" --iterate --memory
```

---

## Advanced Features

### Combining Iteration with Parallel Execution

For multi-agent workflows:

```bash
ax run product "Design and implement feature" --iterate --parallel
```

Result:
- Product agent iterates on design (5 iterations)
- Automatically delegates to backend agent (also iterates)
- Each agent runs multiple passes independently
- Final result: Highly refined implementation

### Using Dry Run for Time Estimation

Before committing to a long iteration:

```bash
ax run quality "Comprehensive codebase analysis" --iterate --iterate-strictness strict --iterate-dry-run
```

Output:
```
📊 Estimated: 2400s (~40 minutes)
📊 Timeout: 3000s (50 minutes max)
```

Decide whether to proceed based on time estimate.

### Resume Support with Iteration Mode

Iteration mode works with resumable runs:

```bash
# Start long-running iteration
ax run quality "Full audit" --iterate --iterate-strictness strict --resumable

# If interrupted, resume later
ax resume <run-id>
```

The system will:
- Resume from the last completed iteration
- Continue with remaining iterations
- Preserve context from earlier passes

---

## Best Practices

### 1. Choose Appropriate Strictness

**Decision Matrix:**

| Task Complexity | Time Available | Recommended Strictness |
|----------------|----------------|------------------------|
| Simple | < 10 min | Relaxed (2 iterations) |
| Medium | 10-25 min | Balanced (5 iterations) |
| Complex | 25-45 min | Strict (10 iterations) |
| Critical | 45+ min | Custom (--iterate-max 15+) |

### 2. Use Dry-Run for Complex Tasks

Always estimate first for tasks that might take > 30 minutes:

```bash
ax run quality "task" --iterate --iterate-strictness strict --iterate-dry-run
```

### 3. Combine with Specific Agent Expertise

Match agent to task for best results:

- **Bug Hunting**: `quality` agent + balanced iteration
- **Security Audit**: `security` agent + strict iteration
- **Performance**: `quality` agent + balanced iteration
- **Architecture Review**: `architecture` agent + strict iteration

```bash
# Security audit - strict iteration
ax run security "Audit API for vulnerabilities" --iterate --iterate-strictness strict

# Performance analysis - balanced iteration
ax run quality "Analyze performance bottlenecks" --iterate --iterate-strictness balanced
```

### 4. Monitor Progress

Use `--streaming` to watch progress in real-time:

```bash
ax run quality "task" --iterate --streaming
```

Output shows progress bar and iteration status:
```
[████░░░░░░░░░░░░░░░░] 20% (5s elapsed, ~20s remaining)
Iteration 2/5: Analyzing src/core/router.ts...
```

### 5. Adjust Timeout for Critical Tasks

For important tasks, increase timeout to prevent premature termination:

```bash
# Extended timeout for comprehensive audit
ax run security "Full security audit" --iterate --iterate-strictness strict --iterate-timeout 90
```

---

## Examples

### Bug Hunting in Core System

```bash
ax run quality "Find bugs in src/core including: memory leaks, race conditions, edge cases, and logic errors" --iterate --iterate-strictness balanced
```

**Expected Result:**
- 5 iterations over ~20 minutes
- Comprehensive bug report with severity
- Specific file and line number references
- Suggested fixes for each issue

---

### Security Audit of Authentication

```bash
ax run security "Comprehensive security audit of authentication system including: SQL injection, XSS, CSRF, authentication bypass, session management" --iterate --iterate-strictness strict
```

**Expected Result:**
- 10 iterations over ~40 minutes
- Detailed vulnerability report
- Attack vectors identified
- Remediation recommendations
- Compliance checklist

---

### Performance Analysis with Dry Run

```bash
# First, estimate time
ax run quality "Analyze performance of entire codebase" --iterate --iterate-strictness strict --iterate-dry-run

# Output: Estimated 45 minutes

# If acceptable, run for real
ax run quality "Analyze performance of entire codebase" --iterate --iterate-strictness strict --streaming
```

**Expected Result:**
- Real-time progress updates
- Performance bottleneck identification
- Optimization recommendations with impact estimates
- Prioritized action items

---

### Multi-Agent Iteration

```bash
ax run product "Design and implement user profile feature with security audit and tests" --iterate --parallel
```

**What Happens:**
1. Product agent iterates on design (5 passes)
2. Delegates to backend agent (also iterates 5 times)
3. Delegates to security agent (also iterates 5 times)
4. Delegates to quality agent (also iterates 5 times)
5. Each agent refines independently
6. Final result: Highly polished feature implementation

---

## Troubleshooting

### "Iteration timeout exceeded"

**Cause**: Task taking longer than timeout

**Solutions:**
```bash
# Increase timeout
ax run quality "task" --iterate --iterate-timeout 60

# Or reduce strictness
ax run quality "task" --iterate --iterate-strictness relaxed
```

### "No progress after X iterations"

**Cause**: Agent has exhausted analysis depth

**Solutions:**
- Use higher strictness level
- Provide more specific task description
- Try a different agent (e.g., security instead of quality)

### "Out of memory during iteration"

**Cause**: Large codebase + many iterations

**Solutions:**
```bash
# Reduce scope
ax run quality "Find bugs in src/core only" --iterate

# Or reduce iterations
ax run quality "task" --iterate --iterate-max 3
```

### "Iteration results seem redundant"

**Cause**: Task might not benefit from iteration

**Consider:**
- Is this task actually complex enough for iteration?
- Try single execution first: `ax run quality "task"`
- If results are similar, iteration may not be needed

---

## Performance Considerations

### Iteration Overhead

Each iteration adds:
- Agent initialization: ~2-5 seconds
- Context building: ~1-2 seconds
- Provider communication: ~0.5-1 second

**Total overhead per iteration**: ~3-8 seconds

For 5 iterations: ~15-40 seconds of overhead

### Cost Implications

**Note**: Cost estimation is disabled by default in AutomatosX v6.5.11+

If enabled, iteration mode increases API costs:
- Relaxed (2x): Roughly 2x cost of single execution
- Balanced (5x): Roughly 5x cost of single execution
- Strict (10x): Roughly 10x cost of single execution

AutomatosX optimizes by:
- Using free-tier providers (Gemini prioritized)
- Caching unchanged results
- Smart context reuse between iterations

---

## Next Steps

- [Spec-Kit Guide](./spec-kit-guide.md) - Combine iteration with spec-driven workflows
- [Cost Configuration Guide](./cost-calculation-guide.md) - Enable cost tracking for iterations
- [Multi-Agent Orchestration](./multi-agent-orchestration.md) - Advanced collaboration patterns
- [CLI Commands Reference](../reference/cli-commands.md) - Complete command documentation

---

**Version**: 6.5.13
**Last Updated**: 2025-11-01
