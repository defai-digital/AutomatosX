# Claude Code Integration

Complete guide for integrating Anthropic's Claude Code CLI with AutomatosX.

## Overview

AutomatosX supports Anthropic's Claude Code CLI as a provider, enabling you to leverage Claude's exceptional reasoning capabilities for complex analysis, code reviews, and architectural decisions. Claude excels at tasks requiring deep understanding and nuanced judgment.

**Features**:
- ✅ Superior reasoning quality for complex problems
- ✅ Native streaming support with real-time feedback
- ✅ Excellent code analysis and security auditing
- ✅ Strong architectural decision-making capabilities
- ✅ Automatic process management and cleanup
- ✅ Cost estimation and usage tracking

**Best For**:
- Code reviews requiring deep analysis
- Security audits and vulnerability assessment
- Architectural decision-making
- Complex refactoring with context understanding
- Technical documentation and explanation

---

## Why Claude Code?

### Quality Comparison

| Capability | Claude Code | OpenAI | Gemini CLI |
|------------|-------------|--------|------------|
| **Reasoning Quality** | ⭐⭐⭐⭐⭐ Exceptional | ⭐⭐⭐⭐ Strong | ⭐⭐⭐ Good |
| **Code Analysis** | ⭐⭐⭐⭐⭐ Best-in-class | ⭐⭐⭐⭐ Very good | ⭐⭐⭐ Good |
| **Security Audits** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Good | ⭐⭐⭐ Good |
| **Context Understanding** | ⭐⭐⭐⭐⭐ Superior | ⭐⭐⭐⭐ Strong | ⭐⭐⭐ Good |
| **Speed (Latency)** | ⭐⭐⭐ Medium (2500ms P95) | ⭐⭐⭐⭐ Fast (2000ms P95) | ⭐⭐⭐ Medium (3000ms P95) |
| **Cost** | ⭐⭐ Higher ($9/1M tokens) | ⭐⭐ Higher ($6.25/1M) | ⭐⭐⭐⭐⭐ Lowest ($0.25/1M) |

### When to Use Claude Code

**✅ Choose Claude for**:
1. **Code Reviews** - Superior at identifying edge cases and design issues
2. **Security Audits** - Excellent at finding vulnerabilities and security flaws
3. **Architecture Decisions** - Strong reasoning for system design choices
4. **Complex Refactoring** - Deep understanding of code context and dependencies
5. **Technical Documentation** - Clear, thorough explanations of complex topics
6. **Problem-Solving** - Best at tackling novel or ambiguous problems

**❌ Use alternatives when**:
1. **Cost is primary concern** → Use Gemini (96% cheaper)
2. **Speed is critical** → Use OpenAI (20% faster)
3. **Simple/repetitive tasks** → Use Gemini free tier
4. **High volume workloads** → Use Gemini for cost efficiency

### Cost Considerations

| Usage Pattern | Monthly Cost | Annual Cost | Best Alternative |
|---------------|-------------|-------------|------------------|
| **1,000 requests/month** (10K tokens each) | $90,000 | $1,080,000 | Gemini: $50/month (99.6% savings) |
| **Per request** (10K tokens) | $0.09 | - | Gemini: $0.0025 (97% cheaper) |
| **Code review** (5K tokens) | $0.045 | - | Quality-critical: Worth the cost |
| **Security audit** (8K tokens) | $0.072 | - | Safety-critical: Worth the cost |

**Recommendation**: Use AutomatosX's policy-driven routing to automatically use Claude only for quality-critical tasks while routing cost-sensitive workloads to Gemini.

---

## Installation

### 1. Install Claude Code CLI

**macOS**:
```bash
# Via Homebrew (recommended)
brew install --cask claude

# Verify installation
claude --version
```

**Linux**:
```bash
# Via install script
curl -fsSL https://claude.ai/install.sh | sh

# Add to PATH if needed
export PATH="$PATH:$HOME/.claude/bin"

# Verify installation
claude --version
```

**Windows**:
```powershell
# Via Scoop
scoop bucket add anthropic
scoop install claude

# Or download installer from https://claude.ai/download

# Verify installation
claude --version
```

### 2. Verify Installation

```bash
# Check Claude CLI version
claude --version

# Should output: claude-code 1.x.x (or later)
```

### 3. Authenticate with Anthropic

```bash
# Login to Claude (opens browser for OAuth)
claude login

# Verify authentication
claude whoami

# Expected output:
# Logged in as: your-email@example.com
# Organization: Your Organization
```

