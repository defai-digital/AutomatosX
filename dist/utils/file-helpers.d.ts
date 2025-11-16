/**
 * File system helper utilities
 * Shared utilities for common file operations across agents and managers
 */
/**
 * Ensure a directory exists, creating it if necessary
 */
export declare function ensureDir(dirPath: string): Promise<void>;
/**
 * Resolve file path with multiple extensions
 * Tries each extension in order and returns the first that exists
 */
export declare function resolveFileWithExtensions(dir: string, baseName: string, extensions: string[]): string;
/**
 * List files in directory with specific extensions
 */
export declare function listFilesWithExtensions(dir: string, extensions: string[]): Promise<string[]>;
/**
 * Parse JSON with Date field conversion
 * Converts ISO date strings to Date objects for specified fields
 */
export declare function parseJsonWithDates<T>(json: string, dateFields: readonly string[]): T;
//# sourceMappingURL=file-helpers.d.ts.map