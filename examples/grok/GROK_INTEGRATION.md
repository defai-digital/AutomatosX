# Grok CLI Integration with AutomatosX

This guide explains how to integrate Grok CLI with AutomatosX for AI-powered development.

## Overview

AutomatosX supports **three** Grok provider options:
- **X.AI Official Grok** (grok-3-fast) - Fast, efficient, general-purpose
- **Z.AI GLM 4.6** (glm-4.6) - Code-optimized for technical tasks
- **Self-Hosted GLM 4.6** - Your own local API server for complete control

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

**Option C: Self-Hosted GLM 4.6 (Complete Control)**
- Set up your own GLM 4.6 API server (see [Self-Hosted Setup](#self-hosted-glm-46-configuration) below)
- Point AutomatosX to your local/private server
- Full data privacy and control

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

## Self-Hosted GLM 4.6 Configuration

**Use your own local coding system with AutomatosX for complete control!**

### Benefits of Self-Hosted

- 🏠 **Complete Data Privacy** - All processing stays on your infrastructure
- 💰 **No Usage Costs** - Run unlimited tasks without API fees
- ⚡ **Lower Latency** - No network round trips to external servers
- 🔧 **Full Customization** - Fine-tune the model for your specific needs
- 🔒 **Enterprise Security** - Meet strict corporate data requirements
- 🌐 **Offline Operation** - Works without internet connectivity
- 📊 **Resource Control** - Optimize for your hardware

### Quick Setup: Docker

The easiest way to run a self-hosted GLM 4.6 API server:

```bash
# 1. Pull and run vLLM server with GLM 4.6
docker run -d \
  --name glm-4-6-server \
  --gpus all \
  -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:latest \
  --model THUDM/glm-4-6 \
  --port 8000 \
  --trust-remote-code

# 2. Wait for model to load (check logs)
docker logs -f glm-4-6-server

# 3. Test the server
curl http://localhost:8000/v1/models

# 4. Configure AutomatosX
# Edit .grok/settings.json:
{
  "baseURL": "http://localhost:8000/v1",
  "model": "THUDM/glm-4-6",
  "apiKey": "optional-if-your-server-requires-it"
}

# 5. Enable and test
# Edit automatosx.config.json: "grok": { "enabled": true }
ax doctor grok
ax providers list
```

### Alternative Deployment Options

#### Option 1: vLLM (Recommended - Fastest)

```bash
# Install vLLM
pip install vllm

# Start server
python -m vllm.entrypoints.openai.api_server \
  --model THUDM/glm-4-6 \
  --port 8000 \
  --trust-remote-code
```

**Pros**: Fastest inference, best GPU utilization
**Cons**: Requires CUDA GPU

#### Option 2: Text Generation Inference (HuggingFace)

```bash
# Using Docker
docker run -d \
  --gpus all \
  -p 8000:80 \
  -v $PWD/data:/data \
  ghcr.io/huggingface/text-generation-inference:latest \
  --model-id THUDM/glm-4-6 \
  --port 80
```

**Pros**: Production-ready, great scaling
**Cons**: More complex setup

#### Option 3: Ollama (Easiest - Good for Development)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull GLM model (if available)
ollama pull glm-4

# Run server
ollama serve

# Configure AutomatosX
# Edit .grok/settings.json:
{
  "baseURL": "http://localhost:11434/v1",
  "model": "glm-4",
  "apiKey": "not-required"
}
```

**Pros**: Simplest setup, works on CPU
**Cons**: Slower inference, may not have latest GLM 4.6

#### Option 4: Custom FastAPI Wrapper

```python
# server.py
from fastapi import FastAPI
from transformers import AutoModelForCausalLM, AutoTokenizer
import uvicorn

app = FastAPI()
model = AutoModelForCausalLM.from_pretrained("THUDM/glm-4-6", trust_remote_code=True)
tokenizer = AutoTokenizer.from_pretrained("THUDM/glm-4-6", trust_remote_code=True)

@app.post("/v1/chat/completions")
async def chat_completions(request: dict):
    messages = request["messages"]
    # ... implement OpenAI-compatible API
    return {"choices": [...]}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**Pros**: Full control, custom features
**Cons**: Requires Python coding

### Hardware Requirements

| Deployment | GPU | RAM | Disk | Performance |
|------------|-----|-----|------|-------------|
| **vLLM** | NVIDIA A100 (40GB) | 64GB | 100GB | Excellent |
| **vLLM** | NVIDIA RTX 4090 (24GB) | 32GB | 50GB | Very Good |
| **TGI** | NVIDIA V100 (16GB) | 32GB | 50GB | Good |
| **Ollama (CPU)** | None | 16GB | 20GB | Fair |
| **Ollama (GPU)** | NVIDIA RTX 3090 (24GB) | 16GB | 20GB | Good |

### Network Configuration

If hosting on a separate server:

```bash
# .grok/settings.json
{
  "baseURL": "http://your-server-ip:8000/v1",  // Internal network
  "model": "THUDM/glm-4-6",
  "apiKey": "your-optional-auth-token"
}

# Or with domain name
{
  "baseURL": "https://glm.yourcompany.com/v1",  // HTTPS for security
  "model": "THUDM/glm-4-6",
  "apiKey": "production-api-key"
}
```

### Testing Your Self-Hosted Server

```bash
# 1. Test model endpoint
curl http://localhost:8000/v1/models

# 2. Test completion
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "THUDM/glm-4-6",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# 3. Test with AutomatosX
ax doctor grok
ax run backend "Write a hello function" --provider grok
```

### Production Considerations

**Security:**
- Add authentication (API keys, OAuth)
- Use HTTPS with valid certificates
- Implement rate limiting
- Set up firewall rules

**Monitoring:**
- Track GPU utilization
- Monitor response times
- Log all requests
- Set up alerts for failures

**Scaling:**
- Use load balancer for multiple instances
- Implement request queuing
- Add caching layer
- Consider K8s for auto-scaling

### 📄 License Note for Self-Hosted/Commercial Use

**IMPORTANT**: AutomatosX is licensed under Apache 2.0 for **non-commercial use**.

For commercial deployments or to remove license restrictions:

- 💼 **Commercial License**: https://license.defai.digital/automatosx
- 📋 **Enterprise Terms**: Custom agreements for large organizations
- 🤝 **Volume Pricing**: Discounts for teams and multi-user deployments
- 📞 **Support**: Priority support included with commercial licenses

**What counts as commercial use?**
- Using AutomatosX in a business/company setting
- Generating revenue from AutomatosX-powered applications
- Self-hosted deployments in production environments
- Team/organization-wide deployments

**Educational/Research Use**: Free under Apache 2.0 license

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
