/**
 * Research Contract Tests
 *
 * Tests for the research domain contracts including schemas,
 * validation functions, and factory functions.
 *
 * Invariants tested:
 * - INV-RSH-001: All sources cited in synthesis
 * - INV-RSH-002: Confidence reflects source reliability
 * - INV-RSH-003: Stale data (>24h) flagged with warning
 */

import { describe, it, expect } from 'vitest';
import {
  ResearchRequestSchema,
  ResearchResultSchema,
  ResearchSourceSchema,
  ResearchSourceTypeSchema,
  SourceReliabilitySchema,
  CodeExampleSchema,
  ResearchSessionSchema,
  FetchRequestSchema,
  FetchResponseSchema,
  SynthesisRequestSchema,
  ResearchCacheEntrySchema,
  ResearchErrorCodes,
  validateResearchRequest,
  validateResearchResult,
  validateFetchRequest,
  createDefaultResearchRequest,
  calculateConfidence,
  hasStaleDataWarning,
} from '@defai.digital/contracts';

describe('Research Contracts', () => {
  describe('ResearchSourceTypeSchema', () => {
    it('should validate all source types', () => {
      const types = ['web', 'docs', 'github', 'stackoverflow', 'arxiv'];
      types.forEach((type) => {
        const result = ResearchSourceTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid source types', () => {
      const result = ResearchSourceTypeSchema.safeParse('invalid');
      expect(result.success).toBe(false);
    });
  });

  describe('SourceReliabilitySchema', () => {
    it('should validate all reliability levels', () => {
      const levels = ['official', 'community', 'generated', 'unknown'];
      levels.forEach((level) => {
        const result = SourceReliabilitySchema.safeParse(level);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('ResearchRequestSchema', () => {
    it('should validate minimal request', () => {
      const request = {
        query: 'Best practices for React hooks',
      };

      const result = ResearchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxSources).toBe(5);
        expect(result.data.synthesize).toBe(true);
        expect(result.data.sources).toEqual(['web']);
      }
    });

    it('should validate complete request', () => {
      const request = {
        query: 'Compare React vs Vue performance',
        sources: ['web', 'github', 'stackoverflow'] as const,
        maxSources: 10,
        synthesize: true,
        includeCode: true,
        language: 'typescript',
        timeout: 30000,
        freshness: 'recent' as const,
      };

      const result = ResearchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should enforce query length limits', () => {
      expect(
        ResearchRequestSchema.safeParse({ query: '' }).success
      ).toBe(false);

      expect(
        ResearchRequestSchema.safeParse({ query: 'a'.repeat(5001) }).success
      ).toBe(false);
    });

    it('should enforce maxSources limits', () => {
      expect(
        ResearchRequestSchema.safeParse({ query: 'test', maxSources: 0 }).success
      ).toBe(false);

      expect(
        ResearchRequestSchema.safeParse({ query: 'test', maxSources: 25 }).success
      ).toBe(false);
    });

    it('should validate freshness options', () => {
      const freshnesses = ['any', 'recent', 'latest'];
      freshnesses.forEach((freshness) => {
        const result = ResearchRequestSchema.safeParse({ query: 'test', freshness });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('ResearchSourceSchema', () => {
    it('should validate research source', () => {
      const source = {
        sourceId: 'src-123',
        type: 'web' as const,
        url: 'https://example.com/article',
        title: 'React Best Practices',
        snippet: 'Short snippet about React...',
        fetchedAt: new Date().toISOString(),
        reliability: 'official' as const,
        relevanceScore: 0.85,
      };

      const result = ResearchSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
    });

    it('should validate source with all fields', () => {
      const source = {
        sourceId: 'src-456',
        type: 'github' as const,
        url: 'https://github.com/user/repo',
        title: 'Repository',
        snippet: 'README excerpt',
        content: 'Full README content',
        reliability: 'community' as const,
        publishedAt: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        relevanceScore: 0.95,
        metadata: { stars: 1000 },
      };

      const result = ResearchSourceSchema.safeParse(source);
      expect(result.success).toBe(true);
    });

    it('should enforce relevance score bounds (INV-RSH-002)', () => {
      const baseSource = {
        sourceId: 'src-1',
        type: 'web' as const,
        url: 'https://example.com',
        title: 'Title',
        snippet: 'Snippet',
        fetchedAt: new Date().toISOString(),
        reliability: 'official' as const,
      };

      expect(
        ResearchSourceSchema.safeParse({ ...baseSource, relevanceScore: -0.1 }).success
      ).toBe(false);

      expect(
        ResearchSourceSchema.safeParse({ ...baseSource, relevanceScore: 1.1 }).success
      ).toBe(false);

      expect(
        ResearchSourceSchema.safeParse({ ...baseSource, relevanceScore: 0 }).success
      ).toBe(true);

      expect(
        ResearchSourceSchema.safeParse({ ...baseSource, relevanceScore: 1 }).success
      ).toBe(true);
    });
  });

  describe('CodeExampleSchema', () => {
    it('should validate code example', () => {
      const code = {
        code: 'console.log("Hello");',
        language: 'javascript',
      };

      const result = CodeExampleSchema.safeParse(code);
      expect(result.success).toBe(true);
    });

    it('should validate code example with all fields', () => {
      const code = {
        code: 'function test() { return true; }',
        language: 'typescript',
        source: 'https://example.com/snippet',
        description: 'Example function',
        tested: true,
      };

      const result = CodeExampleSchema.safeParse(code);
      expect(result.success).toBe(true);
    });
  });

  describe('ResearchResultSchema', () => {
    it('should validate complete research result', () => {
      const result = {
        resultId: crypto.randomUUID(),
        query: 'Test query',
        sources: [
          {
            sourceId: 'src-1',
            type: 'web' as const,
            url: 'https://example.com',
            title: 'Example',
            snippet: 'Snippet',
            fetchedAt: new Date().toISOString(),
            reliability: 'official' as const,
            relevanceScore: 0.8,
          },
        ],
        synthesis: 'Based on the research...',
        codeExamples: [
          {
            code: 'console.log("test");',
            language: 'javascript',
          },
        ],
        confidence: 0.8,
        warnings: [],
        durationMs: 5000,
        completedAt: new Date().toISOString(),
      };

      const parsed = ResearchResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it('should validate result with warnings', () => {
      const result = {
        resultId: crypto.randomUUID(),
        query: 'Query',
        sources: [],
        synthesis: 'No sources found',
        confidence: 0.1,
        warnings: ['No reliable sources found', 'Results may be incomplete'],
        durationMs: 1000,
        completedAt: new Date().toISOString(),
      };

      const parsed = ResearchResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });
  });

  describe('ResearchSessionSchema', () => {
    it('should validate research session', () => {
      const session = {
        sessionId: crypto.randomUUID(),
        queries: ['First query', 'Follow-up query'],
        results: [],
        context: 'Building a web application',
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = ResearchSessionSchema.safeParse(session);
      expect(result.success).toBe(true);
    });
  });

  describe('FetchRequestSchema', () => {
    it('should validate fetch request', () => {
      const request = {
        url: 'https://example.com/article',
      };

      const result = FetchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate fetch request with options', () => {
      const request = {
        url: 'https://example.com',
        extractCode: true,
        maxLength: 5000,
        timeout: 10000,
      };

      const result = FetchRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should enforce timeout bounds', () => {
      expect(
        FetchRequestSchema.safeParse({ url: 'https://example.com', timeout: 500 }).success
      ).toBe(false);

      expect(
        FetchRequestSchema.safeParse({ url: 'https://example.com', timeout: 100000 }).success
      ).toBe(false);
    });
  });

  describe('FetchResponseSchema', () => {
    it('should validate successful fetch response', () => {
      const response = {
        url: 'https://example.com',
        title: 'Example Page',
        content: 'Page content here',
        codeBlocks: [],
        reliability: 'official' as const,
        fetchedAt: new Date().toISOString(),
        success: true,
      };

      const result = FetchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate failed fetch response', () => {
      const response = {
        url: 'https://example.com',
        title: '',
        content: '',
        codeBlocks: [],
        reliability: 'unknown' as const,
        fetchedAt: new Date().toISOString(),
        success: false,
        error: 'Connection timeout',
      };

      const result = FetchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('SynthesisRequestSchema', () => {
    it('should validate synthesis request', () => {
      const request = {
        query: 'How to implement authentication',
        sources: [
          {
            sourceId: 'src-1',
            type: 'web' as const,
            url: 'https://example.com',
            title: 'Source 1',
            snippet: 'Snippet 1',
            fetchedAt: new Date().toISOString(),
            reliability: 'official' as const,
            relevanceScore: 0.9,
          },
        ],
      };

      const result = SynthesisRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate synthesis style options', () => {
      const styles = ['concise', 'detailed', 'tutorial'];
      styles.forEach((style) => {
        const result = SynthesisRequestSchema.safeParse({
          query: 'test',
          sources: [{
            sourceId: 'src-1',
            type: 'web',
            url: 'https://example.com',
            title: 'Title',
            snippet: 'Snippet',
            fetchedAt: new Date().toISOString(),
            reliability: 'official',
            relevanceScore: 0.8,
          }],
          style,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('ResearchCacheEntrySchema', () => {
    it('should validate cache entry', () => {
      const entry = {
        query: 'test query',
        queryHash: 'abc123',
        result: {
          resultId: crypto.randomUUID(),
          query: 'test query',
          sources: [],
          synthesis: 'Cached result',
          confidence: 0.5,
          warnings: [],
          durationMs: 100,
          completedAt: new Date().toISOString(),
        },
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        hitCount: 5,
      };

      const result = ResearchCacheEntrySchema.safeParse(entry);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation Functions', () => {
    it('validateResearchRequest should parse valid request', () => {
      const request = validateResearchRequest({
        query: 'Test query',
      });
      expect(request.query).toBe('Test query');
    });

    it('validateResearchResult should parse valid result', () => {
      const result = validateResearchResult({
        resultId: crypto.randomUUID(),
        query: 'Query',
        sources: [],
        synthesis: 'Synthesis',
        confidence: 0.5,
        durationMs: 1000,
        completedAt: new Date().toISOString(),
      });
      expect(result.query).toBe('Query');
    });

    it('validateFetchRequest should parse valid request', () => {
      const request = validateFetchRequest({
        url: 'https://example.com',
      });
      expect(request.url).toBe('https://example.com');
    });

    it('ResearchRequestSchema.safeParse should return error for invalid', () => {
      const result = ResearchRequestSchema.safeParse({ query: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('Factory Functions', () => {
    it('createDefaultResearchRequest should create request with defaults', () => {
      const request = createDefaultResearchRequest('Test query');
      expect(request.query).toBe('Test query');
      expect(request.sources).toEqual(['web']);
      expect(request.maxSources).toBe(5);
    });
  });

  describe('Helper Functions', () => {
    it('calculateConfidence should calculate based on reliability (INV-RSH-002)', () => {
      const sources = [
        {
          sourceId: 'src-1',
          type: 'web' as const,
          url: 'https://example.com',
          title: 'Title',
          snippet: 'Snippet',
          fetchedAt: new Date().toISOString(),
          reliability: 'official' as const,
          relevanceScore: 1.0,
        },
      ];

      const confidence = calculateConfidence(sources);
      expect(confidence).toBe(1.0);
    });

    it('calculateConfidence should return 0 for empty sources', () => {
      const confidence = calculateConfidence([]);
      expect(confidence).toBe(0);
    });

    it('calculateConfidence should weight by reliability', () => {
      const sources = [
        {
          sourceId: 'src-1',
          type: 'web' as const,
          url: 'https://example.com',
          title: 'Title',
          snippet: 'Snippet',
          fetchedAt: new Date().toISOString(),
          reliability: 'community' as const,
          relevanceScore: 1.0,
        },
      ];

      const confidence = calculateConfidence(sources);
      expect(confidence).toBe(0.7); // community weight
    });

    it('hasStaleDataWarning should detect stale sources (INV-RSH-003)', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2); // 2 days ago

      const result = {
        resultId: crypto.randomUUID(),
        query: 'test',
        sources: [
          {
            sourceId: 'src-1',
            type: 'web' as const,
            url: 'https://example.com',
            title: 'Title',
            snippet: 'Snippet',
            fetchedAt: new Date().toISOString(),
            reliability: 'official' as const,
            relevanceScore: 1.0,
            publishedAt: oldDate.toISOString(),
          },
        ],
        synthesis: 'Test',
        confidence: 0.5,
        warnings: [],
        durationMs: 100,
        completedAt: new Date().toISOString(),
      };

      expect(hasStaleDataWarning(result)).toBe(true);
    });

    it('hasStaleDataWarning should return false for recent sources', () => {
      const result = {
        resultId: crypto.randomUUID(),
        query: 'test',
        sources: [
          {
            sourceId: 'src-1',
            type: 'web' as const,
            url: 'https://example.com',
            title: 'Title',
            snippet: 'Snippet',
            fetchedAt: new Date().toISOString(),
            reliability: 'official' as const,
            relevanceScore: 1.0,
            publishedAt: new Date().toISOString(),
          },
        ],
        synthesis: 'Test',
        confidence: 0.5,
        warnings: [],
        durationMs: 100,
        completedAt: new Date().toISOString(),
      };

      expect(hasStaleDataWarning(result)).toBe(false);
    });
  });

  describe('ResearchErrorCodes', () => {
    it('should define all error codes', () => {
      expect(ResearchErrorCodes.FETCH_FAILED).toBe('RSH_FETCH_FAILED');
      expect(ResearchErrorCodes.SYNTHESIS_FAILED).toBe('RSH_SYNTHESIS_FAILED');
      expect(ResearchErrorCodes.TIMEOUT).toBe('RSH_TIMEOUT');
      expect(ResearchErrorCodes.RATE_LIMITED).toBe('RSH_RATE_LIMITED');
      expect(ResearchErrorCodes.NO_SOURCES_FOUND).toBe('RSH_NO_SOURCES_FOUND');
      expect(ResearchErrorCodes.INVALID_URL).toBe('RSH_INVALID_URL');
      expect(ResearchErrorCodes.CACHE_MISS).toBe('RSH_CACHE_MISS');
    });
  });
});
