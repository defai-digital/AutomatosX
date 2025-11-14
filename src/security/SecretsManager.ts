/**
 * SecretsManager.ts
 *
 * Secure storage and retrieval of secrets (API keys, credentials)
 * Phase 5 Week 3: Security
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { EncryptionService } from './EncryptionService.js';
import { Secret, SecretValue } from '../types/security.types.js';
import { getDatabase } from '../database/connection.js';

/**
 * SecretsManager - Secure storage for API keys and credentials
 *
 * Features:
 * - Encrypted storage in SQLite
 * - Per-tenant isolation
 * - Secret rotation tracking
 * - Audit logging for secret access
 */
export class SecretsManager extends EventEmitter {
  private db: Database.Database;
  private encryption: EncryptionService;

  constructor(db?: Database.Database, encryption?: EncryptionService) {
    super();
    this.db = db || getDatabase();
    this.encryption = encryption || new EncryptionService(
      process.env.AUTOMATOSX_MASTER_KEY || 'default-master-key-change-in-production'
    );
  }

  /**
   * Store a secret
   * @param tenantId Tenant ID
   * @param key Secret key (e.g., 'claude_api_key')
   * @param value Secret value
   * @param options Additional options
   * @returns Secret ID
   */
  async setSecret(
    tenantId: string,
    key: string,
    value: string,
    options?: {
      description?: string;
      createdBy?: string;
    }
  ): Promise<string> {
    const id = randomUUID();
    const now = Date.now();

    // Encrypt value
    const encryptedValue = this.encryption.encrypt(value);

    try {
      // Check if secret already exists
      const existing = this.db.prepare(`
        SELECT id FROM secrets
        WHERE tenant_id = ? AND key = ?
      `).get(tenantId, key) as { id: string } | undefined;

      if (existing) {
        // Update existing secret
        this.db.prepare(`
          UPDATE secrets
          SET encrypted_value = ?,
              description = ?,
              updated_at = ?,
              rotated_at = ?
          WHERE id = ?
        `).run(
          encryptedValue,
          options?.description || null,
          now,
          now,
          existing.id
        );

        this.emit('secret_updated', { tenantId, key, secretId: existing.id });

        return existing.id;
      } else {
        // Insert new secret
        this.db.prepare(`
          INSERT INTO secrets (
            id, tenant_id, key, encrypted_value, description,
            created_at, updated_at, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          tenantId,
          key,
          encryptedValue,
          options?.description || null,
          now,
          now,
          options?.createdBy || null
        );

        this.emit('secret_created', { tenantId, key, secretId: id });

        return id;
      }
    } catch (error) {
      this.emit('secret_error', { operation: 'setSecret', tenantId, key, error });
      throw error;
    }
  }

  /**
   * Retrieve a secret
   * @param tenantId Tenant ID
   * @param key Secret key
   * @returns Decrypted secret value
   */
  async getSecret(tenantId: string, key: string): Promise<string | null> {
    try {
      const row = this.db.prepare(`
        SELECT encrypted_value
        FROM secrets
        WHERE tenant_id = ? AND key = ?
      `).get(tenantId, key) as { encrypted_value: string } | undefined;

      if (!row) {
        return null;
      }

      // Decrypt value
      const value = this.encryption.decrypt(row.encrypted_value);

      this.emit('secret_accessed', { tenantId, key });

      return value;
    } catch (error) {
      this.emit('secret_error', { operation: 'getSecret', tenantId, key, error });
      throw error;
    }
  }

  /**
   * List all secrets for a tenant (without values)
   * @param tenantId Tenant ID
   * @returns Array of secrets (without decrypted values)
   */
  async listSecrets(tenantId: string): Promise<Omit<Secret, 'encryptedValue'>[]> {
    const rows = this.db.prepare(`
      SELECT id, tenant_id, key, description, created_at, updated_at, created_by, rotated_at
      FROM secrets
      WHERE tenant_id = ?
      ORDER BY key ASC
    `).all(tenantId) as any[];

    return rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      key: row.key,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      rotatedAt: row.rotated_at,
    }));
  }

  /**
   * Delete a secret
   * @param tenantId Tenant ID
   * @param key Secret key
   * @returns True if deleted
   */
  async deleteSecret(tenantId: string, key: string): Promise<boolean> {
    try {
      const result = this.db.prepare(`
        DELETE FROM secrets
        WHERE tenant_id = ? AND key = ?
      `).run(tenantId, key);

      const deleted = result.changes > 0;

      if (deleted) {
        this.emit('secret_deleted', { tenantId, key });
      }

      return deleted;
    } catch (error) {
      this.emit('secret_error', { operation: 'deleteSecret', tenantId, key, error });
      throw error;
    }
  }

  /**
   * Rotate a secret (update with new value)
   * @param tenantId Tenant ID
   * @param key Secret key
   * @param newValue New secret value
   * @returns True if rotated
   */
  async rotateSecret(tenantId: string, key: string, newValue: string): Promise<boolean> {
    const secretId = await this.setSecret(tenantId, key, newValue);

    this.emit('secret_rotated', { tenantId, key, secretId });

    return true;
  }

  /**
   * Bulk get secrets for a tenant
   * @param tenantId Tenant ID
   * @param keys Array of secret keys
   * @returns Map of key -> value
   */
  async getSecrets(tenantId: string, keys: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    for (const key of keys) {
      const value = await this.getSecret(tenantId, key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Check if a secret exists
   * @param tenantId Tenant ID
   * @param key Secret key
   * @returns True if exists
   */
  async hasSecret(tenantId: string, key: string): Promise<boolean> {
    const row = this.db.prepare(`
      SELECT 1 FROM secrets
      WHERE tenant_id = ? AND key = ?
    `).get(tenantId, key);

    return row !== undefined;
  }
}
