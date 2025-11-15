/**
 * database.schema.ts
 *
 * Zod validation schemas for database DAO inputs and outputs.
 * Ensures data integrity before SQL execution and after query results.
 *
 * ADR-014 Phase 4: Database Validation
 * Week 2 Day 5 Afternoon
 */
import { z } from 'zod';
/**
 * File input for insertion into files table
 *
 * Validation rules:
 * - path: non-empty string
 * - content: string with max size 10MB (prevents memory issues)
 * - language: optional language identifier
 *
 * @example
 * ```typescript
 * {
 *   path: '/src/services/UserService.ts',
 *   content: 'export class UserService { ... }',
 *   language: 'typescript'
 * }
 * ```
 */
export declare const FileInputSchema: z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    content: string;
    language?: string | undefined;
}, {
    path: string;
    content: string;
    language?: string | undefined;
}>;
export type FileInput = z.infer<typeof FileInputSchema>;
/**
 * File update for partial updates to files table
 *
 * Validation rules:
 * - At least one field must be provided
 * - content: max size 10MB if provided
 * - language: optional language identifier
 *
 * @example
 * ```typescript
 * {
 *   content: 'export class UserService { ... }' // Update content only
 * }
 * ```
 */
export declare const FileUpdateSchema: z.ZodEffects<z.ZodObject<{
    content: z.ZodOptional<z.ZodString>;
    language: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content?: string | undefined;
    language?: string | undefined;
}, {
    content?: string | undefined;
    language?: string | undefined;
}>, {
    content?: string | undefined;
    language?: string | undefined;
}, {
    content?: string | undefined;
    language?: string | undefined;
}>;
export type FileUpdate = z.infer<typeof FileUpdateSchema>;
/**
 * File record from database (SELECT result)
 *
 * Includes generated fields: id, hash, size, timestamps
 */
export declare const FileRecordSchema: z.ZodObject<{
    id: z.ZodNumber;
    path: z.ZodString;
    content: z.ZodString;
    hash: z.ZodString;
    size: z.ZodNumber;
    language: z.ZodNullable<z.ZodString>;
    indexed_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    id: number;
    content: string;
    language: string | null;
    updated_at: string;
    size: number;
    hash: string;
    indexed_at: string;
}, {
    path: string;
    id: number;
    content: string;
    language: string | null;
    updated_at: string;
    size: number;
    hash: string;
    indexed_at: string;
}>;
export type FileRecord = z.infer<typeof FileRecordSchema>;
/**
 * Symbol input for insertion into symbols table
 *
 * Validation rules:
 * - file_id: positive integer (foreign key to files table)
 * - name: non-empty symbol name
 * - kind: valid SymbolKind enum value
 * - line: positive integer (1-indexed)
 * - column: non-negative integer (0-indexed)
 * - end_line: must be >= line if provided
 * - end_column: must be > column if end_line === line
 *
 * @example
 * ```typescript
 * {
 *   file_id: 42,
 *   name: 'getUserById',
 *   kind: 'function',
 *   line: 10,
 *   column: 2,
 *   end_line: 15,
 *   end_column: 1
 * }
 * ```
 */
export declare const SymbolInputSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    file_id: z.ZodNumber;
    name: z.ZodString;
    kind: z.ZodEnum<["function", "class", "interface", "type", "variable", "constant", "method", "enum", "struct", "trait", "module"]>;
    line: z.ZodNumber;
    column: z.ZodNumber;
    end_line: z.ZodOptional<z.ZodNumber>;
    end_column: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    file_id: number;
    end_line?: number | undefined;
    end_column?: number | undefined;
}, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    file_id: number;
    end_line?: number | undefined;
    end_column?: number | undefined;
}>, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    file_id: number;
    end_line?: number | undefined;
    end_column?: number | undefined;
}, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    file_id: number;
    end_line?: number | undefined;
    end_column?: number | undefined;
}>, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    file_id: number;
    end_line?: number | undefined;
    end_column?: number | undefined;
}, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    file_id: number;
    end_line?: number | undefined;
    end_column?: number | undefined;
}>;
export type SymbolInput = z.infer<typeof SymbolInputSchema>;
/**
 * Symbol record from database (SELECT result)
 *
 * Includes generated id field
 */
