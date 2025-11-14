/**
 * Permission Enforcer
 * Sprint 4 Day 32: Runtime permission enforcement and validation
 */

import type { PluginPermissions } from './types/PluginManifest.js'
import { EventEmitter } from 'events'
import { join, resolve } from 'path'

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  auditLog?: AuditLogEntry
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: string
  pluginName: string
  action: string
  resource: string
  allowed: boolean
  reason?: string
}

/**
 * Permission context
 */
export interface PermissionContext {
  pluginName: string
  permissions: PluginPermissions
}

/**
 * Permission Enforcer Events
 */
export interface PermissionEnforcerEvents {
  'permission-check': (entry: AuditLogEntry) => void
  'permission-denied': (entry: AuditLogEntry) => void
  'permission-granted': (entry: AuditLogEntry) => void
}

/**
 * Permission Enforcer
 */
export class PermissionEnforcer extends EventEmitter {
  private contexts = new Map<string, PermissionContext>()
  private auditLog: AuditLogEntry[] = []

  /**
   * Register plugin permissions
   */
  register(pluginName: string, permissions: PluginPermissions): void {
    this.contexts.set(pluginName, {
      pluginName,
      permissions,
    })
  }

  /**
   * Unregister plugin
   */
  unregister(pluginName: string): void {
    this.contexts.delete(pluginName)
  }

  /**
   * Check filesystem read permission
   */
  checkFilesystemRead(pluginName: string, path: string): PermissionCheckResult {
    const context = this.contexts.get(pluginName)

    if (!context) {
      return this.deny(pluginName, 'filesystem.read', path, 'Plugin not registered')
    }

    const fsPerms = context.permissions.filesystem
    if (!fsPerms || !fsPerms.read) {
      return this.deny(pluginName, 'filesystem.read', path, 'No filesystem read permissions')
    }

    // Check if path is allowed
    const normalizedPath = resolve(path)
    const allowed = fsPerms.read.some((allowedPath) => {
      const normalizedAllowed = resolve(allowedPath)
      return (
        normalizedPath === normalizedAllowed ||
        normalizedPath.startsWith(normalizedAllowed + '/')
      )
    })

    if (!allowed) {
      return this.deny(
        pluginName,
        'filesystem.read',
        path,
        `Path not in allowed read paths: ${fsPerms.read.join(', ')}`
      )
    }

    return this.allow(pluginName, 'filesystem.read', path)
  }

  /**
   * Check filesystem write permission
   */
  checkFilesystemWrite(pluginName: string, path: string): PermissionCheckResult {
    const context = this.contexts.get(pluginName)

    if (!context) {
      return this.deny(pluginName, 'filesystem.write', path, 'Plugin not registered')
    }

    const fsPerms = context.permissions.filesystem
    if (!fsPerms || !fsPerms.write) {
      return this.deny(pluginName, 'filesystem.write', path, 'No filesystem write permissions')
    }

    // Check if path is allowed
    const normalizedPath = resolve(path)
    const allowed = fsPerms.write.some((allowedPath) => {
      const normalizedAllowed = resolve(allowedPath)
      return (
        normalizedPath === normalizedAllowed ||
        normalizedPath.startsWith(normalizedAllowed + '/')
      )
    })

    if (!allowed) {
      return this.deny(
        pluginName,
        'filesystem.write',
        path,
        `Path not in allowed write paths: ${fsPerms.write.join(', ')}`
      )
    }

    return this.allow(pluginName, 'filesystem.write', path)
  }

  /**
   * Check network access permission
   */
  checkNetworkAccess(pluginName: string, domain: string): PermissionCheckResult {
    const context = this.contexts.get(pluginName)

    if (!context) {
      return this.deny(pluginName, 'network.access', domain, 'Plugin not registered')
    }

    const netPerms = context.permissions.network
    if (!netPerms || !netPerms.allowedDomains) {
      return this.deny(pluginName, 'network.access', domain, 'No network permissions')
    }

    // Check if domain is allowed (support wildcards)
    const allowed = netPerms.allowedDomains.some((allowedDomain) => {
      if (allowedDomain === '*') {
        return true
      }
      if (allowedDomain.startsWith('*.')) {
        const baseDomain = allowedDomain.slice(2)
        return domain === baseDomain || domain.endsWith('.' + baseDomain)
      }
      return domain === allowedDomain
    })

    if (!allowed) {
      return this.deny(
        pluginName,
        'network.access',
        domain,
        `Domain not in allowed list: ${netPerms.allowedDomains.join(', ')}`
      )
    }

    return this.allow(pluginName, 'network.access', domain)
  }

