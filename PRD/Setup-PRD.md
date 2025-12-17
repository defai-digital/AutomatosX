# AutomatosX Setup Module PRD

**Version**: 2.0.0
**Last Updated**: 2025-12-14
**Status**: Living Document

---

## Executive Summary

The Setup Module provides first-time initialization and ongoing configuration management for AutomatosX. It ensures users can quickly get started with proper provider CLI detection, workspace initialization, and persistent configuration storage.

**Key Objectives:**
1. Zero-friction first-run experience
2. Provider CLI detection and validation
3. Persistent configuration with JSON schema validation
4. Interactive wizard for guided setup
5. Programmatic configuration for CI/CD integration

### Core Principles Alignment

| Principle | Implementation |
|-----------|----------------|
| **Contract-Driven** | All config schemas in `@automatosx/contracts/config/v1` |
| **Domain-Driven** | `ConfigAggregate` as aggregate root with event sourcing |
| **Behavior-Driven** | State machine for config lifecycle, explicit invariants |
| **Governance-Driven** | Audit trail via events, config change policies |

---

## 1. Architecture Overview

### 1.1 Module Placement

```
packages/
├── contracts/src/config/v1/           # Configuration schemas
│   ├── config.ts                      # Main config schema
│   ├── provider-config.ts             # Provider-specific config
│   ├── workspace-config.ts            # Workspace settings
│   └── index.ts                       # Exports
│
├── core/config-domain/                # Configuration domain logic
│   ├── src/
│   │   ├── store.ts                   # Config file read/write
│   │   ├── validator.ts               # Schema validation
│   │   ├── migrator.ts                # Config version migration
│   │   ├── defaults.ts                # Default values
│   │   └── index.ts
│   └── package.json
│
├── cli/src/commands/
│   ├── setup.ts                       # Setup command (interactive wizard)
│   ├── config.ts                      # Config command (get/set/show)
│   └── ...
```

### 1.2 Dependency Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  setup command  │  │  config command │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│           └────────┬───────────┘                            │
│                    ▼                                        │
│           ┌────────────────┐                                │
│           │  config-domain │                                │
│           └────────┬───────┘                                │
│                    │                                        │
│                    ▼                                        │
│           ┌────────────────┐                                │
│           │   contracts    │                                │
│           │  (config/v1)   │                                │
│           └────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Configuration Contract

### 2.1 Main Configuration Schema

```typescript
// packages/contracts/src/config/v1/config.ts

import { z } from 'zod';

/**
 * Configuration file version for migrations
 */
export const CONFIG_VERSION = '1.0.0';

/**
 * Log level enum
 */
export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'silent']);
export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Provider preference for routing
 */
export const ProviderPreferenceSchema = z.object({
  providerId: z.string().min(1),
  priority: z.number().int().min(1).max(100).default(50),
  enabled: z.boolean().default(true),
  modelOverrides: z.record(z.string(), z.boolean()).optional(),
});
export type ProviderPreference = z.infer<typeof ProviderPreferenceSchema>;

/**
 * Execution policy configuration
 */
export const ExecutionPolicySchema = z.object({
  defaultTimeoutMs: z.number().int().min(1000).max(600000).default(120000),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryDelayMs: z.number().int().min(100).max(60000).default(1000),
  enableParallelExecution: z.boolean().default(false),
});
export type ExecutionPolicy = z.infer<typeof ExecutionPolicySchema>;

/**
 * Feature flags configuration
 */
export const FeatureFlagsSchema = z.object({
  enableTracing: z.boolean().default(true),
  enableMemoryPersistence: z.boolean().default(true),
  enableGuard: z.boolean().default(true),
  enableMetrics: z.boolean().default(false),
  experimentalFeatures: z.record(z.string(), z.boolean()).default({}),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/**
 * Workspace configuration
 */
export const WorkspaceConfigSchema = z.object({
  rootPath: z.string().optional(),
  dataDir: z.string().default('.automatosx'),
  memoryDbPath: z.string().default('memory.db'),
  traceDbPath: z.string().default('traces.db'),
  sessionDbPath: z.string().default('sessions.db'),
});
export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

/**
 * Main AutomatosX configuration
 */
export const AutomatosXConfigSchema = z.object({
  // Metadata
  version: z.string().default(CONFIG_VERSION),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),

  // Core settings
  logLevel: LogLevelSchema.default('info'),
  telemetryEnabled: z.boolean().default(false),

  // Provider configuration
  providers: z.array(ProviderPreferenceSchema).default([]),
  defaultProvider: z.string().optional(),

  // Execution settings
  executionPolicy: ExecutionPolicySchema.default({}),

  // Feature flags
  features: FeatureFlagsSchema.default({}),

  // Workspace settings
  workspace: WorkspaceConfigSchema.default({}),

  // User preferences
  preferences: z.object({
    colorOutput: z.boolean().default(true),
    verboseErrors: z.boolean().default(false),
    confirmDestructive: z.boolean().default(true),
    defaultOutputFormat: z.enum(['text', 'json', 'yaml']).default('text'),
  }).default({}),
});

export type AutomatosXConfig = z.infer<typeof AutomatosXConfigSchema>;

/**
 * Validates configuration
 */
export function validateConfig(data: unknown): AutomatosXConfig {
  return AutomatosXConfigSchema.parse(data);
}

/**
 * Safely validates configuration
 */
export function safeValidateConfig(
  data: unknown
): { success: true; data: AutomatosXConfig } | { success: false; error: z.ZodError } {
  const result = AutomatosXConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
```

