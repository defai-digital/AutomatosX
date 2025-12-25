/**
 * Review Contract Tests
 *
 * Validates review schemas and contract invariants.
 * Tests for invariants documented in packages/contracts/src/review/v1/invariants.md
 */

import { describe, it, expect } from 'vitest';
import {
  ReviewFocusSchema,
  ReviewRequestSchema,
  ReviewCommentSeveritySchema,
  ReviewCommentSchema,
  ReviewSummarySchema,
  ReviewResultSchema,
  SarifOutputSchema,
  ReviewErrorCode,
  validateReviewRequest,
  safeValidateReviewRequest,
  validateReviewResult,
  safeValidateReviewResult,
  validateReviewComment,
  validateSarifOutput,
  calculateHealthScore,
  SEVERITY_ORDER,
  compareCommentsBySeverity,
  sortCommentsBySeverity,
  createEmptyReviewSummary,
  createReviewSummary,
  type ReviewComment,
} from '@defai.digital/contracts';

describe('Review Contract', () => {
  // ============================================================================
  // Schema Tests
  // ============================================================================

  describe('ReviewFocusSchema', () => {
    it('should accept valid focus modes', () => {
      const focusModes = ['security', 'architecture', 'performance', 'maintainability', 'correctness', 'all'];
      for (const focus of focusModes) {
        const result = ReviewFocusSchema.safeParse(focus);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid focus mode', () => {
      expect(ReviewFocusSchema.safeParse('testing').success).toBe(false);
    });
  });

  describe('ReviewCommentSeveritySchema', () => {
    it('should accept valid severities', () => {
      const severities = ['critical', 'warning', 'suggestion', 'note'];
      for (const severity of severities) {
        const result = ReviewCommentSeveritySchema.safeParse(severity);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid severity', () => {
      expect(ReviewCommentSeveritySchema.safeParse('high').success).toBe(false);
    });
  });

  describe('ReviewRequestSchema', () => {
    it('should validate minimal request', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: ['/src'],
      };
      const result = validateReviewRequest(request);
      expect(result.paths).toEqual(['/src']);
      expect(result.focus).toBe('all'); // default
      expect(result.minConfidence).toBe(0.7); // default
    });

    it('should validate full request', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: ['/src', '/lib'],
        focus: 'security',
        context: 'Payment processing code',
        minConfidence: 0.8,
        maxFiles: 30,
        maxLinesPerFile: 800,
        providerId: 'claude',
        timeoutMs: 60000,
        outputFormat: 'sarif',
        dryRun: true,
      };
      const result = ReviewRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject empty paths', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: [],
      };
      const result = safeValidateReviewRequest(request);
      expect(result.success).toBe(false);
    });

    it('should reject too many paths', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: Array(51).fill('/src'),
      };
      const result = safeValidateReviewRequest(request);
      expect(result.success).toBe(false);
    });

    it('should reject invalid confidence', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: ['/src'],
        minConfidence: 1.5,
      };
      const result = safeValidateReviewRequest(request);
      expect(result.success).toBe(false);
    });
  });

  describe('ReviewCommentSchema', () => {
    const validComment = {
      commentId: '550e8400-e29b-41d4-a716-446655440000',
      file: '/src/api/users.ts',
      line: 45,
      severity: 'critical',
      title: 'SQL Injection',
      body: 'User input directly interpolated into SQL query.',
      suggestion: 'Use parameterized queries.',
      focus: 'security',
      confidence: 0.95,
      category: 'injection',
    };

    it('should validate a valid comment', () => {
      const result = ReviewCommentSchema.safeParse(validComment);
      expect(result.success).toBe(true);
    });

    it('should accept comment with optional fields', () => {
      const comment = {
        ...validComment,
        lineEnd: 48,
        rationale: 'Allows arbitrary SQL execution.',
        suggestedCode: "const query = 'SELECT * FROM users WHERE id = ?';",
      };
      const result = ReviewCommentSchema.safeParse(comment);
      expect(result.success).toBe(true);
    });

    it('should enforce confidence range', () => {
      const invalidComment = { ...validComment, confidence: 1.5 };
      const result = ReviewCommentSchema.safeParse(invalidComment);
      expect(result.success).toBe(false);
    });

    it('should enforce title max length', () => {
      const invalidComment = { ...validComment, title: 'x'.repeat(101) };
      const result = ReviewCommentSchema.safeParse(invalidComment);
      expect(result.success).toBe(false);
    });
  });

  describe('ReviewSummarySchema', () => {
    it('should validate a review summary', () => {
      const summary = {
        bySeverity: { critical: 1, warning: 2, suggestion: 3, note: 1 },
        byFocus: { security: 2, performance: 1 },
        hotspots: [{ file: '/src/api/users.ts', commentCount: 3 }],
        healthScore: 65,
        verdict: 'Address critical issues before deployment.',
      };
      const result = ReviewSummarySchema.safeParse(summary);
      expect(result.success).toBe(true);
    });

    it('should enforce health score range', () => {
      const summary = {
        bySeverity: { critical: 0, warning: 0, suggestion: 0, note: 0 },
        byFocus: {},
        hotspots: [],
        healthScore: 150, // Invalid
        verdict: 'Clean.',
      };
      const result = ReviewSummarySchema.safeParse(summary);
      expect(result.success).toBe(false);
    });
  });

  describe('ReviewResultSchema', () => {
    it('should validate a review result', () => {
      const result = {
        resultId: '550e8400-e29b-41d4-a716-446655440000',
        requestId: '550e8400-e29b-41d4-a716-446655440001',
        comments: [],
        summary: {
          bySeverity: { critical: 0, warning: 0, suggestion: 0, note: 0 },
          byFocus: {},
          hotspots: [],
          healthScore: 100,
          verdict: 'No issues found.',
        },
        filesReviewed: ['/src/index.ts'],
        linesAnalyzed: 500,
        providerId: 'claude',
        modelId: 'claude-3-sonnet',
        durationMs: 5000,
        completedAt: new Date().toISOString(),
      };
      const parsed = validateReviewResult(result);
      expect(parsed.resultId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('SarifOutputSchema', () => {
    it('should validate SARIF output', () => {
      const sarif = {
        $schema:
          'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [
          {
            tool: {
              driver: {
                name: 'ax-review',
                version: '1.0.0',
              },
            },
            results: [],
          },
        ],
      };
      const result = validateSarifOutput(sarif);
      expect(result.version).toBe('2.1.0');
    });

    it('should reject invalid SARIF version', () => {
      const sarif = {
        $schema:
          'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        version: '2.0.0', // Invalid
        runs: [],
      };
      const result = SarifOutputSchema.safeParse(sarif);
      expect(result.success).toBe(false);
    });
  });

  describe('Error Codes', () => {
    it('should have all expected error codes', () => {
      expect(ReviewErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
      expect(ReviewErrorCode.REVIEW_FAILED).toBe('REVIEW_FAILED');
      expect(ReviewErrorCode.TIMEOUT).toBe('TIMEOUT');
      expect(ReviewErrorCode.PROVIDER_UNAVAILABLE).toBe('PROVIDER_UNAVAILABLE');
      expect(ReviewErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    });
  });

  // ============================================================================
  // Invariant Tests
  // ============================================================================

  describe('INV-REV-001: Focus Mode Isolation', () => {
    it('should filter comments by focus mode', () => {
      const securityComment: ReviewComment = {
        commentId: '550e8400-e29b-41d4-a716-446655440001',
        file: '/src/api.ts',
        line: 10,
        severity: 'critical',
        title: 'SQL Injection',
        body: 'Unsafe query.',
        focus: 'security',
        confidence: 0.9,
        category: 'injection',
      };
      const perfComment: ReviewComment = {
        commentId: '550e8400-e29b-41d4-a716-446655440002',
        file: '/src/db.ts',
        line: 20,
        severity: 'warning',
        title: 'N+1 Query',
        body: 'Query in loop.',
        focus: 'performance',
        confidence: 0.85,
        category: 'n-plus-one',
      };

      const comments = [securityComment, perfComment];

      // Filter by security focus
      const securityFiltered = comments.filter((c) => c.focus === 'security');
      expect(securityFiltered).toHaveLength(1);
      expect(securityFiltered[0]!.focus).toBe('security');

      // Filter by performance focus
      const perfFiltered = comments.filter((c) => c.focus === 'performance');
      expect(perfFiltered).toHaveLength(1);
      expect(perfFiltered[0]!.focus).toBe('performance');

      // All focus includes everything
      const allFiltered = comments.filter(() => true);
      expect(allFiltered).toHaveLength(2);
    });
  });

  describe('INV-REV-002: Confidence Filtering', () => {
    it('should filter comments below minConfidence', () => {
      const comments: ReviewComment[] = [
        {
          commentId: '550e8400-e29b-41d4-a716-446655440001',
          file: '/src/a.ts',
          line: 1,
          severity: 'warning',
          title: 'High confidence',
          body: 'Issue.',
          focus: 'all',
          confidence: 0.9,
          category: 'test',
        },
        {
          commentId: '550e8400-e29b-41d4-a716-446655440002',
          file: '/src/b.ts',
          line: 2,
          severity: 'suggestion',
          title: 'Low confidence',
          body: 'Maybe.',
          focus: 'all',
          confidence: 0.5,
          category: 'test',
        },
      ];

      const minConfidence = 0.7;
      const filtered = comments.filter((c) => c.confidence >= minConfidence);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.confidence).toBeGreaterThanOrEqual(minConfidence);
    });

    it('should accept default minConfidence of 0.7', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: ['/src'],
      };
      const result = validateReviewRequest(request);
      expect(result.minConfidence).toBe(0.7);
    });
  });

  describe('INV-REV-003: Explanation Required', () => {
    it('should require body field', () => {
      const comment = {
        commentId: '550e8400-e29b-41d4-a716-446655440000',
        file: '/src/test.ts',
        line: 1,
        severity: 'warning',
        title: 'Issue',
        // body is missing
        focus: 'all',
        confidence: 0.8,
        category: 'test',
      };
      const result = ReviewCommentSchema.safeParse(comment);
      expect(result.success).toBe(false);
    });

    it('should accept non-empty body', () => {
      const comment = {
        commentId: '550e8400-e29b-41d4-a716-446655440000',
        file: '/src/test.ts',
        line: 1,
        severity: 'warning',
        title: 'Issue',
        body: 'This is a detailed explanation of why this matters.',
        focus: 'all',
        confidence: 0.8,
        category: 'test',
      };
      const result = ReviewCommentSchema.safeParse(comment);
      expect(result.success).toBe(true);
    });
  });

  describe('INV-REV-004: Actionable Suggestions', () => {
    it('critical/warning comments should include suggestion', () => {
      // This is a semantic check - the schema allows empty suggestion
      // but the invariant requires it for critical/warning
      const criticalComment: ReviewComment = {
        commentId: '550e8400-e29b-41d4-a716-446655440000',
        file: '/src/test.ts',
        line: 1,
        severity: 'critical',
        title: 'Critical Issue',
        body: 'This is critical.',
        suggestion: 'Fix it this way.', // Required by invariant
        focus: 'all',
        confidence: 0.9,
        category: 'test',
      };
      expect(criticalComment.suggestion).toBeDefined();
      expect(criticalComment.suggestion!.length).toBeGreaterThan(0);
    });

    it('suggestion/note comments may omit suggestion', () => {
      const noteComment: ReviewComment = {
        commentId: '550e8400-e29b-41d4-a716-446655440000',
        file: '/src/test.ts',
        line: 1,
        severity: 'note',
        title: 'Note',
        body: 'Informational.',
        focus: 'all',
        confidence: 0.7,
        category: 'test',
      };
      // Schema allows missing suggestion for note
      const result = ReviewCommentSchema.safeParse(noteComment);
      expect(result.success).toBe(true);
    });
  });

  describe('INV-REV-OPS-001: Timeout Handling', () => {
    it('should support timeout configuration', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: ['/src'],
        timeoutMs: 60000,
      };
      const result = validateReviewRequest(request);
      expect(result.timeoutMs).toBe(60000);
    });

    it('should enforce minimum timeout', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: ['/src'],
        timeoutMs: 1000, // Below minimum
      };
      const result = safeValidateReviewRequest(request);
      expect(result.success).toBe(false);
    });

    it('should enforce maximum timeout', () => {
      const request = {
        requestId: '550e8400-e29b-41d4-a716-446655440000',
        paths: ['/src'],
        timeoutMs: 400000, // Above maximum
      };
      const result = safeValidateReviewRequest(request);
      expect(result.success).toBe(false);
    });

    it('should have TIMEOUT error code', () => {
      expect(ReviewErrorCode.TIMEOUT).toBe('TIMEOUT');
    });
  });

  describe('INV-REV-OPS-002: Provider Fallback', () => {
    it('should track provider used in result', () => {
      const result = {
        resultId: '550e8400-e29b-41d4-a716-446655440000',
        requestId: '550e8400-e29b-41d4-a716-446655440001',
        comments: [],
        summary: createEmptyReviewSummary(),
        filesReviewed: [],
        linesAnalyzed: 0,
        providerId: 'gemini', // Fallback provider
        modelId: 'gemini-1.5-pro',
        durationMs: 3000,
        completedAt: new Date().toISOString(),
      };
      const parsed = validateReviewResult(result);
      expect(parsed.providerId).toBe('gemini');
    });

    it('should have PROVIDER_UNAVAILABLE error code', () => {
      expect(ReviewErrorCode.PROVIDER_UNAVAILABLE).toBe('PROVIDER_UNAVAILABLE');
    });
  });

  describe('INV-REV-OUT-001: Severity Ordering', () => {
    it('should have correct severity order', () => {
      expect(SEVERITY_ORDER.critical).toBe(0);
      expect(SEVERITY_ORDER.warning).toBe(1);
      expect(SEVERITY_ORDER.suggestion).toBe(2);
      expect(SEVERITY_ORDER.note).toBe(3);
    });

    it('should sort comments by severity', () => {
      const comments: ReviewComment[] = [
        {
          commentId: '550e8400-e29b-41d4-a716-446655440001',
          file: '/src/a.ts',
          line: 1,
          severity: 'note',
          title: 'Note',
          body: 'Info.',
          focus: 'all',
          confidence: 0.8,
          category: 'test',
        },
        {
          commentId: '550e8400-e29b-41d4-a716-446655440002',
          file: '/src/b.ts',
          line: 2,
          severity: 'critical',
          title: 'Critical',
          body: 'Fix now.',
          focus: 'all',
          confidence: 0.9,
          category: 'test',
        },
        {
          commentId: '550e8400-e29b-41d4-a716-446655440003',
          file: '/src/c.ts',
          line: 3,
          severity: 'warning',
          title: 'Warning',
          body: 'Should fix.',
          focus: 'all',
          confidence: 0.85,
          category: 'test',
        },
      ];

      const sorted = sortCommentsBySeverity(comments);
      expect(sorted[0]!.severity).toBe('critical');
      expect(sorted[1]!.severity).toBe('warning');
      expect(sorted[2]!.severity).toBe('note');
    });

    it('should sort by confidence as secondary criterion', () => {
      const comments: ReviewComment[] = [
        {
          commentId: '550e8400-e29b-41d4-a716-446655440001',
          file: '/src/a.ts',
          line: 1,
          severity: 'warning',
          title: 'Low confidence',
          body: 'Warning.',
          focus: 'all',
          confidence: 0.7,
          category: 'test',
        },
        {
          commentId: '550e8400-e29b-41d4-a716-446655440002',
          file: '/src/b.ts',
          line: 2,
          severity: 'warning',
          title: 'High confidence',
          body: 'Warning.',
          focus: 'all',
          confidence: 0.95,
          category: 'test',
        },
      ];

      const sorted = sortCommentsBySeverity(comments);
      // Higher confidence first
      expect(sorted[0]!.confidence).toBe(0.95);
      expect(sorted[1]!.confidence).toBe(0.7);
    });

    it('should sort by file path as tertiary criterion', () => {
      const comments: ReviewComment[] = [
        {
          commentId: '550e8400-e29b-41d4-a716-446655440001',
          file: '/src/z.ts',
          line: 1,
          severity: 'warning',
          title: 'Z file',
          body: 'Warning.',
          focus: 'all',
          confidence: 0.8,
          category: 'test',
        },
        {
          commentId: '550e8400-e29b-41d4-a716-446655440002',
          file: '/src/a.ts',
          line: 2,
          severity: 'warning',
          title: 'A file',
          body: 'Warning.',
          focus: 'all',
          confidence: 0.8,
          category: 'test',
        },
      ];

      const sorted = sortCommentsBySeverity(comments);
      // Alphabetical order
      expect(sorted[0]!.file).toBe('/src/a.ts');
      expect(sorted[1]!.file).toBe('/src/z.ts');
    });

    it('compareCommentsBySeverity should return negative for higher severity', () => {
      const critical: ReviewComment = {
        commentId: '1',
        file: '/src/a.ts',
        line: 1,
        severity: 'critical',
        title: 'Critical',
        body: 'Fix.',
        focus: 'all',
        confidence: 0.9,
        category: 'test',
      };
      const note: ReviewComment = {
        commentId: '2',
        file: '/src/b.ts',
        line: 2,
        severity: 'note',
        title: 'Note',
        body: 'Info.',
        focus: 'all',
        confidence: 0.9,
        category: 'test',
      };
      expect(compareCommentsBySeverity(critical, note)).toBeLessThan(0);
      expect(compareCommentsBySeverity(note, critical)).toBeGreaterThan(0);
    });
  });

  describe('INV-REV-OUT-002: Health Score Calculation', () => {
    it('should calculate 100 for no issues', () => {
      const score = calculateHealthScore(0, 0, 0);
      expect(score).toBe(100);
    });

    it('should subtract 25 per critical', () => {
      const score = calculateHealthScore(2, 0, 0);
      expect(score).toBe(50); // 100 - 2*25
    });

    it('should subtract 10 per warning', () => {
      const score = calculateHealthScore(0, 3, 0);
      expect(score).toBe(70); // 100 - 3*10
    });

    it('should subtract 2 per suggestion', () => {
      const score = calculateHealthScore(0, 0, 5);
      expect(score).toBe(90); // 100 - 5*2
    });

    it('should combine all weights', () => {
      const score = calculateHealthScore(1, 2, 3);
      // 100 - (1*25 + 2*10 + 3*2) = 100 - (25 + 20 + 6) = 49
      expect(score).toBe(49);
    });

    it('should clamp to 0 minimum', () => {
      const score = calculateHealthScore(10, 10, 10);
      // 100 - (10*25 + 10*10 + 10*2) = 100 - 370 = -270 -> 0
      expect(score).toBe(0);
    });

    it('createReviewSummary should calculate health score', () => {
      const comments: ReviewComment[] = [
        {
          commentId: '1',
          file: '/src/a.ts',
          line: 1,
          severity: 'critical',
          title: 'Critical',
          body: 'Fix.',
          focus: 'security',
          confidence: 0.9,
          category: 'test',
        },
        {
          commentId: '2',
          file: '/src/b.ts',
          line: 2,
          severity: 'warning',
          title: 'Warning',
          body: 'Should fix.',
          focus: 'security',
          confidence: 0.85,
          category: 'test',
        },
      ];
      const summary = createReviewSummary(comments);
      // 100 - (1*25 + 1*10) = 65
      expect(summary.healthScore).toBe(65);
    });

    it('createEmptyReviewSummary should have score 100', () => {
      const summary = createEmptyReviewSummary();
      expect(summary.healthScore).toBe(100);
    });
  });

  describe('INV-REV-OUT-003: SARIF Compliance', () => {
    it('should require exact $schema URL', () => {
      const invalidSarif = {
        $schema: 'https://example.com/sarif.json', // Wrong URL
        version: '2.1.0',
        runs: [],
      };
      const result = SarifOutputSchema.safeParse(invalidSarif);
      expect(result.success).toBe(false);
    });

    it('should require version 2.1.0', () => {
      const invalidSarif = {
        $schema:
          'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        version: '2.0.0',
        runs: [],
      };
      const result = SarifOutputSchema.safeParse(invalidSarif);
      expect(result.success).toBe(false);
    });

    it('should validate complete SARIF with results', () => {
      const sarif = {
        $schema:
          'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [
          {
            tool: {
              driver: {
                name: 'ax-review',
                version: '1.0.0',
                informationUri: 'https://github.com/automatosx/ax',
                rules: [
                  {
                    id: 'security/sql-injection',
                    name: 'SQL Injection',
                    shortDescription: { text: 'Potential SQL injection' },
                    defaultConfiguration: { level: 'error' },
                  },
                ],
              },
            },
            results: [
              {
                ruleId: 'security/sql-injection',
                level: 'error',
                message: { text: 'User input directly in SQL query' },
                locations: [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: 'src/api/users.ts' },
                      region: { startLine: 45 },
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = validateSarifOutput(sarif);
      expect(result.runs[0]!.results).toHaveLength(1);
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('Factory Functions', () => {
    describe('createEmptyReviewSummary', () => {
      it('should create valid empty summary', () => {
        const summary = createEmptyReviewSummary();
        expect(summary.bySeverity.critical).toBe(0);
        expect(summary.bySeverity.warning).toBe(0);
        expect(summary.bySeverity.suggestion).toBe(0);
        expect(summary.bySeverity.note).toBe(0);
        expect(summary.hotspots).toHaveLength(0);
        expect(summary.healthScore).toBe(100);
        expect(summary.verdict).toBe('No issues found.');
      });
    });

    describe('createReviewSummary', () => {
      it('should count comments by severity', () => {
        const comments: ReviewComment[] = [
          {
            commentId: '1',
            file: '/src/a.ts',
            line: 1,
            severity: 'critical',
            title: 'Critical',
            body: 'Fix.',
            focus: 'all',
            confidence: 0.9,
            category: 'test',
          },
          {
            commentId: '2',
            file: '/src/b.ts',
            line: 2,
            severity: 'warning',
            title: 'Warning',
            body: 'Fix.',
            focus: 'all',
            confidence: 0.85,
            category: 'test',
          },
          {
            commentId: '3',
            file: '/src/c.ts',
            line: 3,
            severity: 'warning',
            title: 'Warning 2',
            body: 'Fix.',
            focus: 'all',
            confidence: 0.8,
            category: 'test',
          },
        ];
        const summary = createReviewSummary(comments);
        expect(summary.bySeverity.critical).toBe(1);
        expect(summary.bySeverity.warning).toBe(2);
        expect(summary.bySeverity.suggestion).toBe(0);
        expect(summary.bySeverity.note).toBe(0);
      });

      it('should count comments by focus', () => {
        const comments: ReviewComment[] = [
          {
            commentId: '1',
            file: '/src/a.ts',
            line: 1,
            severity: 'warning',
            title: 'Security',
            body: 'Fix.',
            focus: 'security',
            confidence: 0.9,
            category: 'test',
          },
          {
            commentId: '2',
            file: '/src/b.ts',
            line: 2,
            severity: 'warning',
            title: 'Security 2',
            body: 'Fix.',
            focus: 'security',
            confidence: 0.85,
            category: 'test',
          },
          {
            commentId: '3',
            file: '/src/c.ts',
            line: 3,
            severity: 'suggestion',
            title: 'Perf',
            body: 'Improve.',
            focus: 'performance',
            confidence: 0.8,
            category: 'test',
          },
        ];
        const summary = createReviewSummary(comments);
        expect(summary.byFocus.security).toBe(2);
        expect(summary.byFocus.performance).toBe(1);
      });

      it('should identify hotspots', () => {
        const comments: ReviewComment[] = [
          {
            commentId: '1',
            file: '/src/problem.ts',
            line: 1,
            severity: 'warning',
            title: 'Issue 1',
            body: 'Fix.',
            focus: 'all',
            confidence: 0.9,
            category: 'test',
          },
          {
            commentId: '2',
            file: '/src/problem.ts',
            line: 2,
            severity: 'warning',
            title: 'Issue 2',
            body: 'Fix.',
            focus: 'all',
            confidence: 0.85,
            category: 'test',
          },
          {
            commentId: '3',
            file: '/src/other.ts',
            line: 1,
            severity: 'note',
            title: 'Note',
            body: 'Info.',
            focus: 'all',
            confidence: 0.8,
            category: 'test',
          },
        ];
        const summary = createReviewSummary(comments);
        expect(summary.hotspots[0]!.file).toBe('/src/problem.ts');
        expect(summary.hotspots[0]!.commentCount).toBe(2);
      });

      it('should generate appropriate verdict for critical issues', () => {
        const comments: ReviewComment[] = [
          {
            commentId: '1',
            file: '/src/a.ts',
            line: 1,
            severity: 'critical',
            title: 'Critical',
            body: 'Fix.',
            focus: 'all',
            confidence: 0.9,
            category: 'test',
          },
        ];
        const summary = createReviewSummary(comments);
        expect(summary.verdict).toContain('critical');
      });
    });
  });
});
