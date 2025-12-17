/**
 * MCP Tool Input/Output Validation
 *
 * Validates tool inputs and outputs against Zod schemas.
 *
 * Invariants:
 * - INV-MCP-001: Input validation MUST occur before tool execution
 * - INV-MCP-003: Standardized error codes for all failures
 * - INV-MCP-005: Input isolation - inputs MUST NOT be mutated
 * - INV-MCP-VAL-001: Output validation failures logged but don't break response
 * - INV-MCP-VAL-002: All schemas defined in contracts package
 */

import type { ToolHandler, MCPToolResult } from './types.js';

// ============================================================================
// Standard Error Codes (INV-MCP-003)
// ============================================================================

/**
 * Standard error codes per INV-MCP-003
 * Must match StandardErrorCodes from @automatosx/contracts
 */
export const ToolErrorCodes = {
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT: 'TIMEOUT',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type ToolErrorCode = (typeof ToolErrorCodes)[keyof typeof ToolErrorCodes];

/**
 * Tool error structure per INV-MCP-003
 */
export interface ToolError {
  /** Standard error code */
  code: ToolErrorCode | string;
  /** Human-readable message */
  message: string;
  /** Tool name */
  tool: string;
  /** Additional context */
  details?: unknown;
}

/**
 * Creates a standardized tool error response
 * INV-MCP-003: All failures MUST return standardized error codes
 */
export function createToolError(
  code: ToolErrorCode | string,
  message: string,
  toolName: string,
  details?: unknown
): MCPToolResult {
  const error: ToolError = {
    code,
    message,
    tool: toolName,
  };

  if (details !== undefined) {
    error.details = details;
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(error),
      },
    ],
    isError: true,
  };
}

/**
 * Creates an INVALID_INPUT error
 * INV-MCP-003: Standardized error codes
 */
export function createInputError(
  toolName: string,
  message: string,
  details?: unknown
): MCPToolResult {
  return createToolError(ToolErrorCodes.INVALID_INPUT, message, toolName, details);
}

/**
 * Creates an INTERNAL_ERROR error
 * INV-MCP-003: Standardized error codes
 */
export function createInternalError(
  toolName: string,
  message: string,
  details?: unknown
): MCPToolResult {
  return createToolError(ToolErrorCodes.INTERNAL_ERROR, message, toolName, details);
}

/**
 * Creates a RESOURCE_NOT_FOUND error
 * INV-MCP-003: Standardized error codes
 */
export function createNotFoundError(
  toolName: string,
  message: string,
  details?: unknown
): MCPToolResult {
  return createToolError(ToolErrorCodes.RESOURCE_NOT_FOUND, message, toolName, details);
}

/**
 * Creates a NOT_IMPLEMENTED error
 * INV-MCP-003: Standardized error codes
 */
export function createNotImplementedError(
  toolName: string,
  message: string
): MCPToolResult {
  return createToolError(ToolErrorCodes.NOT_IMPLEMENTED, message, toolName);
}

// ============================================================================
// Input Isolation (INV-MCP-005)
// ============================================================================

/**
 * Deep freezes an object to prevent mutation
 * INV-MCP-005: Tools MUST NOT modify their input objects
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Freeze arrays
  if (Array.isArray(obj)) {
    obj.forEach((item) => deepFreeze(item));
    return Object.freeze(obj) as T;
  }

  // Freeze object properties recursively
  const propNames = Object.getOwnPropertyNames(obj);
  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj) as T;
}

/**
 * Zod-like schema interface for validation
 * This allows using schemas from contracts without direct zod dependency
 */
interface ZodLikeSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { errors: Array<{ path: (string | number)[]; message: string }> } };
}

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Result of output validation
 */
export interface ValidationResult<T> {
  /** Whether validation passed */
  valid: boolean;
  /** Validated data (or original if validation failed) */
  data: T;
  /** Validation errors if any */
  errors?: string[];
}

// ============================================================================
// Validation Logger
// ============================================================================

/**
 * Validation logger interface
 */
export interface ValidationLogger {
  warn(message: string, context?: Record<string, unknown>): void;
}

/**
 * Default console logger
 */
const defaultLogger: ValidationLogger = {
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(`[MCP-VALIDATION] ${message}`, context ?? '');
  },
};

let currentLogger: ValidationLogger = defaultLogger;

/**
 * Sets the validation logger
 */
