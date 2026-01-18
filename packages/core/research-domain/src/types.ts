/**
 * Research Domain Types
 *
 * Port interfaces for the research agent.
 */

import type {
  ResearchRequest,
  ResearchResult,
  ResearchSource,
  FetchRequest,
  FetchResponse,
  SynthesisRequest,
} from '@defai.digital/contracts';

/**
 * Port for fetching web content
 */
export interface WebFetcherPort {
  /**
   * Fetch content from a URL
   */
  fetch(request: FetchRequest): Promise<FetchResponse>;

  /**
   * Search the web for a query
   */
  search(query: string, maxResults: number): Promise<ResearchSource[]>;
}

/**
 * Port for synthesizing research results
 */
export interface SynthesizerPort {
  /**
   * Synthesize sources into a coherent answer
   */
  synthesize(request: SynthesisRequest): Promise<string>;
}

/**
 * Port for caching research results
 */
export interface ResearchCachePort {
  /**
   * Get cached result for query
   */
  get(queryHash: string): Promise<ResearchResult | null>;

  /**
   * Cache a result
   */
  set(queryHash: string, result: ResearchResult, ttlMs: number): Promise<void>;

  /**
   * Invalidate cache entry
   */
  invalidate(queryHash: string): Promise<void>;
}

/**
 * Research agent options
 */
export interface ResearchAgentOptions {
  /**
   * Web fetcher port
   */
  webFetcher: WebFetcherPort;

  /**
   * Synthesizer port
   */
  synthesizer: SynthesizerPort;

  /**
   * Optional cache port
   */
  cache?: ResearchCachePort;

  /**
   * Default timeout for operations
   */
  defaultTimeout?: number;

  /**
   * Maximum concurrent fetches
   * INV-RSH-101: Limited to 5
   */
  maxConcurrentFetches?: number;
}

/**
 * Research agent interface
 */
export interface ResearchAgent {
  /**
   * Execute a research query
   */
  research(request: ResearchRequest): Promise<ResearchResult>;

  /**
   * Fetch a single URL
   */
  fetch(request: FetchRequest): Promise<FetchResponse>;

  /**
   * Synthesize existing sources
   */
  synthesize(request: SynthesisRequest): Promise<string>;
}
