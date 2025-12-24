# Config Contract

## Purpose

The Config domain defines configuration schemas for AutomatosX. It handles global and local configuration with proper merging, validation, and defaults.

## Key Concepts

- **GlobalConfig**: System-wide configuration
- **LocalConfig**: Project-specific overrides
- **MergedConfig**: Combined configuration (local overrides global)
- **ConfigPath**: Dot-notation path to config values

## Schemas

| Schema | Purpose |
|--------|---------|
| `ConfigSchema` | Complete configuration structure |
| `ProviderConfigSchema` | Provider-specific settings |
| `StorageConfigSchema` | Storage backend configuration |
| `LoggingConfigSchema` | Logging settings |

## Configuration Locations

| Scope | Location |
|-------|----------|
| Global | `~/.automatosx/config.json` |
| Local | `./.automatosx/config.json` |

## Usage Example

```typescript
import {
  ConfigSchema,
  validateConfig,
  type Config,
} from '@automatosx/contracts/config/v1';

// Validate configuration
const config: Config = validateConfig({
  logLevel: 'info',
  storage: {
    type: 'sqlite',
    path: '~/.automatosx/data.db',
  },
  providers: {
    default: 'claude',
    available: ['claude', 'gemini'],
  },
});

// Access via path
const logLevel = configManager.get('logLevel');

// Set value
await configManager.set('logLevel', 'debug');
```

## Related Domains

- `provider`: Provider configuration
- `guard`: Policy configuration
- `mcp`: config_get, config_set, config_show tools

## Invariants

See [invariants.md](./invariants.md) for behavioral guarantees including:
- INV-CFG-001: Local config overrides global
- INV-CFG-002: Invalid config rejected with clear errors
- INV-CFG-003: Defaults applied for missing values
