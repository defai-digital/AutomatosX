# Provider Configuration Templates

This directory contains YAML templates for configuring AI providers in AutomatosX.

## Available Templates

### Grok Provider

**1. X.AI Official Grok** (`grok.yaml.template`)
- **Model**: `grok-3-fast`
- **Endpoint**: `https://api.x.ai/v1`
- **Best for**: General AI tasks, reasoning, analysis
- **API Key**: Get from https://x.ai/api
- **Cost**: Paid API (check X.AI pricing)

**2. Z.AI GLM 4.6** (`grok-zai.yaml.template`)
- **Model**: `glm-4.6`
- **Endpoint**: `https://api.z.ai/api/coding/paas/v4`
- **Best for**: Code generation, Chinese language support
- **API Key**: Get from https://z.ai
- **Cost**: Free tier available

## Quick Start

### Using X.AI Grok

```bash
# 1. Copy template
cp templates/providers/grok.yaml.template .automatosx/providers/grok.yaml

# 2. Edit the file and add your API key
# Replace: YOUR_X_AI_API_KEY_HERE
# With: xai-your-actual-api-key

# 3. Test configuration
ax doctor grok
```

### Using Z.AI GLM 4.6

```bash
# 1. Copy template
cp templates/providers/grok-zai.yaml.template .automatosx/providers/grok.yaml

# 2. Edit the file and add your API key
# Replace: YOUR_Z_AI_API_KEY_HERE
# With: your-actual-z-ai-key

# 3. Test configuration
ax doctor grok
```

## Configuration Priority

You can adjust the provider priority to control routing order:

- **Priority 1** - Highest (tried first)
- **Priority 2** - High
- **Priority 3** - Medium
- **Priority 4** - Low (fallback)

Example:
```yaml
provider:
  priority: 2  # Try Grok after OpenAI but before Gemini/Claude
```

## Environment Variables

Instead of hardcoding API keys, use environment variables:

```yaml
provider:
  apiKey: ${GROK_API_KEY}
  baseUrl: ${GROK_BASE_URL}
```

Set environment variables:
```bash
export GROK_API_KEY="your-key"
export GROK_BASE_URL="https://api.x.ai/v1"
```

## Customization

### Adjust Rate Limits

```yaml
rateLimits:
  maxRequestsPerMinute: 120  # Increase for higher quota
  maxTokensPerMinute: 400000
```

### Modify Timeouts

```yaml
provider:
  timeout: 300000  # 5 minutes for complex tasks
```

### Enable/Disable Provider

```yaml
provider:
  enabled: true  # or false to disable
```

## Support

- **Documentation**: See [docs/providers/grok.md](../../docs/providers/grok.md)
- **Examples**: See [examples/providers/](../../examples/providers/)
- **Issues**: https://github.com/defai-digital/automatosx/issues

---

**Version**: 8.3.1
**Last Updated**: 2025-11-17
