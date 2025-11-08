/**
 * Create HMAC-SHA256 verifier for signature validation
 */
export declare function createHmacSha256Verifier(): (data: string, secretKey: string, expectedSignature: string) => boolean;
/**
 * Generate HMAC-SHA256 signature
 */
export declare function generateHmacSha256(data: string, secretKey: string): string;
/**
 * Create SHA-256 checksum verifier
 */
export declare function createSha256ChecksumVerifier(): (actualChecksum: string, expectedChecksum: string) => boolean;
/**
 * Generate SHA-256 checksum
 */
export declare function generateSha256Checksum(data: string): string;
/**
 * Generate UUID v4
 */
export declare function generateUuid(): string;
/**
 * Create deterministic UUID generator for testing
 */
export declare function createDeterministicUuidGenerator(prefix?: string): () => string;
//# sourceMappingURL=securityTestUtils.d.ts.map