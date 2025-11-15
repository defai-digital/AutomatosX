/**
 * EncryptionService.ts
 *
 * AES-256-GCM encryption/decryption service for sensitive data
 * Phase 5 Week 3: Security
 */
import crypto from 'crypto';
import { EventEmitter } from 'events';
/**
 * EncryptionService - Handles encryption/decryption of sensitive data
 *
 * Features:
 * - AES-256-GCM authenticated encryption
 * - Key derivation from master key using scrypt
 * - Automatic IV generation
 * - Authentication tag for tamper detection
 */
export class EncryptionService extends EventEmitter {
    key;
    algorithm;
    config;
    /**
     * Create encryption service
     * @param masterKey Master encryption key (from environment)
     * @param config Encryption configuration
     */
    constructor(masterKey, config) {
        super();
        this.config = {
            algorithm: 'aes-256-gcm',
            keyDerivation: {
                method: 'scrypt',
                salt: config?.keyDerivation?.salt || 'automatosx-v2-salt',
                keyLength: 32,
                cost: config?.keyDerivation?.cost || 16384,
            },
            ...config,
        };
        this.algorithm = this.config.algorithm;
        this.key = this.deriveKey(masterKey);
        this.emit('initialized', { algorithm: this.algorithm });
    }
    /**
     * Derive encryption key from master key
     */
    deriveKey(masterKey) {
        const { keyDerivation } = this.config;
        if (keyDerivation.method === 'scrypt') {
            return crypto.scryptSync(masterKey, keyDerivation.salt, keyDerivation.keyLength, { N: keyDerivation.cost || 16384 });
        }
        else {
            // PBKDF2
            return crypto.pbkdf2Sync(masterKey, keyDerivation.salt, keyDerivation.iterations || 100000, keyDerivation.keyLength, 'sha256');
        }
    }
    /**
     * Encrypt plaintext
     * @param plaintext Data to encrypt
     * @returns Encrypted data with IV and auth tag
     */
    encrypt(plaintext) {
        try {
            // Generate random IV
            const iv = crypto.randomBytes(16);
            // Create cipher
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            // Encrypt
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // Get authentication tag
            const authTag = cipher.getAuthTag();
            // Combine IV, auth tag, and ciphertext
            const encryptedData = {
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                ciphertext: encrypted,
                algorithm: this.algorithm,
            };
            // Return as base64-encoded JSON
            return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
        }
        catch (error) {
            this.emit('encryption_error', { error });
            throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Decrypt ciphertext
     * @param encryptedString Base64-encoded encrypted data
     * @returns Decrypted plaintext
     */
    decrypt(encryptedString) {
        try {
            // Decode base64 and parse JSON
            const encryptedData = JSON.parse(Buffer.from(encryptedString, 'base64').toString('utf8'));
            // Verify algorithm matches
            if (encryptedData.algorithm !== this.algorithm) {
                throw new Error(`Algorithm mismatch: expected ${this.algorithm}, got ${encryptedData.algorithm}`);
            }
            // Extract components
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const authTag = Buffer.from(encryptedData.authTag, 'hex');
            // Create decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);
            // Decrypt
            let decrypted = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            this.emit('decryption_error', { error });
            throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Encrypt object (JSON serializable)
     * @param obj Object to encrypt
     * @returns Encrypted string
     */
    encryptObject(obj) {
        const json = JSON.stringify(obj);
        return this.encrypt(json);
    }
    /**
     * Decrypt object
     * @param encryptedString Encrypted string
     * @returns Decrypted object
     */
    decryptObject(encryptedString) {
        const json = this.decrypt(encryptedString);
        return JSON.parse(json);
    }
    /**
     * Generate secure random token
     * @param bytes Number of random bytes (default 32)
     * @returns Hex-encoded token
     */
    generateToken(bytes = 32) {
        return crypto.randomBytes(bytes).toString('hex');
    }
    /**
     * Hash data (one-way)
     * @param data Data to hash
     * @param algorithm Hash algorithm (default sha256)
     * @returns Hex-encoded hash
     */
    hash(data, algorithm = 'sha256') {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }
    /**
     * Hash password with salt
     * @param password Password to hash
     * @param salt Optional salt (generated if not provided)
     * @returns Hash and salt
     */
    hashPassword(password, salt) {
        const actualSalt = salt || crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
        return { hash, salt: actualSalt };
    }
    /**
     * Verify password against hash
     * @param password Password to verify
     * @param hash Stored hash
     * @param salt Stored salt
     * @returns True if password matches
     */
    verifyPassword(password, hash, salt) {
        const { hash: computedHash } = this.hashPassword(password, salt);
        return computedHash === hash;
    }
    /**
     * Rotate encryption key
     * @param newMasterKey New master key
     * @returns New encryption service instance
     */
    rotateKey(newMasterKey) {
        this.emit('key_rotation_start');
        const newService = new EncryptionService(newMasterKey, this.config);
        this.emit('key_rotation_complete');
        return newService;
    }
    /**
     * Re-encrypt data with new key
     * @param encryptedData Data encrypted with old key
     * @param newService New encryption service with new key
     * @returns Data re-encrypted with new key
     */
    reencrypt(encryptedData, newService) {
        const plaintext = this.decrypt(encryptedData);
        return newService.encrypt(plaintext);
    }
}
/**
 * Get encryption service instance
 * Uses AUTOMATOSX_MASTER_KEY environment variable
 */
let encryptionServiceInstance = null;
export function getEncryptionService() {
    if (!encryptionServiceInstance) {
        const masterKey = process.env.AUTOMATOSX_MASTER_KEY || 'default-master-key-change-in-production';
        if (masterKey === 'default-master-key-change-in-production' && process.env.NODE_ENV === 'production') {
            throw new Error('AUTOMATOSX_MASTER_KEY environment variable must be set in production');
        }
        encryptionServiceInstance = new EncryptionService(masterKey);
    }
    return encryptionServiceInstance;
}
//# sourceMappingURL=EncryptionService.js.map