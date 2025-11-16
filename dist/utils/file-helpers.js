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
export async function ensureDir(dirPath) {
    if (!existsSync(dirPath)) {
        await mkdir(dirPath, { recursive: true });
    }
}
/**
 * Resolve file path with multiple extensions
 * Tries each extension in order and returns the first that exists
 */
export function resolveFileWithExtensions(dir, baseName, extensions) {
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
export async function listFilesWithExtensions(dir, extensions) {
    if (!existsSync(dir)) {
        return [];
    }
    const files = await readdir(dir);
    // BUG FIX #25: Escape regex special characters to prevent ReDoS and incorrect matching
    // Extensions like 'ts*' or 'js+' would be treated as regex quantifiers without escaping
    const escapedExtensions = extensions.map(ext => ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
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
export function parseJsonWithDates(json, dateFields) {
    const obj = JSON.parse(json);
    function convertDates(item) {
        if (!item || typeof item !== 'object')
            return;
        // Type guard: item is object at this point
        const record = item;
        for (const field of dateFields) {
            if (field in record && typeof record[field] === 'string') {
                record[field] = new Date(record[field]);
            }
        }
        // BUG FIX #14: Recursively convert nested objects/arrays
        // Must use early return to prevent double-processing of arrays
        if (Array.isArray(item)) {
            item.forEach(convertDates);
            return; // Early return prevents double-processing
        }
        // Only process object values if not an array
        Object.values(record).forEach(value => {
            if (value !== null && typeof value === 'object') {
                convertDates(value);
            }
        });
    }
    convertDates(obj);
    return obj;
}
//# sourceMappingURL=file-helpers.js.map