---

## Configuration

### Basic Configuration

Claude Code provider is pre-configured in `ax.config.json`:

```json
{
  "providers": {
    "claude-code": {
      "enabled": true,
      "priority": 3,
      "timeout": 2700000,
      "command": "claude"
    }
  }
}
```

**Configuration Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable Claude provider |
| `priority` | number | `3` | Provider priority (lower = higher priority) |
| `timeout` | number | `2700000` | Execution timeout in milliseconds (45 min) |
| `command` | string | `"claude"` | CLI command to execute |

**Priority Explanation**:
- `1` = Highest priority (OpenAI - speed)
- `2` = Medium priority (Gemini - cost)
- `3` = Quality priority (Claude - reasoning)

### Advanced Configuration

#### Health Check Configuration

```json
{
  "providers": {
    "claude-code": {
      "healthCheck": {
        "enabled": true,
        "interval": 300000,
        "timeout": 5000
      }
    }
  }
}
```

**Health Check Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `healthCheck.enabled` | boolean | `true` | Enable periodic health checks |
| `healthCheck.interval` | number | `300000` | Check interval in ms (5 minutes) |
| `healthCheck.timeout` | number | `5000` | Health check timeout in ms |

#### Circuit Breaker Configuration

Prevents cascading failures when Claude is unavailable:

```json
{
  "providers": {
    "claude-code": {
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,
        "recoveryTimeout": 60000
      }
    }
  }
}
```

**Circuit Breaker Options**:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `circuitBreaker.enabled` | boolean | `true` | Enable circuit breaker protection |
| `circuitBreaker.failureThreshold` | number | `3` | Failures before opening circuit |
| `circuitBreaker.recoveryTimeout` | number | `60000` | Time before retry (ms) |

#### Process Management

```json
{
  "providers": {
    "claude-code": {
      "processManagement": {
        "gracefulShutdownTimeout": 5000,
        "forceKillDelay": 1000
      }
    }
  }
}
```

#### Limit Tracking

Track usage and costs:

```json
{
  "providers": {
    "claude-code": {
      "limitTracking": {
        "enabled": true,
        "window": "weekly",
        "resetHourUtc": 0
      }
    }
  }
}
```

---

## Usage

### Basic Agent Execution

```bash
# Run an agent with Claude (auto-selected by policy)
ax run backend "Review this authentication implementation for security issues"

# Force use of Claude provider
ax run backend "Analyze this codebase architecture" --provider claude-code

# Use Claude for security audit
ax run security "Audit this API for vulnerabilities" --provider claude-code
```

### Streaming Output

Claude supports streaming for real-time feedback:

```bash
# Enable streaming (default for Claude)
ax run backend "Explain the design patterns in this codebase" --streaming

# Streaming provides progress updates:
# ⠋ Analyzing codebase...
# ⠙ Identifying patterns...
# ⠹ Generating explanation...
```

### With Memory

```bash
# Execute with memory (default) - Claude remembers context
ax run backend "Review the authentication code we discussed yesterday"

# Disable memory for one-off tasks
ax run backend "Quick syntax check" --no-memory
```

### Session Management

Use sessions for multi-step analysis:

```bash
# Create a code review session
ax session create "security-audit"

# Step 1: Identify vulnerabilities
ax session run "security-audit" security "Identify all security vulnerabilities"

# Step 2: Prioritize findings
ax session run "security-audit" security "Prioritize the vulnerabilities by severity"

# Step 3: Recommend fixes
ax session run "security-audit" backend "Recommend specific fixes for each issue"
```

### Policy-Driven Routing

Let AutomatosX automatically select Claude for quality-critical tasks:

```yaml
# workflow.ax.yaml
policy:
  goal: reliability  # Prioritize quality over cost
  constraints:
    reliability:
      minAvailability: 0.998

actors:
  - id: code-review
    agent: security
    description: Review authentication implementation
    # AutomatosX will select Claude (99.8% availability, best quality)
```

```bash
# Execute workflow
ax run workflow.ax.yaml

# Check routing decision
ax providers trace
# Output: SELECTION claude-code score=0.98 (quality-optimal)
```

---

## Features

### 1. Streaming Support

Claude provides **always-on streaming** with real-time progress indicators:

