import type {
  MCPErrorCode,
  MCPStructuredError,
  MCPResponseMetadata,
  MCPResponseLimits,
  MCPPagination,
} from '@automatosx/contracts';
import {
  DEFAULT_RESPONSE_LIMITS,
  isRetryableError,
} from '@automatosx/contracts';

// ============================================================================
// MCP Tool Result Type (compatible with MCP SDK)
// ============================================================================

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// ============================================================================
// Internal Response Types
// ============================================================================

export interface SuccessResponseData<T> {
  success: true;
  data: T;
  metadata?: MCPResponseMetadata;
}

export interface ErrorResponseData {
  success: false;
  error: MCPStructuredError;
  metadata?: MCPResponseMetadata;
}

export type ResponseData<T> = SuccessResponseData<T> | ErrorResponseData;

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create a success response.
 *
 * INV-MCP-RESP-001: Uses consistent envelope structure.
 * INV-MCP-RESP-005: Includes duration tracking.
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    startTime?: number;
    cached?: boolean;
    truncated?: boolean;
    originalSizeBytes?: number;
    requestId?: string;
  } = {}
): MCPToolResult {
  const response: SuccessResponseData<T> = {
    success: true,
    data,
  };

  // Add metadata if any tracking info provided
  if (options.startTime !== undefined || options.cached || options.truncated) {
    response.metadata = {
      durationMs: options.startTime ? Date.now() - options.startTime : 0,
      cached: options.cached ?? false,
      truncated: options.truncated ?? false,
      originalSizeBytes: options.originalSizeBytes,
      requestId: options.requestId,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

/**
 * Create an error response.
 *
 * INV-MCP-RESP-001: Uses consistent envelope structure.
 * INV-MCP-RESP-002: Includes error code.
 * INV-MCP-RESP-006: Sets retryable based on error code.
 */
export function createErrorResponse(
  code: MCPErrorCode,
  message: string,
  options: {
    context?: Record<string, unknown>;
    startTime?: number;
    retryAfterMs?: number;
    requestId?: string;
  } = {}
): MCPToolResult {
  const error: MCPStructuredError = {
    code,
    message,
    context: options.context,
    retryable: isRetryableError(code),
    retryAfterMs: options.retryAfterMs,
  };

  const response: ErrorResponseData = {
    success: false,
    error,
  };

  // Add metadata
  if (options.startTime !== undefined || options.requestId) {
    response.metadata = {
      durationMs: options.startTime ? Date.now() - options.startTime : 0,
      cached: false,
      truncated: false,
      requestId: options.requestId,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
    isError: true,
  };
}

/**
 * Create a list response with pagination.
 *
 * INV-MCP-RESP-003: Enforces list item limits.
 */
export function createListResponse<T>(
  items: T[],
  options: {
    total?: number;
    limit?: number;
    offset?: number;
    startTime?: number;
    requestId?: string;
    limits?: MCPResponseLimits;
  } = {}
): MCPToolResult {
  const limits = options.limits ?? DEFAULT_RESPONSE_LIMITS;
  const limit = Math.min(options.limit ?? limits.maxListItems, limits.maxListItems);
  const offset = options.offset ?? 0;
  const total = options.total ?? items.length;

  // Apply limit
  const limitedItems = items.slice(0, limit);
  const truncated = items.length > limit;

  const pagination: MCPPagination = {
    total,
    limit,
    offset,
    hasMore: offset + limitedItems.length < total,
  };

  const data = {
    items: limitedItems,
    pagination,
  };

  const successOptions: {
    startTime?: number;
    truncated?: boolean;
    requestId?: string;
  } = { truncated };

  if (options.startTime !== undefined) {
    successOptions.startTime = options.startTime;
  }
  if (options.requestId !== undefined) {
    successOptions.requestId = options.requestId;
  }

  return createSuccessResponse(data, successOptions);
}

/**
 * Create a not found error response.
 */
export function createNotFoundResponse(
  resourceType: string,
  resourceId: string,
  options: { startTime?: number; requestId?: string } = {}
): MCPToolResult {
  const errorOptions: {
    context: Record<string, unknown>;
    startTime?: number;
    requestId?: string;
  } = { context: { resourceType, resourceId } };

  if (options.startTime !== undefined) {
    errorOptions.startTime = options.startTime;
  }
  if (options.requestId !== undefined) {
    errorOptions.requestId = options.requestId;
  }

  return createErrorResponse('NOT_FOUND', `${resourceType} not found: ${resourceId}`, errorOptions);
}

/**
 * Create a validation error response.
 */
export function createValidationErrorResponse(
  message: string,
  errors: Array<{ path: string; message: string }>,
  options: { startTime?: number; requestId?: string } = {}
): MCPToolResult {
  const errorOptions: {
    context: Record<string, unknown>;
    startTime?: number;
    requestId?: string;
  } = { context: { validationErrors: errors } };

  if (options.startTime !== undefined) {
    errorOptions.startTime = options.startTime;
  }
  if (options.requestId !== undefined) {
    errorOptions.requestId = options.requestId;
  }

  return createErrorResponse('INVALID_INPUT', message, errorOptions);
}

/**
 * Create a timeout error response.
 */
export function createTimeoutResponse(
  timeoutMs: number,
  options: { startTime?: number; requestId?: string } = {}
): MCPToolResult {
  const errorOptions: {
    context: Record<string, unknown>;
    startTime?: number;
    retryAfterMs: number;
    requestId?: string;
  } = {
    context: { timeoutMs },
    retryAfterMs: Math.min(timeoutMs, 5000),
  };

  if (options.startTime !== undefined) {
    errorOptions.startTime = options.startTime;
  }
  if (options.requestId !== undefined) {
    errorOptions.requestId = options.requestId;
  }

  return createErrorResponse('TOOL_TIMEOUT', `Operation timed out after ${timeoutMs}ms`, errorOptions);
}

/**
 * Create a memory pressure error response.
 */
export function createMemoryPressureResponse(
  pressureLevel: string,
  options: { startTime?: number; requestId?: string } = {}
): MCPToolResult {
  const errorOptions: {
    context: Record<string, unknown>;
    startTime?: number;
    retryAfterMs: number;
    requestId?: string;
  } = {
    context: { pressureLevel },
    retryAfterMs: 10000,
  };

  if (options.startTime !== undefined) {
    errorOptions.startTime = options.startTime;
  }
  if (options.requestId !== undefined) {
    errorOptions.requestId = options.requestId;
  }

  return createErrorResponse(
    'MEMORY_PRESSURE',
    `Operation rejected due to ${pressureLevel} memory pressure`,
    errorOptions
  );
}

/**
 * Create an internal error response.
 */
export function createInternalErrorResponse(
  error: Error,
  options: { startTime?: number; requestId?: string } = {}
): MCPToolResult {
  const errorOptions: {
    context: Record<string, unknown>;
    startTime?: number;
    requestId?: string;
  } = {
    context: {
      errorName: error.name,
      // Don't include stack in production
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  };

  if (options.startTime !== undefined) {
    errorOptions.startTime = options.startTime;
  }
  if (options.requestId !== undefined) {
    errorOptions.requestId = options.requestId;
  }

  return createErrorResponse('INTERNAL_ERROR', error.message, errorOptions);
}

// ============================================================================
// Truncation Helpers
// ============================================================================

/**
 * Truncate a string to max length.
 *
 * INV-MCP-RESP-003: Enforces string length limits.
 * INV-MCP-RESP-004: Adds truncation indicator.
 */
export function truncateString(
  str: string,
  maxLength: number,
  suffix: string = '... [truncated]'
): { text: string; truncated: boolean } {
  if (str.length <= maxLength) {
    return { text: str, truncated: false };
  }

  const truncatedLength = maxLength - suffix.length;
  return {
    text: str.slice(0, truncatedLength) + suffix,
    truncated: true,
  };
}

/**
 * Truncate response data to fit within size limits.
 *
 * INV-MCP-RESP-003: Enforces response size limits.
 * INV-MCP-RESP-004: Sets truncated flag.
 */
export function truncateResponse<T>(
  data: T,
  limits: MCPResponseLimits = DEFAULT_RESPONSE_LIMITS
): { data: T; truncated: boolean; originalSizeBytes: number } {
  const serialized = JSON.stringify(data);
  const originalSizeBytes = serialized.length * 2; // Approximate UTF-8 size

  if (originalSizeBytes <= limits.maxResponseBytes) {
    return { data, truncated: false, originalSizeBytes };
  }

  // For arrays, reduce items
  if (Array.isArray(data)) {
    const targetItems = Math.floor(
      (limits.maxResponseBytes / originalSizeBytes) * data.length * 0.8
    );
    return {
      data: data.slice(0, Math.max(1, targetItems)) as T,
      truncated: true,
      originalSizeBytes,
    };
  }

  // For strings, truncate directly
  if (typeof data === 'string') {
    const result = truncateString(
      data,
      Math.floor(limits.maxResponseBytes / 2),
      limits.truncationSuffix
    );
    return {
      data: result.text as T,
      truncated: result.truncated,
      originalSizeBytes,
    };
  }

  // For objects, try to reduce nested arrays/strings
  // This is a simplified approach - complex objects may need custom handling
  return { data, truncated: false, originalSizeBytes };
}
