/**
 * Configuration Validation Limits, Paths, and Constants
 *
 * Centralized constants for the AutomatosX system to avoid hardcoded values.
 *
 * Defines security limits and validation functions to prevent:
 * - Resource exhaustion (DoS)
 * - Path traversal attacks
 * - Command injection
 * - Name injection
 */

// ============================================
// Directory Path Constants
// ============================================

/**
 * AutomatosX directory structure constants
 * All paths are relative to project root
 */
export const AX_PATHS = {
  /** Root directory for AutomatosX data */
  ROOT: '.automatosx',
  /** Log files directory */
  LOGS: '.automatosx/logs',
  /** Memory/database directory */
  MEMORY: '.automatosx/memory',
  /** Agent workspaces directory */
  WORKSPACES: '.automatosx/workspaces',
  /** Session data directory */
  SESSIONS: '.automatosx/sessions',
  /** Team configurations directory */
  TEAMS: '.automatosx/teams',
  /** Agent profiles directory */
  AGENTS: '.automatosx/agents',
  /** Workflow definitions directory */
  WORKFLOWS: '.automatosx/workflows',
  /** Abilities/skills directory */
  ABILITIES: '.automatosx/abilities',
  /** Checkpoints directory */
  CHECKPOINTS: '.automatosx/checkpoints',
  /** Cache directory */
  CACHE: '.automatosx/cache',
  /** Task database directory */
  TASKS: '.automatosx/tasks',
  /** Status files directory */
  STATUS: '.automatosx/status',
  /** Provider configurations directory */
  PROVIDERS: '.automatosx/providers',
  /** Iterate mode directory */
  ITERATE: '.automatosx/iterate',
  /** State directory (mode, provider overrides) */
  STATE: '.automatosx/state',
  /** Usage tracking directory */
  USAGE: '.automatosx/usage',
  /** Context store directory */
  CONTEXT: '.automatosx/context',
  /** Telemetry directory */
  TELEMETRY: '.automatosx/telemetry',
  /** Workspace index directory */
  WORKSPACE: '.automatosx/workspace',
  /** Config file paths */
  CONFIG_YAML: '.automatosx/config.yaml',
  CONFIG_JSON: '.automatosx/config.json'
} as const;

// ============================================
// Time Unit Constants (milliseconds)
// ============================================

/** Time unit constants for readable timeout definitions */
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// ============================================
// Timeout Constants (milliseconds)
// ============================================

/**
 * Standardized timeout values used across the codebase
 */
export const TIMEOUTS = {
  /** Default provider execution timeout (2 minutes) */
  PROVIDER_DEFAULT: 2 * MINUTE,
  /** Provider detection/health check timeout (5 seconds) */
  PROVIDER_DETECTION: 5 * SECOND,
  /** Database busy timeout (5 seconds) */
  DATABASE_BUSY: 5 * SECOND,
  /** Provider cooldown after failure (30 seconds) */
  PROVIDER_COOLDOWN: 30 * SECOND,
  /** Circuit breaker recovery timeout (1 minute) */
  CIRCUIT_BREAKER_RECOVERY: 1 * MINUTE,
  /** Circuit breaker failure window (5 minutes) */
  CIRCUIT_BREAKER_WINDOW: 5 * MINUTE,
  /** Health check interval (5 minutes) */
  HEALTH_CHECK_INTERVAL: 5 * MINUTE,
  /** Idle connection timeout (5 minutes) */
  IDLE_CONNECTION: 5 * MINUTE,
  /** User decision/prompt timeout (10 minutes) */
  USER_DECISION: 10 * MINUTE,
  /** Maximum execution timeout (1 hour) */
  MAX_EXECUTION: 1 * HOUR,
  /** Default global timeout (25 minutes) */
  GLOBAL_DEFAULT: 25 * MINUTE,
  /** Config cache TTL (1 minute) */
  CONFIG_CACHE_TTL: 1 * MINUTE,
  /** Score cache TTL (5 minutes) */
  SCORE_CACHE_TTL: 5 * MINUTE,
  /** MCP health check interval (30 seconds) */
  MCP_HEALTH_CHECK: 30 * SECOND,
  /** CLI command confirmation delay (5 seconds) */
  CLI_CONFIRM_DELAY: 5 * SECOND,
  /** Kill switch confirmation delay (5 seconds) */
  KILL_SWITCH_DELAY: 5 * SECOND,
  /** Minimum rollout duration (1 hour) */
  MIN_ROLLOUT_DURATION: 1 * HOUR,
  /** Graceful shutdown timeout (30 seconds) */
  GRACEFUL_SHUTDOWN: 30 * SECOND,
  /** Package installation timeout (1 minute) */
  PACKAGE_INSTALL: 1 * MINUTE,
  /** Quick CLI command timeout (3 seconds) */
  QUICK_COMMAND: 3 * SECOND,
  /** CLI version check timeout (10 seconds) */
  VERSION_CHECK: 10 * SECOND,
  /** MCP agent execution timeout (30 minutes) */
  MCP_AGENT_EXECUTION: 30 * MINUTE
} as const;

