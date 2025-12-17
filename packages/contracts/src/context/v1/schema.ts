/**
 * Context Domain Contracts v1
 *
 * Zod schemas for project context - project-specific conventions,
 * architecture, and patterns that are injected into agent prompts.
 *
 * Invariants:
 * - INV-CTX-001: Individual context files must not exceed MAX_FILE_SIZE
 * - INV-CTX-002: Total context size must not exceed MAX_TOTAL_SIZE
 * - INV-CTX-003: Context files must be valid UTF-8 markdown
 */

import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum size for a single context file (50KB)
 */
export const MAX_CONTEXT_FILE_SIZE = 50 * 1024;

/**
 * Maximum total size for all context files (200KB)
 */
export const MAX_CONTEXT_TOTAL_SIZE = 200 * 1024;

/**
 * Default context directory name
 */
export const CONTEXT_DIRECTORY = 'context';

// ============================================================================
// Context File Schema
// ============================================================================

/**
 * A single context file
 */
export const ContextFileSchema = z.object({
  // File identity
  filename: z.string().min(1).max(255),
  relativePath: z.string().max(500),

  // Content
  content: z.string().max(MAX_CONTEXT_FILE_SIZE),

  // Metadata
  size: z.number().int().min(0).max(MAX_CONTEXT_FILE_SIZE),
  loadedAt: z.string().datetime(),
});

export type ContextFile = z.infer<typeof ContextFileSchema>;

// ============================================================================
// Project Context Schema
// ============================================================================

/**
 * Aggregated project context from all context files
 */
export const ProjectContextSchema = z.object({
  // Source information
  projectPath: z.string(),
  contextPath: z.string(),

  // Loaded files
  files: z.array(ContextFileSchema),

  // Aggregated stats
  totalSize: z.number().int().min(0).max(MAX_CONTEXT_TOTAL_SIZE),
  fileCount: z.number().int().min(0),

  // Timestamps
  loadedAt: z.string().datetime(),

  // Computed content (for injection into prompts)
  combinedContent: z.string().optional(),
});

export type ProjectContext = z.infer<typeof ProjectContextSchema>;

// ============================================================================
// Context Loader Config
// ============================================================================

/**
 * Configuration for the context loader
 */
export const ContextLoaderConfigSchema = z.object({
  // Size limits
  maxFileSize: z.number().int().min(1024).default(MAX_CONTEXT_FILE_SIZE),
  maxTotalSize: z.number().int().min(1024).default(MAX_CONTEXT_TOTAL_SIZE),

  // File patterns
  fileExtensions: z.array(z.string()).default(['.md', '.txt']),
  excludePatterns: z.array(z.string()).default([]),

  // Behavior
  recursive: z.boolean().default(false),
  sortBy: z.enum(['name', 'size', 'modified']).default('name'),
});

export type ContextLoaderConfig = z.infer<typeof ContextLoaderConfigSchema>;

// ============================================================================
// Context Load Result
// ============================================================================

/**
 * Result of loading project context
 */
export const ContextLoadResultSchema = z.object({
  success: z.boolean(),
  context: ProjectContextSchema.optional(),
  error: z.string().optional(),

  // Stats
  filesLoaded: z.number().int().min(0),
  filesSkipped: z.number().int().min(0),
  skippedReasons: z
    .array(
      z.object({
        filename: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
});

export type ContextLoadResult = z.infer<typeof ContextLoadResultSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Context error codes
 */
export const ContextErrorCode = {
  CONTEXT_DIR_NOT_FOUND: 'CONTEXT_DIR_NOT_FOUND',
  CONTEXT_FILE_TOO_LARGE: 'CONTEXT_FILE_TOO_LARGE',
  CONTEXT_TOTAL_SIZE_EXCEEDED: 'CONTEXT_TOTAL_SIZE_EXCEEDED',
  CONTEXT_FILE_READ_ERROR: 'CONTEXT_FILE_READ_ERROR',
  CONTEXT_INVALID_ENCODING: 'CONTEXT_INVALID_ENCODING',
} as const;

export type ContextErrorCode = (typeof ContextErrorCode)[keyof typeof ContextErrorCode];

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a context file
 */
export function validateContextFile(data: unknown): ContextFile {
  return ContextFileSchema.parse(data);
}

/**
 * Safely validates a context file
 */
export function safeValidateContextFile(
  data: unknown
): { success: true; data: ContextFile } | { success: false; error: z.ZodError } {
  const result = ContextFileSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Validates project context
 */
export function validateProjectContext(data: unknown): ProjectContext {
  return ProjectContextSchema.parse(data);
}

/**
 * Validates context loader config
 */
export function validateContextLoaderConfig(data: unknown): ContextLoaderConfig {
  return ContextLoaderConfigSchema.parse(data);
}
