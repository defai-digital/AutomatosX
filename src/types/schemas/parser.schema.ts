/**
 * parser.schema.ts
 *
 * Zod validation schemas for parser outputs (Tree-sitter AST processing).
 * Ensures type safety and data integrity for code intelligence indexing.
 *
 * ADR-014 Phase 3: Parser Output Validation
 * Week 2 Day 5 Morning
 */

import { z } from 'zod';

// ============================================================================
// Symbol Kind Enum
// ============================================================================

/**
 * Symbol types extracted from source code
 * Supported across 45+ languages with varying subsets
 */
export const SymbolKindSchema = z.enum([
  'function',
  'class',
  'interface',
  'type',
  'variable',
  'constant',
  'method',
  'enum',
  'struct',
  'trait',
  'module',
]);

export type SymbolKind = z.infer<typeof SymbolKindSchema>;

// ============================================================================
// Symbol Schema (Domain Object)
// ============================================================================

/**
 * Symbol extracted from source code via Tree-sitter parser
 *
 * Validation rules:
 * - name: non-empty string
 * - kind: valid SymbolKind enum value
 * - line: positive integer (1-indexed)
 * - column: non-negative integer (0-indexed)
 * - endLine: must be >= line if provided
 * - endColumn: must be > column if endLine === line
 * - metadata: optional arbitrary data (language-specific features)
 *
 * @example Valid symbol
 * ```typescript
 * {
 *   name: 'getUserById',
 *   kind: 'function',
 *   line: 42,
 *   column: 10,
 *   endLine: 45,
 *   endColumn: 1,
 *   metadata: { async: true, exported: true }
 * }
 * ```
 */
export const SymbolSchema = z
  .object({
    name: z.string().min(1, 'Symbol name cannot be empty'),
    kind: SymbolKindSchema,
    line: z.number().int().positive('Line number must be positive (1-indexed)'),
    column: z.number().int().nonnegative('Column number must be non-negative (0-indexed)'),
    endLine: z.number().int().positive().optional(),
    endColumn: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      // Validation: endLine must be >= line if provided
      if (data.endLine !== undefined) {
        return data.endLine >= data.line;
      }
      return true;
    },
    {
      message: 'endLine must be greater than or equal to line',
      path: ['endLine'],
    }
  )
  .refine(
    (data) => {
      // Validation: if endLine === line, then endColumn must be > column
      if (data.endLine === data.line && data.endColumn !== undefined) {
        return data.endColumn > data.column;
      }
      return true;
    },
    {
      message: 'endColumn must be greater than column when on the same line',
      path: ['endColumn'],
    }
  );

export type Symbol = z.infer<typeof SymbolSchema>;

// ============================================================================
// Parse Result Schema
// ============================================================================

/**
 * Result of parsing a source file via Tree-sitter
 *
 * Validation rules:
 * - symbols: array of validated Symbol objects
 * - parseTime: non-negative number (milliseconds)
 * - nodeCount: non-negative integer (AST node count)
 * - parseTime < 60000ms (sanity check for infinite loops)
 *
 * @example Valid parse result
 * ```typescript
 * {
 *   symbols: [
 *     { name: 'User', kind: 'class', line: 1, column: 0 },
 *     { name: 'getUserById', kind: 'function', line: 10, column: 2 }
 *   ],
 *   parseTime: 12.5,
 *   nodeCount: 145
 * }
 * ```
 */
export const ParseResultSchema = z
  .object({
    symbols: z.array(SymbolSchema),
    parseTime: z.number().nonnegative('Parse time must be non-negative'),
    nodeCount: z.number().int().nonnegative('Node count must be non-negative'),
  })
  .refine(
    (data) => {
      // Validation: parseTime should be reasonable (< 60 seconds)
      // This catches potential infinite loops or hung parsers
      return data.parseTime < 60000;
    },
    {
      message: 'Parse time exceeds 60 seconds - possible infinite loop or hung parser',
    }
  );

export type ParseResult = z.infer<typeof ParseResultSchema>;

// ============================================================================
// Language Detection Result Schema
// ============================================================================

/**
 * Result of language detection for a file
 *
 * Validation rules:
 * - language: non-empty string
 * - confidence: number between 0 and 1
 *
 * @example
 * ```typescript
 * {
 *   language: 'typescript',
 *   confidence: 0.95
 * }
 * ```
 */
