/**
 * Config Command Utilities
 * Shared functions for config subcommands
 */

import { access } from 'fs/promises';
import { resolve } from 'path';
import { constants } from 'fs';
import { existsSync } from 'fs';
import { AX_PATHS } from '../../../core/validation-limits.js';

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
 * Find config file in priority order (v9.2.0+)
 *
 * Priority:
 *   1. --config CLI arg
 *   2. AUTOMATOSX_CONFIG_PATH env var
 *   3. ax.config.yaml (project root) - NEW in v9.2.0
 *   4. ax.config.json (project root) - NEW in v9.2.0
 *   5. automatosx.config.yaml (project root) - DEPRECATED, removed in v10.0.0
 *   6. automatosx.config.json (project root) - DEPRECATED, removed in v10.0.0
 *   7. .automatosx/config.yaml (hidden dir)
 *   8. .automatosx/config.json (hidden dir)
 */
export function resolveConfigPath(cliArg?: string): string {
  // 1. CLI argument (highest priority)
  if (cliArg) {
    return resolve(cliArg);
  }

  // 2. Environment variable
  if (process.env.AUTOMATOSX_CONFIG_PATH) {
    return resolve(process.env.AUTOMATOSX_CONFIG_PATH);
  }

  // 3-8. Check in priority order (new names first, then deprecated names for backward compat)
  const candidates = [
    // NEW (v9.2.0+): Shorter config names
    resolve(process.cwd(), 'ax.config.yaml'),
    resolve(process.cwd(), 'ax.config.json'),
    // DEPRECATED: Old long names (backward compatibility, removed in v10.0.0)
    resolve(process.cwd(), 'automatosx.config.yaml'),
    resolve(process.cwd(), 'automatosx.config.json'),
    // Hidden directory configs
    resolve(process.cwd(), AX_PATHS.CONFIG_YAML),
    resolve(process.cwd(), AX_PATHS.CONFIG_JSON)
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Default to new YAML name in project root (for error messages)
  return resolve(process.cwd(), 'ax.config.yaml');
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
