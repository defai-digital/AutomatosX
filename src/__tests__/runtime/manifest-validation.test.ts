import { describe, expect, it } from 'vitest'
import * as ManifestValidator from '../../../packages/rescript-core/src/security/ManifestValidator.bs.js'
import { createHmacSha256Verifier } from './securityTestUtils'

// Sprint 1 Day 4: Manifest Validation Tests
// T1 Mitigation - Malicious Manifest Smuggling (Critical/P0)

describe('Manifest Validation - Schema Validation', () => {
  it('passes validation for valid manifest with all required fields', () => {
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '1.0.0',
      ['dep1', 'dep2'],
      undefined,
      undefined,
      undefined
    )

    const result = ManifestValidator.validateSchema(manifest)
    expect(ManifestValidator.isValid(result)).toBe(true)
    expect(ManifestValidator.validationResultToString(result)).toBe('Valid')
  })

  it('fails validation when taskId is empty', () => {
    const manifest = ManifestValidator.createManifest(
      '',
      '1.0.0',
      ['dep1'],
      undefined,
      undefined,
      undefined
    )

    const result = ManifestValidator.validateSchema(manifest)
    expect(ManifestValidator.isValid(result)).toBe(false)
    expect(ManifestValidator.validationResultToString(result)).toContain('taskId cannot be empty')
  })

  it('fails validation when manifestVersion is empty', () => {
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '',
      ['dep1'],
      undefined,
      undefined,
      undefined
    )

    const result = ManifestValidator.validateSchema(manifest)
    expect(ManifestValidator.isValid(result)).toBe(false)
    expect(ManifestValidator.validationResultToString(result)).toContain('manifestVersion cannot be empty')
  })

  it('fails validation when dependencies array is empty', () => {
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '1.0.0',
      [],
      undefined,
      undefined,
      undefined
    )

    const result = ManifestValidator.validateSchema(manifest)
    expect(ManifestValidator.isValid(result)).toBe(false)
    expect(ManifestValidator.validationResultToString(result)).toContain('dependencies array cannot be empty')
  })

  it('fails validation when dependencies contain empty strings', () => {
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '1.0.0',
      ['dep1', '', 'dep2'],
      undefined,
      undefined,
      undefined
    )

    const result = ManifestValidator.validateSchema(manifest)
    expect(ManifestValidator.isValid(result)).toBe(false)
    expect(ManifestValidator.validationResultToString(result)).toContain('dependencies cannot contain empty strings')
  })
})

describe('Manifest Validation - Signature Verification', () => {
  it('verifies valid HMAC-SHA256 signature', () => {
    const secretKey = 'test-secret-key-123'
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '1.0.0',
      ['dep1', 'dep2'],
      undefined,
      'valid-signature',
      undefined
    )

    // Mock HMAC verifier that always returns true for 'valid-signature'
    const hmacVerifier = (canonical: string, key: string, sig: string) => {
      return sig === 'valid-signature' && key === secretKey
    }

    const result = ManifestValidator.verifySignature(manifest, secretKey, hmacVerifier)
    expect(ManifestValidator.isVerified(result)).toBe(true)
    expect(ManifestValidator.signatureResultToString(result)).toBe('Verified')
  })

  it('fails verification when signature mismatches', () => {
    const secretKey = 'test-secret-key-123'
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '1.0.0',
      ['dep1', 'dep2'],
      undefined,
      'invalid-signature',
      undefined
    )

    // Mock HMAC verifier that only accepts 'valid-signature'
    const hmacVerifier = (_canonical: string, _key: string, sig: string) => {
      return sig === 'valid-signature'
    }

    const result = ManifestValidator.verifySignature(manifest, secretKey, hmacVerifier)
    expect(ManifestValidator.isVerified(result)).toBe(false)
    expect(ManifestValidator.signatureResultToString(result)).toBe('SignatureMismatch')
  })

  it('fails verification when signature is missing', () => {
    const secretKey = 'test-secret-key-123'
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '1.0.0',
      ['dep1', 'dep2'],
      undefined,
      undefined,
      undefined
    )

    const hmacVerifier = () => true

    const result = ManifestValidator.verifySignature(manifest, secretKey, hmacVerifier)
    expect(ManifestValidator.isVerified(result)).toBe(false)
    expect(ManifestValidator.signatureResultToString(result)).toBe('MissingSignature')
  })

  it('fails verification when signature is empty string', () => {
    const secretKey = 'test-secret-key-123'
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '1.0.0',
      ['dep1', 'dep2'],
      undefined,
      '',
      undefined
    )

    const hmacVerifier = () => true

    const result = ManifestValidator.verifySignature(manifest, secretKey, hmacVerifier)
    expect(ManifestValidator.isVerified(result)).toBe(false)
    expect(ManifestValidator.signatureResultToString(result)).toContain('InvalidFormat')
    expect(ManifestValidator.signatureResultToString(result)).toContain('signature cannot be empty')
  })

  it('performs combined validation with schema and signature checks', () => {
    const secretKey = 'test-secret-key-123'
    const manifest = ManifestValidator.createManifest(
      'task-123',
      '1.0.0',
      ['dep1', 'dep2'],
      undefined,
      'valid-signature',
      undefined
    )

    const hmacVerifier = (_canonical: string, _key: string, sig: string) => {
      return sig === 'valid-signature'
    }

    const result = ManifestValidator.validateManifest(manifest, secretKey, hmacVerifier)

    expect(result.TAG).toBe('Ok')
    expect(result._0.taskId).toBe('task-123')
  })
})
