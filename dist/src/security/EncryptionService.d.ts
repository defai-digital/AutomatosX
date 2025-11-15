/**
 * EncryptionService.ts
 *
 * AES-256-GCM encryption/decryption service for sensitive data
 * Phase 5 Week 3: Security
 */
import { EventEmitter } from 'events';
/**
 * Configuration for encryption service
 */
export interface EncryptionConfig {
    algorithm: string;
    keyDerivation: {
        method: 'scrypt' | 'pbkdf2';
        salt: string;
        keyLength: number;
        iterations?: number;
        cost?: number;
    };
}
/**
 * Encrypted data format
 */
export interface EncryptedData {
    iv: string;
    authTag: string;
    ciphertext: string;
    algorithm: string;
}
/**
 * EncryptionService - Handles encryption/decryption of sensitive data
 *
 * Features:
 * - AES-256-GCM authenticated encryption
 * - Key derivation from master key using scrypt
 * - Automatic IV generation
 * - Authentication tag for tamper detection
 */
export declare class EncryptionService extends EventEmitter {
    private key;
    private algorithm;
    private config;
    /**
     * Create encryption service
     * @param masterKey Master encryption key (from environment)
     * @param config Encryption configuration
     */
    constructor(masterKey: string, config?: Partial<EncryptionConfig>);
    /**
     * Derive encryption key from master key
     */
    private deriveKey;
    /**
     * Encrypt plaintext
     * @param plaintext Data to encrypt
     * @returns Encrypted data with IV and auth tag
     */
    encrypt(plaintext: string): string;
    /**
     * Decrypt ciphertext
     * @param encryptedString Base64-encoded encrypted data
     * @returns Decrypted plaintext
     */
    decrypt(encryptedString: string): string;
    /**
     * Encrypt object (JSON serializable)
     * @param obj Object to encrypt
     * @returns Encrypted string
     */
    encryptObject<T>(obj: T): string;
    /**
     * Decrypt object
     * @param encryptedString Encrypted string
     * @returns Decrypted object
     */
    decryptObject<T>(encryptedString: string): T;
    /**
     * Generate secure random token
     * @param bytes Number of random bytes (default 32)
     * @returns Hex-encoded token
     */
    generateToken(bytes?: number): string;
    /**
     * Hash data (one-way)
     * @param data Data to hash
     * @param algorithm Hash algorithm (default sha256)
     * @returns Hex-encoded hash
     */
    hash(data: string, algorithm?: string): string;
    /**
     * Hash password with salt
     * @param password Password to hash
     * @param salt Optional salt (generated if not provided)
     * @returns Hash and salt
     */
    hashPassword(password: string, salt?: string): {
        hash: string;
        salt: string;
    };
    /**
     * Verify password against hash
     * @param password Password to verify
     * @param hash Stored hash
     * @param salt Stored salt
     * @returns True if password matches
     */
    verifyPassword(password: string, hash: string, salt: string): boolean;
    /**
     * Rotate encryption key
     * @param newMasterKey New master key
     * @returns New encryption service instance
     */
    rotateKey(newMasterKey: string): EncryptionService;
    /**
     * Re-encrypt data with new key
     * @param encryptedData Data encrypted with old key
     * @param newService New encryption service with new key
     * @returns Data re-encrypted with new key
     */
    reencrypt(encryptedData: string, newService: EncryptionService): string;
}
export declare function getEncryptionService(): EncryptionService;
//# sourceMappingURL=EncryptionService.d.ts.map