export declare const SymbolRecordSchema: z.ZodObject<{
    id: z.ZodNumber;
    file_id: z.ZodNumber;
    name: z.ZodString;
    kind: z.ZodString;
    line: z.ZodNumber;
    column: z.ZodNumber;
    end_line: z.ZodNullable<z.ZodNumber>;
    end_column: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: string;
    column: number;
    id: number;
    line: number;
    file_id: number;
    end_line: number | null;
    end_column: number | null;
}, {
    name: string;
    kind: string;
    column: number;
    id: number;
    line: number;
    file_id: number;
    end_line: number | null;
    end_column: number | null;
}>;
export type SymbolRecord = z.infer<typeof SymbolRecordSchema>;
/**
 * Chunk input for insertion into chunks table
 *
 * Validation rules:
 * - file_id: positive integer (foreign key to files table)
 * - text: non-empty chunk text
 * - start_line: positive integer
 * - end_line: must be >= start_line
 * - embedding: optional JSON blob (vector embedding)
 *
 * @example
 * ```typescript
 * {
 *   file_id: 42,
 *   text: 'export class UserService { ... }',
 *   start_line: 10,
 *   end_line: 25,
 *   embedding: '[0.123, 0.456, ...]'
 * }
 * ```
 */
export declare const ChunkInputSchema: z.ZodEffects<z.ZodObject<{
    file_id: z.ZodNumber;
    text: z.ZodString;
    start_line: z.ZodNumber;
    end_line: z.ZodNumber;
    embedding: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    file_id: number;
    end_line: number;
    start_line: number;
    embedding?: string | undefined;
}, {
    text: string;
    file_id: number;
    end_line: number;
    start_line: number;
    embedding?: string | undefined;
}>, {
    text: string;
    file_id: number;
    end_line: number;
    start_line: number;
    embedding?: string | undefined;
}, {
    text: string;
    file_id: number;
    end_line: number;
    start_line: number;
    embedding?: string | undefined;
}>;
export type ChunkInput = z.infer<typeof ChunkInputSchema>;
/**
 * Chunk record from database (SELECT result)
 *
 * Includes generated id field
 */
export declare const ChunkRecordSchema: z.ZodObject<{
    id: z.ZodNumber;
    file_id: z.ZodNumber;
    text: z.ZodString;
    start_line: z.ZodNumber;
    end_line: z.ZodNumber;
    embedding: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    text: string;
    id: number;
    embedding: string | null;
    file_id: number;
    end_line: number;
    start_line: number;
}, {
    text: string;
    id: number;
    embedding: string | null;
    file_id: number;
    end_line: number;
    start_line: number;
}>;
export type ChunkRecord = z.infer<typeof ChunkRecordSchema>;
/**
 * Call input for insertion into calls table
 *
 * Represents a function/method call found in source code
 *
 * Validation rules:
 * - file_id: positive integer (foreign key to files table)
 * - caller: non-empty caller symbol name
 * - callee: non-empty callee symbol name
 * - line: positive integer
 * - column: non-negative integer
 *
 * @example
 * ```typescript
 * {
 *   file_id: 42,
 *   caller: 'getUserById',
 *   callee: 'database.query',
 *   line: 15,
 *   column: 10
 * }
 * ```
 */
export declare const CallInputSchema: z.ZodObject<{
    file_id: z.ZodNumber;
    caller: z.ZodString;
    callee: z.ZodString;
    line: z.ZodNumber;
    column: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    column: number;
    caller: string;
    callee: string;
    line: number;
    file_id: number;
}, {
    column: number;
    caller: string;
    callee: string;
    line: number;
    file_id: number;
}>;
export type CallInput = z.infer<typeof CallInputSchema>;
/**
 * Call record from database (SELECT result)
 *
 * Includes generated id field
 */
export declare const CallRecordSchema: z.ZodObject<{
    id: z.ZodNumber;
    file_id: z.ZodNumber;
    caller: z.ZodString;
    callee: z.ZodString;
    line: z.ZodNumber;
    column: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    column: number;
    id: number;
    caller: string;
    callee: string;
    line: number;
    file_id: number;
}, {
    column: number;
    id: number;
    caller: string;
    callee: string;
    line: number;
    file_id: number;
}>;
export type CallRecord = z.infer<typeof CallRecordSchema>;
/**
 * Import input for insertion into imports table
 *
 * Represents an import/require statement in source code
 *
 * Validation rules:
 * - file_id: positive integer (foreign key to files table)
 * - imported_name: non-empty imported symbol name
 * - imported_from: non-empty module/file path
 * - line: positive integer
 *
 * @example
 * ```typescript
 * {
 *   file_id: 42,
 *   imported_name: 'UserService',
 *   imported_from: './services/UserService',
 *   line: 3
 * }
 * ```
 */
