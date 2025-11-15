/**
 * hash.ts
 *
 * File hashing utilities for AutomatosX v2
 * Provides SHA-256 content hashing for file integrity
 */
/**
 * Generate SHA-256 hash from string content
 *
 * @param content - String content to hash
 * @returns Hexadecimal hash string
 */
export declare function hashContent(content: string): string;
/**
 * Generate SHA-256 hash from buffer
 *
 * @param buffer - Buffer to hash
 * @returns Hexadecimal hash string
 */
export declare function hashBuffer(buffer: Buffer): string;
/**
 * Verify content matches expected hash
 *
 * @param content - Content to verify
 * @param expectedHash - Expected hash value
 * @returns True if hash matches
 */
export declare function verifyHash(content: string, expectedHash: string): boolean;
/**
 * Generate short hash (first 8 characters)
 * Useful for display purposes
 *
 * @param content - Content to hash
 * @returns Short hash string (8 chars)
 */
export declare function shortHash(content: string): string;
//# sourceMappingURL=hash.d.ts.map