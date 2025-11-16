/**
 * Config Command Utilities
 * Shared functions for config subcommands
 */

import { access } from 'fs/promises';
import { resolve } from 'path';
import { constants } from 'fs';
import { existsSync } from 'fs';

/**
 * Check if file exists
 */
export async function checkExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find config file in priority order
 *
 * Priority:
 *   1. --config CLI arg
 *   2. AUTOMATOSX_CONFIG env var
 *   3. automatosx.config.yaml (project root)
 *   4. automatosx.config.json (project root)
 *   5. .automatosx/config.yaml (hidden dir)
 *   6. .automatosx/config.json (hidden dir)
 */
export function resolveConfigPath(cliArg?: string): string {
  // 1. CLI argument (highest priority)
  if (cliArg) {
    return resolve(cliArg);
  }

  // 2. Environment variable
  if (process.env.AUTOMATOSX_CONFIG) {
    return resolve(process.env.AUTOMATOSX_CONFIG);
  }

  // 3-6. Check in priority order
  const candidates = [
    resolve(process.cwd(), 'automatosx.config.yaml'),
    resolve(process.cwd(), 'automatosx.config.json'),
    resolve(process.cwd(), '.automatosx', 'config.yaml'),
    resolve(process.cwd(), '.automatosx', 'config.json')
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Default to YAML in project root (for error messages)
  return resolve(process.cwd(), 'automatosx.config.yaml');
}

/**
 * Get nested object value by dot notation
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Set nested object value by dot notation
 * Returns true if successful, false if path doesn't exist
 */
export function setNestedValue(obj: any, path: string, value: any): boolean {
  const keys = path.split('.');
  const lastKey = keys.pop();

  if (!lastKey) return false;

  const target = keys.reduce((current, key) => {
    if (current?.[key] === undefined) return undefined;
    return current[key];
  }, obj);

  if (target === undefined) return false;

  target[lastKey] = value;
  return true;
}
