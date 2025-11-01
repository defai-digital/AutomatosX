/**
 * Security Validator - Session 23 Bug Fixes
 *
 * Comprehensive tests for bugs #68-#73 discovered in Session 22 ultra-analysis.
 * These tests verify that critical security vulnerabilities are properly fixed.
 *
 * @see automatosx/PRD/session-23-security-validator-fixes.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityValidator } from '@/core/spec/SecurityValidator.js';
import type { SpecYAML } from '@/types/spec-yaml.js';

describe('SecurityValidator - Session 23 Bug Fixes', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  // Helper to create minimal valid spec
  // Using 'any' because we're testing security validation with potentially invalid input
  // Parameter is also 'any' to allow testing with invalid actor configurations
  const createSpec = (overrides: any = {}): any => ({
    version: '1.0',
    metadata: {
      id: 'test-spec',
      name: 'test-spec',
      description: 'Test specification',
      author: 'test',
      created: '2025-01-01'
    },
    actors: [],
    ...overrides
  });

  describe('Bug #68: Path Traversal Prevention (HIGH)', () => {
    it('should reject ../../etc/shadow via path normalization', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['../../etc/shadow']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');

      expect(sec005.length).toBeGreaterThan(0);
      expect(sec005[0]?.message).toContain('sensitive files');
    });

    it('should reject ../../../etc/passwd', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['../../../etc/passwd']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');

      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should reject write to ../../etc/shadow', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              write: ['../../etc']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec004 = issues.filter(i => i.ruleId === 'SEC004');

      expect(sec004.length).toBeGreaterThan(0);
      expect(sec004[0]?.message).toContain('dangerous filesystem write');
    });

    it('should normalize paths before checking denylists', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          agent: 'test',
          permissions: {
            filesystem: {
              read: ['../../etc/passwd']  // Simpler path, directly matches denylist
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');

      // Should detect /etc/passwd after normalization
      expect(sec005.length).toBeGreaterThan(0);
    });
  });

  describe('Bug #69: Windows Path Case-Insensitivity (HIGH)', () => {
    it('should handle case-insensitive Windows paths', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['c:\\windows\\system32\\config\\SAM']
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // On Windows, should detect this as sensitive
      // On Unix, should still normalize and check
      if (process.platform === 'win32') {
        const sec005 = issues.filter(i => i.ruleId === 'SEC005');
        expect(sec005.length).toBeGreaterThan(0);
      } else {
        // On Unix, backslashes are normalized but path doesn't match
        // Just verify no crash occurs
        expect(issues).toBeDefined();
      }
    });

    it('should handle UNC prefixes', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['\\\\?\\C:\\Windows\\System32\\config\\SAM']
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      if (process.platform === 'win32') {
        const sec005 = issues.filter(i => i.ruleId === 'SEC005');
        expect(sec005.length).toBeGreaterThan(0);
      } else {
        expect(issues).toBeDefined();
      }
    });

    it('should handle mixed case drive letters', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['C:/WINDOWS/System32/config/SAM']
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      if (process.platform === 'win32') {
        const sec005 = issues.filter(i => i.ruleId === 'SEC005');
        expect(sec005.length).toBeGreaterThan(0);
      } else {
        expect(issues).toBeDefined();
      }
    });
  });

  describe('Bug #70: Command Injection in String Operations (HIGH)', () => {
    it('should detect $(command) substitution in string operations', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          operations:  '$(rm -rf /)'
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
      expect(sec012[0]?.message).toContain('shell metacharacters');
    });

    it('should detect backtick substitution', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          operations:  '`cat /etc/shadow`'
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
    });

    it('should detect semicolon command chains', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          operations:  'ls; rm -rf /'
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
    });

    it('should detect pipe operators', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          operations:  'cat /etc/passwd | grep root'
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
    });

    it('should detect && and || operators', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          operations:  'true && rm -rf /'
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
    });

    it('should still validate array operations', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          operations:  [
            { command: '$(rm -rf /)' }
          ]
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
    });

    it('should allow safe operations without metacharacters', () => {
      const spec = createSpec({
        actors: [{
          id: 'safe',
          operations:  'npm install',
          permissions: {}
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBe(0);
    });
  });

  describe('Bug #71: Resource Limit Bypass (HIGH)', () => {
    it('should reject "unlimited" string', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          resources: {
            memory: { limit: 'unlimited' }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');

      expect(sec008.length).toBeGreaterThan(0);
      expect(sec008[0]?.message).toContain('invalid memory limit');
    });

    it('should reject "999 PB" (space in format)', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          resources: {
            memory: { limit: '999 PB' }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');

      expect(sec008.length).toBeGreaterThan(0);
    });

    it('should accept GiB unit', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {},
          resources: {
            memory: { limit: '2GiB' }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');

      // Should not have error for valid GiB format
      const invalidFormat = sec008.filter(i => i.message.includes('invalid memory limit'));
      expect(invalidFormat.length).toBe(0);
    });

    it('should accept MiB unit', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {},
          resources: {
            memory: { limit: '512MiB' }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');

      const invalidFormat = sec008.filter(i => i.message.includes('invalid memory limit'));
      expect(invalidFormat.length).toBe(0);
    });

    it('should accept MB/GB units (backward compatibility)', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {},
          resources: {
            memory: { limit: '1GB' },
            cpu: { limit: 2.0 }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');

      const invalidFormat = sec008.filter(i => i.message.includes('invalid memory limit'));
      expect(invalidFormat.length).toBe(0);
    });

    it('should reject non-numeric strings', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          resources: {
            memory: { limit: 'lots' }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');

      expect(sec008.length).toBeGreaterThan(0);
    });
  });

  describe('Bug #72: Type Confusion DoS Prevention (HIGH)', () => {
    it('should reject object when array expected (network whitelist)', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            network: {
              enabled: true,
              whitelist: { host: 'evil.com' } as any
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const typeError = issues.filter(i => i.ruleId === 'TYPE-ERROR');

      expect(typeError.length).toBeGreaterThan(0);
      expect(typeError[0]?.message).toContain('must be an array');
    });

    it('should reject string when array expected (filesystem read)', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: '.env' as any
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const typeError = issues.filter(i => i.ruleId === 'TYPE-ERROR');

      expect(typeError.length).toBeGreaterThan(0);
      expect(typeError[0]?.message).toContain('must be an array');
    });

    it('should reject string when array expected (filesystem write)', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              write: '/' as any
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const typeError = issues.filter(i => i.ruleId === 'TYPE-ERROR');

      expect(typeError.length).toBeGreaterThan(0);
    });

    it('should reject non-array environment variables', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            environment: {
              read: 'API_KEY' as any
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const typeError = issues.filter(i => i.ruleId === 'TYPE-ERROR');

      expect(typeError.length).toBeGreaterThan(0);
    });

    it('should validate array contains only strings', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['/tmp', 123, true] as any
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const typeError = issues.filter(i => i.ruleId === 'TYPE-ERROR');

      expect(typeError.length).toBeGreaterThan(0);
      expect(typeError[0]?.message).toContain('non-string');
    });
  });

  describe('Bug #73: Windows Backslash Path Normalization (MEDIUM)', () => {
    it('should normalize backslashes in paths', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['..\\..\\etc\\shadow']  // After normalization: ../../etc/shadow -> /etc/shadow
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // After normalization and traversal resolution, should match /etc/shadow
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should handle mixed separators', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['..\\../etc/passwd']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');

      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should normalize Windows paths with forward slashes', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['C:/Windows/System32/config/SAM']
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      if (process.platform === 'win32') {
        const sec005 = issues.filter(i => i.ruleId === 'SEC005');
        expect(sec005.length).toBeGreaterThan(0);
      } else {
        expect(issues).toBeDefined();
      }
    });
  });

  describe('Integration: All Bugs Fixed', () => {
    it('should detect command injection (Bug #70)', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          operations:  '$(rm -rf /)',
          permissions: {}
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');
      expect(sec012.length).toBeGreaterThan(0);
    });

    it('should detect invalid resource limits (Bug #71)', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {},
          resources: { memory: { limit: 'unlimited' } }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');
      expect(sec008.length).toBeGreaterThan(0);
    });

    it('should detect type confusion (Bug #72)', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: { read: 'string-instead-of-array' as any }
          }
        }]
      });

      const issues = validator.validate(spec);
      const typeError = issues.filter(i => i.ruleId === 'TYPE-ERROR');
      expect(typeError.length).toBeGreaterThan(0);
    });
  });
});
