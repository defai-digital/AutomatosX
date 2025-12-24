/**
 * Provider Detection Adapter
 *
 * Implements the ProviderDetectionPort interface for detecting installed provider CLIs.
 *
 * Invariants:
 * - INV-CFG-ADP-002: Detection times out after 5s
 * - INV-CFG-ADP-003: No network calls during detection
 *
 * Note: AutomatosX does NOT check authentication.
 * All CLIs handle their own authentication internally.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProviderDetectionPort, DetectionOptions } from '@automatosx/config-domain';
import {
  type ProviderId,
  type ProviderDetectionResult,
  type ProviderDetectionSummary,
  KNOWN_PROVIDERS,
  PROVIDER_DEFAULTS,
  createDetectionSummary,
  TIMEOUT_HEALTH_CHECK,
  TIMEOUT_FORCE_KILL,
} from '@automatosx/contracts';

const execAsync = promisify(exec);

// ============================================================================
// Constants
// ============================================================================

/**
 * Default detection timeout
 * INV-CFG-ADP-002: Detection times out after 5s
 */
const DEFAULT_TIMEOUT = TIMEOUT_HEALTH_CHECK;

/**
 * Timeout for individual command check
 */
const COMMAND_CHECK_TIMEOUT = TIMEOUT_FORCE_KILL;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates a command name to prevent command injection
 * Only allows alphanumeric characters, hyphens, underscores, and dots
 *
 * @param command - The command to validate
 * @returns true if the command is safe, false otherwise
 */
function isValidCommandName(command: string): boolean {
  // Must be non-empty and contain only safe characters
  // Allows: letters, numbers, hyphens, underscores, dots (for extensions like .exe)
  return /^[a-zA-Z0-9_.-]+$/.test(command);
}

/**
 * Checks if a CLI command is available on the system PATH
 */
async function isCommandAvailable(command: string): Promise<boolean> {
  // Validate command to prevent command injection
  if (!isValidCommandName(command)) {
    return false;
  }

  try {
    const whichCommand = process.platform === 'win32' ? 'where' : 'which';
    await execAsync(`${whichCommand} ${command}`, { timeout: COMMAND_CHECK_TIMEOUT });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the version of a CLI command
 */
async function getCommandVersion(command: string): Promise<string | undefined> {
  // Validate command to prevent command injection
  if (!isValidCommandName(command)) {
    return undefined;
  }

  try {
    const { stdout } = await execAsync(`${command} --version`, {
      timeout: COMMAND_CHECK_TIMEOUT,
    });
    // Extract version number from output
    const versionMatch = /(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)/.exec(stdout);
    return versionMatch?.[1];
  } catch {
    return undefined;
  }
}

// ============================================================================
// Detection Adapter Implementation
// ============================================================================

/**
 * Detects a single provider
 *
 * Note: AutomatosX does NOT check authentication.
 * All CLIs handle their own auth internally.
 * If a CLI is detected, it's considered ready to use.
 */
async function detectProvider(providerId: ProviderId): Promise<ProviderDetectionResult> {
  const defaults = PROVIDER_DEFAULTS[providerId];
  if (defaults === undefined) {
    return {
      providerId,
      detected: false,
      command: providerId, // Use providerId as fallback command name
      error: `Unknown provider: ${providerId}`,
    };
  }
  const command = defaults.command;

  // Check if command is available
  const detected = await isCommandAvailable(command);

  if (!detected) {
    return {
      providerId,
      detected: false,
      command,
    };
  }

  // Get command version
  const version = await getCommandVersion(command);

  return {
    providerId,
    detected: true,
    command,
    version,
  };
}

/**
 * Detects all known providers in parallel
 */
async function detectAllProviders(
  options?: DetectionOptions
): Promise<ProviderDetectionSummary> {
  const providersToDetect = options?.providers ?? [...KNOWN_PROVIDERS];
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  // Track partial results as they complete
  const partialResults = new Map<ProviderId, ProviderDetectionResult>();

  // Create a timeout promise
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<ProviderDetectionResult[]>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Detection timed out after ${timeout}ms`));
    }, timeout);
  });

  // Detect all providers in parallel, tracking partial results
  const detectionPromise = Promise.all(
    providersToDetect.map(async (providerId) => {
      try {
        const result = await detectProvider(providerId);
        partialResults.set(providerId, result);
        return result;
      } catch (error) {
        const defaults = PROVIDER_DEFAULTS[providerId];
        const result: ProviderDetectionResult = {
          providerId,
          detected: false,
          command: defaults?.command ?? providerId,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        partialResults.set(providerId, result);
        return result;
      }
    })
  );

  try {
    const results = await Promise.race([detectionPromise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return createDetectionSummary(results);
  } catch (error) {
    clearTimeout(timeoutId!);
    // On timeout, return partial results collected so far
    const results: ProviderDetectionResult[] = providersToDetect.map((providerId) => {
      const partialResult = partialResults.get(providerId);
      if (partialResult !== undefined) {
        return partialResult;
      }
      // Provider detection was still in progress when timeout occurred
      const defaults = PROVIDER_DEFAULTS[providerId];
      return {
        providerId,
        detected: false,
        command: defaults?.command ?? providerId,
        error: error instanceof Error ? error.message : 'Detection timed out',
      };
    });

    return createDetectionSummary(results);
  }
}

// ============================================================================
// Exported Adapter
// ============================================================================

/**
 * Provider detection adapter
 *
 * Implements the ProviderDetectionPort interface for the config domain.
 *
 * Note: AutomatosX is a pure orchestrator.
 * All CLIs handle their own authentication internally.
 */
export const providerDetectionAdapter: ProviderDetectionPort = {
  detectProvider,
  detectAllProviders,
};

/**
 * Creates a provider detection adapter with custom options
 */
export function createProviderDetectionAdapter(
  defaultOptions?: DetectionOptions
): ProviderDetectionPort {
  return {
    detectProvider,
    async detectAllProviders(options?: DetectionOptions) {
      return detectAllProviders({
        ...defaultOptions,
        ...options,
      });
    },
  };
}