```bash
ax run backend "Refactor this legacy codebase" --provider claude-code

# Real-time output:
# ⠋ Analyzing code structure...        [00:02]
# ⠙ Identifying refactoring patterns... [00:05]
# ⠹ Generating refactored code...       [00:12]
# ⠸ Writing documentation...            [00:18]
# ✓ Complete (23.4s, 12,450 tokens, $0.112)
```

**Features**:
- ✅ Token-by-token streaming
- ✅ Progress estimation based on timeout
- ✅ ETA updates every 2 seconds
- ✅ Final cost and token count

### 2. Superior Reasoning Quality

Claude excels at:

**Code Analysis**:
```bash
ax run backend "Analyze this codebase for design patterns and anti-patterns" --provider claude-code

# Claude provides:
# ✅ Comprehensive pattern identification
# ✅ Nuanced analysis of trade-offs
# ✅ Context-aware recommendations
# ✅ Edge case consideration
```

**Security Auditing**:
```bash
ax run security "Audit this authentication system for vulnerabilities" --provider claude-code

# Claude excels at:
# ✅ Finding subtle security flaws
# ✅ Identifying logic vulnerabilities
# ✅ Recommending defense-in-depth strategies
# ✅ Explaining security implications clearly
```

### 3. Parameter Limitations

**Important**: Claude CLI does **not support** parameter customization:

❌ **Not Available**:
- `temperature` - Uses provider default
- `maxTokens` - Uses provider default
- `topP` - Uses provider default

✅ **Available Controls**:
- Task complexity (via prompt engineering)
- Response format (via role and instructions)
- Timeout control (via AutomatosX config)

**Workaround**: Use role and prompt engineering:

```typescript
// Instead of temperature control:
const context = {
  role: "code reviewer",
  instructions: "Provide a thorough, detailed analysis (creative)",
  // or: "Provide a concise, focused analysis (deterministic)"
};
```

