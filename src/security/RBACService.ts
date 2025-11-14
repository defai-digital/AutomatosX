/**
 * RBACService.ts
 *
 * Role-Based Access Control service
 * Phase 5 Week 3: Security
 */

import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import {
  Role,
  User,
  UserWithRoles,
  UserRole,
  Permission,
  UnauthorizedError,
  ForbiddenError,
} from '../types/security.types.js';
import { getDatabase } from '../database/connection.js';

/**
 * RBACService - Role-Based Access Control
 *
 * Features:
 * - Role and permission management
 * - User authorization checks
 * - Permission inheritance
 * - System roles (admin, developer, viewer, auditor)
 */
export class RBACService extends EventEmitter {
  private db: Database.Database;
  private permissionCache: Map<string, Set<Permission>> = new Map();

  constructor(db?: Database.Database) {
    super();
    this.db = db || getDatabase();
  }

  // ============================================================================
  // Role Management
  // ============================================================================

  /**
   * Create a new role
   */
  async createRole(
    name: string,
    permissions: Permission[],
    options?: {
      description?: string;
      isSystemRole?: boolean;
    }
  ): Promise<Role> {
    const id = `role_${randomUUID()}`;
    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO roles (id, name, permissions, description, is_system_role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name,
        JSON.stringify(permissions),
        options?.description || null,
        options?.isSystemRole ? 1 : 0,
        now,
        now
      );

      const role: Role = {
        id,
        name,
        permissions,
        description: options?.description,
        isSystemRole: options?.isSystemRole || false,
        createdAt: now,
        updatedAt: now,
      };

      this.emit('role_created', { role });

      return role;
    } catch (error) {
      this.emit('role_error', { operation: 'createRole', name, error });
      throw error;
    }
  }

  /**
   * Get role by ID
   */
  async getRole(roleId: string): Promise<Role | null> {
    const row = this.db.prepare(`
      SELECT * FROM roles WHERE id = ?
    `).get(roleId) as any;

    if (!row) {
      return null;
    }

    return this.rowToRole(row);
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string): Promise<Role | null> {
    const row = this.db.prepare(`
      SELECT * FROM roles WHERE name = ?
    `).get(name) as any;

    if (!row) {
      return null;
    }

    return this.rowToRole(row);
  }

  /**
   * List all roles
   */
  async listRoles(): Promise<Role[]> {
    const rows = this.db.prepare(`
      SELECT * FROM roles ORDER BY name ASC
    `).all() as any[];

    return rows.map(row => this.rowToRole(row));
  }

  /**
   * Update role permissions
   */
  async updateRole(roleId: string, permissions: Permission[]): Promise<void> {
    const now = Date.now();

    this.db.prepare(`
      UPDATE roles
      SET permissions = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(permissions), now, roleId);

    // Clear permission cache for users with this role
    this.permissionCache.clear();

    this.emit('role_updated', { roleId, permissions });
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    // Check if system role
    const role = await this.getRole(roleId);
    if (role?.isSystemRole) {
      throw new Error('Cannot delete system role');
    }

    this.db.prepare(`DELETE FROM roles WHERE id = ?`).run(roleId);
    this.permissionCache.clear();

    this.emit('role_deleted', { roleId });
  }

  // ============================================================================
  // User-Role Assignment
  // ============================================================================

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void> {
    const now = Date.now();

    try {
      this.db.prepare(`
        INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
        VALUES (?, ?, ?, ?)
      `).run(userId, roleId, now, assignedBy || null);

      // Clear permission cache for this user
      this.permissionCache.delete(userId);

      this.emit('role_assigned', { userId, roleId, assignedBy });
    } catch (error) {
      // Handle duplicate assignment gracefully
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        // Already assigned, no-op
        return;
      }
      throw error;
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRole(userId: string, roleId: string): Promise<void> {
    this.db.prepare(`
      DELETE FROM user_roles
      WHERE user_id = ? AND role_id = ?
    `).run(userId, roleId);

    this.permissionCache.delete(userId);

    this.emit('role_revoked', { userId, roleId });
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    const rows = this.db.prepare(`
      SELECT r.* FROM roles r
      JOIN user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `).all(userId) as any[];

    return rows.map(row => this.rowToRole(row));
  }

  /**
   * Get user with roles
   */
  async getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    const userRow = this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `).get(userId) as any;

    if (!userRow) {
      return null;
    }

    const roles = await this.getUserRoles(userId);

    return {
      ...this.rowToUser(userRow),
      roles,
    };
  }

  // ============================================================================
  // Permission Checking
  // ============================================================================

  /**
   * Get all permissions for a user (with caching)
   */
  async getUserPermissions(userId: string): Promise<Set<Permission>> {
    // Check cache
    const cached = this.permissionCache.get(userId);
    if (cached) {
      return cached;
    }

    // Load from database
    const roles = await this.getUserRoles(userId);
    const permissions = new Set<Permission>();

    for (const role of roles) {
      for (const permission of role.permissions) {
        permissions.add(permission);

        // Wildcard permission grants all
        if (permission === '*') {
          this.permissionCache.set(userId, new Set(['*']));
          return new Set(['*']);
        }
      }
    }

    // Cache permissions
    this.permissionCache.set(userId, permissions);

    return permissions;
  }

  /**
   * Check if user has permission
   */
  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);

    // Check wildcard
    if (permissions.has('*')) {
      return true;
    }

    // Check exact permission
    return permissions.has(permission);
  }

  /**
   * Check permission and throw if denied
   */
  async requirePermission(userId: string, permission: Permission): Promise<void> {
    const has = await this.hasPermission(userId, permission);

    if (!has) {
      throw new ForbiddenError(permission);
    }
  }

  /**
   * Check multiple permissions (OR logic)
   */
  async hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    if (userPermissions.has('*')) {
      return true;
    }

    return permissions.some(p => userPermissions.has(p));
  }

  /**
   * Check multiple permissions (AND logic)
   */
  async hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    if (userPermissions.has('*')) {
      return true;
    }

    return permissions.every(p => userPermissions.has(p));
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private rowToRole(row: any): Role {
    return {
      id: row.id,
      name: row.name,
      permissions: JSON.parse(row.permissions),
      description: row.description,
      isSystemRole: row.is_system_role === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      tenantId: row.tenant_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
    };
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
    this.emit('cache_cleared');
  }
}
