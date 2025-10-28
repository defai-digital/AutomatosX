/**
 * Error Hierarchy - Structured error classes with error codes
 *
 * All errors extend BaseError with:
 * - Error code (for programmatic handling)
 * - User-friendly message
 * - Actionable suggestions
 * - Additional context
 */

export enum ErrorCode {
  // Configuration Errors (1000-1099)
  CONFIG_NOT_FOUND = 'E1000',
  CONFIG_INVALID = 'E1001',
  CONFIG_PARSE_ERROR = 'E1002',
  CONFIG_VALIDATION_ERROR = 'E1003',

  // Path Errors (1100-1199)
  PATH_TRAVERSAL = 'E1100',
  PATH_NOT_FOUND = 'E1101',
  PATH_ACCESS_DENIED = 'E1102',
  PATH_INVALID = 'E1103',

  // Memory Errors (1200-1299)
  MEMORY_NOT_INITIALIZED = 'E1200',
  MEMORY_DATABASE_ERROR = 'E1201',
  MEMORY_EMBEDDING_ERROR = 'E1202',
  MEMORY_QUERY_ERROR = 'E1203',
  MEMORY_IMPORT_ERROR = 'E1204',
  MEMORY_EXPORT_ERROR = 'E1205',

  // Provider Errors (1300-1399)
  PROVIDER_NOT_FOUND = 'E1300',
  PROVIDER_UNAVAILABLE = 'E1301',
  PROVIDER_TIMEOUT = 'E1302',
  PROVIDER_RATE_LIMIT = 'E1303',
  PROVIDER_AUTH_ERROR = 'E1304',
  PROVIDER_EXEC_ERROR = 'E1305',
  PROVIDER_NO_AVAILABLE = 'E1306',

  // Agent Errors (1400-1499)
  AGENT_PROFILE_NOT_FOUND = 'E1400',
  AGENT_PROFILE_INVALID = 'E1401',
  AGENT_ABILITY_NOT_FOUND = 'E1402',
  AGENT_EXECUTION_ERROR = 'E1403',
  AGENT_CONTEXT_ERROR = 'E1404',

  // Validation Errors (1500-1599)
  VALIDATION_FAILED = 'E1500',
  VALIDATION_SCHEMA_ERROR = 'E1501',
  VALIDATION_TYPE_ERROR = 'E1502',
  VALIDATION_CONSTRAINT_ERROR = 'E1503',

  // File System Errors (1600-1699)
  FILE_NOT_FOUND = 'E1600',
  FILE_READ_ERROR = 'E1601',
  FILE_WRITE_ERROR = 'E1602',
  FILE_PERMISSION_ERROR = 'E1603',

  // CLI Errors (1700-1799)
  CLI_INVALID_COMMAND = 'E1700',
  CLI_INVALID_ARGUMENT = 'E1701',
  CLI_MISSING_ARGUMENT = 'E1702',
  CLI_UNKNOWN_ERROR = 'E1703',

  // Unknown/Generic (9999)
  UNKNOWN_ERROR = 'E9999'
}

/**
 * Base error class with error code and suggestions
 */
export class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly suggestions: string[];
  public readonly context?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    suggestions: string[] = [],
    context?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.suggestions = suggestions;
    this.context = context;
    this.isOperational = isOperational;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get formatted error message for display
   */
  getFormattedMessage(): string {
    let formatted = `[${this.code}] ${this.message}`;

    if (this.suggestions.length > 0) {
      formatted += '\n\nSuggestions:';
      this.suggestions.forEach((suggestion, i) => {
        formatted += `\n  ${i + 1}. ${suggestion}`;
      });
    }

    return formatted;
  }

  /**
   * Get error details as object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      suggestions: this.suggestions,
      context: this.context,
      isOperational: this.isOperational,
      stack: this.stack
    };
  }
}

/**
 * Configuration Errors
 */
