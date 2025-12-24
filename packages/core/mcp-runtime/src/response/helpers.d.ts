import type { MCPErrorCode, MCPStructuredError, MCPResponseMetadata, MCPResponseLimits } from '@automatosx/contracts';
export interface MCPToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError?: boolean;
}
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
/**
 * Create a success response.
 *
 * INV-MCP-RESP-001: Uses consistent envelope structure.
 * INV-MCP-RESP-005: Includes duration tracking.
 */
export declare function createSuccessResponse<T>(data: T, options?: {
    startTime?: number;
    cached?: boolean;
    truncated?: boolean;
    originalSizeBytes?: number;
    requestId?: string;
}): MCPToolResult;
/**
 * Create an error response.
 *
 * INV-MCP-RESP-001: Uses consistent envelope structure.
 * INV-MCP-RESP-002: Includes error code.
 * INV-MCP-RESP-006: Sets retryable based on error code.
 */
export declare function createErrorResponse(code: MCPErrorCode, message: string, options?: {
    context?: Record<string, unknown>;
    startTime?: number;
    retryAfterMs?: number;
    requestId?: string;
}): MCPToolResult;
/**
 * Create a list response with pagination.
 *
 * INV-MCP-RESP-003: Enforces list item limits.
 */
export declare function createListResponse<T>(items: T[], options?: {
    total?: number;
    limit?: number;
    offset?: number;
    startTime?: number;
    requestId?: string;
    limits?: MCPResponseLimits;
}): MCPToolResult;
/**
 * Create a not found error response.
 */
export declare function createNotFoundResponse(resourceType: string, resourceId: string, options?: {
    startTime?: number;
    requestId?: string;
}): MCPToolResult;
/**
 * Create a validation error response.
 */
export declare function createValidationErrorResponse(message: string, errors: Array<{
    path: string;
    message: string;
}>, options?: {
    startTime?: number;
    requestId?: string;
}): MCPToolResult;
/**
 * Create a timeout error response.
 */
export declare function createTimeoutResponse(timeoutMs: number, options?: {
    startTime?: number;
    requestId?: string;
}): MCPToolResult;
/**
 * Create a memory pressure error response.
 */
export declare function createMemoryPressureResponse(pressureLevel: string, options?: {
    startTime?: number;
    requestId?: string;
}): MCPToolResult;
/**
 * Create an internal error response.
 */
export declare function createInternalErrorResponse(error: Error, options?: {
    startTime?: number;
    requestId?: string;
}): MCPToolResult;
/**
 * Truncate a string to max length.
 *
 * INV-MCP-RESP-003: Enforces string length limits.
 * INV-MCP-RESP-004: Adds truncation indicator.
 */
export declare function truncateString(str: string, maxLength: number, suffix?: string): {
    text: string;
    truncated: boolean;
};
/**
 * Truncate response data to fit within size limits.
 *
 * INV-MCP-RESP-003: Enforces response size limits.
 * INV-MCP-RESP-004: Sets truncated flag.
 */
export declare function truncateResponse<T>(data: T, limits?: MCPResponseLimits): {
    data: T;
    truncated: boolean;
    originalSizeBytes: number;
};
//# sourceMappingURL=helpers.d.ts.map