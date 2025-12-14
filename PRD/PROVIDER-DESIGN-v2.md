# Provider Integration Design v2 (CLI-Only)

## Key Principle

**AutomatosX does NOT manage credentials.**

Each provider CLI handles its own authentication:
- `claude` → Uses `~/.claude/` config or Anthropic's auth
- `gemini` → Uses Google Cloud auth or `~/.gemini/` config
- `codex` → Uses OpenAI's auth mechanism
- `qwen` → Uses DashScope auth

AutomatosX simply spawns these CLI processes and parses their output.

---

## Why CLI-Only?

| Aspect | CLI-Only | SDK-Based |
|--------|----------|-----------|
| Credential Management | None (delegated) | Must store API keys |
| Security | No secrets in AutomatosX | API keys in env/config |
| Dependencies | None (just spawn) | SDK packages per provider |
| Maintenance | Low (CLIs evolve independently) | High (SDK version updates) |
| User Setup | Configure each CLI once | Configure keys in AutomatosX |

**CLI-Only is simpler, more secure, and aligns with separation of concerns.**

---

## Architecture

### Single Adapter Pattern

```
┌─────────────────────────────────────────────────────────┐
│                    ProviderPort                          │
│  execute(request) → Promise<ExecutionResult>            │
│  checkHealth() → Promise<HealthCheckResult>             │
│  getModels() → Model[]                                  │
│  isAvailable() → Promise<boolean>                       │
└─────────────────────────────────────────────────────────┘
                          │
                          │ implements
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  CLIProviderAdapter                      │
│                                                          │
│  - Spawns CLI process                                   │
│  - Writes prompt to stdin                               │
│  - Reads response from stdout                           │
│  - Parses output format                                 │
│  - Handles timeouts and errors                          │
└─────────────────────────────────────────────────────────┘
                          │
                          │ configured per provider
                          ▼
┌────────┬────────┬────────┬────────┬────────┬────────┐
│ Claude │ Gemini │ Codex  │  Qwen  │  GLM   │  Grok  │
└────────┴────────┴────────┴────────┴────────┴────────┘
```

### Package Structure (Simplified)

```
packages/
├── contracts/
│   └── src/provider/v1/
│       ├── provider.schema.json      # Provider definition
│       ├── request.schema.json       # Execution request
│       ├── response.schema.json      # Execution response
│       └── cli-config.schema.json    # CLI configuration
│
├── core/
│   └── provider-domain/
│       └── src/
│           ├── ports.ts              # ProviderPort interface
│           ├── circuit-breaker.ts    # Failure protection
│           ├── router.ts             # Provider selection
│           └── health.ts             # Health tracking
│
└── adapters/
    └── provider-cli/                  # SINGLE adapter package
        └── src/
            ├── cli-adapter.ts         # Generic CLI adapter
            ├── providers/
            │   ├── claude.ts          # Claude CLI config
            │   ├── gemini.ts          # Gemini CLI config
            │   ├── codex.ts           # Codex CLI config
            │   ├── qwen.ts            # Qwen CLI config
            │   ├── glm.ts             # GLM CLI config (if available)
            │   └── grok.ts            # Grok CLI config (if available)
            ├── process-manager.ts     # Process spawn/kill
            ├── output-parser.ts       # Parse CLI output
            └── index.ts
```

---

## CLI Configuration Contract

Each provider is configured with CLI-specific settings:

```typescript
interface CLIProviderConfig {
  providerId: string;           // 'claude', 'gemini', etc.
  command: string;              // CLI command name
  args: string[];               // Default arguments
  env: Record<string, string>;  // Environment variables (non-secret)
  outputFormat: 'json' | 'stream-json' | 'text';
  timeout: number;              // Default timeout in ms
  models: ModelConfig[];        // Available models
}

interface ModelConfig {
  modelId: string;
  name: string;
  contextWindow: number;
  capabilities: ('text' | 'code' | 'vision')[];
  isDefault?: boolean;
}
```

---

## Provider Configurations

