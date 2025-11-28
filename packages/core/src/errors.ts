/**
 * AutomatosX Error Classes
 *
 * Provides structured error types with helpful suggestions for users.
 *
 * @module @ax/core/errors
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

// =============================================================================
// Base Error Class
// =============================================================================

/**
 * Base error class for all AutomatosX errors
 */
export class AutomatosXError extends Error {
  /** Error code for programmatic handling */
  readonly code: string;
  /** Suggestion for how to fix the error */
  readonly suggestion: string | undefined;
  /** Additional context data */
  readonly context: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string,
    options?: {
      suggestion?: string;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'AutomatosXError';
    this.code = code;
    this.suggestion = options?.suggestion;
    this.context = options?.context;
  }

  /**
   * Get formatted error message with suggestion
   */
  toUserMessage(): string {
    let msg = `${this.message}`;
    if (this.suggestion) {
      msg += `\n  Suggestion: ${this.suggestion}`;
    }
    return msg;
  }
}

// =============================================================================
// Agent Errors
// =============================================================================

/**
 * Error thrown when an agent is not found
 */
export class AgentNotFoundError extends AutomatosXError {
  constructor(
    agentId: string,
    options?: {
      availableAgents?: string[];
      similarAgents?: string[];
    }
  ) {
    let message = `Agent "${agentId}" not found`;
    let suggestion: string | undefined;

    if (options?.similarAgents && options.similarAgents.length > 0) {
      suggestion = `Did you mean: ${options.similarAgents.join(', ')}?`;
    } else if (options?.availableAgents && options.availableAgents.length > 0) {
      const preview = options.availableAgents.slice(0, 5).join(', ');
      const more = options.availableAgents.length > 5 ? ` (and ${options.availableAgents.length - 5} more)` : '';
      suggestion = `Available agents: ${preview}${more}. Run "ax agent list" to see all.`;
    } else {
      suggestion = 'Run "ax agent list" to see available agents.';
    }

    super(message, 'AGENT_NOT_FOUND', {
      suggestion,
      context: {
        requestedAgent: agentId,
        availableAgents: options?.availableAgents,
        similarAgents: options?.similarAgents,
      },
    });
    this.name = 'AgentNotFoundError';
  }
}

/**
 * Error thrown when agent execution fails
 */
export class AgentExecutionError extends AutomatosXError {
  constructor(
    agentId: string,
    reason: string,
    options?: {
      cause?: Error;
      timeout?: boolean;
      provider?: string;
    }
  ) {
    let suggestion = 'Try running the task again.';
    if (options?.timeout) {
      suggestion = 'The task timed out. Try a simpler task or increase the timeout in ax.config.json.';
    } else if (options?.provider) {
      suggestion = `Check if provider "${options.provider}" is available with "ax provider status".`;
    }

    const context: Record<string, unknown> = {
      agentId,
      reason,
    };
    if (options?.timeout !== undefined) {
      context['timeout'] = options.timeout;
    }
    if (options?.provider !== undefined) {
      context['provider'] = options.provider;
    }

    super(`Agent "${agentId}" execution failed: ${reason}`, 'AGENT_EXECUTION_ERROR', {
      suggestion,
      context,
      ...(options?.cause ? { cause: options.cause } : {}),
    });
    this.name = 'AgentExecutionError';
  }
}

// =============================================================================
// Provider Errors
// =============================================================================

/**
 * Error thrown when no provider is available
 */
export class ProviderUnavailableError extends AutomatosXError {
  constructor(provider?: string) {
    const message = provider
      ? `Provider "${provider}" is not available`
      : 'No AI providers are available';

    super(message, 'PROVIDER_UNAVAILABLE', {
      suggestion: 'Check provider status with "ax provider status" and verify your API keys.',
      context: { provider },
    });
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Error thrown when provider authentication fails
 */
export class ProviderAuthError extends AutomatosXError {
  constructor(provider: string, reason?: string) {
    super(
      `Authentication failed for provider "${provider}"${reason ? `: ${reason}` : ''}`,
      'PROVIDER_AUTH_ERROR',
      {
        suggestion: 'Verify your API key is correct and has sufficient permissions.',
        context: { provider, reason },
      }
    );
    this.name = 'ProviderAuthError';
  }
}

// =============================================================================
// Memory Errors
// =============================================================================

/**
 * Error thrown when memory operations fail
 */
export class MemoryError extends AutomatosXError {
  constructor(message: string, operation?: string) {
    super(message, 'MEMORY_ERROR', {
      suggestion: 'Check memory status with "ax memory stats". Database may need maintenance.',
      context: { operation },
    });
    this.name = 'MemoryError';
  }
}

// =============================================================================
// Configuration Errors
// =============================================================================

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends AutomatosXError {
  constructor(message: string, field?: string) {
    super(message, 'CONFIGURATION_ERROR', {
      suggestion: field
        ? `Check the "${field}" field in ax.config.json.`
        : 'Validate your ax.config.json configuration.',
      context: { field },
    });
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when setup has not been completed
 */
export class NotInitializedError extends AutomatosXError {
  constructor(what: string = 'AutomatosX') {
    super(`${what} has not been initialized`, 'NOT_INITIALIZED', {
      suggestion: 'Run "ax setup" to initialize AutomatosX in your project.',
      context: { component: what },
    });
    this.name = 'NotInitializedError';
  }
}

// =============================================================================
// Session Errors
// =============================================================================

/**
 * Error thrown when session is not found
 */
export class SessionNotFoundError extends AutomatosXError {
  constructor(sessionId: string) {
    super(`Session "${sessionId}" not found`, 'SESSION_NOT_FOUND', {
      suggestion: 'Run "ax session list" to see available sessions.',
      context: { sessionId },
    });
    this.name = 'SessionNotFoundError';
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Find similar strings to the input
 */
export function findSimilar(input: string, options: string[], maxDistance: number = 2): string[] {
  const inputLower = input.toLowerCase();
  return options
    .filter((opt) => {
      const optLower = opt.toLowerCase();
      // Include if: substring match or low edit distance
      return (
        optLower.includes(inputLower) ||
        inputLower.includes(optLower) ||
        levenshteinDistance(inputLower, optLower) <= maxDistance
      );
    })
    .slice(0, 3);
}