export class ConfigError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.CONFIG_INVALID,
    suggestions: string[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, code, suggestions, context);
  }

  static notFound(path: string): ConfigError {
    return new ConfigError(
      `Configuration file not found: ${path}`,
      ErrorCode.CONFIG_NOT_FOUND,
      [
        'Run "automatosx init" to create a new configuration',
        'Specify a custom config path with --config option',
        'Check that you are in a valid AutomatosX project directory'
      ],
      { path }
    );
  }

  static invalid(reason: string, context?: Record<string, unknown>): ConfigError {
    return new ConfigError(
      `Invalid configuration: ${reason}`,
      ErrorCode.CONFIG_INVALID,
      [
        'Check your automatosx.config.json for syntax errors',
        'Validate against the schema in documentation',
        'Reset to default with "automatosx init --force"'
      ],
      context
    );
  }

  static parseError(error: Error, path: string): ConfigError {
    return new ConfigError(
      `Failed to parse configuration: ${error.message}`,
      ErrorCode.CONFIG_PARSE_ERROR,
      [
        'Check JSON syntax in your config file',
        'Use a JSON validator to find syntax errors',
        'Reset to default with "automatosx init --force"'
      ],
      { path, originalError: error.message }
    );
  }
}

/**
 * Path Errors
 */
export class PathError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PATH_INVALID,
    suggestions: string[] = [],
    context?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message, code, suggestions, context, isOperational);
  }

  static traversal(path: string): PathError {
    return new PathError(
      `Path traversal attempt detected: ${path}`,
      ErrorCode.PATH_TRAVERSAL,
      [
        'Use relative paths within the project directory',
        'Avoid using ".." in file paths',
        'Check your file path for security issues'
      ],
      { path },
      false // Security error, not operational
    );
  }

  static notFound(path: string, type: string = 'Path'): PathError {
    return new PathError(
      `${type} not found: ${path}`,
      ErrorCode.PATH_NOT_FOUND,
      [
        'Check that the path exists and is accessible',
        'Verify you have the correct permissions',
        `Use "automatosx list" to see available ${type.toLowerCase()}s`
      ],
      { path, type }
    );
  }
}

/**
 * Memory Errors
 */
export class MemoryError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.MEMORY_DATABASE_ERROR,
    suggestions: string[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, code, suggestions, context);
  }

  static notInitialized(): MemoryError {
    return new MemoryError(
      'Memory system not initialized',
      ErrorCode.MEMORY_NOT_INITIALIZED,
      [
        'Run "automatosx init" to initialize the project',
        'Check that .automatosx/memory directory exists',
        'Verify file permissions on the memory database'
      ]
    );
  }

  static embeddingError(reason: string): MemoryError {
    return new MemoryError(
      `Embedding provider error: ${reason}`,
      ErrorCode.MEMORY_EMBEDDING_ERROR,
      [
        'Set OPENAI_API_KEY environment variable',
        'Configure embedding provider in automatosx.config.json',
        'Check your API key is valid and has credits'
      ],
      { reason }
    );
  }

  static queryError(query: string, error: Error): MemoryError {
    return new MemoryError(
      `Memory query failed: ${error.message}`,
      ErrorCode.MEMORY_QUERY_ERROR,
      [
        'Check your query syntax',
        'Verify memory database is not corrupted',
        'Try rebuilding memory index with "automatosx memory rebuild"'
      ],
      { query, originalError: error.message }
    );
  }
}

/**
 * Provider Errors
 */
