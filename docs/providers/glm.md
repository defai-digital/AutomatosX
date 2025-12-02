# GLM Provider via ax-cli

**Status**: ✅ Stable (v11.0.0+)
**CLI Tool**: `ax-cli` (multi-provider)
**Default Model**: glm-4.6 (Zhipu AI)
**Installation**: `npm install -g @defai.digital/ax-cli`

---

## Overview

The GLM provider integrates Zhipu AI's GLM models through `ax-cli`, a multi-provider CLI that supports GLM, xAI (Grok), OpenAI, Anthropic, and Ollama. This provides a unified interface for multiple AI providers while defaulting to the cost-effective GLM 4.6 model.

## Quick Start

### 1. Install ax-cli

```bash
npm install -g @defai.digital/ax-cli
```

### 2. Configure ax-cli for GLM

```bash
ax-cli setup
# Select: Zhipu AI (GLM)
# Enter API key: (get from https://open.bigmodel.cn/)
# Select model: glm-4.6
```

### 3. Enable in AutomatosX

```json
{
  "providers": {
    "glm": {
      "enabled": true,
      "priority": 4,
      "timeout": 120000,
      "axCli": {
        "provider": "glm",
        "model": "glm-4.6",
        "maxToolRounds": 400
      }
    }
  }
}
```

### 4. Verify Setup

```bash
ax doctor glm
```

### 5. Run a Test

```bash
ax run --provider glm "explain quantum computing in simple terms"
```

---

## Configuration Options

### Basic Configuration

```json
{
  "glm": {
    "enabled": true,
    "priority": 4,
    "timeout": 120000,
    "command": "ax-cli"
  }
}
```

### Advanced Configuration

```json
{
  "glm": {
    "enabled": true,
    "priority": 4,
    "timeout": 120000,
    "command": "ax-cli",
    "axCli": {
      "provider": "glm",
      "model": "glm-4.6",
      "maxToolRounds": 400,
      "configPath": "~/.ax-cli/config.json",
      "apiKey": "your-api-key",           // Optional override
      "baseUrl": "https://custom.api.com" // Optional override
    }
  }
}
```

### Configuration Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable GLM provider |
| `priority` | number | `4` | Provider priority (lower = higher priority) |
| `timeout` | number | `120000` | Request timeout in milliseconds |
| `command` | string | `"ax-cli"` | CLI command name |
| `axCli.provider` | string | `"glm"` | Provider for ax-cli (glm, xai, openai, anthropic, ollama) |
| `axCli.model` | string | `"glm-4.6"` | Model name |
| `axCli.maxToolRounds` | number | `400` | Maximum tool execution rounds |
| `axCli.configPath` | string | `"~/.ax-cli/config.json"` | ax-cli config file path |
| `axCli.apiKey` | string | - | API key override (use env var instead) |
| `axCli.baseUrl` | string | - | API base URL override |

---

## Using Other Providers via ax-cli

ax-cli supports multiple providers. You can configure AutomatosX to use Grok, OpenAI, or other providers through the GLM provider configuration:

### Using Grok (xAI)

```bash
# 1. Configure ax-cli for xAI
ax-cli setup
# Select: xAI (Grok)
# Enter xAI API key
# Select model: grok-2

# 2. Update AutomatosX config
{
  "glm": {
    "enabled": true,
    "axCli": {
      "provider": "xai",
      "model": "grok-2"
    }
  }
}
```

### Using OpenAI

```bash
# 1. Configure ax-cli for OpenAI
ax-cli setup
# Select: OpenAI
# Enter OpenAI API key
# Select model: gpt-4-turbo

# 2. Update AutomatosX config
{
  "glm": {
    "enabled": true,
    "axCli": {
      "provider": "openai",
      "model": "gpt-4-turbo"
    }
  }
}
```

---

## GLM Models

Zhipu AI offers several GLM model variants:

| Model | Context | Speed | Cost | Best For |
|-------|---------|-------|------|----------|
| glm-4.6 | 128K | Fast | Low | General tasks, coding |
| glm-4.9 | 128K | Medium | Medium | Complex reasoning |
| glm-4-vision | 8K | Fast | Medium | Image understanding |
| glm-3-turbo | 32K | Very Fast | Very Low | Simple tasks, chat |

### Model Selection

```json
{
  "glm": {
    "enabled": true,
    "axCli": {
      "model": "glm-4.9"  // Use more capable model
    }
  }
}
```

---

## Environment Variables

