/**
 * MCP Tool: memory_import
 *
 * Imports memory entries from a JSON file.
 *
 * Security: Restricts file operations to .automatosx/memory/exports directory
 * to prevent sandbox escape and arbitrary file reads.
 */

import type {
  ToolHandler,
  MemoryImportInput,
  MemoryImportOutput
} from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import type { PathResolver } from '../../core/path-resolver.js';
import { logger } from '../../utils/logger.js';
import { resolve, basename } from 'path';
import { validatePathParameter } from '../utils/validation.js';

export interface MemoryImportDependencies {
  memoryManager: IMemoryManager;
  pathResolver: PathResolver;
}

/**
 * Safely resolve import path within designated exports directory
 * @throws Error if path contains traversal (..) or escapes boundary
 */
function resolveImportPath(pathResolver: PathResolver, userPath: string): string {
  // Enhanced validation using comprehensive security checks
  const exportsDir = pathResolver.resolveProjectPath('.automatosx/memory/exports');
  validatePathParameter(userPath, 'import path', exportsDir);

  // Extract filename only (ignore directory components)
  const filename = basename(userPath);

  // Resolve within .automatosx/memory/exports directory
  const absolutePath = resolve(exportsDir, filename);

  // Double-check with PathResolver validation
  if (!pathResolver.validatePath(absolutePath, exportsDir)) {
    throw new Error('Import path must be within .automatosx/memory/exports directory');
  }

  return absolutePath;
}

export function createMemoryImportHandler(
  deps: MemoryImportDependencies
): ToolHandler<MemoryImportInput, MemoryImportOutput> {
  return async (input: MemoryImportInput): Promise<MemoryImportOutput> => {
    logger.info('[MCP] memory_import called', { input });

    try {
      const { path } = input;

      // Safely resolve path with boundary checks
      const absolutePath = resolveImportPath(deps.pathResolver, path);

      // Import memories from JSON file
      const imported = await deps.memoryManager.importFromJSON(absolutePath);

      const result: MemoryImportOutput = {
        success: true,
        imported: imported.entriesImported,
        skipped: imported.entriesSkipped
      };

      logger.info('[MCP] memory_import completed', {
        path: absolutePath,
        imported: imported.entriesImported,
        skipped: imported.entriesSkipped
      });

      return result;
    } catch (error) {
      logger.error('[MCP] memory_import failed', { error });
      throw new Error(`Memory import failed: ${(error as Error).message}`);
    }
  };
}
