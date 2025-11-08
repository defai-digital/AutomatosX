import { describe, expect, it } from 'vitest'
import * as DependencyValidator from '../../../packages/rescript-core/src/security/DependencyValidator.bs.js'
import { generateSha256Checksum } from './securityTestUtils'

// Sprint 1 Day 4: Dependency Validation Tests
// T6 Mitigation - Spoofed Dependency Validation (Critical/P0)

describe('Dependency Validation - Checksum Verification', () => {
  it('verifies valid SHA-256 checksum for dependency', () => {
    const actualChecksum = generateSha256Checksum('dependency-content')

    const dependency = DependencyValidator.createDependency(
      'test-dep',
      '1.0.0',
      actualChecksum,
      undefined
    )

    const checksumVerifier = (actual: string, expected: string) => actual === expected

    const result = DependencyValidator.verifyChecksum(dependency, actualChecksum, checksumVerifier)
    expect(DependencyValidator.isChecksumValid(result)).toBe(true)
    expect(DependencyValidator.checksumResultToString(result)).toBe('ChecksumValid')
  })

  it('fails verification when checksum mismatches', () => {
    const expectedChecksum = generateSha256Checksum('expected-content')
    const actualChecksum = generateSha256Checksum('tampered-content')

    const dependency = DependencyValidator.createDependency(
      'test-dep',
      '1.0.0',
      expectedChecksum,
      undefined
    )

    const checksumVerifier = (actual: string, expected: string) => actual === expected

    const result = DependencyValidator.verifyChecksum(dependency, actualChecksum, checksumVerifier)
    expect(DependencyValidator.isChecksumValid(result)).toBe(false)
    expect(DependencyValidator.checksumResultToString(result)).toContain('ChecksumMismatch')
    expect(DependencyValidator.checksumResultToString(result)).toContain('Expected')
    expect(DependencyValidator.checksumResultToString(result)).toContain('Actual')
  })

  it('fails verification when checksum is missing', () => {
    const dependency = DependencyValidator.createDependency(
      'test-dep',
      '1.0.0',
      undefined,
      undefined
    )

    const checksumVerifier = () => true

    const result = DependencyValidator.verifyChecksum(dependency, 'some-checksum', checksumVerifier)
    expect(DependencyValidator.isChecksumValid(result)).toBe(false)
    expect(DependencyValidator.checksumResultToString(result)).toBe('MissingChecksum')
  })

  it('fails verification when checksum format is invalid (empty)', () => {
    const dependency = DependencyValidator.createDependency(
      'test-dep',
      '1.0.0',
      '',
      undefined
    )

    const checksumVerifier = () => true

    const result = DependencyValidator.verifyChecksum(dependency, 'some-checksum', checksumVerifier)
    expect(DependencyValidator.isChecksumValid(result)).toBe(false)
    expect(DependencyValidator.checksumResultToString(result)).toContain('InvalidChecksumFormat')
    expect(DependencyValidator.checksumResultToString(result)).toContain('checksum cannot be empty')
  })

  it('fails verification when checksum is not 64-character SHA-256 hash', () => {
    const dependency = DependencyValidator.createDependency(
      'test-dep',
      '1.0.0',
      'short-checksum',
      undefined
    )

    const checksumVerifier = () => true

    const result = DependencyValidator.verifyChecksum(dependency, 'some-checksum', checksumVerifier)
    expect(DependencyValidator.isChecksumValid(result)).toBe(false)
    expect(DependencyValidator.checksumResultToString(result)).toContain('InvalidChecksumFormat')
    expect(DependencyValidator.checksumResultToString(result)).toContain('64-character SHA-256 hash')
  })
})

