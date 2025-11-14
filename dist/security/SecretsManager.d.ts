/**
 * SecretsManager.ts
 *
 * Secure storage and retrieval of secrets (API keys, credentials)
 * Phase 5 Week 3: Security
 */
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { EncryptionService } from './EncryptionService.js';
import { Secret } from '../types/security.types.js';
/**
 * SecretsManager - Secure storage for API keys and credentials
 *
 * Features:
 * - Encrypted storage in SQLite
 * - Per-tenant isolation
 * - Secret rotation tracking
 * - Audit logging for secret access
 */
export declare class SecretsManager extends EventEmitter {
    private db;
    private encryption;
    constructor(db?: Database.Database, encryption?: EncryptionService);
    /**
     * Store a secret
     * @param tenantId Tenant ID
     * @param key Secret key (e.g., 'claude_api_key')
     * @param value Secret value
     * @param options Additional options
     * @returns Secret ID
     */
    setSecret(tenantId: string, key: string, value: string, options?: {
        description?: string;
        createdBy?: string;
    }): Promise<string>;
    /**
     * Retrieve a secret
     * @param tenantId Tenant ID
     * @param key Secret key
     * @returns Decrypted secret value
     */
    getSecret(tenantId: string, key: string): Promise<string | null>;
    /**
     * List all secrets for a tenant (without values)
     * @param tenantId Tenant ID
     * @returns Array of secrets (without decrypted values)
     */
    listSecrets(tenantId: string): Promise<Omit<Secret, 'encryptedValue'>[]>;
    /**
     * Delete a secret
     * @param tenantId Tenant ID
     * @param key Secret key
     * @returns True if deleted
     */
    deleteSecret(tenantId: string, key: string): Promise<boolean>;
    /**
     * Rotate a secret (update with new value)
     * @param tenantId Tenant ID
     * @param key Secret key
     * @param newValue New secret value
     * @returns True if rotated
     */
    rotateSecret(tenantId: string, key: string, newValue: string): Promise<boolean>;
    /**
     * Bulk get secrets for a tenant
     * @param tenantId Tenant ID
     * @param keys Array of secret keys
     * @returns Map of key -> value
     */
    getSecrets(tenantId: string, keys: string[]): Promise<Map<string, string>>;
    /**
     * Check if a secret exists
     * @param tenantId Tenant ID
     * @param key Secret key
     * @returns True if exists
     */
    hasSecret(tenantId: string, key: string): Promise<boolean>;
}
//# sourceMappingURL=SecretsManager.d.ts.map