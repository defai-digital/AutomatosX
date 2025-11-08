import { createHmac, createHash } from 'crypto';
// Sprint 1 Day 4-5: Security Test Utilities
// Provides HMAC-SHA256, SHA-256, and UUID helpers for security tests
/**
 * Create HMAC-SHA256 verifier for signature validation
 */
export function createHmacSha256Verifier() {
    return (data, secretKey, expectedSignature) => {
        const hmac = createHmac('sha256', secretKey);
        hmac.update(data);
        const signature = hmac.digest('hex');
        return signature === expectedSignature;
    };
}
/**
 * Generate HMAC-SHA256 signature
 */
export function generateHmacSha256(data, secretKey) {
    const hmac = createHmac('sha256', secretKey);
    hmac.update(data);
    return hmac.digest('hex');
}
/**
 * Create SHA-256 checksum verifier
 */
export function createSha256ChecksumVerifier() {
    return (actualChecksum, expectedChecksum) => {
        return actualChecksum === expectedChecksum;
    };
}
/**
 * Generate SHA-256 checksum
 */
export function generateSha256Checksum(data) {
    const hash = createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
}
/**
 * Generate UUID v4
 */
export function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
/**
 * Create deterministic UUID generator for testing
 */
export function createDeterministicUuidGenerator(prefix = 'test') {
    let counter = 0;
    return () => {
        counter++;
        return `${prefix}-${counter.toString().padStart(8, '0')}-4xxx-yxxx-xxxxxxxxxxxx`;
    };
}
//# sourceMappingURL=securityTestUtils.js.map