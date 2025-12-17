import type {
  MCPRequestLimits,
  ValidationResult,
  ValidationError,
} from '@automatosx/contracts';
import {
  DEFAULT_REQUEST_LIMITS,
  TOOL_ARRAY_FIELDS,
  getArrayLimit,
} from '@automatosx/contracts';

/**
 * Validate request against limits.
 *
 * Invariants enforced:
 * - INV-MCP-LIMIT-001: Array size enforcement
 * - INV-MCP-LIMIT-002: Early rejection
 * - INV-MCP-LIMIT-003: Tool-specific limits
 * - INV-MCP-LIMIT-004: Descriptive errors
 */
export function validateRequest(
  toolName: string,
  args: unknown,
  limits: MCPRequestLimits = DEFAULT_REQUEST_LIMITS
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate request size
  const requestSize = estimateRequestSize(args);
  if (requestSize > limits.maxRequestBytes) {
    errors.push({
      path: '$',
      code: 'REQUEST_TOO_LARGE',
      message: `Request size (${requestSize} bytes) exceeds limit (${limits.maxRequestBytes} bytes)`,
      limit: limits.maxRequestBytes,
      actual: requestSize,
    });
  }

  // Validate arrays and strings recursively
  validateValue(args, '$', toolName, limits, errors, 0);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Recursively validate a value against limits.
 */
function validateValue(
  value: unknown,
  path: string,
  toolName: string,
  limits: MCPRequestLimits,
  errors: ValidationError[],
  depth: number
): void {
  // Check depth
  if (depth > limits.maxObjectDepth) {
    errors.push({
      path,
      code: 'OBJECT_TOO_DEEP',
      message: `Object depth (${depth}) exceeds limit (${limits.maxObjectDepth})`,
      limit: limits.maxObjectDepth,
      actual: depth,
    });
    return;
  }

  if (Array.isArray(value)) {
    validateArray(value, path, toolName, limits, errors, depth);
  } else if (typeof value === 'string') {
    validateString(value, path, limits, errors);
  } else if (value !== null && typeof value === 'object') {
    validateObject(value as Record<string, unknown>, path, toolName, limits, errors, depth);
  }
}

/**
 * Validate an array against limits.
 *
 * INV-MCP-LIMIT-001: Array size enforcement.
 * INV-MCP-LIMIT-003: Tool-specific limits.
 */
function validateArray(
  arr: unknown[],
  path: string,
  toolName: string,
  limits: MCPRequestLimits,
  errors: ValidationError[],
  depth: number
): void {
  // Get field name from path (last segment)
  const fieldName = path.split('.').pop() ?? '';

  // Check if this field has tool-specific limits
  const toolArrayFields = TOOL_ARRAY_FIELDS[toolName] ?? [];
  const isKnownArrayField = toolArrayFields.includes(fieldName);

  // Get the appropriate limit
  const arrayLimit = isKnownArrayField
    ? getArrayLimit(toolName, fieldName, limits)
    : limits.maxArraySize;

  if (arr.length > arrayLimit) {
    errors.push({
      path,
      code: 'ARRAY_TOO_LARGE',
      message: `Array at '${path}' has ${arr.length} items, exceeds limit of ${arrayLimit}`,
      limit: arrayLimit,
      actual: arr.length,
    });
  }

  // Validate array items (with depth + 1)
  for (let i = 0; i < Math.min(arr.length, 100); i++) {
    validateValue(arr[i], `${path}[${i}]`, toolName, limits, errors, depth + 1);
  }
}

/**
 * Validate a string against limits.
 */
function validateString(
  str: string,
  path: string,
  limits: MCPRequestLimits,
  errors: ValidationError[]
): void {
  if (str.length > limits.maxStringLength) {
    errors.push({
      path,
      code: 'STRING_TOO_LONG',
      message: `String at '${path}' has ${str.length} characters, exceeds limit of ${limits.maxStringLength}`,
      limit: limits.maxStringLength,
      actual: str.length,
    });
  }
}

/**
 * Validate an object against limits.
 */
function validateObject(
  obj: Record<string, unknown>,
  path: string,
  toolName: string,
  limits: MCPRequestLimits,
  errors: ValidationError[],
  depth: number
): void {
  for (const [key, value] of Object.entries(obj)) {
    const childPath = path === '$' ? key : `${path}.${key}`;
    validateValue(value, childPath, toolName, limits, errors, depth + 1);
  }
}

/**
 * Estimate request size in bytes.
 */
function estimateRequestSize(value: unknown): number {
  try {
    const json = JSON.stringify(value);
    return json.length * 2; // Approximate UTF-8 size
  } catch {
    return 0;
  }
}

/**
 * Create a validation middleware for tool handlers.
 *
 * INV-MCP-LIMIT-002: Early rejection.
 */
export function createValidationMiddleware(
  limits: MCPRequestLimits = DEFAULT_REQUEST_LIMITS
) {
  return function validateToolRequest(
    toolName: string,
    args: unknown
  ): ValidationResult {
    return validateRequest(toolName, args, limits);
  };
}

/**
 * Check if a validation result indicates success.
 */
export function isValidRequest(result: ValidationResult): result is { valid: true } {
  return result.valid;
}

/**
 * Format validation errors for display.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => {
      let msg = `${e.path}: ${e.message}`;
      if (e.limit !== undefined && e.actual !== undefined) {
        msg += ` (limit: ${e.limit}, actual: ${e.actual})`;
      }
      return msg;
    })
    .join('\n');
}
