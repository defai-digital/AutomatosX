/**
 * Provider Configuration Contract V1
 *
 * Provider-specific configuration schemas for AutomatosX.
 *
 * Invariants:
 * - INV-CFG-CON-003: Provider IDs must be from KNOWN_PROVIDERS
 */

import { z } from 'zod';

// ============================================================================
// Known Providers
// ============================================================================

/**
 * Known provider IDs
 */
export const KNOWN_PROVIDERS = [
  'claude',
  'gemini',
  'codex',
  'grok',
  'opencode',
  'ax-cli',
] as const;

export const ProviderIdSchema = z.enum(KNOWN_PROVIDERS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

/**
 * Checks if a string is a known provider ID
 */
export function isKnownProvider(id: string): id is ProviderId {
  return KNOWN_PROVIDERS.includes(id as ProviderId);
}

// ============================================================================
// Provider Detection Schemas
// ============================================================================

/**
 * Provider CLI detection result
 *
 * Note: AutomatosX does NOT check authentication.
 * All CLIs handle their own authentication internally.
 */
export const ProviderDetectionResultSchema = z.object({
  providerId: ProviderIdSchema,
  detected: z.boolean(),
  command: z.string(),
  version: z.string().optional(),
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
  results: z.array(ProviderDetectionResultSchema),
});

export type ProviderDetectionSummary = z.infer<typeof ProviderDetectionSummarySchema>;

// ============================================================================
// Provider Defaults
// ============================================================================

/**
 * Provider default configuration
 *
 * Note: AutomatosX does NOT manage credentials.
 * All authentication is delegated to CLI tools.
 */
export interface ProviderDefault {
  command: string;
  priority: number;
}

/**
 * Provider defaults by provider ID
 *
 * AutomatosX is a pure orchestrator - all CLIs handle their own authentication.
 */
export const PROVIDER_DEFAULTS: Record<ProviderId, ProviderDefault> = {
  claude: {
    command: 'claude',
    priority: 90,
  },
  gemini: {
    command: 'gemini',
    priority: 80,
  },
  codex: {
    command: 'codex',
    priority: 70,
  },
  grok: {
    command: 'ax-grok',
    priority: 60,
  },
  opencode: {
    command: 'opencode',
    priority: 50,
  },
  'ax-cli': {
    command: 'ax-cli',
    priority: 40,
  },
};

/**
 * Gets provider default configuration
 */
export function getProviderDefault(providerId: ProviderId): ProviderDefault {
  return PROVIDER_DEFAULTS[providerId];
}

// ============================================================================
// Provider Detection Helpers
// ============================================================================

/**
 * Creates an empty detection result for a provider
 */
export function createEmptyDetectionResult(providerId: ProviderId): ProviderDetectionResult {
  const defaults = PROVIDER_DEFAULTS[providerId];
  return {
    providerId,
    detected: false,
    command: defaults.command,
  };
}

/**
 * Creates a detection summary from results
 */
export function createDetectionSummary(
  results: ProviderDetectionResult[]
): ProviderDetectionSummary {
  return {
    timestamp: new Date().toISOString(),
    totalProviders: results.length,
    detectedCount: results.filter((r) => r.detected).length,
    results,
  };
}
