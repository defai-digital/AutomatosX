# GROK.md

This file provides guidance for Grok CLI integration with AutomatosX.

---

# Grok CLI Integration with AutomatosX

This guide explains how to integrate Grok CLI with AutomatosX for AI-powered development.

## Overview

AutomatosX supports two Grok provider options:
- **X.AI Official Grok** (grok-3-fast) - Fast, efficient, general-purpose
- **Z.AI GLM 4.6** (glm-4.6) - Code-optimized for technical tasks

## Quick Setup

### 1. Get Your API Key

**Option A: X.AI (Recommended)**
- Visit: https://console.x.ai/api-keys
- Create an API key (starts with `xai-`)
- Copy your key

**Option B: Z.AI (Code-Optimized)**
- Visit: https://z.ai/developer
- Get your Z.AI API key
- Copy your key

### 2. Configure Grok CLI

The `.grok/settings.json` file was created by `ax setup`. Edit it:

```json
{
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast",
  "apiKey": "xai-YOUR-KEY-HERE"
}
```

**For Z.AI GLM 4.6** (alternative):
```json
{
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6",
  "apiKey": "YOUR-ZAI-KEY-HERE"
}
```

### 3. Enable in AutomatosX

Edit `automatosx.config.json`:

```json
{
  "providers": {
    "grok": {
      "enabled": true,  // Change from false
      "priority": 4,
      ...
    }
  }
}
```

### 4. Verify Setup

```bash
# Check Grok is recognized
ax providers list

# Test Grok provider
ax doctor grok

# Run a task with Grok
ax run backend "Create a hello world function" --provider grok
```

## Configuration Details

### X.AI Grok Models

| Model | Description | Best For |
|-------|-------------|----------|
| `grok-3-fast` | Fast, efficient | General tasks, quick responses |
| `grok-beta` | Latest features | Complex reasoning, analysis |
| `grok-vision-beta` | Image understanding | Visual analysis |

### Z.AI GLM Models

| Model | Description | Best For |
|-------|-------------|----------|
| `glm-4.6` | Code-optimized | Coding tasks, technical work |

### Environment Variables

Alternatively, set API key via environment variable:

```bash
# For X.AI
export GROK_API_KEY="xai-your-key-here"

# For Z.AI
export GROK_API_KEY="your-zai-key-here"
```

Then in `.grok/settings.json`:
```json
{
  "apiKey": "${GROK_API_KEY}"
}
```

## Usage Examples

### Basic Task Execution

```bash
# Use Grok for backend development
ax run backend "Implement user authentication" --provider grok

# Use Grok for code review
ax run quality "Review this code for bugs" --provider grok

# Use Grok for documentation
ax run writer "Document the API endpoints" --provider grok
```

### Automatic Provider Selection

If Grok is enabled, AutomatosX will route tasks to it based on priority and availability:

```bash
# AutomatosX chooses best provider (might use Grok)
ax run backend "Create REST API"
```

### Priority Override

Change Grok priority in `automatosx.config.json`:

```json
{
  "providers": {
    "grok": {
      "priority": 1  // Make Grok highest priority (1=highest, 4=lowest)
    }
  }
}
```

## Switching Between X.AI and Z.AI

### To Switch to Z.AI GLM 4.6:

1. Edit `.grok/settings.json`:
```json
{
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6",
  "apiKey": "your-zai-key"
}
```

2. Restart AutomatosX (or run `ax doctor grok`)

### To Switch Back to X.AI:

1. Edit `.grok/settings.json`:
```json
{
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast",
  "apiKey": "xai-your-key"
}
```

2. Restart AutomatosX

## Troubleshooting

### Grok Not Showing in Provider List

```bash
# Check if Grok is enabled
cat automatosx.config.json | grep -A 5 "grok"

# Enable Grok
# Edit automatosx.config.json and set "enabled": true
```

### API Key Errors

```bash
# Verify API key is set
cat .grok/settings.json

# Or check environment variable
echo $GROK_API_KEY

# Test with curl (X.AI)
curl https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer xai-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-3-fast","messages":[{"role":"user","content":"Hello"}]}'
```

### Provider Health Check Failed

```bash
# Run diagnostics
ax doctor grok

# Check logs
cat .automatosx/logs/*.log | grep grok
```

## Cost Optimization