export class ProviderError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.PROVIDER_UNAVAILABLE,
    suggestions: string[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, code, suggestions, context);
  }

  static notFound(providerName: string): ProviderError {
    return new ProviderError(
      `Provider "${providerName}" not found`,
      ErrorCode.PROVIDER_NOT_FOUND,
      [
        'Check available providers with "automatosx list providers"',
        'Verify provider is enabled in automatosx.config.json',
        'Install the provider CLI if not already installed'
      ],
      { providerName }
    );
  }

  static unavailable(providerName: string, reason?: string): ProviderError {
    const msg = reason
      ? `Provider "${providerName}" unavailable: ${reason}`
      : `Provider "${providerName}" is unavailable`;

    return new ProviderError(
      msg,
      ErrorCode.PROVIDER_UNAVAILABLE,
      [
        'Check that the provider CLI is installed and in your PATH',
        'Verify provider configuration in automatosx.config.json',
        'Try running the provider CLI directly to diagnose issues',
        'Check system status with "automatosx status --verbose"'
      ],
      { providerName, reason }
    );
  }

  static timeout(providerName: string, timeoutMs: number): ProviderError {
    return new ProviderError(
      `Provider "${providerName}" timed out after ${timeoutMs}ms`,
      ErrorCode.PROVIDER_TIMEOUT,
      [
        'Increase timeout in automatosx.config.json',
        'Try a simpler prompt or reduce context size',
        'Check your network connection',
        'Verify the provider service is responsive'
      ],
      { providerName, timeoutMs }
    );
  }

  static noAvailableProviders(): ProviderError {
    return new ProviderError(
      'No AI providers are available',
      ErrorCode.PROVIDER_NO_AVAILABLE,
      [
        'Install at least one provider CLI (Claude or Gemini)',
        'Enable providers in automatosx.config.json',
        'Check provider status with "automatosx status"',
        'Verify provider CLIs are in your PATH'
      ]
    );
  }

  static executionError(providerName: string, error: Error): ProviderError {
    return new ProviderError(
      `Provider "${providerName}" execution failed: ${error.message}`,
      ErrorCode.PROVIDER_EXEC_ERROR,
      [
        'Check that the provider CLI is installed correctly',
        'Verify you have necessary API keys configured',
        'Try running the provider CLI directly to diagnose',
        'Check error logs with --debug flag'
      ],
      { providerName, originalError: error.message }
    );
  }

  /**
   * Create rate limit error with detailed context
   * v5.7.0: Provider limit detection and rotation
   */
  static rateLimit(
    providerName: string,
    limitWindow: 'daily' | 'weekly' | 'custom',
    resetAtMs: number,
    rawMessage?: string,
    retryAfterSeconds?: number
  ): ProviderError {
    const resetDate = new Date(resetAtMs);
    const hoursUntilReset = Math.ceil((resetAtMs - Date.now()) / (1000 * 60 * 60));
    const timeDesc = hoursUntilReset < 1
      ? 'less than 1 hour'
      : hoursUntilReset === 1
      ? '1 hour'
      : `${hoursUntilReset} hours`;

    return new ProviderError(
      `Provider "${providerName}" has hit its ${limitWindow} usage limit. Resets in ${timeDesc} at ${resetDate.toISOString()}`,
      ErrorCode.PROVIDER_RATE_LIMIT,
      [
        'AutomatosX will automatically switch to the next available provider',
        `Wait until ${resetDate.toLocaleString()} for "${providerName}" to become available again`,
        'Check current provider status with "ax provider limits"',
        'Use "ax provider use <name>" to manually select a different provider'
      ],
      {
        providerName,
        limitWindow,
        resetAtMs,
        rawMessage,
        retryAfterSeconds
      }
    );
  }

  /**
   * Create error for all providers exhausted
   * v5.7.0: Provider limit detection and rotation
   */
  static allProvidersLimited(
    limitedProviders: Array<{ name: string; resetAtMs: number }>,
    soonestResetMs: number
  ): ProviderError {
    const soonestResetDate = new Date(soonestResetMs);
    const hoursUntilReset = Math.ceil((soonestResetMs - Date.now()) / (1000 * 60 * 60));

    return new ProviderError(
      `All providers have hit usage limits. Next provider resets in ${hoursUntilReset} hour(s) at ${soonestResetDate.toISOString()}`,
      ErrorCode.PROVIDER_NO_AVAILABLE,
      [
        `Wait until ${soonestResetDate.toLocaleString()} for providers to reset`,
        'Check provider limits with "ax provider limits"',
        'Use "ax provider use <name> --force" to override and try anyway',
        'Consider spreading workload across different time periods'
      ],
      {
        limitedProviders,
        soonestResetMs
      }
    );
  }
}

