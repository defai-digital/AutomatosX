# Migration Guide: ax-cli to v12.0.0 Native Providers

This guide helps you migrate from the `ax-cli` provider to native providers in AutomatosX v12.0.0.

## Overview

**Why is ax-cli being removed?**

The `ax-cli` provider was originally designed as a multi-provider wrapper. However, AutomatosX now handles provider orchestration natively, making `ax-cli` redundant. Removing it simplifies the architecture and provides:

- Direct SDK access with lower latency (~5ms vs ~200ms)
- Better type safety with TypeScript SDKs
- Simpler configuration
- Reduced dependencies

**Timeline:**

| Version | Status |
|---------|--------|
| v11.6.0 | Deprecation warnings enabled |
| v11.7.0 | Native providers available (ax-glm, ax-grok) |
| v12.0.0 | ax-cli removed |

---

## Migration Paths

### GLM Models (Zhipu AI)

**Before (ax-cli):**
```json
{
  "providers": {
    "ax-cli": {
      "enabled": true,
      "priority": 4,
      "axCli": {
        "model": "glm-4"
      }
    }
  }
}
```

**After (ax-glm):**
```json
{
  "providers": {
    "glm": {
      "enabled": true,
      "priority": 4,
      "model": "glm-4",
      "mode": "auto"
    }
  }
}
```

**Environment Variables:**
```bash
# Before
export AX_CLI_API_KEY="your-zhipu-api-key"

# After
export ZAI_API_KEY="your-zhipu-api-key"
```

---

### Grok Models (xAI)

**Before (ax-cli):**
```json
{
  "providers": {
    "ax-cli": {
      "enabled": true,
      "priority": 5,
      "axCli": {
        "model": "grok-3"
      }
    }
  }
}
```

**After (ax-grok):**
```json
{
  "providers": {
    "grok": {
      "enabled": true,
      "priority": 5,
      "model": "grok-3",
      "mode": "auto"
    }
  }
}
```

**Environment Variables:**
```bash
# Before
export AX_CLI_API_KEY="your-xai-api-key"

# After
export XAI_API_KEY="your-xai-api-key"
```

---

### OpenAI Models

**Before (ax-cli):**
```json
{
  "providers": {
    "ax-cli": {
      "enabled": true,
      "axCli": {
        "provider": "openai",
        "model": "gpt-4"
      }
    }
  }
}
```

**After (openai):**
```json
{
  "providers": {
    "openai": {
      "enabled": true,
      "priority": 1,
      "command": "codex",
      "model": "gpt-4"
    }
  }
}
```

**Environment Variables:**
```bash
# Before
export AX_CLI_API_KEY="your-openai-api-key"

# After
export OPENAI_API_KEY="your-openai-api-key"
```

---

## Configuration Mapping

### Provider Config Fields

| ax-cli Field | Native Provider Field | Notes |
|--------------|----------------------|-------|
| `axCli.model` | `model` | Direct field on provider config |
| `axCli.apiKey` | Environment variable | Use provider-specific env var |
| `axCli.baseUrl` | `baseUrl` | For custom endpoints |
| `axCli.maxToolRounds` | `maxToolRounds` | Same field name |
| `mode` | `mode` | `"auto"`, `"sdk"`, or `"cli"` |

### Execution Mode

The `mode` field controls how the provider executes requests:

| Mode | Behavior |
|------|----------|
| `"auto"` (default) | SDK first, CLI fallback |
| `"sdk"` | SDK only, error if unavailable |
| `"cli"` | CLI only |

---

## Code Migration

### TypeScript/JavaScript

**Before:**
```typescript
import { AxCliProvider } from 'automatosx';

const provider = new AxCliProvider({
  name: 'ax-cli',
  priority: 4,
  timeout: 120000,
  mode: 'auto',
  axCli: {
    model: 'glm-4'
  }
});

const response = await provider.execute({ prompt: 'Hello' });
```

**After:**
```typescript
import { GLMProvider } from 'automatosx';

const provider = new GLMProvider({
  name: 'glm',
  priority: 4,
  timeout: 120000,
  mode: 'auto',
  model: 'glm-4'
});

const response = await provider.execute({ prompt: 'Hello' });
```

### Using Router (Recommended)

The router automatically selects providers based on configuration:

```typescript
import { Router } from 'automatosx';

const router = new Router();
const response = await router.execute({
  task: 'Implement authentication',
  constraints: {
    maxLatency: 5000
  }
});
// Router will select best available provider
```

---

## SDK Advanced Features

### Parallel Tasks

**Before (ax-cli):**
```typescript
const results = await axCliProvider.executeParallelTasks([
  { task: 'Task 1' },
  { task: 'Task 2' }
]);
```

**After (native):**
```typescript
// Use AutomatosX orchestration directly
const session = await sessionManager.create('parallel-work');
await Promise.all([
  orchestrator.execute({ agent: 'backend', task: 'Task 1' }),
  orchestrator.execute({ agent: 'backend', task: 'Task 2' })
]);
```

### Checkpoints

**Before (ax-cli):**
```typescript
await axCliProvider.saveCheckpoint('workflow-1', { phase: 2 });
const checkpoint = await axCliProvider.loadCheckpoint('workflow-1');
```

**After (native):**
```typescript
// Use AutomatosX session manager
await sessionManager.saveCheckpoint('workflow-1', { phase: 2 });
const checkpoint = await sessionManager.loadCheckpoint('workflow-1');
```

---

## Suppressing Deprecation Warnings

If you need more time to migrate, you can suppress warnings:

### Option 1: Configuration

```json
{
  "featureFlags": {
    "deprecationWarnings": false
  }
}
```

### Option 2: Environment Variable

```bash
export FEATURE_DEPRECATION_WARNINGS=false
```

---

## Troubleshooting

### Error: "Module not found: @zhipuai/sdk"

Install the GLM SDK:
```bash
npm install @zhipuai/sdk
```

### Error: "Invalid API key"

Ensure you've set the correct environment variable:
```bash
# For GLM
export ZAI_API_KEY="your-key"

# For Grok
export XAI_API_KEY="your-key"

# For OpenAI
export OPENAI_API_KEY="your-key"
```

### Error: "Provider not available"

Check provider is enabled in config and CLI is installed:
```bash
# For GLM
ax doctor glm

# For Grok
ax doctor grok

# For OpenAI
ax doctor openai
```

---

## Support

- **GitHub Issues:** https://github.com/defai-digital/automatosx/issues
- **Documentation:** https://github.com/defai-digital/automatosx/blob/main/docs/

---

## Version History

| Version | Change |
|---------|--------|
| v11.6.0 | Deprecation warnings added |
| v11.7.0 | ax-glm, ax-grok providers available |
| v11.8.0 | MCP bidirectional communication |
| v12.0.0 | ax-cli removed |
