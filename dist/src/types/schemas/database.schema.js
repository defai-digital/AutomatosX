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
import { SymbolKindSchema } from './parser.schema.js';
// ============================================================================
// File DAO Schemas
// ============================================================================
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
export const FileInputSchema = z.object({
    path: z.string().min(1, 'File path cannot be empty'),
    content: z.string().max(10_000_000, 'File content exceeds 10MB limit'),
    language: z.string().optional(),
});
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
export const FileUpdateSchema = z
    .object({
    content: z.string().max(10_000_000, 'File content exceeds 10MB limit').optional(),
    language: z.string().optional(),
})
    .refine((data) => data.content !== undefined || data.language !== undefined, {
    message: 'At least one field must be provided for update',
});
/**
 * File record from database (SELECT result)
 *
 * Includes generated fields: id, hash, size, timestamps
 */
export const FileRecordSchema = z.object({
    id: z.number().int().positive(),
    path: z.string(),
    content: z.string(),
    hash: z.string(),
    size: z.number().int().nonnegative(),
    language: z.string().nullable(),
    indexed_at: z.string(), // ISO timestamp
    updated_at: z.string(), // ISO timestamp
});
// ============================================================================
// Symbol DAO Schemas
// ============================================================================
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
export const SymbolInputSchema = z
    .object({
    file_id: z.number().int().positive('file_id must be a positive integer'),
    name: z.string().min(1, 'Symbol name cannot be empty'),
    kind: SymbolKindSchema,
    line: z.number().int().positive('Line number must be positive (1-indexed)'),
    column: z.number().int().nonnegative('Column number must be non-negative (0-indexed)'),
    end_line: z.number().int().positive().optional(),
    end_column: z.number().int().nonnegative().optional(),
})
    .refine((data) => {
    // Validation: end_line must be >= line if provided
    if (data.end_line !== undefined) {
        return data.end_line >= data.line;
    }
    return true;
}, {
    message: 'end_line must be greater than or equal to line',
    path: ['end_line'],
})
    .refine((data) => {
    // Validation: if end_line === line, then end_column must be > column
    if (data.end_line === data.line && data.end_column !== undefined) {
        return data.end_column > data.column;
    }
    return true;
}, {
    message: 'end_column must be greater than column when on the same line',
    path: ['end_column'],
});
/**
 * Symbol record from database (SELECT result)
 *
 * Includes generated id field
 */
export const SymbolRecordSchema = z.object({
    id: z.number().int().positive(),
    file_id: z.number().int().positive(),
    name: z.string(),
    kind: z.string(),
    line: z.number().int(),
    column: z.number().int(),
    end_line: z.number().int().nullable(),
    end_column: z.number().int().nullable(),
});
// ============================================================================
// Chunk DAO Schemas
// ============================================================================
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
export const ChunkInputSchema = z
    .object({
    file_id: z.number().int().positive('file_id must be a positive integer'),
    text: z.string().min(1, 'Chunk text cannot be empty'),
    start_line: z.number().int().positive('start_line must be positive'),
    end_line: z.number().int().positive('end_line must be positive'),
    embedding: z.string().optional(), // JSON blob
})
    .refine((data) => {
    // Validation: end_line must be >= start_line
    return data.end_line >= data.start_line;
}, {
    message: 'end_line must be greater than or equal to start_line',
    path: ['end_line'],
});
/**
 * Chunk record from database (SELECT result)
 *
 * Includes generated id field
 */
export const ChunkRecordSchema = z.object({
    id: z.number().int().positive(),
    file_id: z.number().int().positive(),
    text: z.string(),
    start_line: z.number().int(),
    end_line: z.number().int(),
    embedding: z.string().nullable(), // JSON blob
});
// ============================================================================
// Call DAO Schemas
// ============================================================================
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
export const CallInputSchema = z.object({
    file_id: z.number().int().positive('file_id must be a positive integer'),
    caller: z.string().min(1, 'Caller name cannot be empty'),
    callee: z.string().min(1, 'Callee name cannot be empty'),
    line: z.number().int().positive('Line number must be positive'),
    column: z.number().int().nonnegative('Column number must be non-negative'),
});
/**
 * Call record from database (SELECT result)
 *
 * Includes generated id field
 */