### X.AI Pricing (as of Nov 2024)
- Input: $5 per 1M tokens
- Output: $15 per 1M tokens

### Tips
- Use `grok-3-fast` for cost efficiency
- Set appropriate token limits
- Monitor usage with `ax free-tier status` (if applicable)

## Advanced Configuration

### Custom Timeout

Edit `automatosx.config.json`:
```json
{
  "providers": {
    "grok": {
      "timeout": 180000  // 3 minutes (in milliseconds)
    }
  }
}
```

### Circuit Breaker Settings

```json
{
  "providers": {
    "grok": {
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,  // Open circuit after 3 failures
        "recoveryTimeout": 60000  // Wait 60s before retry
      }
    }
  }
}
```

## Integration with AI Assistants

### Claude Code Integration

```
# Natural language
"Ask ax agent backend to implement auth using Grok"
```

### Gemini CLI Integration

```
# Natural language
"Use ax agent backend with Grok to create API"
```

## Support

- X.AI Documentation: https://docs.x.ai
- Z.AI Documentation: https://z.ai/docs
- AutomatosX Issues: https://github.com/defai-digital/automatosx/issues

## Next Steps

1. ✅ Get API key from X.AI or Z.AI
2. ✅ Configure `.grok/settings.json`
3. ✅ Enable in `automatosx.config.json`
4. ✅ Test with `ax doctor grok`
5. 🚀 Start using Grok with your agents!

---

# Grok CLI Integration with AutomatosX

This guide explains how to integrate Grok CLI with AutomatosX for AI-powered development.

## Overview

AutomatosX supports two Grok provider options:
- **X.AI Official Grok** (grok-3-fast) - Fast, efficient, general-purpose
- **Z.AI GLM 4.6** (glm-4.6) - Code-optimized for technical tasks

## Quick Setup

### 1. Get Your API Key

**Option A: X.AI (Recommended)**
- Visit: https://console.x.ai/api-keys
- Create an API key (starts with `xai-`)
- Copy your key

**Option B: Z.AI (Code-Optimized)**
- Visit: https://z.ai/developer
- Get your Z.AI API key
- Copy your key

### 2. Configure Grok CLI

The `.grok/settings.json` file was created by `ax setup`. Edit it:

```json
{
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast",
  "apiKey": "xai-YOUR-KEY-HERE"
}
```

**For Z.AI GLM 4.6** (alternative):
```json
{
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6",
  "apiKey": "YOUR-ZAI-KEY-HERE"
}
```

### 3. Enable in AutomatosX

Edit `automatosx.config.json`:

```json
{
  "providers": {
    "grok": {
      "enabled": true,  // Change from false
      "priority": 4,
      ...
    }
  }
}
```

### 4. Verify Setup

```bash
# Check Grok is recognized
ax providers list

# Test Grok provider
ax doctor grok

# Run a task with Grok
ax run backend "Create a hello world function" --provider grok
```

## Configuration Details

### X.AI Grok Models

| Model | Description | Best For |
|-------|-------------|----------|
| `grok-3-fast` | Fast, efficient | General tasks, quick responses |
| `grok-beta` | Latest features | Complex reasoning, analysis |
| `grok-vision-beta` | Image understanding | Visual analysis |

### Z.AI GLM Models

| Model | Description | Best For |
|-------|-------------|----------|
| `glm-4.6` | Code-optimized | Coding tasks, technical work |

### Environment Variables

Alternatively, set API key via environment variable:

```bash
# For X.AI
export GROK_API_KEY="xai-your-key-here"

# For Z.AI
export GROK_API_KEY="your-zai-key-here"
```

Then in `.grok/settings.json`:
```json
{
  "apiKey": "${GROK_API_KEY}"
}
```

## Usage Examples

### Basic Task Execution

```bash
# Use Grok for backend development
ax run backend "Implement user authentication" --provider grok

# Use Grok for code review
ax run quality "Review this code for bugs" --provider grok

# Use Grok for documentation
ax run writer "Document the API endpoints" --provider grok
```

### Automatic Provider Selection

If Grok is enabled, AutomatosX will route tasks to it based on priority and availability:

```bash
# AutomatosX chooses best provider (might use Grok)
ax run backend "Create REST API"
```

### Priority Override

Change Grok priority in `automatosx.config.json`:

