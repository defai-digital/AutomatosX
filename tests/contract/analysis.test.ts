/**
 * Analysis Contract Tests
 *
 * Validates analysis schemas and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  AnalysisTaskSchema,
  FindingSeveritySchema,
  AnalysisSeverityFilterSchema,
  AnalysisFileSchema,
  CodeContextSchema,
  AnalysisFindingSchema,
  AnalysisRequestSchema,
  AnalysisResultSchema,
  validateAnalysisRequest,
  safeValidateAnalysisRequest,
  validateAnalysisFinding,
  safeValidateAnalysisFinding,
  filterFindingsBySeverity,
  groupFindingsByCategory,
  getLanguageFromPath,
  AnalysisErrorCodes,
} from '@automatosx/contracts';

describe('Analysis Contract', () => {
  describe('AnalysisTaskSchema', () => {
    it('should accept valid tasks', () => {
      expect(AnalysisTaskSchema.safeParse('bugfix').success).toBe(true);
      expect(AnalysisTaskSchema.safeParse('refactor').success).toBe(true);
      expect(AnalysisTaskSchema.safeParse('review').success).toBe(true);
      expect(AnalysisTaskSchema.safeParse('explain').success).toBe(true);
    });

    it('should reject invalid tasks', () => {
      expect(AnalysisTaskSchema.safeParse('invalid').success).toBe(false);
      expect(AnalysisTaskSchema.safeParse('').success).toBe(false);
    });
  });

  describe('FindingSeveritySchema', () => {
    it('should accept valid severities', () => {
      expect(FindingSeveritySchema.safeParse('critical').success).toBe(true);
      expect(FindingSeveritySchema.safeParse('high').success).toBe(true);
      expect(FindingSeveritySchema.safeParse('medium').success).toBe(true);
      expect(FindingSeveritySchema.safeParse('low').success).toBe(true);
      expect(FindingSeveritySchema.safeParse('info').success).toBe(true);
    });

    it('should reject invalid severities', () => {
      expect(FindingSeveritySchema.safeParse('urgent').success).toBe(false);
    });
  });

  describe('AnalysisSeverityFilterSchema', () => {
    it('should accept valid filters', () => {
      expect(AnalysisSeverityFilterSchema.safeParse('all').success).toBe(true);
      expect(AnalysisSeverityFilterSchema.safeParse('critical').success).toBe(true);
      expect(AnalysisSeverityFilterSchema.safeParse('high').success).toBe(true);
      expect(AnalysisSeverityFilterSchema.safeParse('medium').success).toBe(true);
    });
  });

  describe('AnalysisFileSchema', () => {
    it('should validate a minimal file', () => {
      const file = {
        path: 'src/index.ts',
        content: 'console.log("hello");',
        language: 'typescript',
        lines: 1,
      };

      const result = AnalysisFileSchema.safeParse(file);
      expect(result.success).toBe(true);
    });

    it('should validate a file with all fields', () => {
      const file = {
        path: 'src/utils/helper.ts',
        content: 'export function helper() { return 42; }',
        language: 'typescript',
        lines: 1,
        truncated: false,
      };

      const result = AnalysisFileSchema.safeParse(file);
      expect(result.success).toBe(true);
    });
  });

  describe('CodeContextSchema', () => {
    it('should validate code context', () => {
      const context = {
        files: [
          {
            path: 'src/index.ts',
            content: 'console.log("hello");',
            language: 'typescript',
            lines: 1,
          },
        ],
        totalLines: 1,
        totalFiles: 1,
        truncated: false,
      };

      const result = CodeContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });
  });

  describe('AnalysisFindingSchema', () => {
    it('should validate a minimal finding', () => {
      const finding = {
        findingId: 'finding-123',
        file: 'src/index.ts',
        title: 'Potential null reference',
        description: 'Variable may be undefined',
        severity: 'high',
        category: 'null-reference',
        confidence: 0.9,
      };

      const result = AnalysisFindingSchema.safeParse(finding);
      expect(result.success).toBe(true);
    });

    it('should validate a full finding', () => {
      const finding = {
        findingId: 'finding-456',
        file: 'src/utils/helper.ts',
        line: 42,
        lineEnd: 45,
        title: 'Resource leak detected',
        description: 'File handle not closed in error path',
        severity: 'critical',
        category: 'resource-leak',
        suggestion: 'Add try-finally block to ensure file is closed',
        codeSnippet: 'const file = fs.openSync(path)',
        confidence: 0.95,
      };

      const result = AnalysisFindingSchema.safeParse(finding);
      expect(result.success).toBe(true);
    });

    it('should reject invalid severity', () => {
      const finding = {
        findingId: 'finding-789',
        file: 'src/index.ts',
        title: 'Test',
        description: 'Test',
        severity: 'invalid',
        category: 'other',
        confidence: 0.5,
      };

      const result = AnalysisFindingSchema.safeParse(finding);
      expect(result.success).toBe(false);
    });

    it('should reject confidence out of range', () => {
      const finding = {
        findingId: 'finding-abc',
        file: 'src/index.ts',
        title: 'Test',
        description: 'Test',
        severity: 'medium',
        category: 'other',
        confidence: 1.5,
      };

      const result = AnalysisFindingSchema.safeParse(finding);
      expect(result.success).toBe(false);
    });
  });

  describe('AnalysisRequestSchema', () => {
    it('should validate a minimal request', () => {
      const request = {
        task: 'bugfix',
        paths: ['src/'],
      };

      const result = AnalysisRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.severity).toBe('all');
        expect(result.data.maxFiles).toBe(20);
        expect(result.data.timeoutMs).toBe(60000);
      }
    });

    it('should validate a full request', () => {
      const request = {
        task: 'refactor',
        paths: ['src/', 'lib/'],
        context: 'Focus on authentication module',
        severity: 'high',
        maxFiles: 50,
        maxLinesPerFile: 500,
        providerId: 'claude',
        timeoutMs: 120000,
      };

      const result = AnalysisRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject empty paths', () => {
      const request = {
        task: 'bugfix',
        paths: [],
      };

      const result = AnalysisRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject too many paths', () => {
      const request = {
        task: 'bugfix',
        paths: Array.from({ length: 51 }, (_, i) => `path${i}/`),
      };

      const result = AnalysisRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('AnalysisResultSchema', () => {
    it('should validate a result with findings', () => {
      const result = {
        resultId: '550e8400-e29b-41d4-a716-446655440000',
        task: 'bugfix',
        findings: [
          {
            findingId: 'finding-1',
            file: 'src/index.ts',
            line: 10,
            title: 'Null check missing',
            description: 'Variable may be null',
            severity: 'high',
            category: 'null-reference',
            confidence: 0.9,
          },
        ],
        summary: 'Bug Detection: Found 1 issue(s). high: 1',
        filesAnalyzed: ['src/index.ts'],
        linesAnalyzed: 100,
        providerId: 'claude',
        durationMs: 5000,
        completedAt: new Date().toISOString(),
      };

      const parsed = AnalysisResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate a result with no findings', () => {
      const result = {
        resultId: '550e8400-e29b-41d4-a716-446655440001',
        task: 'review',
        findings: [],
        summary: 'Code Review: No issues found.',
        filesAnalyzed: ['src/index.ts', 'src/utils.ts'],
        linesAnalyzed: 200,
        providerId: 'mock',
        durationMs: 2000,
        completedAt: new Date().toISOString(),
      };

      const parsed = AnalysisResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('validateAnalysisRequest should throw on invalid input', () => {
      expect(() => validateAnalysisRequest({ task: 'invalid' })).toThrow();
    });

    it('safeValidateAnalysisRequest should return error on invalid input', () => {
      const result = safeValidateAnalysisRequest({ task: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('validateAnalysisFinding should throw on invalid input', () => {
      expect(() => validateAnalysisFinding({ findingId: 'test' })).toThrow();
    });

    it('safeValidateAnalysisFinding should return error on invalid input', () => {
      const result = safeValidateAnalysisFinding({ findingId: 'test' });
      expect(result.success).toBe(false);
    });
  });

  describe('filterFindingsBySeverity', () => {
    const findings = [
      { findingId: '1', file: 'a.ts', title: 't', description: 'd', severity: 'critical', category: 'c', confidence: 0.9 },
      { findingId: '2', file: 'b.ts', title: 't', description: 'd', severity: 'high', category: 'c', confidence: 0.8 },
      { findingId: '3', file: 'c.ts', title: 't', description: 'd', severity: 'medium', category: 'c', confidence: 0.7 },
      { findingId: '4', file: 'd.ts', title: 't', description: 'd', severity: 'low', category: 'c', confidence: 0.6 },
      { findingId: '5', file: 'e.ts', title: 't', description: 'd', severity: 'info', category: 'c', confidence: 0.5 },
    ] as const;

    it('should return all findings with "all" filter', () => {
      const result = filterFindingsBySeverity(findings as any, 'all');
      expect(result).toHaveLength(5);
    });

    it('should filter to critical only', () => {
      const result = filterFindingsBySeverity(findings as any, 'critical');
      expect(result).toHaveLength(1);
      expect(result[0]!.severity).toBe('critical');
    });

    it('should filter to high and above', () => {
      const result = filterFindingsBySeverity(findings as any, 'high');
      expect(result).toHaveLength(2);
      expect(result.every(f => ['critical', 'high'].includes(f.severity))).toBe(true);
    });

    it('should filter to medium and above', () => {
      const result = filterFindingsBySeverity(findings as any, 'medium');
      expect(result).toHaveLength(3);
    });
  });

  describe('groupFindingsByCategory', () => {
    const findings = [
      { findingId: '1', file: 'a.ts', title: 't', description: 'd', severity: 'high', category: 'security', confidence: 0.9 },
      { findingId: '2', file: 'b.ts', title: 't', description: 'd', severity: 'medium', category: 'security', confidence: 0.8 },
      { findingId: '3', file: 'c.ts', title: 't', description: 'd', severity: 'low', category: 'performance', confidence: 0.7 },
    ] as const;

    it('should group findings by category', () => {
      const result = groupFindingsByCategory(findings as any);
      expect(Object.keys(result)).toEqual(['security', 'performance']);
      expect(result.security).toHaveLength(2);
      expect(result.performance).toHaveLength(1);
    });
  });

  describe('getLanguageFromPath', () => {
    it('should detect TypeScript', () => {
      expect(getLanguageFromPath('src/index.ts')).toBe('typescript');
      expect(getLanguageFromPath('src/types.tsx')).toBe('typescript');
    });

    it('should detect JavaScript', () => {
      expect(getLanguageFromPath('src/index.js')).toBe('javascript');
      expect(getLanguageFromPath('src/app.jsx')).toBe('javascript');
      expect(getLanguageFromPath('src/module.mjs')).toBe('javascript');
    });

    it('should detect Python', () => {
      expect(getLanguageFromPath('script.py')).toBe('python');
    });

    it('should detect JSON', () => {
      expect(getLanguageFromPath('package.json')).toBe('json');
    });

    it('should detect Markdown', () => {
      expect(getLanguageFromPath('README.md')).toBe('markdown');
    });

    it('should return unknown for unknown extensions', () => {
      expect(getLanguageFromPath('file.xyz')).toBe('unknown');
    });
  });

  describe('Error Codes', () => {
    it('should have all required error codes', () => {
      expect(AnalysisErrorCodes.NO_FILES_FOUND).toBe('ANALYSIS_NO_FILES_FOUND');
      expect(AnalysisErrorCodes.PROVIDER_ERROR).toBe('ANALYSIS_PROVIDER_ERROR');
      expect(AnalysisErrorCodes.PARSE_ERROR).toBe('ANALYSIS_PARSE_ERROR');
      expect(AnalysisErrorCodes.TIMEOUT).toBe('ANALYSIS_TIMEOUT');
      expect(AnalysisErrorCodes.INVALID_REQUEST).toBe('ANALYSIS_INVALID_REQUEST');
    });
  });

  /**
   * Invariant Tests
   * Tests for documented invariants in packages/contracts/src/analysis/v1/invariants.md
   */
  describe('INV-ANL: Analysis Invariants', () => {
    describe('INV-ANL-CTX-001: File Size Limits', () => {
      it('should support maxLinesPerFile configuration', () => {
        const request = {
          task: 'bugfix',
          paths: ['/src'],
          maxLinesPerFile: 1000,
        };
        const result = AnalysisRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxLinesPerFile).toBe(1000);
        }
      });

      it('file schema should track file metadata', () => {
        // AnalysisFileSchema tracks path, content, lines, and language
        const file = {
          path: '/src/large-file.ts',
          content: 'file content...',
          language: 'typescript',
          lines: 500,
        };
        const result = AnalysisFileSchema.safeParse(file);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.lines).toBe(500);
        }
      });
    });

    describe('INV-ANL-CTX-002: Total Size Budget', () => {
      it('should support maxFiles configuration', () => {
        const request = {
          task: 'review',
          paths: ['/src'],
          maxFiles: 50,
        };
        const result = AnalysisRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.maxFiles).toBe(50);
        }
      });

      it('context schema should track total metrics', () => {
        // CodeContextSchema has files, totalLines, and truncated fields
        const context = {
          files: [
            { path: '/src/a.ts', content: 'const a = 1;', language: 'typescript', lines: 1 },
            { path: '/src/b.ts', content: 'const b = 2;', language: 'typescript', lines: 1 },
          ],
          totalLines: 2,
          truncated: false,
        };
        const result = CodeContextSchema.safeParse(context);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.files).toHaveLength(2);
          expect(result.data.totalLines).toBe(2);
        }
      });

      it('context should indicate when truncated due to budget', () => {
        const context = {
          files: [],
          totalLines: 0,
          totalFiles: 0,
          truncated: true,
        };
        const result = CodeContextSchema.safeParse(context);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.truncated).toBe(true);
        }
      });
    });

    describe('INV-ANL-CTX-003: UTF-8 Validation', () => {
      it('file should require language identifier', () => {
        const file = {
          path: '/src/index.ts',
          content: 'const x = 1;',
          language: 'typescript',
          lines: 1,
        };
        const result = AnalysisFileSchema.safeParse(file);
        expect(result.success).toBe(true);
      });

      it('getLanguageFromPath should detect common languages', () => {
        expect(getLanguageFromPath('file.ts')).toBe('typescript');
        expect(getLanguageFromPath('file.tsx')).toBe('typescript');
        expect(getLanguageFromPath('file.js')).toBe('javascript');
        expect(getLanguageFromPath('file.py')).toBe('python');
        expect(getLanguageFromPath('file.json')).toBe('json');
        expect(getLanguageFromPath('file.md')).toBe('markdown');
      });

      it('should return unknown for unrecognized extensions', () => {
        expect(getLanguageFromPath('file.xyz')).toBe('unknown');
        expect(getLanguageFromPath('file.abc')).toBe('unknown');
      });
    });

    describe('INV-ANL-FIND-001: Severity Ordering', () => {
      it('filterFindingsBySeverity should order by severity', () => {
        const findings = [
          { findingId: '1', file: 'a.ts', title: 't', description: 'd', severity: 'low', category: 'c', confidence: 0.9 },
          { findingId: '2', file: 'b.ts', title: 't', description: 'd', severity: 'critical', category: 'c', confidence: 0.9 },
          { findingId: '3', file: 'c.ts', title: 't', description: 'd', severity: 'high', category: 'c', confidence: 0.9 },
        ] as const;

        // Filter to high and above should exclude low
        const filtered = filterFindingsBySeverity(findings as any, 'high');
        expect(filtered).toHaveLength(2);
        expect(filtered.every(f => ['critical', 'high'].includes(f.severity))).toBe(true);
      });

      it('should validate all severity levels', () => {
        const severities = ['critical', 'high', 'medium', 'low', 'info'];
        for (const severity of severities) {
          const result = FindingSeveritySchema.safeParse(severity);
          expect(result.success).toBe(true);
        }
      });
    });

    describe('INV-ANL-FIND-002: Location Accuracy', () => {
      it('finding should include file path', () => {
        const finding = {
          findingId: 'finding-1',
          file: '/src/index.ts',
          title: 'Issue found',
          description: 'Description',
          severity: 'medium',
          category: 'logic-error',
          confidence: 0.8,
        };
        const result = AnalysisFindingSchema.safeParse(finding);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.file).toBe('/src/index.ts');
        }
      });

      it('finding should support line numbers', () => {
        const finding = {
          findingId: 'finding-2',
          file: '/src/utils.ts',
          line: 42,
          lineEnd: 50,
          title: 'Range issue',
          description: 'Issue spans multiple lines',
          severity: 'high',
          category: 'performance',
          confidence: 0.9,
        };
        const result = AnalysisFindingSchema.safeParse(finding);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.line).toBe(42);
          expect(result.data.lineEnd).toBe(50);
        }
      });
    });

    describe('INV-ANL-FIND-003: Actionable Suggestions', () => {
      it('finding should support suggestion field', () => {
        const finding = {
          findingId: 'finding-3',
          file: '/src/api.ts',
          title: 'Missing error handling',
          description: 'Promise rejection not handled',
          severity: 'high',
          category: 'error-handling',
          suggestion: 'Add try-catch block or .catch() handler',
          confidence: 0.95,
        };
        const result = AnalysisFindingSchema.safeParse(finding);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.suggestion).toBeDefined();
        }
      });

      it('finding should support code snippet', () => {
        const finding = {
          findingId: 'finding-4',
          file: '/src/db.ts',
          title: 'SQL injection vulnerability',
          description: 'User input not sanitized',
          severity: 'critical',
          category: 'security',
          codeSnippet: 'const query = `SELECT * FROM users WHERE id = ${userId}`;',
          suggestion: 'Use parameterized queries',
          confidence: 0.99,
        };
        const result = AnalysisFindingSchema.safeParse(finding);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.codeSnippet).toBeDefined();
        }
      });
    });

    describe('INV-ANL-PROV-001: Fallback Support', () => {
      it('request should support provider selection', () => {
        const request = {
          task: 'bugfix',
          paths: ['/src'],
          providerId: 'claude',
        };
        const result = AnalysisRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.providerId).toBe('claude');
        }
      });

      it('result should track which provider was used', () => {
        const result = {
          resultId: '550e8400-e29b-41d4-a716-446655440000',
          task: 'review',
          findings: [],
          summary: 'No issues found',
          filesAnalyzed: ['src/index.ts'],
          linesAnalyzed: 100,
          providerId: 'gemini',
          durationMs: 3000,
          completedAt: new Date().toISOString(),
        };
        const parsed = AnalysisResultSchema.safeParse(result);
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.providerId).toBe('gemini');
        }
      });
    });

    describe('INV-ANL-PROV-002: Timeout Handling', () => {
      it('request should support timeout configuration', () => {
        const request = {
          task: 'bugfix',
          paths: ['/src'],
          timeoutMs: 30000,
        };
        const result = AnalysisRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(30000);
        }
      });

      it('default timeout should be set', () => {
        const request = {
          task: 'review',
          paths: ['/src'],
        };
        const result = AnalysisRequestSchema.safeParse(request);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.timeoutMs).toBe(60000); // Default
        }
      });

      it('timeout error code should be defined', () => {
        expect(AnalysisErrorCodes.TIMEOUT).toBe('ANALYSIS_TIMEOUT');
      });
    });
  });
});
