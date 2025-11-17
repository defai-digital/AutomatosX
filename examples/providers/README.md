# Provider Configuration Examples

This directory contains example YAML configurations for AutomatosX providers.

## Available Examples

### Grok Provider

- **`grok-z-ai.yaml`** - Z.AI GLM 4.6 (code-optimized model)
  - Best for: Development, code generation, technical tasks
  - Endpoint: `https://api.z.ai/api/coding/paas/v4`
  - Model: `glm-4.6`

- **`grok-x-ai.yaml`** - X.AI Official Grok Model
  - Best for: Reasoning, analysis, general chat
  - Endpoint: `https://api.x.ai/v1`
  - Model: `grok-beta`

- **`grok-with-mcp.yaml`** - Grok with MCP Tools
  - Includes: Filesystem, GitHub, Slack, PostgreSQL integrations
  - Demonstrates: Model Context Protocol (MCP) setup
  - Requires: MCP server packages installed

### Multi-Provider Setup

- **`multi-provider.yaml`** - Complete multi-provider configuration
  - Demonstrates: Priority-based routing
  - Includes: Claude, Gemini, Grok configurations
  - Shows: Automatic fallback setup

## Quick Start

### 1. Choose a Template

```bash
# List available examples
ls examples/providers/

# View example
cat examples/providers/grok-z-ai.yaml
```

### 2. Copy to Your Project

```bash
# Create providers directory
mkdir -p .automatosx/providers

# Copy template
cp examples/providers/grok-z-ai.yaml .automatosx/providers/grok.yaml
```

### 3. Set Environment Variables

```bash
# For Z.AI
export GROK_API_KEY="your-z-ai-key"

# For X.AI
export GROK_API_KEY="xai-your-key"

# For MCP tools (if using)
export GITHUB_TOKEN="your-github-token"
```

### 4. Test Configuration

```bash
# Check provider status
ax doctor grok

# Test execution
ax run --provider grok backend "simple task"
```

## Configuration Priority

When using multiple providers, AutomatosX routes requests based on priority:

```yaml
# .automatosx/providers/claude.yaml
provider:
  priority: 1    # ← Highest priority (tried first)

# .automatosx/providers/gemini.yaml
provider:
  priority: 2    # ← Medium priority

# .automatosx/providers/grok.yaml
provider:
  priority: 3    # ← Lowest priority (fallback)
```

**Routing behavior:**
1. Try highest priority provider (1)
2. If unavailable/failed → try next (2)
3. If all fail → try lowest priority (3)
4. If all exhausted → return error

## Environment Variable Interpolation

All examples use `${VAR_NAME}` syntax for environment variables:

```yaml
provider:
  apiKey: ${GROK_API_KEY}           # ← Replaced at runtime
  baseUrl: https://${API_HOST}/v1    # ← Supports multiple vars
```

**Benefits:**
- ✅ Keep secrets out of version control
- ✅ Easy environment switching (dev/staging/prod)
- ✅ Works with CI/CD pipelines
- ✅ Compatible with `.env` files

## Customization

### Adjust Rate Limits

```yaml
rateLimits:
  maxRequestsPerMinute: 120        # ← Increase for higher quota
  maxTokensPerMinute: 200000       # ← Adjust based on plan
  maxConcurrentRequests: 10        # ← More parallel requests
```

### Modify Timeouts

```yaml
provider:
  timeout: 300000                  # ← 5 minutes for complex tasks
```

### Add Circuit Breaker

```yaml
circuitBreaker:
  failureThreshold: 5              # ← More tolerant
  resetTimeout: 120000             # ← Longer cooldown
```

## Advanced Features

### MCP Tools

Enable Model Context Protocol for extended capabilities:

```yaml
mcp:
  enabled: true
  servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
```

**Available MCP Servers:**
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-github` - GitHub API
- `@modelcontextprotocol/server-slack` - Slack integration
- `@modelcontextprotocol/server-postgres` - Database access

### Custom Morph Agents

Define specialized agents in configuration:

```yaml
morph:
  enabled: true
  agents:
    - name: security-auditor
      prompt: "Analyze code for security vulnerabilities"
      capabilities: ["security", "audit"]
```

## Troubleshooting

### Provider Not Found

```bash
# Check file exists
ls -la .automatosx/providers/grok.yaml

# Verify provider name
cat .automatosx/providers/grok.yaml | grep "name:"
# Should show: name: grok
```

### Environment Variable Not Set

```bash
# Check variable
echo $GROK_API_KEY

# Set if missing
export GROK_API_KEY="your-key"

# Make persistent (add to ~/.bashrc or ~/.zshrc)
echo 'export GROK_API_KEY="your-key"' >> ~/.bashrc
source ~/.bashrc
```

### YAML Syntax Error

```bash
# Validate YAML
yamllint .automatosx/providers/grok.yaml

# Or use online validator
# https://www.yamllint.com/
```

## Documentation

- **Full Documentation**: [docs/providers/grok.md](../../docs/providers/grok.md)
- **AutomatosX Docs**: [README.md](../../README.md)
- **Z.AI Docs**: https://docs.z.ai
- **X.AI Docs**: https://x.ai/api

## Support

- GitHub Issues: https://github.com/defai-digital/automatosx/issues
- Email: support@defai.digital

---

**Version**: 8.3.0
**Last Updated**: 2025-11-16
