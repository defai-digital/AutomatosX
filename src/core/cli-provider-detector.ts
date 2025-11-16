/**
 * CLI Provider Detector
 *
 * Cross-platform detection and execution of CLI providers (Claude, Gemini, Codex).
 * Implements three-layer architecture:
 * 1. Configurable Detection (ENV → Config → PATH)
 * 2. Normalized Execution (Windows: cmd.exe /c; Unix: direct spawn)
 * 3. Health Checks (version verification, caching)
 *
 * @module cli-provider-detector
 * @see tmp/PRD-WINDOWS-CLI-DETECTION.md
 */

import { existsSync } from 'fs';
import { delimiter } from 'path';
import { spawn, spawnSync, type ChildProcess, type SpawnOptions } from 'child_process';
import { logger } from '../utils/logger.js';

// ============================================================================
// Type Definitions
// ============================================================================

export type Provider = 'claude' | 'gemini' | 'codex';

export interface ProviderConfig {
  /** Explicit provider paths (highest priority) */
  paths?: Partial<Record<Provider, string>>;

  /** Version check arguments (default: --version) */
  versionArg?: Partial<Record<Provider, string>>;

  /** Timeout configuration in milliseconds */
  timeouts?: {
    detectMs?: number;    // Default: 3000ms
    versionMs?: number;   // Default: 3000ms
    runMs?: number;       // Default: 600000ms (10 min)
  };

  /** Minimum required versions (semver comparison) */
  minVersions?: Partial<Record<Provider, string>>;
}

export interface DetectionReport {
  provider: Provider;
  found: boolean;
  path?: string;
  version?: string;
  reason?: string;  // e.g., "not-found", "version-too-low", "error:..."
}