```json
{
  "providers": {
    "grok": {
      "priority": 1  // Make Grok highest priority (1=highest, 4=lowest)
    }
  }
}
```

## Switching Between X.AI and Z.AI

### To Switch to Z.AI GLM 4.6:

1. Edit `.grok/settings.json`:
```json
{
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6",
  "apiKey": "your-zai-key"
}
```

2. Restart AutomatosX (or run `ax doctor grok`)

### To Switch Back to X.AI:

1. Edit `.grok/settings.json`:
```json
{
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast",
  "apiKey": "xai-your-key"
}
```

2. Restart AutomatosX

## Troubleshooting

### Grok Not Showing in Provider List

```bash
# Check if Grok is enabled
cat automatosx.config.json | grep -A 5 "grok"

# Enable Grok
# Edit automatosx.config.json and set "enabled": true
```

### API Key Errors

```bash
# Verify API key is set
cat .grok/settings.json

# Or check environment variable
echo $GROK_API_KEY

# Test with curl (X.AI)
curl https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer xai-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-3-fast","messages":[{"role":"user","content":"Hello"}]}'
```

### Provider Health Check Failed

```bash
# Run diagnostics
ax doctor grok

# Check logs
cat .automatosx/logs/*.log | grep grok
```

## Cost Optimization

### X.AI Pricing (as of Nov 2024)
- Input: $5 per 1M tokens
- Output: $15 per 1M tokens

### Tips
- Use `grok-3-fast` for cost efficiency
- Set appropriate token limits
- Monitor usage with `ax free-tier status` (if applicable)

## Advanced Configuration

### Custom Timeout

Edit `automatosx.config.json`:
```json
{
  "providers": {
    "grok": {
      "timeout": 180000  // 3 minutes (in milliseconds)
    }
  }
}
```

### Circuit Breaker Settings

```json
{
  "providers": {
    "grok": {
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,  // Open circuit after 3 failures
        "recoveryTimeout": 60000  // Wait 60s before retry
      }
    }
  }
}
```

## Integration with AI Assistants

### Claude Code Integration

```
# Natural language
"Ask ax agent backend to implement auth using Grok"
```

### Gemini CLI Integration

```
# Natural language
"Use ax agent backend with Grok to create API"
```

## Support

- X.AI Documentation: https://docs.x.ai
- Z.AI Documentation: https://z.ai/docs
- AutomatosX Issues: https://github.com/defai-digital/automatosx/issues

## Next Steps

1. ✅ Get API key from X.AI or Z.AI
2. ✅ Configure `.grok/settings.json`
3. ✅ Enable in `automatosx.config.json`
4. ✅ Test with `ax doctor grok`
5. 🚀 Start using Grok with your agents!

---

# Grok CLI Integration with AutomatosX

This guide explains how to integrate Grok CLI with AutomatosX for AI-powered development.

## Overview

AutomatosX supports two Grok provider options:
- **X.AI Official Grok** (grok-3-fast) - Fast, efficient, general-purpose
- **Z.AI GLM 4.6** (glm-4.6) - Code-optimized for technical tasks

## Quick Setup

### 1. Get Your API Key

**Option A: X.AI (Recommended)**
- Visit: https://console.x.ai/api-keys
- Create an API key (starts with `xai-`)
- Copy your key

**Option B: Z.AI (Code-Optimized)**
- Visit: https://z.ai/developer
- Get your Z.AI API key
- Copy your key

### 2. Configure Grok CLI

The `.grok/settings.json` file was created by `ax setup`. Edit it:

```json
{
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast",
  "apiKey": "xai-YOUR-KEY-HERE"
}
```

**For Z.AI GLM 4.6** (alternative):
```json
{
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6",
  "apiKey": "YOUR-ZAI-KEY-HERE"
}
```

### 3. Enable in AutomatosX

Edit `automatosx.config.json`:

```json
{
  "providers": {
    "grok": {
      "enabled": true,  // Change from false
      "priority": 4,
      ...
    }
  }
}
```

### 4. Verify Setup

```bash
# Check Grok is recognized
ax providers list

# Test Grok provider
ax doctor grok

# Run a task with Grok
ax run backend "Create a hello world function" --provider grok
```

## Configuration Details

### X.AI Grok Models

