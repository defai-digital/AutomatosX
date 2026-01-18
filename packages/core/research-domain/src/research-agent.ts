/**
 * Research Agent
 *
 * Main research agent implementation.
 *
 * Invariants:
 * - INV-RSH-001: All sources cited in synthesis
 * - INV-RSH-002: Confidence reflects source reliability
 * - INV-RSH-003: Stale data flagged with warning
 */

import type {
  ResearchRequest,
  ResearchResult,
  FetchRequest,
  FetchResponse,
  SynthesisRequest,
  ResearchSource,
} from '@defai.digital/contracts';
import {
  calculateConfidence,
  hasStaleDataWarning,
} from '@defai.digital/contracts';
import type { ResearchAgent, ResearchAgentOptions } from './types.js';
import { createStubWebFetcher } from './web-fetcher.js';
import { createStubSynthesizer, detectConflicts } from './synthesizer.js';

/**
 * Create a research agent
 */
export function createResearchAgent(
  options: Partial<ResearchAgentOptions> = {}
): ResearchAgent {
  const {
    webFetcher = createStubWebFetcher(),
    synthesizer = createStubSynthesizer(),
    cache,
    defaultTimeout = 60000,
  } = options;

  return {
    async research(request: ResearchRequest): Promise<ResearchResult> {
      const startTime = Date.now();
      const resultId = crypto.randomUUID();

      // Check cache
      if (cache) {
        const queryHash = hashQuery(request.query);
        const cached = await cache.get(queryHash);
        if (cached) {
          return cached;
        }
      }

      // Fetch sources
      const sources = await fetchSources(request, webFetcher, defaultTimeout);

      // Calculate warnings
      const warnings: string[] = [];

      // INV-RSH-003: Check for stale data
      if (sources.length > 0) {
        const tempResult = {
          resultId,
          query: request.query,
          sources,
          synthesis: '',
          codeExamples: [],
          confidence: 0,
          warnings: [],
          durationMs: 0,
          completedAt: new Date().toISOString(),
        };
        if (hasStaleDataWarning(tempResult)) {
          warnings.push('Some sources may contain outdated information (>24 hours old)');
        }
      }

      // Detect conflicts
      // INV-RSH-202: Note conflicting information
      const conflicts = detectConflicts(sources);
      warnings.push(...conflicts);

      // Synthesize results
      let synthesis = '';
      if (request.synthesize && sources.length > 0) {
        synthesis = await synthesizer.synthesize({
          query: request.query,
          sources,
          style: 'detailed',
          includeCode: request.includeCode,
          maxLength: 10000,
        });
      }

      // INV-RSH-002: Calculate confidence based on source reliability
      const confidence = calculateConfidence(sources);

      const result: ResearchResult = {
        resultId,
        query: request.query,
        sources,
        synthesis,
        codeExamples: extractCodeExamples(sources),
        confidence,
        warnings,
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      };

      // Cache result
      if (cache) {
        const queryHash = hashQuery(request.query);
        await cache.set(queryHash, result, 3600000); // 1 hour TTL
      }

      return result;
    },

    async fetch(request: FetchRequest): Promise<FetchResponse> {
      return webFetcher.fetch(request);
    },

    async synthesize(request: SynthesisRequest): Promise<string> {
      return synthesizer.synthesize(request);
    },
  };
}

/**
 * Fetch sources for a research query
 * INV-RSH-102: Failed sources don't block
 */
async function fetchSources(
  request: ResearchRequest,
  webFetcher: { search: (query: string, maxResults: number) => Promise<ResearchSource[]> },
  timeout: number
): Promise<ResearchSource[]> {
  const sources: ResearchSource[] = [];

  // INV-RSH-100: Enforce timeout
  const timeoutPromise = new Promise<ResearchSource[]>((_, reject) =>
    setTimeout(() => reject(new Error('Research timeout')), request.timeout ?? timeout)
  );

  try {
    // Search for sources
    const searchResults = await Promise.race([
      webFetcher.search(request.query, request.maxSources),
      timeoutPromise,
    ]);

    sources.push(...searchResults);
  } catch (error) {
    // Log but don't fail
    console.warn('[research-agent] Search failed:', error);
  }

  return sources;
}

/**
 * Extract code examples from sources
 */
function extractCodeExamples(
  sources: ResearchSource[]
): { code: string; language: string; source?: string; tested: boolean }[] {
  const examples: { code: string; language: string; source?: string; tested: boolean }[] = [];

  for (const source of sources) {
    if (source.content) {
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;

      while ((match = codeBlockRegex.exec(source.content)) !== null) {
        const code = match[2]?.trim();
        if (code && code.length > 10) {
          examples.push({
            code,
            language: match[1] ?? 'text',
            source: source.url,
            tested: false,
          });
        }
      }
    }
  }

  return examples.slice(0, 10); // Limit to 10 examples
}

/**
 * Hash a query for caching
 */
function hashQuery(query: string): string {
  const normalized = query.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
