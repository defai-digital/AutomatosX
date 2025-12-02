/**
 * MCP Tool: memory_export
 *
 * Exports all memory entries to a JSON file.
 *
 * Security: Restricts file operations to .automatosx/memory/exports directory
 * to prevent sandbox escape and arbitrary file overwrites.
 */

import type {
  ToolHandler,
  MemoryExportInput,
  MemoryExportOutput
} from '../types.js';
import type { IMemoryManager } from '../../types/memory.js';
import type { PathResolver } from '../../core/path-resolver.js';
import { logger } from '../../utils/logger.js';
import { resolve, basename } from 'path';
import { validatePathParameter } from '../utils/validation.js';

export interface MemoryExportDependencies {
  memoryManager: IMemoryManager;
  pathResolver: PathResolver;
}

/**
 * Safely resolve export path within designated exports directory
 * @throws Error if path contains traversal (..) or escapes boundary
 */
function resolveExportPath(pathResolver: PathResolver, userPath: string): string {
  // Enhanced validation using comprehensive security checks
  const exportsDir = pathResolver.resolveProjectPath('.automatosx/memory/exports');
  validatePathParameter(userPath, 'export path', exportsDir);

  // Extract filename only (ignore directory components)
  const filename = basename(userPath);

  // Resolve within .automatosx/memory/exports directory
  const absolutePath = resolve(exportsDir, filename);

  // Double-check with PathResolver validation
  if (!pathResolver.validatePath(absolutePath, exportsDir)) {
    throw new Error('Export path must be within .automatosx/memory/exports directory');
  }

  return absolutePath;
}

export function createMemoryExportHandler(
  deps: MemoryExportDependencies
): ToolHandler<MemoryExportInput, MemoryExportOutput> {
  return async (input: MemoryExportInput): Promise<MemoryExportOutput> => {
    logger.info('[MCP] memory_export called', { input });

    try {
      const { path } = input;

      // Safely resolve path with boundary checks
      const absolutePath = resolveExportPath(deps.pathResolver, path);

      // Export memories to JSON file
      const exported = await deps.memoryManager.exportToJSON(absolutePath);

      const result: MemoryExportOutput = {
        success: true,
        path: absolutePath,
        entries: exported.entriesExported
      };

      logger.info('[MCP] memory_export completed', {
        path: absolutePath,
        entries: exported.entriesExported
      });

      return result;
    } catch (error) {
      logger.error('[MCP] memory_export failed', { error });
      throw new Error(`Memory export failed: ${(error as Error).message}`);
    }
  };
}