### 2.2 Provider Configuration Schema

```typescript
// packages/contracts/src/config/v1/provider-config.ts

import { z } from 'zod';

/**
 * Known provider IDs
 */
export const KNOWN_PROVIDERS = [
  'claude',
  'gemini',
  'codex',
  'qwen',
  'glm',
  'grok',
] as const;

export const ProviderIdSchema = z.enum(KNOWN_PROVIDERS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

/**
 * Provider CLI detection result
 */
export const ProviderDetectionResultSchema = z.object({
  providerId: ProviderIdSchema,
  detected: z.boolean(),
  command: z.string(),
  version: z.string().optional(),
  configPath: z.string().optional(),
  authenticated: z.boolean().optional(),
  error: z.string().optional(),
});

export type ProviderDetectionResult = z.infer<typeof ProviderDetectionResultSchema>;

/**
 * Provider detection summary
 */
export const ProviderDetectionSummarySchema = z.object({
  timestamp: z.string().datetime(),
  totalProviders: z.number().int(),
  detectedCount: z.number().int(),
  authenticatedCount: z.number().int(),
  results: z.array(ProviderDetectionResultSchema),
});

export type ProviderDetectionSummary = z.infer<typeof ProviderDetectionSummarySchema>;
```

### 2.3 Configuration Error Codes

```typescript
// packages/contracts/src/config/v1/errors.ts

export const ConfigErrorCode = {
  // File operations
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_READ_ERROR: 'CONFIG_READ_ERROR',
  CONFIG_WRITE_ERROR: 'CONFIG_WRITE_ERROR',
  CONFIG_PERMISSION_DENIED: 'CONFIG_PERMISSION_DENIED',

  // Validation
  CONFIG_VALIDATION_ERROR: 'CONFIG_VALIDATION_ERROR',
  CONFIG_SCHEMA_MISMATCH: 'CONFIG_SCHEMA_MISMATCH',

  // Migration
  CONFIG_MIGRATION_REQUIRED: 'CONFIG_MIGRATION_REQUIRED',
  CONFIG_MIGRATION_FAILED: 'CONFIG_MIGRATION_FAILED',

  // Provider
  PROVIDER_NOT_DETECTED: 'PROVIDER_NOT_DETECTED',
  PROVIDER_NOT_AUTHENTICATED: 'PROVIDER_NOT_AUTHENTICATED',

  // Setup
  SETUP_ALREADY_COMPLETE: 'SETUP_ALREADY_COMPLETE',
  SETUP_INCOMPLETE: 'SETUP_INCOMPLETE',

  // State machine
  CONFIG_INVALID_TRANSITION: 'CONFIG_INVALID_TRANSITION',
} as const;

export type ConfigErrorCode = (typeof ConfigErrorCode)[keyof typeof ConfigErrorCode];
```

### 2.4 Configuration Event Schema (Event Sourcing)

```typescript
// packages/contracts/src/config/v1/events.ts

import { z } from 'zod';

/**
 * Config status state machine
 */
export const ConfigStatusSchema = z.enum([
  'uninitialized',  // No config exists
  'valid',          // Config exists and is valid
  'invalid',        // Config exists but failed validation
  'migrating',      // Config is being migrated
]);

export type ConfigStatus = z.infer<typeof ConfigStatusSchema>;

/**
 * Valid state transitions
 */
export const CONFIG_TRANSITIONS: Record<ConfigStatus, ConfigStatus[]> = {
  uninitialized: ['valid'],
  valid: ['valid', 'invalid', 'migrating'],
  invalid: ['valid', 'uninitialized'],
  migrating: ['valid', 'invalid'],
};

/**
 * Config event types
 */
export const ConfigEventTypeSchema = z.enum([
  'config.created',
  'config.updated',
  'config.reset',
  'config.migrated',
  'config.deleted',
  'config.validationFailed',
]);

export type ConfigEventType = z.infer<typeof ConfigEventTypeSchema>;

/**
 * Base config event (follows BaseEvent pattern)
 */
export const ConfigBaseEventSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.number().int().min(1),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
  spanId: z.string().optional(),
  traceId: z.string().optional(),
});

/**
 * Config event payload variants
 */
export const ConfigEventPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('created'),
    scope: z.enum(['global', 'local']),
    config: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal('updated'),
    scope: z.enum(['global', 'local']),
    path: z.string(),
    oldValue: z.unknown(),
    newValue: z.unknown(),
  }),
  z.object({
    type: z.literal('reset'),
    scope: z.enum(['global', 'local']),
  }),
  z.object({
    type: z.literal('migrated'),
    fromVersion: z.string(),
    toVersion: z.string(),
  }),
  z.object({
    type: z.literal('deleted'),
    scope: z.enum(['global', 'local']),
  }),
  z.object({
    type: z.literal('validationFailed'),
    errors: z.array(z.string()),
  }),
]);

export type ConfigEventPayload = z.infer<typeof ConfigEventPayloadSchema>;

/**
 * Full config event schema
 */
export const ConfigEventSchema = ConfigBaseEventSchema.extend({
  type: ConfigEventTypeSchema,
  payload: ConfigEventPayloadSchema,
});

export type ConfigEvent = z.infer<typeof ConfigEventSchema>;

/**
 * Checks if state transition is valid
 */
export function isValidConfigTransition(
  from: ConfigStatus,
  to: ConfigStatus
): boolean {
  return CONFIG_TRANSITIONS[from].includes(to);
}
```

