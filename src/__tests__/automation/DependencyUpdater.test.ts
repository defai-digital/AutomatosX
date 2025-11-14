/**
 * Dependency Updater Tests
 * Sprint 6 Day 53: Dependency updater tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DependencyUpdater,
  createDependencyUpdater,
  getGlobalUpdater,
  resetGlobalUpdater,
  UpdateType,
  type OutdatedDependency,
  type DependencyUpdate,
} from '../../automation/DependencyUpdater.js'

describe('DependencyUpdater', () => {
  let updater: DependencyUpdater

  beforeEach(() => {
    updater = createDependencyUpdater()
  })

  describe('Outdated Check', () => {
    it('should check for outdated dependencies', async () => {
      const listener = vi.fn()
      updater.on('check-completed', listener)

      const result = await updater.checkOutdated('/test/project')

      expect(result).toMatchObject({
        outdated: expect.any(Array),
        upToDate: expect.any(Number),
        total: expect.any(Number),
        securityVulnerabilities: expect.any(Number),
      })
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('PR Creation', () => {
    it('should create update PR', async () => {
      const listener = vi.fn()
      updater.on('pr-created', listener)

      const dependency: OutdatedDependency = {
        name: 'test-package',
        current: '1.0.0',
        latest: '1.0.1',
        wanted: '1.0.1',
        type: UpdateType.PATCH,
        location: 'node_modules/test-package',
      }

      const update: DependencyUpdate = {
        dependency,
        updateTo: '1.0.1',
      }

      const pr = await updater.createUpdatePR([update])

      expect(pr).toMatchObject({
        id: expect.stringContaining('pr-'),
        title: expect.stringContaining('test-package'),
        body: expect.any(String),
        branch: expect.stringContaining('deps/update-'),
        updates: [update],
        testsPass: true,
      })
      expect(listener).toHaveBeenCalled()
    })

    it('should create PR with custom title', async () => {
      const dependency: OutdatedDependency = {
        name: 'test-package',
        current: '1.0.0',
        latest: '1.0.1',
        wanted: '1.0.1',
        type: UpdateType.PATCH,
        location: 'node_modules/test-package',
      }

      const pr = await updater.createUpdatePR(
        [{ dependency, updateTo: '1.0.1' }],
        {
          title: 'Custom PR title',
        }
      )

      expect(pr.title).toBe('Custom PR title')
    })

    it('should create PR with custom branch', async () => {
      const dependency: OutdatedDependency = {
        name: 'test-package',
        current: '1.0.0',
        latest: '1.0.1',
        wanted: '1.0.1',
        type: UpdateType.PATCH,
        location: 'node_modules/test-package',
      }

      const pr = await updater.createUpdatePR(
        [{ dependency, updateTo: '1.0.1' }],
        {
          branch: 'custom-branch',
        }
      )

      expect(pr.branch).toBe('custom-branch')
    })

    it('should create PR with multiple updates', async () => {
      const dependencies: OutdatedDependency[] = [
        {
          name: 'package-1',
          current: '1.0.0',
          latest: '1.0.1',
          wanted: '1.0.1',
          type: UpdateType.PATCH,
          location: 'node_modules/package-1',
        },
        {
          name: 'package-2',
          current: '2.0.0',
          latest: '2.1.0',
          wanted: '2.1.0',
          type: UpdateType.MINOR,
          location: 'node_modules/package-2',
        },
      ]

      const pr = await updater.createUpdatePR(
        dependencies.map((dep) => ({ dependency: dep, updateTo: dep.latest }))
      )

      expect(pr.updates).toHaveLength(2)
      expect(pr.title).toContain('2 dependencies')
    })

    it('should include breaking changes in PR body', async () => {
      const dependency: OutdatedDependency = {
        name: 'test-package',
        current: '1.0.0',
        latest: '2.0.0',
        wanted: '2.0.0',
        type: UpdateType.MAJOR,
        location: 'node_modules/test-package',
      }

      const update: DependencyUpdate = {
        dependency,
        updateTo: '2.0.0',
        breakingChanges: ['Removed deprecated API', 'Changed function signature'],
      }

      const pr = await updater.createUpdatePR([update])

      expect(pr.body).toContain('Breaking Changes')
      expect(pr.body).toContain('Removed deprecated API')
      expect(pr.body).toContain('Changed function signature')
    })

    it('should include changelog in PR body', async () => {
      const dependency: OutdatedDependency = {
        name: 'test-package',
        current: '1.0.0',
        latest: '1.0.1',
        wanted: '1.0.1',
        type: UpdateType.PATCH,
        location: 'node_modules/test-package',
      }

      const update: DependencyUpdate = {
        dependency,
        updateTo: '1.0.1',
        changelog: 'https://github.com/test/package/releases/tag/v1.0.1',
      }

      const pr = await updater.createUpdatePR([update])

      expect(pr.body).toContain('Changelog')
      expect(pr.body).toContain('https://github.com/test/package/releases/tag/v1.0.1')
    })
  })

  describe('PR Management', () => {
    it('should get PR', async () => {
      const dependency: OutdatedDependency = {
        name: 'test-package',
        current: '1.0.0',
        latest: '1.0.1',
        wanted: '1.0.1',
        type: UpdateType.PATCH,
        location: 'node_modules/test-package',
      }

      const pr = await updater.createUpdatePR([{ dependency, updateTo: '1.0.1' }])

      const retrieved = updater.getPR(pr.id)

      expect(retrieved).toEqual(pr)
    })

    it('should return undefined for non-existent PR', () => {
      const pr = updater.getPR('non-existent')

      expect(pr).toBeUndefined()
    })

    it('should get all PRs', async () => {
      const dependency: OutdatedDependency = {
        name: 'test-package',
        current: '1.0.0',
        latest: '1.0.1',
        wanted: '1.0.1',
        type: UpdateType.PATCH,
        location: 'node_modules/test-package',
      }

      await updater.createUpdatePR([{ dependency, updateTo: '1.0.1' }])
      await updater.createUpdatePR([{ dependency, updateTo: '1.0.2' }])

      const allPRs = updater.getAllPRs()

      expect(allPRs).toHaveLength(2)
    })
  })

  describe('Update Type Detection', () => {
    it('should detect patch update', () => {
      const type = DependencyUpdater.determineUpdateType('1.0.0', '1.0.1')

      expect(type).toBe(UpdateType.PATCH)
    })

    it('should detect minor update', () => {
      const type = DependencyUpdater.determineUpdateType('1.0.0', '1.1.0')

      expect(type).toBe(UpdateType.MINOR)
    })

    it('should detect major update', () => {
      const type = DependencyUpdater.determineUpdateType('1.0.0', '2.0.0')

      expect(type).toBe(UpdateType.MAJOR)
    })
  })

  describe('Auto-merge Policy', () => {
    it('should auto-merge patch updates with patch-only policy', () => {
      const update: DependencyUpdate = {
        dependency: {
          name: 'test',
          current: '1.0.0',
          latest: '1.0.1',
          wanted: '1.0.1',
          type: UpdateType.PATCH,
          location: 'node_modules/test',
        },
        updateTo: '1.0.1',
      }

      const shouldMerge = DependencyUpdater.shouldAutoMerge(update, 'patch-only')

      expect(shouldMerge).toBe(true)
    })

    it('should not auto-merge minor updates with patch-only policy', () => {
      const update: DependencyUpdate = {
        dependency: {
          name: 'test',
          current: '1.0.0',
          latest: '1.1.0',
          wanted: '1.1.0',
          type: UpdateType.MINOR,
          location: 'node_modules/test',
        },
        updateTo: '1.1.0',
      }

      const shouldMerge = DependencyUpdater.shouldAutoMerge(update, 'patch-only')

      expect(shouldMerge).toBe(false)
    })

    it('should auto-merge patch and minor with patch-and-minor policy', () => {
      const patchUpdate: DependencyUpdate = {
        dependency: {
          name: 'test',
          current: '1.0.0',
          latest: '1.0.1',
          wanted: '1.0.1',
          type: UpdateType.PATCH,
          location: 'node_modules/test',
        },
        updateTo: '1.0.1',
      }

      const minorUpdate: DependencyUpdate = {
        dependency: {
          name: 'test',
          current: '1.0.0',
          latest: '1.1.0',
          wanted: '1.1.0',
          type: UpdateType.MINOR,
          location: 'node_modules/test',
        },
        updateTo: '1.1.0',
      }

      expect(DependencyUpdater.shouldAutoMerge(patchUpdate, 'patch-and-minor')).toBe(true)
      expect(DependencyUpdater.shouldAutoMerge(minorUpdate, 'patch-and-minor')).toBe(true)
    })

    it('should not auto-merge with none policy', () => {
      const update: DependencyUpdate = {
        dependency: {
          name: 'test',
          current: '1.0.0',
          latest: '1.0.1',
          wanted: '1.0.1',
          type: UpdateType.PATCH,
          location: 'node_modules/test',
        },
        updateTo: '1.0.1',
      }

      const shouldMerge = DependencyUpdater.shouldAutoMerge(update, 'none')

      expect(shouldMerge).toBe(false)
    })

    it('should auto-merge all updates with all policy', () => {
      const majorUpdate: DependencyUpdate = {
        dependency: {
          name: 'test',
          current: '1.0.0',
          latest: '2.0.0',
          wanted: '2.0.0',
          type: UpdateType.MAJOR,
          location: 'node_modules/test',
        },
        updateTo: '2.0.0',
      }

      const shouldMerge = DependencyUpdater.shouldAutoMerge(majorUpdate, 'all')

      expect(shouldMerge).toBe(true)
    })
  })

  describe('Clear Operations', () => {
    beforeEach(async () => {
      const dependency: OutdatedDependency = {
        name: 'test-package',
        current: '1.0.0',
        latest: '1.0.1',
        wanted: '1.0.1',
        type: UpdateType.PATCH,
        location: 'node_modules/test-package',
      }

      await updater.createUpdatePR([{ dependency, updateTo: '1.0.1' }])
    })

    it('should clear PR', () => {
      const listener = vi.fn()
      updater.on('pr-cleared', listener)

      const prs = updater.getAllPRs()
      updater.clearPR(prs[0].id)

      const pr = updater.getPR(prs[0].id)

      expect(pr).toBeUndefined()
      expect(listener).toHaveBeenCalled()
    })

    it('should clear all PRs', () => {
      const listener = vi.fn()
      updater.on('all-cleared', listener)

      updater.clearAll()

      const allPRs = updater.getAllPRs()

      expect(allPRs).toHaveLength(0)
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Global Updater', () => {
    beforeEach(() => {
      resetGlobalUpdater()
    })

    it('should get global updater', () => {
      const global = getGlobalUpdater()

      expect(global).toBeInstanceOf(DependencyUpdater)
    })

    it('should return same instance', () => {
      const updater1 = getGlobalUpdater()
      const updater2 = getGlobalUpdater()

      expect(updater1).toBe(updater2)
    })

    it('should reset global updater', () => {
      const updater1 = getGlobalUpdater()

      resetGlobalUpdater()

      const updater2 = getGlobalUpdater()

      expect(updater2).not.toBe(updater1)
    })
  })
})
