/**
 * Refactor Contract Tests
 *
 * Validates refactor schemas and contract invariants.
 */

import { describe, it, expect } from 'vitest';
import {
  RefactorTypeSchema,
  RefactorImpactSchema,
  RefactorOpportunitySchema,
  RefactorScanRequestSchema,
  RefactorScanResultSchema,
  RefactorApplyRequestSchema,
  RefactorApplyResultSchema,
  validateRefactorScanRequest,
  safeValidateRefactorScanRequest,
} from '@automatosx/contracts';
// Simple UUID generation for tests
const uuid = () => crypto.randomUUID();

describe('Refactor Contract', () => {
  describe('RefactorTypeSchema', () => {
    it('should accept valid refactor types', () => {
      const types = [
        'extract-function',
        'extract-variable',
        'inline-function',
        'rename',
        'move',
        'simplify-conditional',
        'remove-duplication',
        'improve-types',
        'modernize-syntax',
        'optimize-imports',
        'other',
      ];
      for (const type of types) {
        const result = RefactorTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('RefactorImpactSchema', () => {
    it('should accept valid impact levels', () => {
      const impacts = ['breaking', 'major', 'minor', 'trivial'];
      for (const impact of impacts) {
        const result = RefactorImpactSchema.safeParse(impact);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('RefactorOpportunitySchema', () => {
    it('should validate an opportunity', () => {
      const opportunity = {
        opportunityId: uuid(),
        type: 'extract-function',
        impact: 'minor',
        title: 'Extract repeated logic',
        description: 'Extract repeated logic into function',
        rationale: 'Improves code reusability',
        filePath: '/src/utils.ts',
        lineStart: 10,
        lineEnd: 25,
        confidence: 0.9,
        detectedAt: new Date().toISOString(),
      };
      const result = RefactorOpportunitySchema.safeParse(opportunity);
      expect(result.success).toBe(true);
    });

    it('should require essential fields', () => {
      const opportunity = {
        opportunityId: uuid(),
        // missing type, impact, confidence, filePath
      };
      const result = RefactorOpportunitySchema.safeParse(opportunity);
      expect(result.success).toBe(false);
    });
  });

  describe('RefactorScanRequestSchema', () => {
    it('should validate minimal request', () => {
      const request = {
        paths: ['/src'],
      };
      const result = validateRefactorScanRequest(request);
      expect(result.paths).toEqual(['/src']);
    });

    it('should validate full request', () => {
      const request = {
        paths: ['/src', '/lib'],
        types: ['extract-function', 'rename'],
        maxImpact: 'major',
        minConfidence: 0.8,
        excludePatterns: ['**/*.test.ts'],
        maxFiles: 100,
      };
      const result = safeValidateRefactorScanRequest(request);
      expect(result.success).toBe(true);
    });

    it('should reject empty paths', () => {
      const request = { paths: [] };
      const result = safeValidateRefactorScanRequest(request);
      expect(result.success).toBe(false);
    });
  });

  describe('RefactorScanResultSchema', () => {
    it('should validate scan result', () => {
      const result = {
        scanId: uuid(),
        opportunities: [],
        filesScanned: 50,
        scanDurationMs: 3000,
        completedAt: new Date().toISOString(),
        summary: {
          total: 0,
          byType: {},
          byImpact: {},
        },
      };
      const parsed = RefactorScanResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('RefactorApplyRequestSchema', () => {
    it('should validate apply request', () => {
      const request = {
        opportunityId: uuid(),
        dryRun: true,
        createBackup: true,
      };
      const result = RefactorApplyRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('RefactorApplyResultSchema', () => {
    it('should validate apply result', () => {
      const result = {
        opportunityId: uuid(),
        applied: true,
        diff: '-old\n+new',
      };
      const parsed = RefactorApplyResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  /**
   * Invariant Tests
   * Tests for documented invariants in packages/contracts/src/refactor/v1/invariants.md
   */
  describe('INV-REF: Refactor Invariants', () => {
    describe('INV-REF-SCAN-001: Pattern Detection', () => {
      it('should validate all refactor types', () => {
        const types = [
          'extract-function',
          'extract-variable',
          'inline-function',
          'rename',
          'move',
          'simplify-conditional',
          'remove-duplication',
          'improve-types',
          'modernize-syntax',
          'optimize-imports',
          'other',
        ];
        for (const type of types) {
          const result = RefactorTypeSchema.safeParse(type);
          expect(result.success).toBe(true);
        }
      });

      it('should reject invalid refactor types', () => {
        const result = RefactorTypeSchema.safeParse('invalid-type');
        expect(result.success).toBe(false);
      });

      it('should include line information for detection', () => {
        const opportunity = {
          opportunityId: uuid(),
          type: 'extract-function',
          impact: 'minor',
          title: 'Test Opportunity',
          description: 'Test description',
          rationale: 'Test rationale',
          filePath: '/test.ts',
          lineStart: 10,
          lineEnd: 20,
          confidence: 0.9,
          detectedAt: new Date().toISOString(),
        };
        const result = RefactorOpportunitySchema.safeParse(opportunity);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.lineStart).toBeDefined();
          expect(result.data.lineEnd).toBeDefined();
        }
      });
    });

    describe('INV-REF-SCAN-002: Confidence Scoring', () => {
      it('should require confidence score', () => {
        const opportunity = {
          opportunityId: uuid(),
          type: 'rename',
          impact: 'trivial',
          title: 'Rename variable',
          description: 'Variable name is unclear',
          rationale: 'Better readability',
          filePath: '/src/index.ts',
          lineStart: 5,
          lineEnd: 5,
          confidence: 0.95,
          detectedAt: new Date().toISOString(),
        };
        const result = RefactorOpportunitySchema.safeParse(opportunity);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.confidence).toBe(0.95);
        }
      });

      it('should enforce confidence in 0-1 range', () => {
        const baseOpportunity = {
          opportunityId: uuid(),
          type: 'rename',
          impact: 'trivial',
          title: 'Test',
          description: 'Test',
          rationale: 'Test',
          filePath: '/test.ts',
          lineStart: 1,
          lineEnd: 1,
          detectedAt: new Date().toISOString(),
        };

        // Valid confidences
        for (const confidence of [0, 0.5, 1]) {
          const result = RefactorOpportunitySchema.safeParse({ ...baseOpportunity, confidence });
          expect(result.success).toBe(true);
        }

        // Invalid confidence
        const invalidResult = RefactorOpportunitySchema.safeParse({ ...baseOpportunity, confidence: 1.5 });
        expect(invalidResult.success).toBe(false);
      });

      it('scan request should support minConfidence filter', () => {
        const request = {
          paths: ['/src'],
          minConfidence: 0.8,
        };
        const result = RefactorScanRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });
    });

    describe('INV-REF-APPLY-001: Semantic Preservation', () => {
      it('apply result should indicate whether applied', () => {
        const result = {
          opportunityId: uuid(),
          applied: true,
          diff: '-old code\n+new code',
        };
        const parsed = RefactorApplyResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      });

      it('apply result should track test status', () => {
        const result = {
          opportunityId: uuid(),
          applied: true,
          diff: '-old code\n+new code',
          testsRun: true,
          testsPassed: true,
        };
        const parsed = RefactorApplyResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
      });
    });

    describe('INV-REF-APPLY-002: AST Validity', () => {
      it('apply request should support dry run', () => {
        const request = {
          opportunityId: uuid(),
          dryRun: true,
        };
        const result = RefactorApplyRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('apply result should include diff preview', () => {
        const result = {
          opportunityId: uuid(),
          applied: false,
          diff: '-function old() {}\n+function refactored() {}',
        };
        const parsed = RefactorApplyResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.diff).toBeDefined();
        }
      });
    });

    describe('INV-REF-APPLY-003: Test Preservation', () => {
      it('apply request should support runTests option', () => {
        const request = {
          opportunityId: uuid(),
          dryRun: false,
          runTests: true,
        };
        const result = RefactorApplyRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });
    });

    describe('INV-REF-IMPACT-001: Impact Assessment', () => {
      it('should validate all impact levels', () => {
        const impacts = ['breaking', 'major', 'minor', 'trivial'];
        for (const impact of impacts) {
          const result = RefactorImpactSchema.safeParse(impact);
          expect(result.success).toBe(true);
        }
      });

      it('should reject invalid impact levels', () => {
        const result = RefactorImpactSchema.safeParse('critical');
        expect(result.success).toBe(false);
      });

      it('opportunity must include impact level', () => {
        const opportunity = {
          opportunityId: uuid(),
          type: 'move',
          impact: 'major',
          title: 'Move function to another module',
          description: 'Function is in wrong location',
          rationale: 'Better organization',
          filePath: '/src/utils.ts',
          lineStart: 50,
          lineEnd: 80,
          confidence: 0.85,
          detectedAt: new Date().toISOString(),
        };
        const result = RefactorOpportunitySchema.safeParse(opportunity);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.impact).toBe('major');
        }
      });

      it('scan request should support maxImpact filter', () => {
        const request = {
          paths: ['/src'],
          maxImpact: 'minor',
        };
        const result = RefactorScanRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
      });

      it('scan result should summarize by impact', () => {
        const result = {
          scanId: uuid(),
          opportunities: [],
          filesScanned: 20,
          scanDurationMs: 2000,
          completedAt: new Date().toISOString(),
          summary: {
            total: 5,
            byType: { 'extract-function': 3, rename: 2 },
            byImpact: { minor: 3, trivial: 2 },
          },
        };
        const parsed = RefactorScanResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.summary.byImpact).toBeDefined();
        }
      });
    });
  });
});
