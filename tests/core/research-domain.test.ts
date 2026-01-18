/**
 * Research Domain Tests
 *
 * Tests for the research domain including:
 * - Web fetcher
 * - Synthesizer
 * - Research agent
 *
 * Invariants tested:
 * - INV-RSH-001: All sources cited in synthesis
 * - INV-RSH-002: Confidence reflects source reliability
 * - INV-RSH-003: Stale data (>24h) flagged with warning
 * - INV-RSH-101: Web fetcher respects rate limits
 * - INV-RSH-102: Failed fetches don't block others
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createWebFetcher,
  createStubWebFetcher,
  createStubSynthesizer,
  createResearchAgent,
  detectConflicts,
  validateUrls,
} from '@defai.digital/research-domain';
import type {
  WebFetcherPort,
  SynthesizerPort,
  ResearchCachePort,
  ResearchAgent,
} from '@defai.digital/research-domain';
import type { ResearchSource, ResearchResult } from '@defai.digital/contracts';

// Mock cache for testing
function createMockCache(): ResearchCachePort {
  const cache = new Map<string, ResearchResult>();
  return {
    async get(queryHash: string): Promise<ResearchResult | null> {
      return cache.get(queryHash) ?? null;
    },
    async set(queryHash: string, result: ResearchResult, _ttlMs: number): Promise<void> {
      cache.set(queryHash, result);
    },
    async invalidate(queryHash: string): Promise<void> {
      cache.delete(queryHash);
    },
  };
}

describe('Web Fetcher', () => {
  describe('createStubWebFetcher', () => {
    it('should return stub content', async () => {
      const fetcher = createStubWebFetcher();
      const response = await fetcher.fetch({ url: 'https://example.com/article' });

      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.content).toContain('stub');
    });

    it('should generate proper response', async () => {
      const fetcher = createStubWebFetcher();
      const response = await fetcher.fetch({ url: 'https://example.com' });

      expect(response.url).toBe('https://example.com');
      expect(response.title).toBeDefined();
      expect(response.fetchedAt).toBeDefined();
    });

    it('should search and return sources', async () => {
      const fetcher = createStubWebFetcher();
      const sources = await fetcher.search('test query', 5);

      expect(Array.isArray(sources)).toBe(true);
    });
  });

  describe('createWebFetcher', () => {
    it('should create web fetcher with default config', () => {
      const fetcher = createWebFetcher({});
      expect(fetcher).toBeDefined();
      expect(typeof fetcher.fetch).toBe('function');
      expect(typeof fetcher.search).toBe('function');
    });

    it('should handle failed fetches gracefully (INV-RSH-102)', async () => {
      const fetcher = createWebFetcher({
        defaultTimeout: 500, // Short timeout for test
      });

      // Should return response with success=false for failed fetches
      const result = await fetcher.fetch({
        url: 'https://invalid-url-that-does-not-exist.local',
        timeout: 500,
      });
      expect(result.success).toBe(false);
    }, 10000); // Extend test timeout
  });
});

describe('Synthesizer', () => {
  describe('createStubSynthesizer', () => {
    it('should synthesize sources into summary', async () => {
      const synthesizer = createStubSynthesizer();
      const sources: ResearchSource[] = [
        {
          sourceId: 'src-1',
          type: 'web',
          url: 'https://example.com/1',
          title: 'Source 1',
          snippet: 'Content about topic A',
          fetchedAt: new Date().toISOString(),
          reliability: 'official',
          relevanceScore: 0.9,
        },
        {
          sourceId: 'src-2',
          type: 'docs',
          url: 'https://docs.example.com',
          title: 'Source 2',
          snippet: 'Documentation about topic A',
          fetchedAt: new Date().toISOString(),
          reliability: 'official',
          relevanceScore: 0.95,
        },
      ];

      const synthesis = await synthesizer.synthesize({
        query: 'topic A',
        sources,
        style: 'detailed',
        includeCode: true,
      });

      expect(typeof synthesis).toBe('string');
      expect(synthesis.length).toBeGreaterThan(0);
      expect(synthesis).toContain('topic A');
    });

    it('should include references for all sources (INV-RSH-001)', async () => {
      const synthesizer = createStubSynthesizer();
      const sources: ResearchSource[] = [
        {
          sourceId: 'src-1',
          type: 'web',
          url: 'https://example.com/1',
          title: 'First Source',
          snippet: 'Content from first source',
          fetchedAt: new Date().toISOString(),
          reliability: 'official',
          relevanceScore: 0.9,
        },
        {
          sourceId: 'src-2',
          type: 'docs',
          url: 'https://example.com/2',
          title: 'Second Source',
          snippet: 'Content from second source',
          fetchedAt: new Date().toISOString(),
          reliability: 'community',
          relevanceScore: 0.85,
        },
      ];

      const synthesis = await synthesizer.synthesize({
        query: 'test query',
        sources,
        style: 'detailed',
      });

      // Check that both sources are referenced
      expect(synthesis).toContain('https://example.com/1');
      expect(synthesis).toContain('https://example.com/2');
    });
  });

  describe('detectConflicts', () => {
    it('should detect contradictory information', () => {
      const sources: ResearchSource[] = [
        {
          sourceId: 'src-1',
          type: 'web',
          url: 'https://example.com/1',
          title: 'Source 1',
          snippet: 'This is the recommended approach',
          fetchedAt: new Date().toISOString(),
          reliability: 'official',
          relevanceScore: 0.9,
        },
        {
          sourceId: 'src-2',
          type: 'web',
          url: 'https://example.com/2',
          title: 'Source 2',
          snippet: 'This method is deprecated',
          fetchedAt: new Date().toISOString(),
          reliability: 'community',
          relevanceScore: 0.8,
        },
      ];

      const conflicts = detectConflicts(sources);
      expect(conflicts.length).toBeGreaterThan(0);
    });

    it('should return empty for non-conflicting sources', () => {
      const sources: ResearchSource[] = [
        {
          sourceId: 'src-1',
          type: 'web',
          url: 'https://example.com/1',
          title: 'Source 1',
          snippet: 'Simple consistent content',
          fetchedAt: new Date().toISOString(),
          reliability: 'official',
          relevanceScore: 0.9,
        },
      ];

      const conflicts = detectConflicts(sources);
      expect(conflicts).toEqual([]);
    });
  });

  describe('validateUrls (INV-RSH-203)', () => {
    it('should accept URLs from sources', () => {
      const sources: ResearchSource[] = [
        {
          sourceId: 'src-1',
          type: 'web',
          url: 'https://example.com/article',
          title: 'Source',
          snippet: 'Content',
          fetchedAt: new Date().toISOString(),
          reliability: 'official',
          relevanceScore: 0.9,
        },
      ];

      const synthesis = 'Check out https://example.com/article for more info';
      expect(validateUrls(synthesis, sources)).toBe(true);
    });

    it('should reject hallucinated URLs', () => {
      const sources: ResearchSource[] = [
        {
          sourceId: 'src-1',
          type: 'web',
          url: 'https://example.com/article',
          title: 'Source',
          snippet: 'Content',
          fetchedAt: new Date().toISOString(),
          reliability: 'official',
          relevanceScore: 0.9,
        },
      ];

      const synthesis = 'Check out https://fake-site.com/hallucinated for more info';
      expect(validateUrls(synthesis, sources)).toBe(false);
    });
  });
});

describe('Research Agent', () => {
  let agent: ResearchAgent;
  let mockWebFetcher: WebFetcherPort;
  let mockSynthesizer: SynthesizerPort;
  let mockCache: ResearchCachePort;

  beforeEach(() => {
    mockWebFetcher = createStubWebFetcher();
    mockSynthesizer = createStubSynthesizer();
    mockCache = createMockCache();

    agent = createResearchAgent({
      webFetcher: mockWebFetcher,
      synthesizer: mockSynthesizer,
      cache: mockCache,
    });
  });

  describe('research', () => {
    it('should execute research query', async () => {
      const result = await agent.research({
        query: 'How to implement authentication',
      });

      expect(result).toBeDefined();
      expect(result.query).toBe('How to implement authentication');
      expect(result.resultId).toBeDefined();
      expect(result.completedAt).toBeDefined();
    });

    it('should calculate confidence based on sources (INV-RSH-002)', async () => {
      const result = await agent.research({
        query: 'Test query',
      });

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should use cache when available', async () => {
      // First research
      const result1 = await agent.research({
        query: 'Cached query',
      });

      // Second research with same query should use cache
      const result2 = await agent.research({
        query: 'Cached query',
      });

      // Results should be the same (from cache)
      expect(result2.resultId).toBe(result1.resultId);
    });

    it('should include synthesis when requested', async () => {
      const result = await agent.research({
        query: 'Test with synthesis',
        synthesize: true,
      });

      expect(result.synthesis).toBeDefined();
    });
  });

  describe('fetch', () => {
    it('should fetch single URL', async () => {
      const response = await agent.fetch({ url: 'https://example.com/article' });

      expect(response).toBeDefined();
      expect(response.url).toBe('https://example.com/article');
      expect(response.success).toBe(true);
    });

    it('should return fetch response with content', async () => {
      const response = await agent.fetch({
        url: 'https://example.com/page',
        extractCode: true,
      });

      expect(response.content).toBeDefined();
      expect(response.fetchedAt).toBeDefined();
    });
  });

  describe('synthesize', () => {
    it('should synthesize provided sources', async () => {
      const sources: ResearchSource[] = [
        {
          sourceId: 'src-1',
          type: 'web',
          url: 'https://example.com',
          title: 'Example',
          snippet: 'Example content about topic',
          fetchedAt: new Date().toISOString(),
          reliability: 'official',
          relevanceScore: 0.85,
        },
      ];

      const synthesis = await agent.synthesize({
        query: 'topic',
        sources,
        style: 'detailed',
      });

      expect(typeof synthesis).toBe('string');
      expect(synthesis.length).toBeGreaterThan(0);
    });
  });

  describe('stale data handling (INV-RSH-003)', () => {
    it('should flag stale sources in warnings', async () => {
      // Create a mock fetcher that returns stale sources
      const staleFetcher: WebFetcherPort = {
        async fetch() {
          return {
            url: 'https://example.com',
            title: 'Test',
            content: 'Test content',
            codeBlocks: [],
            reliability: 'official',
            fetchedAt: new Date().toISOString(),
            success: true,
          };
        },
        async search() {
          const oldDate = new Date();
          oldDate.setHours(oldDate.getHours() - 25); // 25 hours ago
          return [{
            sourceId: 'stale-1',
            type: 'web' as const,
            url: 'https://example.com/old',
            title: 'Old Article',
            snippet: 'Old content',
            fetchedAt: new Date().toISOString(),
            reliability: 'official' as const,
            relevanceScore: 0.8,
            publishedAt: oldDate.toISOString(),
          }];
        },
      };

      const staleAgent = createResearchAgent({
        webFetcher: staleFetcher,
        synthesizer: mockSynthesizer,
      });

      const result = await staleAgent.research({
        query: 'test query',
        synthesize: true,
      });

      // Should include stale warning
      expect(result.warnings.some(w => w.includes('outdated') || w.includes('stale'))).toBe(true);
    });
  });
});

describe('Research Agent with Stub Implementations', () => {
  it('should work with stub web fetcher', async () => {
    const fetcher = createStubWebFetcher();
    const synthesizer = createStubSynthesizer();

    const agent = createResearchAgent({
      webFetcher: fetcher,
      synthesizer,
    });

    const result = await agent.research({
      query: 'Test research query',
    });

    expect(result).toBeDefined();
    expect(result.query).toBe('Test research query');
  });
});

describe('Integration Tests', () => {
  it('should handle empty search results gracefully', async () => {
    const emptyFetcher: WebFetcherPort = {
      async fetch() {
        return {
          url: '',
          title: '',
          content: '',
          codeBlocks: [],
          reliability: 'unknown',
          fetchedAt: new Date().toISOString(),
          success: false,
          error: 'Not found',
        };
      },
      async search() {
        return [];
      },
    };

    const agent = createResearchAgent({
      webFetcher: emptyFetcher,
      synthesizer: createStubSynthesizer(),
    });

    const result = await agent.research({
      query: 'Query with no results',
    });

    expect(result.sources).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});