// ============================================
// Database Constants
// ============================================

/**
 * Database configuration constants
 */
export const DATABASE = {
  /** SQLite busy timeout in milliseconds */
  BUSY_TIMEOUT: 5000,
  /** Maximum database connections in pool */
  MAX_CONNECTIONS: 10,
  /** Connection idle timeout (5 minutes) */
  IDLE_TIMEOUT: 300000,
  /** Default query limit */
  DEFAULT_QUERY_LIMIT: 1000,
  /** Maximum query limit */
  MAX_QUERY_LIMIT: 10000
} as const;

// ============================================
// Scoring Weights (for provider selection)
// ============================================

/**
 * Provider scoring weights (must sum to 1.0)
 */
export const SCORING_WEIGHTS = {
  /** Weight for latency in provider scoring */
  LATENCY: 0.5,
  /** Weight for cost in provider scoring */
  COST: 0.3,
  /** Weight for reliability in provider scoring */
  RELIABILITY: 0.2
} as const;

/**
 * Performance thresholds for scoring
 */
export const PERFORMANCE_THRESHOLDS = {
  /** Excellent performance threshold */
  EXCELLENT: 0.9,
  /** Good performance threshold */
  GOOD: 0.7,
  /** Progress cap percentage */
  PROGRESS_CAP: 95
} as const;

// ============================================
// Security and Resource Limits
// ============================================

/**
 * Security and resource limits for configuration validation
 */
export const VALIDATION_LIMITS = {
  // Resource limits (prevent DoS)
  MAX_ENTRIES: 1000000,         // 1 million entries (memory, cache)
  MAX_TIMEOUT: 3600000,         // 1 hour (execution, delegation)
  MAX_FILE_SIZE: 104857600,     // 100 MB (workspace, abilities)
  MAX_CACHE_SIZE: 524288000,    // 500 MB (cache storage)
  MAX_SESSIONS: 10000,          // 10k concurrent sessions

  // Performance limits (prevent resource exhaustion)
  MAX_CONCURRENT_AGENTS: 100,   // Maximum concurrent agents
  MAX_CPU_PERCENT: 80,          // Maximum CPU usage percent
  MAX_MEMORY_MB: 2048,          // Maximum memory usage in MB

  // Config validation limits
  MAX_CONFIG_FILE_SIZE: 1048576, // 1MB max config file size
  MAX_NAME_LENGTH: 50,          // Max name length for agents/providers
  MAX_COMMAND_LENGTH: 100,      // Max command length
  MAX_ARRAY_LENGTH: 10000,      // Max array elements in config

  // Path and file limits
  MIN_FILE_SIZE: 1,             // Minimum file size in bytes
  MIN_TIMEOUT: 1000,            // Minimum timeout in ms (1 second)
  MIN_INTERVAL: 100,            // Minimum interval in ms
  MIN_BACKOFF_FACTOR: 1.0,      // Minimum backoff multiplier
  MAX_BACKOFF_FACTOR: 5.0,       // Maximum backoff multiplier
  MAX_TTL: 86400000,            // Maximum TTL in ms (24 hours)
  MIN_BYTES: 1,                 // Minimum bytes for file sizes

  // Network limits
  MIN_PORT: 1024,               // Minimum port number
  MAX_PORT: 65535               // Maximum port number
} as const;

/**
 * Validate relative path (prevent path traversal)
 *
 * Security checks:
 * - No absolute paths (/)
 * - No parent directory references (../)
 * - No Windows absolute paths (C:\)
 *
 * @param path - Path to validate
 * @returns true if path is safe relative path
 *
 * @example
 * ```typescript
 * isValidRelativePath('.automatosx/config.yaml')  // ✅ true
 * isValidRelativePath('/etc/passwd')              // ❌ false
 * isValidRelativePath('../../../etc/passwd')      // ❌ false
 * ```
 */