describe('Dependency Validation - Config Bundle Verification', () => {
  it('verifies valid config bundle with signature and checksums', () => {
    const secretKey = 'bundle-secret-key'
    const checksum1 = generateSha256Checksum('dep1-content')
    const checksum2 = generateSha256Checksum('dep2-content')

    const dep1 = DependencyValidator.createDependency('dep1', '1.0.0', checksum1, undefined)
    const dep2 = DependencyValidator.createDependency('dep2', '2.0.0', checksum2, undefined)

    const bundle = DependencyValidator.createConfigBundle(
      'bundle-123',
      '1.0.0',
      [dep1, dep2],
      'valid-signature',
      undefined
    )

    const bundleSignatureVerifier = (_canonical: string, _key: string, sig: string) => {
      return sig === 'valid-signature'
    }

    const checksumVerifier = (actual: string, expected: string) => actual === expected

    const getActualChecksum = (depName: string) => {
      if (depName === 'dep1') return checksum1
      if (depName === 'dep2') return checksum2
      return ''
    }

    const result = DependencyValidator.validateConfigBundle(
      bundle,
      secretKey,
      getActualChecksum,
      checksumVerifier,
      bundleSignatureVerifier
    )

    expect(result.TAG).toBe('Ok')
    expect(result._0.bundleId).toBe('bundle-123')
  })

  it('fails verification when bundle signature mismatches', () => {
    const secretKey = 'bundle-secret-key'
    const checksum1 = generateSha256Checksum('dep1-content')

    const dep1 = DependencyValidator.createDependency('dep1', '1.0.0', checksum1, undefined)

    const bundle = DependencyValidator.createConfigBundle(
      'bundle-123',
      '1.0.0',
      [dep1],
      'invalid-signature',
      undefined
    )

    const bundleSignatureVerifier = (_canonical: string, _key: string, sig: string) => {
      return sig === 'valid-signature'
    }

    const checksumVerifier = (actual: string, expected: string) => actual === expected
    const getActualChecksum = () => checksum1

    const result = DependencyValidator.validateConfigBundle(
      bundle,
      secretKey,
      getActualChecksum,
      checksumVerifier,
      bundleSignatureVerifier
    )

    expect(result.TAG).toBe('Error')
    expect(result._0).toContain('Bundle signature mismatch')
  })

  it('fails verification when bundle signature is missing', () => {
    const secretKey = 'bundle-secret-key'
    const checksum1 = generateSha256Checksum('dep1-content')

    const dep1 = DependencyValidator.createDependency('dep1', '1.0.0', checksum1, undefined)

    const bundle = DependencyValidator.createConfigBundle(
      'bundle-123',
      '1.0.0',
      [dep1],
      undefined,
      undefined
    )

    const bundleSignatureVerifier = () => true
    const checksumVerifier = (actual: string, expected: string) => actual === expected
    const getActualChecksum = () => checksum1

    const result = DependencyValidator.validateConfigBundle(
      bundle,
      secretKey,
      getActualChecksum,
      checksumVerifier,
      bundleSignatureVerifier
    )

    expect(result.TAG).toBe('Error')
    expect(result._0).toContain('Bundle signature missing')
  })

  it('fails verification when dependency checksum is invalid', () => {
    const secretKey = 'bundle-secret-key'
    const checksum1 = generateSha256Checksum('dep1-content')
    const tamperedChecksum = generateSha256Checksum('tampered-content')

    const dep1 = DependencyValidator.createDependency('dep1', '1.0.0', checksum1, undefined)

    const bundle = DependencyValidator.createConfigBundle(
      'bundle-123',
      '1.0.0',
      [dep1],
      'valid-signature',
      undefined
    )

    const bundleSignatureVerifier = (_canonical: string, _key: string, sig: string) => {
      return sig === 'valid-signature'
    }

    const checksumVerifier = (actual: string, expected: string) => actual === expected
    const getActualChecksum = () => tamperedChecksum // Return tampered checksum

    const result = DependencyValidator.validateConfigBundle(
      bundle,
      secretKey,
      getActualChecksum,
      checksumVerifier,
      bundleSignatureVerifier
    )

    expect(result.TAG).toBe('Error')
    expect(result._0).toContain('Dependency validation failed')
    expect(result._0).toContain('dep1')
  })

  it('generates correct canonical string for bundle signing', () => {
    const checksum1 = generateSha256Checksum('dep1-content')
    const checksum2 = generateSha256Checksum('dep2-content')

    const dep1 = DependencyValidator.createDependency('dep1', '1.0.0', checksum1, undefined)
    const dep2 = DependencyValidator.createDependency('dep2', '2.0.0', checksum2, undefined)

    const bundle = DependencyValidator.createConfigBundle(
      'bundle-123',
      '1.0.0',
      [dep1, dep2],
      'signature',
      undefined
    )

    const canonical = DependencyValidator.bundleToCanonicalString(bundle)

    expect(canonical).toContain('bundle-123')
    expect(canonical).toContain('1.0.0')
    expect(canonical).toContain('dep1@1.0.0')
    expect(canonical).toContain('dep2@2.0.0')
    expect(canonical).toContain(checksum1)
    expect(canonical).toContain(checksum2)
  })
})