export function setValidationLogger(logger: ValidationLogger): void {
  currentLogger = logger;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates output against a Zod schema
 *
 * INV-MCP-VAL-001: Logs failures but returns original data
 */
export function validateOutput<T>(
  schema: ZodLikeSchema<T>,
  toolName: string,
  output: unknown
): ValidationResult<T> {
  const result = schema.safeParse(output);

  if (result.success) {
    return { valid: true, data: result.data };
  }

  // INV-MCP-VAL-001: Log but don't fail
  const errors = result.error.errors.map(
    (e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`
  );

  currentLogger.warn(`Output validation failed for ${toolName}`, {
    errors,
    output,
  });

  return { valid: false, data: output as T, errors };
}

/**
 * Parses JSON from tool result content
 */
export function parseToolResultContent(result: MCPToolResult): unknown | undefined {
  if (result.content.length === 0) {
    return undefined;
  }

  const firstContent = result.content[0];
  if (firstContent?.text === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(firstContent.text);
  } catch {
    return undefined;
  }
}

// ============================================================================
// Validation Wrapper
// ============================================================================

/**
 * Wraps a tool handler with output validation
 *
 * INV-MCP-VAL-001: Validation failures logged but response still returned
 */
export function withValidation<T>(
  handler: ToolHandler,
  outputSchema: ZodLikeSchema<T>,
  toolName: string
): ToolHandler {
  return async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    const result = await handler(args);

    // Parse and validate output
    const parsed = parseToolResultContent(result);
    if (parsed !== undefined) {
      validateOutput(outputSchema, toolName, parsed);
    }

    // Always return original result (INV-MCP-VAL-001)
    return result;
  };
}

// ============================================================================
// Batch Validation Wrapper
// ============================================================================

/**
 * Schema registry for tool outputs
 */
export type OutputSchemaRegistry = Record<string, ZodLikeSchema<unknown>>;

/**
 * Wraps all handlers with validation using a schema registry
 */
export function wrapHandlersWithValidation(
  handlers: Record<string, ToolHandler>,
  schemas: OutputSchemaRegistry
): Record<string, ToolHandler> {
  const wrapped: Record<string, ToolHandler> = {};

  for (const [name, handler] of Object.entries(handlers)) {
    const schema = schemas[name];
    if (schema !== undefined) {
      wrapped[name] = withValidation(handler, schema, name);
    } else {
      // No schema defined - pass through unchanged
      wrapped[name] = handler;
    }
  }

  return wrapped;
}

// ============================================================================
// Input Validation (INV-MCP-001)
// ============================================================================

/**
 * Input schema registry type
 */
export type InputSchemaRegistry = Record<string, ZodLikeSchema<unknown>>;

/**
 * Creates an INVALID_INPUT error response for schema validation failures
 * INV-MCP-001: Validation failures return INVALID_INPUT error
 * INV-MCP-003: Uses standardized error code
 */
export function createInvalidInputError(
  toolName: string,
  errors: string[]
): MCPToolResult {
  return createToolError(
    ToolErrorCodes.INVALID_INPUT,
    `Input validation failed for ${toolName}`,
    toolName,
    { validationErrors: errors }
  );
}

/**
 * Validates input against a Zod schema
 * INV-MCP-001: Input validation MUST occur before tool execution
 *
 * @returns validated data or null if validation fails
 */
export function validateInput<T>(
  schema: ZodLikeSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(
    (e: { path: (string | number)[]; message: string }) =>
      `${e.path.length > 0 ? e.path.join('.') + ': ' : ''}${e.message}`
  );

  return { success: false, errors };
}

/**
 * Wraps a tool handler with input validation and isolation
 * INV-MCP-001: Input validation MUST occur before tool execution
 * INV-MCP-005: Input isolation - inputs MUST NOT be mutated
 */
export function withInputValidation<T>(
  handler: ToolHandler,
  inputSchema: ZodLikeSchema<T>,
  toolName: string
): ToolHandler {
  return async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    // INV-MCP-001: Validate input BEFORE execution
    const validation = validateInput(inputSchema, args);

    if (!validation.success) {
      currentLogger.warn(`Input validation failed for ${toolName}`, {
        errors: validation.errors,
        input: args,
      });
      return createInvalidInputError(toolName, validation.errors);
    }

    // INV-MCP-005: Freeze input to prevent mutation
    const frozenInput = deepFreeze(validation.data as Record<string, unknown>);

    // Execute with validated and frozen data
    return handler(frozenInput);
  };
}

/**
 * Wraps a tool handler with both input and output validation
 * INV-MCP-001: Input validation before execution
 * INV-MCP-005: Input isolation - inputs MUST NOT be mutated
 * INV-MCP-VAL-001: Output validation after execution
 */
export function withFullValidation<TInput, TOutput>(
  handler: ToolHandler,
  inputSchema: ZodLikeSchema<TInput>,
  outputSchema: ZodLikeSchema<TOutput>,
  toolName: string
): ToolHandler {
  return async (args: Record<string, unknown>): Promise<MCPToolResult> => {
    // INV-MCP-001: Validate input BEFORE execution
    const inputValidation = validateInput(inputSchema, args);

    if (!inputValidation.success) {
      currentLogger.warn(`Input validation failed for ${toolName}`, {
        errors: inputValidation.errors,
        input: args,
      });
      return createInvalidInputError(toolName, inputValidation.errors);
    }

    // INV-MCP-005: Freeze input to prevent mutation
    const frozenInput = deepFreeze(inputValidation.data as Record<string, unknown>);

    // Execute with validated and frozen data
    const result = await handler(frozenInput);

    // INV-MCP-VAL-001: Validate output (log but don't fail)
    const parsed = parseToolResultContent(result);
    if (parsed !== undefined) {
      validateOutput(outputSchema, toolName, parsed);
    }

    return result;
  };
}

/**
 * Wraps all handlers with input validation using a schema registry
 */
export function wrapHandlersWithInputValidation(
  handlers: Record<string, ToolHandler>,
  inputSchemas: InputSchemaRegistry
): Record<string, ToolHandler> {
  const wrapped: Record<string, ToolHandler> = {};

  for (const [name, handler] of Object.entries(handlers)) {
    const schema = inputSchemas[name];
    if (schema !== undefined) {
      wrapped[name] = withInputValidation(handler, schema, name);
    } else {
      // No schema defined - pass through unchanged (but log warning)
      currentLogger.warn(`No input schema defined for tool: ${name}`);
      wrapped[name] = handler;
    }
  }

  return wrapped;
}

/**
 * Wraps all handlers with both input and output validation
 */
export function wrapHandlersWithFullValidation(
  handlers: Record<string, ToolHandler>,
  inputSchemas: InputSchemaRegistry,
  outputSchemas: OutputSchemaRegistry
): Record<string, ToolHandler> {
  const wrapped: Record<string, ToolHandler> = {};

  for (const [name, handler] of Object.entries(handlers)) {
    const inputSchema = inputSchemas[name];
    const outputSchema = outputSchemas[name];

    if (inputSchema !== undefined && outputSchema !== undefined) {
      wrapped[name] = withFullValidation(handler, inputSchema, outputSchema, name);
    } else if (inputSchema !== undefined) {
      wrapped[name] = withInputValidation(handler, inputSchema, name);
    } else if (outputSchema !== undefined) {
      wrapped[name] = withValidation(handler, outputSchema, name);
    } else {
      wrapped[name] = handler;
    }
  }

  return wrapped;
}

// ============================================================================
// Type-Safe Handler Utilities (INV-MCP-001)
// ============================================================================

/**
 * Type-safe typed handler signature
 * Handlers receive validated input with proper TypeScript types
 */
export type TypedToolHandler<T> = (input: T) => Promise<MCPToolResult>;

/**
 * Creates a type-safe tool handler
 * Input is already validated by withInputValidation wrapper
 *
 * INV-MCP-001: Input has been validated before this handler is called
 * INV-MCP-005: Input is frozen and MUST NOT be mutated
 *
 * @example
 * ```typescript
 * export const handleMemoryStore = createTypedHandler<MemoryStoreInput>((input) => {
 *   const { key, value, namespace } = input;
 *   // Type-safe access without casts!
 * });
 * ```
 */
export function createTypedHandler<T>(
  handler: TypedToolHandler<T>
): ToolHandler {
  // The wrapper will validate input before calling this
  // We trust the input is validated and typed
  return (args: Record<string, unknown>) => handler(args as T);
}

/**
 * Extracts typed input from validated args
 * Use when you can't use createTypedHandler pattern
 *
 * INV-MCP-001: Only use AFTER validation wrapper has run
 *
 * @example
 * ```typescript
 * export const handleTool: ToolHandler = (args) => {
 *   const input = getValidatedInput<MyInputType>(args);
 *   // Now input is properly typed
 * };
 * ```
 */
export function getValidatedInput<T>(args: Record<string, unknown>): T {
  // Input has been validated by wrapper - safe to cast
  return args as T;
}

/**
 * Creates a success response with JSON content
 * INV-MCP-003: Consistent response format
 */
export function createSuccessResponse(data: unknown): MCPToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}
