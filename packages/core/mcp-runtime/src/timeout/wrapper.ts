import type {
  MCPTimeoutConfig,
  TimeoutResult,
  ToolCategory,
} from '@defai.digital/contracts';
import { TOOL_CATEGORIES, getToolTimeout } from '@defai.digital/contracts';

/**
 * Default timeout configuration.
 */
export const DEFAULT_TIMEOUT_CONFIG: MCPTimeoutConfig = {
  defaultTimeoutMs: 30_000,
  toolTimeouts: {
    query: 10_000, // 10 seconds
    mutation: 30_000, // 30 seconds
    scan: 120_000, // 2 minutes
    execution: 1_200_000, // 20 minutes
  },
  toolOverrides: {},
};

/**
 * Timeout error class for identification.
 */
export class TimeoutError extends Error {
  readonly code = 'TOOL_TIMEOUT';
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Wrap an async operation with timeout protection.
 *
 * Invariants enforced:
 * - INV-MCP-TIMEOUT-001: Guaranteed termination
 * - INV-MCP-TIMEOUT-004: Returns TOOL_TIMEOUT error code
 * - INV-MCP-TIMEOUT-005: Duration tracking
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number
): Promise<TimeoutResult> {
  const startTime = Date.now();

  // Create timeout promise
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    // Race between operation and timeout
    const result = await Promise.race([operation(), timeoutPromise]);

    // Clear timeout if operation completed first
    if (timeoutId) clearTimeout(timeoutId);

    return {
      status: 'completed',
      result,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Clear timeout
    if (timeoutId) clearTimeout(timeoutId);

    const durationMs = Date.now() - startTime;

    // Check if it was a timeout
    if (error instanceof TimeoutError) {
      return {
        status: 'timeout',
        timeoutMs: error.timeoutMs,
        durationMs,
      };
    }

    // Other error
    return {
      status: 'error',
      error: {
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      durationMs,
    };
  }
}

/**
 * Wrap a tool handler with timeout protection.
 *
 * Invariants enforced:
 * - INV-MCP-TIMEOUT-002: Category consistency
 * - INV-MCP-TIMEOUT-003: Override precedence
 */
export function withToolTimeout<TArgs, TResult>(
  toolName: string,
  handler: (args: TArgs) => Promise<TResult>,
  config: MCPTimeoutConfig = DEFAULT_TIMEOUT_CONFIG
): (args: TArgs) => Promise<TimeoutResult> {
  const timeoutMs = getToolTimeout(toolName, config);

  return async (args: TArgs): Promise<TimeoutResult> => {
    return withTimeout(() => handler(args), timeoutMs);
  };
}

/**
 * Create a timeout-wrapped handler factory.
 */
export function createTimeoutWrapper(
  config: MCPTimeoutConfig = DEFAULT_TIMEOUT_CONFIG
) {
  return function wrapHandler<TArgs, TResult>(
    toolName: string,
    handler: (args: TArgs) => Promise<TResult>
  ): (args: TArgs) => Promise<TimeoutResult> {
    return withToolTimeout(toolName, handler, config);
  };
}

/**
 * Get the category for a tool.
 */
export function getToolCategory(toolName: string): ToolCategory | undefined {
  return TOOL_CATEGORIES[toolName];
}

/**
 * Check if a result is a timeout.
 */
export function isTimeoutResult(result: TimeoutResult): boolean {
  return result.status === 'timeout';
}

/**
 * Check if a result is successful.
 */
export function isSuccessResult(result: TimeoutResult): boolean {
  return result.status === 'completed';
}

/**
 * Extract the result value from a successful TimeoutResult.
 * Throws if result is not successful.
 */
export function unwrapResult<T>(result: TimeoutResult): T {
  if (result.status !== 'completed') {
    if (result.status === 'timeout') {
      throw new TimeoutError(result.timeoutMs);
    }
    throw new Error(result.error.message);
  }
  return result.result as T;
}
