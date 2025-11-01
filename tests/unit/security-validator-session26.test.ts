/**
 * Session 26: Ultra-Deep Bug Hunt Tests
 *
 * Tests for bugs #87-#90 discovered in ultra-deep security analysis post-Session 25.
 * Total: 8 test cases
 *
 * Bugs covered:
 * - Bug #87: Missing shell metacharacters (input redirection, variable expansion, carriage return)
 * - Bug #88: Windows dangerous path patterns not normalized
 * - Bug #89: Empty path normalizes to root directory
 * - Bug #90: Symbolic link bypass warning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityValidator } from '../../src/core/spec/SecurityValidator.js';

describe('SecurityValidator - Session 26 Ultra-Deep Bug Fixes', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  // Helper to create minimal valid spec
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

  describe('Bug #87: Missing Shell Metacharacters (MEDIUM)', () => {
    it('should reject input redirection operator <', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          operations: [
            { command: 'cat < /etc/passwd' }
          ]
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
      expect(sec012[0]?.message).toContain('shell metacharacters');
    });

    it('should reject variable expansion syntax ${...}', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          operations: [
            { command: 'cat ${SECRET_PATH}' }
          ]
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
      expect(sec012[0]?.message).toContain('shell metacharacters');
    });

    it('should reject carriage return injection \\r', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {},
          operations: [
            { command: 'echo "safe\rmalicious"' }
          ]
        }]
      });

      const issues = validator.validate(spec);
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');

      expect(sec012.length).toBeGreaterThan(0);
      expect(sec012[0]?.message).toContain('shell metacharacters');
    });
  });

  describe('Bug #88: Windows Dangerous Path Patterns (MEDIUM)', () => {
    it('should detect normalized Windows system32 write access', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              write: ['C:/Windows/System32/malware.dll']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec004 = issues.filter(i => i.ruleId === 'SEC004');

      // Should detect dangerous write path even with normalized Windows path
      expect(sec004.length).toBeGreaterThan(0);
      expect(sec004[0]?.message).toContain('dangerous filesystem write');
    });

    it('should detect Windows Program Files write access', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              write: ['C:/Program Files/MyApp/malware.exe']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec004 = issues.filter(i => i.ruleId === 'SEC004');

      expect(sec004.length).toBeGreaterThan(0);
      expect(sec004[0]?.message).toContain('dangerous filesystem write');
    });
  });

  describe('Bug #89: Empty Path Normalization (MEDIUM)', () => {
    it('should reject empty string path', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['']  // Empty string - would normalize to '/'
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // Empty path should be flagged (either as invalid or as dangerous root access)
      // Check for any security issues related to the empty path
      const secIssues = issues.filter(i =>
        i.severity === 'error' || i.severity === 'warning'
      );

      expect(secIssues.length).toBeGreaterThan(0);
    });

    it('should reject whitespace-only path', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: ['   ']  // Whitespace only - would normalize to '/'
            }
          }
        }]
      });

      const issues = validator.validate(spec);

      // Whitespace-only path should be flagged
      const secIssues = issues.filter(i =>
        i.severity === 'error' || i.severity === 'warning'
      );

      expect(secIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Bug #90: Symbolic Link Bypass Warning (HIGH)', () => {
    it('should warn about symbolic link bypass risk when filesystem access is granted', () => {
      const spec = createSpec({
        actors: [{
          id: 'test',
          permissions: {
            filesystem: {
              read: ['/tmp/safe-dir/data.txt']
            }
          }
        }]
      });

      const issues = validator.validate(spec);
      const sec013 = issues.filter(i => i.ruleId === 'SEC013');

      expect(sec013.length).toBeGreaterThan(0);
      expect(sec013[0]?.message).toContain('symbolic link');
      expect(sec013[0]?.severity).toBe('info');
    });
  });

  describe('Integration: All Session 26 Bugs Combined', () => {
    it('should detect multiple security issues in one spec', () => {
      const spec = createSpec({
        actors: [{
          id: 'malicious',
          permissions: {
            filesystem: {
              read: [''],  // Bug #89: Empty path
              write: ['C:/Windows/System32/test.dll']  // Bug #88: Windows dangerous path
            }
          },
          operations: [
            { command: 'cat ${SECRET}' },  // Bug #87: Variable expansion
            { command: 'process < input.txt' }  // Bug #87: Input redirection
          ]
        }]
      });

      const issues = validator.validate(spec);

      // Should have:
      // - SEC004: Dangerous write path (Bug #88)
      // - SEC005 or error: Empty read path (Bug #89)
      // - SEC012: Shell metacharacters (Bug #87) - 2 operations
      // - SEC013: Symlink warning (Bug #90)

      const sec004 = issues.filter(i => i.ruleId === 'SEC004');
      const sec012 = issues.filter(i => i.ruleId === 'SEC012');
      const sec013 = issues.filter(i => i.ruleId === 'SEC013');

      expect(sec004.length).toBeGreaterThan(0);  // Dangerous write
      expect(sec012.length).toBeGreaterThanOrEqual(2);  // Both shell commands
      expect(sec013.length).toBeGreaterThan(0);  // Symlink warning
    });
  });
});
