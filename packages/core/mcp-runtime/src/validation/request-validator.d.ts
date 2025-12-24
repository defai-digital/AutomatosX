import type { MCPRequestLimits, ValidationResult, ValidationError } from '@automatosx/contracts';
/**
 * Validate request against limits.
 *
 * Invariants enforced:
 * - INV-MCP-LIMIT-001: Array size enforcement
 * - INV-MCP-LIMIT-002: Early rejection
 * - INV-MCP-LIMIT-003: Tool-specific limits
 * - INV-MCP-LIMIT-004: Descriptive errors
 */
export declare function validateRequest(toolName: string, args: unknown, limits?: MCPRequestLimits): ValidationResult;
/**
 * Create a validation middleware for tool handlers.
 *
 * INV-MCP-LIMIT-002: Early rejection.
 */
export declare function createValidationMiddleware(limits?: MCPRequestLimits): (toolName: string, args: unknown) => ValidationResult;
/**
 * Check if a validation result indicates success.
 */
export declare function isValidRequest(result: ValidationResult): result is {
    valid: true;
};
/**
 * Format validation errors for display.
 */
export declare function formatValidationErrors(errors: ValidationError[]): string;
//# sourceMappingURL=request-validator.d.ts.map