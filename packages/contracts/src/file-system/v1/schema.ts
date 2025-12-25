/**
 * File System Contracts v1
 *
 * Defines schemas for file and directory operations with security invariants.
 * Used by scaffold tools to write generated code to disk.
 *
 * @module @defai.digital/contracts/file-system/v1
 */

import { z } from 'zod';

// ============================================================================
// Path Validation
// ============================================================================

/**
 * File path schema with security validation
 *
 * Invariants:
 * - INV-FS-001: No path traversal allowed
 */
export const FilePathSchema = z
  .string()
  .min(1, 'Path cannot be empty')
  .max(1000, 'Path too long')
  .refine(
    (path) => !path.includes('..'),
    'Path traversal (..) not allowed'
  )
  .refine(
    (path) => !path.includes('\0'),
    'Null bytes not allowed in path'
  );

export type FilePath = z.infer<typeof FilePathSchema>;

// ============================================================================
// File Write Operations
// ============================================================================

/**
 * File encoding options
 */
export const FileEncodingSchema = z.enum(['utf-8', 'ascii', 'base64', 'binary']);

export type FileEncoding = z.infer<typeof FileEncodingSchema>;

/**
 * Request to write a file
 *
 * Invariants:
 * - INV-FS-002: No silent overwrites (requires explicit flag)
 * - INV-FS-004: UTF-8 default encoding
 */
export const FileWriteRequestSchema = z.object({
  /** Relative path from workspace root */
  path: FilePathSchema,

  /** File content to write */
  content: z.string(),

  /** Create parent directories if they don't exist */
  createDirectories: z.boolean().default(true),

  /** Allow overwriting existing files */
  overwrite: z.boolean().default(false),

  /** File encoding */
  encoding: FileEncodingSchema.default('utf-8'),

  /** Optional backup before overwrite */
  backup: z.boolean().default(false),
});

export type FileWriteRequest = z.infer<typeof FileWriteRequestSchema>;

/**
 * Result of file write operation
 */
export const FileWriteResultSchema = z.object({
  /** Whether the operation succeeded */
  success: z.boolean(),

  /** Path that was written */
  path: z.string(),

  /** Number of bytes written */
  bytesWritten: z.number().int().min(0),

  /** Whether a new file was created */
  created: z.boolean(),

  /** Whether an existing file was overwritten */
  overwritten: z.boolean(),

  /** Backup path if backup was created */
  backupPath: z.string().optional(),

  /** Error details if operation failed */
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type FileWriteResult = z.infer<typeof FileWriteResultSchema>;

// ============================================================================
// Directory Operations
// ============================================================================

/**
 * Request to create a directory
 */
export const DirectoryCreateRequestSchema = z.object({
  /** Relative path from workspace root */
  path: FilePathSchema,

  /** Create parent directories if they don't exist */
  recursive: z.boolean().default(true),
});

export type DirectoryCreateRequest = z.infer<typeof DirectoryCreateRequestSchema>;

/**
 * Result of directory creation
 */
export const DirectoryCreateResultSchema = z.object({
  /** Whether the operation succeeded */
  success: z.boolean(),

  /** Path that was created */
  path: z.string(),

  /** Whether a new directory was created */
  created: z.boolean(),

  /** Whether the directory already existed */
  existed: z.boolean(),

  /** Error details if operation failed */
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type DirectoryCreateResult = z.infer<typeof DirectoryCreateResultSchema>;

// ============================================================================
// File Read Operations (for validation/preview)
// ============================================================================

/**
 * Request to check if a file exists
 */
export const FileExistsRequestSchema = z.object({
  /** Relative path from workspace root */
  path: FilePathSchema,
});

export type FileExistsRequest = z.infer<typeof FileExistsRequestSchema>;

/**
 * Result of file existence check
 */
export const FileExistsResultSchema = z.object({
  /** Path that was checked */
  path: z.string(),

  /** Whether the file exists */
  exists: z.boolean(),

  /** Whether it's a file (vs directory) */
  isFile: z.boolean().optional(),

  /** Whether it's a directory */
  isDirectory: z.boolean().optional(),

  /** File size in bytes (if exists and is file) */
  size: z.number().int().min(0).optional(),
});

export type FileExistsResult = z.infer<typeof FileExistsResultSchema>;

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Single file operation in a batch
 */
export const BatchFileOperationSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('write'),
    path: FilePathSchema,
    content: z.string(),
    overwrite: z.boolean().default(false),
  }),
  z.object({
    operation: z.literal('mkdir'),
    path: FilePathSchema,
    recursive: z.boolean().default(true),
  }),
]);

