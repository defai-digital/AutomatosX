# Product Requirements Document: Grok CLI Provider Integration with Z.AI GLM 4.6

**Version**: 1.1 (YAML Configuration Update)
**Date**: 2025-11-16
**Last Updated**: 2025-11-16
**Target Release**: AutomatosX v8.3.0
**Status**: Draft - Updated with YAML Configuration
**Owner**: AutomatosX Core Team

---

## Executive Summary

This PRD outlines the integration of Grok CLI as a new AI provider in AutomatosX, enabling access to Z.AI's GLM 4.6 model and other Grok models. This integration will expand AutomatosX's multi-provider orchestration capabilities, provide cost-effective alternatives, and enable unique features such as MCP tool extensibility and ultra-fast code editing via Morph.

**Key Benefits**:
- **Provider Diversity**: Add Z.AI GLM 4.6 and X.AI Grok models to existing Claude/Gemini/OpenAI options
- **Cost Optimization**: Enable intelligent routing to cost-effective Z.AI models
- **Advanced Features**: MCP tool support, Morph Fast Apply (4,500+ tokens/sec), headless execution
- **Consistent Architecture**: Leverage proven BaseProvider pattern from v8.2.0+
- **YAML Configuration**: Centralized, version-controlled configuration in `.automatosx/providers/grok.yaml`
- **Zero Breaking Changes**: Pure additive feature with backward compatibility

**Update v1.1**: Configuration approach changed from environment variables to YAML files for better organization, version control, and multi-environment support.

---

## Table of Contents