export declare const ImportInputSchema: z.ZodObject<{
    file_id: z.ZodNumber;
    imported_name: z.ZodString;
    imported_from: z.ZodString;
    line: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    line: number;
    file_id: number;
    imported_name: string;
    imported_from: string;
}, {
    line: number;
    file_id: number;
    imported_name: string;
    imported_from: string;
}>;
export type ImportInput = z.infer<typeof ImportInputSchema>;
/**
 * Import record from database (SELECT result)
 *
 * Includes generated id field
 */
export declare const ImportRecordSchema: z.ZodObject<{
    id: z.ZodNumber;
    file_id: z.ZodNumber;
    imported_name: z.ZodString;
    imported_from: z.ZodString;
    line: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    line: number;
    file_id: number;
    imported_name: string;
    imported_from: string;
}, {
    id: number;
    line: number;
    file_id: number;
    imported_name: string;
    imported_from: string;
}>;
export type ImportRecord = z.infer<typeof ImportRecordSchema>;
export declare function validateFileInput(data: unknown): FileInput;
export declare function validateFileUpdate(data: unknown): FileUpdate;
export declare function validateFileRecord(data: unknown): FileRecord;
export declare function validateSymbolInput(data: unknown): SymbolInput;
export declare function validateSymbolRecord(data: unknown): SymbolRecord;
export declare function validateChunkInput(data: unknown): ChunkInput;
export declare function validateChunkRecord(data: unknown): ChunkRecord;
export declare function validateCallInput(data: unknown): CallInput;
export declare function validateCallRecord(data: unknown): CallRecord;
export declare function validateImportInput(data: unknown): ImportInput;
export declare function validateImportRecord(data: unknown): ImportRecord;
export declare function safeValidateFileInput(data: unknown): z.SafeParseReturnType<{
    path: string;
    content: string;
    language?: string | undefined;
}, {
    path: string;
    content: string;
    language?: string | undefined;
}>;
export declare function safeValidateSymbolInput(data: unknown): z.SafeParseReturnType<{
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    file_id: number;
    end_line?: number | undefined;
    end_column?: number | undefined;
}, {
    name: string;
    kind: "function" | "class" | "method" | "interface" | "type" | "variable" | "constant" | "enum" | "struct" | "trait" | "module";
    column: number;
    line: number;
    file_id: number;
    end_line?: number | undefined;
    end_column?: number | undefined;
}>;
export declare function safeValidateChunkInput(data: unknown): z.SafeParseReturnType<{
    text: string;
    file_id: number;
    end_line: number;
    start_line: number;
    embedding?: string | undefined;
}, {
    text: string;
    file_id: number;
    end_line: number;
    start_line: number;
    embedding?: string | undefined;
}>;
export declare function isFileInput(value: unknown): value is FileInput;
export declare function isSymbolInput(value: unknown): value is SymbolInput;
export declare function isChunkInput(value: unknown): value is ChunkInput;
/**
 * Validate an array of file inputs
 * Returns array of validated inputs and array of errors
 *
 * @param data - Array of unknown data to validate
 * @returns Object with validated inputs and errors
 */
export declare function validateFileInputBatch(data: unknown[]): {
    validated: FileInput[];
    errors: Array<{
        index: number;
        error: z.ZodError;
    }>;
};
/**
 * Validate an array of symbol inputs
 * Returns array of validated inputs and array of errors
 *
 * @param data - Array of unknown data to validate
 * @returns Object with validated inputs and errors
 */
export declare function validateSymbolInputBatch(data: unknown[]): {
    validated: SymbolInput[];
    errors: Array<{
        index: number;
        error: z.ZodError;
    }>;
};
/**
 * Validate an array of chunk inputs
 * Returns array of validated inputs and array of errors
 *
 * @param data - Array of unknown data to validate
 * @returns Object with validated inputs and errors
 */
export declare function validateChunkInputBatch(data: unknown[]): {
    validated: ChunkInput[];
    errors: Array<{
        index: number;
        error: z.ZodError;
    }>;
};
//# sourceMappingURL=database.schema.d.ts.map