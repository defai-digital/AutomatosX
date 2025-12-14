# Provider Integration Design v3 (CLI-Only)

## Key Insight

After reviewing the old automatosx, ax-cli, ax-glm, and ax-grok projects:

**ALL providers use CLI wrappers** - AutomatosX does NOT manage credentials.

| Provider | CLI Command | Auth Handling |
|----------|-------------|---------------|
| Claude | `claude` | `~/.claude/` config |
| Gemini | `gemini` | Google Cloud auth |
| Codex | `codex` | OpenAI auth |
| Qwen | `qwen` | DashScope auth |
| GLM | `ax-glm` | `ZAI_API_KEY` env var |
| Grok | `ax-grok` | `XAI_API_KEY` env var |

**Design**: Spawn CLI process → Parse output → No API keys in AutomatosX

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIAdapter                            │
│  (Generic adapter for all CLI-based providers)          │
│                                                          │
│   - Spawn process with stdin/stdout                     │
│   - Parse output (json, stream-json, text)              │
│   - Classify errors with retry/fallback guidance        │
│   - No API keys stored                                  │
└─────────────────────────────────────────────────────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    │         │           │           │         │         │
    ▼         ▼           ▼           ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│ Claude ││ Gemini ││ Codex  ││  Qwen  ││  GLM   ││  Grok  │
│ Config ││ Config ││ Config ││ Config ││ Config ││ Config │
└────────┘└────────┘└────────┘└────────┘└────────┘└────────┘
    │         │           │           │         │         │
    ▼         ▼           ▼           ▼         ▼         ▼
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐
│claude  ││gemini  ││codex   ││qwen    ││ax-glm  ││ax-grok │
│  CLI   ││  CLI   ││  CLI   ││  CLI   ││  CLI   ││  CLI   │
└────────┘└────────┘└────────┘└────────┘└────────┘└────────┘
```

---

## Package Structure

```
packages/adapters/providers/
├── src/
│   ├── types.ts                    # Shared types (CLI-only)
│   ├── index.ts                    # Exports
│   ├── cli-adapter.ts              # Generic CLI adapter
│   ├── process-manager.ts          # Process spawning
│   ├── output-parser.ts            # Parse CLI output
│   ├── error-classifier.ts         # Error handling
│   ├── registry.ts                 # Provider registry
│   └── providers/
│       ├── index.ts                # Provider exports
│       ├── claude.ts               # Claude CLI config
│       ├── gemini.ts               # Gemini CLI config
│       ├── codex.ts                # Codex CLI config
│       ├── qwen.ts                 # Qwen CLI config
│       ├── glm.ts                  # GLM CLI config (ax-glm)
│       └── grok.ts                 # Grok CLI config (ax-grok)
│
└── package.json                    # No external LLM SDK dependencies
```

---

## CLI Adapter Configuration

```typescript
interface CLIProviderConfig {
  providerId: string;
  command: string;
  args: readonly string[];
  env: Readonly<Record<string, string>>;
  outputFormat: 'json' | 'stream-json' | 'text';
  timeout: number;
  models: readonly ModelConfig[];
}
```

---

## Provider Configurations

### Claude (Official CLI)

```typescript
const claudeConfig: CLIProviderConfig = {
  providerId: 'claude',
  command: 'claude',
  args: ['--print', '--output-format', 'stream-json'],
  env: { TERM: 'dumb', NO_COLOR: '1', CI: 'true' },
  outputFormat: 'stream-json',
  timeout: 120000,
  models: [
    { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', ... },
    // ... more models
  ],
};
```

### Gemini (Official CLI)

```typescript
const geminiConfig: CLIProviderConfig = {
  providerId: 'gemini',
  command: 'gemini',
  args: ['--approval-mode', 'skip', '--output-format', 'json'],
  env: { TERM: 'dumb', NO_COLOR: '1', CI: 'true' },
  outputFormat: 'stream-json',
  timeout: 120000,
  models: [
    { modelId: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', ... },
    // ... more models
  ],
};
```

### GLM (ax-glm CLI)

```typescript
const glmConfig: CLIProviderConfig = {
  providerId: 'glm',
  command: 'ax-glm',  // CLI wrapper handles ZAI_API_KEY
  args: [],
  env: { TERM: 'dumb', NO_COLOR: '1', CI: 'true' },
  outputFormat: 'text',
  timeout: 120000,
  models: [
    { modelId: 'glm-4-plus', name: 'GLM-4 Plus', contextWindow: 128000, ... },
    { modelId: 'glm-4-air', name: 'GLM-4 Air', contextWindow: 128000, ... },
    // ... more models
  ],
};
```

### Grok (ax-grok CLI)

```typescript
const grokConfig: CLIProviderConfig = {
  providerId: 'grok',
  command: 'ax-grok',  // CLI wrapper handles XAI_API_KEY
  args: [],
  env: { TERM: 'dumb', NO_COLOR: '1', CI: 'true' },
  outputFormat: 'text',
  timeout: 120000,
  models: [
    { modelId: 'grok-3', name: 'Grok 3', contextWindow: 131000, ... },
    { modelId: 'grok-2', name: 'Grok 2', contextWindow: 131000, ... },
    // ... more models
  ],
};
```

---

## Error Classification

```typescript
// Error categories with retry/fallback guidance
const RETRY_GUIDANCE = {
  quota: { shouldRetry: false, shouldFallback: true },
  rate_limit: { shouldRetry: true, shouldFallback: false },
  authentication: { shouldRetry: false, shouldFallback: false },
  validation: { shouldRetry: false, shouldFallback: false },
  network: { shouldRetry: true, shouldFallback: true },
  server: { shouldRetry: true, shouldFallback: true },
  timeout: { shouldRetry: true, shouldFallback: true },
  not_found: { shouldRetry: false, shouldFallback: true },
  configuration: { shouldRetry: false, shouldFallback: false },
  unknown: { shouldRetry: false, shouldFallback: true },
};
```

---

## Registry

```typescript
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Register all CLI-based providers
  for (const config of ALL_PROVIDER_CONFIGS) {
    registry.registerFromConfig(config);
  }

  return registry;
}

// ALL_PROVIDER_CONFIGS = [
//   claudeConfig,
//   geminiConfig,
//   codexConfig,
//   qwenConfig,
//   glmConfig,
//   grokConfig,
// ]
```

---

## Summary

| Provider | CLI Command | Auth Location | Status |
|----------|-------------|---------------|--------|
| Claude | `claude` | `~/.claude/` | Done |
| Gemini | `gemini` | Google Cloud | Done |
| Codex | `codex` | OpenAI config | Done |
| Qwen | `qwen` | DashScope | Done |
| GLM | `ax-glm` | `ZAI_API_KEY` | Done |
| Grok | `ax-grok` | `XAI_API_KEY` | Done |

**Key Design Principle**: AutomatosX is a **pure orchestrator** - it spawns CLI processes and parses their output. All authentication and credential management is delegated to the individual CLI tools.

This design:
- Keeps AutomatosX secure (no secrets stored)
- Leverages existing CLI tools' authentication
- Maintains a consistent adapter interface
- Allows easy addition of new providers via CLI wrappers