### 2.5 Operation Input/Output Schemas

```typescript
// packages/contracts/src/config/v1/operations.ts

import { z } from 'zod';
import { AutomatosXConfigSchema } from './config.js';

/**
 * Setup operation input
 */
export const SetupInputSchema = z.object({
  scope: z.enum(['global', 'local']).default('global'),
  force: z.boolean().default(false),
  nonInteractive: z.boolean().default(false),
  idempotencyKey: z.string().uuid().optional(),
});

export type SetupInput = z.infer<typeof SetupInputSchema>;

/**
 * Setup operation output
 */
export const SetupOutputSchema = z.object({
  success: z.boolean(),
  configPath: z.string(),
  providers: z.object({
    detected: z.array(z.string()),
    authenticated: z.array(z.string()),
    enabled: z.array(z.string()),
  }),
  defaultProvider: z.string().optional(),
  version: z.string(),
  correlationId: z.string().uuid(),
});

export type SetupOutput = z.infer<typeof SetupOutputSchema>;

/**
 * Config get operation input
 */
export const ConfigGetInputSchema = z.object({
  path: z.string().min(1),
  scope: z.enum(['global', 'local', 'merged']).default('merged'),
});

export type ConfigGetInput = z.infer<typeof ConfigGetInputSchema>;

/**
 * Config get operation output
 */
export const ConfigGetOutputSchema = z.object({
  path: z.string(),
  value: z.unknown(),
  scope: z.enum(['global', 'local', 'merged']),
  found: z.boolean(),
});

export type ConfigGetOutput = z.infer<typeof ConfigGetOutputSchema>;

/**
 * Config set operation input
 */
export const ConfigSetInputSchema = z.object({
  path: z.string().min(1),
  value: z.unknown(),
  scope: z.enum(['global', 'local']).default('global'),
  idempotencyKey: z.string().uuid().optional(),
});

export type ConfigSetInput = z.infer<typeof ConfigSetInputSchema>;

/**
 * Config set operation output
 */
export const ConfigSetOutputSchema = z.object({
  success: z.boolean(),
  path: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  correlationId: z.string().uuid(),
});

export type ConfigSetOutput = z.infer<typeof ConfigSetOutputSchema>;

/**
 * Config reset operation input
 */
export const ConfigResetInputSchema = z.object({
  scope: z.enum(['global', 'local', 'all']).default('global'),
  confirm: z.boolean().default(false),
  idempotencyKey: z.string().uuid().optional(),
});

export type ConfigResetInput = z.infer<typeof ConfigResetInputSchema>;
```

---

## 3. Configuration Domain

### 3.1 Config Store Interface

```typescript
// packages/core/config-domain/src/store.ts

import type { AutomatosXConfig } from '@automatosx/contracts';

/**
 * Configuration file paths
 */
export const CONFIG_PATHS = {
  global: '~/.automatosx/config.json',
  local: '.automatosx/config.json',
} as const;

/**
 * Config store interface
 */
export interface ConfigStore {
  /**
   * Checks if configuration exists
   */
  exists(scope?: 'global' | 'local'): Promise<boolean>;

  /**
   * Reads configuration from file
   */
  read(scope?: 'global' | 'local'): Promise<AutomatosXConfig | undefined>;

  /**
   * Writes configuration to file
   */
  write(config: AutomatosXConfig, scope?: 'global' | 'local'): Promise<void>;

  /**
   * Deletes configuration file
   */
  delete(scope?: 'global' | 'local'): Promise<boolean>;

  /**
   * Gets the resolved config path
   */
  getPath(scope?: 'global' | 'local'): string;

  /**
   * Merges local config over global config
   */
  readMerged(): Promise<AutomatosXConfig>;
}

/**
 * Creates a config store
 */
export function createConfigStore(): ConfigStore;
```

### 3.2 Config Operations

```typescript
// packages/core/config-domain/src/operations.ts

import type { AutomatosXConfig } from '@automatosx/contracts';

/**
 * Gets a config value by path
 * @example getValue(config, 'providers.0.priority')
 */
export function getValue<T>(
  config: AutomatosXConfig,
  path: string
): T | undefined;

/**
 * Sets a config value by path (immutable)
 * @example setValue(config, 'logLevel', 'debug')
 */
export function setValue(
  config: AutomatosXConfig,
  path: string,
  value: unknown
): AutomatosXConfig;

/**
 * Removes a config value by path (immutable)
 */
export function removeValue(
  config: AutomatosXConfig,
  path: string
): AutomatosXConfig;

/**
 * Deep merges two configs (immutable)
 */
export function mergeConfigs(
  base: AutomatosXConfig,
  override: Partial<AutomatosXConfig>
): AutomatosXConfig;

/**
 * Validates config and returns errors
 */
export function validateConfigWithErrors(
  config: unknown
): { valid: true; config: AutomatosXConfig } | { valid: false; errors: string[] };
```

### 3.3 Default Configuration

