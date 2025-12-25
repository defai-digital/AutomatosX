/**
 * Provider Detection Port
 *
 * Interface for provider detection adapters (hexagonal architecture).
 * The actual implementation belongs in the adapter layer.
 *
 * Invariants:
 * - INV-CFG-ADP-002: Detection times out after 5s
 * - INV-CFG-ADP-003: No network calls during detection
 */

import type {
  ProviderId,
  ProviderDetectionResult,
  ProviderDetectionSummary,
} from '@defai.digital/contracts';

// ============================================================================
// Detection Port Interface
// ============================================================================

/**
 * Provider detection port (interface for adapters)
 *
 * This port defines the interface that detection adapters must implement.
 * The domain depends on this interface, not on concrete implementations.
 */
export interface ProviderDetectionPort {
  /**
   * Detects a single provider
   */
  detectProvider(providerId: ProviderId): Promise<ProviderDetectionResult>;

  /**
   * Detects all known providers
   */
  detectAllProviders(): Promise<ProviderDetectionSummary>;
}

/**
 * Detection options
 */
export interface DetectionOptions {
  /**
   * Timeout in milliseconds (default: 5000)
   */
  timeout?: number;

  /**
   * Providers to detect (default: all)
   */
  providers?: ProviderId[];
}

// ============================================================================
// Null Detection Adapter
// ============================================================================

/**
 * Null detection adapter that returns no providers
 * Used as a fallback when no adapter is configured
 *
 * Note: AutomatosX does NOT check authentication.
 * All CLIs handle their own auth internally.
 */
export const nullDetectionAdapter: ProviderDetectionPort = {
  async detectProvider(providerId: ProviderId): Promise<ProviderDetectionResult> {
    return {
      providerId,
      detected: false,
      command: providerId, // Use providerId as fallback command name
    };
  },

  async detectAllProviders(): Promise<ProviderDetectionSummary> {
    return {
      timestamp: new Date().toISOString(),
      totalProviders: 0,
      detectedCount: 0,
      results: [],
    };
  },
};

// ============================================================================
// Detection Adapter Registry
// ============================================================================

let currentAdapter: ProviderDetectionPort = nullDetectionAdapter;

/**
 * Sets the provider detection adapter
 */
export function setDetectionAdapter(adapter: ProviderDetectionPort): void {
  currentAdapter = adapter;
}

/**
 * Gets the current provider detection adapter
 */
export function getDetectionAdapter(): ProviderDetectionPort {
  return currentAdapter;
}

/**
 * Resets to the null adapter
 */
export function resetDetectionAdapter(): void {
  currentAdapter = nullDetectionAdapter;
}
