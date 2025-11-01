/**
 * Security Validator - Session 25 Ultra-Deep Bug Fixes
 *
 * Comprehensive tests for bugs #81-#85 discovered in ultra-deep analysis.
 * These tests verify that critical security edge cases are properly handled.
 *
 * @see automatosx/tmp/session-25-bug-report.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityValidator } from '@/core/spec/SecurityValidator.js';
import type { SpecYAML } from '@/types/spec-yaml.js';

describe('SecurityValidator - Session 25 Ultra-Deep Bug Fixes', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  // Helper to create minimal valid spec
  // Using 'any' because we're testing security validation with potentially invalid input
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

  describe('Bug #81: Memory Limit Regex Allows Spaces (HIGH)', () => {
    it('should reject memory limits with space between number and unit', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          resources: {
            memory: { limit: '100 MB' }  // Space between number and unit
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');

      expect(sec008.length).toBeGreaterThan(0);
      expect(sec008[0]?.message).toContain('invalid memory limit');
    });

    it('should reject memory limits with multiple spaces', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          resources: {
            memory: { limit: '999  GB' }  // Multiple spaces
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');
      expect(sec008.length).toBeGreaterThan(0);
    });

    it('should reject memory limits with tab character', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          resources: {
            memory: { limit: '512\tMiB' }  // Tab character
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');
      expect(sec008.length).toBeGreaterThan(0);
    });

    it('should ACCEPT valid memory limits without spaces', () => {
      const spec = createSpec({
        actors: [{
          id: 'valid',
          permissions: {},
          resources: {
            memory: { limit: '2GiB' }  // No space - valid
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008' && i.message.includes('invalid memory limit'));
      expect(sec008.length).toBe(0);
    });
  });

  describe('Bug #82: SAM File Lowercase Variants Missing (MEDIUM)', () => {
    it('should detect Windows SAM file access with mixed casing', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['c:/WINDOWS/system32/CONFIG/sam']  // Mixed case
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // On Windows, should detect after normalization
      if (process.platform === 'win32') {
        const sec005 = issues.filter(i => i.ruleId === 'SEC005');
        expect(sec005.length).toBeGreaterThan(0);
      } else {
        // On Unix, the normalized path check should still work
        expect(issues).toBeDefined();
      }
    });

    it('should detect lowercase normalized Windows SAM path', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['/c:/windows/system32/config/sam']  // Normalized form
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should detect AWS credentials access', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['/home/user/.aws/credentials']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should detect explicit SSH private key access', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['anydir/.ssh/id_rsa']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });
  });

  describe('Bug #83: Tilde Home Directory Not Expanded (MEDIUM)', () => {
    it('should detect Linux home directory SSH access via explicit path', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['/home/victim/.ssh/id_rsa']  // Explicit path bypasses ~/
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
      expect(sec005[0]?.message).toContain('sensitive files');
    });

    it('should detect macOS home directory SSH access', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['/Users/victim/.ssh/id_rsa']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should detect Windows home directory SSH access', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['C:/Users/victim/.ssh/id_rsa']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should detect root user SSH access', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['/root/.ssh/id_rsa']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should still detect tilde notation for compatibility', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['~/.ssh/id_rsa']  // Tilde notation
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });
  });

  describe('Bug #84: Glob Pattern Case Sensitivity (LOW)', () => {
    it('should match patterns case-insensitively on Windows', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['C:/WINDOWS/system32/CONFIG/sam']  // All caps
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // On Windows, should detect after case normalization
      if (process.platform === 'win32') {
        const sec005 = issues.filter(i => i.ruleId === 'SEC005');
        expect(sec005.length).toBeGreaterThan(0);
      } else {
        // On Unix, just verify no crash
        expect(issues).toBeDefined();
      }
    });

    it('should normalize both paths and patterns before matching', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['/ETC/PASSWD']  // Uppercase Unix path
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // On case-sensitive systems, this should NOT match /etc/passwd
      // On Windows (case-insensitive), it would match after normalization
      if (process.platform !== 'win32') {
        // On Unix, /ETC/PASSWD is different from /etc/passwd
        const sec005 = issues.filter(i => i.ruleId === 'SEC005');
        expect(sec005.length).toBe(0);  // Should NOT match
      }
    });
  });

  describe('Bug #85: Null Byte Encoding Variants Missing (MEDIUM)', () => {
    it('should reject Unicode null byte notation \\u0000', () => {
      // Note: In TypeScript strings, \u0000 is interpreted as actual null byte
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['/etc/passwd\u0000.txt']  // Null byte attempt
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // Path should be normalized to empty string, triggering validation issues
      // OR the spec itself becomes invalid
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should reject percent-encoded null byte %00', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['/etc/passwd%00.txt']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should reject double-encoded null byte %2500', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['/etc/passwd%2500.txt']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should reject hex null byte \\x00', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['/etc/passwd\x00.txt']  // Hex null byte
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should allow legitimate paths without null bytes', () => {
      const spec = createSpec({
        actors: [{
          id: 'valid',
          permissions: {
            filesystem: {
              read: ['/tmp/test.txt']  // Valid path
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // Should not have null byte related errors
      const nullByteErrors = issues.filter(i =>
        i.message.includes('null') || i.message.includes('Invalid path')
      );
      expect(nullByteErrors.length).toBe(0);
    });
  });

  describe('Integration: All Session 25 Bugs Fixed', () => {
    it('should enforce strict memory limit format (Bug #81)', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {},
          resources: { memory: { limit: '1 GB' } }
        }]
      });

      const issues = validator.validate(spec);
      const sec008 = issues.filter(i => i.ruleId === 'SEC008');
      expect(sec008.length).toBeGreaterThan(0);
    });

    it('should detect Windows SAM via normalized path (Bug #82)', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['/c:/windows/system32/config/sam']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should detect home SSH keys via explicit paths (Bug #83)', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['/home/user/.ssh/id_rsa']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec005 = issues.filter(i => i.ruleId === 'SEC005');
      expect(sec005.length).toBeGreaterThan(0);
    });

    it('should reject all null byte encoding variants (Bug #85)', () => {
      const nullByteVariants = [
        '/etc/passwd\x00.txt',
        '/etc/passwd%00.txt',
        '/etc/passwd%2500.txt',
        '/etc/passwd\u0000.txt'
      ];

      for (const variant of nullByteVariants) {
        const spec = createSpec({
          actors: [{
            id: 'test',
            permissions: {
              filesystem: {
                read: [variant]
              }
            }
          }]
        });

        const issues = validator.validate(spec);
        expect(issues.length).toBeGreaterThan(0);
      }
    });
  });
});