```typescript
// packages/core/config-domain/src/defaults.ts

import type { AutomatosXConfig } from '@automatosx/contracts';

/**
 * Default configuration for new installations
 */
export const DEFAULT_CONFIG: AutomatosXConfig = {
  version: '1.0.0',
  logLevel: 'info',
  telemetryEnabled: false,

  providers: [],
  defaultProvider: undefined,

  executionPolicy: {
    defaultTimeoutMs: 120000,
    maxRetries: 3,
    retryDelayMs: 1000,
    enableParallelExecution: false,
  },

  features: {
    enableTracing: true,
    enableMemoryPersistence: true,
    enableGuard: true,
    enableMetrics: false,
    experimentalFeatures: {},
  },

  workspace: {
    dataDir: '.automatosx',
    memoryDbPath: 'memory.db',
    traceDbPath: 'traces.db',
    sessionDbPath: 'sessions.db',
  },

  preferences: {
    colorOutput: true,
    verboseErrors: false,
    confirmDestructive: true,
    defaultOutputFormat: 'text',
  },
};

/**
 * Provider defaults by provider ID
 */
export const PROVIDER_DEFAULTS: Record<string, {
  command: string;
  configPath: string;
  priority: number;
}> = {
  claude: {
    command: 'claude',
    configPath: '~/.claude/',
    priority: 90,
  },
  gemini: {
    command: 'gemini',
    configPath: '~/.gemini/',
    priority: 80,
  },
  codex: {
    command: 'codex',
    configPath: '~/.codex/',
    priority: 70,
  },
  qwen: {
    command: 'qwen',
    configPath: '~/.qwen/',
    priority: 60,
  },
  glm: {
    command: 'ax-glm',
    configPath: '~/.ax-glm/',
    priority: 50,
  },
  grok: {
    command: 'ax-grok',
    configPath: '~/.ax-grok/',
    priority: 50,
  },
};
```

### 3.4 Config Migration

```typescript
// packages/core/config-domain/src/migrator.ts

import type { AutomatosXConfig } from '@automatosx/contracts';

/**
 * Migration function signature
 */
export type ConfigMigration = (config: unknown) => unknown;

/**
 * Registered migrations (version -> migration function)
 */
export const MIGRATIONS: Record<string, ConfigMigration> = {
  // Example: '0.9.0': (config) => ({ ...config, newField: 'default' }),
};

/**
 * Migrates config to latest version
 */
export function migrateConfig(config: unknown): AutomatosXConfig;

/**
 * Checks if migration is needed
 */
export function needsMigration(config: unknown): boolean;

/**
 * Gets current config version
 */
export function getConfigVersion(config: unknown): string | undefined;
```

### 3.5 Config Aggregate (Event Sourcing)

```typescript
// packages/core/config-domain/src/aggregate.ts

import type {
  AutomatosXConfig,
  ConfigEvent,
  ConfigStatus,
  ConfigErrorCode,
} from '@automatosx/contracts';

/**
 * Config aggregate state
 */
export interface ConfigAggregateState {
  status: ConfigStatus;
  config: AutomatosXConfig | undefined;
  version: number;
  lastUpdatedAt: string | undefined;
  pendingEvents: ConfigEvent[];
}

/**
 * Config aggregate - the aggregate root for configuration
 *
 * Invariants:
 * - INV-CFG-AGG-001: State transitions follow CONFIG_TRANSITIONS
 * - INV-CFG-AGG-002: Version increments on every event
 * - INV-CFG-AGG-003: Events are immutable once committed
 */
export class ConfigAggregate {
  private state: ConfigAggregateState;

  constructor(events: ConfigEvent[] = []) {
    this.state = this.rehydrate(events);
  }

  /**
   * Creates config (only from uninitialized state)
   */
  create(
    config: AutomatosXConfig,
    scope: 'global' | 'local',
    correlationId: string
  ): ConfigEvent {
    this.assertTransition('valid');
    // ... emit config.created event
  }

  /**
   * Updates a config value
   */
  update(
    path: string,
    value: unknown,
    scope: 'global' | 'local',
    correlationId: string
  ): ConfigEvent {
    this.assertTransition('valid');
    // ... emit config.updated event
  }

  /**
   * Resets config to defaults
   */
  reset(
    scope: 'global' | 'local',
    correlationId: string
  ): ConfigEvent {
    this.assertTransition('uninitialized');
    // ... emit config.reset event
  }

  /**
   * Applies event to state (event sourcing)
   */
  private apply(event: ConfigEvent): void {
    // State machine enforcement
  }

  /**
   * Rehydrates state from events
   */
  private rehydrate(events: ConfigEvent[]): ConfigAggregateState {
    let state = this.initialState();
    for (const event of events) {
      state = this.applyToState(state, event);
    }
    return state;
  }

  /**
   * Asserts transition is valid
   */
  private assertTransition(to: ConfigStatus): void {
    if (!isValidConfigTransition(this.state.status, to)) {
      throw new ConfigError(
        ConfigErrorCode.CONFIG_INVALID_TRANSITION,
        `Cannot transition from ${this.state.status} to ${to}`
      );
    }
  }

  /**
   * Gets current state (readonly)
   */
  getState(): Readonly<ConfigAggregateState> {
    return this.state;
  }

  /**
   * Gets uncommitted events
   */
  getUncommittedEvents(): ConfigEvent[] {
    return [...this.state.pendingEvents];
  }
}
```

### 3.6 Config Repository

```typescript
// packages/core/config-domain/src/repository.ts

import type { ConfigAggregate, ConfigEvent } from './aggregate.js';

/**
 * Config repository interface (follows Repository pattern)
 */
export interface ConfigRepository {
  /**
   * Loads config aggregate from store
   */
  load(scope: 'global' | 'local'): Promise<ConfigAggregate>;

  /**
   * Saves config aggregate (commits events)
   */
  save(aggregate: ConfigAggregate): Promise<void>;

  /**
   * Gets event history
   */
  getEvents(
    scope: 'global' | 'local',
    options?: { limit?: number; since?: string }
  ): Promise<ConfigEvent[]>;
}

/**
 * Creates a file-based config repository
 */
export function createConfigRepository(): ConfigRepository;
```