interface Resolved {
  cmd: string;      // Command to execute
  absPath: string;  // Absolute path to binary
  version?: string; // Detected version
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_VERSION_ARG: Record<Provider, string> = {
  claude: '--version',
  gemini: '--version',
  codex: '--version',
};

const ENV_VAR_NAMES: Record<Provider, string> = {
  claude: 'CLAUDE_CLI',
  gemini: 'GEMINI_CLI',
  codex: 'CODEX_CLI',
};

const PROVIDERS: Provider[] = ['claude', 'gemini', 'codex'];

// In-memory cache for detection results
const DETECT_CACHE = new Map<Provider, Resolved | null>();

/**
 * Clear the detection cache.
 * v5.12.4: Added for test isolation - prevents stale cache between tests.
 *
 * @example
 * ```typescript
 * // In tests
 * import { clearDetectCache } from '@/core/cli-provider-detector';
 * afterEach(() => clearDetectCache());
 * ```
 */
export function clearDetectCache(): void {
  DETECT_CACHE.clear();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Detect all providers and return detailed reports.
 *
 * **Important**: This is an async function and must be properly awaited to avoid
 * unhandled promise rejections.
 *
 * @param config - Optional configuration for detection
 * @returns Promise that resolves to array of detection reports for each provider
 * @throws Never throws - all errors are caught and reported in the DetectionReport
 *
 * @example
 * ```typescript
 * // Correct usage with proper error handling:
 * try {
 *   const reports = await detectAll({
 *     minVersions: { claude: '2.0.0', gemini: '0.8.0' }
 *   });
 *   console.table(reports);
 * } catch (error) {
 *   console.error('Catastrophic detection failure:', error);
 * }
 *
 * // Alternative: Promise-style with catch
 * detectAll(config).catch(err => {
 *   console.error('Detection failed:', err);
 *   return [];  // Return empty array on failure
 * });
 * ```
 */
export async function detectAll(config: ProviderConfig = {}): Promise<DetectionReport[]> {
  const results: DetectionReport[] = [];

  for (const provider of PROVIDERS) {
    try {
      const resolved = await resolveProvider(provider, config);

      if (!resolved) {
        results.push({
          provider,
          found: false,
          reason: 'not-found'
        });
        continue;
      }

      // Check minimum version requirement
      const minVersion = config.minVersions?.[provider];
      if (minVersion && resolved.version) {
        if (compareVersions(resolved.version, minVersion) < 0) {
          results.push({
            provider,
            found: false,
            path: resolved.absPath,
            version: resolved.version,
            reason: `version-too-low (< ${minVersion})`
          });
          continue;
        }
      }

      results.push({
        provider,
        found: true,
        path: resolved.absPath,
        version: resolved.version
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        provider,
        found: false,
        reason: `error:${errorMessage}`
      });
    }
  }

  return results;
}

/**
 * Ensure a specific provider is available and resolved.
 * Throws if provider cannot be found.
 *
 * @param provider - Provider to ensure
 * @param config - Optional configuration
 * @returns Resolved provider information
 * @throws Error if provider not found
 *
 * @example
 * ```typescript
 * await ensureProvider('claude');
 * // Provider is available, can proceed with execution
 * ```
 */
export async function ensureProvider(
  provider: Provider,
  config: ProviderConfig = {}
): Promise<Resolved> {
  const resolved = await resolveProvider(provider, config);

  if (!resolved) {
    throw new Error(
      `Provider "${provider}" not found on this system. ` +
      `Please install it or set ${ENV_VAR_NAMES[provider]} environment variable.`
    );
  }

  return resolved;
}

/**
 * Execute a provider with given arguments.
 * Provider must be resolved first via detectAll() or ensureProvider().
 *
 * @param provider - Provider to run
 * @param args - Command line arguments
 * @param config - Optional configuration
 * @returns Child process
 * @throws Error if provider not resolved
 *
 * @example
 * ```typescript
 * await ensureProvider('claude');
 * const child = runProvider('claude', ['--help']);
 * ```
 */
export function runProvider(
  provider: Provider,
  args: string[],
  config: ProviderConfig = {}
): ChildProcess {
  const resolved = DETECT_CACHE.get(provider);

  if (!resolved) {
    throw new Error(
      `Provider "${provider}" not resolved. ` +
      `Call detectAll() or ensureProvider() first.`
    );
  }

  logger.debug('Executing provider', {
    provider,
    cmd: resolved.cmd,
    args: args.join(' ')
  });

  return spawnCross(resolved.cmd, args, {
    timeoutMs: config.timeouts?.runMs
  });
}

/**
 * Clear detection cache (useful for testing or forcing re-detection).
 */
export function clearCache(): void {
  DETECT_CACHE.clear();
}

// ============================================================================
// Core Resolution Logic
// ============================================================================

/**
 * Resolve provider path using configuration hierarchy:
 * ENV → Config → PATH (auto-detect)
 */
async function resolveProvider(
  provider: Provider,
  config: ProviderConfig
): Promise<Resolved | null> {
  // Check cache first
  if (DETECT_CACHE.has(provider)) {
    return DETECT_CACHE.get(provider) ?? null;
  }

  let absPath: string | null = null;
  let source: 'env' | 'config' | 'path' | null = null;

  // 1) Environment variable (highest priority)
  const envVar = ENV_VAR_NAMES[provider];
  const envPath = process.env[envVar];
  if (envPath && existsSync(envPath)) {
    absPath = envPath;
    source = 'env';
  }

  // 2) Project configuration
  if (!absPath) {
    const configPath = config.paths?.[provider];
    if (configPath && existsSync(configPath)) {
      absPath = configPath;
      source = 'config';
    }
  }

  // 3) PATH auto-detection (lowest priority)
  if (!absPath) {
    const found = findOnPath(provider);
    if (found.found && found.path) {
      absPath = found.path;
      source = 'path';
    }
  }

  // Not found
  if (!absPath) {
    DETECT_CACHE.set(provider, null);
    logger.debug('Provider not found', { provider });
    return null;
  }

  // Version check
  const versionArg = config.versionArg?.[provider] || DEFAULT_VERSION_ARG[provider];
  const version = getVersion(absPath, versionArg, config.timeouts?.versionMs);

  const resolved: Resolved = {
    cmd: absPath,
    absPath,
    version
  };

  DETECT_CACHE.set(provider, resolved);

  logger.debug('Provider resolved', {
    provider,
    source,
    path: absPath,
    version: version || 'unknown'
  });

  return resolved;
}

// ============================================================================
// Platform-Specific Detection
// ============================================================================

/**
 * Find command on PATH using platform-specific method.
 *
 * Windows: where.exe → PATH × PATHEXT fallback
 * Unix: which
 */
export function findOnPath(cmdBase: string): { found: boolean; path?: string } {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    return findOnPathWindows(cmdBase);
  }

  return findOnPathUnix(cmdBase);
}

/**
 * Windows detection using where.exe + PATHEXT fallback
 */
function findOnPathWindows(cmdBase: string): { found: boolean; path?: string } {
  // 1) Try where.exe (fast, built-in since Windows 2003)
  try {
    const where = spawnSync('where', [cmdBase], {
      windowsHide: true,
      timeout: 3000
    });

    if (where.status === 0) {
      const lines = where.stdout
        .toString()
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);

      const firstPath = lines[0];
      if (firstPath) {
        logger.debug('Found via where.exe', { cmdBase, path: firstPath });
        return { found: true, path: firstPath };
      }
    }
  } catch (error) {
    logger.debug('where.exe failed, falling back to PATH scan', { error });
  }

