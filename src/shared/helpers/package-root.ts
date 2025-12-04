/**
 * Package Root Helper
 *
 * Provides utilities for finding the package root directory.
 * Works in both development mode and bundled/production mode.
 *
 * @module shared/helpers/package-root
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Cache the result since package root doesn't change during runtime
let cachedPackageRoot: string | null = null;

/**
 * Get the package root directory by traversing up from the current file
 * until we find a package.json file.
 *
 * This is more reliable than string matching and works with any directory structure,
 * including development mode and bundled distributions.
 *
 * @param startDir - Starting directory to search from (defaults to this module's directory)
 * @returns The package root directory path
 */
export function getPackageRoot(startDir?: string): string {
  // Return cached value if available and no custom startDir provided
  if (cachedPackageRoot && !startDir) {
    return cachedPackageRoot;
  }

  // Use this module's directory as starting point if not specified
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  let current = startDir || __dirname;
  const root = '/';

  while (current !== root) {
    // Check if package.json exists at this level
    if (existsSync(join(current, 'package.json'))) {
      // Cache the result if using default startDir
      if (!startDir) {
        cachedPackageRoot = current;
      }
      return current;
    }
    current = dirname(current);
  }

  // Fallback: return the starting directory (may not work correctly)
  return startDir || __dirname;
}

/**
 * Get a path relative to the package root
 *
 * @param relativePath - Path relative to package root
 * @returns Absolute path
 */
export function fromPackageRoot(...relativePath: string[]): string {
  return join(getPackageRoot(), ...relativePath);
}

/**
 * Clear the cached package root (useful for testing)
 */
export function clearPackageRootCache(): void {
  cachedPackageRoot = null;
}