### API Key

```bash
# Zhipu AI GLM
export ZHIPUAI_API_KEY=your-api-key

# xAI Grok
export XAI_API_KEY=your-api-key

# OpenAI
export OPENAI_API_KEY=your-api-key
```

### ax-cli Configuration

```bash
export AX_CLI_CONFIG_PATH=~/.ax-cli/config.json
export AX_CLI_LOG_LEVEL=info
```

---

## Troubleshooting

### Issue: ax-cli not found

```bash
# Check installation
which ax-cli

# Reinstall if needed
npm install -g @defai.digital/ax-cli

# Verify PATH
echo $PATH
```

### Issue: API key not configured

```bash
# Run setup
ax-cli setup

# Or set environment variable
export ZHIPUAI_API_KEY=your-api-key
```

### Issue: Provider not available

```bash
# Check provider health
ax doctor glm

# Verify ax-cli configuration
ax-cli config show
```

### Issue: Model not found

```bash
# List available models
ax-cli models list --provider glm

# Update configuration
ax-cli config set model glm-4.6
```

---

## Pricing

GLM pricing (as of v11.0.0):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|----------------------|
| glm-4.6 | $0.50 | $0.50 |
| glm-4.9 | $1.00 | $1.00 |
| glm-4-vision | $1.50 | $1.50 |
| glm-3-turbo | $0.10 | $0.10 |

**Note**: Prices may vary. Check [Zhipu AI Pricing](https://open.bigmodel.cn/pricing) for current rates.

---

## Migration from Grok Provider (v10.x → v11.0)

If you're upgrading from AutomatosX v10.x which had a dedicated Grok provider:

### Breaking Changes

1. **Provider name changed**: `grok` → `glm`
2. **Configuration structure simplified**: Removed dual-CLI fallback
3. **Default model changed**: `grok-2` → `glm-4.6`

### Migration Steps

```bash
# 1. Install ax-cli
npm install -g @defai.digital/ax-cli

# 2. Configure for your preferred provider
ax-cli setup
# Select: Zhipu AI (GLM) OR xAI (Grok) OR OpenAI

# 3. Update ax.config.json
# Before (v10.x):
{
  "grok": {
    "enabled": true,
    "preferredCli": "ax-cli"
  }
}

# After (v11.0+):
{
  "glm": {
    "enabled": true,
    "axCli": {
      "provider": "glm",  // or "xai" for Grok
      "model": "glm-4.6"   // or "grok-2" for Grok
    }
  }
}

# 4. Test
ax doctor glm
ax run --provider glm "test"
```

---

## Best Practices

1. **Use Environment Variables for API Keys**: Never hardcode API keys in config files
2. **Set Appropriate Timeouts**: GLM models typically respond in 2-10 seconds
3. **Monitor Token Usage**: Use `--iterate-max-tokens` to control costs
4. **Choose Right Model**: Use glm-3-turbo for simple tasks, glm-4.6 for complex ones
5. **Handle Rate Limits**: Implement backoff if hitting rate limits

---

## Advanced Usage

### Custom Base URL (Self-Hosted)

```json
{
  "glm": {
    "enabled": true,
    "axCli": {
      "provider": "glm",
      "baseUrl": "http://localhost:8000/v1"
    }
  }
}
```

### Multiple Providers

```json
{
  "providers": {
    "glm": {
      "enabled": true,
      "priority": 4,
      "axCli": {
        "provider": "glm",
        "model": "glm-4.6"
      }
    },
    "claude": {
      "enabled": true,
      "priority": 1
    },
    "gemini": {
      "enabled": true,
      "priority": 2
    }
  }
}
```

### Model Comparison

```bash
# Test same prompt with different models
ax run --provider glm "explain async/await" --axcli-model glm-4.6
ax run --provider glm "explain async/await" --axcli-model glm-4.9

# Compare providers
ax run --provider glm "code review task" --axcli-provider glm --axcli-model glm-4.6
ax run --provider glm "code review task" --axcli-provider xai --axcli-model grok-2
```

---

## See Also

- [ax-cli Documentation](https://github.com/defai-digital/ax-cli)
- [Zhipu AI API Reference](https://open.bigmodel.cn/dev/api)
- [AutomatosX Provider System](../advanced/providers.md)
- [Migration Guide](../migration/v11-grok-to-glm.md)

---

**Questions?** Open an issue at [github.com/defai-digital/automatosx/issues](https://github.com/defai-digital/automatosx/issues)