  // 2) Fallback: PATH × PATHEXT scan
  const pathext = (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
    .toUpperCase()
    .split(';')
    .filter(Boolean);

  const pathEntries = (process.env.PATH || '')
    .split(delimiter)
    .filter(Boolean);

  for (const dir of pathEntries) {
    // Try with each PATHEXT extension
    for (const ext of pathext) {
      const fullPath = `${dir}\\${cmdBase}${ext}`;
      if (existsSync(fullPath)) {
        logger.debug('Found via PATH × PATHEXT', { cmdBase, path: fullPath });
        return { found: true, path: fullPath };
      }
    }

    // Also try without extension (might be already complete)
    const pathWithoutExt = `${dir}\\${cmdBase}`;
    if (existsSync(pathWithoutExt)) {
      logger.debug('Found via PATH (no ext)', { cmdBase, path: pathWithoutExt });
      return { found: true, path: pathWithoutExt };
    }
  }

  return { found: false };
}

/**
 * Unix detection using which command
 */
function findOnPathUnix(cmdBase: string): { found: boolean; path?: string } {
  try {
    const which = spawnSync('which', [cmdBase], { timeout: 3000 });

    if (which.status === 0) {
      const path = which.stdout.toString().trim();
      if (path) {
        logger.debug('Found via which', { cmdBase, path });
        return { found: true, path };
      }
    }
  } catch (error) {
    logger.debug('which failed', { cmdBase, error });
  }

  return { found: false };
}

// ============================================================================
// Version Detection
// ============================================================================

/**
 * Get version from provider by executing with --version flag.
 * Returns undefined if version check fails.
 */
function getVersion(
  absPath: string,
  versionArg: string,
  timeoutMs = 3000
): string | undefined {
  try {
    const isWindows = process.platform === 'win32';

    // Windows: Use cmd.exe wrapper for .cmd files
    const cmd = isWindows ? 'cmd.exe' : absPath;
    const args = isWindows ? ['/c', absPath, versionArg] : [versionArg];

    const proc = spawnSync(cmd, args, {
      windowsHide: true,
      timeout: timeoutMs,
      encoding: 'utf8'
    });

    if (proc.status === 0) {
      const output = (proc.stdout?.toString() || proc.stderr?.toString() || '').trim();
      const version = extractVersion(output);
      return version || output || undefined;
    }

    logger.debug('Version check failed', {
      absPath,
      exitCode: proc.status,
      error: proc.error
    });
  } catch (error) {
    logger.debug('Version check error', { absPath, error });
  }

  return undefined;
}

/**
 * Extract semantic version from output string.
 * Looks for pattern: x.y.z
 */
function extractVersion(output: string): string | undefined {
  const match = output.match(/\b(\d+\.\d+\.\d+)\b/);
  return match?.[1];
}

// ============================================================================
// Cross-Platform Execution
// ============================================================================

/**
 * Cross-platform spawn wrapper.
 * Windows: Uses cmd.exe /c wrapper
 * Unix: Direct spawn
 */
export function spawnCross(
  cmdOrPath: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number }
): ChildProcess {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Windows: Use cmd.exe wrapper for .cmd/.bat files
    return spawn('cmd.exe', ['/c', cmdOrPath, ...args], {
      cwd: opts?.cwd,
      windowsHide: true,
      stdio: 'inherit',
      timeout: opts?.timeoutMs
    } as SpawnOptions);
  }

  // Unix: Direct spawn
  return spawn(cmdOrPath, args, {
    cwd: opts?.cwd,
    stdio: 'inherit',
    timeout: opts?.timeoutMs
  } as SpawnOptions);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compare two semantic versions.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 *
 * @example
 * compareVersions('1.2.3', '1.2.4') // -1
 * compareVersions('2.0.0', '1.9.9') // 1
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(n => parseInt(n, 10));
  const bParts = b.split('.').map(n => parseInt(n, 10));

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;

    if (aNum > bNum) return 1;
    if (aNum < bNum) return -1;
  }

  return 0;
}