### Claude

```typescript
const claudeConfig: CLIProviderConfig = {
  providerId: 'claude',
  command: 'claude',
  args: ['--print', '--output-format', 'stream-json'],
  env: {
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',
  timeout: 120000,
  models: [
    { modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, capabilities: ['text', 'code', 'vision'], isDefault: true },
    { modelId: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextWindow: 200000, capabilities: ['text', 'code', 'vision'] },
  ],
};
```

### Gemini

```typescript
const geminiConfig: CLIProviderConfig = {
  providerId: 'gemini',
  command: 'gemini',
  args: ['--approval-mode', 'auto_edit', '--output-format', 'stream-json'],
  env: {
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'stream-json',
  timeout: 120000,
  models: [
    { modelId: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1000000, capabilities: ['text', 'code', 'vision'], isDefault: true },
    { modelId: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1000000, capabilities: ['text', 'code', 'vision'] },
  ],
};
```

### Codex (OpenAI)

```typescript
const codexConfig: CLIProviderConfig = {
  providerId: 'codex',
  command: 'codex',
  args: ['--json'],
  env: {
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'json',
  timeout: 120000,
  models: [
    { modelId: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, capabilities: ['text', 'code', 'vision'], isDefault: true },
    { modelId: 'o1', name: 'o1', contextWindow: 200000, capabilities: ['text', 'code'] },
  ],
};
```

### Qwen

```typescript
const qwenConfig: CLIProviderConfig = {
  providerId: 'qwen',
  command: 'qwen',
  args: [],  // Interactive by default, need to investigate non-interactive mode
  env: {
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: 'true',
  },
  outputFormat: 'text',
  timeout: 120000,
  models: [
    { modelId: 'qwen-max', name: 'Qwen Max', contextWindow: 32000, capabilities: ['text', 'code'], isDefault: true },
    { modelId: 'qwen-turbo', name: 'Qwen Turbo', contextWindow: 1000000, capabilities: ['text', 'code'] },
  ],
};
```

### GLM (if CLI available)

```typescript
const glmConfig: CLIProviderConfig = {
  providerId: 'glm',
  command: 'ax-glm',
  args: ['-p'],  // Print mode (non-interactive)
  env: {
    TERM: 'dumb',
    NO_COLOR: '1',
  },
  outputFormat: 'text',
  timeout: 120000,
  models: [
    { modelId: 'glm-4-plus', name: 'GLM-4 Plus', contextWindow: 128000, capabilities: ['text', 'code'], isDefault: true },
  ],
};
```

### Grok (if CLI available)

```typescript
const grokConfig: CLIProviderConfig = {
  providerId: 'grok',
  command: 'ax-grok',
  args: ['-p'],  // Print mode (non-interactive)
  env: {
    TERM: 'dumb',
    NO_COLOR: '1',
  },
  outputFormat: 'text',
  timeout: 120000,
  models: [
    { modelId: 'grok-3', name: 'Grok 3', contextWindow: 131000, capabilities: ['text', 'code'], isDefault: true },
  ],
};
```

---

## CLI Adapter Implementation

### Core Adapter (Generic)

