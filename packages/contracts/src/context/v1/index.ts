/**
 * Context Contracts v1
 */

export {
  // Constants
  MAX_CONTEXT_FILE_SIZE,
  MAX_CONTEXT_TOTAL_SIZE,
  CONTEXT_DIRECTORY,
  // Schemas
  ContextFileSchema,
  ProjectContextSchema,
  ContextLoaderConfigSchema,
  ContextLoadResultSchema,
  // Error codes
  ContextErrorCode,
  // Validation functions
  validateContextFile,
  safeValidateContextFile,
  validateProjectContext,
  validateContextLoaderConfig,
  // Types
  type ContextFile,
  type ProjectContext,
  type ContextLoaderConfig,
  type ContextLoadResult,
} from './schema.js';
