/**
 * @automatosx/provider-detection
 *
 * Provider CLI detection adapter for AutomatosX.
 *
 * This adapter implements the ProviderDetectionPort interface from config-domain,
 * detecting installed provider CLIs and their authentication status.
 *
 * Design:
 * - Uses local filesystem and PATH checks only
 * - No network calls during detection (INV-CFG-ADP-003)
 * - Times out after 5s (INV-CFG-ADP-002)
 */

export {
  providerDetectionAdapter,
  createProviderDetectionAdapter,
} from './detection-adapter.js';

// Re-export types from config-domain for convenience
export type {
  ProviderDetectionPort,
  DetectionOptions,
} from '@automatosx/config-domain';
