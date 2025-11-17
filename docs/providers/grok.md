# Grok Provider

The Grok Provider enables AutomatosX to use X.AI's Grok models and Z.AI's GLM models through a YAML-based configuration system.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Templates](#templates)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## Overview

The Grok Provider supports two backends:

1. **Z.AI GLM 4.6** - Code-optimized model ideal for development tasks
2. **X.AI Grok** - General-purpose reasoning model

### Key Features

- ✅ YAML-based configuration with environment variable interpolation
- ✅ Multi-provider support (use both Z.AI and X.AI simultaneously)
- ✅ Rate limiting and circuit breaker protection
- ✅ Model Context Protocol (MCP) tools support
- ✅ Custom Morph agents
- ✅ Automatic fallback to other providers
- ✅ Configuration caching for performance

## Quick Start

### 1. Install Grok CLI

```bash
# Install globally via npm
npm install -g @vibe-kit/grok-cli

# Verify installation
grok --version
```

### 2. Get API Key

**For Z.AI (Recommended for coding):**
- Visit [Z.AI](https://z.ai) to sign up
- Generate an API key from your dashboard
- Export the key: `export GROK_API_KEY="your-z-ai-key"`

**For X.AI (Official Grok):**
- Visit [X.AI](https://x.ai/api) to sign up
- Generate an API key (starts with `xai-`)
- Export the key: `export GROK_API_KEY="xai-..."`

### 3. Create Configuration

Choose a template based on your needs:

**Minimal Setup** (Fastest):
```bash
# Copy minimal template
cp .automatosx/providers/grok-minimal.yaml.template .automatosx/providers/grok.yaml

# Your config is ready!
```

**Full Setup** (All options):
```bash
# Copy full template
cp .automatosx/providers/grok.yaml.template .automatosx/providers/grok.yaml

# Edit to customize
nano .automatosx/providers/grok.yaml
```

**X.AI Setup** (Official Grok):
```bash
# Copy X.AI template
cp .automatosx/providers/grok-xai.yaml.template .automatosx/providers/grok.yaml

# Set X.AI API key
export GROK_API_KEY="xai-..."
```

### 4. Test Configuration

```bash
# Check provider status
ax doctor grok

# Test with a simple task
ax run --provider grok "explain quantum computing in simple terms"
```

## Configuration

### YAML Structure

```yaml
# .automatosx/providers/grok.yaml

provider:
  # Required fields
  name: grok                                          # Must be "grok"
  enabled: true                                       # Enable/disable provider
  baseUrl: https://api.z.ai/api/coding/paas/v4       # API endpoint
  apiKey: ${GROK_API_KEY}                            # API key (use env var)
  model: glm-4.6                                      # Model to use

  # Optional fields
  priority: 2                                         # Routing priority (1 = highest)
  timeout: 120000                                     # Request timeout (ms)
  maxRetries: 3                                       # Max retry attempts
  customPath: /usr/local/bin/grok                    # Custom CLI path

# Optional: Rate limits
rateLimits:
  maxRequestsPerMinute: 60
  maxTokensPerMinute: 100000
  maxConcurrentRequests: 5

# Optional: Circuit breaker
circuitBreaker:
  failureThreshold: 3                                # Failures before opening
  resetTimeout: 60000                                # Cooldown period (ms)
  halfOpenTimeout: 30000                             # Half-open timeout (ms)

# Optional: MCP tools
mcp:
  enabled: true
  servers:
    - name: filesystem
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
      env:
        LOG_LEVEL: info

# Optional: Custom agents
morph:
  enabled: true
  agentsDir: ./.automatosx/morph-agents
  agents:
    - name: code-reviewer
      prompt: "Review code for quality"
      capabilities: ["code-review"]

# Optional: Metadata
metadata:
  version: "1.0.0"
  description: "Grok provider configuration"
  tags: ["grok", "z-ai", "glm-4.6"]
  lastUpdated: "2025-11-16T00:00:00Z"
```

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `provider.name` | string | Provider identifier (must be "grok") | `grok` |
| `provider.enabled` | boolean | Whether provider is active | `true` |
| `provider.baseUrl` | string | API endpoint URL | `https://api.z.ai/api/coding/paas/v4` |
| `provider.apiKey` | string | API authentication key | `${GROK_API_KEY}` |
| `provider.model` | string | Model to use | `glm-4.6` |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider.priority` | number | 2 | Routing priority (1 = highest, lower = higher priority) |
| `provider.timeout` | number | 120000 | Request timeout in milliseconds |
| `provider.maxRetries` | number | 3 | Maximum retry attempts on failure |
| `provider.customPath` | string | (auto-detected) | Custom path to Grok CLI binary |

## Templates

### Minimal Template

**Use when:** You want the quickest setup with defaults.

```yaml
provider:
  name: grok
  enabled: true
  priority: 2
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}
  model: glm-4.6
  timeout: 120000
  maxRetries: 3
```

**File:** `.automatosx/providers/grok-minimal.yaml.template`

### Full Template

**Use when:** You need rate limits, circuit breaker, MCP tools, or custom agents.

Includes all configuration sections with inline documentation.

**File:** `.automatosx/providers/grok.yaml.template`

### X.AI Template

**Use when:** You have an X.AI API key and want the official Grok model.

```yaml
provider:
  name: grok
  enabled: true
  priority: 2
  baseUrl: https://api.x.ai/v1
  apiKey: ${GROK_API_KEY}
  model: grok-beta
  timeout: 180000                    # Longer timeout for X.AI
  maxRetries: 3
```

**File:** `.automatosx/providers/grok-xai.yaml.template`

## Environment Variables

### Interpolation Syntax

Use `${VAR_NAME}` to reference environment variables in YAML:

```yaml
provider:
  apiKey: ${GROK_API_KEY}
  baseUrl: https://${API_HOST}/v1
  model: ${MODEL_NAME}
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GROK_API_KEY` | API authentication key | `zai-abc123...` or `xai-abc123...` |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GROK_BASE_URL` | Override API endpoint | `https://api.z.ai/api/coding/paas/v4` |
| `GROK_MODEL` | Override model name | `glm-4.6` or `grok-beta` |
| `GROK_TIMEOUT` | Override timeout (ms) | `180000` |

### Setting Variables

**Bash/Zsh:**
```bash
export GROK_API_KEY="your-api-key-here"
export GROK_BASE_URL="https://api.z.ai/api/coding/paas/v4"
```

**Using .env file:**
```bash
# .env
GROK_API_KEY=your-api-key-here
GROK_BASE_URL=https://api.z.ai/api/coding/paas/v4

# Load variables
source .env
```

**PowerShell (Windows):**
```powershell
$env:GROK_API_KEY="your-api-key-here"
$env:GROK_BASE_URL="https://api.z.ai/api/coding/paas/v4"
```

## Usage

### Basic Execution

```bash
# Use default provider (based on priority)
ax run backend "implement user authentication"

# Explicitly use Grok provider
ax run --provider grok backend "implement user authentication"

# Use with specific model (if configured)
ax run --provider grok frontend "create React component"
```

### Multi-Provider Setup

Configure multiple providers with different priorities:

```yaml
# .automatosx/providers/grok.yaml
provider:
  priority: 3    # Lower priority for cost optimization

# .automatosx/providers/claude.yaml
provider:
  priority: 1    # Highest priority

# .automatosx/providers/gemini.yaml
provider:
  priority: 2    # Medium priority
```

AutomatosX will try providers in priority order (1 → 2 → 3) with automatic fallback.

### Z.AI vs X.AI

**Z.AI GLM 4.6** (Code-optimized):
```bash
# Best for: Development, code generation, technical tasks
export GROK_API_KEY="your-z-ai-key"

# Configuration
provider:
  baseUrl: https://api.z.ai/api/coding/paas/v4
  model: glm-4.6
  timeout: 120000
```

**X.AI Grok** (General-purpose):
```bash
# Best for: Reasoning, analysis, general chat
export GROK_API_KEY="xai-your-key"

# Configuration
provider:
  baseUrl: https://api.x.ai/v1
  model: grok-beta
  timeout: 180000    # Longer context = longer timeout
```

## Advanced Features

### Rate Limiting

Protect against quota exhaustion:

```yaml
rateLimits:
  maxRequestsPerMinute: 60        # Max requests/minute
  maxTokensPerMinute: 100000      # Max tokens/minute
  maxConcurrentRequests: 5        # Max parallel requests
```

AutomatosX will:
- Track request and token usage
- Queue requests when limits are exceeded
- Automatically rotate to other providers if available

### Circuit Breaker

Prevent cascading failures:

```yaml
circuitBreaker:
  failureThreshold: 3             # Failures before opening circuit
  resetTimeout: 60000             # Cooldown period (60s)
  halfOpenTimeout: 30000          # Test period (30s)
```

**States:**
- **Closed**: Normal operation
- **Open**: Provider blocked after failures
- **Half-Open**: Testing if provider recovered

### MCP Tools

Enable Model Context Protocol tools:

```yaml
mcp:
  enabled: true
  servers:
    # Filesystem access
    - name: filesystem
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-filesystem"
        - "/allowed/directory"
      env:
        LOG_LEVEL: info

    # GitHub integration
    - name: github
      command: npx
      args:
        - "-y"
        - "@modelcontextprotocol/server-github"
      env:
        GITHUB_TOKEN: ${GITHUB_TOKEN}
```

Available MCP servers:
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-github` - GitHub API
- `@modelcontextprotocol/server-postgres` - Database access
- `@modelcontextprotocol/server-slack` - Slack integration

### Custom Morph Agents

Define specialized agents:

```yaml
morph:
  enabled: true
  agentsDir: ./.automatosx/morph-agents
  agents:
    - name: code-reviewer
      prompt: |
        You are a senior code reviewer. Analyze code for:
        - Security vulnerabilities
        - Performance issues
        - Best practices
        Provide actionable feedback.
      capabilities:
        - code-review
        - security-audit

    - name: docs-writer
      prompt: |
        You are a technical writer. Create clear documentation that:
        - Explains concepts simply
        - Includes examples
        - Targets developers
      capabilities:
        - documentation
        - technical-writing
```

### Configuration Caching

YamlConfigLoader caches configurations for performance:

```typescript
// Default: 60-second cache
// Configurations are automatically reloaded when expired

// Manual cache control (TypeScript)
import { getYamlConfigLoader } from '@defai.digital/automatosx';

const loader = getYamlConfigLoader();

// Custom TTL (for testing)
loader.setCacheTTL(30000);  // 30 seconds

// Force reload
loader.clearCache();

// Clear specific config
loader.clearCacheEntry('.automatosx/providers/grok.yaml');

// Check cache stats
const stats = loader.getCacheStats();
console.log(`Cached configs: ${stats.size}`);
```

## Troubleshooting

### Provider Not Found

**Error:** `Provider "grok" not found`

**Solution:**
1. Check configuration file exists:
   ```bash
   ls -la .automatosx/providers/grok.yaml
   ```

2. Verify provider name is "grok":
   ```yaml
   provider:
     name: grok  # Must be exactly "grok"
   ```

3. Check provider is enabled:
   ```yaml
   provider:
     enabled: true
   ```

### Missing Environment Variable

**Error:** `Missing required environment variables: GROK_API_KEY`

**Solution:**
```bash
# Set the environment variable
export GROK_API_KEY="your-api-key"

# Verify it's set
echo $GROK_API_KEY

# Make it persistent (add to ~/.bashrc or ~/.zshrc)
echo 'export GROK_API_KEY="your-api-key"' >> ~/.bashrc
source ~/.bashrc
```

### Invalid YAML Syntax

**Error:** `Failed to parse configuration: unexpected end of the stream`

**Solution:**
1. Validate YAML syntax:
   ```bash
   # Using yamllint (if installed)
   yamllint .automatosx/providers/grok.yaml

   # Or use online validator
   # https://www.yamllint.com/
   ```

2. Common issues:
   - Missing quotes around strings with colons
   - Incorrect indentation (use spaces, not tabs)
   - Unclosed arrays or objects

### Validation Errors

**Error:** `YAML configuration validation failed: provider.baseUrl: Must be valid HTTP/HTTPS URL`

**Solution:**
Check the error message for specific field and fix:
```yaml
# ❌ Wrong
provider:
  baseUrl: api.z.ai

# ✅ Correct
provider:
  baseUrl: https://api.z.ai/api/coding/paas/v4
```

### Grok CLI Not Found

**Error:** `Provider "grok" unavailable: CLI not found in PATH`

**Solution:**
```bash
# Install Grok CLI
npm install -g @vibe-kit/grok-cli

# Verify installation
which grok
grok --version

# Or specify custom path in config
provider:
  customPath: /usr/local/bin/grok
```

### Rate Limit Errors

**Error:** `Provider "grok" hit usage limit`

**Solution:**
- AutomatosX automatically rotates to next available provider
- Check quota status: `ax providers status`
- Wait for limit reset (shown in error message)
- Or use different provider: `ax run --provider claude "task"`

### Timeout Errors

**Error:** `Provider "grok" timed out after 120000ms`

**Solution:**
Increase timeout in configuration:
```yaml
provider:
  timeout: 300000  # 5 minutes
```

## API Reference

### Configuration Types

```typescript
interface YamlProviderConfig {
  provider: {
    name: string;
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    model: string;
    priority?: number;
    timeout?: number;
    maxRetries?: number;
    customPath?: string;
  };
  rateLimits?: {
    maxRequestsPerMinute: number;
    maxTokensPerMinute: number;
    maxConcurrentRequests: number;
  };
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeout: number;
    halfOpenTimeout?: number;
  };
  mcp?: {
    enabled: boolean;
    servers?: Array<{
      name: string;
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }>;
  };
  morph?: {
    enabled: boolean;
    agentsDir?: string;
    agents?: Array<{
      name: string;
      prompt: string;
      capabilities?: string[];
    }>;
  };
  metadata?: {
    version?: string;
    description?: string;
    tags?: string[];
    lastUpdated?: string;
  };
}
```

### Loading Configurations

```typescript
// Load configuration
import { loadYamlConfig } from '@defai.digital/automatosx';

const config = await loadYamlConfig('.automatosx/providers/grok.yaml');
console.log(config.provider.model);  // "glm-4.6"

// Get singleton loader
import { getYamlConfigLoader } from '@defai.digital/automatosx';

const loader = getYamlConfigLoader();
const config = await loader.loadConfig('.automatosx/providers/grok.yaml');

// Cache management
loader.clearCache();
loader.setCacheTTL(30000);
const stats = loader.getCacheStats();
```

### CLI Commands

```bash
# Check Grok provider status
ax doctor grok

# List all providers
ax providers list

# Show Grok provider details
ax providers show grok

# Check provider limits
ax providers limits

# View routing trace logs
ax providers trace --follow

# Test Grok provider
ax run --provider grok test-agent "simple task"
```

## Support

- **Documentation**: [AutomatosX Docs](https://github.com/defai-digital/automatosx)
- **Issues**: [GitHub Issues](https://github.com/defai-digital/automatosx/issues)
- **Z.AI Docs**: [Z.AI Documentation](https://docs.z.ai)
- **X.AI Docs**: [X.AI API Documentation](https://x.ai/api)

---

**Version**: 8.3.0 (Phase 1)
**Last Updated**: 2025-11-16
**Status**: Production Ready