/**
 * Agent Errors
 */
export class AgentError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.AGENT_EXECUTION_ERROR,
    suggestions: string[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, code, suggestions, context);
  }

  static profileNotFound(agentName: string): AgentError {
    return new AgentError(
      `Agent profile "${agentName}" not found`,
      ErrorCode.AGENT_PROFILE_NOT_FOUND,
      [
        'List available agents with "automatosx list agents"',
        'Create agent profile in .automatosx/agents/',
        'Check spelling of agent name',
        'Use example agents from examples/agents/ directory'
      ],
      { agentName }
    );
  }

  static profileInvalid(agentName: string, reason: string): AgentError {
    return new AgentError(
      `Agent profile "${agentName}" is invalid: ${reason}`,
      ErrorCode.AGENT_PROFILE_INVALID,
      [
        'Check YAML syntax in agent profile',
        'Validate required fields (name, provider, abilities)',
        'Refer to example agents in examples/agents/',
        'See documentation for agent profile schema'
      ],
      { agentName, reason }
    );
  }

  static abilityNotFound(abilityName: string, agentName: string): AgentError {
    return new AgentError(
      `Ability "${abilityName}" not found for agent "${agentName}"`,
      ErrorCode.AGENT_ABILITY_NOT_FOUND,
      [
        'List available abilities with "automatosx list abilities"',
        'Create ability file in .automatosx/abilities/',
        'Check spelling of ability name in agent profile',
        'Use example abilities from examples/abilities/'
      ],
      { abilityName, agentName }
    );
  }

  static executionError(agentName: string, error: Error): AgentError {
    return new AgentError(
      `Agent "${agentName}" execution failed: ${error.message}`,
      ErrorCode.AGENT_EXECUTION_ERROR,
      [
        'Check provider is available and configured',
        'Verify agent profile is valid',
        'Try simpler task to isolate the issue',
        'Run with --debug flag for detailed logs'
      ],
      { agentName, originalError: error.message }
    );
  }
}

/**
 * Validation Errors
 */
export class ValidationError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.VALIDATION_FAILED,
    suggestions: string[] = [],
    context?: Record<string, unknown>
  ) {
    super(message, code, suggestions, context);
  }

  static failed(field: string, reason: string): ValidationError {
    return new ValidationError(
      `Validation failed for "${field}": ${reason}`,
      ErrorCode.VALIDATION_FAILED,
      [
        'Check the value meets required constraints',
        'Refer to documentation for valid formats',
        'Use --help to see expected formats'
      ],
      { field, reason }
    );
  }

  static typeError(field: string, expected: string, actual: string): ValidationError {
    return new ValidationError(
      `Type error for "${field}": expected ${expected}, got ${actual}`,
      ErrorCode.VALIDATION_TYPE_ERROR,
      [
        `Provide a valid ${expected} value`,
        'Check your input format',
        'Use --help for usage examples'
      ],
      { field, expected, actual }
    );
  }
}

/**
 * Helper function to convert unknown errors to BaseError
 */
export function toBaseError(error: unknown): BaseError {
  if (error instanceof BaseError) {
    return error;
  }

  if (error instanceof Error) {
    return new BaseError(
      error.message,
      ErrorCode.UNKNOWN_ERROR,
      ['Check error details for more information'],
      { originalError: error.name, stack: error.stack }
    );
  }

  return new BaseError(
    String(error),
    ErrorCode.UNKNOWN_ERROR,
    ['An unexpected error occurred']
  );
}

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof BaseError) {
    return error.isOperational;
  }
  return false;
}