export const LanguageDetectionSchema = z.object({
  language: z.string().min(1, 'Language identifier cannot be empty'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
});

export type LanguageDetection = z.infer<typeof LanguageDetectionSchema>;

// ============================================================================
// Parser Error Schema
// ============================================================================

/**
 * Error that occurred during parsing
 *
 * Validation rules:
 * - message: non-empty error message
 * - line: optional positive integer
 * - column: optional non-negative integer
 * - severity: error level (error, warning, info)
 *
 * @example
 * ```typescript
 * {
 *   message: 'Unexpected token',
 *   line: 42,
 *   column: 10,
 *   severity: 'error'
 * }
 * ```
 */
export const ParserErrorSchema = z.object({
  message: z.string().min(1, 'Error message cannot be empty'),
  line: z.number().int().positive().optional(),
  column: z.number().int().nonnegative().optional(),
  severity: z.enum(['error', 'warning', 'info']).default('error'),
  code: z.string().optional(),
});

export type ParserError = z.infer<typeof ParserErrorSchema>;

// ============================================================================
// Parse Result with Errors Schema
// ============================================================================

/**
 * Parse result that may include partial symbols and errors
 *
 * Used for fault-tolerant parsing where we extract what we can
 * even if the file has syntax errors.
 *
 * @example
 * ```typescript
 * {
 *   symbols: [{ name: 'partialFunction', kind: 'function', line: 1, column: 0 }],
 *   parseTime: 5.2,
 *   nodeCount: 50,
 *   errors: [{ message: 'Unexpected token', line: 10, column: 5, severity: 'error' }]
 * }
 * ```
 */
export const ParseResultWithErrorsSchema = ParseResultSchema.merge(
  z.object({
    errors: z.array(ParserErrorSchema).optional(),
  })
);

export type ParseResultWithErrors = z.infer<typeof ParseResultWithErrorsSchema>;

// ============================================================================
// Validation Helper Functions
// ============================================================================

/**
 * Validate a symbol kind
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated SymbolKind
 * @throws {z.ZodError} If validation fails
 */
export function validateSymbolKind(data: unknown): SymbolKind {
  return SymbolKindSchema.parse(data);
}

/**
 * Validate a symbol object
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated Symbol
 * @throws {z.ZodError} If validation fails
 */
export function validateSymbol(data: unknown): Symbol {
  return SymbolSchema.parse(data);
}

/**
 * Validate a parse result object
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated ParseResult
 * @throws {z.ZodError} If validation fails
 */
export function validateParseResult(data: unknown): ParseResult {
  return ParseResultSchema.parse(data);
}

/**
 * Validate a parse result with errors
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated ParseResultWithErrors
 * @throws {z.ZodError} If validation fails
 */
export function validateParseResultWithErrors(data: unknown): ParseResultWithErrors {
  return ParseResultWithErrorsSchema.parse(data);
}

/**
 * Validate a language detection result
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated LanguageDetection
 * @throws {z.ZodError} If validation fails
 */
export function validateLanguageDetection(data: unknown): LanguageDetection {
  return LanguageDetectionSchema.parse(data);
}

// ============================================================================
// Safe Validation Functions (Don't Throw)
// ============================================================================

/**
 * Safely validate a symbol kind
 * Returns result object with success flag instead of throwing
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with success flag and data/error
 */
export function safeValidateSymbolKind(data: unknown) {
  return SymbolKindSchema.safeParse(data);
}

/**
 * Safely validate a symbol object
 * Returns result object with success flag instead of throwing
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with success flag and data/error
 */
export function safeValidateSymbol(data: unknown) {
  return SymbolSchema.safeParse(data);
}

/**
 * Safely validate a parse result object
 * Returns result object with success flag instead of throwing
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with success flag and data/error
 */
export function safeValidateParseResult(data: unknown) {
  return ParseResultSchema.safeParse(data);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid SymbolKind
 *
 * @param value - Value to check
 * @returns True if value is a valid SymbolKind
 */
export function isSymbolKind(value: unknown): value is SymbolKind {
  return SymbolKindSchema.safeParse(value).success;
}

/**
 * Check if a value is a valid Symbol
 *
 * @param value - Value to check
 * @returns True if value is a valid Symbol
 */
export function isSymbol(value: unknown): value is Symbol {
  return SymbolSchema.safeParse(value).success;
}

/**
 * Check if a value is a valid ParseResult
 *
 * @param value - Value to check
 * @returns True if value is a valid ParseResult
 */
export function isParseResult(value: unknown): value is ParseResult {
  return ParseResultSchema.safeParse(value).success;
}

// ============================================================================
// Symbol Kind Helpers
// ============================================================================

/**
 * Get all valid symbol kinds
 *
 * @returns Array of all SymbolKind values
 */
export function getAllSymbolKinds(): SymbolKind[] {
  return SymbolKindSchema.options;
}

/**
 * Check if a string is a valid symbol kind
 *
 * @param kind - String to check
 * @returns True if kind is a valid SymbolKind
 */
export function isValidSymbolKind(kind: string): kind is SymbolKind {
  return SymbolKindSchema.safeParse(kind).success;
}
