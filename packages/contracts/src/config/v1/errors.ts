/**
 * Configuration Error Codes Contract V1
 *
 * Error codes and error class for configuration operations.
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Configuration error codes
 */
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
  PROVIDER_DETECTION_TIMEOUT: 'PROVIDER_DETECTION_TIMEOUT',

  // Setup
  SETUP_ALREADY_COMPLETE: 'SETUP_ALREADY_COMPLETE',
  SETUP_INCOMPLETE: 'SETUP_INCOMPLETE',
  SETUP_CANCELLED: 'SETUP_CANCELLED',

  // State machine
  CONFIG_INVALID_TRANSITION: 'CONFIG_INVALID_TRANSITION',

  // Operations
  CONFIG_PATH_NOT_FOUND: 'CONFIG_PATH_NOT_FOUND',
  CONFIG_INVALID_VALUE: 'CONFIG_INVALID_VALUE',
} as const;

export type ConfigErrorCode = (typeof ConfigErrorCode)[keyof typeof ConfigErrorCode];

// ============================================================================
// Error Recovery Hints
// ============================================================================

/**
 * Recovery hints for error codes
 */
export const CONFIG_ERROR_HINTS: Record<ConfigErrorCode, string> = {
  CONFIG_NOT_FOUND: 'Run `ax setup` to create configuration',
  CONFIG_READ_ERROR: 'Check file permissions and JSON syntax',
  CONFIG_WRITE_ERROR: 'Check write permissions on config directory',
  CONFIG_PERMISSION_DENIED: 'Check permissions on ~/.automatosx/ or run with appropriate privileges',
  CONFIG_VALIDATION_ERROR: 'Run `ax config reset` to restore defaults or fix the configuration manually',
  CONFIG_SCHEMA_MISMATCH: 'Config version mismatch - run `ax setup --force` to recreate',
  CONFIG_MIGRATION_REQUIRED: 'Run `ax setup` to migrate configuration to latest version',
  CONFIG_MIGRATION_FAILED: 'Backup config and run `ax config reset` to start fresh',
  PROVIDER_NOT_DETECTED: 'Install provider CLI: e.g., `npm install -g @anthropic/claude-cli`',
  PROVIDER_NOT_AUTHENTICATED: 'Run provider auth: e.g., `claude auth login`',
  PROVIDER_DETECTION_TIMEOUT: 'Provider CLI is slow to respond - try again or check CLI installation',
  SETUP_ALREADY_COMPLETE: 'Configuration exists - use `ax setup --force` to reconfigure',
  SETUP_INCOMPLETE: 'Run `ax setup` to complete configuration',
  SETUP_CANCELLED: 'Setup was cancelled - run `ax setup` to try again',
  CONFIG_INVALID_TRANSITION: 'Invalid operation for current config state',
  CONFIG_PATH_NOT_FOUND: 'The specified configuration path does not exist',
  CONFIG_INVALID_VALUE: 'The provided value is invalid for this configuration path',
};

/**
 * Gets recovery hint for an error code
 */
export function getRecoveryHint(code: ConfigErrorCode): string {
  return CONFIG_ERROR_HINTS[code];
}

// ============================================================================
// Error Class
// ============================================================================

/**
 * Configuration error class
 */
export class ConfigError extends Error {
  readonly code: ConfigErrorCode;
  readonly details: Record<string, unknown> | undefined;
  readonly recoveryHint: string;

  constructor(
    code: ConfigErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
    this.details = details ?? undefined;
    this.recoveryHint = CONFIG_ERROR_HINTS[code];

    // Maintains proper stack trace for where error was thrown (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ConfigError);
    }
  }

  /**
   * Converts error to JSON-serializable object
   */
  toJSON(): {
    name: string;
    code: ConfigErrorCode;
    message: string;
    recoveryHint: string;
    details: Record<string, unknown> | undefined;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoveryHint: this.recoveryHint,
      details: this.details,
    };
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Creates a CONFIG_NOT_FOUND error
 */
export function configNotFoundError(path?: string): ConfigError {
  return new ConfigError(
    ConfigErrorCode.CONFIG_NOT_FOUND,
    path !== undefined
      ? `Configuration file not found: ${path}`
      : 'Configuration file not found',
    path !== undefined ? { path } : undefined
  );
}

/**
 * Creates a CONFIG_VALIDATION_ERROR error
 */
export function configValidationError(errors: string[]): ConfigError {
  return new ConfigError(
    ConfigErrorCode.CONFIG_VALIDATION_ERROR,
    `Configuration validation failed: ${errors.join(', ')}`,
    { errors }
  );
}

/**
 * Creates a PROVIDER_NOT_DETECTED error
 */
export function providerNotDetectedError(providerId: string): ConfigError {
  return new ConfigError(
    ConfigErrorCode.PROVIDER_NOT_DETECTED,
    `Provider CLI not detected: ${providerId}`,
    { providerId }
  );
}

/**
 * Creates a PROVIDER_NOT_AUTHENTICATED error
 */
export function providerNotAuthenticatedError(providerId: string): ConfigError {
  return new ConfigError(
    ConfigErrorCode.PROVIDER_NOT_AUTHENTICATED,
    `Provider not authenticated: ${providerId}`,
    { providerId }
  );
}

/**
 * Creates a CONFIG_INVALID_TRANSITION error
 */
export function configInvalidTransitionError(
  from: string,
  to: string
): ConfigError {
  return new ConfigError(
    ConfigErrorCode.CONFIG_INVALID_TRANSITION,
    `Invalid state transition from '${from}' to '${to}'`,
    { from, to }
  );
}

/**
 * Creates a CONFIG_PATH_NOT_FOUND error
 */
export function configPathNotFoundError(path: string): ConfigError {
  return new ConfigError(
    ConfigErrorCode.CONFIG_PATH_NOT_FOUND,
    `Configuration path not found: ${path}`,
    { path }
  );
}

/**
 * Type guard for ConfigError
 */
export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}