---

## 4. Provider Detection (Adapter Layer)

> **Note**: Provider detection involves side effects (process spawning, file system access).
> Following hexagonal architecture, this belongs in the **adapter layer**, not core domain.

```
packages/
├── core/config-domain/           # Pure domain logic
└── adapters/provider-detection/  # Side-effect adapter
    ├── src/
    │   ├── detector.ts           # Detection logic
    │   ├── cli-checker.ts        # CLI availability checks
    │   └── auth-checker.ts       # Auth verification
    └── package.json
```

### 4.1 Detection Port (Domain Interface)

```typescript
// packages/core/config-domain/src/ports/detection.ts

import type {
  ProviderId,
  ProviderDetectionResult,
  ProviderDetectionSummary,
} from '@automatosx/contracts';

/**
 * Provider detection port (interface for adapters)
 */
export interface ProviderDetectionPort {
  detectProvider(providerId: ProviderId): Promise<ProviderDetectionResult>;
  detectAllProviders(): Promise<ProviderDetectionSummary>;
}
```

### 4.2 Detection Adapter

```typescript
// packages/adapters/provider-detection/src/detector.ts

import type { ProviderDetectionPort } from '@automatosx/config-domain';

/**
 * CLI-based provider detection adapter
 */
export function createProviderDetectionAdapter(): ProviderDetectionPort {
  return {
    async detectProvider(providerId) {
      // Spawn CLI, check auth, etc.
    },
    async detectAllProviders() {
      // Parallel detection with timeout
    },
  };
}
```

### 4.3 Detection Logic

```typescript
// packages/core/config-domain/src/detection.ts

import type {
  ProviderId,
  ProviderDetectionResult,
  ProviderDetectionSummary,
} from '@automatosx/contracts';

/**
 * Detects if a CLI command is available
 */
export async function isCommandAvailable(command: string): Promise<boolean>;

/**
 * Gets CLI version (if available)
 */
export async function getCommandVersion(command: string): Promise<string | undefined>;

/**
 * Checks if provider is authenticated
 * Different providers have different auth mechanisms:
 * - claude: Checks ~/.claude/ for config
 * - gemini: Checks Google Cloud auth or ~/.gemini/
 * - codex: Checks OpenAI auth
 * - qwen: Checks DashScope auth
 * - glm: Checks ZAI_API_KEY env var
 * - grok: Checks XAI_API_KEY env var
 */
export async function isProviderAuthenticated(
  providerId: ProviderId
): Promise<{ authenticated: boolean; details?: string }>;

/**
 * Detects a single provider
 */
export async function detectProvider(
  providerId: ProviderId
): Promise<ProviderDetectionResult>;

/**
 * Detects all known providers
 */
export async function detectAllProviders(): Promise<ProviderDetectionSummary>;
```

### 4.2 Detection Rules by Provider

| Provider | CLI Command | Auth Check | Config Location |
|----------|-------------|------------|-----------------|
| Claude | `claude --version` | `~/.claude/` exists | `~/.claude/config.json` |
| Gemini | `gemini --version` | `gcloud auth list` or `~/.gemini/` | `~/.gemini/settings.json` |
| Codex | `codex --version` | `~/.codex/` or `OPENAI_API_KEY` | `~/.codex/config.toml` |
| Qwen | `qwen --version` | `DASHSCOPE_API_KEY` or `~/.qwen/` | `~/.qwen/config.json` |
| GLM | `ax-glm --version` | `ZAI_API_KEY` env var | `~/.ax-glm/config.json` |
| Grok | `ax-grok --version` | `XAI_API_KEY` env var | `~/.ax-grok/config.json` |

---

## 5. CLI Commands

### 5.1 Setup Command

**Command:** `ax setup`

**Description:** Interactive wizard for first-time setup or reconfiguration.

**Flags:**
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--non-interactive` | boolean | false | Skip prompts, use defaults |
| `--force` | boolean | false | Overwrite existing config |
| `--global` | boolean | true | Write to global config |
| `--local` | boolean | false | Write to local (project) config |

**Wizard Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                    AutomatosX Setup                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: System Check                                       │
│  ├── Node.js version: v20.11.0 ✓                           │
│  ├── Permissions: ~/.automatosx writable ✓                  │
│  └── Disk space: OK ✓                                       │
│                                                             │
│  Step 2: Provider Detection                                 │
│  ├── claude: Detected (v1.0.0) ✓ Authenticated             │
│  ├── gemini: Detected (v2.0.0) ✓ Authenticated             │
│  ├── codex: Not detected ✗                                  │
│  ├── qwen: Detected ✓ Not authenticated                     │
│  ├── glm: Not detected ✗                                    │
│  └── grok: Not detected ✗                                   │
│                                                             │
│  Step 3: Provider Configuration                             │
│  ? Select providers to enable: [claude, gemini]             │
│  ? Set default provider: claude                             │
│                                                             │
│  Step 4: Preferences                                        │
│  ? Enable telemetry: No                                     │
│  ? Log level: info                                          │
│  ? Enable color output: Yes                                 │
│                                                             │
│  Step 5: Feature Flags                                      │
│  ? Enable tracing: Yes                                      │
│  ? Enable memory persistence: Yes                           │
│  ? Enable Guard governance: Yes                             │
│                                                             │
│  ✓ Configuration saved to ~/.automatosx/config.json         │
│                                                             │
│  Next steps:                                                │
│  1. Run `ax doctor` to verify installation                  │
│  2. Run `ax list` to see available workflows                │
│  3. Run `ax run <workflow>` to execute a workflow           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Output (JSON format with `--non-interactive`):**

```json
{
  "success": true,
  "configPath": "~/.automatosx/config.json",
  "providers": {
    "detected": ["claude", "gemini", "qwen"],
    "authenticated": ["claude", "gemini"],
    "enabled": ["claude", "gemini"]
  },
  "defaultProvider": "claude",
  "version": "1.0.0"
}
```

### 5.2 Config Command

**Command:** `ax config <subcommand>`

**Subcommands:**

#### 5.2.1 `ax config show`

Shows current configuration.

**Flags:**
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | string | text | Output format: text, json, yaml |
| `--scope` | string | merged | Config scope: global, local, merged |

**Output:**
```
AutomatosX Configuration (merged)
─────────────────────────────────
Version: 1.0.0
Log Level: info
Telemetry: disabled

