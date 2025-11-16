/**
 * File system helper utilities
 * Shared utilities for common file operations across agents and managers
 */

import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Resolve file path with multiple extensions
 * Tries each extension in order and returns the first that exists
 */
export function resolveFileWithExtensions(
  dir: string,
  baseName: string,
  extensions: string[]
): string {
  if (extensions.length === 0) {
    throw new Error('extensions array cannot be empty');
  }

  for (const ext of extensions) {
    const filePath = join(dir, `${baseName}.${ext}`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  // Return path with first extension as fallback
  return join(dir, `${baseName}.${extensions[0]}`);
}

/**
 * List files in directory with specific extensions
 */
export async function listFilesWithExtensions(
  dir: string,
  extensions: string[]
): Promise<string[]> {
  if (!existsSync(dir)) {
    return [];
  }

  const files = await readdir(dir);
  // BUG FIX #25: Escape regex special characters to prevent ReDoS and incorrect matching
  // Extensions like 'ts*' or 'js+' would be treated as regex quantifiers without escaping
  const escapedExtensions = extensions.map(ext =>
    ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const extPattern = new RegExp(`\\.(${escapedExtensions.join('|')})$`);

  return files
    .filter(f => extPattern.test(f))
    .map(f => f.replace(extPattern, ''))
    .sort();
}

/**
 * Parse JSON with Date field conversion
 * Converts ISO date strings to Date objects for specified fields
 */
export function parseJsonWithDates<T>(
  json: string,
  dateFields: readonly string[]
): T {
  const obj = JSON.parse(json);

  function convertDates(item: unknown): void {
    if (!item || typeof item !== 'object') return;

    // Type guard: item is object at this point
    const record = item as Record<string, unknown>;

    for (const field of dateFields) {
      if (field in record && typeof record[field] === 'string') {
        record[field] = new Date(record[field] as string);
      }
    }

    // BUG FIX #14: Recursively convert nested objects/arrays
    // Must use early return to prevent double-processing of arrays
    if (Array.isArray(item)) {
      item.forEach(convertDates);
      return;  // Early return prevents double-processing
    }

    // Only process object values if not an array
    Object.values(record).forEach(value => {
      if (value !== null && typeof value === 'object') {
        convertDates(value);
      }
    });
  }

  convertDates(obj);
  return obj as T;
}
