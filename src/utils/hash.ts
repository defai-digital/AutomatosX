/**
 * hash.ts
 *
 * File hashing utilities for AutomatosX v2
 * Provides SHA-256 content hashing for file integrity
 */

import crypto from 'crypto';

/**
 * Generate SHA-256 hash from string content
 *
 * @param content - String content to hash
 * @returns Hexadecimal hash string
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Generate SHA-256 hash from buffer
 *
 * @param buffer - Buffer to hash
 * @returns Hexadecimal hash string
 */
export function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Verify content matches expected hash
 *
 * @param content - Content to verify
 * @param expectedHash - Expected hash value
 * @returns True if hash matches
 */
export function verifyHash(content: string, expectedHash: string): boolean {
  const actualHash = hashContent(content);
  return actualHash === expectedHash;
}

/**
 * Generate short hash (first 8 characters)
 * Useful for display purposes
 *
 * @param content - Content to hash
 * @returns Short hash string (8 chars)
 */
export function shortHash(content: string): string {
  return hashContent(content).substring(0, 8);
}