Providers:
  1. claude (priority: 90, enabled) [DEFAULT]
  2. gemini (priority: 80, enabled)

Execution Policy:
  Timeout: 120000ms
  Max Retries: 3
  Parallel: disabled

Features:
  Tracing: enabled
  Memory: enabled
  Guard: enabled
  Metrics: disabled

Workspace:
  Data Dir: .automatosx
  Memory DB: memory.db
  Trace DB: traces.db
```

#### 5.2.2 `ax config get <path>`

Gets a specific config value.

**Examples:**
```bash
ax config get logLevel
# Output: info

ax config get providers.0.providerId
# Output: claude

ax config get features.enableTracing
# Output: true
```

#### 5.2.3 `ax config set <path> <value>`

Sets a config value.

**Flags:**
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--scope` | string | global | Config scope: global, local |

**Examples:**
```bash
ax config set logLevel debug
# Output: Set logLevel = debug

ax config set features.enableMetrics true
# Output: Set features.enableMetrics = true

ax config set providers.0.priority 100
# Output: Set providers.0.priority = 100
```

#### 5.2.4 `ax config reset`

Resets configuration to defaults.

**Flags:**
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--scope` | string | global | Config scope: global, local, all |
| `--confirm` | boolean | - | Skip confirmation prompt |

#### 5.2.5 `ax config path`

Shows config file paths.

**Output:**
```
Global: ~/.automatosx/config.json (exists)
Local:  .automatosx/config.json (not found)
```

---

## 6. Behavioral Invariants

### 6.1 Setup Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-CFG-001 | Schema Validation | All config files validated against Zod schema before write |
| INV-CFG-002 | Atomic Writes | Config writes are atomic (write to temp, then rename) |
| INV-CFG-003 | Local Override | Local config values override global config values |
| INV-CFG-004 | Version Tracking | Config version tracked for migration support |
| INV-CFG-005 | Default Safety | Missing fields use safe defaults |

### 6.2 Provider Detection Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-DET-001 | Non-Blocking | Provider detection never blocks on network calls |
| INV-DET-002 | Timeout Safety | CLI version checks timeout after 5 seconds |
| INV-DET-003 | Graceful Failure | Detection failures don't crash setup |
| INV-DET-004 | Cache Results | Detection results cached for session |

### 6.3 Setup Flow Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-SET-001 | Idempotent | Running setup twice produces same result |
| INV-SET-002 | Rollback Safe | Failed setup doesn't leave partial config |
| INV-SET-003 | Non-Destructive | Setup without --force preserves existing config |

---

## 7. Error Handling

### 7.1 Error Responses

```typescript
interface SetupError {
  code: ConfigErrorCode;
  message: string;
  details?: Record<string, unknown>;
  recoveryHint?: string;
}
```

### 7.2 Error Scenarios

| Error Code | Scenario | Recovery Hint |
|------------|----------|---------------|
| CONFIG_NOT_FOUND | No config file exists | Run `ax setup` to create configuration |
| CONFIG_PERMISSION_DENIED | Cannot write to config directory | Check permissions on ~/.automatosx/ |
| CONFIG_VALIDATION_ERROR | Config file is malformed | Run `ax config reset` to restore defaults |
| PROVIDER_NOT_DETECTED | Provider CLI not installed | Install provider CLI: `npm install -g @anthropic/claude-cli` |
| PROVIDER_NOT_AUTHENTICATED | Provider CLI not authenticated | Run provider auth: `claude auth login` |

---

## 8. Integration with Doctor Command

The existing `doctor` command should integrate with the config system:

```typescript
// Enhancement to doctor command
interface DoctorCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