  /**
   * Check memory allocation permission
   */
  checkMemoryAllocation(pluginName: string, requestedMB: number): PermissionCheckResult {
    const context = this.contexts.get(pluginName)

    if (!context) {
      return this.deny(pluginName, 'memory.allocate', `${requestedMB}MB`, 'Plugin not registered')
    }

    const memPerms = context.permissions.memory
    if (!memPerms || !memPerms.maxMB) {
      return this.deny(pluginName, 'memory.allocate', `${requestedMB}MB`, 'No memory limit set')
    }

    if (requestedMB > memPerms.maxMB) {
      return this.deny(
        pluginName,
        'memory.allocate',
        `${requestedMB}MB`,
        `Exceeds max memory limit of ${memPerms.maxMB}MB`
      )
    }

    return this.allow(pluginName, 'memory.allocate', `${requestedMB}MB`)
  }

  /**
   * Check process spawn permission
   */
  checkProcessSpawn(pluginName: string, command: string): PermissionCheckResult {
    const context = this.contexts.get(pluginName)

    if (!context) {
      return this.deny(pluginName, 'runtime.spawn', command, 'Plugin not registered')
    }

    const runtimePerms = context.permissions.runtime
    if (!runtimePerms || !runtimePerms.canSpawnProcess) {
      return this.deny(pluginName, 'runtime.spawn', command, 'Process spawning not allowed')
    }

    return this.allow(pluginName, 'runtime.spawn', command)
  }

  /**
   * Check environment access permission
   */
  checkEnvAccess(pluginName: string, envVar: string): PermissionCheckResult {
    const context = this.contexts.get(pluginName)

    if (!context) {
      return this.deny(pluginName, 'runtime.env', envVar, 'Plugin not registered')
    }

    const runtimePerms = context.permissions.runtime
    if (!runtimePerms || !runtimePerms.canAccessEnv) {
      return this.deny(pluginName, 'runtime.env', envVar, 'Environment access not allowed')
    }

    return this.allow(pluginName, 'runtime.env', envVar)
  }

  /**
   * Get plugin permissions
   */
  getPermissions(pluginName: string): PluginPermissions | null {
    const context = this.contexts.get(pluginName)
    return context ? context.permissions : null
  }

  /**
   * Get audit log
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog]
  }

  /**
   * Get audit log for specific plugin
   */
  getPluginAuditLog(pluginName: string): AuditLogEntry[] {
    return this.auditLog.filter((entry) => entry.pluginName === pluginName)
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = []
  }

  /**
   * Get permission summary
   */
  getPermissionSummary(pluginName: string): {
    filesystem: { read: string[]; write: string[] }
    network: { allowedDomains: string[] }
    memory: { maxMB: number | null }
    runtime: { canSpawnProcess: boolean; canAccessEnv: boolean }
  } {
    const context = this.contexts.get(pluginName)

    if (!context) {
      return {
        filesystem: { read: [], write: [] },
        network: { allowedDomains: [] },
        memory: { maxMB: null },
        runtime: { canSpawnProcess: false, canAccessEnv: false },
      }
    }

    const perms = context.permissions

    return {
      filesystem: {
        read: perms.filesystem?.read || [],
        write: perms.filesystem?.write || [],
      },
      network: {
        allowedDomains: perms.network?.allowedDomains || [],
      },
      memory: {
        maxMB: perms.memory?.maxMB || null,
      },
      runtime: {
        canSpawnProcess: perms.runtime?.canSpawnProcess || false,
        canAccessEnv: perms.runtime?.canAccessEnv || false,
      },
    }
  }

  /**
   * Allow permission and log
   */
  private allow(pluginName: string, action: string, resource: string): PermissionCheckResult {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      pluginName,
      action,
      resource,
      allowed: true,
    }

    this.auditLog.push(entry)
    this.emit('permission-check', entry)
    this.emit('permission-granted', entry)

    return {
      allowed: true,
      auditLog: entry,
    }
  }

  /**
   * Deny permission and log
   */
  private deny(
    pluginName: string,
    action: string,
    resource: string,
    reason: string
  ): PermissionCheckResult {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      pluginName,
      action,
      resource,
      allowed: false,
      reason,
    }

    this.auditLog.push(entry)
    this.emit('permission-check', entry)
    this.emit('permission-denied', entry)

    return {
      allowed: false,
      reason,
      auditLog: entry,
    }
  }
}

/**
 * Create permission enforcer
 */
export function createPermissionEnforcer(): PermissionEnforcer {
  return new PermissionEnforcer()
}

/**
 * Global permission enforcer singleton
 */
let globalEnforcer: PermissionEnforcer | null = null

/**
 * Get global permission enforcer
 */
export function getPermissionEnforcer(): PermissionEnforcer {
  if (!globalEnforcer) {
    globalEnforcer = createPermissionEnforcer()
  }
  return globalEnforcer
}

/**
 * Reset global permission enforcer (for testing)
 */
export function resetPermissionEnforcer(): void {
  globalEnforcer = null
}