1. [Background & Context](#1-background--context)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [User Stories](#4-user-stories)
5. [Technical Architecture](#5-technical-architecture)
6. [Implementation Plan](#6-implementation-plan)
7. [API & Interface Design](#7-api--interface-design)
8. [Configuration Schema](#8-configuration-schema)
9. [Testing Strategy](#9-testing-strategy)
10. [Migration & Rollout](#10-migration--rollout)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Success Metrics](#12-success-metrics)
13. [Future Enhancements](#13-future-enhancements)
14. [Appendices](#14-appendices)

---

## 1. Background & Context

### 1.1 Current State (AutomatosX v8.2.0)

AutomatosX is a production-ready AI agent orchestration platform supporting:
- **3 Providers**: Claude (Anthropic), Gemini (Google), OpenAI
- **Pure CLI Architecture**: v8.2.0+ simplified to pure CLI wrappers (removed SDK modes)
- **Policy-Based Routing**: Intelligent provider selection based on priority, health, and availability
- **20+ Specialized Agents**: Backend, frontend, security, quality, etc.
- **Persistent Memory**: SQLite FTS5 full-text search (< 1ms)
- **Multi-Agent Orchestration**: Session management, delegation, cycle detection

**Provider Architecture** (v8.3.0 Simplified):
```typescript
abstract class BaseProvider {
  // Pure CLI wrapper - no API keys, model selection, or cost tracking
  protected abstract executeCLI(prompt: string): Promise<string>;
  protected abstract checkCLIAvailable(): Promise<boolean>;
}
```

### 1.2 Grok CLI Overview

**Project**: [@vibe-kit/grok-cli](https://github.com/superagent-ai/grok-cli)
**License**: MIT
**Current Version**: 1.0.1
**Installation**: `npm install -g @vibe-kit/grok-cli`

**Key Capabilities**:
- **Conversational AI**: Natural language interface powered by Grok-3/4
- **Smart File Operations**: AI-driven file viewing, creation, and modification
- **Bash Integration**: Execute shell commands through natural conversation
- **MCP Tools**: Extensibility through Model Context Protocol servers (stdio/HTTP/SSE)
- **Morph Fast Apply**: Optional high-speed code editing (4,500+ tokens/sec, 98% accuracy)
- **Interactive & Headless Modes**: Terminal UI (Ink) + single-prompt execution
- **Multi-Provider Support**: X.AI (default), OpenRouter, Groq, any OpenAI-compatible API

**Command-Line Options**:
```bash
grok [options] [message...]
  -d, --directory <dir>        # Working directory
  -k, --api-key <key>          # API key (or GROK_API_KEY env)
  -u, --base-url <url>         # API base URL (or GROK_BASE_URL env)
  -m, --model <model>          # Model selection (e.g., glm-4.6, grok-4-latest)
  -p, --prompt <prompt>        # Headless single-prompt mode
  --max-tool-rounds <rounds>   # Tool execution limit (default: 400)
```

**MCP Support**:
- **stdio**: Subprocess-based execution (most common)
- **HTTP**: Network-based connections
- **SSE**: Server-Sent Events streaming
- **Configuration**: CLI flags or `.grok/settings.json`

**Configuration Files**:
- `~/.grok/user-settings.json`: User-level credentials, base URL, models
- `.grok/settings.json`: Project-level model preferences, MCP servers
- `.grok/GROK.md`: Project-specific behavioral instructions

### 1.3 Z.AI GLM 4.6 Backend

**Provider**: Z.AI (ZhipuAI)
**Base URL**: `https://api.z.ai/api/coding/paas/v4`
**Model**: `glm-4.6`

**Known Capabilities**:
- **Thinking Modes**: Supports reasoning/thinking (limited Grok CLI compatibility - displays full thinking content)
- **OpenAI-Compatible**: Adheres to OpenAI chat completions specification
- **Code Generation**: Optimized for development tasks

**Configuration** (v1.1 Update - YAML-based):
```yaml
# .automatosx/providers/grok.yaml
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}  # Can reference env var or use direct value
  model: glm-4.6

  # Alternative: X.AI configuration
  # baseUrl: https://api.x.ai/v1
  # model: grok-4-latest
```

**Legacy Environment Variable Support** (still supported for backward compatibility):
```bash
export GROK_BASE_URL="https://api.z.ai/api/coding/paas/v4"
export GROK_API_KEY="your-z-ai-api-key"
```

**Unknowns** (requires further research):
- Pricing (input/output tokens)
- Context window size
- Rate limits
- Free tier availability
- Performance benchmarks vs. competitors

### 1.4 AutomatosX Provider Patterns (v8.3.0)

**Existing Implementations**:

**ClaudeProvider** (src/providers/claude-provider.ts):
```typescript
export class ClaudeProvider extends BaseProvider {
  protected async executeCLI(prompt: string): Promise<string> {
    const escapedPrompt = this.escapeShellArg(prompt);
    const { stdout } = await execAsync(`claude "${escapedPrompt}"`, {
      timeout: this.config.timeout || 120000,
      maxBuffer: 10 * 1024 * 1024
    });
    return stdout.trim();
  }

  protected async checkCLIAvailable(): Promise<boolean> {
    const path = await findOnPath('claude');
    return path !== null;
  }
}
```

**GeminiProvider** (src/providers/gemini-provider.ts):
- Identical pattern to Claude
- Command: `gemini "prompt"`
- Availability check: `findOnPath('gemini')`

**BaseProvider Security** (src/providers/base-provider.ts:35):
```typescript
private static readonly ALLOWED_PROVIDER_NAMES = [
  'claude',
  'gemini',
  'codex',
  'test-provider'  // For unit tests
] as const;
```

**Critical Security Pattern**: Provider names must be whitelisted to prevent command injection.

---

## 2. Problem Statement

### 2.1 Current Limitations

1. **Limited Provider Options**: Only 3 providers (Claude, Gemini, OpenAI)
   - Users cannot leverage Z.AI's GLM 4.6 for cost/performance optimization
   - No access to X.AI's Grok models (grok-4-latest, grok-code-fast-1)
   - Reduced routing flexibility in multi-provider orchestration

2. **No MCP Tool Support**: Existing providers lack extensibility
   - Cannot integrate Linear, GitHub, or custom MCP servers
   - Limited workflow automation capabilities
   - No way to extend provider capabilities without code changes

3. **Missing Fast Code Editing**: No support for Morph Fast Apply
   - Large refactoring tasks are slow with traditional string replacement
   - Cannot leverage 4,500+ tokens/sec editing speeds
   - Inefficient for multi-file transformations

4. **Cost Optimization Gaps**: Missing potentially cheaper alternatives
   - Z.AI pricing unknown but likely competitive
   - Cannot A/B test cost-effectiveness across more providers
   - Reduced ability to optimize AI spend

### 2.2 User Pain Points

**Agent Developers**:
- "I want to use GLM 4.6 for backend tasks to save costs"
- "I need MCP tools to integrate with Linear/GitHub in my workflows"
- "Large refactoring tasks are too slow with current providers"

**AutomatosX Platform Users**:
- "I want more provider choices for redundancy and cost optimization"
- "I need faster code editing capabilities for large codebases"
- "I want to try Z.AI's models but can't use them with AutomatosX"

**Enterprise Users**:
- "We need multi-provider redundancy for production reliability"
- "Cost per AI interaction is critical - more options help us optimize"
- "We want to integrate internal MCP servers for custom tooling"

### 2.3 Market Opportunity

- **Competitive Advantage**: First-to-market with GLM 4.6 integration in orchestration platforms
- **Cost Leadership**: Enable users to discover most cost-effective provider combinations
- **Extensibility**: MCP support future-proofs AutomatosX for new tool integrations
- **Developer Experience**: Unified interface across 4+ providers reduces vendor lock-in

---

## 3. Goals & Non-Goals

### 3.1 Goals

**Primary Goals** (Must-Have for v8.3.0):
1. ✅ **Grok Provider Implementation**: Functional GrokProvider extending BaseProvider
2. ✅ **Z.AI GLM 4.6 Support**: Working integration with Z.AI's API endpoint
3. ✅ **CLI Availability Detection**: Proper `checkCLIAvailable()` implementation
4. ✅ **Configuration Schema**: Full config support in `automatosx.config.json`
5. ✅ **Provider Whitelist**: Add 'grok' to BaseProvider.ALLOWED_PROVIDER_NAMES
6. ✅ **Documentation**: Setup guide, API reference, integration examples
7. ✅ **Testing**: Unit tests (mocked), integration tests (requires API key)

**Secondary Goals** (Nice-to-Have for v8.3.0):
1. 🟡 **Model Selection Support**: CLI arg for model override (--model glm-4.6)
2. 🟡 **MCP Tools Integration**: Expose MCP server configuration in AutomatosX config
3. 🟡 **Headless Mode**: Leverage `--prompt` flag for single-shot execution
4. 🟡 **Metadata Registry**: Add pricing/latency data when available
5. 🟡 **Trace Logging**: Grok-specific routing decisions in JSONL logs

**Stretch Goals** (Future Releases):
1. ⭐ **Morph Fast Apply**: Integration with Morph API for high-speed editing
2. ⭐ **Streaming Support**: Real-time token streaming from Grok CLI
3. ⭐ **Custom Instructions**: Project-level `.grok/GROK.md` templating
4. ⭐ **Advanced MCP**: stdio/HTTP/SSE transport protocol support
5. ⭐ **Cost Tracking**: Actual usage-based cost metrics (requires API access)

### 3.2 Non-Goals

**Explicitly Out of Scope**:
1. ❌ **Replacing Existing Providers**: Claude/Gemini/OpenAI remain first-class
2. ❌ **Breaking Changes**: No modifications to BaseProvider interface
3. ❌ **SDK Mode**: Grok is CLI-only (no direct API SDK integration)
4. ❌ **Backward Incompatibility**: Existing configs must work without changes
5. ❌ **Complex MCP Orchestration**: Basic MCP support only (advanced features later)
6. ❌ **Grok-Specific Features**: No special-casing beyond standard provider interface
7. ❌ **Performance Tuning**: No optimization beyond standard CLI execution patterns

---

## 4. User Stories

### 4.1 Agent Developer Stories

**Story 1: Using GLM 4.6 for Backend Tasks**
```
As an agent developer
I want to configure my backend agent to use GLM 4.6
So that I can reduce AI costs for large code generation tasks

Acceptance Criteria:
- I can set "grok" as a provider in automatosx.config.json
- I can specify Z.AI base URL and API key in environment variables
- Backend agent successfully executes tasks using GLM 4.6
- Results are equivalent in quality to Claude/Gemini
```

**Story 2: Multi-Provider Fallback with Grok**
```
As an agent developer
I want Grok to be a fallback provider when Claude is unavailable
So that my workflows remain resilient to provider outages

Acceptance Criteria:
- Router attempts Claude (priority 1), then Grok (priority 2)
- Automatic failover occurs within 5 seconds
- Trace logs show routing decision rationale
- No data loss or task failures during provider switch
```

**Story 3: MCP Tools for GitHub Integration**
```
As an agent developer
I want to configure GitHub MCP tools for my Grok provider
So that my agents can create issues and PRs automatically

Acceptance Criteria (Stretch Goal):
- I can add MCP server config to .grok/settings.json
- Grok CLI loads MCP tools on execution
- Agent can use GitHub tools in natural language prompts
- Tool usage is logged in AutomatosX trace logs
```

### 4.2 Platform User Stories

**Story 4: Cost Comparison Across Providers**
```
As a platform user
I want to compare costs between Claude, Gemini, and Grok
So that I can optimize my AI spend

Acceptance Criteria:
- ax providers list shows pricing data for Grok (when available)
- Trace logs include cost estimates per request
- Monthly usage reports include Grok breakdown
- I can filter logs by provider for cost analysis
```

**Story 5: Easy Grok Setup**
```
As a new AutomatosX user
I want to set up Grok provider in under 5 minutes
So that I can start using GLM 4.6 quickly

Acceptance Criteria:
- Documentation provides clear step-by-step setup guide
- ax doctor grok validates my configuration
- Error messages are actionable (e.g., "GROK_API_KEY not set")
- Setup requires ≤ 5 commands (install, config, env vars)
```

### 4.3 Enterprise User Stories

**Story 6: Multi-Provider Redundancy**
```
As an enterprise administrator
I want to configure Grok as a redundant provider
So that my production workflows have 99.9% uptime

Acceptance Criteria:
- I can set Grok priority equal to other providers
- Circuit breaker isolates failed Grok instances
- Health checks run every 60 seconds
- Provider recovery is automatic after cooldown period
```

**Story 7: Custom Z.AI Endpoint**
```
As an enterprise administrator
I want to use our internal Z.AI proxy endpoint
So that all AI traffic goes through our security gateway

Acceptance Criteria:
- I can override GROK_BASE_URL in config
- Custom endpoints work with GLM 4.6 model flag
- TLS certificate validation is configurable
- Logs include actual endpoint used per request
```

---

## 5. Technical Architecture

### 5.1 System Overview

**Component Diagram**:
```
┌─────────────────────────────────────────────────────────────┐
│                    AutomatosX v8.3.0                        │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │              Router (src/core/router.ts)            │   │
│  │  - Provider priority sorting                        │   │
│  │  - Health-based routing                             │   │
│  │  - Circuit breaker failover                         │   │
│  │  - Trace logging (JSONL)                            │   │
│  └─────────────┬──────────────────────────────────────┘   │
│                │                                            │
│                ▼                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │      Provider Orchestration Layer                   │  │
│  ├─────────────┬───────────┬───────────┬──────────────┤  │
│  │             │           │           │              │  │
│  │  Claude     │  Gemini   │  OpenAI   │  Grok (NEW)  │  │
│  │  Provider   │  Provider │  Provider │  Provider    │  │
│  │             │           │           │              │  │
│  └─────────────┴───────────┴───────────┴──────────────┘  │
│                                           │                │
│                                           ▼                │
│  ┌────────────────────────────────────────────────────┐   │
│  │         GrokProvider (Pure CLI Wrapper)            │   │
│  │  - executeCLI(prompt): grok --prompt "..." --model  │   │
│  │  - checkCLIAvailable(): findOnPath('grok')         │   │
│  │  - escapeShellArg(prompt): Security sanitization   │   │
│  │  - handleError(error): Standard error mapping      │   │
│  └───────────────────┬────────────────────────────────┘   │
│                      │                                     │
└──────────────────────┼─────────────────────────────────────┘
                       │
                       ▼
    ┌──────────────────────────────────────────────┐
    │       Grok CLI (External Process)            │
    │                                              │
    │  ┌────────────┐    ┌────────────────────┐   │
    │  │  X.AI API  │ OR │  Z.AI GLM 4.6 API  │   │
    │  │  (default) │    │  (custom base URL) │   │
    │  └────────────┘    └────────────────────┘   │
    │                                              │
    │  Optional: MCP Tools (Linear, GitHub, etc.) │
    │  Optional: Morph Fast Apply                 │
    └──────────────────────────────────────────────┘
```

### 5.2 Class Design

**GrokProvider Class** (src/providers/grok-provider.ts):

```typescript
/**
 * GrokProvider - Pure CLI Wrapper for Grok CLI (v8.3.0)
 *
 * Supports:
 * - X.AI Grok models (grok-4-latest, grok-code-fast-1, etc.)
 * - Z.AI GLM models (glm-4.6)
 * - Custom OpenAI-compatible endpoints
 * - Model selection via --model flag
 * - Headless single-prompt execution
 *
 * Configuration:
 * - GROK_API_KEY: API key (required)
 * - GROK_BASE_URL: API endpoint (default: https://api.x.ai/v1)
 * - automatosx.config.json: Provider timeout, priority, health checks
 */

import { BaseProvider } from './base-provider.js';
import type { ProviderConfig } from '../types/provider.js';
import { logger } from '../utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { findOnPath } from '../core/cli-provider-detector.js';

const execAsync = promisify(exec);

export class GrokProvider extends BaseProvider {
  private defaultModel: string;

  constructor(config: ProviderConfig) {
    super(config);
    // Model can be overridden via config or env var
    this.defaultModel = config.model || process.env.GROK_MODEL || 'grok-code-fast-1';
  }

  /**
   * Execute: grok --prompt "..." --model "glm-4.6"
   */
  protected async executeCLI(prompt: string): Promise<string> {
    // Mock mode for tests
    if (process.env.AUTOMATOSX_MOCK_PROVIDERS === 'true') {
      logger.debug('Using mock Grok provider');
      return `[Mock Grok Response]\n\nModel: ${this.defaultModel}\nReceived: ${prompt.substring(0, 100)}...\n\nThis is a mock response.`;
    }

    try {
      // Escape prompt for shell safety
      const escapedPrompt = this.escapeShellArg(prompt);

      logger.debug('Executing Grok CLI', {
        command: 'grok',
        model: this.defaultModel,
        promptLength: prompt.length
      });

      // Build command with optional model override
      const command = `grok --prompt "${escapedPrompt}" --model "${this.defaultModel}"`;

      // Execute CLI command
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.timeout || 120000, // 2 min default
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        env: { ...process.env } // Inherit GROK_API_KEY, GROK_BASE_URL
      });

      if (stderr && !stdout) {
        throw new Error(`Grok CLI error: ${stderr}`);
      }

      const result = stdout.trim();

      logger.debug('Grok CLI execution successful', {
        model: this.defaultModel,
        responseLength: result.length
      });

      return result;
    } catch (error) {
      logger.error('Grok CLI execution failed', {
        model: this.defaultModel,
        error: error instanceof Error ? error.message : String(error)
      });
      throw this.handleError(error);
    }
  }

  /**
   * Check if grok CLI is available on PATH
   */
  protected async checkCLIAvailable(): Promise<boolean> {
    try {
      const path = await findOnPath('grok');
      const available = path !== null;

      logger.debug('Grok CLI availability check', {
        available,
        path: path || 'not found'
      });

      return available;
    } catch (error) {
      logger.debug('Grok CLI availability check failed', { error });
      return false;
    }
  }

  /**
   * Get current model (useful for logging/debugging)
   */
  getModel(): string {
    return this.defaultModel;
  }

  /**
   * Override model for specific requests
   */
  setModel(model: string): void {
    this.defaultModel = model;
    logger.debug('Grok model changed', { newModel: model });
  }
}
```

### 5.3 Configuration Integration (v1.1 Update - YAML-based)

**NEW: YAML Configuration File** (`.automatosx/providers/grok.yaml`):

```yaml
# Grok Provider Configuration
# Location: .automatosx/providers/grok.yaml

provider:
  name: grok
  enabled: true

  # Z.AI GLM 4.6 Configuration (recommended)
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}  # Reference env var or use direct value
  model: glm-4.6

  # Alternative: X.AI Grok Models
  # baseUrl: https://api.x.ai/v1
  # model: grok-4-latest  # or grok-code-fast-1, grok-3-latest, etc.

  # Performance & Reliability
  timeout: 2700000  # 45 minutes
  priority: 4       # Routing priority (lower = higher priority)

  # Health Monitoring
  healthCheck:
    enabled: true
    interval: 300000   # 5 minutes
    timeout: 5000      # 5 seconds

  # Circuit Breaker (failover protection)
  circuitBreaker:
    enabled: true
    failureThreshold: 3
    recoveryTimeout: 60000  # 1 minute

  # Process Management
  processManagement:
    gracefulShutdownTimeout: 5000
    forceKillDelay: 1000

  # Version Detection
  versionDetection:
    timeout: 5000
    forceKillDelay: 1000
    cacheEnabled: true

  # Usage Limit Tracking
  limitTracking:
    enabled: true
    window: daily
    resetHourUtc: 0

# Optional: MCP Tools Configuration (future enhancement)
mcp:
  enabled: false
  servers:
    linear:
      transport: stdio
      command: npx
      args: ["-y", "@linear/mcp-server"]
      env:
        LINEAR_API_KEY: ${LINEAR_API_KEY}

    github:
      transport: stdio
      command: npx
      args: ["-y", "@github/mcp-server"]
      env:
        GITHUB_TOKEN: ${GITHUB_TOKEN}

# Optional: Morph Fast Apply (future enhancement)
morph:
  enabled: false
  apiKey: ${MORPH_API_KEY}
  maxTokensPerSecond: 4500
```

**Backward Compatibility: automatosx.config.json** (still supported):

```json
{
  "providers": {
    "grok": {
      "enabled": true,
      "priority": 4,
      "timeout": 2700000,
      "command": "grok",
      "model": "glm-4.6",
      "configFile": ".automatosx/providers/grok.yaml"  // Reference to YAML
    }
  }
}
```

**Configuration Loading Priority**:
1. `.automatosx/providers/grok.yaml` (highest priority - new in v8.3.0)
2. `automatosx.config.json` providers.grok section
3. Environment variables (GROK_API_KEY, GROK_BASE_URL, GROK_MODEL)
4. Default values

### 5.4 Environment Variables (Legacy Support)

**For API Keys** (recommended approach):
- `GROK_API_KEY`: API key (referenced via `${GROK_API_KEY}` in YAML)

**Optional Environment Variables** (backward compatibility):
- `GROK_BASE_URL`: API endpoint (overridden by YAML config)
- `GROK_MODEL`: Default model override (overridden by YAML config)
- `AUTOMATOSX_MOCK_PROVIDERS`: Enable mock mode for testing

**Setup Example** (Z.AI GLM 4.6 with YAML):
```bash
# 1. Install Grok CLI
npm install -g @vibe-kit/grok-cli

# 2. Set API key (referenced in YAML)
export GROK_API_KEY="your-z-ai-api-key"
echo 'export GROK_API_KEY="your-z-ai-api-key"' >> ~/.zshrc

# 3. Create YAML config file
mkdir -p .automatosx/providers
cat > .automatosx/providers/grok.yaml << 'EOF'
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}
  model: glm-4.6
  priority: 4
  timeout: 2700000
EOF

# 4. Verify configuration
cat .automatosx/providers/grok.yaml

# 5. Test Grok CLI
grok --model glm-4.6 --prompt "What is 2+2?"
```

### 5.5 Security Considerations

**Provider Name Whitelist** (CRITICAL):
```typescript
// src/providers/base-provider.ts
private static readonly ALLOWED_PROVIDER_NAMES = [
  'claude',
  'gemini',
  'codex',
  'grok',        // ADD THIS
  'test-provider'
] as const;
```

**Shell Argument Escaping**:
- Use `this.escapeShellArg(prompt)` from BaseProvider
- Prevents command injection via malicious prompts
- Same pattern as Claude/Gemini providers

**API Key Security**:
- Environment variables only (never hardcode)
- Validate presence before execution
- Clear error messages: "GROK_API_KEY not set"

**Process Timeout**:
- Default: 2700000ms (45 min) for large tasks
- Configurable per-provider
- Prevents hung processes from blocking orchestration

---

## 6. Implementation Plan

### 6.1 Phase 1: Core Provider Implementation (Week 1)

**Tasks**:
1. **Provider Class** (2 days)
   - [ ] Create `src/providers/grok-provider.ts`
   - [ ] Implement `executeCLI(prompt)` method
   - [ ] Implement `checkCLIAvailable()` method
   - [ ] Add model selection support
   - [ ] Add mock mode for testing

2. **Security Updates** (1 day)
   - [ ] Add 'grok' to `ALLOWED_PROVIDER_NAMES` whitelist
   - [ ] Verify shell escaping works with Grok CLI
   - [ ] Add environment variable validation

3. **Configuration Schema** (1 day)
   - [ ] Update `automatosx.config.json` schema
   - [ ] Add Grok provider defaults
   - [ ] Update TypeScript types in `src/types/provider.ts`

4. **CLI Integration** (1 day)
   - [ ] Update `src/cli/commands/run.ts` to instantiate GrokProvider
   - [ ] Update `src/cli/commands/status.ts` for Grok health checks
   - [ ] Update `src/cli/commands/providers.ts` for Grok metadata

**Deliverables**:
- ✅ Functional GrokProvider class
- ✅ Configuration schema updates
- ✅ CLI command integration
- ✅ Security whitelist updated

### 6.2 Phase 2: Testing & Validation (Week 2)

**Tasks**:
1. **Unit Tests** (2 days)
   - [ ] Create `tests/unit/grok-provider.test.ts`
   - [ ] Test mock mode execution
   - [ ] Test CLI availability detection
   - [ ] Test model selection/override
   - [ ] Test error handling and retries

2. **Integration Tests** (2 days)
   - [ ] Create `tests/integration/grok-provider.test.ts`
   - [ ] Test X.AI Grok models (requires API key)
   - [ ] Test Z.AI GLM 4.6 (requires API key)
   - [ ] Test multi-provider fallback (Grok as backup)
   - [ ] Test health checks and circuit breaker

3. **CLI Testing** (1 day)
   - [ ] Test `ax run backend "task" --provider grok`
   - [ ] Test `ax providers list` shows Grok
   - [ ] Test `ax doctor grok` validates setup
   - [ ] Test trace logging for Grok requests

**Deliverables**:
- ✅ 95%+ test coverage for GrokProvider
- ✅ Integration tests passing (with API keys)
- ✅ CLI commands working end-to-end

### 6.3 Phase 3: Documentation & Examples (Week 3)

**Tasks**:
1. **User Documentation** (2 days)
   - [ ] Create `docs/providers/grok.md` setup guide
   - [ ] Update `README.md` with Grok section
   - [ ] Update `CLAUDE.md` with provider patterns
   - [ ] Add troubleshooting section

2. **Code Examples** (1 day)
   - [ ] Create `examples/grok-glm-4.6-setup.md`
   - [ ] Create `examples/grok-mcp-tools.md` (stretch goal)
   - [ ] Add config examples to docs

3. **API Reference** (1 day)
   - [ ] Document GrokProvider public API
   - [ ] Document configuration options
   - [ ] Document environment variables

4. **Migration Guide** (1 day)
   - [ ] Create upgrade guide for v8.2.0 → v8.3.0
   - [ ] Document Grok-specific considerations
   - [ ] Provide rollback instructions

**Deliverables**:
- ✅ Comprehensive provider documentation
- ✅ Code examples and tutorials
- ✅ API reference complete
- ✅ Migration guide published

### 6.4 Phase 4: Advanced Features (Week 4+) [Optional]

**Tasks** (Stretch Goals):
1. **MCP Tools Support** (3 days)
   - [ ] Research Grok CLI MCP configuration
   - [ ] Design AutomatosX → Grok MCP bridge
   - [ ] Implement MCP server config in `automatosx.config.json`
   - [ ] Add Linear/GitHub MCP examples

2. **Morph Fast Apply** (3 days)
   - [ ] Research Morph API integration
   - [ ] Design fast code editing interface
   - [ ] Implement Morph API key handling
   - [ ] Benchmark performance gains

3. **Streaming Support** (2 days)
   - [ ] Investigate Grok CLI streaming capabilities
   - [ ] Implement streaming response parser
   - [ ] Add `--streaming` flag to `ax run` command

**Deliverables** (Optional):
- 🟡 MCP tools working with Linear integration
- 🟡 Morph Fast Apply benchmarked (4,500+ tokens/sec)
- 🟡 Streaming responses in real-time

### 6.5 Timeline Summary

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1**: Core Implementation | 5 days | GrokProvider class, config, CLI integration |
| **Phase 2**: Testing | 5 days | Unit tests, integration tests, CLI tests |
| **Phase 3**: Documentation | 5 days | User docs, API reference, examples |
| **Phase 4**: Advanced Features | 8+ days | MCP, Morph, streaming (optional) |
| **Total (MVP)** | **15 days** | Production-ready Grok provider |
| **Total (Full)** | **23+ days** | All stretch goals completed |

---

## 7. API & Interface Design

### 7.1 Public API

**GrokProvider Constructor**:
```typescript
interface ProviderConfig {
  name: string;           // Must be 'grok'
  enabled: boolean;       // Enable/disable provider
  priority: number;       // Routing priority (lower = higher)
  timeout: number;        // Execution timeout (ms)
  command: string;        // CLI command ('grok')
  model?: string;         // Default model (e.g., 'glm-4.6')
  // ... standard provider config
}

const provider = new GrokProvider({
  name: 'grok',
  enabled: true,
  priority: 4,
  timeout: 2700000,
  command: 'grok',
  model: 'glm-4.6'
});
```

**GrokProvider Methods**:
```typescript
class GrokProvider extends BaseProvider {
  // Inherited from BaseProvider
  getName(): string;
  execute(request: ExecutionRequest): Promise<ExecutionResponse>;
  isAvailable(): Promise<boolean>;
  getHealth(): HealthStatus;

  // Grok-specific methods
  getModel(): string;          // Get current model
  setModel(model: string): void; // Override model
}
```

### 7.2 CLI Commands

**Provider Selection**:
```bash
# Use Grok by default (priority-based routing)
ax run backend "implement user auth"

# Force Grok provider explicitly
ax run backend "implement user auth" --provider grok

# Override model for single request
GROK_MODEL=grok-4-latest ax run backend "task"
```

**Provider Management**:
```bash
# List all providers (including Grok)
ax providers list

# Show Grok provider details
ax providers show grok

# View Grok routing decisions
ax providers trace --provider grok --follow

# Check Grok setup
ax doctor grok
```

**Configuration**:
```bash
# Initialize AutomatosX with Grok
ax setup

# View current configuration
ax config show

# Enable Grok provider
ax config set providers.grok.enabled true

# Set Grok priority
ax config set providers.grok.priority 2
```

### 7.3 Configuration API

**JSON Schema** (automatosx.config.json):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "providers": {
      "type": "object",
      "properties": {
        "grok": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "priority": { "type": "number", "default": 4 },
            "timeout": { "type": "number", "default": 2700000 },
            "command": { "type": "string", "default": "grok" },
            "model": { "type": "string", "enum": [
              "glm-4.6",
              "grok-4-latest",
              "grok-code-fast-1",
              "grok-3-latest",
              "grok-3-fast",
              "grok-3-mini-fast"
            ]},
            "healthCheck": {
              "type": "object",
              "properties": {
                "enabled": { "type": "boolean", "default": true },
                "interval": { "type": "number", "default": 300000 },
                "timeout": { "type": "number", "default": 5000 }
              }
            },
            "circuitBreaker": {
              "type": "object",
              "properties": {
                "enabled": { "type": "boolean", "default": true },
                "failureThreshold": { "type": "number", "default": 3 },
                "recoveryTimeout": { "type": "number", "default": 60000 }
              }
            }
          }
        }
      }
    }
  }
}
```

---

## 8. Configuration Schema (v1.1 Update - YAML-based)

### 8.1 YAML Configuration File (Recommended)

**Location**: `.automatosx/providers/grok.yaml`

**Full YAML Configuration Example**:
```yaml
# Grok Provider Configuration for AutomatosX
# This file configures the Grok CLI provider with Z.AI GLM 4.6 backend

provider:
  name: grok
  enabled: true

  # API Configuration
  baseUrl: https://api.z.ai/api/coding/paas/v4  # Z.AI endpoint
  apiKey: ${GROK_API_KEY}  # Reference environment variable
  model: glm-4.6            # Default model

  # Alternative configurations (comment/uncomment as needed):
  # X.AI Grok Configuration:
  # baseUrl: https://api.x.ai/v1
  # model: grok-4-latest

  # Routing & Performance
  priority: 4              # Lower = higher priority (1-10)
  timeout: 2700000         # 45 minutes in milliseconds
  command: grok            # CLI command name

  # Health Monitoring
  healthCheck:
    enabled: true
    interval: 300000       # Check every 5 minutes
    timeout: 5000          # 5 second timeout

  # Circuit Breaker (Failover Protection)
  circuitBreaker:
    enabled: true
    failureThreshold: 3    # Open circuit after 3 failures
    recoveryTimeout: 60000 # Wait 1 minute before retry

  # Process Management
  processManagement:
    gracefulShutdownTimeout: 5000
    forceKillDelay: 1000

  # Version Detection & Caching
  versionDetection:
    timeout: 5000
    forceKillDelay: 1000
    cacheEnabled: true

  # Usage Tracking
  limitTracking:
    enabled: true
    window: daily           # daily, weekly, monthly
    resetHourUtc: 0         # Reset at midnight UTC

# Advanced Features (Optional - Future Enhancements)

# MCP Tools Integration
mcp:
  enabled: false
  servers:
    # Linear Integration
    linear:
      transport: stdio
      command: npx
      args: ["-y", "@linear/mcp-server"]
      env:
        LINEAR_API_KEY: ${LINEAR_API_KEY}

    # GitHub Integration
    github:
      transport: stdio
      command: npx
      args: ["-y", "@github/mcp-server"]
      env:
        GITHUB_TOKEN: ${GITHUB_TOKEN}

    # Custom MCP Server
    custom:
      transport: http
      url: http://localhost:3000/mcp
      headers:
        Authorization: Bearer ${CUSTOM_MCP_TOKEN}

# Morph Fast Apply (High-Speed Code Editing)
morph:
  enabled: false
  apiKey: ${MORPH_API_KEY}
  maxTokensPerSecond: 4500
  fallbackToStandard: true  # Use standard editing if Morph unavailable

# Model-Specific Overrides
models:
  glm-4.6:
    maxTokens: 8192
    temperature: 0.7
    topP: 0.95

  grok-4-latest:
    maxTokens: 32768
    temperature: 0.8
    topP: 0.9

# Development & Testing
development:
  mockMode: false          # Enable mock responses for testing
  logRequests: true        # Log all API requests
  logResponses: false      # Log API responses (verbose)
```

### 8.2 Backward Compatible JSON Configuration

**automatosx.config.json** (with Grok - legacy approach):
```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 1,
      "timeout": 2700000,
      "command": "codex"
    },
    "gemini-cli": {
      "enabled": true,
      "priority": 2,
      "timeout": 2700000,
      "command": "gemini"
    },
    "claude-code": {
      "enabled": true,
      "priority": 3,
      "timeout": 2700000,
      "command": "claude"
    },
    "grok": {
      "enabled": true,
      "priority": 4,
      "timeout": 2700000,
      "command": "grok",
      "configFile": ".automatosx/providers/grok.yaml"
    }
  }
}
```

**Note**: If `configFile` is specified, YAML configuration takes precedence over JSON settings.

### 8.3 Environment Variables Reference (v1.1 Update)

| Variable | Required | Default | Description | YAML Reference |
|----------|----------|---------|-------------|----------------|
| `GROK_API_KEY` | ✅ Yes | - | API key (X.AI or Z.AI) | `${GROK_API_KEY}` in YAML |
| `GROK_BASE_URL` | ❌ No | `https://api.x.ai/v1` | API endpoint (legacy) | Prefer YAML `baseUrl` |
| `GROK_MODEL` | ❌ No | `grok-code-fast-1` | Default model (legacy) | Prefer YAML `model` |
| `LINEAR_API_KEY` | ❌ No | - | Linear MCP server auth | `${LINEAR_API_KEY}` |
| `GITHUB_TOKEN` | ❌ No | - | GitHub MCP server auth | `${GITHUB_TOKEN}` |
| `MORPH_API_KEY` | ❌ No | - | Morph Fast Apply auth | `${MORPH_API_KEY}` |
| `AUTOMATOSX_MOCK_PROVIDERS` | ❌ No | `false` | Enable mock mode | Global setting |

### 8.4 Configuration Loading Priority (v1.1)

AutomatosX loads Grok configuration in the following order (first match wins):

1. **YAML File** (`.automatosx/providers/grok.yaml`) - **HIGHEST PRIORITY**
   - Explicit, version-controlled, multi-environment support
   - Supports environment variable interpolation (`${VAR_NAME}`)

2. **JSON File** (`automatosx.config.json` → `providers.grok`)
   - Backward compatibility with existing setups
   - Can reference YAML via `configFile` property

3. **Environment Variables** (`GROK_*`)
   - Legacy support for v8.2.0 and earlier
   - Useful for CI/CD, Docker, and quick overrides

4. **Defaults** (hardcoded in GrokProvider class)
   - `baseUrl`: `https://api.x.ai/v1`
   - `model`: `grok-code-fast-1`
   - `priority`: 10 (lowest)

**Best Practice**: Use YAML for all configuration, environment variables only for secrets.

### 8.3 Provider Priority Strategy

**Recommended Priority Order**:

| Provider | Priority | Use Case | Rationale |
|----------|----------|----------|-----------|
| OpenAI | 1 | General tasks | Highest reliability, best docs |
| Gemini | 2 | Cost optimization | Free tier, fast responses |
| Claude | 3 | Complex reasoning | Best quality, slower/expensive |
| Grok (GLM 4.6) | 4 | Experimental/cost-savings | New provider, unproven reliability |

**Alternative: Cost-First Strategy**:
1. Gemini (free tier)
2. Grok GLM 4.6 (likely cheaper)
3. OpenAI (moderate cost)
4. Claude (premium)

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Test File**: `tests/unit/grok-provider.test.ts`

**Test Cases**:
```typescript
describe('GrokProvider', () => {
  describe('Constructor', () => {
    it('should initialize with default model', () => {
      const provider = new GrokProvider(config);
      expect(provider.getModel()).toBe('grok-code-fast-1');
    });

    it('should accept custom model in config', () => {
      const provider = new GrokProvider({ ...config, model: 'glm-4.6' });
      expect(provider.getModel()).toBe('glm-4.6');
    });

    it('should throw if provider name is not "grok"', () => {
      expect(() => new GrokProvider({ ...config, name: 'invalid' }))
        .toThrow('Invalid provider name');
    });
  });

  describe('executeCLI', () => {
    it('should execute grok command with escaped prompt', async () => {
      const provider = new GrokProvider(config);
      const result = await provider.execute({ prompt: 'test prompt' });
      expect(result.content).toContain('Mock Grok Response');
    });

    it('should include model flag in CLI command', async () => {
      const provider = new GrokProvider({ ...config, model: 'glm-4.6' });
      // Spy on execAsync to verify command
      // Expect: grok --prompt "..." --model "glm-4.6"
    });

    it('should handle CLI errors gracefully', async () => {
      // Mock execAsync to throw
      await expect(provider.execute({ prompt: 'test' }))
        .rejects.toThrow(ProviderError);
    });

    it('should respect timeout configuration', async () => {
      const provider = new GrokProvider({ ...config, timeout: 5000 });
      // Mock slow CLI response
      // Expect timeout after 5000ms
    });
  });

  describe('checkCLIAvailable', () => {
    it('should return true if grok is on PATH', async () => {
      // Mock findOnPath to return valid path
      const available = await provider.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false if grok is not installed', async () => {
      // Mock findOnPath to return null
      const available = await provider.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('Model Selection', () => {
    it('should allow model override at runtime', () => {
      provider.setModel('grok-4-latest');
      expect(provider.getModel()).toBe('grok-4-latest');
    });

    it('should respect GROK_MODEL env var', () => {
      process.env.GROK_MODEL = 'glm-4.6';
      const provider = new GrokProvider(config);
      expect(provider.getModel()).toBe('glm-4.6');
    });
  });
});
```

**Coverage Target**: ≥ 95% for GrokProvider class

### 9.2 Integration Tests

**Test File**: `tests/integration/grok-provider.test.ts`

**Prerequisites**:
- `GROK_API_KEY` set in environment
- `grok` CLI installed globally
- Valid X.AI or Z.AI account

**Test Cases**:
```typescript
describe('GrokProvider Integration', () => {
  beforeAll(() => {
    // Verify GROK_API_KEY is set
    if (!process.env.GROK_API_KEY) {
      console.warn('Skipping integration tests - GROK_API_KEY not set');
      return;
    }
  });

  describe('X.AI Grok Models', () => {
    it('should execute task with grok-code-fast-1', async () => {
      const provider = new GrokProvider({ ...config, model: 'grok-code-fast-1' });
      const result = await provider.execute({ prompt: 'What is 2+2?' });
      expect(result.content).toMatch(/4|four/i);
    });

    it('should execute task with grok-4-latest', async () => {
      const provider = new GrokProvider({ ...config, model: 'grok-4-latest' });
      const result = await provider.execute({ prompt: 'Write a hello world function' });
      expect(result.content).toContain('function');
    });
  });

  describe('Z.AI GLM 4.6', () => {
    it('should execute task with GLM 4.6', async () => {
      process.env.GROK_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';
      const provider = new GrokProvider({ ...config, model: 'glm-4.6' });
      const result = await provider.execute({ prompt: 'Generate a simple REST API' });
      expect(result.content).toContain('app.get');
    });

    it('should handle thinking mode output', async () => {
      // GLM 4.6 has limited thinking mode compatibility
      const result = await provider.execute({ prompt: 'Complex reasoning task' });
      // Verify thinking content is included (not filtered)
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Provider Fallback', () => {
    it('should fallback to Grok when Claude fails', async () => {
      const router = new Router({
        providers: [
          new ClaudeProvider({ ...config, enabled: false }), // Disabled
          new GrokProvider(config) // Fallback
        ],
        fallbackEnabled: true
      });

      const result = await router.execute({ prompt: 'test' });
      expect(result.content).toContain('Grok'); // Grok handled request
    });
  });

  describe('Health Checks', () => {
    it('should report healthy status when CLI is available', async () => {
      const provider = new GrokProvider(config);
      await provider.isAvailable();
      const health = provider.getHealth();
      expect(health.available).toBe(true);
      expect(health.consecutiveFailures).toBe(0);
    });
  });
});
```

**Execution**:
```bash
# Run integration tests with API key
GROK_API_KEY=your-key npm run test:integration

# Skip if no API key
SKIP_INTEGRATION_TESTS=true npm test
```

### 9.3 CLI Tests

**Manual Test Script** (`tests/smoke/grok-provider.sh`):
```bash
#!/bin/bash
set -e

echo "🧪 Grok Provider Smoke Tests"
echo "=============================="

# 1. Check installation
echo "1. Checking Grok CLI installation..."
if ! command -v grok &> /dev/null; then
  echo "❌ grok CLI not found"
  exit 1
fi
echo "✅ grok CLI installed: $(grok --version)"

# 2. Check environment variables
echo "2. Checking environment variables..."
if [ -z "$GROK_API_KEY" ]; then
  echo "❌ GROK_API_KEY not set"
  exit 1
fi
echo "✅ GROK_API_KEY is set"

# 3. Test provider listing
echo "3. Testing 'ax providers list'..."
if ! ax providers list | grep -q "grok"; then
  echo "❌ Grok not in provider list"
  exit 1
fi
echo "✅ Grok listed in providers"

# 4. Test simple execution
echo "4. Testing 'ax run backend' with Grok..."
result=$(ax run backend "What is 2+2?" --provider grok --format json)
if [ -z "$result" ]; then
  echo "❌ Grok execution failed"
  exit 1
fi
echo "✅ Grok execution successful"

# 5. Test health check
echo "5. Testing 'ax doctor grok'..."
if ! ax doctor grok; then
  echo "❌ Grok health check failed"
  exit 1
fi
echo "✅ Grok health check passed"

echo ""
echo "🎉 All smoke tests passed!"
```

**Execution**:
```bash
chmod +x tests/smoke/grok-provider.sh
GROK_API_KEY=your-key ./tests/smoke/grok-provider.sh
```

---

## 10. Migration & Rollout

### 10.1 Version Compatibility

**Breaking Changes**: ❌ None

**Backward Compatibility**: ✅ Full
- Existing configs work without modification
- Grok is opt-in (disabled by default in fresh installs)
- No changes to BaseProvider interface

### 10.2 Migration Guide (v1.1 Update - YAML Configuration)

**For Existing Users** (v8.2.0 → v8.3.0):

**Option A: YAML Configuration (Recommended)**

```bash
# 1. Update AutomatosX
npm install -g @defai.digital/automatosx@8.3.0

# 2. Install Grok CLI
npm install -g @vibe-kit/grok-cli

# 3. Set API key (environment variable for secrets)
echo 'export GROK_API_KEY="your-z-ai-api-key"' >> ~/.zshrc
source ~/.zshrc

# 4. Create YAML configuration file
mkdir -p .automatosx/providers
cat > .automatosx/providers/grok.yaml << 'EOF'
provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}
  model: glm-4.6
  priority: 4
  timeout: 2700000

  healthCheck:
    enabled: true
    interval: 300000
    timeout: 5000

  circuitBreaker:
    enabled: true
    failureThreshold: 3
    recoveryTimeout: 60000
EOF

# 5. Verify YAML configuration
cat .automatosx/providers/grok.yaml

# 6. Verify setup
ax doctor grok

# 7. Test execution
ax run backend "Write a hello world function" --provider grok
```

**Option B: Legacy Environment Variables (Backward Compatible)**

```bash
# 1-2. Same as Option A

# 3. Configure environment variables (legacy)
echo 'export GROK_BASE_URL="https://api.z.ai/api/coding/paas/v4"' >> ~/.zshrc
echo 'export GROK_API_KEY="your-z-ai-api-key"' >> ~/.zshrc
source ~/.zshrc

# 4. Enable in JSON config
cat <<EOF >> automatosx.config.json
{
  "providers": {
    "grok": {
      "enabled": true,
      "priority": 4,
      "model": "glm-4.6"
    }
  }
}
EOF

# 5-7. Same as Option A
```

**Option C: Hybrid Approach (Best Practice for Teams)**

```bash
# 1-2. Same as Option A

# 3. Set API key in environment (not committed to git)
export GROK_API_KEY="your-z-ai-api-key"

# 4. Create YAML config (committed to git)
mkdir -p .automatosx/providers
cat > .automatosx/providers/grok.yaml << 'EOF'
# Team-wide Grok configuration
# Individual developers: Set GROK_API_KEY in your shell profile

provider:
  name: grok
  enabled: true
  baseUrl: https://api.z.ai/api/coding/paas/v4
  apiKey: ${GROK_API_KEY}  # Interpolates from environment
  model: glm-4.6
  priority: 4
  timeout: 2700000

  # Team defaults
  healthCheck:
    enabled: true
    interval: 300000

  circuitBreaker:
    enabled: true
    failureThreshold: 3
EOF

# 5. Add to .gitignore (if storing secrets in YAML)
echo '.automatosx/providers/*.local.yaml' >> .gitignore

# 6-7. Same as Option A
```

### 10.3 Rollout Strategy

**Phase 1: Beta Release** (Week 1)
- Release v8.3.0-beta.1 to early adopters
- Gather feedback on Grok integration
- Monitor error rates and performance

**Phase 2: Staged Rollout** (Week 2)
- Release v8.3.0 to npm with `@latest` tag
- Update documentation and examples
- Announce on GitHub, Twitter, Discord

**Phase 3: Adoption Monitoring** (Week 3-4)
- Track Grok provider usage via telemetry
- Monitor error rates and health checks
- Collect user feedback on GLM 4.6 quality

**Phase 4: Optimization** (Week 5+)
- Add pricing metadata (when available)
- Optimize routing strategies based on data
- Publish best practices guide

### 10.4 Rollback Plan

If critical issues arise:

1. **Disable Grok Provider**:
   ```bash
   ax config set providers.grok.enabled false
   ```

2. **Downgrade AutomatosX**:
   ```bash
   npm install -g @defai.digital/automatosx@8.2.0
   ```

3. **Restore Old Config**:
   - Grok config is ignored in v8.2.0 (no breaking changes)

---

## 11. Risks & Mitigations

### 11.1 Risk Matrix

| Risk | Probability | Impact | Severity | Mitigation |
|------|------------|--------|----------|------------|
| Z.AI API changes break integration | Medium | High | 🔴 Critical | Version pinning, integration tests |
| Grok CLI updates change command syntax | Low | High | 🟡 Medium | CLI version detection, fallback commands |
| GLM 4.6 pricing is too expensive | Medium | Medium | 🟡 Medium | Transparent cost tracking, user warnings |
| Security vulnerability in Grok CLI | Low | Critical | 🔴 Critical | Regular security audits, dependency updates |
| Poor response quality from GLM 4.6 | Medium | Medium | 🟡 Medium | Quality benchmarks, user feedback loop |
| Grok CLI performance slower than competitors | High | Low | 🟢 Low | Performance benchmarks, timeout tuning |

### 11.2 Mitigation Strategies

**1. API Stability Issues**
- **Mitigation**: Pin Grok CLI version in docs (e.g., `@vibe-kit/grok-cli@1.0.1`)
- **Monitoring**: Integration tests fail on API changes
- **Fallback**: Router automatically fails over to Claude/Gemini

**2. Command Syntax Changes**
- **Mitigation**: Version detection in `checkCLIAvailable()`
- **Handling**: Graceful degradation to older command syntax
- **Documentation**: Maintain compatibility matrix in docs

**3. Cost Overruns**
- **Mitigation**: Require explicit user opt-in for Grok
- **Transparency**: Log estimated costs in trace logs
- **Safeguards**: Add `maxCostPerRequest` config option (future)

**4. Security Vulnerabilities**
- **Mitigation**: Shell escaping via `escapeShellArg()`
- **Auditing**: Regular `npm audit` checks
- **Updates**: Monitor Grok CLI releases for security patches

**5. Quality Issues**
- **Mitigation**: Benchmarking suite comparing providers
- **Feedback**: User survey on GLM 4.6 quality
- **Routing**: Allow users to disable Grok if quality is poor

---

## 12. Success Metrics

### 12.1 Adoption Metrics

**Primary KPIs** (30 days post-launch):
- **Grok Enablement Rate**: ≥ 15% of active users enable Grok provider
- **Request Volume**: ≥ 5% of total AI requests routed to Grok
- **Retention**: ≥ 70% of users keep Grok enabled after 1 week

**Secondary KPIs**:
- **Setup Completion Time**: ≤ 5 minutes (median)
- **Error Rate**: ≤ 5% of Grok requests fail
- **Health Check Success**: ≥ 95% uptime

### 12.2 Quality Metrics

**Response Quality** (user surveys):
- **Satisfaction Score**: ≥ 4.0/5.0 for GLM 4.6 responses
- **Comparison to Claude**: Within 10% quality parity
- **Task Success Rate**: ≥ 85% of tasks complete successfully

**Performance Metrics**:
- **Latency**: p50 ≤ 2s, p99 ≤ 10s for simple queries
- **Throughput**: ≥ 10 requests/minute sustained
- **Availability**: ≥ 99.5% CLI availability

### 12.3 Cost Metrics

**Cost Optimization** (when pricing data available):
- **Cost per 1K Tokens**: Document GLM 4.6 vs. competitors
- **Cost Savings**: ≥ 20% savings for users switching from Claude to GLM 4.6
- **ROI**: Users save ≥ $50/month on AI costs

### 12.4 Developer Metrics

**Code Quality**:
- **Test Coverage**: ≥ 95% for GrokProvider
- **Build Success Rate**: ≥ 99% on CI/CD
- **Documentation Coverage**: 100% of public APIs documented

**Maintenance**:
- **Bug Count**: ≤ 2 critical bugs in first 30 days
- **Time to Fix**: ≤ 48 hours for critical issues
- **Community PRs**: ≥ 2 community contributions

---

## 13. Future Enhancements

### 13.1 MCP Tools Integration (v8.4.0)

**Goal**: Enable AutomatosX agents to use MCP servers via Grok CLI

**Features**:
- Configure MCP servers in `automatosx.config.json`
- Auto-generate `.grok/settings.json` from AutomatosX config
- Support stdio, HTTP, and SSE transports
- Built-in MCP servers: Linear, GitHub, Slack

**Example Config**:
```json
{
  "providers": {
    "grok": {
      "mcp": {
        "servers": {
          "linear": {
            "transport": "stdio",
            "command": "npx",
            "args": ["-y", "@linear/mcp-server"],
            "env": {
              "LINEAR_API_KEY": "${LINEAR_API_KEY}"
            }
          }
        }
      }
    }
  }
}
```

### 13.2 Morph Fast Apply (v8.5.0)

**Goal**: Leverage Morph API for ultra-fast code editing (4,500+ tokens/sec)

**Features**:
- Optional Morph API key configuration
- Automatic fallback to string replacement if unavailable
- Benchmark performance gains vs. standard editing
- Support for multi-file refactoring

**Configuration**:
```bash
export MORPH_API_KEY="your-morph-key"
```

**Usage**:
```bash
ax run backend "Refactor entire auth module to use JWT" --fast-apply
```

### 13.3 Streaming Responses (v8.6.0)

**Goal**: Real-time token streaming from Grok CLI

**Features**:
- Stream tokens as they arrive (vs. waiting for full response)
- Live progress updates in terminal
- Cancellable requests (Ctrl+C)
- Lower perceived latency

**Implementation**:
- Use `spawn()` instead of `exec()` for Grok CLI
- Parse stdout line-by-line
- Emit events for streaming consumers

### 13.4 Custom Instructions (v8.7.0)

**Goal**: Project-level `.grok/GROK.md` templating

**Features**:
- Generate `.grok/GROK.md` from AutomatosX agent profiles
- Auto-inject project context (stack, conventions, guidelines)
- Per-agent custom instructions
- Version control friendly

**Example**:
```markdown
# Project: MyApp
# Stack: Node.js, TypeScript, React, PostgreSQL
# Conventions: ESLint, Prettier, functional components

When generating code:
- Use TypeScript strict mode
- Prefer async/await over callbacks
- Use functional React components with hooks
```

### 13.5 Advanced Cost Tracking (v9.0.0)

**Goal**: Real-time cost tracking and budgeting

**Features**:
- Fetch live pricing from Z.AI/X.AI APIs
- Track costs per agent, session, and user
- Budget alerts (e.g., "You've spent $50 this month")
- Cost optimization recommendations

**Configuration**:
```json
{
  "costTracking": {
    "enabled": true,
    "budgets": {
      "monthly": 100.00,  // USD
      "perRequest": 0.50
    },
    "alerts": {
      "email": "user@example.com",
      "threshold": 0.8  // 80% of budget
    }
  }
}
```

---

## 14. Appendices

### Appendix A: Grok CLI Command Reference

**Basic Usage**:
```bash
# Interactive mode
grok

# Headless single-prompt
grok --prompt "What is the capital of France?"

# Custom model
grok --model glm-4.6 --prompt "Generate code"

# Custom directory
grok --directory /path/to/project --prompt "Analyze this project"

# Tool round limit
grok --max-tool-rounds 10 --prompt "Simple task"
```

**Environment Variables**:
```bash
GROK_API_KEY       # API key (required)
GROK_BASE_URL      # API endpoint (default: https://api.x.ai/v1)
GROK_MODEL         # Default model
```

**Configuration Files**:
```bash
~/.grok/user-settings.json    # User-level settings
.grok/settings.json           # Project-level settings
.grok/GROK.md                 # Project instructions
```

### Appendix B: Z.AI GLM 4.6 Setup Guide

**Step 1: Get API Key**
1. Visit https://docs.z.ai
2. Create account and navigate to API settings
3. Generate new API key

**Step 2: Install Grok CLI**
```bash
npm install -g @vibe-kit/grok-cli
```

**Step 3: Configure Environment**
```bash
# Add to ~/.zshrc or ~/.bashrc
export GROK_BASE_URL="https://api.z.ai/api/coding/paas/v4"
export GROK_API_KEY="your-z-ai-api-key"
source ~/.zshrc
```

**Step 4: Test Installation**
```bash
grok --model glm-4.6 --prompt "What is 2+2?"
```

**Step 5: Configure AutomatosX**
```json
{
  "providers": {
    "grok": {
      "enabled": true,
      "priority": 4,
      "model": "glm-4.6"
    }
  }
}
```

**Step 6: Verify**
```bash
ax doctor grok
ax run backend "Hello world" --provider grok
```

### Appendix C: Provider Comparison Matrix

| Feature | Claude | Gemini | OpenAI | Grok (GLM 4.6) |
|---------|--------|--------|--------|----------------|
| **CLI Available** | ✅ | ✅ | ✅ | ✅ |
| **Free Tier** | ❌ | ✅ | ❌ | ❓ (Unknown) |
| **Streaming** | ✅ | ✅ | ✅ | 🟡 (Limited) |
| **MCP Tools** | ❌ | ❌ | ❌ | ✅ |
| **Fast Code Edit** | ❌ | ❌ | ❌ | ✅ (Morph) |
| **Thinking Mode** | ✅ | ✅ | ✅ | 🟡 (Limited compatibility) |
| **Context Window** | 200K | 2M | 128K | ❓ (Unknown) |
| **Cost (1M input)** | $3.00 | $0.075 | $2.50 | ❓ (Unknown) |
| **Cost (1M output)** | $15.00 | $0.30 | $10.00 | ❓ (Unknown) |
| **Latency (p50)** | 2s | 1.5s | 2s | ❓ (Unknown) |
| **Quality Score** | 9.5/10 | 8.5/10 | 9/10 | ❓ (Unknown) |

### Appendix D: Error Code Reference

| Error Code | Message | Cause | Resolution |
|------------|---------|-------|------------|
| `GROK_001` | "Grok CLI not found" | `grok` not on PATH | Install: `npm install -g @vibe-kit/grok-cli` |
| `GROK_002` | "GROK_API_KEY not set" | Missing env var | Set: `export GROK_API_KEY="..."` |
| `GROK_003` | "Invalid model: X" | Unsupported model | Use: glm-4.6, grok-4-latest, etc. |
| `GROK_004` | "API request failed" | Z.AI/X.AI API error | Check API key, base URL, network |
| `GROK_005` | "CLI timeout" | Request exceeded timeout | Increase config.timeout |
| `GROK_006` | "Provider unavailable" | Health check failed | Run `ax doctor grok` |

### Appendix E: Performance Benchmarks

**Test Setup**:
- Hardware: MacBook Pro M1, 16GB RAM
- Network: 100 Mbps fiber
- Prompt: "Write a simple REST API with authentication"

**Results** (preliminary, requires actual testing):

| Provider | Latency (p50) | Latency (p99) | Tokens/sec | Quality Score |
|----------|--------------|--------------|-----------|---------------|
| Claude | 2.1s | 8.5s | 45 | 9.5/10 |
| Gemini | 1.6s | 5.2s | 60 | 8.5/10 |
| OpenAI | 2.3s | 9.1s | 42 | 9.0/10 |
| Grok (GLM 4.6) | ❓ | ❓ | ❓ | ❓ |

**Note**: Grok benchmarks to be added post-implementation.

### Appendix F: YAML Configuration Loader Implementation

**New Component**: `src/core/yaml-config-loader.ts`

This component loads and parses YAML provider configuration files with environment variable interpolation.

**Key Features**:
```typescript
/**
 * YamlConfigLoader - Load provider configs from YAML files
 *
 * Features:
 * - YAML parsing with js-yaml
 * - Environment variable interpolation (${VAR_NAME})
 * - Schema validation
 * - Caching for performance
 * - Error handling with detailed messages
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

interface YamlProviderConfig {
  provider: {
    name: string;
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    model: string;
    priority?: number;
    timeout?: number;
    // ... other fields
  };
  mcp?: {
    enabled: boolean;
    servers: Record<string, any>;
  };
  morph?: {
    enabled: boolean;
    apiKey: string;
  };
}

export class YamlConfigLoader {
  private cache: Map<string, YamlProviderConfig> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private cacheTTL: number = 60000; // 1 minute

  /**
   * Load YAML config with environment variable interpolation
   */
  async loadConfig(filePath: string): Promise<YamlProviderConfig> {
    // Check cache
    const cached = this.getFromCache(filePath);
    if (cached) return cached;

    // Read file
    const fileContent = await fs.promises.readFile(filePath, 'utf8');

    // Interpolate environment variables: ${VAR_NAME}
    const interpolated = this.interpolateEnvVars(fileContent);

    // Parse YAML
    const config = yaml.load(interpolated) as YamlProviderConfig;

    // Validate schema
    this.validateConfig(config);

    // Cache result
    this.setInCache(filePath, config);

    return config;
  }

  /**
   * Interpolate environment variables in YAML content
   * Example: apiKey: ${GROK_API_KEY} → apiKey: "actual-key-value"
   */
  private interpolateEnvVars(content: string): string {
    return content.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (match, varName) => {
      const value = process.env[varName];
      if (!value) {
        throw new Error(`Environment variable ${varName} is not set`);
      }
      return value;
    });
  }

  /**
   * Validate YAML config against schema
   */
  private validateConfig(config: YamlProviderConfig): void {
    if (!config.provider) {
      throw new Error('Missing required field: provider');
    }
    if (!config.provider.name) {
      throw new Error('Missing required field: provider.name');
    }
    if (!config.provider.baseUrl) {
      throw new Error('Missing required field: provider.baseUrl');
    }
    if (!config.provider.apiKey) {
      throw new Error('Missing required field: provider.apiKey');
    }
    // Additional validation...
  }

  /**
   * Cache management
   */
  private getFromCache(filePath: string): YamlProviderConfig | null {
    const expiry = this.cacheExpiry.get(filePath);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(filePath);
      this.cacheExpiry.delete(filePath);
      return null;
    }
    return this.cache.get(filePath) || null;
  }

  private setInCache(filePath: string, config: YamlProviderConfig): void {
    this.cache.set(filePath, config);
    this.cacheExpiry.set(filePath, Date.now() + this.cacheTTL);
  }
}
```

**Usage in GrokProvider**:
```typescript
import { YamlConfigLoader } from '../core/yaml-config-loader.js';

export class GrokProvider extends BaseProvider {
  constructor(config: ProviderConfig) {
    super(config);

    // Load YAML config if specified
    if (config.configFile) {
      const loader = new YamlConfigLoader();
      const yamlConfig = await loader.loadConfig(config.configFile);

      // Override config with YAML values
      this.baseUrl = yamlConfig.provider.baseUrl;
      this.apiKey = yamlConfig.provider.apiKey;
      this.defaultModel = yamlConfig.provider.model;
    }
  }
}
```

**Testing Strategy**:
```typescript
// tests/unit/yaml-config-loader.test.ts
describe('YamlConfigLoader', () => {
  it('should load valid YAML config', async () => {
    const loader = new YamlConfigLoader();
    const config = await loader.loadConfig('.automatosx/providers/grok.yaml');
    expect(config.provider.name).toBe('grok');
  });

  it('should interpolate environment variables', async () => {
    process.env.TEST_API_KEY = 'test-key-123';
    const loader = new YamlConfigLoader();
    // YAML contains: apiKey: ${TEST_API_KEY}
    const config = await loader.loadConfig('test-config.yaml');
    expect(config.provider.apiKey).toBe('test-key-123');
  });

  it('should throw if env var is missing', async () => {
    delete process.env.MISSING_VAR;
    const loader = new YamlConfigLoader();
    // YAML contains: apiKey: ${MISSING_VAR}
    await expect(loader.loadConfig('missing-var-config.yaml'))
      .rejects.toThrow('Environment variable MISSING_VAR is not set');
  });
});
```

**Dependencies**:
```json
{
  "dependencies": {
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.5"
  }
}
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-16 | AutomatosX Team | Initial PRD created via megathink analysis |
| 1.1 | 2025-11-16 | AutomatosX Team | **Major Update**: Changed configuration from environment variables to YAML files<br/>- Added `.automatosx/providers/grok.yaml` configuration<br/>- Added YamlConfigLoader implementation (Appendix F)<br/>- Updated all setup/migration guides for YAML approach<br/>- Added environment variable interpolation support<br/>- Maintained backward compatibility with env vars<br/>- Added MCP and Morph config sections to YAML schema<br/>- Updated Section 5.3, 5.4, 8.1-8.4, 10.2 with YAML examples |

---

**END OF PRD**
