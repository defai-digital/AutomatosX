/**
 * @automatosx/ability-domain
 *
 * Ability management for AutomatosX agents.
 * Abilities are reusable knowledge modules that can be loaded
 * into agent contexts based on task requirements.
 */

// Types
export type {
  AbilityRegistry,
  AbilityFilter,
  AbilityLoader,
  AbilityLoaderConfig,
  AbilityManager,
  AbilityInjectionOptions,
  AbilityDomainConfig,
} from './types.js';

export { DEFAULT_ABILITY_DOMAIN_CONFIG } from './types.js';

// Registry
export { InMemoryAbilityRegistry, createAbilityRegistry } from './registry.js';

// Loader
export { FileSystemAbilityLoader, createAbilityLoader } from './loader.js';

// Manager
export { DefaultAbilityManager, createAbilityManager } from './manager.js';

// Re-export contract types
export type {
  Ability,
  AbilityManifest,
  AbilityLoadResult,
  AbilityInjectionRequest,
  AbilityInjectionResult,
} from '@automatosx/contracts';

export {
  AbilitySchema,
  AbilityManifestSchema,
  AbilityLoadResultSchema,
  AbilityInjectionRequestSchema,
  AbilityInjectionResultSchema,
  AbilityErrorCode,
  validateAbility,
  safeValidateAbility,
  validateAbilityInjectionRequest,
} from '@automatosx/contracts';
