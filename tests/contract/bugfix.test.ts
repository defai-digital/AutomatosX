/**
 * Bugfix Contract Tests
 *
 * Validates bugfix schemas and contract invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  BugSeveritySchema,
  BugCategorySchema,
  DetectedBugSchema,
  BugScanRequestSchema,
  BugScanResultSchema,
  BugFixRequestSchema,
  BugFixResultSchema,
  validateBugScanRequest,
  safeValidateBugScanRequest,
} from '@automatosx/contracts';

describe('Bugfix Contract', () => {
  describe('BugSeveritySchema', () => {
    it('should accept valid severities', () => {
      const severities = ['critical', 'high', 'medium', 'low', 'info'];
      for (const severity of severities) {
        const result = BugSeveritySchema.safeParse(severity);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid severity', () => {
      expect(BugSeveritySchema.safeParse('urgent').success).toBe(false);
    });
  });

  describe('BugCategorySchema', () => {
    it('should accept valid categories', () => {
      const categories = [
        'resource-leak',
        'memory-leak',
        'timer-leak',
        'null-reference',
        'type-error',
        'logic-error',
        'concurrency',
        'security',
        'performance',
        'other',
      ];
      for (const category of categories) {
        const result = BugCategorySchema.safeParse(category);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('DetectedBugSchema', () => {
    it('should validate a detected bug', () => {
      const bug = {
        bugId: '550e8400-e29b-41d4-a716-446655440000',
        category: 'resource-leak',
        severity: 'high',
        title: 'Unclosed file handle',
        description: 'File handle is not closed after use',
        filePath: '/src/file.ts',
        confidence: 0.9,
        detectedAt: new Date().toISOString(),
      };
      const result = DetectedBugSchema.safeParse(bug);
      expect(result.success).toBe(true);
    });

    it('should validate bug with optional fields', () => {
      const bug = {
        bugId: '550e8400-e29b-41d4-a716-446655440000',
        category: 'null-reference',
        severity: 'medium',
        title: 'Potential null dereference',
        description: 'Object may be null',
        filePath: '/src/utils.ts',
        lineNumber: 42,
        columnNumber: 10,
        codeSnippet: 'const x = obj.value;',
        suggestedFix: 'Add null check',
        confidence: 0.85,
        detectedAt: new Date().toISOString(),
      };
      const result = DetectedBugSchema.safeParse(bug);
      expect(result.success).toBe(true);
    });
  });

  describe('BugScanRequestSchema', () => {
    it('should validate minimal scan request', () => {
      const request = {
        paths: ['/src'],
      };
      const result = validateBugScanRequest(request);
      expect(result.paths).toEqual(['/src']);
    });

    it('should validate full scan request', () => {
      const request = {
        paths: ['/src', '/lib'],
        categories: ['resource-leak', 'null-reference'],
        minSeverity: 'medium',
        excludePatterns: ['**/node_modules/**'],
        maxFiles: 50,
        useAst: true,
      };
      const result = BugScanRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject empty paths', () => {
      const request = { paths: [] };
      const result = safeValidateBugScanRequest(request);
      expect(result.success).toBe(false);
    });
  });

  describe('BugScanResultSchema', () => {
    it('should validate scan result', () => {
      const result = {
        scanId: '550e8400-e29b-41d4-a716-446655440000',
        bugs: [],
        filesScanned: 100,
        scanDurationMs: 5000,
        completedAt: new Date().toISOString(),
        summary: {
          total: 0,
          bySeverity: {},
          byCategory: {},
        },
      };
      const parsed = BugScanResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('BugFixRequestSchema', () => {
    it('should validate fix request', () => {
      const request = {
        bugId: '550e8400-e29b-41d4-a716-446655440000',
      };
      const result = BugFixRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('BugFixResultSchema', () => {
    it('should validate successful fix result', () => {
      const result = {
        bugId: '550e8400-e29b-41d4-a716-446655440000',
        fixed: true,
        applied: true,
        fixedAt: new Date().toISOString(),
      };
      const parsed = BugFixResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  /**
   * Invariant Tests
   * Tests for documented invariants in packages/contracts/src/bugfix/v1/invariants.md
   */
  describe('INV-BUG: Bugfix Invariants', () => {
    describe('INV-BUG-SCAN-001: Deterministic Results', () => {
      it('should require confidence score on bugs', () => {
        const bug = {
          bugId: '550e8400-e29b-41d4-a716-446655440000',
          category: 'type-error',
          severity: 'low',
          title: 'Test',
          description: 'Test description',
          filePath: '/test.ts',
          confidence: 0.5,
          detectedAt: new Date().toISOString(),
        };
        const result = DetectedBugSchema.safeParse(bug);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.confidence).toBeDefined();
        }
      });

      it('should enforce confidence within 0-1 range', () => {
        const validConfidences = [0, 0.5, 1];
        for (const confidence of validConfidences) {
          const bug = {
            bugId: '550e8400-e29b-41d4-a716-446655440000',
            category: 'type-error',
            severity: 'low',
            title: 'Test',
            description: 'Test description',
            filePath: '/test.ts',
            confidence,
            detectedAt: new Date().toISOString(),
          };
          const result = DetectedBugSchema.safeParse(bug);
          expect(result.success).toBe(true);
        }
      });

      it('should reject confidence outside 0-1 range', () => {
        const bug = {
          bugId: '550e8400-e29b-41d4-a716-446655440000',
          category: 'type-error',
          severity: 'low',
          title: 'Test',
          description: 'Test description',
          filePath: '/test.ts',
          confidence: 1.5,
          detectedAt: new Date().toISOString(),
        };
        const result = DetectedBugSchema.safeParse(bug);
        expect(result.success).toBe(false);
      });

      it('scan result should include deterministic fields', () => {
        const result = {
          scanId: '550e8400-e29b-41d4-a716-446655440000',
          bugs: [
            {
              bugId: '550e8400-e29b-41d4-a716-446655440001',
              category: 'null-reference',
              severity: 'high',
              title: 'Null check',
              description: 'May be null',
              filePath: '/src/file.ts',
              confidence: 0.9,
              detectedAt: new Date().toISOString(),
            },
          ],
          filesScanned: 10,
          scanDurationMs: 1000,
          completedAt: new Date().toISOString(),
          summary: { total: 1, bySeverity: { high: 1 }, byCategory: { 'null-reference': 1 } },
        };
        const parsed = BugScanResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      });
    });

    describe('INV-BUG-SCAN-002: No False Modifications', () => {
      it('scan request should be read-only (no write flags)', () => {
        const request = {
          paths: ['/src'],
          categories: ['resource-leak'],
          minSeverity: 'medium',
        };
        const result = BugScanRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
        // Verify no modification-related fields
        if (result.success) {
          expect(result.data).not.toHaveProperty('autoFix');
          expect(result.data).not.toHaveProperty('apply');
        }
      });
    });

    describe('INV-BUG-SCAN-003: Complete Coverage', () => {
      it('should accept multiple paths for scanning', () => {
        const request = {
          paths: ['/src', '/lib', '/utils'],
        };
        const result = BugScanRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('should support exclude patterns', () => {
        const request = {
          paths: ['/src'],
          excludePatterns: ['**/node_modules/**', '**/*.test.ts'],
        };
        const result = BugScanRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('should track files scanned count', () => {
        const result = {
          scanId: '550e8400-e29b-41d4-a716-446655440000',
          bugs: [],
          filesScanned: 150,
          scanDurationMs: 5000,
          completedAt: new Date().toISOString(),
          summary: { total: 0, bySeverity: {}, byCategory: {} },
        };
        const parsed = BugScanResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.filesScanned).toBe(150);
        }
      });
    });

    describe('INV-BUG-FIX-001: Backup Before Fix', () => {
      it('fix request should support backup flag', () => {
        const request = {
          bugId: '550e8400-e29b-41d4-a716-446655440000',
          createBackup: true,
        };
        const result = BugFixRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('fix result should track backup path when created', () => {
        const result = {
          bugId: '550e8400-e29b-41d4-a716-446655440000',
          fixed: true,
          applied: true,
          backupPath: '/backups/file.ts.bak',
          fixedAt: new Date().toISOString(),
        };
        const parsed = BugFixResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      });
    });

    describe('INV-BUG-FIX-002: Atomic Application', () => {
      it('fix result should indicate success/failure state', () => {
        const successResult = {
          bugId: '550e8400-e29b-41d4-a716-446655440000',
          fixed: true,
          applied: true,
          fixedAt: new Date().toISOString(),
        };
        expect(BugFixResultSchema.safeParse(successResult).success).toBe(true);

        // error field is a string, not an object
        const failureResult = {
          bugId: '550e8400-e29b-41d4-a716-446655440001',
          fixed: false,
          applied: false,
          error: 'Could not apply fix: syntax error at line 42',
        };
        expect(BugFixResultSchema.safeParse(failureResult).success).toBe(true);
      });
    });

    describe('INV-BUG-FIX-003: Dry Run Support', () => {
      it('fix request should support dry run mode', () => {
        const request = {
          bugId: '550e8400-e29b-41d4-a716-446655440000',
          dryRun: true,
        };
        const result = BugFixRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('fix result should include diff preview', () => {
        const result = {
          bugId: '550e8400-e29b-41d4-a716-446655440000',
          fixed: true,
          applied: false,
          diff: '-const x = null;\n+const x = undefined;',
        };
        const parsed = BugFixResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.diff).toBeDefined();
        }
      });

      it('autoApply flag should control application', () => {
        const request = {
          bugId: '550e8400-e29b-41d4-a716-446655440000',
          dryRun: false,
          autoApply: true,
        };
        const result = BugFixRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });
    });
  });
});
