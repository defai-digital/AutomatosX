/**
 * Semver Engine Tests
 * Sprint 4 Day 32: Semantic versioning tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SemverEngine, createSemverEngine } from '../../plugins/SemverEngine.js'

describe('SemverEngine', () => {
  let engine: SemverEngine

  beforeEach(() => {
    engine = createSemverEngine()
  })

  describe('Parsing and Validation', () => {
    it('should parse valid semantic version', () => {
      const parsed = engine.parse('1.2.3')

      expect(parsed).toBeDefined()
      expect(parsed?.major).toBe(1)
      expect(parsed?.minor).toBe(2)
      expect(parsed?.patch).toBe(3)
    })

    it('should return null for invalid version', () => {
      const parsed = engine.parse('invalid')

      expect(parsed).toBeNull()
    })

    it('should validate correct version', () => {
      expect(engine.isValid('1.2.3')).toBe(true)
      expect(engine.isValid('0.0.1')).toBe(true)
      expect(engine.isValid('10.20.30')).toBe(true)
    })

    it('should invalidate incorrect version', () => {
      expect(engine.isValid('1.2')).toBe(false)
      expect(engine.isValid('invalid')).toBe(false)
      expect(engine.isValid('v1.2.3')).toBe(false)
    })

    it('should parse version with prerelease', () => {
      const parsed = engine.parse('1.2.3-alpha.1')

      expect(parsed?.prerelease).toEqual(['alpha', 1])
    })

    it('should parse version with build metadata', () => {
      const parsed = engine.parse('1.2.3+build.123')

      expect(parsed?.build).toEqual(['build', '123'])
    })
  })

  describe('Satisfaction Checks', () => {
    it('should check if version satisfies exact match', () => {
      expect(engine.satisfies('1.2.3', '1.2.3')).toBe(true)
      expect(engine.satisfies('1.2.4', '1.2.3')).toBe(false)
    })

    it('should check if version satisfies caret range', () => {
      expect(engine.satisfies('1.2.3', '^1.0.0')).toBe(true)
      expect(engine.satisfies('1.9.9', '^1.0.0')).toBe(true)
      expect(engine.satisfies('2.0.0', '^1.0.0')).toBe(false)
    })

    it('should check if version satisfies tilde range', () => {
      expect(engine.satisfies('1.2.3', '~1.2.0')).toBe(true)
      expect(engine.satisfies('1.2.9', '~1.2.0')).toBe(true)
      expect(engine.satisfies('1.3.0', '~1.2.0')).toBe(false)
    })

    it('should check if version satisfies >= range', () => {
      expect(engine.satisfies('2.0.0', '>=1.0.0')).toBe(true)
      expect(engine.satisfies('0.9.0', '>=1.0.0')).toBe(false)
    })

    it('should check if version satisfies complex range', () => {
      expect(engine.satisfies('1.5.0', '>=1.0.0 <2.0.0')).toBe(true)
      expect(engine.satisfies('2.5.0', '>=1.0.0 <2.0.0')).toBe(false)
    })
  })

  describe('Compatibility Checks', () => {
    it('should return compatible for valid version and range', () => {
      const result = engine.checkCompatibility('1.2.3', '^1.0.0')

      expect(result.compatible).toBe(true)
      expect(result.satisfiedVersion).toBe('1.2.3')
    })

    it('should return incompatible for mismatched version', () => {
      const result = engine.checkCompatibility('2.0.0', '^1.0.0')

      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('does not satisfy')
    })

    it('should return error for invalid version', () => {
      const result = engine.checkCompatibility('invalid', '^1.0.0')

      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('Invalid version')
    })

    it('should return error for invalid range', () => {
      const result = engine.checkCompatibility('1.2.3', 'invalid')

      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('Invalid version range')
    })
  })

  describe('Max/Min Satisfying', () => {
    it('should find max satisfying version', () => {
      const versions = ['1.0.0', '1.5.0', '1.9.9', '2.0.0']
      const max = engine.maxSatisfying(versions, '^1.0.0')

      expect(max).toBe('1.9.9')
    })

    it('should find min satisfying version', () => {
      const versions = ['1.0.0', '1.5.0', '1.9.9', '2.0.0']
      const min = engine.minSatisfying(versions, '^1.0.0')

      expect(min).toBe('1.0.0')
    })

    it('should return null if no version satisfies', () => {
      const versions = ['2.0.0', '3.0.0']
      const max = engine.maxSatisfying(versions, '^1.0.0')

      expect(max).toBeNull()
    })
  })

  describe('Comparison', () => {
    it('should compare versions correctly', () => {
      expect(engine.compare('2.0.0', '1.0.0')).toBe(1)
      expect(engine.compare('1.0.0', '2.0.0')).toBe(-1)
      expect(engine.compare('1.0.0', '1.0.0')).toBe(0)
    })

    it('should check greater than', () => {
      expect(engine.gt('2.0.0', '1.0.0')).toBe(true)
      expect(engine.gt('1.0.0', '2.0.0')).toBe(false)
      expect(engine.gt('1.0.0', '1.0.0')).toBe(false)
    })

    it('should check less than', () => {
      expect(engine.lt('1.0.0', '2.0.0')).toBe(true)
      expect(engine.lt('2.0.0', '1.0.0')).toBe(false)
      expect(engine.lt('1.0.0', '1.0.0')).toBe(false)
    })

    it('should check equality', () => {
      expect(engine.eq('1.0.0', '1.0.0')).toBe(true)
      expect(engine.eq('1.0.0', '1.0.1')).toBe(false)
    })
  })

  describe('Version Components', () => {
    it('should extract major version', () => {
      expect(engine.major('1.2.3')).toBe(1)
      expect(engine.major('10.5.2')).toBe(10)
    })

    it('should extract minor version', () => {
      expect(engine.minor('1.2.3')).toBe(2)
      expect(engine.minor('10.5.2')).toBe(5)
    })

    it('should extract patch version', () => {
      expect(engine.patch('1.2.3')).toBe(3)
      expect(engine.patch('10.5.2')).toBe(2)
    })

    it('should extract prerelease', () => {
      expect(engine.prerelease('1.2.3-alpha.1')).toEqual(['alpha', 1])
      expect(engine.prerelease('1.2.3')).toBeNull()
    })
  })

  describe('Version Manipulation', () => {
    it('should increment major version', () => {
      expect(engine.inc('1.2.3', 'major')).toBe('2.0.0')
    })

    it('should increment minor version', () => {
      expect(engine.inc('1.2.3', 'minor')).toBe('1.3.0')
    })

    it('should increment patch version', () => {
      expect(engine.inc('1.2.3', 'patch')).toBe('1.2.4')
    })

    it('should increment prerelease version', () => {
      const result = engine.inc('1.2.3-alpha.1', 'prerelease')

      expect(result).toBe('1.2.3-alpha.2')
    })

    it('should clean version with prefix', () => {
      expect(engine.clean('v1.2.3')).toBe('1.2.3')
      expect(engine.clean('  1.2.3  ')).toBe('1.2.3')
    })

    it('should coerce loose version', () => {
      const coerced = engine.coerce('1.2')

      expect(coerced?.version).toBe('1.2.0')
    })
  })

  describe('Compatibility', () => {
    it('should check if versions are compatible (same major)', () => {
      expect(engine.areCompatible('1.2.3', '1.5.0')).toBe(true)
      expect(engine.areCompatible('1.2.3', '2.0.0')).toBe(false)
    })

    it('should treat 0.x as incompatible unless exact', () => {
      expect(engine.areCompatible('0.1.0', '0.1.0')).toBe(true)
      expect(engine.areCompatible('0.1.0', '0.2.0')).toBe(false)
    })
  })

  describe('Conflict Detection', () => {
    it('should find version conflicts', () => {
      const deps = new Map([
        ['package-a', ['1.0.0', '2.0.0']], // Conflict
        ['package-b', ['1.0.0', '1.5.0']], // Compatible
      ])

      const conflicts = engine.findConflicts(deps)

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].package).toBe('package-a')
      expect(conflicts[0].versions).toEqual(['1.0.0', '2.0.0'])
    })

    it('should detect 0.x conflicts', () => {
      const deps = new Map([['package-a', ['0.1.0', '0.2.0']]])

      const conflicts = engine.findConflicts(deps)

      expect(conflicts).toHaveLength(1)
    })

    it('should return empty for compatible versions', () => {
      const deps = new Map([['package-a', ['1.0.0', '1.5.0']]])

      const conflicts = engine.findConflicts(deps)

      expect(conflicts).toHaveLength(0)
    })
  })

  describe('Resolution Suggestions', () => {
    it('should suggest highest version as resolution', () => {
      const versions = ['1.0.0', '1.5.0', '2.0.0']
      const suggestion = engine.suggestResolution(versions)

      expect(suggestion).toBe('2.0.0')
    })

    it('should return null for empty versions', () => {
      const suggestion = engine.suggestResolution([])

      expect(suggestion).toBeNull()
    })

    it('should filter invalid versions before suggesting', () => {
      const versions = ['1.0.0', 'invalid', '2.0.0']
      const suggestion = engine.suggestResolution(versions)

      expect(suggestion).toBe('2.0.0')
    })
  })

  describe('Range Parsing', () => {
    it('should parse caret range', () => {
      const range = engine.parseCaretRange('1.2.3')

      expect(range).toEqual({ min: '1.2.3', max: '2.0.0' })
    })

    it('should parse tilde range', () => {
      const range = engine.parseTildeRange('1.2.3')

      expect(range).toEqual({ min: '1.2.3', max: '1.3.0' })
    })

    it('should return null for invalid version in range parsing', () => {
      const range = engine.parseCaretRange('invalid')

      expect(range).toBeNull()
    })
  })

  describe('Version Diff', () => {
    it('should detect major diff', () => {
      expect(engine.diff('1.0.0', '2.0.0')).toBe('major')
    })

    it('should detect minor diff', () => {
      expect(engine.diff('1.0.0', '1.1.0')).toBe('minor')
    })

    it('should detect patch diff', () => {
      expect(engine.diff('1.0.0', '1.0.1')).toBe('patch')
    })

    it('should detect prerelease diff', () => {
      const diff = engine.diff('1.0.0', '1.0.1-alpha.1')

      expect(diff).toBe('prepatch')
    })
  })

  describe('Sorting', () => {
    it('should sort versions in ascending order', () => {
      const versions = ['2.0.0', '1.0.0', '1.5.0']
      const sorted = engine.sort(versions)

      expect(sorted).toEqual(['1.0.0', '1.5.0', '2.0.0'])
    })

    it('should sort versions in descending order', () => {
      const versions = ['1.0.0', '2.0.0', '1.5.0']
      const sorted = engine.rsort(versions)

      expect(sorted).toEqual(['2.0.0', '1.5.0', '1.0.0'])
    })

    it('should not mutate original array', () => {
      const versions = ['2.0.0', '1.0.0']
      engine.sort(versions)

      expect(versions).toEqual(['2.0.0', '1.0.0'])
    })
  })

  describe('Factory Function', () => {
    it('should create engine via factory', () => {
      const engine = createSemverEngine()

      expect(engine).toBeInstanceOf(SemverEngine)
    })

    it('should create independent instances', () => {
      const engine1 = createSemverEngine()
      const engine2 = createSemverEngine()

      expect(engine1).not.toBe(engine2)
    })
  })
})