// New checks to add:
const CONFIG_CHECKS: DoctorCheck[] = [
  {
    name: 'Configuration File',
    check: async () => {
      const store = createConfigStore();
      return store.exists('global');
    },
  },
  {
    name: 'Configuration Valid',
    check: async () => {
      const store = createConfigStore();
      const config = await store.read('global');
      return validateConfigWithErrors(config).valid;
    },
  },
  {
    name: 'Default Provider Set',
    check: async () => {
      const store = createConfigStore();
      const config = await store.readMerged();
      return config.defaultProvider !== undefined;
    },
  },
  {
    name: 'At Least One Provider Enabled',
    check: async () => {
      const store = createConfigStore();
      const config = await store.readMerged();
      return config.providers.some(p => p.enabled);
    },
  },
];
```

---

## 9. File Structure

### 9.1 Config Directory Structure

```
~/.automatosx/
├── config.json              # Main configuration
├── providers/               # Provider-specific data
│   ├── claude.json          # Claude preferences
│   ├── gemini.json          # Gemini preferences
│   └── ...
├── cache/                   # Cached data
│   ├── provider-detection.json
│   └── model-list.json
└── data/                    # Persistent data (default location)
    ├── memory.db
    ├── traces.db
    └── sessions.db
```

### 9.2 Local Project Config

```
project/
├── .automatosx/
│   ├── config.json          # Project-specific overrides
│   └── data/                # Project-specific data
│       ├── memory.db
│       └── ...
└── ...
```

---

## 10. Implementation Plan

### Phase 1: Contracts (1 day)

1. Create `packages/contracts/src/config/v1/` directory
2. Implement `config.ts` with main schema
3. Implement `provider-config.ts` with provider schemas
4. Implement `errors.ts` with error codes
5. Export from `packages/contracts/src/index.ts`
6. Add contract tests

### Phase 2: Config Domain (2 days)

1. Create `packages/core/config-domain/` package
2. Implement `store.ts` for file operations
3. Implement `operations.ts` for config manipulation
4. Implement `defaults.ts` with default values
5. Implement `detection.ts` for provider detection
6. Implement `migrator.ts` for version migrations
7. Add domain tests

### Phase 3: CLI Commands (2 days)

1. Implement `ax setup` command with wizard
2. Implement `ax config show` subcommand
3. Implement `ax config get` subcommand
4. Implement `ax config set` subcommand
5. Implement `ax config reset` subcommand
6. Implement `ax config path` subcommand
7. Update `ax doctor` to use config system
8. Add CLI tests

### Phase 4: Integration (1 day)

1. Wire config-domain to CLI
2. Update other commands to use config
3. Add integration tests
4. Update documentation

---

## 11. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Setup Completion | `ax setup` creates valid config in < 30 seconds |
| Provider Detection | All installed providers detected correctly |
| Config Validation | Invalid config rejected with clear error messages |
| Migration Support | Old configs migrated without data loss |
| Test Coverage | > 80% coverage on config-domain |
| CLI UX | Setup wizard completes in < 10 prompts |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Global Config** | User-wide configuration at `~/.automatosx/config.json` |
| **Local Config** | Project-specific configuration at `.automatosx/config.json` |
| **Merged Config** | Local config values overlaid on global config |
| **Provider Detection** | Automatic discovery of installed CLI providers |
| **Config Migration** | Automatic upgrade of config files to newer schema versions |

---

---

## 13. MCP Integration

Config operations should be exposed via MCP for programmatic access from AI assistants.

### 13.1 MCP Tools

```typescript
// packages/mcp-server/src/tools/config.ts

/**
 * config_get tool - Get configuration value
 */
export const configGetTool: MCPTool = {
  name: 'config_get',
  description: 'Get a configuration value by path',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Config path (e.g., "logLevel", "providers.0.providerId")',
      },
      scope: {
        type: 'string',
        enum: ['global', 'local', 'merged'],
        default: 'merged',
      },
    },
    required: ['path'],
  },
};

/**
 * config_set tool - Set configuration value
 */
export const configSetTool: MCPTool = {
  name: 'config_set',
  description: 'Set a configuration value',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Config path to set',
      },
      value: {
        description: 'Value to set',
      },
      scope: {
        type: 'string',
        enum: ['global', 'local'],
        default: 'global',
      },
    },
    required: ['path', 'value'],
  },
};

/**
 * config_show tool - Show full configuration
 */
export const configShowTool: MCPTool = {
  name: 'config_show',
  description: 'Show the full configuration',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['global', 'local', 'merged'],
        default: 'merged',
      },
    },
  },
};
```

### 13.2 MCP Resources

```typescript
// packages/mcp-server/src/resources/config.ts

/**
 * Config resource - read-only access to configuration
 */
export const configResource: MCPResource = {
  uri: 'automatosx://config',
  name: 'Configuration',
  description: 'Current AutomatosX configuration (merged)',
  mimeType: 'application/json',
};

/**
 * Config events resource - audit trail
 */
export const configEventsResource: MCPResource = {
  uri: 'automatosx://config/events',
  name: 'Config Events',
  description: 'Configuration change audit trail',
  mimeType: 'application/json',
};
```

---

## 14. Governance Integration

### 14.1 Config Change Policy

Sensitive configuration changes should be governed by Guard policies.

```typescript
// packages/contracts/src/guard/v1/policies/config-change.ts

import type { Policy } from '../schema.js';

/**
 * Config change governance policy
 *
 * Controls which config changes are allowed in different contexts.
 */
export const configChangePolicy: Policy = {
  policyId: 'config-change',

  // Paths that can be modified freely
  allowedPaths: [
    'logLevel',
    'preferences.*',
    'providers.*.priority',
    'executionPolicy.*',
  ],

  // Paths that require confirmation or are restricted
  forbiddenPaths: [
    // Cannot disable guard in CI
    'features.enableGuard',
    // Cannot disable tracing in production
    'features.enableTracing',
  ],

  // Gates to run
  gates: [
    'configValidation',  // Ensure new config is valid
    'sensitiveChange',   // Warn on security-sensitive changes
  ],

  // Max config changes per session
  changeRadiusLimit: 10,
};
```

### 14.2 Config Gates

```typescript
// packages/guard/src/gates/config.ts