export function isValidRelativePath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Normalize path separators first (Windows uses backslashes)
  const normalizedPath = path.replace(/\\/g, '/');

  // No absolute Unix paths
  if (normalizedPath.startsWith('/')) {
    return false;
  }

  // No parent directory traversal
  if (normalizedPath.includes('..')) {
    return false;
  }

  // No absolute Windows paths (C:, D:, etc.)
  if (/^[a-zA-Z]:/.test(normalizedPath)) {
    return false;
  }

  // No UNC paths (\\server\share)
  if (normalizedPath.startsWith('//')) {
    return false;
  }

  return true;
}

/**
 * Validate command string (prevent command injection)
 *
 * Security checks:
 * - Only alphanumeric, dash, underscore
 * - No shell metacharacters (; & | $ etc.)
 * - Reasonable length limit
 *
 * @param command - Command to validate
 * @returns true if command is safe
 *
 * @example
 * ```typescript
 * isValidCommand('claude')              // ✅ true
 * isValidCommand('my-provider_v2')      // ✅ true
 * isValidCommand('claude; rm -rf /')    // ❌ false
 * isValidCommand('claude & backdoor')   // ❌ false
 * ```
 */
export function isValidCommand(command: string): boolean {
  if (!command || typeof command !== 'string') {
    return false;
  }

  // Length check
  if (command.length > VALIDATION_LIMITS.MAX_COMMAND_LENGTH) {
    return false;
  }

  // Only alphanumeric, dash, underscore (no shell metacharacters)
  if (!/^[a-z0-9_-]+$/i.test(command)) {
    return false;
  }

  return true;
}

/**
 * Validate provider/agent name (prevent name injection)
 *
 * Security checks:
 * - Only alphanumeric, dash, underscore
 * - Must start with alphanumeric
 * - Reasonable length limit
 *
 * @param name - Name to validate
 * @returns true if name is valid
 *
 * @example
 * ```typescript
 * isValidName('backend')                 // ✅ true
 * isValidName('my-agent_v2')             // ✅ true
 * isValidName('../../malicious')         // ❌ false
 * isValidName('agent\nmalicious: true')  // ❌ false
 * ```
 */
export function isValidName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Length check
  if (name.length > VALIDATION_LIMITS.MAX_NAME_LENGTH) {
    return false;
  }

  // Must start with alphanumeric, then can have dash/underscore
  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(name)) {
    return false;
  }

  return true;
}

/**
 * Validate file extension
 *
 * @param ext - Extension to validate (with or without leading dot)
 * @returns true if extension is valid
 */
export function isValidExtension(ext: string): boolean {
  if (!ext || typeof ext !== 'string') {
    return false;
  }

  // Ensure starts with dot
  const normalized = ext.startsWith('.') ? ext : `.${ext}`;

  // Reasonable length (e.g., .json, .yaml, .tsx)
  if (normalized.length > 10 || normalized.length < 2) {
    return false;
  }

  // Only alphanumeric after dot
  if (!/^\.[a-z0-9]+$/i.test(normalized)) {
    return false;
  }

  return true;
}

/**
 * Check if a number is a positive integer
 */
export function isPositiveInteger(value: any): value is number {
  return typeof value === 'number' &&
         Number.isInteger(value) &&
         value > 0;
}

/**
 * Check if a number is a non-negative integer (can be 0)
 */
export function isNonNegativeInteger(value: any): value is number {
  return typeof value === 'number' &&
         Number.isInteger(value) &&
         value >= 0;
}

/**
 * Check if value is within range (inclusive)
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

// Pre-compiled regex patterns for sanitization (performance optimization)
const SANITIZE_PATTERNS = {
  absolutePath: /\/[^\s]+\//g,
  macosUser: /\/Users\/[^/]+\//g,
  linuxUser: /\/home\/[^/]+\//g,
  windowsUser: /C:\\Users\\[^\\]+\\/g
} as const;

/**
 * Sanitize error message for production (remove sensitive paths)
 *
 * @param message - Error message to sanitize
 * @param isProduction - Whether in production mode
 * @returns Sanitized message
 */
export function sanitizeErrorMessage(message: string, isProduction: boolean): string {
  if (!isProduction) {
    return message;
  }

  // Remove absolute paths and usernames using pre-compiled patterns
  return message
    .replace(SANITIZE_PATTERNS.absolutePath, '<path>/')
    .replace(SANITIZE_PATTERNS.macosUser, '/Users/<user>/')
    .replace(SANITIZE_PATTERNS.linuxUser, '/home/<user>/')
    .replace(SANITIZE_PATTERNS.windowsUser, 'C:\\Users\\<user>\\');
}