```typescript
// packages/adapters/provider-cli/src/cli-adapter.ts

interface CLIAdapter extends ProviderPort {
  readonly config: CLIProviderConfig;
}

function createCLIAdapter(config: CLIProviderConfig): CLIAdapter {
  return {
    providerId: config.providerId,
    config,

    async execute(request: ExecutionRequest): Promise<ExecutionResult> {
      const startTime = Date.now();

      try {
        // 1. Build command
        const args = [...config.args];

        // 2. Spawn process
        const result = await spawnCLI({
          command: config.command,
          args,
          stdin: request.prompt,
          env: { ...process.env, ...config.env },
          timeout: request.options?.timeout ?? config.timeout,
        });

        // 3. Parse output
        const parsed = parseOutput(result.stdout, config.outputFormat);

        // 4. Return result
        return {
          success: true,
          requestId: request.requestId,
          content: parsed.content,
          usage: estimateTokenUsage(request.prompt, parsed.content),
          finishReason: 'stop',
          latencyMs: Date.now() - startTime,
          modelId: request.modelId,
          cached: false,
        };
      } catch (error) {
        return {
          success: false,
          requestId: request.requestId,
          error: classifyError(error),
          latencyMs: Date.now() - startTime,
        };
      }
    },

    async checkHealth(): Promise<HealthCheckResult> {
      const startTime = Date.now();
      const available = await isCommandAvailable(config.command);

      return {
        providerId: config.providerId,
        timestamp: Date.now(),
        status: available ? 'healthy' : 'unhealthy',
        latencyMs: Date.now() - startTime,
        details: {
          cliAvailable: available,
          cliCommand: config.command,
        },
      };
    },

    getModels(): Model[] {
      return config.models;
    },

    async isAvailable(): Promise<boolean> {
      return isCommandAvailable(config.command);
    },

    estimateTokens(text: string): number {
      return Math.ceil(text.length / 4);
    },
  };
}
```

### Process Manager

```typescript
// packages/adapters/provider-cli/src/process-manager.ts

interface SpawnOptions {
  command: string;
  args: string[];
  stdin: string;
  env: Record<string, string | undefined>;
  timeout: number;
}

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function spawnCLI(options: SpawnOptions): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Timeout handling
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, options.timeout);

    // Collect output
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    // Write prompt to stdin
    child.stdin.write(options.stdin);
    child.stdin.end();

    // Handle completion
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(new Error('Process timed out'));
      } else if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}
```

### Output Parser

```typescript
// packages/adapters/provider-cli/src/output-parser.ts

interface ParsedOutput {
  content: string;
  metadata?: Record<string, unknown>;
}

function parseOutput(stdout: string, format: 'json' | 'stream-json' | 'text'): ParsedOutput {
  switch (format) {
    case 'json':
      return parseJSON(stdout);
    case 'stream-json':
      return parseStreamJSON(stdout);
    case 'text':
      return { content: stdout.trim() };
  }
}

function parseJSON(stdout: string): ParsedOutput {
  const data = JSON.parse(stdout);
  return {
    content: data.content ?? data.text ?? data.response ?? stdout,
    metadata: data,
  };
}

function parseStreamJSON(stdout: string): ParsedOutput {
  // Stream JSON: one JSON object per line
  const lines = stdout.trim().split('\n');
  const chunks: string[] = [];

  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.content) chunks.push(data.content);
      if (data.text) chunks.push(data.text);
    } catch {
      // Skip non-JSON lines
    }
  }

  return { content: chunks.join('') };
}
```

---

## Token Estimation

Since CLIs typically don't return exact token counts, we estimate:

```typescript
function estimateTokenUsage(prompt: string, completion: string): TokenUsage {
  // Conservative estimate: ~4 characters per token
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(completion.length / 4);

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}
```

---

## Error Classification

Errors are classified from CLI output and exit codes:

```typescript
function classifyError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error);

  // Timeout
  if (message.includes('timed out')) {
    return { category: 'network', shouldRetry: true, shouldFallback: true, message };
  }

  // Command not found
  if (message.includes('ENOENT') || message.includes('not found')) {
    return { category: 'configuration', shouldRetry: false, shouldFallback: true, message };
  }

  // Rate limit (from stderr)
  if (/rate.?limit|too.?many.?requests|overloaded/i.test(message)) {
    return { category: 'rate_limit', shouldRetry: true, shouldFallback: false, message };
  }

  // Auth error (from stderr)
  if (/unauthorized|invalid.?key|permission.?denied/i.test(message)) {
    return { category: 'authentication', shouldRetry: false, shouldFallback: false, message };
  }

  // Generic error
  return { category: 'unknown', shouldRetry: false, shouldFallback: true, message };
}
```

---

## Provider Registry

