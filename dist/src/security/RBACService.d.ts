/**
 * RBACService.ts
 *
 * Role-Based Access Control service
 * Phase 5 Week 3: Security
 */
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';
import { Role, UserWithRoles, Permission } from '../types/security.types.js';
/**
 * RBACService - Role-Based Access Control
 *
 * Features:
 * - Role and permission management
 * - User authorization checks
 * - Permission inheritance
 * - System roles (admin, developer, viewer, auditor)
 */
export declare class RBACService extends EventEmitter {
    private db;
    private permissionCache;
    constructor(db?: Database.Database);
    /**
     * Create a new role
     */
    createRole(name: string, permissions: Permission[], options?: {
        description?: string;
        isSystemRole?: boolean;
    }): Promise<Role>;
    /**
     * Get role by ID
     */
    getRole(roleId: string): Promise<Role | null>;
    /**
     * Get role by name
     */
    getRoleByName(name: string): Promise<Role | null>;
    /**
     * List all roles
     */
    listRoles(): Promise<Role[]>;
    /**
     * Update role permissions
     */
    updateRole(roleId: string, permissions: Permission[]): Promise<void>;
    /**
     * Delete role
     */
    deleteRole(roleId: string): Promise<void>;
    /**
     * Assign role to user
     */
    assignRole(userId: string, roleId: string, assignedBy?: string): Promise<void>;
    /**
     * Revoke role from user
     */
    revokeRole(userId: string, roleId: string): Promise<void>;
    /**
     * Get user's roles
     */
    getUserRoles(userId: string): Promise<Role[]>;
    /**
     * Get user with roles
     */
    getUserWithRoles(userId: string): Promise<UserWithRoles | null>;
    /**
     * Get all permissions for a user (with caching)
     */
    getUserPermissions(userId: string): Promise<Set<Permission>>;
    /**
     * Check if user has permission
     */
    hasPermission(userId: string, permission: Permission): Promise<boolean>;
    /**
     * Check permission and throw if denied
     */
    requirePermission(userId: string, permission: Permission): Promise<void>;
    /**
     * Check multiple permissions (OR logic)
     */
    hasAnyPermission(userId: string, permissions: Permission[]): Promise<boolean>;
    /**
     * Check multiple permissions (AND logic)
     */
    hasAllPermissions(userId: string, permissions: Permission[]): Promise<boolean>;
    private rowToRole;
    private rowToUser;
    /**
     * Clear permission cache
     */
    clearCache(): void;
}
//# sourceMappingURL=RBACService.d.ts.map