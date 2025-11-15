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
/**
 * Symbol types extracted from source code
 * Supported across 45+ languages with varying subsets
 */
export declare const SymbolKindSchema: z.ZodEnum<["function", "class", "interface", "type", "variable", "constant", "method", "enum", "struct", "trait", "module"]>;
export type SymbolKind = z.infer<typeof SymbolKindSchema>;
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
export declare const SymbolSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<["function", "class", "interface", "type", "variable", "constant", "method", "enum", "struct", "trait", "module"]>;
    line: z.ZodNumber;
    column: z.ZodNumber;
    endLine: z.ZodOptional<z.ZodNumber>;
    endColumn: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    endColumn?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    endLine?: number | undefined;
}, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    endColumn?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    endLine?: number | undefined;
}>, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    endColumn?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    endLine?: number | undefined;
}, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    endColumn?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    endLine?: number | undefined;
}>, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    endColumn?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    endLine?: number | undefined;
}, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    endColumn?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    endLine?: number | undefined;
}>;
export type Symbol = z.infer<typeof SymbolSchema>;
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
export declare const ParseResultSchema: z.ZodEffects<z.ZodObject<{
    symbols: z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodEnum<["function", "class", "interface", "type", "variable", "constant", "method", "enum", "struct", "trait", "module"]>;
        line: z.ZodNumber;
        column: z.ZodNumber;
        endLine: z.ZodOptional<z.ZodNumber>;
        endColumn: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }, {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }>, {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }, {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }>, {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }, {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }>, "many">;
    parseTime: z.ZodNumber;
    nodeCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    symbols: {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }[];
    parseTime: number;
    nodeCount: number;
}, {
    symbols: {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }[];
    parseTime: number;
    nodeCount: number;
}>, {
    symbols: {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }[];
    parseTime: number;
    nodeCount: number;
}, {
    symbols: {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }[];
    parseTime: number;
    nodeCount: number;
}>;
export type ParseResult = z.infer<typeof ParseResultSchema>;
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
export declare const LanguageDetectionSchema: z.ZodObject<{
    language: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    language: string;
    confidence: number;
}, {
    language: string;
    confidence: number;
}>;
export type LanguageDetection = z.infer<typeof LanguageDetectionSchema>;
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
export declare const ParserErrorSchema: z.ZodObject<{
    message: z.ZodString;
    line: z.ZodOptional<z.ZodNumber>;
    column: z.ZodOptional<z.ZodNumber>;
    severity: z.ZodDefault<z.ZodEnum<["error", "warning", "info"]>>;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    severity: "error" | "info" | "warning";
    column?: number | undefined;
    line?: number | undefined;
    code?: string | undefined;
}, {
    message: string;
    column?: number | undefined;
    line?: number | undefined;
    code?: string | undefined;
    severity?: "error" | "info" | "warning" | undefined;
}>;
export type ParserError = z.infer<typeof ParserErrorSchema>;
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
export declare const ParseResultWithErrorsSchema: any;
export type ParseResultWithErrors = z.infer<typeof ParseResultWithErrorsSchema>;
/**
 * Validate a symbol kind
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated SymbolKind
 * @throws {z.ZodError} If validation fails
 */
export declare function validateSymbolKind(data: unknown): SymbolKind;
/**
 * Validate a symbol object
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated Symbol
 * @throws {z.ZodError} If validation fails
 */
export declare function validateSymbol(data: unknown): Symbol;
/**
 * Validate a parse result object
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated ParseResult
 * @throws {z.ZodError} If validation fails
 */
export declare function validateParseResult(data: unknown): ParseResult;
/**
 * Validate a parse result with errors
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated ParseResultWithErrors
 * @throws {z.ZodError} If validation fails
 */
export declare function validateParseResultWithErrors(data: unknown): ParseResultWithErrors;
/**
 * Validate a language detection result
 * Throws ZodError if validation fails
 *
 * @param data - Unknown data to validate
 * @returns Validated LanguageDetection
 * @throws {z.ZodError} If validation fails
 */
export declare function validateLanguageDetection(data: unknown): LanguageDetection;
/**
 * Safely validate a symbol kind
 * Returns result object with success flag instead of throwing
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with success flag and data/error
 */
export declare function safeValidateSymbolKind(data: unknown): z.SafeParseReturnType<"function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module", "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module">;
/**
 * Safely validate a symbol object
 * Returns result object with success flag instead of throwing
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with success flag and data/error
 */
export declare function safeValidateSymbol(data: unknown): z.SafeParseReturnType<{
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    endColumn?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    endLine?: number | undefined;
}, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    endColumn?: number | undefined;
    metadata?: Record<string, unknown> | undefined;
    endLine?: number | undefined;
}>;
/**
 * Safely validate a parse result object
 * Returns result object with success flag instead of throwing
 *
 * @param data - Unknown data to validate
 * @returns SafeParseResult with success flag and data/error
 */
export declare function safeValidateParseResult(data: unknown): z.SafeParseReturnType<{
    symbols: {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }[];
    parseTime: number;
    nodeCount: number;
}, {
    symbols: {
        name: string;
        kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
        column: number;
        line: number;
        endColumn?: number | undefined;
        metadata?: Record<string, unknown> | undefined;
        endLine?: number | undefined;
    }[];
    parseTime: number;
    nodeCount: number;
}>;
/**
 * Check if a value is a valid SymbolKind
 *
 * @param value - Value to check
 * @returns True if value is a valid SymbolKind
 */
export declare function isSymbolKind(value: unknown): value is SymbolKind;
/**
 * Check if a value is a valid Symbol
 *
 * @param value - Value to check
 * @returns True if value is a valid Symbol
 */
export declare function isSymbol(value: unknown): value is Symbol;
/**
 * Check if a value is a valid ParseResult
 *
 * @param value - Value to check
 * @returns True if value is a valid ParseResult
 */
export declare function isParseResult(value: unknown): value is ParseResult;
/**
 * Get all valid symbol kinds
 *
 * @returns Array of all SymbolKind values
 */
export declare function getAllSymbolKinds(): SymbolKind[];
/**
 * Check if a string is a valid symbol kind
 *
 * @param kind - String to check
 * @returns True if kind is a valid SymbolKind
 */
export declare function isValidSymbolKind(kind: string): kind is SymbolKind;
//# sourceMappingURL=parser.schema.d.ts.map