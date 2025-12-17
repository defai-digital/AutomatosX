/**
 * @automatosx/context-domain
 *
 * Project context loading for AutomatosX.
 * Loads project-specific conventions, architecture, and patterns
 * from .automatosx/context/ for injection into agent prompts.
 */

// Types
export type {
  ContextFile,
  ProjectContext,
  ContextLoaderConfig,
  ContextLoadResult,
  IContextLoader,
  FileInfo,
} from './types.js';

// Loader
export {
  ContextLoader,
  createContextLoader,
  hasProjectContext,
  loadProjectContext,
} from './loader.js';

// Re-export contract constants
export {
  MAX_CONTEXT_FILE_SIZE,
  MAX_CONTEXT_TOTAL_SIZE,
  CONTEXT_DIRECTORY,
  ContextErrorCode,
} from '@automatosx/contracts';