import type { Gate, GateResult } from '@automatosx/contracts';

/**
 * Config validation gate
 *
 * Ensures configuration is valid before allowing changes.
 */
export const configValidationGate: Gate = {
  gateId: 'configValidation',

  async check(context): Promise<GateResult> {
    const { newConfig } = context;
    const validation = safeValidateConfig(newConfig);

    if (!validation.success) {
      return {
        passed: false,
        gateId: 'configValidation',
        message: 'Invalid configuration',
        details: {
          errors: validation.error.errors.map(e => e.message),
        },
      };
    }

    return { passed: true, gateId: 'configValidation' };
  },
};

/**
 * Sensitive change gate
 *
 * Warns when security-sensitive settings are modified.
 */
export const sensitiveChangeGate: Gate = {
  gateId: 'sensitiveChange',

  async check(context): Promise<GateResult> {
    const { path, oldValue, newValue } = context;

    const sensitivePaths = [
      'features.enableGuard',
      'features.enableTracing',
      'telemetryEnabled',
    ];

    if (sensitivePaths.some(p => path.startsWith(p))) {
      return {
        passed: true,  // Allow but warn
        gateId: 'sensitiveChange',
        message: `Warning: Modifying security-sensitive setting "${path}"`,
        details: {
          oldValue,
          newValue,
          requiresConfirmation: true,
        },
      };
    }

    return { passed: true, gateId: 'sensitiveChange' };
  },
};
```

### 14.3 Audit Trail Integration

All config changes are automatically tracked via events:

```typescript
// Example audit query
const auditTrail = await configRepository.getEvents('global', {
  since: '2025-01-01T00:00:00Z',
  limit: 100,
});

// Output:
// [
//   { type: 'config.created', timestamp: '...', correlationId: '...' },
//   { type: 'config.updated', path: 'logLevel', oldValue: 'info', newValue: 'debug' },
//   { type: 'config.updated', path: 'providers.0.priority', oldValue: 90, newValue: 100 },
// ]
```

---

## 15. Updated Behavioral Invariants

### 15.1 Contract Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-CFG-CON-001 | Schema Single Source | All config types derived from Zod schemas |
| INV-CFG-CON-002 | Version Tracking | Config includes version for migrations |
| INV-CFG-CON-003 | Provider ID Validation | Provider IDs must be from KNOWN_PROVIDERS |
| INV-CFG-CON-004 | Default Provider Valid | defaultProvider must exist in providers array |

### 15.2 Domain Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-CFG-DOM-001 | Aggregate Root | ConfigAggregate is the only entry point |
| INV-CFG-DOM-002 | Event Sourcing | State derived from events, never mutated directly |
| INV-CFG-DOM-003 | State Machine | Transitions follow CONFIG_TRANSITIONS |
| INV-CFG-DOM-004 | Idempotent Operations | Same idempotencyKey = same result |

### 15.3 Adapter Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-CFG-ADP-001 | Atomic Writes | Config writes are atomic (temp + rename) |
| INV-CFG-ADP-002 | Detection Timeout | Provider detection times out after 5s |
| INV-CFG-ADP-003 | Detection Non-Blocking | No network calls during detection |

### 15.4 Governance Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-CFG-GOV-001 | Audit Trail | All changes emit events |
| INV-CFG-GOV-002 | Sensitive Protection | Security settings require confirmation |
| INV-CFG-GOV-003 | Validation Before Write | Invalid configs never persisted |

---

## 16. Updated Implementation Plan

### Phase 1: Contracts (1 day)

1. Create `packages/contracts/src/config/v1/` directory
2. Implement `config.ts` - main schema
3. Implement `events.ts` - event schemas + state machine
4. Implement `operations.ts` - input/output schemas
5. Implement `errors.ts` - error codes
6. Export from contracts index
7. Add contract tests

### Phase 2: Config Domain (2 days)

1. Create `packages/core/config-domain/` package
2. Implement `aggregate.ts` - ConfigAggregate
3. Implement `repository.ts` - ConfigRepository
4. Implement `operations.ts` - pure functions
5. Implement `ports/detection.ts` - detection interface
6. Add domain tests

### Phase 3: Adapters (1 day)

1. Create `packages/adapters/provider-detection/`
2. Implement detection adapter
3. Implement file-based config repository
4. Add adapter tests

### Phase 4: CLI Commands (2 days)

1. Implement `ax setup` with wizard
2. Implement `ax config` subcommands
3. Update `ax doctor` integration
4. Add CLI tests

### Phase 5: MCP & Governance (1 day)

1. Add `config_get`, `config_set`, `config_show` tools
2. Add config resources
3. Add config change policy
4. Add config gates
5. Add integration tests

---

## 17. References

- [COMPARISON.md](./COMPARISON.md) - Feature comparison showing setup gaps
- [PROVIDER-DESIGN-v3.md](./PROVIDER-DESIGN-v3.md) - CLI-only provider architecture
- [Agentic-PRD.md](./Agentic-PRD.md) - Core domain contracts
- [MCP-PRD.md](./MCP-PRD.md) - MCP server specification

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-14 | AutomatosX Team | Initial Setup PRD |
| 2.0.0 | 2025-12-14 | AutomatosX Team | Added event sourcing, state machine, aggregate root, MCP tools, governance integration |
