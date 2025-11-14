/**
 * Permission Enforcer Tests
 * Sprint 4 Day 32: Permission enforcement tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PermissionEnforcer,
  createPermissionEnforcer,
  getPermissionEnforcer,
  resetPermissionEnforcer,
} from '../../plugins/PermissionEnforcer.js'
import type { PluginPermissions } from '../../plugins/types/PluginManifest.js'

describe('PermissionEnforcer', () => {
  let enforcer: PermissionEnforcer

  beforeEach(() => {
    enforcer = createPermissionEnforcer()
    resetPermissionEnforcer()
  })

  describe('Registration', () => {
    it('should register plugin with permissions', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const registered = enforcer.getPermissions('test-plugin')
      expect(registered).toEqual(permissions)
    })

    it('should unregister plugin', () => {
      const permissions: PluginPermissions = {}

      enforcer.register('test-plugin', permissions)
      enforcer.unregister('test-plugin')

      const registered = enforcer.getPermissions('test-plugin')
      expect(registered).toBeNull()
    })

    it('should return null for unregistered plugin', () => {
      const permissions = enforcer.getPermissions('unknown-plugin')

      expect(permissions).toBeNull()
    })
  })

  describe('Filesystem Read Permissions', () => {
    it('should allow read from permitted path', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkFilesystemRead('test-plugin', '/tmp/file.txt')

      expect(result.allowed).toBe(true)
    })

    it('should deny read from non-permitted path', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkFilesystemRead('test-plugin', '/etc/passwd')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not in allowed')
    })

    it('should deny read if no filesystem permissions', () => {
      const permissions: PluginPermissions = {}

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkFilesystemRead('test-plugin', '/tmp/file.txt')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No filesystem read permissions')
    })

    it('should deny read for unregistered plugin', () => {
      const result = enforcer.checkFilesystemRead('unknown-plugin', '/tmp/file.txt')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not registered')
    })

    it('should allow read from subdirectory of permitted path', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkFilesystemRead('test-plugin', '/tmp/subdir/file.txt')

      expect(result.allowed).toBe(true)
    })
  })

  describe('Filesystem Write Permissions', () => {
    it('should allow write to permitted path', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          write: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkFilesystemWrite('test-plugin', '/tmp/file.txt')

      expect(result.allowed).toBe(true)
    })

    it('should deny write to non-permitted path', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          write: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkFilesystemWrite('test-plugin', '/etc/config')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not in allowed')
    })

    it('should deny write if no filesystem permissions', () => {
      const permissions: PluginPermissions = {}

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkFilesystemWrite('test-plugin', '/tmp/file.txt')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No filesystem write permissions')
    })
  })

  describe('Network Access Permissions', () => {
    it('should allow access to permitted domain', () => {
      const permissions: PluginPermissions = {
        network: {
          allowedDomains: ['example.com'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkNetworkAccess('test-plugin', 'example.com')

      expect(result.allowed).toBe(true)
    })

    it('should deny access to non-permitted domain', () => {
      const permissions: PluginPermissions = {
        network: {
          allowedDomains: ['example.com'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkNetworkAccess('test-plugin', 'evil.com')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not in allowed list')
    })

    it('should allow wildcard domain access', () => {
      const permissions: PluginPermissions = {
        network: {
          allowedDomains: ['*'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkNetworkAccess('test-plugin', 'any-domain.com')

      expect(result.allowed).toBe(true)
    })

    it('should allow subdomain with wildcard pattern', () => {
      const permissions: PluginPermissions = {
        network: {
          allowedDomains: ['*.example.com'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkNetworkAccess('test-plugin', 'api.example.com')

      expect(result.allowed).toBe(true)
    })

    it('should allow base domain with wildcard pattern', () => {
      const permissions: PluginPermissions = {
        network: {
          allowedDomains: ['*.example.com'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkNetworkAccess('test-plugin', 'example.com')

      expect(result.allowed).toBe(true)
    })

    it('should deny if no network permissions', () => {
      const permissions: PluginPermissions = {}

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkNetworkAccess('test-plugin', 'example.com')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No network permissions')
    })
  })

  describe('Memory Allocation Permissions', () => {
    it('should allow allocation within limit', () => {
      const permissions: PluginPermissions = {
        memory: {
          maxMB: 100,
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkMemoryAllocation('test-plugin', 50)

      expect(result.allowed).toBe(true)
    })

    it('should deny allocation exceeding limit', () => {
      const permissions: PluginPermissions = {
        memory: {
          maxMB: 100,
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkMemoryAllocation('test-plugin', 150)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Exceeds max memory limit')
    })

    it('should deny if no memory limit set', () => {
      const permissions: PluginPermissions = {}

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkMemoryAllocation('test-plugin', 50)

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('No memory limit set')
    })

    it('should allow exact limit allocation', () => {
      const permissions: PluginPermissions = {
        memory: {
          maxMB: 100,
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkMemoryAllocation('test-plugin', 100)

      expect(result.allowed).toBe(true)
    })
  })

  describe('Process Spawn Permissions', () => {
    it('should allow process spawn if permitted', () => {
      const permissions: PluginPermissions = {
        runtime: {
          canSpawnProcess: true,
          canAccessEnv: false,
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkProcessSpawn('test-plugin', 'echo hello')

      expect(result.allowed).toBe(true)
    })

    it('should deny process spawn if not permitted', () => {
      const permissions: PluginPermissions = {
        runtime: {
          canSpawnProcess: false,
          canAccessEnv: false,
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkProcessSpawn('test-plugin', 'rm -rf /')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not allowed')
    })

    it('should deny if no runtime permissions', () => {
      const permissions: PluginPermissions = {}

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkProcessSpawn('test-plugin', 'echo hello')

      expect(result.allowed).toBe(false)
    })
  })

  describe('Environment Access Permissions', () => {
    it('should allow env access if permitted', () => {
      const permissions: PluginPermissions = {
        runtime: {
          canSpawnProcess: false,
          canAccessEnv: true,
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkEnvAccess('test-plugin', 'PATH')

      expect(result.allowed).toBe(true)
    })

    it('should deny env access if not permitted', () => {
      const permissions: PluginPermissions = {
        runtime: {
          canSpawnProcess: false,
          canAccessEnv: false,
        },
      }

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkEnvAccess('test-plugin', 'SECRET_KEY')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('not allowed')
    })

    it('should deny if no runtime permissions', () => {
      const permissions: PluginPermissions = {}

      enforcer.register('test-plugin', permissions)

      const result = enforcer.checkEnvAccess('test-plugin', 'PATH')

      expect(result.allowed).toBe(false)
    })
  })

  describe('Audit Logging', () => {
    it('should log allowed permission checks', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)
      enforcer.checkFilesystemRead('test-plugin', '/tmp/file.txt')

      const log = enforcer.getAuditLog()

      expect(log).toHaveLength(1)
      expect(log[0].allowed).toBe(true)
      expect(log[0].action).toBe('filesystem.read')
    })

    it('should log denied permission checks', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)
      enforcer.checkFilesystemRead('test-plugin', '/etc/passwd')

      const log = enforcer.getAuditLog()

      expect(log).toHaveLength(1)
      expect(log[0].allowed).toBe(false)
      expect(log[0].reason).toBeDefined()
    })

    it('should include timestamp in audit log', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)
      enforcer.checkFilesystemRead('test-plugin', '/tmp/file.txt')

      const log = enforcer.getAuditLog()

      expect(log[0].timestamp).toBeDefined()
      expect(new Date(log[0].timestamp).getTime()).toBeGreaterThan(0)
    })

    it('should get audit log for specific plugin', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('plugin-1', permissions)
      enforcer.register('plugin-2', permissions)

      enforcer.checkFilesystemRead('plugin-1', '/tmp/file1.txt')
      enforcer.checkFilesystemRead('plugin-2', '/tmp/file2.txt')

      const log = enforcer.getPluginAuditLog('plugin-1')

      expect(log).toHaveLength(1)
      expect(log[0].pluginName).toBe('plugin-1')
    })

    it('should clear audit log', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      enforcer.register('test-plugin', permissions)
      enforcer.checkFilesystemRead('test-plugin', '/tmp/file.txt')
      enforcer.clearAuditLog()

      const log = enforcer.getAuditLog()

      expect(log).toHaveLength(0)
    })
  })

  describe('Event Emission', () => {
    it('should emit permission-check event', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      const spy = vi.fn()
      enforcer.on('permission-check', spy)

      enforcer.register('test-plugin', permissions)
      enforcer.checkFilesystemRead('test-plugin', '/tmp/file.txt')

      expect(spy).toHaveBeenCalled()
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          allowed: true,
          action: 'filesystem.read',
        })
      )
    })

    it('should emit permission-granted event', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      const spy = vi.fn()
      enforcer.on('permission-granted', spy)

      enforcer.register('test-plugin', permissions)
      enforcer.checkFilesystemRead('test-plugin', '/tmp/file.txt')

      expect(spy).toHaveBeenCalled()
    })

    it('should emit permission-denied event', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
        },
      }

      const spy = vi.fn()
      enforcer.on('permission-denied', spy)

      enforcer.register('test-plugin', permissions)
      enforcer.checkFilesystemRead('test-plugin', '/etc/passwd')

      expect(spy).toHaveBeenCalled()
    })
  })

  describe('Permission Summary', () => {
    it('should get complete permission summary', () => {
      const permissions: PluginPermissions = {
        filesystem: {
          read: ['/tmp'],
          write: ['/tmp/output'],
        },
        network: {
          allowedDomains: ['example.com'],
        },
        memory: {
          maxMB: 100,
        },
        runtime: {
          canSpawnProcess: true,
          canAccessEnv: false,
        },
      }

      enforcer.register('test-plugin', permissions)

      const summary = enforcer.getPermissionSummary('test-plugin')

      expect(summary.filesystem.read).toEqual(['/tmp'])
      expect(summary.filesystem.write).toEqual(['/tmp/output'])
      expect(summary.network.allowedDomains).toEqual(['example.com'])
      expect(summary.memory.maxMB).toBe(100)
      expect(summary.runtime.canSpawnProcess).toBe(true)
      expect(summary.runtime.canAccessEnv).toBe(false)
    })

    it('should return empty summary for unregistered plugin', () => {
      const summary = enforcer.getPermissionSummary('unknown-plugin')

      expect(summary.filesystem.read).toEqual([])
      expect(summary.filesystem.write).toEqual([])
      expect(summary.network.allowedDomains).toEqual([])
      expect(summary.memory.maxMB).toBeNull()
      expect(summary.runtime.canSpawnProcess).toBe(false)
      expect(summary.runtime.canAccessEnv).toBe(false)
    })

    it('should handle partial permissions', () => {
      const permissions: PluginPermissions = {
        network: {
          allowedDomains: ['example.com'],
        },
      }

      enforcer.register('test-plugin', permissions)

      const summary = enforcer.getPermissionSummary('test-plugin')

      expect(summary.filesystem.read).toEqual([])
      expect(summary.network.allowedDomains).toEqual(['example.com'])
    })
  })

  describe('Factory and Singleton', () => {
    it('should create enforcer via factory', () => {
      const enforcer = createPermissionEnforcer()

      expect(enforcer).toBeInstanceOf(PermissionEnforcer)
    })

    it('should create independent instances', () => {
      const enforcer1 = createPermissionEnforcer()
      const enforcer2 = createPermissionEnforcer()

      expect(enforcer1).not.toBe(enforcer2)
    })

    it('should get global singleton', () => {
      const enforcer1 = getPermissionEnforcer()
      const enforcer2 = getPermissionEnforcer()

      expect(enforcer1).toBe(enforcer2)
    })

    it('should reset global singleton', () => {
      const enforcer1 = getPermissionEnforcer()
      resetPermissionEnforcer()
      const enforcer2 = getPermissionEnforcer()

      expect(enforcer1).not.toBe(enforcer2)
    })
  })
})
