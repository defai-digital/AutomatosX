/**
 * Configuration Validation Limits and Helpers
 *
 * Defines security limits and validation functions to prevent:
 * - Resource exhaustion (DoS)
 * - Path traversal attacks
 * - Command injection
 * - Name injection
 */

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
  MAX_TTL: 86400000,            // 24 hours (cache TTL)

  // String/array limits (prevent memory exhaustion)
  MAX_STRING_LENGTH: 1000,      // Max length for string fields
  MAX_ARRAY_LENGTH: 100,        // Max array items
  MAX_COMMAND_LENGTH: 100,      // Max command string length
  MAX_NAME_LENGTH: 50,          // Max name length (providers, agents)

  // Config file limits
  MAX_CONFIG_FILE_SIZE: 1024 * 1024,  // 1 MB config file

  // Port ranges (security)
  MIN_PORT: 1024,               // Avoid privileged ports
  MAX_PORT: 65535,              // Max valid port

  // Minimum values (sanity checks)
  MIN_TIMEOUT: 1000,            // 1 second
  MIN_INTERVAL: 1000,           // 1 second
  MIN_DELAY: 0,                 // Can be 0
  MIN_FILE_SIZE: 1024,          // 1 KB
  MIN_ENTRIES: 1,               // At least 1
  MIN_DAYS: 1,                  // At least 1 day
  MIN_BYTES: 1024,              // 1 KB

  // Ratio limits
  MIN_BACKOFF_FACTOR: 1,        // Linear at minimum
  MAX_BACKOFF_FACTOR: 10,       // Reasonable exponential growth
  MAX_CONCURRENT_AGENTS: 32     // Cap parallel agent execution to protect resources
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

  // No absolute Unix paths
  if (path.startsWith('/')) {
    return false;
  }

  // No parent directory traversal
  if (path.includes('..')) {
    return false;
  }

  // No absolute Windows paths (C:, D:, etc.)
  if (/^[a-zA-Z]:/.test(path)) {
    return false;
  }

  // No UNC paths (\\server\share)
  if (path.startsWith('\\\\')) {
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

  // Remove absolute paths
  message = message.replace(/\/[^\s]+\//g, '<path>/');

  // Remove usernames
  message = message.replace(/\/Users\/[^/]+\//g, '/Users/<user>/');
  message = message.replace(/\/home\/[^/]+\//g, '/home/<user>/');
  message = message.replace(/C:\\Users\\[^\\]+\\/g, 'C:\\Users\\<user>\\');

  return message;
}