export const CallRecordSchema = z.object({
    id: z.number().int().positive(),
    file_id: z.number().int().positive(),
    caller: z.string(),
    callee: z.string(),
    line: z.number().int(),
    column: z.number().int(),
});
// ============================================================================
// Import DAO Schemas
// ============================================================================
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
export const ImportInputSchema = z.object({
    file_id: z.number().int().positive('file_id must be a positive integer'),
    imported_name: z.string().min(1, 'Imported name cannot be empty'),
    imported_from: z.string().min(1, 'Import source cannot be empty'),
    line: z.number().int().positive('Line number must be positive'),
});
/**
 * Import record from database (SELECT result)
 *
 * Includes generated id field
 */
export const ImportRecordSchema = z.object({
    id: z.number().int().positive(),
    file_id: z.number().int().positive(),
    imported_name: z.string(),
    imported_from: z.string(),
    line: z.number().int(),
});
// ============================================================================
// Validation Helper Functions
// ============================================================================
// File DAO Helpers
export function validateFileInput(data) {
    return FileInputSchema.parse(data);
}
export function validateFileUpdate(data) {
    return FileUpdateSchema.parse(data);
}
export function validateFileRecord(data) {
    return FileRecordSchema.parse(data);
}
// Symbol DAO Helpers
export function validateSymbolInput(data) {
    return SymbolInputSchema.parse(data);
}
export function validateSymbolRecord(data) {
    return SymbolRecordSchema.parse(data);
}
// Chunk DAO Helpers
export function validateChunkInput(data) {
    return ChunkInputSchema.parse(data);
}
export function validateChunkRecord(data) {
    return ChunkRecordSchema.parse(data);
}
// Call DAO Helpers
export function validateCallInput(data) {
    return CallInputSchema.parse(data);
}
export function validateCallRecord(data) {
    return CallRecordSchema.parse(data);
}
// Import DAO Helpers
export function validateImportInput(data) {
    return ImportInputSchema.parse(data);
}
export function validateImportRecord(data) {
    return ImportRecordSchema.parse(data);
}
// ============================================================================
// Safe Validation Functions (Don't Throw)
// ============================================================================
export function safeValidateFileInput(data) {
    return FileInputSchema.safeParse(data);
}
export function safeValidateSymbolInput(data) {
    return SymbolInputSchema.safeParse(data);
}
export function safeValidateChunkInput(data) {
    return ChunkInputSchema.safeParse(data);
}
// ============================================================================
// Type Guards
// ============================================================================
export function isFileInput(value) {
    return FileInputSchema.safeParse(value).success;
}
export function isSymbolInput(value) {
    return SymbolInputSchema.safeParse(value).success;
}
export function isChunkInput(value) {
    return ChunkInputSchema.safeParse(value).success;
}
// ============================================================================
// Batch Validation Helpers
// ============================================================================
/**
 * Validate an array of file inputs
 * Returns array of validated inputs and array of errors
 *
 * @param data - Array of unknown data to validate
 * @returns Object with validated inputs and errors
 */
export function validateFileInputBatch(data) {
    const validated = [];
    const errors = [];
    data.forEach((item, index) => {
        const result = safeValidateFileInput(item);
        if (result.success) {
            validated.push(result.data);
        }
        else {
            errors.push({ index, error: result.error });
        }
    });
    return { validated, errors };
}
/**
 * Validate an array of symbol inputs
 * Returns array of validated inputs and array of errors
 *
 * @param data - Array of unknown data to validate
 * @returns Object with validated inputs and errors
 */
export function validateSymbolInputBatch(data) {
    const validated = [];
    const errors = [];
    data.forEach((item, index) => {
        const result = safeValidateSymbolInput(item);
        if (result.success) {
            validated.push(result.data);
        }
        else {
            errors.push({ index, error: result.error });
        }
    });
    return { validated, errors };
}
/**
 * Validate an array of chunk inputs
 * Returns array of validated inputs and array of errors
 *
 * @param data - Array of unknown data to validate
 * @returns Object with validated inputs and errors
 */
export function validateChunkInputBatch(data) {
    const validated = [];
    const errors = [];
    data.forEach((item, index) => {
        const result = safeValidateChunkInput(item);
        if (result.success) {
            validated.push(result.data);
        }
        else {
            errors.push({ index, error: result.error });
        }
    });
    return { validated, errors };
}
//# sourceMappingURL=database.schema.js.map