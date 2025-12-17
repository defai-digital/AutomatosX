/**
 * Analysis Domain Tests
 *
 * Tests for the analysis domain components.
 */

import { describe, it, expect } from 'vitest';
import {
  createAnalysisPromptBuilder,
  createAnalysisResponseParser,
  createSimpleProvider,
  AnalysisError,
  deduplicateFindings,
  getTaskDescription,
} from '@automatosx/analysis-domain';
import type { AnalysisFinding } from '@automatosx/contracts';

describe('Analysis Domain', () => {
  describe('PromptBuilder', () => {
    it('should create a prompt builder', () => {
      const builder = createAnalysisPromptBuilder();
      expect(builder).toBeDefined();
      expect(builder.buildPrompt).toBeDefined();
    });

    it('should build bugfix prompt', () => {
      const builder = createAnalysisPromptBuilder();
      const context = {
        files: [{ path: 'test.ts', content: 'const x = null;', language: 'typescript', lines: 1 }],
        totalLines: 1,
        totalFiles: 1,
        truncated: false,
      };

      const prompt = builder.buildPrompt('bugfix', context);

      expect(prompt).toContain('expert code analyzer');
      expect(prompt).toContain('bugs');
      expect(prompt).toContain('test.ts');
      expect(prompt).toContain('const x = null;');
    });

    it('should build refactor prompt', () => {
      const builder = createAnalysisPromptBuilder();
      const context = {
        files: [{ path: 'test.ts', content: 'function x() {}', language: 'typescript', lines: 1 }],
        totalLines: 1,
        totalFiles: 1,
        truncated: false,
      };

      const prompt = builder.buildPrompt('refactor', context);

      expect(prompt).toContain('refactoring');
      expect(prompt).toContain('extract');
    });

    it('should build review prompt', () => {
      const builder = createAnalysisPromptBuilder();
      const context = {
        files: [{ path: 'test.ts', content: 'export {}', language: 'typescript', lines: 1 }],
        totalLines: 1,
        totalFiles: 1,
        truncated: false,
      };

      const prompt = builder.buildPrompt('review', context);

      expect(prompt).toContain('reviewer');
      expect(prompt).toContain('quality');
    });

    it('should build explain prompt', () => {
      const builder = createAnalysisPromptBuilder();
      const context = {
        files: [{ path: 'test.ts', content: 'class Foo {}', language: 'typescript', lines: 1 }],
        totalLines: 1,
        totalFiles: 1,
        truncated: false,
      };

      const prompt = builder.buildPrompt('explain', context);

      expect(prompt).toContain('explain');
    });

    it('should include user context in prompt', () => {
      const builder = createAnalysisPromptBuilder();
      const context = {
        files: [{ path: 'test.ts', content: 'code', language: 'typescript', lines: 1 }],
        totalLines: 1,
        totalFiles: 1,
        truncated: false,
      };

      const prompt = builder.buildPrompt('bugfix', context, 'Focus on authentication');

      expect(prompt).toContain('Focus on authentication');
    });
  });

  describe('ResponseParser', () => {
    it('should create a response parser', () => {
      const parser = createAnalysisResponseParser();
      expect(parser).toBeDefined();
      expect(parser.parseResponse).toBeDefined();
    });

    it('should parse JSON response', () => {
      const parser = createAnalysisResponseParser();
      const response = JSON.stringify({
        findings: [
          {
            file: 'test.ts',
            line: 10,
            title: 'Null check missing',
            description: 'Variable may be null',
            severity: 'high',
            category: 'null-reference',
            confidence: 0.9,
          },
        ],
      });

      const findings = parser.parseResponse(response, 'bugfix');

      expect(findings).toHaveLength(1);
      expect(findings[0]!.title).toBe('Null check missing');
      expect(findings[0]!.severity).toBe('high');
    });

    it('should parse JSON in code blocks', () => {
      const parser = createAnalysisResponseParser();
      const response = `Here are the findings:
\`\`\`json
{
  "findings": [
    {
      "file": "test.ts",
      "line": 5,
      "title": "Issue found",
      "description": "Description",
      "severity": "medium",
      "category": "other",
      "confidence": 0.8
    }
  ]
}
\`\`\``;

      const findings = parser.parseResponse(response, 'bugfix');

      expect(findings).toHaveLength(1);
      expect(findings[0]!.title).toBe('Issue found');
    });

    it('should handle empty findings', () => {
      const parser = createAnalysisResponseParser();
      const response = JSON.stringify({ findings: [] });

      const findings = parser.parseResponse(response, 'bugfix');

      expect(findings).toHaveLength(0);
    });

    it('should handle invalid JSON gracefully', () => {
      const parser = createAnalysisResponseParser();
      const response = 'This is not valid JSON';

      const findings = parser.parseResponse(response, 'bugfix');

      expect(findings).toHaveLength(0);
    });

    it('should normalize severity values', () => {
      const parser = createAnalysisResponseParser();
      const response = JSON.stringify({
        findings: [
          {
            file: 'test.ts',
            title: 'Test',
            description: 'Desc',
            severity: 'warning',
            category: 'other',
            confidence: 0.5,
          },
        ],
      });

      const findings = parser.parseResponse(response, 'bugfix');

      expect(findings[0]!.severity).toBe('medium');
    });
  });

  describe('deduplicateFindings', () => {
    it('should remove duplicate findings', () => {
      const findings: AnalysisFinding[] = [
        {
          findingId: '1',
          file: 'test.ts',
          line: 10,
          title: 'Issue',
          description: 'Desc',
          severity: 'high',
          category: 'security',
          confidence: 0.9,
        },
        {
          findingId: '2',
          file: 'test.ts',
          line: 10,
          title: 'Same Issue',
          description: 'Different desc',
          severity: 'high',
          category: 'security',
          confidence: 0.8,
        },
      ];

      const result = deduplicateFindings(findings);

      expect(result).toHaveLength(1);
      expect(result[0]!.confidence).toBe(0.9); // Keep higher confidence
    });

    it('should keep findings at different locations', () => {
      const findings: AnalysisFinding[] = [
        {
          findingId: '1',
          file: 'test.ts',
          line: 10,
          title: 'Issue 1',
          description: 'Desc',
          severity: 'high',
          category: 'security',
          confidence: 0.9,
        },
        {
          findingId: '2',
          file: 'test.ts',
          line: 20,
          title: 'Issue 2',
          description: 'Desc',
          severity: 'high',
          category: 'security',
          confidence: 0.8,
        },
      ];

      const result = deduplicateFindings(findings);

      expect(result).toHaveLength(2);
    });

    it('should keep findings in different categories', () => {
      const findings: AnalysisFinding[] = [
        {
          findingId: '1',
          file: 'test.ts',
          line: 10,
          title: 'Issue 1',
          description: 'Desc',
          severity: 'high',
          category: 'security',
          confidence: 0.9,
        },
        {
          findingId: '2',
          file: 'test.ts',
          line: 10,
          title: 'Issue 2',
          description: 'Desc',
          severity: 'high',
          category: 'performance',
          confidence: 0.8,
        },
      ];

      const result = deduplicateFindings(findings);

      expect(result).toHaveLength(2);
    });
  });

  describe('getTaskDescription', () => {
    it('should return correct descriptions', () => {
      expect(getTaskDescription('bugfix')).toBe('Bug Detection');
      expect(getTaskDescription('refactor')).toBe('Refactoring Opportunities');
      expect(getTaskDescription('review')).toBe('Code Review');
      expect(getTaskDescription('explain')).toBe('Code Explanation');
    });
  });

  describe('createSimpleProvider', () => {
    it('should create a provider from a function', async () => {
      const provider = createSimpleProvider('test', async (_prompt) => {
        return JSON.stringify({ findings: [] });
      });

      expect(provider.id).toBe('test');

      const result = await provider.complete({ prompt: 'test', maxTokens: 100 });
      expect(result.content).toBe(JSON.stringify({ findings: [] }));
    });

    it('should pass prompt to completion function', async () => {
      let receivedPrompt = '';
      const provider = createSimpleProvider('test', async (prompt) => {
        receivedPrompt = prompt;
        return '{}';
      });

      await provider.complete({ prompt: 'analyze this code' });

      expect(receivedPrompt).toBe('analyze this code');
    });
  });

  describe('AnalysisError', () => {
    it('should create error with code', () => {
      const error = new AnalysisError('TEST_CODE', 'Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('AnalysisError');
    });

    it('should create error with details', () => {
      const error = new AnalysisError('TEST_CODE', 'Test message', { extra: 'info' });
      expect(error.details).toEqual({ extra: 'info' });
    });

    it('should create noFilesFound error', () => {
      const error = AnalysisError.noFilesFound();
      expect(error.code).toBe('ANALYSIS_NO_FILES_FOUND');
      expect(error.message).toContain('No analyzable files');
    });

    it('should create providerError', () => {
      const error = AnalysisError.providerError('Connection failed');
      expect(error.code).toBe('ANALYSIS_PROVIDER_ERROR');
      expect(error.message).toContain('Connection failed');
    });

    it('should create parseError', () => {
      const error = AnalysisError.parseError('Invalid JSON');
      expect(error.code).toBe('ANALYSIS_PARSE_ERROR');
      expect(error.message).toContain('Invalid JSON');
    });

    it('should create timeout error', () => {
      const error = AnalysisError.timeout();
      expect(error.code).toBe('ANALYSIS_TIMEOUT');
      expect(error.message).toContain('timed out');
    });
  });
});