See [Provider Parameters Guide](./parameters.md#claude-limitations) for details.

### 4. Automatic Process Management

AutomatosX handles Claude CLI lifecycle:

- ✅ Spawns `claude` subprocess automatically
- ✅ Monitors process health
- ✅ Handles graceful shutdown (5s timeout)
- ✅ Force kills unresponsive processes
- ✅ Cleans up orphaned processes on exit
- ✅ Tracks and limits concurrent processes

---

## Best Practices

### 1. Use Claude for the Right Tasks

**✅ Ideal Use Cases**:

```bash
# Code Review - Claude's strength
ax run security "Review this PR for security issues and design flaws" --provider claude-code

# Architecture Design - Complex reasoning
ax run cto "Design a microservices architecture for this system" --provider claude-code

# Security Audit - Finding subtle issues
ax run security "Audit for OWASP Top 10 vulnerabilities" --provider claude-code

# Refactoring - Understanding context
ax run backend "Refactor this module while maintaining backward compatibility" --provider claude-code
```

**❌ Avoid Claude for**:

```bash
# Simple tasks - Use Gemini (free tier)
ax run frontend "Add a dark mode toggle button"

# Repetitive tasks - Use Gemini (cost-effective)
ax run quality "Write unit tests for these 50 functions"

# Speed-critical - Use OpenAI (faster)
ax run backend "Quick syntax fix"
```

### 2. Combine with Other Providers

Use AutomatosX routing to optimize cost vs. quality:

```yaml
# .automatosx/agents/thorough-reviewer.yaml
name: thorough-reviewer
role: Senior Code Reviewer

provider:
  primary: claude-code  # Default to Claude for quality

fallback:
  - openai  # Fallback if Claude unavailable
  - gemini-cli  # Final fallback
```

### 3. Set Appropriate Timeouts

Claude tasks often require more time for thorough analysis:

```json
{
  "providers": {
    "claude-code": {
      "timeout": 180000  // 3 minutes for complex analysis
    }
  }
}
```

**Recommended Timeouts**:
- Simple tasks: 30s - 60s
- Code reviews: 2 - 3 minutes
- Architecture design: 5 - 10 minutes
- Large refactoring: 10 - 15 minutes

### 4. Leverage Streaming for Long Tasks

Always use streaming for tasks > 1 minute:

```bash
# Streaming provides visibility into progress
ax run backend "Refactor entire authentication system" --streaming --provider claude-code

# Without streaming, user sees nothing for minutes
# With streaming, user sees: "Analyzing... Identifying patterns... Refactoring..."
```

### 5. Use Memory for Multi-Step Workflows

Claude benefits greatly from context:

```bash
# Step 1: Initial analysis
ax run security "Analyze this authentication implementation"

# Step 2: Follow-up (uses memory)
ax run security "Now check if the issues you found are exploitable"

# Step 3: Recommendations (builds on previous context)
ax run backend "Implement the security fixes you recommended"
```

### 6. Monitor Usage and Costs

```bash
# Check Claude usage
ax provider-limits

# View cost by provider
ax providers trace | grep claude-code | grep EXECUTION

# Example output:
# EXECUTION claude-code ✓ 23456ms, $0.112, tokens=12450
```

---

## Troubleshooting

### Claude CLI Not Found

**Error**: `ProviderError: Claude CLI not found`

**Diagnosis**:
```bash
# Check if claude is in PATH
which claude

# Check Claude installation
claude --version
```

**Solution**:
```bash
# macOS - Reinstall
brew uninstall claude
brew install --cask claude

# Linux - Reinstall
curl -fsSL https://claude.ai/install.sh | sh

# Add to PATH if needed
echo 'export PATH="$PATH:$HOME/.claude/bin"' >> ~/.bashrc
source ~/.bashrc

# Verify
claude --version
ax providers list  # Should show claude-code as available
```

### Authentication Issues

**Error**: `Authentication failed` or `Unauthorized`

**Diagnosis**:
```bash
# Check authentication status
claude whoami

# If not logged in:
# Error: Not authenticated
```

**Solution**:
```bash
# Re-authenticate
claude logout
claude login

# Follow browser OAuth flow

# Verify
claude whoami
# Should show: Logged in as: your-email@example.com
```

### Timeout Errors

**Error**: `Execution timeout after 2700000ms`

**Cause**: Complex tasks exceeding default timeout

**Solution 1** - Increase timeout:
```json
{
  "providers": {
    "claude-code": {
      "timeout": 600000  // 10 minutes
    }
  }
}
```

**Solution 2** - Break into smaller tasks:
```bash
# Instead of one large task:
ax run backend "Refactor entire codebase"  # May timeout

# Break into steps:
ax run backend "Refactor authentication module"
ax run backend "Refactor database layer"
ax run backend "Refactor API endpoints"
```

### Circuit Breaker Open

**Error**: `CircuitBreakerOpen: Claude provider unavailable`

**Cause**: Too many failures triggered circuit breaker

**Diagnosis**:
```bash
# Check provider status
ax providers list

# Output:
# claude-code: ⚠ Circuit breaker OPEN (recovers in 45s)
```

**Solution**:
```bash
# Wait for recovery timeout (default 60s)

# Or manually reset circuit breaker
ax providers reset claude-code

# Or check Claude service status
claude whoami  # Test if CLI is working
```

### Process Cleanup Issues

**Error**: Orphaned `claude` processes after exit

**Diagnosis**:
```bash
# Check for orphaned processes
ps aux | grep claude

# Example output:
# user  12345  0.0  0.1  claude --stream
# user  12346  0.0  0.1  claude --stream
```

**Solution**:
```bash
# Kill orphaned processes
pkill -f "claude --"

# Or use AutomatosX cleanup
ax cleanup

# Restart AutomatosX to ensure clean state
ax providers list
```

### Slow Performance

**Symptom**: Claude responses taking longer than expected

**Diagnosis**:
```bash
# Check provider trace logs
ax providers trace --follow

# Look for:
# EXECUTION claude-code ✓ 45000ms, ...
# (If consistently > 30s, investigate)
```

**Solutions**:

1. **Check network connectivity**:
```bash
# Test Claude API connectivity
claude whoami
```

2. **Reduce task complexity**:
```bash
# Instead of:
ax run backend "Analyze entire codebase and generate complete documentation"

# Break down:
ax run backend "Analyze main application entry point"
ax run backend "Analyze database layer"
# ...
```

3. **Use local caching**:
```json
{
  "performance": {
    "responseCache": {
      "enabled": true,
      "ttl": 86400
    }
  }
}
```

---

## Performance Optimization

### 1. Response Caching

Enable caching for repeated prompts:

```json
{
  "performance": {
    "responseCache": {
      "enabled": true,
      "ttl": 86400,  // 24 hours
      "maxSize": 1000
    }
  }
}
```

**Benefits**:
- Instant responses for repeated queries
- Reduced API costs
- Better user experience

### 2. Concurrent Execution Control

Limit parallel Claude requests to avoid rate limits:

```json
{
  "execution": {
    "concurrency": {
      "maxConcurrentAgents": 2  // Max 2 Claude requests simultaneously
    }
  }
}
```

### 3. Provider Availability Caching

Reduce health check overhead:

```json
{
  "providers": {
    "claude-code": {
      "versionDetection": {
        "timeout": 5000,
        "forceKillDelay": 1000,
        "cacheEnabled": true  // Cache version check (5 min TTL)
      }
    }
  }
}
```

---

## Cost Management

### Track Claude Usage

```bash
# View current usage
ax provider-limits

# Example output:
# Provider: claude-code
# Period: Weekly (resets Sunday 00:00 UTC)
# Requests: 45
# Tokens: 234,567
# Estimated Cost: $2.11
# Reset: 2025-11-03 00:00:00 UTC
```

### Set Usage Alerts

```json
{
  "providers": {
    "claude-code": {
      "limitTracking": {
        "enabled": true,
        "window": "weekly",
        "maxCost": 10.00  // Alert if weekly cost > $10
      }
    }
  }
}
```

### Optimize Costs with Routing

Use AutomatosX to automatically use cheaper providers when appropriate:

```yaml
# workflow.ax.yaml
policy:
  goal: balanced  # Balance cost and quality
  constraints:
    cost:
      maxPerRequest: 0.05  # Max $0.05 per request

actors:
  - id: simple-task
    agent: backend
    description: Add logging to functions
    # AutomatosX selects Gemini ($0.0025 vs Claude $0.09)

  - id: complex-task
    agent: security
    description: Security audit of authentication
    # AutomatosX selects Claude (quality-critical)
```

### Monitor Routing Decisions

```bash
# View real-time routing
ax providers trace --follow

# Filter Claude-specific decisions
ax providers trace | grep claude-code

# Example output:
# 14:23:45 POLICY       claude-code    goal=reliability, passed=3/3
# 14:23:45 SELECTION    claude-code    score=0.98 (quality-optimal)
# 14:23:56 EXECUTION    claude-code    ✓ 11234ms, $0.089, tokens=9876
```

---

## Integration Examples

### Quality-First Development

```yaml
# .automatosx/teams/quality-team.yaml
name: quality-focused-team
description: Team optimized for code quality

agents:
  - name: architect
    provider: claude-code  # Best reasoning for architecture

  - name: reviewer
    provider: claude-code  # Best for code reviews

  - name: implementer
    provider: gemini-cli  # Cost-effective for implementation

  - name: tester
    provider: openai  # Fast for test generation
```

### Balanced Workflow

```yaml
# spec.ax.yaml
metadata:
  id: balanced-workflow
  name: Cost-Optimized Development

policy:
  goal: balanced
  constraints:
    cost:
      maxDaily: 5.00
    reliability:
      minAvailability: 0.995

actors:
  - id: design
    agent: product
    description: Design feature architecture
    # Policy selects: Claude (high-value decision)

  - id: implement
    agent: backend
    description: Implement feature based on design
    # Policy selects: Gemini (cost-effective execution)

  - id: review
    agent: security
    description: Security review of implementation
    # Policy selects: Claude (quality-critical)

  - id: test
    agent: quality
    description: Write comprehensive test suite
    # Policy selects: Gemini (cost-effective, high volume)
```

---

## See Also

- [Provider Comparison](./overview.md) - Compare Claude with other providers
- [Provider Parameters](./parameters.md) - Parameter control limitations
- [Policy-Driven Routing](./overview.md#provider-selection-strategy) - Automatic provider selection
- [Using Claude Code Platform](../../CLAUDE.md) - For Claude Code users (different from provider setup)

---

## Support

- **AutomatosX Documentation**: [GitHub Docs](https://github.com/defai-digital/automatosx/docs)
- **AutomatosX Issues**: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- **Claude Code**: [Official Docs](https://claude.ai/docs)
- **Anthropic Support**: [Support Portal](https://support.anthropic.com)

---

## Changelog

### v6.3.8 (2025-10-31)
- ✅ Comprehensive Claude Code provider documentation
- ✅ Installation and authentication guide
- ✅ Configuration examples
- ✅ Best practices for quality-first development
- ✅ Troubleshooting guide
- ✅ Cost optimization strategies

---

**Updated**: 2025-10-31
**Version**: v6.3.8