export type BatchFileOperation = z.infer<typeof BatchFileOperationSchema>;

/**
 * Request for batch file operations
 */
export const BatchOperationRequestSchema = z.object({
  /** List of operations to perform */
  operations: z.array(BatchFileOperationSchema).min(1).max(100),

  /** Stop on first error */
  stopOnError: z.boolean().default(true),

  /** Dry run - validate without executing */
  dryRun: z.boolean().default(false),
});

export type BatchOperationRequest = z.infer<typeof BatchOperationRequestSchema>;

/**
 * Result of a single operation in a batch
 */
export const BatchOperationResultItemSchema = z.object({
  /** Operation index in the batch */
  index: z.number().int().min(0),

  /** Path affected */
  path: z.string(),

  /** Whether operation succeeded */
  success: z.boolean(),

  /** Operation type */
  operation: z.enum(['write', 'mkdir']),

  /** Error if failed */
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type BatchOperationResultItem = z.infer<typeof BatchOperationResultItemSchema>;

/**
 * Result of batch operations
 */
export const BatchOperationResultSchema = z.object({
  /** Overall success */
  success: z.boolean(),

  /** Total operations attempted */
  total: z.number().int().min(0),

  /** Successful operations */
  succeeded: z.number().int().min(0),

  /** Failed operations */
  failed: z.number().int().min(0),

  /** Individual results */
  results: z.array(BatchOperationResultItemSchema),

  /** Whether this was a dry run */
  dryRun: z.boolean(),
});

export type BatchOperationResult = z.infer<typeof BatchOperationResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * File system error codes
 */
export const FileSystemErrorCode = {
  /** Path contains traversal attempt */
  PATH_TRAVERSAL: 'PATH_TRAVERSAL',

  /** File already exists (and overwrite=false) */
  FILE_EXISTS: 'FILE_EXISTS',

  /** Permission denied */
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  /** Invalid path format */
  INVALID_PATH: 'INVALID_PATH',

  /** Write operation failed */
  WRITE_FAILED: 'WRITE_FAILED',

  /** Directory creation failed */
  MKDIR_FAILED: 'MKDIR_FAILED',

  /** Path is outside workspace */
  OUTSIDE_WORKSPACE: 'OUTSIDE_WORKSPACE',

  /** Path is a symlink (not allowed) */
  SYMLINK_NOT_ALLOWED: 'SYMLINK_NOT_ALLOWED',

  /** Operation would affect too many files */
  BATCH_LIMIT_EXCEEDED: 'BATCH_LIMIT_EXCEEDED',
} as const;

export type FileSystemErrorCode = (typeof FileSystemErrorCode)[keyof typeof FileSystemErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

export function validateFileWriteRequest(data: unknown): FileWriteRequest {
  return FileWriteRequestSchema.parse(data);
}

export function validateDirectoryCreateRequest(data: unknown): DirectoryCreateRequest {
  return DirectoryCreateRequestSchema.parse(data);
}

export function validateBatchOperationRequest(data: unknown): BatchOperationRequest {
  return BatchOperationRequestSchema.parse(data);
}

/**
 * Check if a path is safe (no traversal, within workspace)
 */
export function isPathSafe(filePath: string): boolean {
  try {
    FilePathSchema.parse(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// MCP Tool Input/Output Schemas
// ============================================================================

/**
 * file_write tool input schema
 */
export const FileWriteInputSchema = FileWriteRequestSchema;

/**
 * file_write tool output schema
 */
export const FileWriteOutputSchema = FileWriteResultSchema;

/**
 * directory_create tool input schema
 */
export const DirectoryCreateInputSchema = DirectoryCreateRequestSchema;

/**
 * directory_create tool output schema
 */
export const DirectoryCreateOutputSchema = DirectoryCreateResultSchema;

/**
 * file_exists tool input schema
 */
export const FileExistsInputSchema = FileExistsRequestSchema;

/**
 * file_exists tool output schema
 */
export const FileExistsOutputSchema = FileExistsResultSchema;
