# SDK Package Availability Report (Archived)

> Archived for historical reference. Do not treat as current implementation guidance; provider support in v12.7.x uses existing SDKs/CLIs only.

**Date:** 2025-12-07
**Purpose:** Validate SDK packages for PRD-012 Provider Architecture Refactoring

---

## Summary

| Provider | SDK Package | Availability | Recommendation |
|----------|-------------|--------------|----------------|
| GLM (Zhipu AI) | `zhipu-ai-provider` | Community package | Use OpenAI-compatible SDK |
| Grok (xAI) | `@ai-sdk/xai` | Official package | Use directly |
| OpenAI Codex | `@openai/codex-sdk` | Official package | Already integrated |

---

## GLM (Zhipu AI)

### Findings

1. **No official `@zhipuai/sdk` package exists** on npm
2. **Community package available:** `zhipu-ai-provider` (for Vercel AI SDK)
3. **Alternative:** Zhipu AI supports OpenAI-compatible endpoints

### Recommended Approach

Use the OpenAI SDK with Zhipu's OpenAI-compatible API:

```typescript
import OpenAI from 'openai';

const glm = new OpenAI({
  apiKey: process.env.ZAI_API_KEY,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4'
});

const response = await glm.chat.completions.create({
  model: 'glm-4',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

### Available Models (2025)

- `glm-4.6` - Latest (200K context, 128K output)
- `glm-4.5` - Previous version
- `glm-4` - Standard
- `glm-4-flash` - Fast

### Environment Variable

```bash
export ZAI_API_KEY="your-zhipu-api-key"
```

---

## Grok (xAI)

### Findings

1. **Official package available:** `@ai-sdk/xai` (v2.0.39+)
2. **Alternative:** OpenAI SDK with xAI base URL
3. **Full feature support:** Including web_search, x_search, code_execution

### Recommended Approach

Option 1: Use `@ai-sdk/xai` (preferred):
```typescript
import { createXai } from '@ai-sdk/xai';

const xai = createXai({
  apiKey: process.env.XAI_API_KEY
});

const { text } = await generateText({
  model: xai('grok-3'),
  prompt: 'Hello'
});
```

Option 2: Use OpenAI SDK:
```typescript
import OpenAI from 'openai';

const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});
```

### Available Models (2025)

- `grok-4` / `grok-4.1` - Latest with advanced reasoning
- `grok-3` - Standard reasoning
- `grok-3-mini` - Fast
- `grok-2-vision` - Vision capabilities

### Environment Variable

```bash
export XAI_API_KEY="your-xai-api-key"
```

---

## OpenAI Codex

### Findings

1. **Official package:** `@openai/codex-sdk` (already integrated)
2. **Hybrid adapter exists:** `src/integrations/openai-codex/`
3. **SDK-first pattern:** Already implemented

### Implementation

Already complete in AutomatosX. No changes needed.

---

## Implementation Decisions

### GLM Provider

Since no official SDK exists, we will:
1. Use OpenAI SDK with custom baseURL
2. Implement `GLMProvider` as a thin wrapper
3. Support both SDK and CLI modes

```typescript
// src/integrations/ax-glm/sdk-adapter.ts
import OpenAI from 'openai';

export class GLMSdkAdapter {
  private client: OpenAI;

  constructor(options: { apiKey?: string }) {
    this.client = new OpenAI({
      apiKey: options.apiKey || process.env.ZAI_API_KEY,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4'
    });
  }

  async execute(prompt: string, model: string): Promise<Response> {
    return this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }]
    });
  }
}
```

### Grok Provider

We will:
1. Use `@ai-sdk/xai` as primary SDK
2. Fallback to OpenAI SDK if needed
3. Support extended thinking and web search features

```typescript
// src/integrations/ax-grok/sdk-adapter.ts
import { createXai } from '@ai-sdk/xai';
import { generateText } from 'ai';

export class GrokSdkAdapter {
  private xai: ReturnType<typeof createXai>;

  constructor(options: { apiKey?: string }) {
    this.xai = createXai({
      apiKey: options.apiKey || process.env.XAI_API_KEY
    });
  }

  async execute(prompt: string, model: string): Promise<Response> {
    const { text } = await generateText({
      model: this.xai(model),
      prompt
    });
    return { content: text };
  }
}
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "openai": "^4.x",
    "@ai-sdk/xai": "^2.0.39",
    "ai": "^4.x"
  }
}
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| GLM SDK unavailable | Use OpenAI-compatible endpoint |
| xAI API changes | Pin SDK version, monitor releases |
| Rate limits differ | Provider-specific rate limiting |
| Auth token format | Provider-specific env vars |

---

## Next Steps

1. Implement `GLMProvider` using OpenAI SDK
2. Implement `GrokProvider` using `@ai-sdk/xai`
3. Add SDK packages to dependencies
4. Create integration tests
5. Document provider-specific configuration

---

## Sources

- [AI SDK Providers: xAI Grok](https://ai-sdk.dev/providers/ai-sdk-providers/xai)
- [@ai-sdk/xai npm](https://www.npmjs.com/package/@ai-sdk/xai)
- [Zhipu AI Provider](https://ai-sdk.dev/providers/community-providers/zhipu)
- [xAI API Documentation](https://docs.x.ai/docs/overview)
- [GLM-4.6 Hugging Face](https://huggingface.co/zai-org/GLM-4.6)