| Model | Description | Best For |
|-------|-------------|----------|
| `grok-3-fast` | Fast, efficient | General tasks, quick responses |
| `grok-beta` | Latest features | Complex reasoning, analysis |
| `grok-vision-beta` | Image understanding | Visual analysis |

### Z.AI GLM Models

| Model | Description | Best For |
|-------|-------------|----------|
| `glm-4.6` | Code-optimized | Coding tasks, technical work |

### Environment Variables

Alternatively, set API key via environment variable:

```bash
# For X.AI
export GROK_API_KEY="xai-your-key-here"

# For Z.AI
export GROK_API_KEY="your-zai-key-here"
```

Then in `.grok/settings.json`:
```json
{
  "apiKey": "${GROK_API_KEY}"
}
```

## Usage Examples

### Basic Task Execution

```bash
# Use Grok for backend development
ax run backend "Implement user authentication" --provider grok

# Use Grok for code review
ax run quality "Review this code for bugs" --provider grok

# Use Grok for documentation
ax run writer "Document the API endpoints" --provider grok
```

### Automatic Provider Selection

If Grok is enabled, AutomatosX will route tasks to it based on priority and availability:

```bash
# AutomatosX chooses best provider (might use Grok)
ax run backend "Create REST API"
```

### Priority Override

Change Grok priority in `automatosx.config.json`:

```json
{
  "providers": {
    "grok": {
      "priority": 1  // Make Grok highest priority (1=highest, 4=lowest)
    }
  }
}
```

## Switching Between X.AI and Z.AI

### To Switch to Z.AI GLM 4.6:

1. Edit `.grok/settings.json`:
```json
{
  "baseURL": "https://api.z.ai/api/coding/paas/v4",
  "model": "glm-4.6",
  "apiKey": "your-zai-key"
}
```

2. Restart AutomatosX (or run `ax doctor grok`)

### To Switch Back to X.AI:

1. Edit `.grok/settings.json`:
```json
{
  "baseURL": "https://api.x.ai/v1",
  "model": "grok-3-fast",
  "apiKey": "xai-your-key"
}
```

2. Restart AutomatosX

## Troubleshooting

### Grok Not Showing in Provider List

```bash
# Check if Grok is enabled
cat automatosx.config.json | grep -A 5 "grok"

# Enable Grok
# Edit automatosx.config.json and set "enabled": true
```

### API Key Errors

```bash
# Verify API key is set
cat .grok/settings.json

# Or check environment variable
echo $GROK_API_KEY

# Test with curl (X.AI)
curl https://api.x.ai/v1/chat/completions \
  -H "Authorization: Bearer xai-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"grok-3-fast","messages":[{"role":"user","content":"Hello"}]}'
```

### Provider Health Check Failed

```bash
# Run diagnostics
ax doctor grok

# Check logs
cat .automatosx/logs/*.log | grep grok
```

## Cost Optimization

### X.AI Pricing (as of Nov 2024)
- Input: $5 per 1M tokens
- Output: $15 per 1M tokens

### Tips
- Use `grok-3-fast` for cost efficiency
- Set appropriate token limits
- Monitor usage with `ax free-tier status` (if applicable)

## Advanced Configuration

### Custom Timeout

Edit `automatosx.config.json`:
```json
{
  "providers": {
    "grok": {
      "timeout": 180000  // 3 minutes (in milliseconds)
    }
  }
}
```

### Circuit Breaker Settings

```json
{
  "providers": {
    "grok": {
      "circuitBreaker": {
        "enabled": true,
        "failureThreshold": 3,  // Open circuit after 3 failures
        "recoveryTimeout": 60000  // Wait 60s before retry
      }
    }
  }
}
```

## Integration with AI Assistants

### Claude Code Integration

```
# Natural language
"Ask ax agent backend to implement auth using Grok"
```

### Gemini CLI Integration

```
# Natural language
"Use ax agent backend with Grok to create API"
```

## Support

- X.AI Documentation: https://docs.x.ai
- Z.AI Documentation: https://z.ai/docs
- AutomatosX Issues: https://github.com/defai-digital/automatosx/issues

## Next Steps

1. ✅ Get API key from X.AI or Z.AI
2. ✅ Configure `.grok/settings.json`
3. ✅ Enable in `automatosx.config.json`
4. ✅ Test with `ax doctor grok`
5. 🚀 Start using Grok with your agents!