```typescript
// packages/adapters/provider-cli/src/registry.ts

import { claudeConfig, geminiConfig, codexConfig, qwenConfig, glmConfig, grokConfig } from './providers';

const ALL_CONFIGS: CLIProviderConfig[] = [
  claudeConfig,
  geminiConfig,
  codexConfig,
  qwenConfig,
  glmConfig,
  grokConfig,
];

interface ProviderRegistry {
  getProvider(providerId: string): CLIAdapter | undefined;
  listProviders(): CLIAdapter[];
  listAvailableProviders(): Promise<CLIAdapter[]>;
}

function createProviderRegistry(): ProviderRegistry {
  const adapters = new Map<string, CLIAdapter>();

  // Create adapters for all known providers
  for (const config of ALL_CONFIGS) {
    adapters.set(config.providerId, createCLIAdapter(config));
  }

  return {
    getProvider(providerId: string): CLIAdapter | undefined {
      return adapters.get(providerId);
    },

    listProviders(): CLIAdapter[] {
      return Array.from(adapters.values());
    },

    async listAvailableProviders(): Promise<CLIAdapter[]> {
      const results = await Promise.all(
        Array.from(adapters.values()).map(async (adapter) => ({
          adapter,
          available: await adapter.isAvailable(),
        }))
      );
      return results.filter((r) => r.available).map((r) => r.adapter);
    },
  };
}
```

---

## Health Check Flow

```
User runs: ax doctor

1. For each registered provider:
   a. Check if CLI command exists (which <command>)
   b. If exists, mark as "available"
   c. If not, mark as "not installed"

2. Display results:
   ┌─────────┬───────────────┬────────────┐
   │ Provider│ CLI Command   │ Status     │
   ├─────────┼───────────────┼────────────┤
   │ claude  │ claude        │ ✓ Available│
   │ gemini  │ gemini        │ ✓ Available│
   │ codex   │ codex         │ ✗ Not found│
   │ qwen    │ qwen          │ ✗ Not found│
   │ glm     │ ax-glm        │ ✗ Not found│
   │ grok    │ ax-grok       │ ✗ Not found│
   └─────────┴───────────────┴────────────┘
```

---

## What This Design Removes

Compared to my previous (wrong) design:

| Removed | Reason |
|---------|--------|
| API key environment variables | CLIs handle their own auth |
| OpenAI SDK dependency | Not needed for CLI-only |
| `OpenAICompatAdapterBase` | No SDK adapters |
| Base URL configuration | CLIs have built-in endpoints |
| Separate packages per provider | One package with configs |
| Credential validation | Delegated to CLIs |

---

## Implementation Priority

### Phase 1: Core Infrastructure
1. CLI provider contracts (`packages/contracts/src/provider/v1/`)
2. CLI adapter implementation (`packages/adapters/provider-cli/`)
3. Process manager and output parser

### Phase 2: Primary Providers
4. Claude configuration and testing
5. Gemini configuration and testing

### Phase 3: Secondary Providers
6. Codex configuration (if CLI stable)
7. Qwen configuration (if CLI stable)

### Phase 4: Integration
8. Wire to routing engine
9. Wire to CLI and MCP server

### Future (if needed)
- SDK-based adapters (separate package) for providers without CLIs
- Only if CLI approach proves insufficient

---

## Benefits of This Approach

1. **Zero credential management** - AutomatosX never sees API keys
2. **Single adapter code path** - Less code, fewer bugs
3. **Provider independence** - Each CLI evolves independently
4. **User simplicity** - Configure each CLI once, AutomatosX just uses them
5. **Security** - No secrets in AutomatosX config or memory
6. **Testability** - Mock CLI output, not SDK responses

---

## When to Consider SDK Adapters

Only add SDK-based adapters if:
1. A provider has no CLI (or CLI is discontinued)
2. CLI is too unreliable for production use
3. Specific SDK-only features are required (e.g., streaming, function calling)

In that case, create a SEPARATE package (`provider-sdk-openai`, etc.) that:
- Uses the provider's official SDK
- Requires API key in environment
- Follows the same `ProviderPort` interface
